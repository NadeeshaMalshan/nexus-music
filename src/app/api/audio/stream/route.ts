import { NextRequest } from "next/server";
import ytdl from "@distube/ytdl-core";
import { Readable } from "stream";

import { getYoutubeDirectAudioUrl, getYoutubeInfoWithRetry, getYtdlSharedOptions } from "@/lib/youtubeDirectAudioUrl";

export const runtime = "nodejs";
export const maxDuration = 60;

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

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

  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const rangeHeader = req.headers.get("range");

  try {
    const info = await getYoutubeInfoWithRetry(videoUrl);
    if (!info.formats?.length) {
      throw new Error("No formats found");
    }

    const range =
      rangeHeader ? { start: Number(rangeHeader.replace(/\D/g, "")) } : undefined;

    let stream: Readable;
    try {
      stream = ytdl.downloadFromInfo(info, {
        ...getYtdlSharedOptions(),
        quality: "highestaudio",
        filter: "audioonly",
        range,
      });
    } catch (e0) {
      console.warn("[audio/stream] audioonly failed, trying muxed audio:", e0);
      stream = ytdl.downloadFromInfo(info, {
        ...getYtdlSharedOptions(),
        quality: "highestaudio",
        filter: "audio",
        range,
      });
    }

    const webStream = nodeReadableToWeb(stream);
    const responseHeaders = new Headers();
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Content-Type", "audio/webm");
    responseHeaders.set("Cache-Control", "public, max-age=3600");
    responseHeaders.set("Accept-Ranges", "bytes");

    return new Response(webStream, {
      status: rangeHeader ? 206 : 200,
      headers: responseHeaders,
    });
  } catch (e1) {
    console.warn("[audio/stream] ytdl download failed, proxying direct URL:", e1);

    try {
      const direct = await getYoutubeDirectAudioUrl(videoId);
      if (!direct) throw e1;

      const upstream = await fetch(direct, {
        headers: {
          "User-Agent": CHROME_UA,
          Referer: "https://www.youtube.com/",
          Origin: "https://www.youtube.com",
          ...(rangeHeader ? { Range: rangeHeader } : {}),
        },
      });

      if (!upstream.ok) {
        return new Response(
          JSON.stringify({
            error: "Streaming unavailable",
            detail: `Upstream ${upstream.status}`,
          }),
          { status: 502, headers: { "Content-Type": "application/json" } }
        );
      }

      const responseHeaders = new Headers();
      responseHeaders.set("Access-Control-Allow-Origin", "*");
      const ct = upstream.headers.get("content-type");
      if (ct) responseHeaders.set("Content-Type", ct);
      responseHeaders.set("Cache-Control", "public, max-age=300");
      const ar = upstream.headers.get("accept-ranges");
      if (ar) responseHeaders.set("Accept-Ranges", ar);

      return new Response(upstream.body, {
        status: upstream.status,
        headers: responseHeaders,
      });
    } catch (e2: unknown) {
      const msg = e2 instanceof Error ? e2.message : String(e2);
      console.error("[audio/stream] fallback failed:", msg);
      return new Response(JSON.stringify({ error: "Streaming unavailable", detail: msg }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }
  }
}
