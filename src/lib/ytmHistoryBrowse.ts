import type { YouTubeTrack } from "@/lib/youtubeData";
import { getYTMusic } from "@/lib/ytmClient";

function collectMusicResponsiveRenderers(root: unknown): any[] {
  const acc: any[] = [];
  const walk = (o: unknown) => {
    if (!o || typeof o !== "object") return;
    if (Array.isArray(o)) {
      for (const x of o) walk(x);
      return;
    }
    const rec = o as Record<string, unknown>;
    if (rec.musicResponsiveListItemRenderer && typeof rec.musicResponsiveListItemRenderer === "object") {
      acc.push(rec.musicResponsiveListItemRenderer);
    }
    for (const v of Object.values(rec)) walk(v);
  };
  walk(root);
  return acc;
}

function readRunsText(runs: unknown): string {
  if (!Array.isArray(runs)) return "";
  return runs
    .map((x: any) => (typeof x?.text === "string" ? x.text : ""))
    .join("")
    .trim();
}

function parseDurationLabel(durationText: string): string {
  if (!durationText) return "0:00";
  const parts = durationText.split(":").map((p) => p.trim());
  if (parts.every((p) => /^\d+$/.test(p))) {
    if (parts.length === 2) return `${parts[0]}:${parts[1].padStart(2, "0")}`;
    if (parts.length === 3) {
      const [h, m, s] = parts;
      return `${Number(h)}:${m.padStart(2, "0")}:${s.padStart(2, "0")}`;
    }
  }
  return durationText;
}

/**
 * Parse InnerTube history row (same general shape as playlist items).
 */
function parseHistoryRenderer(item: any): YouTubeTrack | null {
  const flex = item?.flexColumns;
  const flatRuns: any[] = [];
  if (Array.isArray(flex)) {
    for (const col of flex) {
      const runs = col?.musicResponsiveListItemFlexColumnRenderer?.text?.runs;
      if (Array.isArray(runs)) flatRuns.push(...runs);
    }
  }
  const fixedCols = item?.fixedColumns;
  let durationText = "";
  if (Array.isArray(fixedCols)) {
    for (const col of fixedCols) {
      const runs = col?.musicResponsiveListItemFlexColumnRenderer?.text?.runs;
      const t = readRunsText(runs);
      if (t?.includes(":")) durationText = t;
    }
  }

  const titleRun = flatRuns.find((r) => r?.navigationEndpoint?.watchEndpoint?.videoId);
  const videoIdFromTitle =
    titleRun?.navigationEndpoint?.watchEndpoint?.videoId ||
    item?.playNavigationEndpoint?.watchEndpoint?.videoId ||
    item?.playNavigationEndpoint?.videoId ||
    item?.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint
      ?.watchEndpoint?.videoId;

  const thumbs = item?.thumbnail?.thumbnails;
  const thumbUrl = Array.isArray(thumbs) ? thumbs[thumbs.length - 1]?.url || "" : "";

  let videoId = videoIdFromTitle as string | undefined;
  if (!videoId && thumbUrl) {
    const m = thumbUrl.match(/\/vi\/([^/]+)\//);
    if (m) videoId = m[1];
  }
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return null;

  const title = typeof titleRun?.text === "string" ? titleRun.text : readRunsText(flatRuns) || "Unknown";
  const artistRun = flatRuns.find((r) => r?.navigationEndpoint?.browseEndpoint?.browseId);
  const artist =
    (typeof artistRun?.text === "string" ? artistRun.text : "").replace(/\s*-\s*Topic$/i, "") ||
    "Unknown Artist";

  return {
    id: videoId,
    videoId,
    title,
    artist,
    thumbnailUrl: thumbUrl,
    duration: durationText ? parseDurationLabel(durationText) : "0:00",
  };
}

/**
 * YouTube Music library "History" (browseId FEmusic_history) via InnerTube.
 * Requires the same cookie auth as {@link getYTMusic} (optional `YTM_COOKIE` env).
 * Without a logged-in cookie, this usually returns an empty list.
 */
export async function fetchYTMusicBrowseHistory(): Promise<YouTubeTrack[]> {
  const ytm = await getYTMusic();
  const raw = await (ytm as any).constructRequest("browse", { browseId: "FEmusic_history" });
  const renderers = collectMusicResponsiveRenderers(raw);
  const out: YouTubeTrack[] = [];
  const seen = new Set<string>();
  for (const r of renderers) {
    const row = parseHistoryRenderer(r);
    if (!row || seen.has(row.videoId)) continue;
    seen.add(row.videoId);
    out.push(row);
  }
  return out;
}
