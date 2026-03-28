import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { fetchUserPlaylists } from "@/lib/youtubeData";
import { NextResponse } from "next/server";

export async function GET() {
  const session = (await getServerSession(authOptions)) as any;
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const playlists = await fetchUserPlaylists(session.accessToken);
    return NextResponse.json(playlists);
  } catch (error) {
    console.error("Error fetching YouTube playlists:", error);
    return NextResponse.json({ error: "Failed to fetch playlists" }, { status: 500 });
  }
}
