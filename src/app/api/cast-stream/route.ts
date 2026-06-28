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

    // Fetch the stream from Google's servers
    const response = await fetch(directUrl);
    if (!response.ok || !response.body) {
      return NextResponse.json({ error: "Failed to fetch stream" }, { status: 502 });
    }

    // Return the response stream back to the Chromecast client
    return new Response(response.body as any, {
      status: 200,
      headers: {
        "Content-Type": response.headers.get("Content-Type") || "audio/mp3",
        "Transfer-Encoding": "chunked",
        "Accept-Ranges": "bytes",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Proxy streaming failed:", error);
    return NextResponse.json({ error: "Streaming proxy error" }, { status: 500 });
  }
}
