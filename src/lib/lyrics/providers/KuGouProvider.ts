import { inflateSync } from "node:zlib";
import { parseLyrics } from "../parsers";
import { ILyricsProvider, LyricsLine, LyricsQuery, LyricsResult, LyricsWord } from "../types";

const KRC_XOR_KEY = [64, 71, 97, 119, 94, 50, 116, 71, 81, 54, 49, 45, 206, 210, 110, 105];

interface KugouCandidate {
  id: string;
  accesskey: string;
  song?: string;
  singer?: string;
  duration?: number;
}

interface KugouSearchResponse {
  candidates?: KugouCandidate[];
}

interface KugouDownloadResponse {
  content?: string;
  fmt?: string;
}

export class KuGouProvider implements ILyricsProvider {
  readonly name = "KuGou";

  async search(query: LyricsQuery): Promise<LyricsResult | null> {
    const { track, artist, album, durationSeconds, signal } = query;
    if (!track || !artist) return null;

    try {
      const timeoutSignal = AbortSignal.timeout(6000);
      const combinedSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;

      // 1. Search candidate
      const searchUrl = new URL("http://lyrics.kugou.com/search");
      searchUrl.searchParams.set("ver", "1");
      searchUrl.searchParams.set("man", "yes");
      searchUrl.searchParams.set("client", "pc");
      searchUrl.searchParams.set("keyword", `${track} ${artist}`);
      if (durationSeconds && durationSeconds > 0) {
        searchUrl.searchParams.set("duration", String(Math.round(durationSeconds * 1000)));
      }

      const searchRes = await fetch(searchUrl.toString(), {
        headers: { "User-Agent": "Nexus/1.0" },
        signal: combinedSignal,
        cache: "no-store",
      });

      if (!searchRes.ok) return null;

      const searchData = (await searchRes.json()) as KugouSearchResponse;
      if (!Array.isArray(searchData.candidates) || searchData.candidates.length === 0) {
        return null;
      }

      const candidate = searchData.candidates[0];
      if (!candidate.id || !candidate.accesskey) return null;

      // 2. First attempt: Download KRC format (syllable-level word synchronization)
      try {
        const krcUrl = new URL("http://lyrics.kugou.com/download");
        krcUrl.searchParams.set("ver", "1");
        krcUrl.searchParams.set("client", "pc");
        krcUrl.searchParams.set("id", candidate.id);
        krcUrl.searchParams.set("accesskey", candidate.accesskey);
        krcUrl.searchParams.set("fmt", "krc");
        krcUrl.searchParams.set("charset", "utf8");

        const krcRes = await fetch(krcUrl.toString(), {
          headers: { "User-Agent": "Nexus/1.0" },
          signal: combinedSignal,
          cache: "no-store",
        });

        if (krcRes.ok) {
          const krcData = (await krcRes.json()) as KugouDownloadResponse;
          if (krcData.content) {
            const parsedKrc = this.parseKrcContent(krcData.content, track, artist, album, durationSeconds);
            if (parsedKrc && parsedKrc.lines.length > 0) {
              return parsedKrc;
            }
          }
        }
      } catch {
        // Fallback to LRC
      }

      // 3. Second attempt: Download LRC format (line synchronization)
      try {
        const lrcUrl = new URL("http://lyrics.kugou.com/download");
        lrcUrl.searchParams.set("ver", "1");
        lrcUrl.searchParams.set("client", "pc");
        lrcUrl.searchParams.set("id", candidate.id);
        lrcUrl.searchParams.set("accesskey", candidate.accesskey);
        lrcUrl.searchParams.set("fmt", "lrc");
        lrcUrl.searchParams.set("charset", "utf8");

        const lrcRes = await fetch(lrcUrl.toString(), {
          headers: { "User-Agent": "Nexus/1.0" },
          signal: combinedSignal,
          cache: "no-store",
        });

        if (lrcRes.ok) {
          const lrcData = (await lrcRes.json()) as KugouDownloadResponse;
          if (lrcData.content) {
            const rawLrc = Buffer.from(lrcData.content, "base64").toString("utf8");
            const parsed = parseLyrics(rawLrc, "lrc", this.name);
            if (parsed.lines.length > 0) {
              parsed.metadata = {
                title: candidate.song || track,
                artist: candidate.singer || artist,
                album,
                duration: durationSeconds || undefined,
              };
              return parsed;
            }
          }
        }
      } catch {
        // Return null
      }

      return null;
    } catch {
      return null;
    }
  }

  private parseKrcContent(
    base64Content: string,
    track: string,
    artist: string,
    album?: string,
    durationSeconds?: number | null
  ): LyricsResult | null {
    try {
      const buffer = Buffer.from(base64Content, "base64");
      // Check for 'krc1' magic header
      if (buffer.length <= 4 || buffer.subarray(0, 4).toString("utf8") !== "krc1") {
        return null;
      }

      // Decrypt XOR
      const payload = Buffer.from(buffer.subarray(4));
      for (let i = 0; i < payload.length; i++) {
        payload[i] ^= KRC_XOR_KEY[i % KRC_XOR_KEY.length];
      }

      // Decompress zlib
      const decompressed = inflateSync(payload).toString("utf8");

      const lines: LyricsLine[] = [];
      const rawLines = decompressed.split("\n");
      const lineRegex = /^\[(\d+),(\d+)\](.*)$/;
      const wordRegex = /<(\d+),(\d+),\d+>([^<]*)/g;

      for (const rl of rawLines) {
        const trimmed = rl.trim();
        const match = trimmed.match(lineRegex);
        if (!match) continue;

        const lineStartMs = parseInt(match[1], 10);
        const lineDurMs = parseInt(match[2], 10);
        const lineBody = match[3];

        const words: LyricsWord[] = [];
        let wMatch: RegExpExecArray | null;
        wordRegex.lastIndex = 0;

        while ((wMatch = wordRegex.exec(lineBody)) !== null) {
          const offsetMs = parseInt(wMatch[1], 10);
          const durMs = parseInt(wMatch[2], 10);
          const text = wMatch[3];

          if (text) {
            words.push({
              text,
              start: (lineStartMs + offsetMs) / 1000,
              end: (lineStartMs + offsetMs + durMs) / 1000,
            });
          }
        }

        const fullText = words.map((w) => w.text).join("").trim();
        if (fullText) {
          lines.push({
            text: fullText,
            start: lineStartMs / 1000,
            end: (lineStartMs + lineDurMs) / 1000,
            words: words.length > 0 ? words : undefined,
          });
        }
      }

      if (lines.length === 0) return null;

      const hasWordTimestamps = lines.some((l) => l.words && l.words.length > 0);

      return {
        success: true,
        syncType: hasWordTimestamps ? "word" : "line",
        format: "enhanced_lrc",
        source: this.name,
        lines,
        rawContent: decompressed,
        metadata: {
          title: track,
          artist,
          album,
          duration: durationSeconds || undefined,
        },
      };
    } catch {
      return null;
    }
  }
}
