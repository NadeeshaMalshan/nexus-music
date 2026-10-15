import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const APPLE_WEB_PLAYER = "https://music.apple.com/us/browse";
const APPLE_API = "https://amp-api.music.apple.com/v1/catalog";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const TOKEN_REFRESH_MARGIN_MS = 60_000;
const REQUEST_TIMEOUT_MS = 7_000;

let cachedToken: { value: string; expiresAt: number } | null = null;
let tokenRetryAfter = 0;
const responseCache = new Map<string, { expiresAt: number; value: CanvasResponse }>();

interface CanvasResponse {
  hasCanvas: boolean;
  animatedCover: null | {
    url: string;
    fallbackUrl?: string;
    width: number;
    height: number;
    durationMs: number | null;
    format: "hls" | "mp4" | "unknown";
    source: "apple-music";
    matchedTitle?: string;
    matchedArtist?: string;
    album?: string;
    bgColor?: string;
  };
  fallbackRequired: boolean;
  source: "apple-music" | null;
}

type JsonObject = Record<string, unknown>;

async function fetchText(url: string, headers: Record<string, string> = {}): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, ...headers },
      signal: controller.signal,
      cache: "no-store",
      redirect: "follow",
    });
    return response.ok ? await response.text() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function getAppleMusicToken(): Promise<string | null> {
  const now = Date.now();
  if (cachedToken && now < cachedToken.expiresAt - TOKEN_REFRESH_MARGIN_MS) return cachedToken.value;
  if (now < tokenRetryAfter) return null;

  const html = await fetchText(APPLE_WEB_PLAYER);
  if (!html) {
    tokenRetryAfter = now + 5 * 60_000;
    return null;
  }

  const scriptPaths = [...new Set(
    [...html.matchAll(/\/assets\/index(?:-legacy)?[~-][A-Za-z0-9_-]+\.js/g)].map((match) => match[0]),
  )].slice(0, 8);

  for (const path of scriptPaths) {
    const script = await fetchText(new URL(path, "https://music.apple.com").toString());
    if (!script) continue;
    const candidates = [...new Set(
      [...script.matchAll(/ey[A-Za-z0-9_-]+\.ey[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)].map((match) => match[0]),
    )];

    const valid = candidates
      .map((token) => ({ token, payload: decodeJwtPayload(token) }))
      .filter((item): item is { token: string; payload: Record<string, unknown> } => Boolean(item.payload))
      .map((item) => ({
        ...item,
        expiresAt: Number(item.payload.exp ?? 0) * 1000,
        webPlayer: JSON.stringify(item.payload).includes("AMPWebPlay"),
      }))
      .filter((item) => item.expiresAt > now);

    const selected = valid.find((item) => item.webPlayer) ?? valid[0];
    if (selected) {
      cachedToken = { value: selected.token, expiresAt: selected.expiresAt };
      tokenRetryAfter = 0;
      return selected.token;
    }
  }

  tokenRetryAfter = now + 30 * 60_000;
  return null;
}

function obj(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null;
}

function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function string(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalize(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .replace(/\b(feat\.?|ft\.?|featuring)\b.*$/i, "")
    .replace(/[^a-z0-9]+/g, " ").trim();
}

function scoreSong(song: JsonObject, title: string, artist: string, album: string): number {
  const attributes = obj(song.attributes) ?? {};
  const gotTitle = normalize(string(attributes.name));
  const gotArtist = normalize(string(attributes.artistName));
  const gotAlbum = normalize(string(attributes.albumName));
  const wantedTitle = normalize(title);
  const wantedArtist = normalize(artist);
  const wantedAlbum = normalize(album);
  if (!gotTitle || !gotArtist || !wantedTitle || !wantedArtist) return -100;

  // Artist match is a gate so a similarly named song by someone else cannot win.
  if (!(gotArtist === wantedArtist || gotArtist.includes(wantedArtist) || wantedArtist.includes(gotArtist))) return -100;
  let score = gotArtist === wantedArtist ? 20 : 10;
  if (gotTitle === wantedTitle) score += 30;
  else if (gotTitle.includes(wantedTitle) || wantedTitle.includes(gotTitle)) score += 12;
  else score -= 20;
  if (wantedAlbum && gotAlbum) {
    if (gotAlbum === wantedAlbum) score += 20;
    else if (gotAlbum.includes(wantedAlbum) || wantedAlbum.includes(gotAlbum)) score += 8;
  }
  if (/playlist|set list|essentials|dj mix|today's hits|session/i.test(`${gotTitle} ${gotAlbum}`)) score -= 40;
  return score;
}

function videoUrl(video: JsonObject | null): string | null {
  if (!video) return null;
  for (const key of ["motionDetailSquare", "motionSquareVideo1x1", "motionDetailRaw", "motionDetailTall", "motionTallVideo3x4"]) {
    const asset = obj(video[key]);
    if (!asset) continue;
    for (const field of ["video", "videoUrl", "hlsUrl", "url"]) {
      const candidate = string(asset[field]);
      if (/^https:\/\//i.test(candidate)) return candidate;
    }
  }
  return null;
}

async function appleGet(url: string, token: string): Promise<JsonObject | null> {
  const body = await fetchText(url, {
    Authorization: `Bearer ${token}`,
    Origin: "https://music.apple.com",
    Referer: "https://music.apple.com/",
    Accept: "application/json",
  });
  if (!body) return null;
  try { return JSON.parse(body) as JsonObject; } catch { return null; }
}

function emptyResponse(): CanvasResponse {
  return { hasCanvas: false, animatedCover: null, fallbackRequired: true, source: null };
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const title = params.get("title")?.trim() ?? "";
  const artist = params.get("artist")?.trim() ?? "";
  const album = params.get("album")?.trim() ?? "";
  if (!title || !artist) {
    return NextResponse.json({ error: "title and artist are required", ...emptyResponse() }, { status: 400 });
  }
  if (title.length > 180 || artist.length > 180 || album.length > 180) {
    return NextResponse.json({ error: "query is too long", ...emptyResponse() }, { status: 400 });
  }

  const cacheKey = `${normalize(title)}|${normalize(artist)}|${normalize(album)}`;
  const cached = responseCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return NextResponse.json(cached.value);

  const token = await getAppleMusicToken();
  if (!token) {
    const response = emptyResponse();
    responseCache.set(cacheKey, { expiresAt: Date.now() + 5 * 60_000, value: response });
    return NextResponse.json(response);
  }

  const term = [artist, title, album].filter(Boolean).join(" ");
  const searchUrl = new URL(`${APPLE_API}/us/search`);
  searchUrl.searchParams.set("term", term);
  searchUrl.searchParams.set("types", "songs");
  searchUrl.searchParams.set("limit", "10");
  searchUrl.searchParams.set("extend", "editorialVideo");
  searchUrl.searchParams.set("include", "albums");

  const search = await appleGet(searchUrl.toString(), token);
  const results = obj(search?.results);
  const songsContainer = obj(results?.songs);
  const songs = arr(songsContainer?.data).map(obj).filter((song): song is JsonObject => Boolean(song));
  const ranked = songs.map((song) => ({ song, score: scoreSong(song, title, artist, album) }))
    .filter((hit) => hit.score >= 12).sort((a, b) => b.score - a.score);

  for (const { song } of ranked) {
    const attributes = obj(song.attributes) ?? {};
    const inlineVideo = obj(attributes.editorialVideo);
    let url = videoUrl(inlineVideo);
    let matchedAlbum = string(attributes.albumName);
    let matchedBgColor = string(obj(attributes.artwork)?.bgColor);

    if (!url) {
      let albumId = "";
      const relationships = obj(song.relationships);
      const albums = obj(relationships?.albums);
      const albumItem = obj(arr(albums?.data)[0]);
      albumId = string(albumItem?.id);

      // Apple Catalog /search endpoint does not include song relationships.
      // Fetch the song detail directly to obtain its linked album and editorial video.
      if (!albumId) {
        const songId = string(song.id);
        if (songId && /^\d+$/.test(songId)) {
          const songDetail = await appleGet(`${APPLE_API}/us/songs/${songId}?include=albums&extend=editorialVideo`, token);
          const detailData = obj(arr(songDetail?.data)[0]);
          const detailRel = obj(detailData?.relationships);
          const detailAlbums = obj(detailRel?.albums);
          const detailAlbumItem = obj(arr(detailAlbums?.data)[0]);
          albumId = string(detailAlbumItem?.id);
          const detailAlbumAttr = obj(detailAlbumItem?.attributes);
          url = videoUrl(obj(detailAlbumAttr?.editorialVideo));
          matchedAlbum = string(detailAlbumAttr?.name) || matchedAlbum;
          if (!matchedBgColor) {
            matchedBgColor = string(obj(detailAlbumAttr?.artwork)?.bgColor);
          }
        }
      }

      if (!url && albumId && /^\d+$/.test(albumId)) {
        const albumUrl = new URL(`${APPLE_API}/us/albums/${albumId}`);
        albumUrl.searchParams.set("extend", "editorialVideo");
        const albumResult = await appleGet(albumUrl.toString(), token);
        const albumRecord = obj(arr(albumResult?.data)[0]);
        const albumAttributes = obj(albumRecord?.attributes);
        url = videoUrl(obj(albumAttributes?.editorialVideo));
        matchedAlbum = string(albumAttributes?.name) || matchedAlbum;
        if (!matchedBgColor) {
          matchedBgColor = string(obj(albumAttributes?.artwork)?.bgColor);
        }
      }

      // Fallback: If still no video, search albums directly by artist and album name
      if (!url && (matchedAlbum || album)) {
        const albumTarget = matchedAlbum || album;
        const albSearchUrl = new URL(`${APPLE_API}/us/search`);
        albSearchUrl.searchParams.set("term", `${artist} ${albumTarget}`);
        albSearchUrl.searchParams.set("types", "albums");
        albSearchUrl.searchParams.set("limit", "3");
        albSearchUrl.searchParams.set("extend", "editorialVideo");
        const albSearch = await appleGet(albSearchUrl.toString(), token);
        const albResults = obj(albSearch?.results);
        const albContainer = obj(albResults?.albums);
        const albData = arr(albContainer?.data).map(obj).filter((a): a is JsonObject => Boolean(a));
        for (const alb of albData) {
          const aAttr = obj(alb.attributes);
          const gotAlbArtist = normalize(string(aAttr?.artistName));
          const wantedArtistNorm = normalize(artist);
          if (gotAlbArtist && wantedArtistNorm && (gotAlbArtist.includes(wantedArtistNorm) || wantedArtistNorm.includes(gotAlbArtist))) {
            const v = videoUrl(obj(aAttr?.editorialVideo));
            if (v) {
              url = v;
              matchedAlbum = string(aAttr?.name) || matchedAlbum;
              if (!matchedBgColor) {
                matchedBgColor = string(obj(aAttr?.artwork)?.bgColor);
              }
              break;
            }
          }
        }
      }
    }

    if (!url) continue;
    const format = /\.m3u8(?:\?|$)/i.test(url) ? "hls" : /\.mp4(?:\?|$)/i.test(url) ? "mp4" : "unknown";
    const cleanBgColor = matchedBgColor
      ? (matchedBgColor.startsWith("#") ? matchedBgColor : `#${matchedBgColor}`)
      : undefined;
    const response: CanvasResponse = {
      hasCanvas: true,
      animatedCover: {
        url,
        width: 720,
        height: 720,
        durationMs: null,
        format,
        source: "apple-music",
        matchedTitle: string(attributes.name),
        matchedArtist: string(attributes.artistName),
        album: matchedAlbum || undefined,
        bgColor: cleanBgColor,
      },
      fallbackRequired: false,
      source: "apple-music",
    };
    responseCache.set(cacheKey, { expiresAt: Date.now() + 24 * 60 * 60_000, value: response });
    return NextResponse.json(response, { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
  }

  const response = emptyResponse();
  responseCache.set(cacheKey, { expiresAt: Date.now() + 60 * 60_000, value: response });
  return NextResponse.json(response, { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } });
}
