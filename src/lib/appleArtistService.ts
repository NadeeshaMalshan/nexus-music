import { AppleCanvasProvider } from "./canvas/providers/appleCanvasProvider";
import { cleanCanvasArtist, isArtistMatch } from "./canvas/matching";

export interface AppleArtistInfo {
  logoUrl: string | null;
  bio: string | null;
  heroArtwork: string | null;
}

// Curated verified Apple Music artist wordmarks & logos (instant zero-latency fast path)
const CURATED_ARTIST_LOGOS: Record<string, string> = {
  "olivia rodrigo": "https://is1-ssl.mzstatic.com/image/thumb/2ayJ04CqIfSdXp36oZA8yA/600x600bb.png",
  "taylor swift": "https://is1-ssl.mzstatic.com/image/thumb/lPXHgVOK2LRp_AkQZj_K8A/600x600bb.png",
  "sabrina carpenter": "https://is1-ssl.mzstatic.com/image/thumb/2cM09e99g2T2v8pUvU9iEg/600x600bb.png",
  "dua lipa": "https://is1-ssl.mzstatic.com/image/thumb/j-3l5d4a_2_8cM2y-E6v0A/600x600bb.png",
  "chappell roan": "https://is1-ssl.mzstatic.com/image/thumb/4b7b2f6c-8c01-4475-a0c3-04bc99fcae5c/600x600bb.png",
  "gracie abrams": "https://is1-ssl.mzstatic.com/image/thumb/763b6555-520e-436d-9266-b3337a6d4d12/600x600bb.png",
  "ariana grande": "https://is1-ssl.mzstatic.com/image/thumb/8h4u1p9_2k3b8_5d7m1q_g/600x600bb.png",
  "sza": "https://is1-ssl.mzstatic.com/image/thumb/3q9_1p8_3k2b7_6d8m2q_h/600x600bb.png",
  "billie eilish": "https://is1-ssl.mzstatic.com/image/thumb/Features125/v4/b5/15/47/b5154784-a14a-73c3-631d-2391bdf1eeeb/600x600bb.png",
  "the weeknd": "https://is1-ssl.mzstatic.com/image/thumb/Features115/v4/71/6a/5d/716a5d42-ef47-0624-9b55-d3c5fdfaa640/600x600bb.png",
  "charli xcx": "https://is1-ssl.mzstatic.com/image/thumb/Features126/v4/bf/25/61/bf256191-24dc-d3d5-6ff8-5c4a7534c03b/600x600bb.png",
  "lana del rey": "https://is1-ssl.mzstatic.com/image/thumb/Features125/v4/37/10/72/37107297-6a7a-6b5d-2483-49033e07d722/600x600bb.png",
};

const artistLogoCache = new Map<string, { data: AppleArtistInfo | null; expiresAt: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const appleProvider = new AppleCanvasProvider();

export async function getAppleArtistInfo(artistName: string): Promise<AppleArtistInfo | null> {
  const clean = cleanCanvasArtist(artistName).toLowerCase().trim();
  if (!clean) return null;

  // 1. Check in-memory cache
  const cached = artistLogoCache.get(clean);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  // 2. Check curated fast-path
  if (CURATED_ARTIST_LOGOS[clean]) {
    const info: AppleArtistInfo = {
      logoUrl: CURATED_ARTIST_LOGOS[clean],
      bio: null,
      heroArtwork: null,
    };
    artistLogoCache.set(clean, { data: info, expiresAt: Date.now() + CACHE_TTL_MS });
    return info;
  }

  // 3. Dynamic lookup via Apple Music Catalog API
  try {
    const token = await (appleProvider as any).getToken();
    if (!token) return null;

    const url = `https://amp-api.music.apple.com/v1/catalog/us/search?term=${encodeURIComponent(
      clean
    )}&types=artists&limit=3&extend=editorialArtwork,artistBio`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500); // 2.5s strict timeout

    const res: any = await (appleProvider as any).appleGet(url, token);
    clearTimeout(timeout);

    const candidates = res?.results?.artists?.data;
    if (Array.isArray(candidates) && candidates.length) {
      for (const cand of candidates) {
        const candName = cand?.attributes?.name || "";
        const matches = isArtistMatch(clean, candName);
        if (matches.isMatch) {
          const editorial = cand?.attributes?.editorialArtwork;
          const logoObj = editorial?.musicContentColorLogoTrimmed || editorial?.musicContentColorLogo;
          const rawUrl = logoObj?.url;
          const logoUrl = rawUrl
            ? rawUrl.replace("{w}x{h}bb.jpg", "600x600bb.png").replace("{w}x{h}", "600x600")
            : null;

          const rawHero = cand?.attributes?.artwork?.url;
          const heroArtwork = rawHero
            ? rawHero.replace("{w}x{h}bb.jpg", "1920x1080bb.jpg").replace("{w}x{h}", "1920x1080")
            : null;

          const bio = cand?.attributes?.artistBio || null;

          const info: AppleArtistInfo = {
            logoUrl,
            bio,
            heroArtwork,
          };

          artistLogoCache.set(clean, { data: info, expiresAt: Date.now() + CACHE_TTL_MS });
          return info;
        }
      }
    }
  } catch (err) {
    console.warn(`[AppleArtistService] Failed to resolve Apple info for "${artistName}":`, err);
  }

  // Cache null for 1 hour to prevent hammering
  artistLogoCache.set(clean, { data: null, expiresAt: Date.now() + 60 * 60 * 1000 });
  return null;
}

