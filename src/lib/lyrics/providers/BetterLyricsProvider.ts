import { parseLyrics } from "../parsers";
import { ILyricsProvider, LyricsQuery, LyricsResult } from "../types";

export class BetterLyricsProvider implements ILyricsProvider {
  readonly name = "BetterLyrics";

  async search(query: LyricsQuery): Promise<LyricsResult | null> {
    const { track, artist, signal } = query;
    if (!track || !artist) return null;

    try {
      const url = new URL("https://api.betterlyrics.org/getLyrics");
      url.searchParams.set("s", track);
      url.searchParams.set("a", artist);

      // Create timeout signal combining with query.signal if present
      const timeoutSignal = AbortSignal.timeout(5000);
      const combinedSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;

      const res = await fetch(url.toString(), {
        headers: {
          "User-Agent": "Nexus/1.0 (music player; +https://github.com/nexus-music)",
          Accept: "application/json",
        },
        signal: combinedSignal,
        cache: "no-store",
      });

      if (!res.ok) return null;

      const data = (await res.json()) as { ttml?: string };
      if (!data.ttml || typeof data.ttml !== "string") return null;

      const parsed = parseLyrics(data.ttml, "ttml", this.name);
      if (parsed.lines.length === 0) return null;

      parsed.metadata = {
        title: track,
        artist,
        album: query.album,
      };

      return parsed;
    } catch {
      return null;
    }
  }
}
