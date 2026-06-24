import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchGoogleUserEmail } from "@/lib/googleUserFromAccessToken";
import redis from "@/lib/redis";

const LIBRARY_KEY_PREFIX = "user:library";

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
    return NextResponse.json({ playlists: null, liked: null, syncedAt: null });
  }

  const [playlists, liked, syncedAt] = await Promise.all([
    redis.get(`${LIBRARY_KEY_PREFIX}:playlists:${email}`),
    redis.get(`${LIBRARY_KEY_PREFIX}:liked:${email}`),
    redis.get(`${LIBRARY_KEY_PREFIX}:synced_at:${email}`),
  ]);

  return NextResponse.json({
    playlists: playlists || null,
    liked: liked || null,
    syncedAt: syncedAt || null,
  });
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
    const playlists = Array.isArray(body?.playlists) ? body.playlists : [];
    const liked = Array.isArray(body?.liked) ? body.liked : [];

    await Promise.all([
      redis.set(`${LIBRARY_KEY_PREFIX}:playlists:${email}`, JSON.stringify(playlists)),
      redis.set(`${LIBRARY_KEY_PREFIX}:liked:${email}`, JSON.stringify(liked)),
      redis.set(`${LIBRARY_KEY_PREFIX}:synced_at:${email}`, String(Date.now())),
    ]);

    return NextResponse.json({ success: true, playlists: playlists.length, liked: liked.length });
  } catch (error) {
    console.error("Failed to sync user library:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
