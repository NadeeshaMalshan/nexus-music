import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { fetchLikedSongs } from "@/lib/youtubeData";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const tracks = await fetchLikedSongs(session.accessToken as string);
    return NextResponse.json(tracks);
  } catch (error) {
    console.error("API Fetch Liked Songs Error:", error);
    return NextResponse.json({ error: "Failed to fetch liked songs" }, { status: 500 });
  }
}
