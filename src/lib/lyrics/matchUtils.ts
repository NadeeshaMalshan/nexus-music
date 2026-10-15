/**
 * Utilities for fuzzy matching and validating lyric titles, artists, and durations.
 * Prevents providers from returning lyrics for the wrong song (e.g. returning
 * "you broke me first" when playing "run for the hills", or "Stay With Me" when playing "Stay").
 */

const KNOWN_DESCRIPTORS_REGEX =
  /\b(official\s+video|official\s+music\s+video|music\s+video|official\s+audio|audio(\s+video)?|lyric\s+video|lyrics\s+video|lyrical\s+video|lyrics|visualizer|official\s+visualizer|hd|4k(\s+uhd)?|8k|1080p|full\s+(song|video|audio)|video\s+song|audio\s+song|new\s+sinhala\s+song|sinhala\s+song|sinhala\s+new\s+song|new\s+song|latest\s+song|new\s+hindi\s+song|hindi\s+song|coke\s*studio.*|coke\s*red.*|live\s+performance|live\s+session|live|acoustic|remix|slowed\s*\+\s*reverb|slowed|sped\s+up|deluxe|bonus\s+track|bonus|cover|tribute|karaoke|instrumental|mv|m\/v|teaser|trailer|promo|exclusive)\b/gi;

