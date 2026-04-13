/**
 * Heuristic: YouTube Music / recommendations often only expose a title + video id.
 * Widescreen thumbnails should be used when the title clearly refers to a music video.
 */
export function titleSuggestsMusicVideo(title: string | undefined | null): boolean {
  if (!title?.trim()) return false;
  return (
    /\bofficial\s+music\s+video\b/i.test(title) ||
    /\bmusic\s+video\b/i.test(title) ||
    /\bofficial\s+video\b/i.test(title) ||
    /\(official\s+video\)/i.test(title) ||
    /\(official\s+music\s+video\)/i.test(title) ||
    /\(video\)/i.test(title) ||
    /\[[\s]*mv[\s]*\]/i.test(title) ||
    /\([\s]*mv[\s]*\)/i.test(title) ||
    /\bm\/v\b/i.test(title) ||
    /\bvideoclip\b/i.test(title)
  );
}
