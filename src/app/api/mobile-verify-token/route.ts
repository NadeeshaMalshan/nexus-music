import redis from "@/lib/redis";

export const dynamic = "force-dynamic";

/**
 * Mobile app calls this endpoint after receiving the auth_token from the deep link.
 * We look up the token in Redis and return the user session data.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return Response.json({ error: "Missing token" }, { status: 400 });
  }

  if (!redis) {
    return Response.json({ error: "Redis not configured" }, { status: 500 });
  }

  const key = `mobile-auth-token:${token}`;
  const userData = await redis.get<string>(key);

  if (!userData) {
    return Response.json({ error: "Token expired or invalid" }, { status: 401 });
  }

  // Delete the one-time token immediately after use
  await redis.del(key);

  const user = typeof userData === "string" ? JSON.parse(userData) : userData;

  console.log(`[mobile-verify-token] Token verified for: ${user.email}`);

  return Response.json({ user }, { status: 200 });
}
