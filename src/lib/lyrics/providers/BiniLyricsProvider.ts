import { parseLyrics } from "../parsers";
import { ILyricsProvider, LyricsQuery, LyricsResult } from "../types";

export class BiniLyricsProvider implements ILyricsProvider {
  readonly name = "BiniLyrics";

  async search(query: LyricsQuery): Promise<LyricsResult | null> {
    const { track, artist, album, durationSeconds, signal } = query;
    if (!track || !artist) return null;

    try {
      const timeoutSignal = AbortSignal.timeout(6000);
      const combinedSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;

      // Query BiniLyrics / lrc.red catalog
      const searchUrl = new URL("https://lrc.red/search.json");
      searchUrl.searchParams.set("q", `${track} ${artist}`);

      const res = await fetch(searchUrl.toString(), {
        headers: { "User-Agent": "Nexus/1.0 (music player; BiniLyrics client)", Accept: "application/json" },
        signal: combinedSignal,
        cache: "no-store",
      });

      if (!res.ok) return null;

      const data = (await res.json()) as {
        hits?: Array<{ isrc?: string; title?: string; artist?: string; album?: string; duration?: number }>;
      };

      if (!Array.isArray(data.hits) || data.hits.length === 0) return null;

      // Check first candidate with ISRC
      for (const hit of data.hits.slice(0, 2)) {
        if (!hit.isrc) continue;

        // Try TTML for word-level sync
        try {
          const ttmlRes = await fetch(`https://lrc.red/s/${encodeURIComponent(hit.isrc)}.ttml`, {
            headers: { "User-Agent": "Nexus/1.0 (BiniLyrics)" },
            signal: combinedSignal,
            cache: "no-store",
          });

          if (ttmlRes.ok) {
            const content = await ttmlRes.text();
            if (content.trim()) {
              const parsed = parseLyrics(content, "ttml", this.name);
              if (parsed.lines.length > 0) {
                parsed.metadata = {
                  title: hit.title || track,
                  artist: hit.artist || artist,
                  album: hit.album || album,
                  duration: hit.duration || durationSeconds || undefined,
                };
                return parsed;
              }
            }
          }
        } catch {
          // Fallback to LRC
        }

        try {
          const lrcRes = await fetch(`https://lrc.red/s/${encodeURIComponent(hit.isrc)}.lrc`, {
            headers: { "User-Agent": "Nexus/1.0 (BiniLyrics)" },
            signal: combinedSignal,
            cache: "no-store",
          });

          if (lrcRes.ok) {
            const content = await lrcRes.text();
            if (content.trim()) {
              const parsed = parseLyrics(content, "lrc", this.name);
              if (parsed.lines.length > 0) {
                parsed.metadata = {
                  title: hit.title || track,
                  artist: hit.artist || artist,
                  album: hit.album || album,
                  duration: hit.duration || durationSeconds || undefined,
                };
                return parsed;
              }
            }
          }
        } catch {
          // Continue to next hit
        }
      }

      return null;
    } catch {
      return null;
    }
  }
}
