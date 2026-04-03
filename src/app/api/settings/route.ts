import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import redis from "@/lib/redis";
import { DEFAULT_SETTINGS, UserSettings } from "@/types/settings";

const SETTINGS_KEY_PREFIX = "user_settings:";

export async function GET() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.email) {
    return NextResponse.json(DEFAULT_SETTINGS);
  }

  if (!redis) {
    return NextResponse.json(DEFAULT_SETTINGS);
  }

  try {
    const cachedSettings = await redis.get(`${SETTINGS_KEY_PREFIX}${session.user.email}`);
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
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!redis) {
    return NextResponse.json({ error: "Redis not configured" }, { status: 500 });
  }

  try {
    const settings: UserSettings = await request.json();
    await redis.set(`${SETTINGS_KEY_PREFIX}${session.user.email}`, JSON.stringify(settings));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to save settings to Redis:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
