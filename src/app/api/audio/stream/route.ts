import { NextRequest } from "next/server";
import ytdl from "@distube/ytdl-core";

export async function GET(req: NextRequest) {
  const videoId = req.nextUrl.searchParams.get("videoId");
  if (!videoId) return new Response("Missing videoId", { status: 400 });

  try {
    const info = await ytdl.getInfo(videoId);
    const audioFormat = ytdl.chooseFormat(info.formats, { 
      quality: "highestaudio", 
      filter: "audioonly" 
    });

    if (!audioFormat) return new Response("No audio format found", { status: 404 });

    const rangeHeader = req.headers.get("range");
    const headers: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
    };
    if (rangeHeader) headers["Range"] = rangeHeader;

    const response = await fetch(audioFormat.url, { headers });
    
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Content-Type", audioFormat.mimeType || "audio/mpeg");
    responseHeaders.set("Cache-Control", "public, max-age=3600");

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Stream error:", error);
    return new Response("Streaming failed", { status: 500 });
  }
}
