import { CanvasQuery, MatchScoreResult } from "./types";

const NOISE_TAGS_REGEX =
  /\s*[\(\[][^)]*?(official|music\s+video|official\s+video|video\s+song|full\s+song|lyric|lyrics|visualizer|remaster|edit|version|feat|ft|clip|cover|tribute|karaoke|instrumental|hd|4k|8k|1080p|mv|m\/v|live|sped\s+up|slowed|reverb|deluxe|bonus\s+track|audio|explicit|clean)[^)]*?[\)\]]/gi;

const COMMON_VERSION_WORDS = new Set([
  "live",
  "acoustic",
  "remix",
  "edit",
  "version",
  "deluxe",
  "sped up",
  "slowed",
  "instrumental",
  "radio edit",
  "original mix",
  "single version",
  "album version",
  "extended mix",
  "mono",
  "stereo",
  "remastered",
]);

const ALBUM_EDITION_REGEX =
  /\b(edition|deluxe|version|reissue|expanded|anniversary|vol|volume|pt|part|remastered|soundtrack|ost)\b/i;

const CHANNEL_SUFFIXES_REGEX =
  /\s*(-?\s*topic|vevo|official\s*(channel)?|records|music\s*(channel)?|entertainment|media)\s*$/i;

/**
 * Normalizes a string for comparison by removing accents, lowercasing,
 * collapsing punctuation into spaces, and removing multiple spaces.
 */
export function normalizeText(text?: string | null): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // remove diacritics / accents
    .replace(/['’]/g, "") // remove apostrophes
    .replace(/[^\p{L}\p{N}\s]/gu, " ") // replace punctuation with spaces
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Cleans the artist name by removing YouTube channel noise, topic markers, and VEVO.
 */
export function cleanCanvasArtist(rawArtist: string): string {
  if (!rawArtist) return "";
  let artist = rawArtist.trim();
  artist = artist.replace(CHANNEL_SUFFIXES_REGEX, "").trim();
  artist = artist.replace(/^by\s+/i, "").trim();
  return artist || rawArtist.trim();
}

/**
 * Splits multi-artist collaboration strings into individual normalized artist names.
 */
export function parseArtists(artistStr: string): string[] {
  if (!artistStr) return [];
  const cleaned = cleanCanvasArtist(artistStr);
  const parts = cleaned
    .split(/\s*(?:&|,|\bfeat\.?\b|\bft\.?\b|\bfeaturing\b|\bx\b|\bX\b|\bwith\b|\band\b|\+)\s*/i)
    .map((p) => normalizeText(p))
    .filter((p) => p.length > 0);
  return parts.length > 0 ? parts : [normalizeText(cleaned)];
}

/**
 * Cleans YouTube song titles, extracting the genuine song title.
 * Handles "Artist - Title", "Title - Artist", pipe delimiters, and noise brackets.
 */
export function cleanCanvasTitle(rawTitle: string, artistHint?: string): string {
  if (!rawTitle) return "";
  let cleaned = rawTitle.trim();

  // 1. If title uses pipe separators (e.g. "Song Title | Movie | Artist"), extract the song segment
  if (cleaned.includes("|")) {
    const segments = cleaned
      .split(/\s*\|\s*/)
      .map((s) => s.trim())
      .filter(Boolean);
    const nonNoise = segments.filter(
      (s) => !/^(official\s+video|4k|hd|audio|lyrics?|visualizer|mv)$/i.test(s)
    );
    if (nonNoise.length > 0) {
      cleaned = nonNoise[0];
    }
  }

  // 2. Remove bracketed non-Latin script (Sinhala, Devanagari, etc.) if Latin text is present
  if (/[a-zA-Z]/.test(cleaned)) {
    cleaned = cleaned.replace(/\s*[\(\[][\u0900-\u0DFF\s]+[\)\]]/g, " ");
  }

  // 3. Remove standard noise tags: (Official Music Video), [4K], etc.
  cleaned = cleaned.replace(NOISE_TAGS_REGEX, " ").trim();

  // 4. Handle bracketed collaborations like "(with Bruno Mars)" or "(feat. DaBaby)"
  cleaned = cleaned.replace(/\s*[\(\[]\s*(?:with|feat\.?|ft\.?)\s+[^)\]]+[\)\]]/gi, " ").trim();

  // 5. Handle "Artist - Song Title" or "Song Title - Artist"
  if (/[\s–—-]+/.test(cleaned) && cleaned.includes(" - ")) {
    const parts = cleaned.split(/\s+-\s+/);
    if (parts.length >= 2) {
      const part0 = parts[0].trim();
      const part1 = parts.slice(1).join(" - ").trim();

      const normPart0 = normalizeText(part0);
      const normPart1 = normalizeText(part1);
      const normArtist = artistHint ? normalizeText(artistHint) : "";

      // If part0 matches the artist (e.g. "The Weeknd - Blinding Lights"), part1 is the title
      if (normArtist && (normPart0 === normArtist || normPart0.includes(normArtist) || normArtist.includes(normPart0))) {
        cleaned = part1;
      }
      // If part1 matches the artist (e.g. "Blinding Lights - The Weeknd" or "Manike Mage Hithe - Yohani")
      else if (normArtist && (normPart1 === normArtist || normPart1.includes(normArtist) || normArtist.includes(normPart1))) {
        cleaned = part0;
      }
      // If part1 is just video descriptor noise
      else if (/^(official|audio|video|lyrics?|visualizer|4k|hd|mv|m\/v|clip)$/i.test(part1)) {
        cleaned = part0;
      }
    }
  }

  // 6. Remove trailing feature tags: "Song feat. Artist" or "Song ft. Artist"
  // Note: DO NOT strip bare "with" here because songs like "Die With A Smile" contain "with" in title!
  cleaned = cleaned.replace(/\s+(feat\.?|ft\.?|featuring)\.?\s+.*$/gi, "").trim();

  // 7. Clean extra spaces
  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();
  return cleaned || rawTitle.trim();
}

