import { NextResponse } from "next/server";
import redis from "@/lib/redis";
import { resolveUserEmail, LIBRARY_KEY_PREFIX } from "@/lib/userLibrary";

export async function GET(request: Request) {
  const email = await resolveUserEmail(request);
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const playlistId = searchParams.get("playlistId");
  if (!playlistId) {
    return NextResponse.json({ error: "Missing playlistId" }, { status: 400 });
  }

  if (!redis) {
    return NextResponse.json({ tracks: null });
  }

  const tracksStr = await redis.get(`${LIBRARY_KEY_PREFIX}:playlist_tracks:${playlistId}:${email}`);
  let tracks = null;
  if (typeof tracksStr === "string") {
    try {
      tracks = JSON.parse(tracksStr);
    } catch {}
  } else if (Array.isArray(tracksStr)) {
    tracks = tracksStr;
  }

  return NextResponse.json({ tracks });
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
    const { playlistId, tracks } = body;
    if (!playlistId || !Array.isArray(tracks)) {
      return NextResponse.json({ error: "Invalid playlistId or tracks" }, { status: 400 });
    }

    const key = `${LIBRARY_KEY_PREFIX}:playlist_tracks:${playlistId}:${email}`;
    await redis.set(key, JSON.stringify(tracks));
    // Expire cache in 7 days to prevent keys from lasting forever
    await redis.expire(key, 7 * 24 * 60 * 60);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to save playlist tracks to Redis:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
