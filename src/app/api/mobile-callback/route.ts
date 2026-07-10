import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import redis from "@/lib/redis";

export const dynamic = "force-dynamic";

/**
 * Called by NextAuth after successful login as the callbackUrl.
 * 
 * Strategy:
 * 1. Get the server-side session (user just logged in, session cookie exists in this request).
 * 2. Generate a short-lived one-time token, store user info in Redis (5 min TTL).
 * 3. Append the token to the mobile deep link URL.
 * 4. HTTP 307 redirect to the deep link scheme — OS handles opening the app.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const redirect = searchParams.get("redirect");

  if (!redirect) {
    return new Response("Missing redirect parameter", { status: 400 });
  }

  // Get the authenticated session (server-side, cookie is available here)
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    console.error("[mobile-callback] No session found");
    return new Response("Unauthorized — no active session", { status: 401 });
  }

  // Generate a short-lived one-time token
  const token = crypto.randomUUID();

  // Store user data in Redis for 5 minutes
  if (redis) {
    await redis.set(
      `mobile-auth-token:${token}`,
      JSON.stringify({
        email: session.user.email,
        name: session.user.name,
        image: session.user.image,
        accessToken: (session as any).accessToken,
      }),
      { ex: 300 } // 5 minutes
    );
    console.log(`[mobile-callback] Token stored in Redis for: ${session.user.email}`);
  }

  // Append token to the deep link URL
  let targetUrl = redirect;
  try {
    const parsedUrl = new URL(redirect);
    parsedUrl.searchParams.set("auth_token", token);
    targetUrl = parsedUrl.toString();
  } catch (e) {
    // If URL parsing fails (custom scheme edge case), manually append
    targetUrl = redirect.includes("?")
      ? `${redirect}&auth_token=${token}`
      : `${redirect}?auth_token=${token}`;
  }

  console.log(`[mobile-callback] Redirecting to deep link: ${targetUrl}`);

  // HTTP 307 causes the mobile OS to intercept and open the app via deep link
  return new Response(null, {
    status: 307,
    headers: {
      Location: targetUrl,
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    },
  });
}
