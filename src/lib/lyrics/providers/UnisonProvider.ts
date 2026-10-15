import { parseLyrics } from "../parsers";
import { ILyricsProvider, LyricsQuery, LyricsResult } from "../types";

interface UnisonItem {
  id: number;
  song?: string;
  artist?: string;
  album?: string;
  lyrics?: string;
  format?: string;
  syncType?: string;
  duration?: number;
}

export class UnisonProvider implements ILyricsProvider {
  readonly name = "Unison";

  async search(query: LyricsQuery): Promise<LyricsResult | null> {
    const { track, artist, album, durationSeconds, signal } = query;
    if (!track || !artist) return null;

    try {
      const timeoutSignal = AbortSignal.timeout(6000);
      const combinedSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;

      // 1. Try direct /lyrics endpoint
      const directUrl = new URL("https://unison.boidu.dev/lyrics");
      directUrl.searchParams.set("song", track);
      directUrl.searchParams.set("artist", artist);
      if (durationSeconds && durationSeconds > 0) {
        directUrl.searchParams.set("duration", String(Math.round(durationSeconds)));
      }

      let lyricId: number | null = null;
      let directLyrics: string | null = null;

      try {
        const directRes = await fetch(directUrl.toString(), {
          headers: { "User-Agent": "Nexus/1.0", Accept: "application/json" },
          signal: combinedSignal,
          cache: "no-store",
        });

        if (directRes.ok) {
          const directData = (await directRes.json()) as { success?: boolean; data?: UnisonItem };
          if (directData.data) {
            if (directData.data.lyrics) {
              directLyrics = directData.data.lyrics;
            } else if (directData.data.id) {
              lyricId = directData.data.id;
            }
          }
        }
      } catch {
        // Continue to search
      }

      // 2. Fallback to /lyrics/search if direct lookup didn't yield lyrics
      if (!directLyrics && !lyricId) {
        const searchUrl = new URL("https://unison.boidu.dev/lyrics/search");
        searchUrl.searchParams.set("song", track);
        searchUrl.searchParams.set("artist", artist);

        const searchRes = await fetch(searchUrl.toString(), {
          headers: { "User-Agent": "Nexus/1.0", Accept: "application/json" },
          signal: combinedSignal,
          cache: "no-store",
        });

        if (searchRes.ok) {
          const searchData = (await searchRes.json()) as { success?: boolean; data?: UnisonItem[] };
          if (Array.isArray(searchData.data) && searchData.data.length > 0) {
            lyricId = searchData.data[0].id;
          }
        }
      }

      // 3. Fetch full lyrics by ID if we have an ID
      if (!directLyrics && lyricId) {
        const idRes = await fetch(`https://unison.boidu.dev/lyrics/${lyricId}`, {
          headers: { "User-Agent": "Nexus/1.0", Accept: "application/json" },
          signal: combinedSignal,
          cache: "no-store",
        });

        if (idRes.ok) {
          const idData = (await idRes.json()) as { success?: boolean; data?: UnisonItem };
          if (idData.data?.lyrics) {
            directLyrics = idData.data.lyrics;
          }
        }
      }

      if (!directLyrics || !directLyrics.trim()) return null;

      const parsed = parseLyrics(directLyrics, undefined, this.name);
      if (parsed.lines.length === 0) return null;

      parsed.metadata = {
        title: track,
        artist,
        album,
        duration: durationSeconds || undefined,
      };

      return parsed;
    } catch {
      return null;
    }
  }
}
