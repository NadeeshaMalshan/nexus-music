import { CanvasQuery, CanvasResponse, ICanvasProvider } from "./types";
import { cleanCanvasArtist, cleanCanvasTitle, normalizeText } from "./matching";
import { CuratedCanvasProvider } from "./providers/curatedCanvasProvider";
import { AppleCanvasProvider } from "./providers/appleCanvasProvider";
import { CommunityCanvasProvider } from "./providers/communityCanvasProvider";

interface CacheEntry {
  expiresAt: number;
  value: CanvasResponse;
}

export class CanvasService {
  private static instance: CanvasService;

  private providers: ICanvasProvider[];
  private cache = new Map<string, CacheEntry>();
  private inFlight = new Map<string, Promise<CanvasResponse>>();

  constructor(providers?: ICanvasProvider[]) {
    this.providers = providers ?? [
      new CuratedCanvasProvider(),
      new AppleCanvasProvider(),
      new CommunityCanvasProvider(),
    ];
  }

  public static getInstance(): CanvasService {
    if (!CanvasService.instance) {
      CanvasService.instance = new CanvasService();
    }
    return CanvasService.instance;
  }

  private emptyResponse(): CanvasResponse {
    return {
      hasCanvas: false,
      animatedCover: null,
      fallbackRequired: true,
      source: null,
    };
  }

  private buildCacheKey(query: CanvasQuery): string {
    const cleanTitle = cleanCanvasTitle(query.title, query.artist);
    const cleanArtist = cleanCanvasArtist(query.artist);
    const cleanAlbum = query.album?.trim() || "";
    return `${normalizeText(cleanArtist)}|${normalizeText(cleanTitle)}|${normalizeText(cleanAlbum)}`;
  }

  public async getCanvas(query: CanvasQuery): Promise<CanvasResponse> {
    const cleanTitle = cleanCanvasTitle(query.title, query.artist);
    const cleanArtist = cleanCanvasArtist(query.artist);

    if (!cleanTitle || !cleanArtist) {
      return this.emptyResponse();
    }

    const cacheKey = this.buildCacheKey(query);
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    // Deduplicate in-flight requests for identical queries
    const ongoing = this.inFlight.get(cacheKey);
    if (ongoing) {
      return ongoing;
    }

    const task = this.resolveCanvas({
      title: cleanTitle,
      artist: cleanArtist,
      album: query.album,
    })
      .then((res) => {
        // Cache success for 24 hours, empty/fallback for 30 minutes
        const ttl = res.hasCanvas ? 24 * 60 * 60_000 : 30 * 60_000;
        this.cache.set(cacheKey, { expiresAt: Date.now() + ttl, value: res });
        return res;
      })
      .finally(() => {
        this.inFlight.delete(cacheKey);
      });

    this.inFlight.set(cacheKey, task);
    return task;
  }

  private async resolveCanvas(query: CanvasQuery): Promise<CanvasResponse> {
    for (const provider of this.providers) {
      try {
        const result = await provider.getCanvas(query);
        if (result && result.hasCanvas && result.animatedCover?.url) {
          // Validate URL is valid HTTPS video resource
          const url = result.animatedCover.url;
          if (/^https:\/\//i.test(url)) {
            return result;
          }
        }
      } catch (err) {
        console.warn(`[CanvasService] Provider ${provider.name} failed:`, err);
      }
    }

    return this.emptyResponse();
  }

  public clearCache(): void {
    this.cache.clear();
  }
}

export const canvasService = CanvasService.getInstance();

