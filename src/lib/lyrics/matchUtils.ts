/**
 * Utilities for fuzzy matching and validating lyric titles against search queries.
 * Prevents providers from returning lyrics for the wrong song (e.g. returning
 * "you broke me first" when playing "run for the hills").
 */

export function normalizeSongTitle(title: string): string {
  if (!title) return "";
  return title
    .toLowerCase()
    .replace(/\s*[\(\[][^)]*?(official|music|video|audio|lyric|visualizer|remaster|edit|version|feat|ft|with|clip|cover|tribute|karaoke|instrumental|hd|4k|mv|m\/v|live|sped up|slowed|deluxe|bonus)[^)]*?[\)\]]/gi, "")
    .replace(/\s*-\s*(live|acoustic|instrumental|remix|edit|deluxe|bonus|sped up|slowed|mono|stereo|radio edit).*$/gi, "") // only remove after hyphen if it is a known descriptor
    .replace(/['’]/g, "") // "don't" -> "dont", "it's" -> "its"
    .replace(/[^\p{L}\p{N}\s]/gu, " ") // replace punctuation with spaces, Unicode-safe
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

  // 3. Substring match with length ratio check
  if (candidate.includes(expected) || expected.includes(candidate)) {
    const minLen = Math.min(expected.length, candidate.length);
    const maxLen = Math.max(expected.length, candidate.length);
    // If one is inside the other and length ratio is at least 40% (or candidate starts with expected)
    if (minLen / maxLen >= 0.4 || candidate.startsWith(expected) || expected.startsWith(candidate)) {
      return true;
    }
  }

  // 4. Word token overlap (Jaccard similarity)
  const wordsExp = expected.split(" ").filter((w) => w.length > 1);
  const wordsCand = candidate.split(" ").filter((w) => w.length > 1);

  if (wordsExp.length === 0 || wordsCand.length === 0) {
    return false;
  }

  // Count shared words
  const shared = wordsExp.filter((w) => wordsCand.includes(w));
  const dice = (2 * shared.length) / (wordsExp.length + wordsCand.length);

  // If at least 60% of words overlap, or all expected words are in candidate
  const allExpInCand = wordsExp.every((w) => wordsCand.includes(w));
  if (allExpInCand || dice >= 0.6) {
    return true;
  }

  return false;
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

  if (candidate.includes(expected) || expected.includes(candidate)) {
    return 0.8;
  }

  const wordsExp = expected.split(" ").filter((w) => w.length > 1);
  const wordsCand = candidate.split(" ").filter((w) => w.length > 1);

  if (wordsExp.length === 0 || wordsCand.length === 0) return 0;

  const shared = wordsExp.filter((w) => wordsCand.includes(w));
  return (2 * shared.length) / (wordsExp.length + wordsCand.length);
}
