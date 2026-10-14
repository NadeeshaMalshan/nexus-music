import { parseLyrics } from "../parsers";
import { ILyricsProvider, LyricsQuery, LyricsResult } from "../types";

export interface GeniusMetadata {
  found: boolean;
  songId: number | null;
  url: string | null;
  thumbnail: string | null;
  description: string | null;
  writers: string[] | null;
  producers: string[] | null;
  releaseYear: number | string | null;
}

export class GeniusProvider implements ILyricsProvider {
  readonly name = "Genius";

  async search(query: LyricsQuery): Promise<LyricsResult | null> {
    const { track, artist, signal } = query;
    if (!track || !artist) return null;

    const token = process.env.GENIUS_ACCESS_TOKEN;
    if (!token) return null;

    try {
      const endpoint = new URL("https://api.genius.com/search");
      endpoint.searchParams.set("q", `${artist} ${track}`);

      const res = await fetch(endpoint.toString(), {
        headers: { Authorization: `Bearer ${token}` },
        signal,
        cache: "no-store",
      });

      if (!res.ok) return null;
      const data = (await res.json()) as {
        response?: { hits?: Array<{ result?: { id?: number; url?: string } }> };
      };

      const hit = data.response?.hits?.[0]?.result;
      if (!hit?.url) return null;

      const lyricsText = await this.scrapeLyrics(hit.url, signal);
      if (!lyricsText) return null;

      const parsed = parseLyrics(lyricsText, "plain", this.name);
      parsed.metadata = {
        title: track,
        artist,
      };
      return parsed;
    } catch {
      return null;
    }
  }

  async fetchGeniusDetails(track: string, artist: string, signal?: AbortSignal): Promise<GeniusMetadata> {
    const defaultMeta: GeniusMetadata = {
      found: false,
      songId: null,
      url: null,
      thumbnail: null,
      description: null,
      writers: null,
      producers: null,
      releaseYear: null,
    };

    const token = process.env.GENIUS_ACCESS_TOKEN;
    if (!token) return defaultMeta;

    try {
      const endpoint = new URL("https://api.genius.com/search");
      endpoint.searchParams.set("q", `${artist} ${track}`);

      const res = await fetch(endpoint.toString(), {
        headers: { Authorization: `Bearer ${token}` },
        signal,
        cache: "no-store",
      });

      if (!res.ok) return defaultMeta;
      const data = (await res.json()) as {
        response?: {
          hits?: Array<{
            result?: {
              id?: number;
              url?: string;
              song_art_image_thumbnail_url?: string;
            };
          }>;
        };
      };

      const hit = data.response?.hits?.[0]?.result;
      if (!hit?.id) return defaultMeta;

      const songRes = await fetch(`https://api.genius.com/songs/${hit.id}?text_format=plain`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
        cache: "no-store",
      });

      if (!songRes.ok) {
        return {
          ...defaultMeta,
          found: true,
          songId: hit.id,
          url: hit.url ?? null,
          thumbnail: hit.song_art_image_thumbnail_url ?? null,
        };
      }

      const songData = (await songRes.json()) as any;
      const song = songData.response?.song;

      const writers = (song?.writer_artists || []).map((w: any) => String(w.name));
      const producers = (song?.producer_artists || []).map((p: any) => String(p.name));
      const releaseYear =
        song?.release_date_components?.year ||
        (song?.release_date ? new Date(song.release_date).getFullYear() : null);

      let description = song?.description?.plain || null;
      if (description?.toLowerCase().includes("no description available") || (description && description.length < 5)) {
        description = null;
      }

      return {
        found: true,
        songId: hit.id,
        url: hit.url ?? null,
        thumbnail: hit.song_art_image_thumbnail_url ?? null,
        description,
        writers: writers.length > 0 ? writers : null,
        producers: producers.length > 0 ? producers : null,
        releaseYear: releaseYear || null,
      };
    } catch {
      return defaultMeta;
    }
  }

  private async scrapeLyrics(url: string, signal?: AbortSignal): Promise<string | null> {
    try {
      const res = await fetch(url, { signal, cache: "no-store" });
      if (!res.ok) return null;
      const html = await res.text();

      let lyrics = "";
      const containerRegex = /<div class="Lyrics__Container[^>]*>([\s\S]*?)<\/div>/g;
      let match: RegExpExecArray | null;
      while ((match = containerRegex.exec(html)) !== null) {
        lyrics += match[1] + "\n";
      }

      if (lyrics) {
        return lyrics
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<[^>]+>/g, "")
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&#39;/g, "'")
          .trim();
      }

      const oldContainer = html.match(/<div class="lyrics">([\s\S]*?)<\/div>/);
      if (oldContainer) {
        return oldContainer[1]
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<[^>]+>/g, "")
          .trim();
      }

      return null;
    } catch {
      return null;
    }
  }
}
