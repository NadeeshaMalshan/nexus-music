import { NextResponse } from "next/server";
import { getYoutubeInfoWithRetry } from "@/lib/youtubeDirectAudioUrl";
import redis from "@/lib/redis";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const TTL_HIT_SECONDS = 7 * 86400; // 7 days
const TTL_MISS_SECONDS = 86400; // 1 day
const TTL_TRANSIENT_SECONDS = 600; // 10 minutes for transient / network errors

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

interface ParsedWord {
  text: string;
  start: number;
  end: number;
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

/**
 * Priority 1: Innertube getTranscript (with strict 3s timeout)
 */
async function fetchInnertubeTranscript(
  videoId: string
): Promise<{ words: ParsedWord[]; lang: string; kind: "asr" | "manual" } | null> {
  const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000));
  const workPromise = (async () => {
    try {
      const { Innertube, UniversalCache } = await import("youtubei.js");
      const yt = await Innertube.create({ cache: new UniversalCache(false) });
      const info = await yt.getInfo(videoId);
      const transcript = await info.getTranscript();
      const transcriptObj = transcript as unknown as {
        transcript?: {
          content?: {
            body?: {
              initial_segments?: Array<{
                start_ms?: number | string;
                end_ms?: number | string;
                snippet?: { text?: string };
              }>;
            };
          };
        };
      };
      const rawSegments = transcriptObj?.transcript?.content?.body?.initial_segments || [];
      if (!Array.isArray(rawSegments) || rawSegments.length === 0) return null;

      const words: ParsedWord[] = [];
      for (const seg of rawSegments) {
        const text = seg.snippet?.text?.trim();
        if (!text || isIgnoredToken(text)) continue;
        const startMs = typeof seg.start_ms === "number" ? seg.start_ms : Number(seg.start_ms) || 0;
        const endMs = typeof seg.end_ms === "number" ? seg.end_ms : Number(seg.end_ms) || startMs;
        const start = startMs / 1000;
        const end = Math.max(start + 0.1, endMs / 1000);
        words.push({ text, start, end });
      }

      if (words.length === 0) return null;
      return {
        words,
        lang: "en",
        kind: "asr" as const,
      };
    } catch {
      return null;
    }
  })();

  return Promise.race([workPromise, timeoutPromise]);
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

  // 1. Try Innertube transcript first
  try {
    const innertubeResult = await fetchInnertubeTranscript(videoId);
    if (innertubeResult && innertubeResult.words.length > 0) {
      await safeCache(cacheKey, innertubeResult, TTL_HIT_SECONDS);
      return NextResponse.json(innertubeResult);
    }
  } catch (err) {
    console.warn("[caption-sync] Innertube note:", err instanceof Error ? err.message : err);
  }

  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  let tracks: CaptionTrack[] | undefined;
  let isTransientError = false;

  // 2. Direct HTML extraction of captionTracks (resolves in ~300ms without triggering ytdl bot checks)
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
    } else if (pageRes.status >= 500) {
      isTransientError = true;
    }
  } catch (scrapeErr) {
    isTransientError = true;
    console.warn("[caption-sync] HTML scrape note:", scrapeErr instanceof Error ? scrapeErr.message : scrapeErr);
  }

  // 3. Fallback to getYoutubeInfoWithRetry if HTML scrape didn't find captionTracks
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
    } catch (infoErr) {
      isTransientError = true;
      console.warn("[caption-sync] getInfo note:", infoErr instanceof Error ? infoErr.message : infoErr);
    }
  }

  if (!tracks || tracks.length === 0) {
    const emptyResult = { words: [], reason: "No caption tracks found" };
    await safeCache(cacheKey, emptyResult, isTransientError ? TTL_TRANSIENT_SECONDS : TTL_MISS_SECONDS);
    return NextResponse.json(emptyResult);
  }

  const selectedTrack = selectBestTrack(tracks);
  if (!selectedTrack || !selectedTrack.baseUrl) {
    const emptyResult = { words: [], reason: "No suitable caption track baseUrl" };
    await safeCache(cacheKey, emptyResult, TTL_MISS_SECONDS);
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
      const transient = res.status >= 500;
      const emptyResult = { words: [], reason: `Timedtext returned HTTP ${res.status}` };
      await safeCache(cacheKey, emptyResult, transient ? TTL_TRANSIENT_SECONDS : TTL_MISS_SECONDS);
      return NextResponse.json(emptyResult);
    }

    const text = await res.text();
    if (!text || text.trim().length === 0) {
      const emptyResult = { words: [], reason: "Empty timedtext response body" };
      await safeCache(cacheKey, emptyResult, TTL_MISS_SECONDS);
      return NextResponse.json(emptyResult);
    }

    let data: TimedTextResponse;
    try {
      data = JSON.parse(text) as TimedTextResponse;
    } catch {
      const emptyResult = { words: [], reason: "Invalid JSON timedtext response" };
      await safeCache(cacheKey, emptyResult, TTL_MISS_SECONDS);
      return NextResponse.json(emptyResult);
    }

    if (!data.events || data.events.length === 0) {
      const emptyResult = { words: [], reason: "No events in timedtext" };
      await safeCache(cacheKey, emptyResult, TTL_MISS_SECONDS);
      return NextResponse.json(emptyResult);
    }

    const parsedWords: ParsedWord[] = [];

    for (const evt of data.events) {
      if (!evt.segs || evt.segs.length === 0) continue;
      const eventStartMs = evt.tStartMs ?? 0;
      const eventEndMs = eventStartMs + (evt.dDurationMs ?? 0);

      // Filter and clean segments
      const validSegs: { text: string; startMs: number }[] = [];
      for (const seg of evt.segs) {
        const raw = seg.utf8?.trim() ?? "";
        if (!raw || isIgnoredToken(raw)) continue;
        const segStartMs = eventStartMs + (seg.tOffsetMs ?? 0);
        validSegs.push({ text: raw, startMs: segStartMs });
      }

      if (validSegs.length === 0) continue;

      for (let i = 0; i < validSegs.length; i++) {
        const curr = validSegs[i];
        const next = validSegs[i + 1];
        const startSec = curr.startMs / 1000;
        let endSec: number;

        if (next) {
          endSec = Math.min(next.startMs / 1000, eventEndMs / 1000);
        } else {
          endSec = eventEndMs / 1000;
        }

        // Enforce valid positive duration
        if (endSec <= startSec) {
          endSec = startSec + 0.1;
        }

        // Enforce non-decreasing starts & drop exact duplicate tokens
        const last = parsedWords[parsedWords.length - 1];
        if (last) {
          if (startSec < last.start) continue;
          if (Math.abs(startSec - last.start) < 0.001 && last.text === curr.text) continue;
        }

        parsedWords.push({
          text: curr.text,
          start: startSec,
          end: endSec,
        });
      }
    }

    if (parsedWords.length === 0) {
      const emptyResult = { words: [], reason: "No valid tokens parsed from timedtext" };
      await safeCache(cacheKey, emptyResult, TTL_MISS_SECONDS);
      return NextResponse.json(emptyResult);
    }

    const result = {
      words: parsedWords,
      lang: selectedTrack.languageCode || "en",
      kind: (selectedTrack.kind === "asr" ? "asr" : "manual") as "asr" | "manual",
    };

    await safeCache(cacheKey, result, TTL_HIT_SECONDS);
    return NextResponse.json(result);
  } catch (fetchErr) {
    console.warn("[caption-sync] Timedtext fetch exception:", fetchErr);
    const emptyResult = { words: [], reason: "Timedtext fetch failed" };
    await safeCache(cacheKey, emptyResult, TTL_TRANSIENT_SECONDS);
    return NextResponse.json(emptyResult);
  }
}
