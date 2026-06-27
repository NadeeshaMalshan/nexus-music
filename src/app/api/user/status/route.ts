import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchGoogleUserEmail } from "@/lib/googleUserFromAccessToken";
import redis from "@/lib/redis";
import pusherServer from "@/lib/pusherServer";

const USER_DIRECTORY_KEY = "users:directory";
const ONLINE_WINDOW_MS = 5 * 60 * 1000;

function bearerToken(request: Request): string | null {
  const h = request.headers.get("authorization") || request.headers.get("Authorization");
  const m = h?.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

function getDeviceName(userAgent: string | null) {
  if (!userAgent) return "Unknown Device";
  let os = "Unknown OS";
  let browser = "Unknown Browser";

  if (userAgent.includes("Win")) os = "Windows";
  else if (userAgent.includes("Mac")) os = "Mac";
  else if (userAgent.includes("Android")) os = "Android";
  else if (userAgent.includes("iPhone")) os = "iPhone";
  else if (userAgent.includes("Linux")) os = "Linux";

  if (userAgent.includes("Firefox")) browser = "Firefox";
  else if (userAgent.includes("Edg")) browser = "Edge";
  else if (userAgent.includes("Chrome")) browser = "Chrome";
  else if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) browser = "Safari";

  return `${os} ${browser}`;
}

async function resolveUserEmail(request: Request): Promise<string | null> {
  const session = await getServerSession(authOptions);
  if (session?.user?.email) return session.user.email;

  const token = bearerToken(request);
  if (!token) return null;
  return fetchGoogleUserEmail(token);
}

function formatLastOnline(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export async function GET(request: Request) {
  const email = await resolveUserEmail(request);
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!redis) {
    return NextResponse.json([]);
  }

  const r = redis;

  try {
    const followedEmails = await r.smembers(`user:following:${email}`);
    if (!followedEmails || followedEmails.length === 0) {
      return NextResponse.json([]);
    }

    const statuses = await Promise.all(
      followedEmails.map(async (fEmail) => {
        try {
          const [rawStatus, rawLastActivity, dirVal] = await Promise.all([
            r.get(`user:status:${fEmail}`),
            r.get(`user:last_activity:${fEmail}`),
            r.hget(USER_DIRECTORY_KEY, fEmail),
          ]);

          const details = dirVal
            ? (typeof dirVal === "string" ? JSON.parse(dirVal) : dirVal)
            : { name: fEmail.split("@")[0], email: fEmail, image: "" };

          const liveStatus = rawStatus
            ? (typeof rawStatus === "string" ? JSON.parse(rawStatus) : rawStatus)
            : null;

          const lastActivity = rawLastActivity
            ? (typeof rawLastActivity === "string" ? JSON.parse(rawLastActivity) : rawLastActivity)
            : null;

          const liveTimestamp = liveStatus?.timestamp || 0;
          const isRecentlyLive = liveTimestamp > 0 && Date.now() - liveTimestamp < ONLINE_WINDOW_MS;
          const isOnline = !!(liveStatus?.isPlaying && isRecentlyLive);

          const activitySource = isOnline
            ? liveStatus
            : lastActivity || (liveStatus && !liveStatus.isPlaying ? liveStatus : null);

          const lastOnline = activitySource?.lastOnline || activitySource?.timestamp || null;

          return {
            user: details,
            isOnline,
            status: isOnline ? liveStatus : null,
            lastSong: activitySource?.song || null,
            lastOnline,
            lastOnlineLabel: lastOnline ? formatLastOnline(lastOnline) : null,
          };
        } catch (e) {
          console.error(`Failed to load status/details for ${fEmail}:`, e);
          return {
            user: { name: fEmail.split("@")[0], email: fEmail, image: "" },
            isOnline: false,
            status: null,
            lastSong: null,
            lastOnline: null,
            lastOnlineLabel: null,
          };
        }
      })
    );

    statuses.sort((a, b) => {
      if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
      return (b.lastOnline || 0) - (a.lastOnline || 0);
    });

    return NextResponse.json(statuses);
  } catch (error) {
    console.error("Failed to fetch followed users statuses:", error);
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
    const body = await request.json();
    const statusKey = `user:status:${email}`;
    const lastActivityKey = `user:last_activity:${email}`;

    if (body.action === "clear") {
      const rawExisting = await redis.get(statusKey);
      if (rawExisting) {
        try {
          const existing = typeof rawExisting === "string" ? JSON.parse(rawExisting) : rawExisting;
          if (existing?.song) {
            await redis.set(
              lastActivityKey,
              JSON.stringify({
                song: existing.song,
                isPlaying: false,
                lastOnline: Date.now(),
              })
            );
          }
        } catch {
          /* ignore parse errors */
        }
      }
      await redis.del(statusKey);
      
      // Trigger clear event
      await pusherServer.trigger("private-global-activity", "status-update", {
        email,
        isPlaying: false,
        song: null
      }).catch(console.error);

      // Trigger cross-device clear
      const emailHash = Buffer.from(email).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
      const deviceId = body.deviceId || "unknown";
      await redis.hdel(`user:devices:${emailHash}`, deviceId);

      await pusherServer.trigger(`presence-user-${emailHash}`, "cross-device-play", {
        deviceId,
        isPlaying: false,
      }).catch(console.error);

      return NextResponse.json({ success: true });
    }

    const { song, isPlaying } = body;
    if (!song) {
      return NextResponse.json({ error: "Missing song details" }, { status: 400 });
    }

    const now = Date.now();
    const songPayload = {
      id: song.id,
      title: song.title,
      artist: song.artist,
      artwork: song.artwork || "",
      duration: song.duration || "0:00",
    };

    const statusPayload = {
      song: songPayload,
      isPlaying: !!isPlaying,
      timestamp: now,
      lastOnline: now,
    };

    const lastActivityPayload = {
      song: songPayload,
      isPlaying: !!isPlaying,
      lastOnline: now,
    };

    await redis.set(statusKey, JSON.stringify(statusPayload), { ex: 3600 });
    await redis.set(lastActivityKey, JSON.stringify(lastActivityPayload));

    const emailHash = Buffer.from(email).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
    const userAgent = request.headers.get("user-agent");
    const deviceName = body.deviceName || getDeviceName(userAgent);
    const deviceId = body.deviceId || "unknown";

    const deviceState = {
      deviceId,
      deviceName,
      syncMode: "standalone",
      currentSong: songPayload,
      isPlaying: !!isPlaying,
      lastUpdated: now,
      groupId: null,
      targetDeviceId: null,
      controllerDeviceId: null,
    };

    await redis.hset(`user:devices:${emailHash}`, {
      [deviceId]: JSON.stringify(deviceState),
    });

    // 1. To friends
    await pusherServer.trigger("private-global-activity", "status-update", {
      email,
      isPlaying: !!isPlaying,
      song: songPayload,
      timestamp: now,
    }).catch(console.error);

    // 2. To cross-device listener
    await pusherServer.trigger(`presence-user-${emailHash}`, "cross-device-play", {
      deviceName,
      deviceId,
      isPlaying: !!isPlaying,
      song: songPayload,
    }).catch(console.error);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update user status:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
