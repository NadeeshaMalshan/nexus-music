import { parseLyrics } from "../parsers";
import { ILyricsProvider, LyricsQuery, LyricsResult } from "../types";
import { isTitleMatch } from "../matchUtils";

interface LrcRedHit {
  isrc?: string;
  title?: string;
  artist?: string;
  album?: string;
  duration?: number;
}

interface LrcRedResponse {
  hits?: LrcRedHit[];
}

export class LrcRedProvider implements ILyricsProvider {
  readonly name = "lrc.red";

  async search(query: LyricsQuery): Promise<LyricsResult | null> {
    const { track, artist, album, durationSeconds, signal } = query;
    if (!track || !artist) return null;

    try {
      const timeoutSignal = AbortSignal.timeout(6000);
      const combinedSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;

      // 1. Try match.json
      const matchUrl = new URL("https://lrc.red/match.json");
      matchUrl.searchParams.set("title", track);
      matchUrl.searchParams.set("artist", artist);
      if (durationSeconds && durationSeconds > 0) {
        matchUrl.searchParams.set("duration", String(Math.round(durationSeconds)));
      }

      let hits: LrcRedHit[] = [];
      const matchRes = await fetch(matchUrl.toString(), {
        headers: { "User-Agent": "Nexus/1.0 (music player)", Accept: "application/json" },
        signal: combinedSignal,
        cache: "no-store",
      });

      if (matchRes.ok) {
        const matchData = (await matchRes.json()) as LrcRedResponse;
        if (Array.isArray(matchData.hits) && matchData.hits.length > 0) {
          hits = matchData.hits;
        }
      }

      // 2. Fallback to search.json if match had no hits
      if (hits.length === 0) {
        const searchUrl = new URL("https://lrc.red/search.json");
        searchUrl.searchParams.set("q", `${track} ${artist}`);
        const searchRes = await fetch(searchUrl.toString(), {
          headers: { "User-Agent": "Nexus/1.0 (music player)", Accept: "application/json" },
          signal: combinedSignal,
          cache: "no-store",
        });

        if (searchRes.ok) {
          const searchData = (await searchRes.json()) as LrcRedResponse;
          if (Array.isArray(searchData.hits)) {
            hits = searchData.hits;
          }
        }
      }

      if (hits.length === 0) return null;

      // Filter hits to only candidates whose title matches the requested track
      const validHits = hits.filter((h) => isTitleMatch(track, h.title));
      if (validHits.length === 0) return null;

      // Try matching candidates for TTML (word sync) or LRC
      for (const hit of validHits.slice(0, 3)) {
        if (!hit.isrc) continue;

        // Try TTML first for word-level sync
        try {
          const ttmlUrl = `https://lrc.red/s/${encodeURIComponent(hit.isrc)}.ttml`;
          const ttmlRes = await fetch(ttmlUrl, {
            headers: { "User-Agent": "Nexus/1.0 (music player)" },
            signal: combinedSignal,
            cache: "no-store",
          });

          if (ttmlRes.ok) {
            const ttmlContent = await ttmlRes.text();
            if (ttmlContent.trim().length > 0) {
              const parsed = parseLyrics(ttmlContent, "ttml", this.name);
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
          // Continue to LRC fallback
        }

        // Fallback to LRC
        try {
          const lrcUrl = `https://lrc.red/s/${encodeURIComponent(hit.isrc)}.lrc`;
          const lrcRes = await fetch(lrcUrl, {
            headers: { "User-Agent": "Nexus/1.0 (music player)" },
            signal: combinedSignal,
            cache: "no-store",
          });

          if (lrcRes.ok) {
            const lrcContent = await lrcRes.text();
            if (lrcContent.trim().length > 0) {
              const parsed = parseLyrics(lrcContent, "lrc", this.name);
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
