/**
 * Recommendation Engine for Nexus Music
 * Provides artist normalization, collaborator extraction, and round-robin
 * diverse recommendation selection for Audio Picks and Music Videos.
 */

export interface CandidateTrack {
  videoId: string;
  title: string;
  artist: string;
  duration?: string;
  durationSeconds?: number;
  thumbnail?: string;
}

export interface DiverseSelectionOptions {
  /**
   * Prioritized list of artists from listening history & liked songs.
   */
  preferredArtists?: string[];
  /**
   * Target number of songs to return (default 12).
   */
  targetCount?: number;
  /**
   * Hard ceiling of songs allowed from any single artist (default 3).
   */
  maxPerArtist?: number;
  /**
   * Preferred ceiling of songs per artist when enough valid artists/candidates are available (default 2).
   */
  preferredMaxPerArtist?: number;
  /**
   * Numeric offset or seed for varying candidate selection on refresh without destroying relevance.
   */
  offset?: number;
}

const COLLAB_SPLIT_REGEX =
  /\s*(?:&|,|\bfeat\.?\b|\bfeaturing\b|\bft\.?\b|\bwith\b|\band\b|;|\/|\\)\s*/i;
const TITLE_FEAT_REGEX =
  /[\(\[][^\)\]]*(?:feat\.?|ft\.?|featuring|with)\s+([^\)\]]+)[\)\]]/gi;

/**
 * Normalizes an artist name for comparison and deduplication.
 * Handles capitalization, excess whitespace, "- Topic" suffixes, "VEVO",
 * channel/publisher noise, and apostrophes.
 */