/**
 * Checks whether candidateArtist strictly matches wantedArtist.
 * Supports multi-artist collaborations.
 */
export function isArtistMatch(
  wantedArtist: string,
  candidateArtist: string
): { isMatch: boolean; score: number } {
  const normWanted = normalizeText(cleanCanvasArtist(wantedArtist));
  const normCandidate = normalizeText(cleanCanvasArtist(candidateArtist));

  if (!normWanted || !normCandidate) {
    return { isMatch: false, score: 0 };
  }

  // Exact normalized match
  if (normWanted === normCandidate) {
    return { isMatch: true, score: 1.0 };
  }

  // Substring match for single tokens
  if (normWanted.includes(normCandidate) || normCandidate.includes(normWanted)) {
    const ratio = Math.min(normWanted.length, normCandidate.length) / Math.max(normWanted.length, normCandidate.length);
    if (ratio >= 0.7) {
      return { isMatch: true, score: 0.9 * ratio };
    }
  }

  // Check multi-artist overlap
  const wantedParts = parseArtists(wantedArtist);
  const candidateParts = parseArtists(candidateArtist);

  for (const w of wantedParts) {
    for (const c of candidateParts) {
      if (w === c) {
        return { isMatch: true, score: 0.88 };
      }
      if (w.length > 3 && c.length > 3 && (w.includes(c) || c.includes(w))) {
        return { isMatch: true, score: 0.82 };
      }
    }
  }

  return { isMatch: false, score: 0 };
}

/**
 * Strict title matcher.
 * Prevents false positives like "Stay" matching "Stay With Me",
 * or "One" matching "One More Night", while supporting legitimate
 * clean matches and version suffixes.
 */
