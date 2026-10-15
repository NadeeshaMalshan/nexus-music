import { parseLyrics } from "../parsers";
import { ILyricsProvider, LyricsQuery, LyricsResult } from "../types";
import { isTitleMatch } from "../matchUtils";

export class PaxSenixProvider implements ILyricsProvider {
  readonly name = "PaxSenix";

  async search(query: LyricsQuery): Promise<LyricsResult | null> {
    const { track, artist, album, durationSeconds, signal } = query;
    if (!track || !artist) return null;

    try {
      const timeoutSignal = AbortSignal.timeout(6000);
      const combinedSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;

      // 1. Resolve Apple Music trackId via iTunes search API
      const itunesUrl = new URL("https://itunes.apple.com/search");
      itunesUrl.searchParams.set("term", `${track} ${artist}`);
      itunesUrl.searchParams.set("entity", "song");
      itunesUrl.searchParams.set("limit", "5");

      const itunesRes = await fetch(itunesUrl.toString(), {
        headers: { "User-Agent": "Nexus/1.0" },
        signal: combinedSignal,
        cache: "no-store",
      });

      if (!itunesRes.ok) return null;

      const itunesData = (await itunesRes.json()) as {
        results?: Array<{ trackId?: number; trackName?: string; artistName?: string; collectionName?: string }>;
      };

      const matchingResult = itunesData.results?.find((r) => isTitleMatch(track, r.trackName));
      const trackId = matchingResult?.trackId;
      if (!trackId) return null;

      // 2. Fetch TTML from PaxSenix Apple Music endpoint
      const paxUrl = new URL("https://lyrics.paxsenix.org/apple-music/lyrics");
      paxUrl.searchParams.set("id", String(trackId));
      paxUrl.searchParams.set("ttml", "true");

      const paxRes = await fetch(paxUrl.toString(), {
        headers: {
          "User-Agent": "Nexus/1.0 (music player)",
          Accept: "application/json",
        },
        signal: combinedSignal,
        cache: "no-store",
      });

      if (!paxRes.ok) return null;

      const paxData = (await paxRes.json()) as { type?: string; content?: string };
      if (!paxData.content || typeof paxData.content !== "string") return null;

      const parsed = parseLyrics(paxData.content, "ttml", this.name);
      if (parsed.lines.length === 0) return null;

      parsed.metadata = {
        title: matchingResult?.trackName || track,
        artist: matchingResult?.artistName || artist,
        album: matchingResult?.collectionName || album,
        duration: durationSeconds || undefined,
      };

      return parsed;
    } catch {
      return null;
    }
  }
}
