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

export async function POST(request: Request) {
  const email = await resolveUserEmail(request);
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!redis) {
    return NextResponse.json({ error: "Redis not configured" }, { status: 500 });
  }

  try {
    const { action, target } = await request.json();
    if (!action || !target) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    if (email === target) {
      return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });
    }

    const followingKey = `user:following:${email}`;
    const followersKey = `user:followers:${target}`;

    if (action === "follow") {
      await redis.sadd(followingKey, target);
      await redis.sadd(followersKey, email);
    } else if (action === "unfollow") {
      await redis.srem(followingKey, target);
      await redis.srem(followersKey, email);
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to follow/unfollow user:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
