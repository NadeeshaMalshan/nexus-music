import { isArtistMatch } from "./canvas/matching";

/**
 * Checks if a string is a YouTube Channel ID (e.g. "UCzVb0SIXp9q9PeKCcFjsBtA").
 */
export function isYouTubeChannelId(str: string): boolean {
  return typeof str === "string" && /^UC[a-zA-Z0-9_-]{22}$/.test(str.trim());
}

/**
 * Collaboration split delimiter regular expression.
 * Handles: ", ", " & ", " feat. ", " ft. ", " with ", " / ", " x ", " vs "
 */
export const COLLAB_SPLIT_REGEX = /(\s*,\s*|\s+&\s+|\s+feat\.?\s+|\s+ft\.?\s+|\s+with\s+|\s+\/\s+|\s+[xX]\s+|\s+vs\.?\s+)/i;

/**
 * Extracts the clean primary artist name from raw metadata strings.
 * e.g. "Olivia Rodrigo, Dan Nigro" -> "Olivia Rodrigo"
 * e.g. "Lady Gaga & Bruno Mars" -> "Lady Gaga"
 * e.g. "The Weeknd (feat. Daft Punk)" -> "The Weeknd"
 * e.g. "Dua Lipa - Topic" -> "Dua Lipa"
 */
export function extractPrimaryArtist(rawName: string): { primary: string; cleanedFull: string } {
  if (!rawName) return { primary: "", cleanedFull: "" };

  let cleaned = rawName
    .replace(/\s*-\s*Topic$/i, "")
    .replace(/\s*VEVO$/i, "")
    .replace(/\s*Official\s*(?:Channel|Music|Video)?$/i, "")
    .replace(/\s*\[.*?\]/g, "")
    .trim();

  // Strip parenthetical features: (feat. ...), (with ...), (ft. ...)
  cleaned = cleaned.replace(/\s*\((?:feat\.?|ft\.?|with|featuring).*?\)/gi, "").trim();

  // Strip leading or trailing brackets / quotes / parentheses
  cleaned = cleaned.replace(/^[([{'"]+/, "").replace(/[)\]}'",]+$/, "").trim();

  // Split on collaborative delimiters
  const splitParts = cleaned.split(COLLAB_SPLIT_REGEX);
  let primary = splitParts[0]?.trim() || cleaned;

  primary = primary.replace(/^[([{'"]+/, "").replace(/[)\]}'",]+$/, "").trim();

  return { primary: primary || cleaned, cleanedFull: cleaned };
}

function normalizePopSymbols(str: string): string {
  return str
    .replace(/!/g, "i")
    .replace(/\$/g, "s")
    .replace(/@/g, "a")
    .replace(/\+/g, "t");
}

/**
 * Scores a YouTube Music artist candidate against the target query.
 * Returns a score between 0 and 100.
 */
export function scoreArtistCandidate(candidateName: string, targetName: string): number {
  if (!candidateName || !targetName) return 0;

  const c = candidateName.toLowerCase().trim();
  const t = targetName.toLowerCase().trim();

  // 1. Exact match (case-insensitive)
  if (c === t) return 100;

  // 2. Pop symbol normalization (e.g. P!nk vs Pink, Ke$ha vs Kesha)
  const cPop = normalizePopSymbols(c).replace(/[^a-z0-9]/g, "");
  const tPop = normalizePopSymbols(t).replace(/[^a-z0-9]/g, "");
  if (cPop === tPop && cPop.length > 0) return 98;

  // 3. Alphanumeric match (ignores symbols like P!nk vs Pink)
  const cClean = c.replace(/[^a-z0-9]/g, "");
  const tClean = t.replace(/[^a-z0-9]/g, "");
  if (cClean === tClean && cClean.length > 0) return 96;

  // 3. Strict artist match using phonetic / surname / Levenshtein
  const match = isArtistMatch(t, c);
  if (match.isMatch && match.score >= 0.85) {
    return Math.round(match.score * 95);
  }

  // 4. Exact word tokens equality
  const cWords = c.split(/\s+/).filter(Boolean);
  const tWords = t.split(/\s+/).filter(Boolean);
  if (cWords.length === tWords.length && cWords.every((w, i) => w === tWords[i])) {
    return 95;
  }

  // 5. Multi-word partial match
  if (tWords.length > 1 && cWords.length > 1) {
    if (match.isMatch && match.score >= 0.70) {
      return Math.round(match.score * 80);
    }
  }

  // 6. If target is a single word and candidate starts with that exact word
  // e.g. target "Dean" vs candidate "Dean Lewis" -> 40 (prefer single-word "DEAN" if available)
  if (tWords.length === 1 && cWords.length > 1 && cWords[0] === tWords[0]) {
    return 40;
  }

  return 0;
}
