import { NextResponse } from "next/server";
import play from "play-dl";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get('videoId') || searchParams.get('id');
  
  if (!videoId || videoId === 'undefined' || videoId === 'null') {
    return NextResponse.json({ error: "Invalid or missing videoId" }, { status: 400 });
  }

  console.log(`[get-audio-url] Extracting for videoId: ${videoId}`);
  try {
    const info = await play.video_info(`https://www.youtube.com/watch?v=${videoId}`);
    const stream = await play.stream_from_info(info, { quality: 2 });

    if (!stream || !(stream as any).url) {
      console.error(`[get-audio-url] Failed to extract URL for ${videoId}`);
      return NextResponse.json({ error: "Could not extract direct URL" }, { status: 404 });
    }

    console.log(`[get-audio-url] Successfully extracted URL (length: ${(stream as any).url.length})`);
    return NextResponse.json({ url: (stream as any).url });
  } catch (error: any) {
    console.error("[get-audio-url] Fatal Error:", error);
    return NextResponse.json(
      { error: "Failed to extract audio URL", details: error.message },
      { status: 500 }
    );
  }
}
