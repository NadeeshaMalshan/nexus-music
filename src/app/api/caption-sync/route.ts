import { NextResponse } from "next/server";
import { getYoutubeInfoWithRetry } from "@/lib/youtubeDirectAudioUrl";
import redis from "@/lib/redis";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

interface CaptionTrack {
  baseUrl: string;
  name?: { simpleText?: string; runs?: Array<{ text: string }> };
  vssId?: string;
  languageCode: string;
  kind?: string;
}

interface TimedTextSeg {
  utf8?: string;
  tOffsetMs?: number;
}

interface TimedTextEvent {
  tStartMs?: number;
  dDurationMs?: number;
  segs?: TimedTextSeg[];
}

interface TimedTextResponse {
  events?: TimedTextEvent[];
}

function selectBestTrack(tracks: CaptionTrack[]): CaptionTrack | null {
  if (!tracks || tracks.length === 0) return null;

  // 1. English ASR
  const enAsr = tracks.find(
    (t) => t.kind === "asr" && t.languageCode?.toLowerCase().startsWith("en")
  );
  if (enAsr) return enAsr;

  // 2. English manual
  const enManual = tracks.find(
    (t) => t.kind !== "asr" && t.languageCode?.toLowerCase().startsWith("en")
  );
  if (enManual) return enManual;

  // 3. Any ASR
  const anyAsr = tracks.find((t) => t.kind === "asr");
  if (anyAsr) return anyAsr;

  // 4. Any manual
  return tracks[0] || null;
}

function isIgnoredToken(text: string): boolean {
  if (!text) return true;
  // Music notes
  if (/^[♪♫♩♬\s]+$/.test(text)) return true;
  // Bracketed tokens like [Music], (Applause), [Laughter], [Singing]
  if (/^[(\[][^()\[\]]*[)\]]$/.test(text)) return true;
  if (/^\[.*\]$/.test(text)) return true;
  return false;
}

