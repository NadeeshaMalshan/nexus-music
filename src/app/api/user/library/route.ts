import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchGoogleUserEmail } from "@/lib/googleUserFromAccessToken";
import redis from "@/lib/redis";
import { resolveUserEmail, mergeUserLibraryData, LIBRARY_KEY_PREFIX } from "@/lib/userLibrary";

export async function GET(request: Request) {
  const email = await resolveUserEmail(request);
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!redis) {
    return NextResponse.json({ playlists: null, liked: null, history: null, syncedAt: null });
  }

  const [playlists, liked, history, syncedAt] = await Promise.all([
    redis.get(`${LIBRARY_KEY_PREFIX}:playlists:${email}`),
    redis.get(`${LIBRARY_KEY_PREFIX}:liked:${email}`),
    redis.get(`${LIBRARY_KEY_PREFIX}:history:${email}`),
    redis.get(`${LIBRARY_KEY_PREFIX}:synced_at:${email}`),
  ]);

  return NextResponse.json({
    playlists: playlists || null,
    liked: liked || null,
    history: history || null,
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
    const history = body?.history || null;

    await mergeUserLibraryData(email, playlists, liked, history);

    return NextResponse.json({ success: true, playlists: playlists.length, liked: liked.length, history: !!history });
  } catch (error) {
    console.error("Failed to sync user library:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
