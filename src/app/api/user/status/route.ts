import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchGoogleUserEmail } from "@/lib/googleUserFromAccessToken";
import redis from "@/lib/redis";

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
          const rawStatus = await r.get(`user:status:${fEmail}`);
          const dirVal = await r.hget("users:directory", fEmail);
          const details = dirVal
            ? (typeof dirVal === "string" ? JSON.parse(dirVal) : dirVal)
            : { name: fEmail.split("@")[0], email: fEmail, image: "" };

          const status = rawStatus
            ? (typeof rawStatus === "string" ? JSON.parse(rawStatus) : rawStatus)
            : null;

          return {
            user: details,
            status,
          };
        } catch (e) {
          console.error(`Failed to load status/details for ${fEmail}:`, e);
          return {
            user: { name: fEmail.split("@")[0], email: fEmail, image: "" },
            status: null,
          };
        }
      })
    );

    // Sort active users first
    statuses.sort((a, b) => {
      const aActive = a.status?.isPlaying ? 1 : 0;
      const bActive = b.status?.isPlaying ? 1 : 0;
      return bActive - aActive;
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

    if (body.action === "clear") {
      await redis.del(statusKey);
      return NextResponse.json({ success: true });
    }

    const { song, isPlaying } = body;
    if (!song) {
      return NextResponse.json({ error: "Missing song details" }, { status: 400 });
    }

    const statusPayload = {
      song: {
        id: song.id,
        title: song.title,
        artist: song.artist,
        artwork: song.artwork || "",
        duration: song.duration || "0:00",
      },
      isPlaying: !!isPlaying,
      timestamp: Date.now(),
    };

    // Update status in Redis with 1 hour safeguard TTL
    await redis.set(statusKey, JSON.stringify(statusPayload), { ex: 3600 });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update user status:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