async function safeCache(key: string, data: unknown, ttlSeconds: number) {
  if (!redis) return;
  try {
    await redis.set(key, data, { ex: ttlSeconds });
  } catch (err) {
    console.warn("[caption-sync] Redis write error:", err);
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get("videoId");

  if (!videoId || videoId === "undefined" || videoId === "null") {
    return NextResponse.json({ error: "Invalid or missing videoId" }, { status: 400 });
  }

  const cacheKey = `captions:${videoId}`;

  // Check Redis cache first
  if (redis) {
    try {
      const cached = await redis.get<Record<string, unknown>>(cacheKey);
      if (cached) {
        return NextResponse.json(cached);
      }
    } catch (err) {
      console.warn("[caption-sync] Redis read error:", err);
    }
  }

  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  let tracks: CaptionTrack[] | undefined;

  // 1. Fast direct HTML extraction of captionTracks (resolves in ~300ms without triggering ytdl bot checks)
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 4000);
    const pageRes = await fetch(videoUrl, {
      signal: ac.signal,
      headers: {
        "User-Agent": CHROME_UA,
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    clearTimeout(t);
    if (pageRes.ok) {
      const html = await pageRes.text();
      const key = '"captionTracks":[';
      const startIdx = html.indexOf(key);
      if (startIdx >= 0) {
        const arrStart = startIdx + '"captionTracks":'.length;
        let depth = 0;
        let endIdx = arrStart;
        for (let i = arrStart; i < html.length; i++) {
          if (html[i] === '[') depth++;
          else if (html[i] === ']') {
            depth--;
            if (depth === 0) {
              endIdx = i + 1;
              break;
            }
          }
        }
        const raw = html.substring(arrStart, endIdx);
        tracks = JSON.parse(raw) as CaptionTrack[];
      }
    }
  } catch (scrapeErr) {
    console.warn("[caption-sync] HTML scrape note:", scrapeErr instanceof Error ? scrapeErr.message : scrapeErr);
  }

  // 2. Fallback to getYoutubeInfoWithRetry if HTML scrape didn't find captionTracks
  if (!tracks || tracks.length === 0) {
    try {
      const info = await getYoutubeInfoWithRetry(videoUrl);
      if (info) {
        tracks = (info as unknown as {
          player_response?: {
            captions?: {
              playerCaptionsTracklistRenderer?: {
                captionTracks?: CaptionTrack[];
              };
            };
          };
        })?.player_response?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      }
    } catch (err) {
      console.warn("[caption-sync] getYoutubeInfoWithRetry failed:", err instanceof Error ? err.message : err);
    }
  }

  if (!tracks || tracks.length === 0) {
    const emptyResult = { words: [], reason: "No caption tracks found" };
    await safeCache(cacheKey, emptyResult, 86400); // 1 day
    return NextResponse.json(emptyResult);
  }

  const selectedTrack = selectBestTrack(tracks);
  if (!selectedTrack || !selectedTrack.baseUrl) {
    const emptyResult = { words: [], reason: "No suitable caption track baseUrl" };
    await safeCache(cacheKey, emptyResult, 86400); // 1 day
    return NextResponse.json(emptyResult);
  }

  // Fetch timedtext json3
  const timedTextUrl = `${selectedTrack.baseUrl}&fmt=json3`;
  const cookie = process.env.YOUTUBE_COOKIE?.trim();
  const fetchHeaders: Record<string, string> = {
    "User-Agent": CHROME_UA,
    Referer: videoUrl,
    Origin: "https://www.youtube.com",
  };
  if (cookie) {
    fetchHeaders["Cookie"] = cookie;
  }

  try {
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 10_000);

    const res = await fetch(timedTextUrl, {
      signal: ac.signal,
      headers: fetchHeaders,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const emptyResult = { words: [], reason: `Timedtext returned HTTP ${res.status}` };
      await safeCache(cacheKey, emptyResult, 86400);
      return NextResponse.json(emptyResult);
    }

    const text = await res.text();
    if (!text || text.trim().length === 0) {
      const emptyResult = { words: [], reason: "Empty timedtext response body" };
      await safeCache(cacheKey, emptyResult, 86400);
      return NextResponse.json(emptyResult);
    }

    let data: TimedTextResponse;
    try {
      data = JSON.parse(text) as TimedTextResponse;
    } catch {
      const emptyResult = { words: [], reason: "Invalid JSON timedtext response" };
      await safeCache(cacheKey, emptyResult, 86400);
      return NextResponse.json(emptyResult);
    }

    if (!data.events || data.events.length === 0) {
      const emptyResult = { words: [], reason: "No events in timedtext" };
      await safeCache(cacheKey, emptyResult, 86400);
      return NextResponse.json(emptyResult);
    }

    // Parse words from json3 events
    interface ParsedWord {
      text: string;
      start: number;
      end: number;
    }

    const parsedWords: ParsedWord[] = [];

    for (const event of data.events) {
      if (!event.segs || event.segs.length === 0) continue;
      const eventStartMs = event.tStartMs ?? 0;
      const eventDurationMs = event.dDurationMs ?? 0;
      const eventEndMs = eventStartMs + eventDurationMs;

      // Extract raw valid segs
      const validSegs: Array<{ text: string; startMs: number }> = [];
      for (const seg of event.segs) {
        const segText = (seg.utf8 ?? "").trim();
        if (isIgnoredToken(segText)) continue;
        const segStartMs = eventStartMs + (seg.tOffsetMs ?? 0);
        validSegs.push({ text: segText, startMs: segStartMs });
      }

      for (let sIdx = 0; sIdx < validSegs.length; sIdx++) {
        const current = validSegs[sIdx];
        const next = validSegs[sIdx + 1];

        const startSec = Math.max(0, current.startMs / 1000);
        const nextStartMs = next ? next.startMs : eventEndMs;
        const endMs = Math.min(nextStartMs, eventEndMs);
        const endSec = Math.max(startSec + 0.05, endMs / 1000);

        // Enforce non-decreasing starts
        const last = parsedWords[parsedWords.length - 1];
        const safeStart = last ? Math.max(last.start, startSec) : startSec;
        const safeEnd = Math.max(safeStart + 0.05, endSec);

        // Drop exact duplicates (same text and start within 10ms)
        if (
          last &&
          last.text.toLowerCase() === current.text.toLowerCase() &&
          Math.abs(last.start - safeStart) < 0.01
        ) {
          continue;
        }

        parsedWords.push({
          text: current.text,
          start: Number(safeStart.toFixed(3)),
          end: Number(safeEnd.toFixed(3)),
        });
      }
    }

    const kind: "asr" | "manual" = selectedTrack.kind === "asr" ? "asr" : "manual";
    const lang = selectedTrack.languageCode || "en";

    if (parsedWords.length > 0) {
      const successResult = {
        words: parsedWords,
        lang,
        kind,
      };
      await safeCache(cacheKey, successResult, 7 * 86400); // 7 days
      return NextResponse.json(successResult);
    } else {
      const emptyResult = { words: [], reason: "No valid word tokens parsed" };
      await safeCache(cacheKey, emptyResult, 86400); // 1 day
      return NextResponse.json(emptyResult);
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn("[caption-sync] Timedtext fetch error:", errorMsg);
    const fallbackResult = { words: [], reason: `Fetch error: ${errorMsg}` };
    await safeCache(cacheKey, fallbackResult, 86400);
    return NextResponse.json(fallbackResult);
  }
}
