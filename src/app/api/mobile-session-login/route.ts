import { NextResponse } from "next/server";
import redis from "@/lib/redis";

export const dynamic = "force-dynamic";

/**
 * Mobile WebView loads this endpoint when opened via deep link with ?token=XXX.
 * We look up the token in Redis, extract sessionToken, set NextAuth session cookie, and redirect to /.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  const baseUrl = new URL("/", request.url);

  if (!token || !redis) {
    return NextResponse.redirect(baseUrl);
  }

  const key = `mobile-auth-token:${token}`;
  const rawData = await redis.get<string>(key);

  if (!rawData) {
    return NextResponse.redirect(baseUrl);
  }

  // Delete the one-time token immediately
  await redis.del(key);

  const data = typeof rawData === "string" ? JSON.parse(rawData) : rawData;
  const sessionToken = data?.sessionToken;

  const response = NextResponse.redirect(baseUrl);

  if (sessionToken) {
    const cookieOptions = {
      httpOnly: true,
      path: "/",
      sameSite: "lax" as const,
      maxAge: 30 * 24 * 60 * 60, // 30 days
    };

    response.cookies.set("__Secure-next-auth.session-token", sessionToken, {
      ...cookieOptions,
      secure: true,
    });
    response.cookies.set("next-auth.session-token", sessionToken, {
      ...cookieOptions,
      secure: false,
    });

    console.log(`[mobile-session-login] Session cookie set in WebView for: ${data?.email}`);
  }

  return response;
}
