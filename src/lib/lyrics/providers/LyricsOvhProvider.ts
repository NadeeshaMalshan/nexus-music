import { parseLyrics } from "../parsers";
import { ILyricsProvider, LyricsQuery, LyricsResult } from "../types";

export class LyricsOvhProvider implements ILyricsProvider {
  readonly name = "Lyrics.ovh";

  async search(query: LyricsQuery): Promise<LyricsResult | null> {
    const { track, artist, signal } = query;
    if (!track || !artist) return null;

    try {
      const endpoint = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(track)}`;
      const res = await fetch(endpoint, {
        signal,
        cache: "no-store",
      });

      if (!res.ok) return null;
      const data = (await res.json()) as { lyrics?: string };
      if (!data.lyrics?.trim()) return null;

      const parsed = parseLyrics(data.lyrics, "plain", this.name);
      parsed.metadata = {
        title: track,
        artist,
      };
      return parsed;
    } catch {
      return null;
    }
  }
}
