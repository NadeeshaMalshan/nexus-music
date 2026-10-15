import { parseLyrics } from "../parsers";
import { ILyricsProvider, LyricsQuery, LyricsResult } from "../types";
import { isTitleMatch } from "../matchUtils";

interface MegalobizResultItem {
  id: number;
  title?: string;
  artist?: string;
  duration?: number;
  sync?: string;
  score?: number;
  lrc_url?: string;
}

interface MegalobizSearchResponse {
  count?: number;
  results?: MegalobizResultItem[];
}

export class MegalobizProvider implements ILyricsProvider {
  readonly name = "Megalobiz";

  async search(query: LyricsQuery): Promise<LyricsResult | null> {
    const { track, artist, album, durationSeconds, signal } = query;
    if (!track || !artist) return null;

    try {
      const timeoutSignal = AbortSignal.timeout(6000);
      const combinedSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;

      const searchUrl = new URL("https://api.megalobiz.com/api/public/v1/search");
      searchUrl.searchParams.set("title", track);
      searchUrl.searchParams.set("artist", artist);
      if (durationSeconds && durationSeconds > 0) {
        searchUrl.searchParams.set("duration", String(Math.round(durationSeconds)));
      }

      const searchRes = await fetch(searchUrl.toString(), {
        headers: {
          "User-Agent": "Nexus/1.0 (music player; +https://github.com/nexus-music)",
          Accept: "application/json",
        },
        signal: combinedSignal,
        cache: "no-store",
      });

      if (!searchRes.ok) return null;

      const searchData = (await searchRes.json()) as MegalobizSearchResponse;
      if (!Array.isArray(searchData.results) || searchData.results.length === 0) {
        return null;
      }

      const matchingItem = searchData.results.find((item) => isTitleMatch(track, item.title));
      if (!matchingItem?.id) return null;
      const bestItem = matchingItem;

      const lrcUrl = `https://api.megalobiz.com/api/public/v1/lrc/${bestItem.id}?format=lrc`;
      const lrcRes = await fetch(lrcUrl, {
        headers: {
          "User-Agent": "Nexus/1.0 (music player)",
        },
        signal: combinedSignal,
        cache: "no-store",
      });

      if (!lrcRes.ok) return null;

      const lrcText = await lrcRes.text();
      if (!lrcText.trim()) return null;

      const parsed = parseLyrics(lrcText, "lrc", this.name);
      if (parsed.lines.length === 0) return null;

      parsed.metadata = {
        title: bestItem.title || track,
        artist: bestItem.artist || artist,
        album,
        duration: bestItem.duration || durationSeconds || undefined,
      };

      return parsed;
    } catch {
      return null;
    }
  }
}