const KNOWN_PUBLISHER_CHANNELS_REGEX =
  /^(m\s*entertainments?|maharaja\s*entertainments?|torana(\s*(video|music))?|t[\s-]*series.*|sony\s*music.*|zee\s*music.*|speed\s*records.*|tips\s*(official|music)?|saregama.*|yrf|yash\s*raj\s*films|coke\s*studio.*|coke\s*red.*|desi\s*music\s*factory|aditya\s*music.*|lahari\s*music.*|geet\s*mp3|white\s*hill\s*music|ultra\s*(music|bollywood)?|spinnin'?\s*records.*|unknown\s*artist|unknown|various\s*artists|youtube\s*music)$/i;

/**
 * Returns true if an artist name looks like a YouTube channel, record label, or distributor
 * rather than an individual musician/artist.
 */
export function isChannelOrPublisher(artist?: string | null): boolean {
  if (!artist) return true;
  const cleaned = artist.trim().toLowerCase();
  if (!cleaned) return true;
  if (KNOWN_PUBLISHER_CHANNELS_REGEX.test(cleaned)) return true;
  // Generic channel suffix check (e.g. "... Records", "... Entertainment", "... Music Channel")
  if (
    /\b(entertainments?|records|music\s+(channel|company|group)|official\s+channel|media\s+network|audio\s+channel)\b/i.test(
      cleaned
    )
  ) {
    return true;
  }
  return false;
}

/**
 * Returns true if a text segment is just YouTube noise/metadata rather than a song or artist name.
 */
export function isNoiseText(text: string): boolean {
  if (!text || !text.trim()) return true;
  const cleaned = text.trim().toLowerCase();
  if (cleaned.length <= 1) return true;

  // Exact noise phrases
  if (
    /^(official\s+(music\s+)?video|official\s+audio|audio(\s+video)?|lyric(s)?\s+video|lyrical\s+video|visualizer|audio|4k(\s+uhd)?|hd|8k|1080p|mv|m\/v|live|cover|remix|full\s+(song|video|audio)|video\s+song|audio\s+song|(new|latest)\s+(sinhala|hindi|punjabi|tamil)?\s*song\s*\d*|coke\s*studio.*|coke\s*red.*)$/i.test(
      cleaned
    )
  ) {
    return true;
  }

  // Check if string consists almost entirely of noise keywords and punctuation/numbers
  const withoutNoise = cleaned
    .replace(KNOWN_DESCRIPTORS_REGEX, "")
    .replace(/\b(20\d{2})\b/g, "")
    .replace(/[\s\-|:/\\]+/g, "")
    .trim();
  return withoutNoise.length === 0;
}

export function normalizeSongTitle(title: string): string {
  if (!title) return "";
  let cleaned = title.toLowerCase();

  // If title has pipe separators, extract first substantive segment
  if (cleaned.includes("|")) {
    const parts = cleaned
      .split(/\s*\|\s*/)
      .map((p) => p.trim())
      .filter(Boolean);
    const substantive = parts.filter((p) => !isNoiseText(p));
    if (substantive.length > 0) {
      cleaned = substantive[0];
    }
  }

  // Remove bracketed non-Latin Indic/Sinhala script only if Latin text is present
  if (/[a-zA-Z]/.test(cleaned)) {
    cleaned = cleaned.replace(/\s*[\(\[][\u0900-\u0DFF\s]+[\)\]]/g, "");
  }

  return cleaned
    // 1. Remove bracketed noise: (Official Music Video), [4K], etc.
    .replace(
      /\s*[\(\[][^)]*?(official|music|video|audio|lyric|visualizer|remaster|edit|version|feat|ft|with|clip|cover|tribute|karaoke|instrumental|hd|4k|mv|m\/v|live|sped up|slowed|deluxe|bonus)[^)]*?[\)\]]/gi,
      ""
    )
    // 2. Remove known trailing descriptors after hyphen
    .replace(
      /\s*-\s*(live|acoustic|instrumental|remix|edit|deluxe|bonus|sped up|slowed|mono|stereo|radio edit|official audio|official video|lyric video).*$/gi,
      ""
    )
    .replace(/['’]/g, "") // "don't" -> "dont", "it's" -> "its"
    .replace(/[^\p{L}\p{N}\s]/gu, " ") // replace punctuation with spaces, Unicode-safe
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeArtistName(artist: string): string {
  if (!artist) return "";
  return artist
    .toLowerCase()
    .replace(/\s*-\s*topic$/i, "")
    .replace(/\s*vevo$/i, "")
    .replace(/\s*official\s*(channel)?$/i, "")
    .replace(/\s*music$/i, "")
    .replace(/\s*channel$/i, "")
    .replace(/\s*records$/i, "")
    .replace(/['’]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Returns true if candidateTitle is a genuine match for expectedTrack.
 */
export function isTitleMatch(expectedTrack: string, candidateTitle?: string | null): boolean {
  if (!expectedTrack || !candidateTitle) return false;

  const expected = normalizeSongTitle(expectedTrack);
  const candidate = normalizeSongTitle(candidateTitle);

  if (!expected || !candidate) return false;

  // 1. Exact normalized match
  if (expected === candidate) return true;

  // 2. Handle "Artist - Song" or "Song - Subtitle" candidates
  if (candidateTitle.includes(" - ")) {
    const parts = candidateTitle.split(/\s+-\s+/);
    for (const part of parts) {
      const normPart = normalizeSongTitle(part);
      if (normPart === expected || isTitleMatch(expectedTrack, normPart)) {
        return true;
      }
    }
  }

  // 3. Check for legitimate version differences (e.g. "Song (Live)" vs "Song")
  // Candidate starts with expected followed strictly by a descriptor or end-of-string
  if (candidate.startsWith(expected)) {
    const remainder = candidate.slice(expected.length).trim();
    if (!remainder) return true;
    if (
      /^(live|acoustic|remix|edit|version|deluxe|sped up|slowed|instrumental|radio edit|cover|rework|mix)\b/i.test(
        remainder
      )
    ) {
      return true;
    }
  }

  if (expected.startsWith(candidate)) {
    const remainder = expected.slice(candidate.length).trim();
    if (!remainder) return true;
    if (
      /^(live|acoustic|remix|edit|version|deluxe|sped up|slowed|instrumental|radio edit|cover|rework|mix)\b/i.test(
        remainder
      )
    ) {
      return true;
    }
  }

  // 4. Word token overlap (Dice similarity on substantive tokens)
  const wordsExp = expected.split(" ").filter((w) => w.length > 1);
  const wordsCand = candidate.split(" ").filter((w) => w.length > 1);

  if (wordsExp.length === 0 || wordsCand.length === 0) {
    return false;
  }

  // If one of the titles is very short (1-2 words), require exact match or exact word subset
  if (wordsExp.length <= 2 || wordsCand.length <= 2) {
    if (wordsExp.length === wordsCand.length) {
      return wordsExp.every((w, i) => w === wordsCand[i]);
    }
    return false;
  }

  // Count shared words
  const shared = wordsExp.filter((w) => wordsCand.includes(w));
  const dice = (2 * shared.length) / (wordsExp.length + wordsCand.length);

  // If at least 65% of words overlap and length difference isn't extreme
  const lengthRatio = Math.min(expected.length, candidate.length) / Math.max(expected.length, candidate.length);
  if (dice >= 0.65 && lengthRatio >= 0.6) {
    return true;
  }

  return false;
}

/**
 * Checks if candidateArtist matches expectedArtist.
 */
export function isArtistMatch(expectedArtist?: string | null, candidateArtist?: string | null): boolean {
  if (!expectedArtist || !candidateArtist) return true;
  const a1 = normalizeArtistName(expectedArtist);
  const a2 = normalizeArtistName(candidateArtist);
  if (!a1 || !a2) return true;
  if (a1 === a2) return true;
  if (a1.includes(a2) || a2.includes(a1)) return true;

  // Split multiple artists (e.g. "Yohani & Chamath", "Ed Sheeran ft. Justin Bieber")
  const splitA1 = a1.split(/\s*(?:&|,|\bfeat\.?\b|\bft\.?\b|\bwith\b|\band\b)\s*/i).filter(Boolean);
  const splitA2 = a2.split(/\s*(?:&|,|\bfeat\.?\b|\bft\.?\b|\bwith\b|\band\b)\s*/i).filter(Boolean);

  for (const part1 of splitA1) {
    for (const part2 of splitA2) {
      if (part1 === part2 || part1.includes(part2) || part2.includes(part1)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Checks if candidateDuration is within acceptable tolerance of expectedDuration.
 */
export function isDurationMatch(
  expectedSec?: number | null,
  candidateSec?: number | null,
  toleranceSec = 22
): boolean {
  if (!expectedSec || !candidateSec || expectedSec <= 0 || candidateSec <= 0) {
    return true; // Don't reject if duration is missing
  }
  return Math.abs(expectedSec - candidateSec) <= toleranceSec;
}

/**
 * Scores how closely candidateTitle matches expectedTrack (0.0 to 1.0).
 */
export function scoreTitleMatch(expectedTrack: string, candidateTitle?: string | null): number {
  if (!expectedTrack || !candidateTitle) return 0;

  const expected = normalizeSongTitle(expectedTrack);
  const candidate = normalizeSongTitle(candidateTitle);

  if (!expected || !candidate) return 0;
  if (expected === candidate) return 1.0;

  if (candidate.startsWith(expected) || expected.startsWith(candidate)) {
    return 0.9;
  }

  const wordsExp = expected.split(" ").filter((w) => w.length > 1);
  const wordsCand = candidate.split(" ").filter((w) => w.length > 1);

  if (wordsExp.length === 0 || wordsCand.length === 0) return 0;

  const shared = wordsExp.filter((w) => wordsCand.includes(w));
  return (2 * shared.length) / (wordsExp.length + wordsCand.length);
}
