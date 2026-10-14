import { parseLyrics } from "../parsers";
import { ILyricsProvider, LyricsQuery, LyricsResult } from "../types";

const LRCLIB_HEADERS = {
  "User-Agent": "Nexus/1.0 (music dashboard)",
};

interface LrcLibRecord {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  instrumental: boolean;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
  lyricsfile?: string | null;
  hasWordSync?: boolean;
}

export class LrcLibProvider implements ILyricsProvider {
  readonly name = "LRCLIB";

  async search(query: LyricsQuery): Promise<LyricsResult | null> {
    const { track, artist, album, durationSeconds, signal } = query;
    if (!track || !artist) return null;

    try {
      // 1. Try exact lookup if duration and album are provided
      if (durationSeconds && album && album !== "Unknown") {
        const exactEndpoint = new URL("https://lrclib.net/api/get");
        exactEndpoint.searchParams.set("track_name", track);
        exactEndpoint.searchParams.set("artist_name", artist);
        exactEndpoint.searchParams.set("album_name", album);
        exactEndpoint.searchParams.set("duration", String(Math.round(durationSeconds)));

        const exactRes = await fetch(exactEndpoint.toString(), {
          headers: LRCLIB_HEADERS,
          signal,
          cache: "no-store",
        });

        if (exactRes.ok) {
          const record = (await exactRes.json()) as LrcLibRecord;
          const parsed = this.parseRecord(record);
          if (parsed) return parsed;
        }
      }

      // 2. Search by track_name and artist_name
      const searchEndpoint = new URL("https://lrclib.net/api/search");
      searchEndpoint.searchParams.set("track_name", track);
      searchEndpoint.searchParams.set("artist_name", artist);

      const searchRes = await fetch(searchEndpoint.toString(), {
        headers: LRCLIB_HEADERS,
        signal,
        cache: "no-store",
      });

      if (searchRes.ok) {
        const records = (await searchRes.json()) as unknown;
        if (Array.isArray(records) && records.length > 0) {
          // Prefer records with synced lyrics
          const sorted = (records as LrcLibRecord[]).sort((a, b) => {
            const aHasSync = Boolean(a.syncedLyrics || a.hasWordSync);
            const bHasSync = Boolean(b.syncedLyrics || b.hasWordSync);
            return (bHasSync ? 1 : 0) - (aHasSync ? 1 : 0);
          });

          for (const rec of sorted) {
            const parsed = this.parseRecord(rec);
            if (parsed) return parsed;
          }
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  private parseRecord(rec: LrcLibRecord): LyricsResult | null {
    if (rec.instrumental) {
      return {
        success: true,
        syncType: "line",
        format: "lrc",
        source: this.name,
        lines: [
          {
            text: "♪ Instrumental ♪",
            start: 0,
            end: rec.duration > 0 ? rec.duration : 180,
            isInstrumental: true,
          },
        ],
        rawContent: rec.syncedLyrics || rec.plainLyrics || "♪ Instrumental ♪",
        metadata: {
          title: rec.trackName,
          artist: rec.artistName,
          album: rec.albumName,
          duration: rec.duration,
        },
      };
    }

    // If synced lyrics exist, parse them (parseLyrics automatically detects enhanced vs standard)
    if (rec.syncedLyrics?.trim()) {
      const parsed = parseLyrics(rec.syncedLyrics, undefined, this.name);
      if (parsed.lines.length > 0) {
        parsed.metadata = {
          title: rec.trackName,
          artist: rec.artistName,
          album: rec.albumName,
          duration: rec.duration,
        };
        return parsed;
      }
    }

    // Fall back to plain lyrics
    if (rec.plainLyrics?.trim()) {
      const parsed = parseLyrics(rec.plainLyrics, "plain", this.name);
      parsed.metadata = {
        title: rec.trackName,
        artist: rec.artistName,
        album: rec.albumName,
        duration: rec.duration,
      };
      return parsed;
    }

    return null;
  }
}
