/**
 * Related tracks fetcher using the YouTube Music InnerTube API (v1/next).
 * Reuses logic and constants from youtubeMusicSearch.ts for consistency.
 */

import { MusicVideo } from "node-youtube-music";

const YT_MUSIC_KEY = "AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30";
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

/**
 * Parsing logic adapted from youtubeMusicSearch.ts
 */
function parseArtistRuns(runs: any[]): { name: string; id?: string }[] {
  if (!runs?.length) return [];
  const out: { name: string; id?: string }[] = [];
  for (const run of runs) {
    const text = run.text?.trim();
    if (!text || text === "•" || text === "&" || /^\d{1,2}:\d{2}$/.test(text)) continue;
    out.push({ name: text });
  }
  return out;
}

function parseMusicVideo(row: any): MusicVideo | null {
  const listItem = row.musicResponsiveListItemRenderer;
  if (!listItem) return null;

  const flexColumns = listItem.flexColumns || [];
  
  // Title and ID usually in first flex column
  const col0 = flexColumns[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
  let title = "";
  let youtubeId = "";
  for (const run of col0) {
    if (run.navigationEndpoint?.watchEndpoint?.videoId) {
      youtubeId = run.navigationEndpoint.watchEndpoint.videoId;
      title = run.text?.trim() || title;
    }
  }

  if (!youtubeId || !title) return null;

  // Artists in second flex column
  const col1 = flexColumns[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
  const artists = parseArtistRuns(col1);

  // Thumbnail
  const thumbnails = listItem.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
  const thumbnailUrl = thumbnails[thumbnails.length - 1]?.url;

  return {
    youtubeId,
    title,
    artists: artists.length ? artists : undefined,
    thumbnailUrl,
  };
}

export async function getRelatedTracksRobust(videoId: string): Promise<MusicVideo[]> {
  const res = await fetch(
    `https://music.youtube.com/youtubei/v1/next?alt=json&key=${YT_MUSIC_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Origin: "https://music.youtube.com",
      },
      body: JSON.stringify({
        ...INNER_TUBE_BODY,
        enablePersistentPlaylistPanel: true,
        isAudioOnly: true,
        params: "mgMDCNgE",
        playerParams: "igMDCNgE",
        playlistId: `RDAMVM${videoId}`,
        videoId: videoId,
      }),
    }
  );

  if (!res.ok) return [];

  const data = await res.json();
  const suggestions: MusicVideo[] = [];

  try {
    // Navigate Through InnerTube Response
    // path: contents -> singleColumnMusicWatchNextResultsRenderer -> tabbedRenderer -> watchNextTabbedResultsRenderer -> tabs[0] -> tabRenderer -> content -> nextContinuationData ...
    // Actually, usually it's in contents.singleColumnMusicWatchNextResultsRenderer.tabbedRenderer.watchNextTabbedResultsRenderer.tabs[0].tabRenderer.content.musicQueueRenderer.contents
    
    const results = data.contents?.singleColumnMusicWatchNextResultsRenderer?.tabbedRenderer?.watchNextTabbedResultsRenderer;
    const tabs = results?.tabs || [];
    const contents = tabs[0]?.tabRenderer?.content?.musicQueueRenderer?.contents || [];

    for (const item of contents) {
      const parsed = parseMusicVideo(item);
      if (parsed && parsed.youtubeId !== videoId) {
        suggestions.push(parsed);
      }
    }
  } catch (err) {
    console.error("[getRelatedTracksRobust] Parsing failed:", err);
  }

  return suggestions;
}
