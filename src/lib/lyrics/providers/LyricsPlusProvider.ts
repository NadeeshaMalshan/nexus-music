import { ILyricsProvider, LyricsLine, LyricsQuery, LyricsResult, LyricsWord } from "../types";

interface LyricsPlusWordItem {
  time: number;
  duration?: number;
  text: string;
  isLineEnding?: number;
}

interface LyricsPlusResponse {
  type?: "syllable" | "line" | "plain" | string;
  lyrics?: LyricsPlusWordItem[];
  error?: unknown;
}

export class LyricsPlusProvider implements ILyricsProvider {
  readonly name = "LyricsPlus";

  async search(query: LyricsQuery): Promise<LyricsResult | null> {
    const { track, artist, album, durationSeconds, signal } = query;
    if (!track || !artist) return null;

    try {
      const timeoutSignal = AbortSignal.timeout(6000);
      const combinedSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;

      const url = new URL("https://lyricsplus.prjktla.my.id/v1/lyrics/get");
      url.searchParams.set("title", track);
      url.searchParams.set("artist", artist);

      const res = await fetch(url.toString(), {
        headers: {
          "User-Agent": "Nexus/1.0 (music player)",
          Accept: "application/json",
        },
        signal: combinedSignal,
        cache: "no-store",
      });

      if (!res.ok) return null;

      const data = (await res.json()) as LyricsPlusResponse;
      if (data.error || !Array.isArray(data.lyrics) || data.lyrics.length === 0) {
        return null;
      }

      // 1. Syllable-level word synchronization
      if (data.type === "syllable") {
        const lines: LyricsLine[] = [];
        let currentWords: LyricsWord[] = [];
        let lineRawTextParts: string[] = [];

        for (const item of data.lyrics) {
          const wStart = (item.time || 0) / 1000;
          const wDur = (item.duration || 300) / 1000;
          const wEnd = wStart + wDur;

          currentWords.push({
            text: item.text.trim(),
            start: wStart,
            end: wEnd,
          });
          lineRawTextParts.push(item.text);

          if (item.isLineEnding === 1) {
            const lineText = lineRawTextParts.join("").trim();
            if (lineText && currentWords.length > 0) {
              lines.push({
                text: lineText,
                start: currentWords[0].start,
                end: currentWords[currentWords.length - 1].end,
                words: [...currentWords],
              });
            }
            currentWords = [];
            lineRawTextParts = [];
          }
        }

        // Flush any trailing words
        if (currentWords.length > 0) {
          const lineText = lineRawTextParts.join("").trim();
          if (lineText) {
            lines.push({
              text: lineText,
              start: currentWords[0].start,
              end: currentWords[currentWords.length - 1].end,
              words: [...currentWords],
            });
          }
        }

        if (lines.length > 0) {
          return {
            success: true,
            syncType: "word",
            format: "enhanced_lrc",
            source: this.name,
            lines,
            rawContent: JSON.stringify(data.lyrics),
            metadata: {
              title: track,
              artist,
              album,
              duration: durationSeconds || undefined,
            },
          };
        }
      }

      // 2. Line-synced fallback
      if (data.type === "line") {
        const lines: LyricsLine[] = [];
        for (let i = 0; i < data.lyrics.length; i++) {
          const item = data.lyrics[i];
          const start = (item.time || 0) / 1000;
          const nextItem = data.lyrics[i + 1];
          const nextStart = nextItem ? (nextItem.time || 0) / 1000 : null;
          const end = item.duration
            ? start + item.duration / 1000
            : nextStart && nextStart > start
            ? nextStart
            : start + 4.0;

          const text = item.text.trim();
          if (text) {
            lines.push({ text, start, end });
          }
        }

        if (lines.length > 0) {
          return {
            success: true,
            syncType: "line",
            format: "lrc",
            source: this.name,
            lines,
            rawContent: JSON.stringify(data.lyrics),
            metadata: {
              title: track,
              artist,
              album,
              duration: durationSeconds || undefined,
            },
          };
        }
      }

      return null;
    } catch {
      return null;
    }
  }
}
