import type { YouTubeTrack } from "@/lib/youtubeData";

/**
 * De-dupe by videoId, preserve order (e.g. channel activity + liked).
 */
export function appendUniqueTaste(
  base: YouTubeTrack[],
  more: YouTubeTrack[]
): YouTubeTrack[] {
  const seen = new Set(base.map((t) => t.videoId).filter(Boolean));
  const out = [...base];
  for (const t of more) {
    if (!t.videoId || seen.has(t.videoId)) continue;
    seen.add(t.videoId);
    out.push(t);
  }
  return out;
}
