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
 */
export async function getRequestAccessToken(req: Request): Promise<string | null> {
  const headerToken = tokenFromAuthHeader(req);
  if (headerToken) return headerToken;

  const session = await getServerSession(authOptions);
  const token = (session as any)?.accessToken;
  return typeof token === "string" && token ? token : null;
}

