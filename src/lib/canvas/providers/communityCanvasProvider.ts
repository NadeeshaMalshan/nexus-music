import { CanvasQuery, CanvasResponse, ICanvasProvider } from "../types";
import { cleanCanvasArtist, cleanCanvasTitle, scoreCanvasMatch } from "../matching";

/**
 * Community and fallback canvas provider.
 * Supports community-contributed canvases, custom overrides, and remote canvas endpoints.
 */
export class CommunityCanvasProvider implements ICanvasProvider {
  public readonly name = "community";

  private customOverrides = new Map<string, { url: string; format: "hls" | "mp4"; bgColor?: string }>();

  public registerOverride(
    title: string,
    artist: string,
    data: { url: string; format: "hls" | "mp4"; bgColor?: string }
  ) {
    const key = `${cleanCanvasArtist(artist).toLowerCase()}|${cleanCanvasTitle(title).toLowerCase()}`;
    this.customOverrides.set(key, data);
  }

  public async getCanvas(query: CanvasQuery): Promise<CanvasResponse | null> {
    const cleanTitle = cleanCanvasTitle(query.title, query.artist);
    const cleanArtist = cleanCanvasArtist(query.artist);
    if (!cleanTitle || !cleanArtist) return null;

    // Check custom registered overrides
    const key = `${cleanArtist.toLowerCase()}|${cleanTitle.toLowerCase()}`;
    const override = this.customOverrides.get(key);
    if (override) {
      return {
        hasCanvas: true,
        animatedCover: {
          url: override.url,
          width: 720,
          height: 720,
          durationMs: null,
          format: override.format,
          source: "community",
          matchedTitle: cleanTitle,
          matchedArtist: cleanArtist,
          bgColor: override.bgColor,
        },
        fallbackRequired: false,
        source: "community",
      };
    }

    // Optional third-party community canvas API hook
    const communityApi = process.env.COMMUNITY_CANVAS_API;
    if (communityApi) {
      try {
        const url = new URL(communityApi);
        url.searchParams.set("title", cleanTitle);
        url.searchParams.set("artist", cleanArtist);
        if (query.album) url.searchParams.set("album", query.album);

        const res = await fetch(url.toString(), {
          headers: { "User-Agent": "NexusMusic/1.0" },
          signal: AbortSignal.timeout(4000),
        });

        if (res.ok) {
          const data = (await res.json()) as {
            url?: string;
            title?: string;
            artist?: string;
            format?: "hls" | "mp4";
            bgColor?: string;
          };

          if (data.url && data.title && data.artist) {
            const match = scoreCanvasMatch(query, {
              title: data.title,
              artist: data.artist,
            });

            if (match.isMatch && match.score >= 75) {
              return {
                hasCanvas: true,
                animatedCover: {
                  url: data.url,
                  width: 720,
                  height: 720,
                  durationMs: null,
                  format: data.format || "mp4",
                  source: "community",
                  matchedTitle: data.title,
                  matchedArtist: data.artist,
                  bgColor: data.bgColor,
                },
                fallbackRequired: false,
                source: "community",
              };
            }
          }
        }
      } catch {
        // Silently ignore community network timeouts
      }
    }

    return null;
  }
}

