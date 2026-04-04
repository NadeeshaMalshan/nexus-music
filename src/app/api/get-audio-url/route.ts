import { NextResponse } from "next/server";
import play from "play-dl";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get("videoId");

  if (!videoId) {
    return NextResponse.json({ error: "Missing videoId" }, { status: 400 });
  }

  try {
    // Get video info
    const info = await play.video_info(`https://www.youtube.com/watch?v=${videoId}`);
    if (!info) {
      return NextResponse.json({ error: "Video info not found" }, { status: 404 });
    }
    
    // Attempt to get stream using play.stream directly as it's often more robust in serverless environments
    let stream;
    try {
      stream = await play.stream(`https://www.youtube.com/watch?v=${videoId}`, {
        quality: 2, // 2 is high audio in play-dl
      });
    } catch (e) {
      console.warn("[get-audio-url] Direct stream failed, trying from info...", e);
      stream = await play.stream_from_info(info, {
        quality: 2,
      });
    }

    if (!stream || !(stream as any).url) {
      return NextResponse.json({ error: "Could not extract direct URL" }, { status: 404 });
    }

    return NextResponse.json({ url: (stream as any).url });
  } catch (error: any) {
    console.error("[get-audio-url] Error:", error);
    return NextResponse.json(
      { error: "Failed to extract audio URL", details: error.message },
      { status: 500 }
    );
  }
}
