import { NextResponse } from "next/server";
import { resolveArtistChannelAndStats } from "@/lib/youtubeData";
import { getRequestAccessToken } from "@/lib/requestAccessToken";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get("channelId");
    const name = searchParams.get("name") || undefined;

    if (!channelId) {
      return NextResponse.json({ error: "Missing channelId" }, { status: 400 });
    }

    const accessToken = await getRequestAccessToken(request).catch(() => null);

    const { channelId: resolvedId, stats } = await resolveArtistChannelAndStats(
      channelId,
      name,
      accessToken || undefined
    );

    if (!stats) {
      return NextResponse.json({ error: "No statistics found" }, { status: 404 });
    }

    return NextResponse.json({
      ...stats,
      id: resolvedId,
    });
  } catch (error: any) {
    console.error("[YouTube Stats] Error:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
