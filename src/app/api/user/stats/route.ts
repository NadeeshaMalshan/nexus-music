import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchGoogleUserEmail } from "@/lib/googleUserFromAccessToken";
import redis from "@/lib/redis";
import { youtubeTimestampToSeconds } from "@/lib/duration";

const SETTINGS_KEY_PREFIX = "user_settings:";
const USER_DIRECTORY_KEY = "users:directory";

function bearerToken(request: Request): string | null {
  const h = request.headers.get("authorization") || request.headers.get("Authorization");
  const m = h?.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

async function resolveUserEmail(request: Request): Promise<string | null> {
  const session = await getServerSession(authOptions);
  if (session?.user?.email) return session.user.email;

  const token = bearerToken(request);
  if (!token) return null;
  return fetchGoogleUserEmail(token);
}

// Helper to calculate the Wrapped year based on a Dec 10th cut-off
function getWrappedYear(date: Date): number {
  const year = date.getFullYear();
  // Cut-off is December 10th
  const cutoff = new Date(year, 11, 10);
  if (date > cutoff) {
    return year + 1;
  }
  return year;
}

// Parses Upstash Redis zrange results withScores robustly
function parseZRangeResults(raw: any[]): { member: string; score: number }[] {
  const results: { member: string; score: number }[] = [];
  if (!Array.isArray(raw) || raw.length === 0) return results;

  if (typeof raw[0] === "object" && raw[0] !== null && "member" in raw[0]) {
    for (const item of raw) {
      results.push({ member: String(item.member), score: Number(item.score || 0) });
    }
  } else if (Array.isArray(raw[0])) {
    for (const pair of raw) {
      results.push({ member: String(pair[0]), score: Number(pair[1] || 0) });
    }
  } else {
    for (let i = 0; i < raw.length; i += 2) {
      const member = raw[i];
      const score = raw[i + 1];
      if (member !== undefined && score !== undefined) {
        results.push({ member: String(member), score: Number(score || 0) });
      }
    }
  }
  return results;
}

export async function GET(request: Request) {
  const viewerEmail = await resolveUserEmail(request);
  if (!viewerEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!redis) {
    return NextResponse.json({ error: "Redis not configured" }, { status: 500 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const targetEmail = searchParams.get("user") || viewerEmail;

    // Fetch user details from directory
    const dirVal = await redis.hget(USER_DIRECTORY_KEY, targetEmail);
    const userDetails = dirVal
      ? (typeof dirVal === "string" ? JSON.parse(dirVal) : dirVal)
      : { name: targetEmail.split("@")[0], email: targetEmail, image: "" };

    // Fetch stats
    const rawListeningTime = await redis.hget(`user:stats:${targetEmail}`, "listeningTime");
    const listeningTime = Number(rawListeningTime || 0);

    const songsDiscovered = await redis.scard(`user:discovered_songs:${targetEmail}`);
    const artistsDiscovered = await redis.scard(`user:discovered_artists:${targetEmail}`);

    // Fetch recent played
    const rawRecent = await redis.lrange(`user:recent:${targetEmail}`, 0, 19);
    const recentPlayed = (rawRecent || []).map((item) => {
      try {
        return typeof item === "string" ? JSON.parse(item) : item;
      } catch {
        return null;
      }
    }).filter(Boolean);

    // Fetch top songs
    const rawTopSongs = await redis.zrange(`user:top_songs:${targetEmail}`, 0, 9, { rev: true, withScores: true });
    const topSongs = parseZRangeResults(rawTopSongs).map((item) => {
      try {
        const songObj = JSON.parse(item.member);
        return { ...songObj, playCount: item.score };
      } catch {
        return { title: item.member, playCount: item.score };
      }
    });

    // Fetch top artists
    const rawTopArtists = await redis.zrange(`user:top_artists:${targetEmail}`, 0, 9, { rev: true, withScores: true });
    const topArtists = parseZRangeResults(rawTopArtists).map((item) => ({
      name: item.member,
      playCount: item.score,
    }));

    // Follower / Following info
    const followersCount = await redis.scard(`user:followers:${targetEmail}`);
    const followingCount = await redis.scard(`user:following:${targetEmail}`);
    const isFollowing = viewerEmail !== targetEmail
      ? await redis.sismember(`user:followers:${targetEmail}`, viewerEmail) === 1
      : false;

    // Fetch real-time live status
    const rawStatus = await redis.get(`user:status:${targetEmail}`);
    const liveStatus = rawStatus
      ? (typeof rawStatus === "string" ? JSON.parse(rawStatus) : rawStatus)
      : null;

    // Calculate Wrapped Availability (Dec 10 to Jan 15)
    const now = new Date();
    const month = now.getMonth(); // 11 = Dec, 0 = Jan
    const date = now.getDate();
    let activeWrappedYear: number | null = null;

    if (month === 11 && date >= 10) {
      activeWrappedYear = now.getFullYear();
    } else if (month === 0 && date <= 15) {
      activeWrappedYear = now.getFullYear() - 1;
    }

    let wrappedData = null;
    if (activeWrappedYear !== null) {
      const rawWrappedSongs = await redis.zrange(`user:wrapped:songs:${targetEmail}:${activeWrappedYear}`, 0, 4, { rev: true, withScores: true });
      const wrappedSongs = parseZRangeResults(rawWrappedSongs).map((item) => {
        try {
          const songObj = JSON.parse(item.member);
          return { ...songObj, playCount: item.score };
        } catch {
          return { title: item.member, playCount: item.score };
        }
      });

      const rawWrappedArtists = await redis.zrange(`user:wrapped:artists:${targetEmail}:${activeWrappedYear}`, 0, 4, { rev: true, withScores: true });
      const wrappedArtists = parseZRangeResults(rawWrappedArtists).map((item) => ({
        name: item.member,
        playCount: item.score,
      }));

      const rawWrappedTime = await redis.hget(`user:wrapped:stats:${targetEmail}:${activeWrappedYear}`, "listeningTime");
      const wrappedListeningTime = Number(rawWrappedTime || 0);

      wrappedData = {
        year: activeWrappedYear,
        topSongs: wrappedSongs,
        topArtists: wrappedArtists,
        listeningTime: wrappedListeningTime,
      };
    }

    return NextResponse.json({
      user: userDetails,
      listeningTime,
      songsDiscovered,
      artistsDiscovered,
      recentPlayed,
      topSongs,
      topArtists,
      followersCount,
      followingCount,
      isFollowing,
      liveStatus,
      wrappedData,
    });
  } catch (error) {
    console.error("Failed to GET user stats:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const email = await resolveUserEmail(request);
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!redis) {
    return NextResponse.json({ error: "Redis not configured" }, { status: 500 });
  }

  try {
    const { action, song } = await request.json();
    if (action !== "play" || !song || !song.id) {
      return NextResponse.json({ error: "Invalid action or parameters" }, { status: 400 });
    }

    // 1. Calculate song duration in seconds
    const seconds = youtubeTimestampToSeconds(song.duration) || 200; // default 200 seconds fallback

    // 2. Increment global listening time
    await redis.hincrby(`user:stats:${email}`, "listeningTime", seconds);

    // Normalize song object for de-duplication in sorted sets
    const normalizedSong = {
      id: song.id,
      title: song.title,
      artist: song.artist,
      artwork: song.artwork || "",
      duration: song.duration || "0:00",
    };
    const songStr = JSON.stringify(normalizedSong);

    // 3. Increment play counts
    await redis.zincrby(`user:top_songs:${email}`, 1, songStr);
    if (song.artist) {
      await redis.zincrby(`user:top_artists:${email}`, 1, song.artist);
    }

    // 4. Record unique plays (discovered metrics)
    await redis.sadd(`user:discovered_songs:${email}`, song.id);
    if (song.artist) {
      await redis.sadd(`user:discovered_artists:${email}`, song.artist);
    }

    // 5. Update Recent Plays list (de-duped)
    const recentKey = `user:recent:${email}`;
    await redis.lrem(recentKey, 0, songStr);
    await redis.lpush(recentKey, songStr);
    await redis.ltrim(recentKey, 0, 49); // Keep last 50

    // 6. Update Daily Activity (400 days retention policy)
    const dateStr = new Date().toISOString().split("T")[0];
    const dailyKey = `user:activity:${email}:${dateStr}`;
    await redis.hincrby(dailyKey, "plays", 1);
    await redis.hincrby(dailyKey, "minutes", Math.round(seconds / 60));
    await redis.expire(dailyKey, 400 * 24 * 3600); // 400 days expiry TTL

    // 7. Increment Wrapped stats with Dec 10 cutoff logic
    const wrappedYear = getWrappedYear(new Date());
    await redis.zincrby(`user:wrapped:songs:${email}:${wrappedYear}`, 1, songStr);
    if (song.artist) {
      await redis.zincrby(`user:wrapped:artists:${email}:${wrappedYear}`, 1, song.artist);
    }
    await redis.hincrby(`user:wrapped:stats:${email}:${wrappedYear}`, "listeningTime", seconds);

    // 8. Auto-populate user directory
    const session = await getServerSession(authOptions);
    if (session?.user) {
      const userInfo = {
        name: session.user.name || email.split("@")[0],
        email: email,
        image: session.user.image || "",
      };
      await redis.hset(USER_DIRECTORY_KEY, { [email]: JSON.stringify(userInfo) });
    } else {
      // Best effort lookup from directory or insert placeholder if not present
      const exists = await redis.hexists(USER_DIRECTORY_KEY, email);
      if (!exists) {
        const userInfo = {
          name: email.split("@")[0],
          email: email,
          image: "",
        };
        await redis.hset(USER_DIRECTORY_KEY, { [email]: JSON.stringify(userInfo) });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to log play event:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
