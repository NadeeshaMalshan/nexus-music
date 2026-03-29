import type { MusicVideo } from "node-youtube-music";

const YT_MUSIC_KEY = "AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30";
const SONGS_PARAMS = "EgWKAQIIAWoKEAoQCRADEAQQBQ%3D%3D";
const VIDEOS_PARAMS = "EgWKAQIQAWoKEAkQAxAEEAUQCw%3D%3D";

const WEB_REMIX_CLIENT_VERSION = process.env.YOUTUBE_MUSIC_CLIENT_VERSION ?? "1.20260324.11.00";

const INNER_TUBE_BODY = {
  context: {
    capabilities: {},
    client: {
      clientName: "WEB_REMIX",
      clientVersion: WEB_REMIX_CLIENT_VERSION,
      hl: "en",
      gl: "US",
    },
  },
};

function parseDurationLabel(label: string | undefined): MusicVideo["duration"] {
  if (!label?.trim()) return undefined;
  const parts = label.split(":");
  let totalSeconds = 0;
  if (parts.length === 3) {
    totalSeconds = parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10);
  } else if (parts.length === 2) {
    totalSeconds = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  } else {
    return { label: label.trim(), totalSeconds: 0 };
  }
  return { label: label.trim(), totalSeconds };
}

function parseArtistRuns(runs: any[] | undefined): { name: string; id?: string }[] {
  if (!runs?.length) return [];
  const out: { name: string; id?: string }[] = [];
  for (const run of runs) {
    const text = run.text?.trim();
    if (!text || text === "•" || text === "&") continue;
    if (/^\d{1,2}:\d{2}$/.test(text)) continue;
    const ne = run.navigationEndpoint as any;
    const pageType = ne?.browseEndpoint?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType;
    if (pageType === "MUSIC_PAGE_TYPE_ARTIST" && ne?.browseEndpoint?.browseId) {
      out.push({ name: text, id: ne.browseEndpoint.browseId });
    }
  }
  if (out.length > 0) return out;
  const bulletIdx = runs.findIndex((r) => r.text?.trim() === "•");
  const slice = bulletIdx === -1 ? runs : runs.slice(0, bulletIdx);
  for (const run of slice) {
    const text = run.text?.trim();
    if (!text || text === "&") continue;
    if (/^\d{1,2}:\d{2}$/.test(text)) continue;
    out.push({ name: text });
  }
  return out;
}

function findVideoIdAndTitle(row: any): { youtubeId: string; title: string } | null {
  const flex0 = row.flexColumns;
  const runs0 = flex0?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs;
  if (!runs0?.length) return null;
  let fallbackTitle: string | undefined;
  for (const run of runs0) {
    const vid = run.navigationEndpoint?.watchEndpoint?.videoId?.trim();
    if (vid) {
      return { youtubeId: vid, title: run.text?.trim() || fallbackTitle || "Unknown Track" };
    }
    if (run.text?.trim()) fallbackTitle = run.text.trim();
  }
  return null;
}

function parseSongRow(item: any): MusicVideo | null {
  const row = item.musicResponsiveListItemRenderer;
  if (!row) return null;
  const idTitle = findVideoIdAndTitle(row);
  if (!idTitle) return null;
  const { youtubeId, title } = idTitle;
  const flex1 = row.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer;
  const runs1 = flex1?.text?.runs;
  const artists = parseArtistRuns(runs1);
  let durationLabel: string | undefined;
  if (runs1?.length) {
    const last = runs1[runs1.length - 1];
    const t = typeof last?.text === "string" ? last.text.trim() : "";
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(t)) durationLabel = t;
  }
  const thumb = row.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails;
  const thumbnailUrl = thumb?.[thumb.length - 1]?.url;
  return {
    youtubeId,
    title: title.trim(),
    artists: artists.length ? artists : undefined,
    thumbnailUrl,
    duration: parseDurationLabel(durationLabel),
  };
}

function walkSectionList(sections: any[] | undefined, out: MusicVideo[]): void {
  if (!Array.isArray(sections)) return;
  for (const section of sections) {
    const shelf = section.musicShelfRenderer;
    if (shelf?.contents) {
      for (const item of shelf.contents) {
        const parsed = parseSongRow(item);
        if (parsed) out.push(parsed);
      }
    }
    const carousel = section.musicCarouselShelfRenderer;
    if (carousel?.contents) {
      for (const item of carousel.contents) {
        const parsed = parseSongRow(item);
        if (parsed) out.push(parsed);
      }
    }
  }
}

function collectSongRowsFromPayload(data: any): MusicVideo[] {
  const tabbed = data.contents?.tabbedSearchResultsRenderer;
  const tabs = tabbed?.tabs;
  if (!Array.isArray(tabs)) return [];
  const out: MusicVideo[] = [];
  for (const tab of tabs) {
    const content = tab.tabRenderer?.content ?? tab.expandableTabRenderer?.content;
    walkSectionList(content?.sectionListRenderer?.contents, out);
  }
  return out;
}

async function tubeSearch(query: string, params: string): Promise<MusicVideo[]> {
  const res = await fetch(`https://music.youtube.com/youtubei/v1/search?alt=json&key=${YT_MUSIC_KEY}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      Origin: "https://music.youtube.com",
    },
    body: JSON.stringify({ ...INNER_TUBE_BODY, params, query }),
  });
  if (!res.ok) return [];
  try {
    const data = await res.json();
    if (data?.error) return [];
    return collectSongRowsFromPayload(data);
  } catch {
    return [];
  }
}

export async function searchSongsRobust(query: string): Promise<MusicVideo[]> {
  return tubeSearch(query, SONGS_PARAMS);
}

export async function searchVideosRobust(query: string): Promise<MusicVideo[]> {
  return tubeSearch(query, VIDEOS_PARAMS);
}
