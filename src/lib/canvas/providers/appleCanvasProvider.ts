import { CanvasQuery, CanvasResponse, ICanvasProvider } from "../types";
import {
  cleanCanvasArtist,
  cleanCanvasTitle,
  isAlbumMatch,
  isArtistMatch,
  scoreCanvasMatch,
} from "../matching";

const APPLE_WEB_PLAYER = "https://music.apple.com/us/browse";
const APPLE_API = "https://amp-api.music.apple.com/v1/catalog";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const TOKEN_REFRESH_MARGIN_MS = 60_000;
const REQUEST_TIMEOUT_MS = 6_000;

type JsonObject = Record<string, unknown>;

function obj(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : null;
}

function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function string(value: unknown): string {
  return typeof value === "string" ? value : "";
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

async function fetchWithTimeout(url: string, headers: Record<string, string> = {}): Promise<string | null> {
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

function extractVideoUrl(video: JsonObject | null): string | null {
  if (!video) return null;
  for (const key of [
    "motionDetailSquare",
    "motionSquareVideo1x1",
    "motionDetailRaw",
    "motionDetailTall",
    "motionTallVideo3x4",
  ]) {
    const asset = obj(video[key]);
    if (!asset) continue;
    for (const field of ["video", "videoUrl", "hlsUrl", "url"]) {
      const candidate = string(asset[field]);
      if (/^https:\/\//i.test(candidate)) return candidate;
    }
  }
  return null;
}

export class AppleCanvasProvider implements ICanvasProvider {
  public readonly name = "apple-music";

  private cachedToken: { value: string; expiresAt: number } | null = null;
  private tokenRetryAfter = 0;

  private async getToken(): Promise<string | null> {
    const now = Date.now();
    if (this.cachedToken && now < this.cachedToken.expiresAt - TOKEN_REFRESH_MARGIN_MS) {
      return this.cachedToken.value;
    }
    if (now < this.tokenRetryAfter) return null;

    const html = await fetchWithTimeout(APPLE_WEB_PLAYER);
    if (!html) {
      this.tokenRetryAfter = now + 5 * 60_000;
      return null;
    }

    const scriptPaths = [
      ...new Set(
        [...html.matchAll(/\/assets\/index(?:-legacy)?[~-][A-Za-z0-9_-]+\.js/g)].map((match) => match[0])
      ),
    ].slice(0, 8);

    for (const path of scriptPaths) {
      const script = await fetchWithTimeout(new URL(path, "https://music.apple.com").toString());
      if (!script) continue;
      const candidates = [
        ...new Set([...script.matchAll(/ey[A-Za-z0-9_-]+\.ey[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)].map((match) => match[0])),
      ];

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
        this.cachedToken = { value: selected.token, expiresAt: selected.expiresAt };
        this.tokenRetryAfter = 0;
        return selected.token;
      }
    }

    this.tokenRetryAfter = now + 30 * 60_000;
    return null;
  }

  private async appleGet(url: string, token: string): Promise<JsonObject | null> {
    const body = await fetchWithTimeout(url, {
      Authorization: `Bearer ${token}`,
      Origin: "https://music.apple.com",
      Referer: "https://music.apple.com/",
      Accept: "application/json",
    });
    if (!body) return null;
    try {
      return JSON.parse(body) as JsonObject;
    } catch {
      return null;
    }
  }

  public async getCanvas(query: CanvasQuery): Promise<CanvasResponse | null> {
    const cleanTitle = cleanCanvasTitle(query.title, query.artist);
    const cleanArtist = cleanCanvasArtist(query.artist);
    const cleanAlbum = query.album ? cleanCanvasTitle(query.album, query.artist) : "";
    if ((!cleanTitle && !cleanAlbum) || !cleanArtist) return null;

    const token = await this.getToken();
    if (!token) return null;

    // 1. Direct Album Motion Art Search
    const isDirectAlbumSearch = Boolean(cleanAlbum && (!cleanTitle || cleanTitle.toLowerCase() === cleanAlbum.toLowerCase()));
    if (isDirectAlbumSearch) {
      const albSearchUrl = new URL(`${APPLE_API}/us/search`);
      albSearchUrl.searchParams.set("term", `${cleanArtist} ${cleanAlbum}`.trim());
      albSearchUrl.searchParams.set("types", "albums");
      albSearchUrl.searchParams.set("limit", "5");
      albSearchUrl.searchParams.set("extend", "editorialVideo");

      const albSearch = await this.appleGet(albSearchUrl.toString(), token);
      const albResults = obj(albSearch?.results);
      const albContainer = obj(albResults?.albums);
      const albData = arr(albContainer?.data).map(obj).filter((a): a is JsonObject => Boolean(a));

      for (const alb of albData) {
        const aAttr = obj(alb.attributes);
        const gotAlbTitle = string(aAttr?.name);
        const gotAlbArtist = string(aAttr?.artistName);

        if (isAlbumMatch(cleanAlbum, gotAlbTitle) && isArtistMatch(cleanArtist, gotAlbArtist).isMatch) {
          const video = extractVideoUrl(obj(aAttr?.editorialVideo));
          if (video) {
            const rawBg = string(obj(aAttr?.artwork)?.bgColor);
            const cleanBgColor = rawBg ? (rawBg.startsWith("#") ? rawBg : `#${rawBg}`) : undefined;
            const format = /\.m3u8(?:\?|$)/i.test(video) ? "hls" : /\.mp4(?:\?|$)/i.test(video) ? "mp4" : "unknown";

            return {
              hasCanvas: true,
              animatedCover: {
                url: video,
                width: 720,
                height: 720,
                durationMs: null,
                format,
                source: "apple-music",
                matchedTitle: gotAlbTitle,
                matchedArtist: gotAlbArtist,
                album: gotAlbTitle,
                bgColor: cleanBgColor,
              },
              fallbackRequired: false,
              source: "apple-music",
            };
          }
        }
      }
      return null;
    }

    // 2. Search Apple Music Catalog for songs
    const term = `${cleanArtist} ${cleanTitle}`.trim();
    const searchUrl = new URL(`${APPLE_API}/us/search`);
    searchUrl.searchParams.set("term", term);
    searchUrl.searchParams.set("types", "songs");
    searchUrl.searchParams.set("limit", "10");
    searchUrl.searchParams.set("extend", "editorialVideo");

    const searchData = await this.appleGet(searchUrl.toString(), token);
    const results = obj(searchData?.results);
    const songsContainer = obj(results?.songs);
    const songs = arr(songsContainer?.data)
      .map(obj)
      .filter((s): s is JsonObject => Boolean(s));

    if (songs.length === 0) return null;

    // Rank candidate songs using strict matching
    const scoredCandidates = songs
      .map((song) => {
        const attributes = obj(song.attributes) ?? {};
        const candTitle = string(attributes.name);
        const candArtist = string(attributes.artistName);
        const candAlbum = string(attributes.albumName);
        const matchResult = scoreCanvasMatch(
          { title: cleanTitle, artist: cleanArtist, album: query.album },
          { title: candTitle, artist: candArtist, album: candAlbum }
        );
        return { song, attributes, candTitle, candArtist, candAlbum, matchResult };
      })
      // Strictly enforce match and high confidence threshold (>= 75)
      .filter((c) => c.matchResult.isMatch && c.matchResult.score >= 75)
      .sort((a, b) => b.matchResult.score - a.matchResult.score);

    for (const candidate of scoredCandidates) {
      const { song, attributes, candTitle, candArtist } = candidate;
      let url = extractVideoUrl(obj(attributes.editorialVideo));
      let matchedAlbum = string(attributes.albumName);
      let matchedBgColor = string(obj(attributes.artwork)?.bgColor);

      // If no song-level editorial video, inspect the song's canonical album
      if (!url) {
        let albumId = "";
        const relationships = obj(song.relationships);
        const albums = obj(relationships?.albums);
        const albumItem = obj(arr(albums?.data)[0]);
        albumId = string(albumItem?.id);

        if (!albumId) {
          const songId = string(song.id);
          if (songId && /^\d+$/.test(songId)) {
            const detailUrl = `${APPLE_API}/us/songs/${songId}?include=albums&extend=editorialVideo`;
            const songDetail = await this.appleGet(detailUrl, token);
            const detailData = obj(arr(songDetail?.data)[0]);
            const detailRel = obj(detailData?.relationships);
            const detailAlbums = obj(detailRel?.albums);
            const detailAlbumItem = obj(arr(detailAlbums?.data)[0]);
            albumId = string(detailAlbumItem?.id);

            const detailAlbumAttr = obj(detailAlbumItem?.attributes);
            url = extractVideoUrl(obj(detailAlbumAttr?.editorialVideo));
            matchedAlbum = string(detailAlbumAttr?.name) || matchedAlbum;
            if (!matchedBgColor) {
              matchedBgColor = string(obj(detailAlbumAttr?.artwork)?.bgColor);
            }
          }
        }

        if (!url && albumId && /^\d+$/.test(albumId)) {
          const albumUrl = new URL(`${APPLE_API}/us/albums/${albumId}`);
          albumUrl.searchParams.set("extend", "editorialVideo");
          const albumResult = await this.appleGet(albumUrl.toString(), token);
          const albumRecord = obj(arr(albumResult?.data)[0]);
          const albumAttributes = obj(albumRecord?.attributes);
          const candidateAlbName = string(albumAttributes?.name);

          // If user specified an album, ensure this candidate album matches to prevent unrelated album art
          const albumMatches = !query.album || isAlbumMatch(query.album, candidateAlbName);
          const isComp = /(\bdj mix\b|compilation|karaoke|tribute|cover band|tribute band|various artists)/i.test(candidateAlbName);
          const allowComp = Boolean(query.album && /(\bdj mix\b|compilation|karaoke|tribute)/i.test(query.album));

          if (albumMatches && (!isComp || allowComp)) {
            url = extractVideoUrl(obj(albumAttributes?.editorialVideo));
            matchedAlbum = candidateAlbName || matchedAlbum;
            if (!matchedBgColor) {
              matchedBgColor = string(obj(albumAttributes?.artwork)?.bgColor);
            }
          }
        }
      }

      if (url) {
        const format = /\.m3u8(?:\?|$)/i.test(url) ? "hls" : /\.mp4(?:\?|$)/i.test(url) ? "mp4" : "unknown";
        const cleanBgColor = matchedBgColor
          ? matchedBgColor.startsWith("#")
            ? matchedBgColor
            : `#${matchedBgColor}`
          : undefined;

        return {
          hasCanvas: true,
          animatedCover: {
            url,
            width: 720,
            height: 720,
            durationMs: null,
            format,
            source: "apple-music",
            matchedTitle: candTitle,
            matchedArtist: candArtist,
            album: matchedAlbum || undefined,
            bgColor: cleanBgColor,
          },
          fallbackRequired: false,
          source: "apple-music",
        };
      }
    }

    // STRICT Fallback: Only if the user provided an album or the song specifically had an album,
    // search for that specific album name and VERIFY that the album title strictly matches.
    const albumTarget = query.album || scoredCandidates[0]?.candAlbum;
    if (albumTarget) {
      const albSearchUrl = new URL(`${APPLE_API}/us/search`);
      albSearchUrl.searchParams.set("term", `${cleanArtist} ${albumTarget}`);
      albSearchUrl.searchParams.set("types", "albums");
      albSearchUrl.searchParams.set("limit", "3");
      albSearchUrl.searchParams.set("extend", "editorialVideo");

      const albSearch = await this.appleGet(albSearchUrl.toString(), token);
      const albResults = obj(albSearch?.results);
      const albContainer = obj(albResults?.albums);
      const albData = arr(albContainer?.data)
        .map(obj)
        .filter((a): a is JsonObject => Boolean(a));

      for (const alb of albData) {
        const aAttr = obj(alb.attributes);
        const gotAlbTitle = string(aAttr?.name);
        const gotAlbArtist = string(aAttr?.artistName);

        // Strict verification: MUST match album title and artist!
        const albumMatches = isAlbumMatch(albumTarget, gotAlbTitle);
        const artistMatches = isArtistMatch(cleanArtist, gotAlbArtist).isMatch;

        // Reject compilations, karaoke, and tribute albums unless explicitly requested
        const isComp = /(\bdj mix\b|compilation|karaoke|tribute|cover band|tribute band|various artists|greatest hits)/i.test(gotAlbTitle);
        const allowComp = /(\bdj mix\b|compilation|karaoke|tribute)/i.test(albumTarget);

        if (albumMatches && artistMatches && (!isComp || allowComp)) {
          const video = extractVideoUrl(obj(aAttr?.editorialVideo));
          if (video) {
            const rawBg = string(obj(aAttr?.artwork)?.bgColor);
            const cleanBgColor = rawBg ? (rawBg.startsWith("#") ? rawBg : `#${rawBg}`) : undefined;
            const format = /\.m3u8(?:\?|$)/i.test(video) ? "hls" : /\.mp4(?:\?|$)/i.test(video) ? "mp4" : "unknown";

            return {
              hasCanvas: true,
              animatedCover: {
                url: video,
                width: 720,
                height: 720,
                durationMs: null,
                format,
                source: "apple-music",
                matchedTitle: cleanTitle,
                matchedArtist: gotAlbArtist,
                album: gotAlbTitle,
                bgColor: cleanBgColor,
              },
              fallbackRequired: false,
              source: "apple-music",
            };
          }
        }
      }
    }

    return null;
  }
}

