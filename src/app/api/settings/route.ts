import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchGoogleUserEmail } from "@/lib/googleUserFromAccessToken";
import redis from "@/lib/redis";
import { DEFAULT_SETTINGS, UserSettings } from "@/types/settings";

const SETTINGS_KEY_PREFIX = "user_settings:";

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
    return NextResponse.json(DEFAULT_SETTINGS);
  }

  if (!redis) {
    return NextResponse.json(DEFAULT_SETTINGS);
  }

  try {
    const cachedSettings = await redis.get(`${SETTINGS_KEY_PREFIX}${email}`);
    if (cachedSettings) {
      return NextResponse.json(typeof cachedSettings === 'string' ? JSON.parse(cachedSettings) : cachedSettings);
    }
    return NextResponse.json(DEFAULT_SETTINGS);
  } catch (error) {
    console.error("Failed to fetch settings from Redis:", error);
    return NextResponse.json(DEFAULT_SETTINGS);
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
    const settings: UserSettings = await request.json();
    await redis.set(`${SETTINGS_KEY_PREFIX}${email}`, JSON.stringify(settings));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to save settings to Redis:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