export function normalizeArtistName(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .toLowerCase()
    .replace(/\s*-\s*topic$/i, "")
    .replace(/\s*vevo$/i, "")
    .replace(/\s*official\s*(channel)?$/i, "")
    .replace(/\s*(music\s+)?records$/i, "")
    .replace(/\s*music$/i, "")
    .replace(/\s*records$/i, "")
    .replace(/\s*channel$/i, "")
    .replace(/['’]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extracts all constituent individual artists from an artist string and/or song title.
 * Identifies featured artists and collaborators so that songs like "Artist A feat. Artist B"
 * are properly recognized as containing both Artist A and Artist B.
 */
export function extractConstituentArtists(
  artistStr: string | null | undefined,
  titleStr?: string | null | undefined
): string[] {
  const artists: string[] = [];

  const addArtist = (raw: string) => {
    const norm = normalizeArtistName(raw);
    if (
      norm &&
      norm !== "unknown" &&
      norm !== "unknown artist" &&
      norm !== "various artists" &&
      !artists.includes(norm)
    ) {
      artists.push(norm);
    }
  };

  // 1. Split artist string on common collaboration delimiters
  if (artistStr) {
    const parts = artistStr.split(COLLAB_SPLIT_REGEX);
    for (const part of parts) {
      addArtist(part);
    }
  }

  // 2. Extract featured artists from parenthetical title tags (e.g. "(feat. Artist B)")
  if (titleStr) {
    const regex = new RegExp(TITLE_FEAT_REGEX);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(titleStr)) !== null) {
      if (match[1]) {
        const featParts = match[1].split(COLLAB_SPLIT_REGEX);
        for (const fp of featParts) {
          addArtist(fp);
        }
      }
    }
  }

  return artists;
}

/**
 * Returns the primary normalized artist name for grouping.
 */
export function getPrimaryArtist(
  artistStr: string | null | undefined,
  titleStr?: string | null | undefined
): string {
  const list = extractConstituentArtists(artistStr, titleStr);
  if (list.length > 0) return list[0];
  const fallback = normalizeArtistName(artistStr);
  return fallback && fallback !== "unknown artist" && fallback !== "unknown" ? fallback : "unknown";
}

/**
 * Selects a diverse, balanced mix of recommendations using round-robin selection.
 *
 * Rules:
 * 1. Eliminates duplicate video IDs.
 * 2. Normalizes artist names to avoid duplicate artists from casing/formatting differences.
 * 3. Enforces a hard cap of `maxPerArtist` (default 3) across all constituent artists (primary + featured).
 * 4. Prefers `preferredMaxPerArtist` (default 2) when enough candidates/artists exist to reach targetCount.
 * 5. Uses round-robin selection in priority order of preferredArtists (derived from user taste).
 * 6. Handles missing/unknown artist metadata gracefully.
 * 7. Supports offset rotation for fresh variety on refresh when alternative candidates exist.
 */
export function selectDiverseRecommendations<T extends CandidateTrack>(
  candidates: T[],
  options: DiverseSelectionOptions = {}
): T[] {
  const {
    preferredArtists = [],
    targetCount = 12,
    maxPerArtist = 3,
    preferredMaxPerArtist = 2,
    offset = 0,
  } = options;

  if (!candidates || candidates.length === 0) {
    return [];
  }

  // 1. Deduplicate candidates by YouTube videoId (preserving first occurrence)
  const uniqueCandidates: T[] = [];
  const seenVideoIds = new Set<string>();
  for (const c of candidates) {
    const vid = (c.videoId || "").trim();
    if (!vid || seenVideoIds.has(vid)) continue;
    seenVideoIds.add(vid);
    uniqueCandidates.push(c);
  }

  if (uniqueCandidates.length === 0) {
    return [];
  }

  // 2. Map candidates with parsed artist metadata
  type MappedTrack = {
    track: T;
    primaryArtist: string;
    allArtists: string[];
    isUnknown: boolean;
  };

  const mapped: MappedTrack[] = uniqueCandidates.map((track) => {
    const allArtists = extractConstituentArtists(track.artist, track.title);
    const primaryArtist = allArtists[0] || normalizeArtistName(track.artist) || "unknown";
    const isUnknown =
      primaryArtist === "unknown" ||
      primaryArtist === "unknown artist" ||
      allArtists.length === 0;

    return {
      track,
      primaryArtist: isUnknown ? "unknown" : primaryArtist,
      allArtists: isUnknown ? [] : allArtists,
      isUnknown,
    };
  });

  // 3. Group candidate tracks into per-artist queues
  const artistQueues = new Map<string, MappedTrack[]>();
  for (const m of mapped) {
    const key = m.isUnknown ? "unknown" : m.primaryArtist;
    const q = artistQueues.get(key) || [];
    q.push(m);
    artistQueues.set(key, q);
  }

  // 4. Order artists: preferred artists first (preserving taste ranking), then additional artists
  const orderedArtists: string[] = [];
  const seenArtists = new Set<string>();

  for (const pa of preferredArtists) {
    const norm = normalizeArtistName(pa);
    if (!norm || norm === "unknown" || seenArtists.has(norm)) continue;
    if (artistQueues.has(norm)) {
      seenArtists.add(norm);
      orderedArtists.push(norm);
    }
  }

  for (const m of mapped) {
    const key = m.primaryArtist;
    if (key === "unknown" || seenArtists.has(key)) continue;
    seenArtists.add(key);
    orderedArtists.push(key);
  }

  if (artistQueues.has("unknown") && !seenArtists.has("unknown")) {
    orderedArtists.push("unknown");
    seenArtists.add("unknown");
  }

  // 5. Apply candidate rotation on refresh when surplus candidates exist
  if (offset > 0) {
    for (const [key, q] of artistQueues.entries()) {
      if (q.length > 1) {
        const queueOffset = offset % q.length;
        if (queueOffset > 0) {
          artistQueues.set(key, [...q.slice(queueOffset), ...q.slice(0, queueOffset)]);
        }
      }
    }

    // If we have more known artists than needed, rotate artist start index to surface alternative favorites
    const minArtistsForTarget = Math.ceil(targetCount / Math.max(1, preferredMaxPerArtist));
    const hasUnknown = orderedArtists[orderedArtists.length - 1] === "unknown";
    const knownCount = hasUnknown ? orderedArtists.length - 1 : orderedArtists.length;

    if (knownCount > minArtistsForTarget) {
      const artistOffset = offset % knownCount;
      if (artistOffset > 0) {
        const knownSlice = orderedArtists.slice(0, knownCount);
        const rotatedKnown = [...knownSlice.slice(artistOffset), ...knownSlice.slice(0, artistOffset)];
        orderedArtists.splice(0, knownCount, ...rotatedKnown);
      }
    }
  }

  // 6. Selection state
  const selected: T[] = [];
  const selectedIds = new Set<string>();
  const artistCounts = new Map<string, number>();
  let unknownCount = 0;

  const canSelectTrack = (item: MappedTrack, cap: number): boolean => {
    if (selectedIds.has(item.track.videoId)) return false;

    if (item.isUnknown) {
      return unknownCount < cap;
    }

    const uniqueArtistsForTrack = new Set([item.primaryArtist, ...item.allArtists]);
    for (const a of uniqueArtistsForTrack) {
      const count = artistCounts.get(a) || 0;
      if (count >= cap) {
        return false;
      }
    }

    return true;
  };

  const addTrack = (item: MappedTrack) => {
    selected.push(item.track);
    selectedIds.add(item.track.videoId);

    if (item.isUnknown) {
      unknownCount++;
    } else {
      const uniqueArtistsForTrack = new Set([item.primaryArtist, ...item.allArtists]);
      for (const a of uniqueArtistsForTrack) {
        artistCounts.set(a, (artistCounts.get(a) || 0) + 1);
      }
    }
  };

  // 7. Multi-pass Round-Robin Selection
  // Pass 1: Cap at preferredMaxPerArtist (default 2) to maximize artist breadth
  // Pass 2: If targetCount is not met, relax cap to maxPerArtist (default 3)
  const initialCap = Math.min(preferredMaxPerArtist, maxPerArtist);
  const passes = initialCap < maxPerArtist ? [initialCap, maxPerArtist] : [maxPerArtist];

  for (const capLimit of passes) {
    if (selected.length >= targetCount) break;

    let madeProgress = true;
    while (madeProgress && selected.length < targetCount) {
      madeProgress = false;

      // Select exactly one song per artist in priority turn
      for (const artistKey of orderedArtists) {
        if (selected.length >= targetCount) break;

        const queue = artistQueues.get(artistKey);
        if (!queue || queue.length === 0) continue;

        let eligibleIndex = -1;
        for (let i = 0; i < queue.length; i++) {
          if (canSelectTrack(queue[i], capLimit)) {
            eligibleIndex = i;
            break;
          }
        }

        if (eligibleIndex !== -1) {
          const [chosen] = queue.splice(eligibleIndex, 1);
          addTrack(chosen);
          madeProgress = true;
        }
      }
    }
  }

  return selected.slice(0, targetCount);
}

/**
 * Extracts a numeric offset from a request's query parameters (offset, seed, t, refresh)
 * to facilitate fresh recommendation candidate rotation on refresh.
 */
export function parseRefreshOffset(request: Request): number {
  try {
    const url = new URL(request.url);
    const offsetParam = url.searchParams.get("offset");
    if (offsetParam && !Number.isNaN(parseInt(offsetParam, 10))) {
      return Math.abs(parseInt(offsetParam, 10));
    }
    const seedParam = url.searchParams.get("seed");
    if (seedParam && !Number.isNaN(parseInt(seedParam, 10))) {
      return Math.abs(parseInt(seedParam, 10));
    }
    const tParam = url.searchParams.get("t") || url.searchParams.get("refresh");
    if (tParam) {
      const num = parseInt(tParam, 10);
      if (!Number.isNaN(num)) {
        return Math.abs(num % 100);
      }
      return 1;
    }
  } catch {
    // Ignore invalid URLs in test/mock environments
  }
  return 0;
}

/**
 * Validates whether a live stream item is genuine music content rather than
 * subscriber counters, kids cartoons, celebrity gossip, or gaming streams.
 */
export function isLikelyMusicLiveStream(item: {
  title: string;
  author: string;
  categoryId?: string;
}): boolean {
  const title = (item.title || "").toLowerCase();
  const author = (item.author || "").toLowerCase();

  // 1. Explicit reject: Live subscriber, view, and stats counter streams
  if (
    /\b(sub\s*count|subscriber\s*count|view\s*count|live\s*count|realtime|live\s*sub|live\s*counter|stats\s*live|counter\s*live|live\s*stream\s*count)\b/i.test(
      title
    )
  ) {
    return false;
  }

  // 2. Explicit reject: News, celebrity gossip, paparazzi, and red carpet
  if (
    /\b(breaking\s*news|news\s*live|paparazzi|red\s*carpet|gossip|press\s*conference|interview\s*live|media\s*briefing|weather\s*live|academy\s*museum)\b/i.test(
      title
    ) ||
    /^(zoom|e!\s*news|entertainment\s*tonight|tmz|hollywood\s*fix|access\s*hollywood)$/i.test(
      author
    )
  ) {
    return false;
  }

  // 3. Explicit reject: Kids, cartoons, nursery rhymes, and family animations
  if (
    /\b(cartoon|nursery|rhymes|for\s*kids|kindergarten|toddler|swimming\s*pool|baby\s*songs|cocomelon|chuchu|peppa|diana\s*and\s*roma)\b/i.test(
      title
    ) ||
    /\b(kids|family\s*life|nursery|cartoon|animation|baby|toddler|toys?)\b/i.test(
      author
    )
  ) {
    return false;
  }

  // 4. Explicit reject: Gaming streams
  if (
    /\b(gameplay|roblox|minecraft|fortnite|gta\s*v|gta\s*5|valorant|pubg|warzone|league\s*of\s*legends|genshin|gaming\s*live)\b/i.test(
      title
    )
  ) {
    return false;
  }

  // 5. If categoryId is available from YouTube Data API:
  // Category 10 is Music.
  if (item.categoryId) {
    if (item.categoryId === "10") {
      return true;
    }
    // If not categorized under Music, require clear music keywords in title or author
    const hasMusicKeywords =
      /\b(music|songs?|live\s*(set|session|concert|performance|acoustic|band|orchestra)|dj\s*set|lofi|chillout|beats|radio|synthwave|jazz|ambient|piano|guitar|orchestra|festival|edm|techno|house|rap|hip\s*hop|r&b|pop|rock|blues)\b/i.test(
        title
      ) ||
      /\b(music|records|sound|vevo|lofi|dj|band|orchestra|radio)\b/i.test(author);

    return hasMusicKeywords;
  }

  // 6. For items where categoryId is not provided, verify presence of music indicators
  const isMusicContent =
    /\b(music|songs?|live\s*(set|session|concert|performance|acoustic|stream|band)|dj\s*set|lofi|chillout|relaxing|beats|radio|synthwave|jazz|ambient|piano|guitar|orchestra|festival|edm|techno|house|hip\s*hop|pop|rock|r&b|acoustic)\b/i.test(
      title
    ) ||
    /\b(music|records|sound|vevo|official|lofi|dj|band|radio)\b/i.test(author);

  return isMusicContent;
}

