import { cookies, headers } from "next/headers";
import { getToken } from "next-auth/jwt";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

function tokenFromAuthHeader(req: Request): string | null {
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

/**
 * For mobile clients (Expo), we accept `Authorization: Bearer <google_access_token>`.
 * For the web app, we keep supporting NextAuth cookie sessions.
 *
 * Prefer decoding the JWT cookie via `getToken` in Route Handlers — in some Next.js App Router
 * setups `getServerSession` can miss `accessToken` on the session object; the JWT always carries it.
 */
export async function getRequestAccessToken(req: Request): Promise<string | null> {
  const headerToken = tokenFromAuthHeader(req);
  if (headerToken) return headerToken;

  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!secret) {
    console.warn("[getRequestAccessToken] NEXTAUTH_SECRET is not set");
    return null;
  }

  try {
    const cookieStore = await cookies();
    const headersList = await headers();
    // Pass the real RequestCookies object so next-auth SessionStore can use getAll()
    // (chunked `__Secure-next-auth.session-token.N` cookies stay in sync).
    const jwt = await getToken({
      req: {
        headers: Object.fromEntries(headersList.entries()),
        cookies: cookieStore,
      } as any,
      secret,
    });

    const fromJwt = jwt?.accessToken;
    if (typeof fromJwt === "string" && fromJwt.length > 0) return fromJwt;
  } catch (e) {
    console.warn("[getRequestAccessToken] getToken failed:", e);
  }

  try {
    const session = await getServerSession(authOptions);
    const fromSession = (session as any)?.accessToken;
    if (typeof fromSession === "string" && fromSession.length > 0) return fromSession;
  } catch (e) {
    console.warn("[getRequestAccessToken] getServerSession failed:", e);
  }

  return null;
}