export function isTitleMatch(
  wantedTitle: string,
  candidateTitle: string
): { isMatch: boolean; score: number; reason?: string } {
  const normWanted = normalizeText(cleanCanvasTitle(wantedTitle));
  const normCand = normalizeText(cleanCanvasTitle(candidateTitle));

  if (!normWanted || !normCand) {
    return { isMatch: false, score: 0, reason: "empty-title" };
  }

  // 1. Exact match
  if (normWanted === normCand) {
    return { isMatch: true, score: 1.0 };
  }

  const wordsWanted = normWanted.split(" ").filter(Boolean);
  const wordsCand = normCand.split(" ").filter(Boolean);

  // 2. Short Title Safeguard (1 or 2 words, e.g. "Stay", "One", "Hold On", "Mine", "Love")
  // For short titles, we DO NOT allow partial substring matches!
  // "Stay" must NEVER match "Stay With Me", "Stay The Night", or "Cant Stay".
  if (wordsWanted.length <= 2) {
    // If candidate has more words, check if the extra words are purely version tags
    if (wordsCand.length > wordsWanted.length && normCand.startsWith(normWanted)) {
      const extraWords = normCand.slice(normWanted.length).trim();
      const isVersionWord = [...COMMON_VERSION_WORDS].some(
        (vw) => extraWords === vw || extraWords.startsWith(vw)
      );
      if (isVersionWord) {
        return { isMatch: true, score: 0.92, reason: "version-suffix" };
      }
    }

    if (wordsWanted.length > wordsCand.length && normWanted.startsWith(normCand)) {
      const extraWords = normWanted.slice(normCand.length).trim();
      const isVersionWord = [...COMMON_VERSION_WORDS].some(
        (vw) => extraWords === vw || extraWords.startsWith(vw)
      );
      if (isVersionWord) {
        return { isMatch: true, score: 0.92, reason: "version-suffix" };
      }
    }

    // Must match identical words
    if (wordsWanted.length === wordsCand.length) {
      const allEqual = wordsWanted.every((w, i) => w === wordsCand[i]);
      if (allEqual) {
        return { isMatch: true, score: 0.98 };
      }
    }

    return { isMatch: false, score: 0, reason: "short-title-mismatch" };
  }

  // 3. Prefix/Suffix match for longer titles
  if (normCand.startsWith(normWanted)) {
    const remainder = normCand.slice(normWanted.length).trim();
    const isVersionWord = [...COMMON_VERSION_WORDS].some(
      (vw) => remainder === vw || remainder.startsWith(vw)
    );
    if (isVersionWord || remainder.length === 0) {
      return { isMatch: true, score: 0.94, reason: "version-suffix" };
    }
  }

  if (normWanted.startsWith(normCand)) {
    const remainder = normWanted.slice(normCand.length).trim();
    const isVersionWord = [...COMMON_VERSION_WORDS].some(
      (vw) => remainder === vw || remainder.startsWith(vw)
    );
    if (isVersionWord || remainder.length === 0) {
      return { isMatch: true, score: 0.94, reason: "version-suffix" };
    }
  }

  // 4. Token Overlap (Dice Coefficient) for titles >= 3 words
  const sharedWords = wordsWanted.filter((w) => wordsCand.includes(w));
  const dice = (2 * sharedWords.length) / (wordsWanted.length + wordsCand.length);
  const lengthRatio = Math.min(normWanted.length, normCand.length) / Math.max(normWanted.length, normCand.length);

  // Require good token overlap (>= 75%) and length ratio >= 0.60
  if (dice >= 0.75 && lengthRatio >= 0.6) {
    return { isMatch: true, score: dice * lengthRatio };
  }

  return { isMatch: false, score: dice * lengthRatio, reason: "low-token-overlap" };
}

/**
 * Checks whether candidateAlbum matches wantedAlbum.
 */
