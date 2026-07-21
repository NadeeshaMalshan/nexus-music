import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import redis from "@/lib/redis";

export const dynamic = "force-dynamic";

/**
 * Called by NextAuth after successful login as the callbackUrl in external browser.
 * 
 * Strategy:
 * 1. Get server session and raw cookie header.
 * 2. Store sessionToken and user info in Redis under a short-lived token (5 min TTL).
 * 3. 307 Redirect to deep link scheme (nexus://auth-callback?auth_token=TOKEN).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const redirect = searchParams.get("redirect");

  if (!redirect) {
    return new Response("Missing redirect parameter", { status: 400 });
  }

  // Get the authenticated session
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    console.error("[mobile-callback] No session found");
    return new Response("Unauthorized — no active session", { status: 401 });
  }

  // Extract raw next-auth session cookie from request
  const cookieHeader = request.headers.get("cookie") || "";
  const secureTokenMatch = cookieHeader.match(/__Secure-next-auth\.session-token=([^;]+)/);
  const tokenMatch = cookieHeader.match(/next-auth\.session-token=([^;]+)/);
  const sessionToken = (secureTokenMatch && secureTokenMatch[1]) || (tokenMatch && tokenMatch[1]) || "";

  // Generate a short-lived one-time token
  const token = crypto.randomUUID();

  // Store session token and user data in Redis for 5 minutes
  if (redis) {
    await redis.set(
      `mobile-auth-token:${token}`,
      JSON.stringify({
        sessionToken,
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
