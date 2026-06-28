import { NextResponse } from "next/server";
import { getYoutubeDirectAudioUrl } from "@/lib/youtubeDirectAudioUrl";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get("videoId") || searchParams.get("id");

  if (!videoId) {
    return NextResponse.json({ error: "videoId is required" }, { status: 400 });
  }

  try {
    const directUrl = await getYoutubeDirectAudioUrl(videoId, false);
    if (!directUrl) {
      return NextResponse.json({ error: "Failed to extract audio URL" }, { status: 404 });
    }

    // Redirect the Chromecast to the direct YouTube CDN URL.
    // The Chromecast's own IP will request the URL, making it authorized by Google.
    return NextResponse.redirect(directUrl, 302);
  } catch (error) {
    console.error("Redirect streaming failed:", error);
    return NextResponse.json({ error: "Streaming redirect error" }, { status: 500 });
  }
}