export function isAlbumMatch(wantedAlbum?: string, candidateAlbum?: string): boolean {
  if (!wantedAlbum || !candidateAlbum) return true; // not penalized if unknown
  const a1 = normalizeText(wantedAlbum);
  const a2 = normalizeText(candidateAlbum);
  if (!a1 || !a2) return true;
  if (a1 === a2) return true;

  // Handle album editions: e.g. "Future Nostalgia" vs "Future Nostalgia The Moonlight Edition"
  if (a2.startsWith(a1)) {
    const extra = a2.slice(a1.length).trim();
    if (ALBUM_EDITION_REGEX.test(extra) || extra.length === 0) return true;
  }
  if (a1.startsWith(a2)) {
    const extra = a1.slice(a2.length).trim();
    if (ALBUM_EDITION_REGEX.test(extra) || extra.length === 0) return true;
  }

  if (a1.includes(a2) || a2.includes(a1)) {
    const ratio = Math.min(a1.length, a2.length) / Math.max(a1.length, a2.length);
    return ratio >= 0.6;
  }

  const words1 = a1.split(" ").filter((w) => w.length > 1);
  const words2 = a2.split(" ").filter((w) => w.length > 1);
  if (words1.length === 0 || words2.length === 0) return false;
  const shared = words1.filter((w) => words2.includes(w));
  const dice = (2 * shared.length) / (words1.length + words2.length);
  return dice >= 0.7;
}

/**
 * Computes an overall confidence score (0 to 100) for a candidate song match.
 * Enforces a strict threshold to eliminate incorrect animated cover matches.
 */
export function scoreCanvasMatch(
  wanted: CanvasQuery,
  candidate: { title: string; artist: string; album?: string }
): MatchScoreResult {
  const cleanWantedTitle = cleanCanvasTitle(wanted.title, wanted.artist);
  const cleanWantedArtist = cleanCanvasArtist(wanted.artist);

  const cleanCandTitle = cleanCanvasTitle(candidate.title, candidate.artist);
  const cleanCandArtist = cleanCanvasArtist(candidate.artist);

  const titleResult = isTitleMatch(cleanWantedTitle, cleanCandTitle);
  if (!titleResult.isMatch) {
    return {
      isMatch: false,
      score: 0,
      titleScore: 0,
      artistScore: 0,
      albumScore: 0,
      reason: titleResult.reason || "title-mismatch",
    };
  }

  const artistResult = isArtistMatch(cleanWantedArtist, cleanCandArtist);
  if (!artistResult.isMatch) {
    return {
      isMatch: false,
      score: 0,
      titleScore: Math.round(titleResult.score * 60),
      artistScore: 0,
      albumScore: 0,
      reason: "artist-mismatch",
    };
  }

  // Title: up to 60 points
  const titleScore = Math.round(titleResult.score * 60);

  // Artist: up to 30 points
  const artistScore = Math.round(artistResult.score * 30);

  // Album: up to 10 points
  let albumScore = 0;
  if (wanted.album && candidate.album) {
    if (isAlbumMatch(wanted.album, candidate.album)) {
      albumScore = 10;
    } else {
      albumScore = -5;
    }
  } else {
    albumScore = 5; // Neutral
  }

  // DJ Mix / Compilation penalty if user didn't ask for a mix
  let penalty = 0;
  const candLower = `${candidate.title} ${candidate.album || ""}`.toLowerCase();
  const wantedLower = `${wanted.title} ${wanted.album || ""}`.toLowerCase();
  if (
    /(\bdj mix\b|compilation|karaoke|tribute|cover band|tribute band)/i.test(candLower) &&
    !/(\bdj mix\b|compilation|karaoke|tribute)/i.test(wantedLower)
  ) {
    penalty = -25;
  }

  const totalScore = Math.max(0, titleScore + artistScore + albumScore + penalty);
  // High confidence cutoff: 75/100
  const isMatch = totalScore >= 75;

  return {
    isMatch,
    score: totalScore,
    titleScore,
    artistScore,
    albumScore,
    reason: isMatch ? "matched" : "score-below-threshold",
  };
}
