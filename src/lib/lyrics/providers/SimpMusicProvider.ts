import { parseLyrics } from "../parsers";
import { ILyricsProvider, LyricsQuery, LyricsResult } from "../types";

interface SimpMusicSearchItem {
  id: string;
  videoId: string;
  songTitle?: string;
  artistName?: string;
  durationSeconds?: number;
}

interface SimpMusicLyricItem {
  id?: string;
  videoId?: string;
  songTitle?: string;
  artistName?: string;
  albumName?: string;
  durationSeconds?: number;
  plainLyric?: string;
  syncedLyrics?: string;
  richSyncLyrics?: string;
}

export class SimpMusicProvider implements ILyricsProvider {
  readonly name = "SimpMusic";

  async search(query: LyricsQuery): Promise<LyricsResult | null> {
    const { track, artist, album, durationSeconds, signal } = query;
    if (!track || !artist) return null;

    try {
      const timeoutSignal = AbortSignal.timeout(6000);
      const combinedSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;

      // 1. Search for song by track & artist
      const searchUrl = new URL("https://api-lyrics.simpmusic.org/v1/search");
      searchUrl.searchParams.set("q", `${track} ${artist}`);
      searchUrl.searchParams.set("limit", "5");

      const searchRes = await fetch(searchUrl.toString(), {
        headers: {
          Origin: "https://lyrics.simpmusic.org",
          Referer: "https://lyrics.simpmusic.org/",
          "User-Agent": "Nexus/1.0",
          Accept: "application/json",
        },
        signal: combinedSignal,
        cache: "no-store",
      });

      if (!searchRes.ok) return null;

      const searchData = (await searchRes.json()) as { data?: SimpMusicSearchItem[] };
      if (!Array.isArray(searchData.data) || searchData.data.length === 0) {
        return null;
      }

      // Check first candidate videoId
      const firstHit = searchData.data[0];
      if (!firstHit.videoId) return null;

      // 2. Fetch lyrics details by videoId
      const lyricRes = await fetch(`https://api-lyrics.simpmusic.org/v1/${encodeURIComponent(firstHit.videoId)}`, {
        headers: {
          Origin: "https://lyrics.simpmusic.org",
          Referer: "https://lyrics.simpmusic.org/",
          "User-Agent": "Nexus/1.0",
          Accept: "application/json",
        },
        signal: combinedSignal,
        cache: "no-store",
      });

      if (!lyricRes.ok) return null;

      const lyricData = (await lyricRes.json()) as { data?: SimpMusicLyricItem[] };
      if (!Array.isArray(lyricData.data) || lyricData.data.length === 0) {
        return null;
      }

      const item = lyricData.data[0];

      // 1. Check richSyncLyrics for syllable/word-level sync
      if (item.richSyncLyrics?.trim()) {
        const parsed = parseLyrics(item.richSyncLyrics, undefined, this.name);
        if (parsed.lines.length > 0) {
          parsed.metadata = {
            title: item.songTitle || track,
            artist: item.artistName || artist,
            album: item.albumName || album,
            duration: item.durationSeconds || durationSeconds || undefined,
          };
          return parsed;
        }
      }

      // 2. Check syncedLyrics for standard line-level sync
      if (item.syncedLyrics?.trim()) {
        const parsed = parseLyrics(item.syncedLyrics, undefined, this.name);
        if (parsed.lines.length > 0) {
          parsed.metadata = {
            title: item.songTitle || track,
            artist: item.artistName || artist,
            album: item.albumName || album,
            duration: item.durationSeconds || durationSeconds || undefined,
          };
          return parsed;
        }
      }

      // 3. Fallback to plainLyric
      if (item.plainLyric?.trim()) {
        const parsed = parseLyrics(item.plainLyric, "plain", this.name);
        if (parsed.lines.length > 0) {
          parsed.metadata = {
            title: item.songTitle || track,
            artist: item.artistName || artist,
            album: item.albumName || album,
            duration: item.durationSeconds || durationSeconds || undefined,
          };
          return parsed;
        }
      }

      return null;
    } catch {
      return null;
    }
  }
}
