import { NextRequest } from "next/server";
import ytdl from "@distube/ytdl-core";
import { Readable } from "stream";

/**
 * Convert a Node.js Readable stream to a Web ReadableStream
 */
function nodeReadableToWeb(nodeReadable: Readable): ReadableStream {
  return new ReadableStream({
    start(controller) {
      nodeReadable.on("data", (chunk) => controller.enqueue(chunk));
      nodeReadable.on("end", () => controller.close());
      nodeReadable.on("error", (err) => controller.error(err));
    },
    cancel() {
      nodeReadable.destroy();
    },
  });
}

export async function GET(req: NextRequest) {
  const videoId = req.nextUrl.searchParams.get("videoId");
  if (!videoId) return new Response("Missing videoId", { status: 400 });

  try {
    const rangeHeader = req.headers.get("range");
    
    // First, verify we can even get info
    const info = await ytdl.getInfo(videoId);
    if (!info.formats || info.formats.length === 0) {
        throw new Error("No formats found");
    }

    // Use ytdl to get the stream directly
    const stream = ytdl.downloadFromInfo(info, {
      quality: "highestaudio",
      filter: "audioonly",
      range: rangeHeader ? { start: Number(rangeHeader.replace(/\D/g, "")) } : undefined,
    });

    const webStream = nodeReadableToWeb(stream);

    const responseHeaders = new Headers();
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Content-Type", "audio/mpeg");
    responseHeaders.set("Cache-Control", "public, max-age=3600");
    responseHeaders.set("Accept-Ranges", "bytes");

    return new Response(webStream, {
      status: rangeHeader ? 206 : 200,
      headers: responseHeaders,
    });
  } catch (error: any) {
    console.error("[stream] error:", error?.message || error);
    // Return a specific error status so the frontend can fallback
    return new Response(JSON.stringify({ error: "Streaming unavailable", detail: error?.message }), { 
        status: 502,
        headers: { "Content-Type": "application/json" }
    });
  }
}
