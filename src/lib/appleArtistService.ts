import { AppleCanvasProvider } from "./canvas/providers/appleCanvasProvider";
import { cleanCanvasArtist, isArtistMatch } from "./canvas/matching";

export interface AppleArtistInfo {
  logoUrl: string | null;
  bio: string | null;
  heroArtwork: string | null;
}

// Curated verified Apple Music artist wordmarks & logos (instant zero-latency fast path)
const CURATED_ARTIST_LOGOS: Record<string, string> = {
  "olivia rodrigo": "https://is1-ssl.mzstatic.com/image/thumb/2ayJ04CqIfSdXp36oZA8yA/400x133bb.webp",
  "olivia dean": "https://is1-ssl.mzstatic.com/image/thumb/Wcm2Bo9UxDiBqIsGMm19KA/400x133bb.webp",
  "taylor swift": "https://is1-ssl.mzstatic.com/image/thumb/lPXHgVOK2LRp_AkQZj_K8A/400x133bb.webp",
  "dua lipa": "https://is1-ssl.mzstatic.com/image/thumb/Features/v4/e1/c3/f5/e1c3f5ac-bc18-de96-68c4-dd2483e5d7d2/e75c0b81-6175-4ecd-9706-26289a987954.png/400x133bb.webp",
  "chappell roan": "https://is1-ssl.mzstatic.com/image/thumb/Features/v4/04/29/a8/0429a85d-01bf-db5e-237b-bf72035e661e/dff6322b-6891-4938-9db0-9cd0c73dd9f5.png/400x133bb.webp",
  "gracie abrams": "https://is1-ssl.mzstatic.com/image/thumb/Features/v4/a7/23/e0/a723e03f-ae05-0f07-f13d-f14df11b5dd7/4945badd-996f-44a5-ba46-ddc4bca89364.png/400x133bb.webp",
  "ariana grande": "https://is1-ssl.mzstatic.com/image/thumb/CfahkqIV7d3iglSrEp6Pcg/400x133bb.webp",
  "lorde": "https://is1-ssl.mzstatic.com/image/thumb/Features/v4/50/28/2d/50282d33-6927-cab4-429a-5e003cf4a8f8/06723374-0f41-4e53-8beb-055ea5e539fa.png/400x133bb.webp",
  "tate mcrae": "https://is1-ssl.mzstatic.com/image/thumb/AiDpnTNIaTHYSOl5Ie6wGw/400x133bb.webp",
  "bruno mars": "https://is1-ssl.mzstatic.com/image/thumb/Features/v4/29/f2/ff/29f2ff9a-407e-f47a-d99c-190db7ecd7cd/1d31f137-bd1e-4615-9d14-0791c0dc1867.png/400x133bb.webp",
  "beyonce": "https://is1-ssl.mzstatic.com/image/thumb/Features/v4/81/0f/83/810f83c5-c3e2-067b-5125-aba946a40e30/7e208df1-0cc6-49d5-8101-c8f8bf8a7076.png/400x133bb.webp",
  "renee rapp": "https://is1-ssl.mzstatic.com/image/thumb/Features/v4/c8/74/0f/c8740f42-4392-a2dd-74b5-c59a022753b8/bdd3dda7-40c0-49d9-8e6d-650cbe68848c.png/400x133bb.webp",
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

  // 2. Check curated fast-path (exact match)
  if (CURATED_ARTIST_LOGOS[clean]) {
    const info: AppleArtistInfo = {
      logoUrl: CURATED_ARTIST_LOGOS[clean],
      bio: null,
      heroArtwork: null,
    };
    artistLogoCache.set(clean, { data: info, expiresAt: Date.now() + CACHE_TTL_MS });
    return info;
  }

  // Check curated fast-path with fuzzy match (e.g. "olivia ridrigi" -> "olivia rodrigo")
  for (const [curatedArtist, logoUrl] of Object.entries(CURATED_ARTIST_LOGOS)) {
    const m = isArtistMatch(clean, curatedArtist);
    if (m.isMatch && m.score >= 0.82) {
      const info: AppleArtistInfo = {
        logoUrl,
        bio: null,
        heroArtwork: null,
      };
      artistLogoCache.set(clean, { data: info, expiresAt: Date.now() + CACHE_TTL_MS });
      return info;
    }
  }

  // 3. Dynamic lookup via Apple Music Catalog API
  try {
    const token = await (appleProvider as any).getToken();
    if (!token) return null;

    const url = `https://amp-api.music.apple.com/v1/catalog/us/search?term=${encodeURIComponent(
      clean
    )}&types=artists&limit=5&extend=editorialArtwork,artistBio`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500); // 2.5s strict timeout

    const res: any = await (appleProvider as any).appleGet(url, token);
    clearTimeout(timeout);

    const candidates = res?.results?.artists?.data;
    if (Array.isArray(candidates) && candidates.length) {
      // Find candidate with the highest matching confidence
      let bestCand: any = null;
      let highestScore = 0;

      for (const cand of candidates) {
        const candName = cand?.attributes?.name || "";
        const matches = isArtistMatch(clean, candName);
        if (matches.isMatch && matches.score > highestScore) {
          highestScore = matches.score;
          bestCand = cand;
        }
      }

      if (bestCand && highestScore >= 0.78) {
        const editorial = bestCand?.attributes?.editorialArtwork;
        const logoObj = editorial?.musicContentColorLogoTrimmed || editorial?.musicContentColorLogo;
        const rawUrl = logoObj?.url;
        const logoUrl = rawUrl
          ? rawUrl.replace("{w}x{h}bb.jpg", "400x133bb.webp").replace("{w}x{h}", "400x133")
          : null;

        const rawHero = bestCand?.attributes?.artwork?.url;
        const heroArtwork = rawHero
          ? rawHero.replace("{w}x{h}bb.jpg", "1920x1080bb.jpg").replace("{w}x{h}", "1920x1080")
          : null;

        const bio = bestCand?.attributes?.artistBio || null;

        const info: AppleArtistInfo = {
          logoUrl,
          bio,
          heroArtwork,
        };

        artistLogoCache.set(clean, { data: info, expiresAt: Date.now() + CACHE_TTL_MS });
        return info;
      }
    }
  } catch (err) {
    console.warn(`[AppleArtistService] Failed to resolve Apple info for "${artistName}":`, err);
  }

  // Cache null for 1 hour to prevent hammering
  artistLogoCache.set(clean, { data: null, expiresAt: Date.now() + 60 * 60 * 1000 });
  return null;
}

