import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function isPrivateLanHost(hostname: string): boolean {
  if (hostname === "localhost" || hostname === "127.0.0.1") return true;
  if (hostname === "[::1]" || hostname === "::1") return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  const m = hostname.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (m) {
    const n = Number(m[1]);
    if (n >= 16 && n <= 31) return true;
  }
  return false;
}

/** Expo Web / mobile dev call the API from another origin (e.g. :8081 → :3000, or LAN IP). */
function allowedCorsOrigin(origin: string | null): string | null {
  if (!origin) return null;
  try {
    const u = new URL(origin);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    const host = u.hostname;
    if (host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1") {
      return origin;
    }
    const extra = process.env.MOBILE_APP_ORIGIN?.trim();
    if (extra && origin === extra) return origin;
    // Physical device + Expo: Origin can be http://192.168.x.x:8081
    if (process.env.NODE_ENV === "development" && isPrivateLanHost(host)) {
      return origin;
    }
    return null;
  } catch {
    return null;
  }
}

function corsHeaders(origin: string | null): HeadersInit {
  const allowed = allowedCorsOrigin(origin);
  if (!allowed) return {};
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept",
    "Access-Control-Max-Age": "86400",
  };
}

export function middleware(request: NextRequest) {
  const origin = request.headers.get("origin");

  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
  }

  const res = NextResponse.next();
  const h = corsHeaders(origin);
  for (const [k, v] of Object.entries(h)) {
    res.headers.set(k, v);
  }
  return res;
}

export const config = {
  matcher: "/api/:path*",
};
