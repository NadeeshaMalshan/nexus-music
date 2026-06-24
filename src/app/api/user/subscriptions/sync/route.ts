import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchGoogleUserEmail } from "@/lib/googleUserFromAccessToken";
import { fetchAllSubscribedChannels } from "@/lib/youtubeData";
import redis from "@/lib/redis";

const SYNC_COOLDOWN_MS = 24 * 60 * 60 * 1000;

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

export async function POST(request: Request) {
  const email = await resolveUserEmail(request);
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!redis) {
    return NextResponse.json({ error: "Redis not configured" }, { status: 500 });
  }

  const session = await getServerSession(authOptions);
  const accessToken = session?.accessToken;
  if (!accessToken) {
    return NextResponse.json({ error: "YouTube access required" }, { status: 401 });
  }

  try {
    const syncKey = `user:subscriptions_synced:${email}`;
    const artistKey = `user:following_artists:${email}`;
    const existingCount = await redis.scard(artistKey);
    const lastSyncRaw = await redis.get(syncKey);
    const lastSync = Number(lastSyncRaw || 0);

    if (existingCount > 0 && lastSync && Date.now() - lastSync < SYNC_COOLDOWN_MS) {
      return NextResponse.json({ success: true, skipped: true, count: existingCount });
    }

    const channels = await fetchAllSubscribedChannels(accessToken);
    await redis.del(artistKey);

    if (channels.length > 0) {
      const members = channels.map((c) => JSON.stringify(c)) as [string, ...string[]];
      await redis.sadd(artistKey, ...members);
    }

    await redis.set(syncKey, String(Date.now()));

    return NextResponse.json({ success: true, count: channels.length });
  } catch (error) {
    console.error("Failed to sync YouTube subscriptions:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
