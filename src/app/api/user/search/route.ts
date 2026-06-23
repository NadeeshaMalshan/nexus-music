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

export async function GET(request: Request) {
  const viewerEmail = await resolveUserEmail(request);
  if (!viewerEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!redis) {
    return NextResponse.json([]);
  }

  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";
    const query = q.trim().toLowerCase();

    if (!query) {
      return NextResponse.json([]);
    }

    const directory = await redis.hgetall("users:directory");
    if (!directory) {
      return NextResponse.json([]);
    }

    const results: any[] = [];
    for (const [email, rawVal] of Object.entries(directory)) {
      try {
        const user = typeof rawVal === "string" ? JSON.parse(rawVal) : rawVal;
        const name = (user.name || "").toLowerCase();
        const userEmail = (user.email || email).toLowerCase();

        if (name.includes(query) || userEmail.includes(query)) {
          // Do not show the viewer in the search results
          if (userEmail !== viewerEmail.toLowerCase()) {
            results.push(user);
          }
        }
      } catch {}
    }

    return NextResponse.json(results.slice(0, 15));
  } catch (error) {
    console.error("Failed to search users:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
