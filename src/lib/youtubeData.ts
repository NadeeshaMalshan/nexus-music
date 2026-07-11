import { assertNotYouTubeQuotaError } from "@/lib/youtubeApiErrors";

export interface YouTubePlaylist {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  itemCount: number;
}

export interface YouTubeTrack {
  id: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  videoId: string;
  duration?: string;
}

export async function fetchUserPlaylists(accessToken: string): Promise<YouTubePlaylist[]> {
  const out: YouTubePlaylist[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < 10; page++) {
    const url = new URL("https://www.googleapis.com/youtube/v3/playlists");
    url.searchParams.set("part", "snippet,contentDetails");
    url.searchParams.set("mine", "true");
    url.searchParams.set("maxResults", "50");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      assertNotYouTubeQuotaError(response, errorData);
      console.error("YouTube API error:", errorData);
      throw new Error("Failed to fetch YouTube playlists");
    }

    const data = await response.json();
    const items = data.items || [];

    for (const item of items) {
      const sn = item.snippet;
      if (!item.id || !sn) continue;
      out.push({
        id: item.id,
        title: sn.title || "Untitled playlist",
        description: sn.description || "",
        thumbnailUrl:
          sn.thumbnails?.maxres?.url ||
          sn.thumbnails?.standard?.url ||
          sn.thumbnails?.high?.url ||
          sn.thumbnails?.default?.url ||
          "",
        itemCount: item.contentDetails?.itemCount ?? 0,
      });
    }

    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  return out;
}

/**
 * Official "Liked videos" playlist id for the signed-in channel (often `LL`, but use API when possible).
 */
export async function getLikesPlaylistId(accessToken: string): Promise<string> {
  const res = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) {
    const text = await res.text();
    let body: unknown = {};
    try {
      body = JSON.parse(text);
    } catch {
      /* non-JSON error body */
    }
    assertNotYouTubeQuotaError(res, body);
    console.warn("[youtube] channels.list mine failed", text);
    return "LL";
  }
  const data = await res.json();
  const id = data.items?.[0]?.contentDetails?.relatedPlaylists?.likes;
  return typeof id === "string" && id.length > 0 ? id : "LL";
}

export async function fetchPlaylistItems(accessToken: string, playlistId: string, musicOnly = false): Promise<YouTubeTrack[]> {
  const allPlaylistRows: any[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < 20; page++) {
    const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
    url.searchParams.set("part", "snippet,contentDetails");
    url.searchParams.set("playlistId", playlistId);
    url.searchParams.set("maxResults", "50");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      assertNotYouTubeQuotaError(response, errorData);
      console.error("YouTube API Items error:", errorData);
      throw new Error("Failed to fetch YouTube playlist items");
    }

    const data = await response.json();
    const batch = data.items || [];
    allPlaylistRows.push(...batch);
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  if (allPlaylistRows.length === 0) return [];

  const videoIds = allPlaylistRows.map((item: any) => item.contentDetails?.videoId).filter(Boolean);
  if (videoIds.length === 0) return [];

  const durationMap: Record<string, string> = {};
  const metadataMap: Record<string, any> = {};

  for (let i = 0; i < videoIds.length; i += 50) {
    const chunk = videoIds.slice(i, i + 50).join(",");
    const videosResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet&id=${chunk}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!videosResponse.ok) {
      const errorData = await videosResponse.json().catch(() => ({}));
      assertNotYouTubeQuotaError(videosResponse, errorData);
      continue;
    }
    const videosData = await videosResponse.json();
    videosData.items?.forEach((video: any) => {
      durationMap[video.id] = parseISO8601Duration(video.contentDetails?.duration);
      metadataMap[video.id] = video.snippet;
    });
  }

  const mapped = allPlaylistRows.map((item: any): YouTubeTrack | null => {
    const vId = item.contentDetails?.videoId;
    if (!vId) return null;
    const moreInfo = metadataMap[vId];
    const thumb =
      item.snippet?.thumbnails?.maxres?.url ||
      moreInfo?.thumbnails?.maxres?.url ||
      item.snippet?.thumbnails?.standard?.url ||
      moreInfo?.thumbnails?.standard?.url ||
      item.snippet?.thumbnails?.high?.url ||
      moreInfo?.thumbnails?.high?.url ||
      item.snippet?.thumbnails?.default?.url ||
      "";

    let artist = item.snippet?.videoOwnerChannelTitle || moreInfo?.channelTitle || "Unknown Artist";
    artist = artist.replace(/\s*-\s*Topic$/, "");

    return {
      id: String(item.id ?? ""),
      title: item.snippet?.title || "Unknown",
      artist,
      thumbnailUrl: thumb,
      videoId: vId,
      duration: durationMap[vId] || "0:00",
    };
  });

  const withVideoId = mapped.filter((row): row is YouTubeTrack => row !== null);

  if (!musicOnly) return withVideoId;

  return withVideoId.filter((item) => {
    const snippet = metadataMap[item.videoId];
    if (!snippet) return true;
    return snippet.categoryId === "10";
  });
}

/**
 * Recent channel activities that reference videos, filtered to music category where possible.
 * Note: YouTube does not expose full "watch history" to third-party APIs; this is the closest official feed.
 */
export async function fetchRecentMusicActivities(accessToken: string, max = 40): Promise<YouTubeTrack[]> {
  const actRes = await fetch(
    `https://www.googleapis.com/youtube/v3/activities?part=snippet,contentDetails&mine=true&maxResults=${Math.min(50, max + 15)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!actRes.ok) {
    const text = await actRes.text();
    let body: unknown = {};
    try {
      body = JSON.parse(text);
    } catch {
      /* ignore */
    }
    assertNotYouTubeQuotaError(actRes, body);
    console.error("activities.list failed", text);
    return [];
  }
  const actData = await actRes.json();
  const videoIds = new Set<string>();
  for (const item of actData.items || []) {
    const cd = item.contentDetails;
    if (!cd) continue;
    const v =
      cd.upload?.videoId ||
      cd.playlistItem?.resourceId?.videoId ||
      cd.bulletin?.resourceId?.videoId ||
      cd.social?.resourceId?.videoId ||
      cd.recommendation?.resourceId?.videoId ||
      cd.recommendation?.seedResourceId?.videoId;
    if (v) videoIds.add(v);
  }
  const ids = [...videoIds].slice(0, max);
  if (ids.length === 0) return [];

  const vidRes = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${ids.join(",")}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!vidRes.ok) {
    const text = await vidRes.text();
    let body: unknown = {};
    try {
      body = JSON.parse(text);
    } catch {
      /* ignore */
    }
    assertNotYouTubeQuotaError(vidRes, body);
    return [];
  }
  const vidData = await vidRes.json();
  const items = vidData.items || [];

  const out: YouTubeTrack[] = [];
  const addVideo = (video: any) => {
    const vId = video.id;
    const title = video.snippet?.title || "Unknown";
    const artist = (video.snippet?.channelTitle || "Unknown").replace(/\s*-\s*Topic$/, "");
    const thumb =
      video.snippet?.thumbnails?.high?.url ||
      video.snippet?.thumbnails?.medium?.url ||
      video.snippet?.thumbnails?.default?.url ||
      "";
    out.push({
      id: vId,
      videoId: vId,
      title,
      artist,
      thumbnailUrl: thumb,
      duration: parseISO8601Duration(video.contentDetails?.duration || ""),
    });
  };

  for (const video of items) {
    const catId = video.snippet?.categoryId;
    if (catId && catId !== "10") continue;
    addVideo(video);
  }
  if (out.length === 0) {
    for (const video of items) addVideo(video);
  }
  return out;
}

export async function fetchLikedSongs(accessToken: string): Promise<YouTubeTrack[]> {
  const likesId = await getLikesPlaylistId(accessToken);
  const musicOnly = await fetchPlaylistItems(accessToken, likesId, true);
  if (musicOnly.length > 0) return musicOnly;
  return fetchPlaylistItems(accessToken, likesId, false);
}

export async function rateVideo(accessToken: string, videoId: string, rating: "like" | "none"): Promise<void> {
  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/videos/rate?id=${videoId}&rating=${rating}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    console.error("YouTube Rate error:", errorData);
    throw new Error(`Failed to ${rating} video`);
  }
}

export function parseISO8601Duration(duration: string): string {
  if (!duration) return "0:00";
  const regex = /P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
  const matches = duration.match(regex);
  if (!matches) return "0:00";

  const hours = matches[2] ? parseInt(matches[2]) : 0;
  const minutes = matches[3] ? parseInt(matches[3]) : 0;
  const seconds = matches[4] ? parseInt(matches[4]) : 0;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export async function createPlaylist(accessToken: string, title: string, description = ""): Promise<string> {
  const response = await fetch(
    "https://www.googleapis.com/youtube/v3/playlists?part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        snippet: {
          title,
          description,
        },
        status: {
          privacyStatus: "private",
        },
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    console.error("YouTube Create Playlist error:", errorData);
    throw new Error("Failed to create YouTube playlist");
  }

  const data = await response.json();
  return data.id;
}

export async function addSongToPlaylist(accessToken: string, playlistId: string, videoId: string): Promise<void> {
  const response = await fetch(
    "https://www.googleapis.com/youtube/v3/playlistItems?part=snippet",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        snippet: {
          playlistId,
          resourceId: {
            kind: "youtube#video",
            videoId,
          },
        },
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    console.error("YouTube Add Item error:", errorData);
    throw new Error("Failed to add song to YouTube playlist");
  }
}

/**
 * Batches `videos.list` to attach duration (and best thumbnails) to search/related results.
 */
export async function hydrateYouTubeTrackDetails(accessToken: string, tracks: YouTubeTrack[]): Promise<YouTubeTrack[]> {
  if (tracks.length === 0) return [];
  const ids = tracks.map((t) => t.videoId).filter(Boolean);
  if (ids.length === 0) return tracks;

  const durationMap: Record<string, string> = {};
  const thumbMap: Record<string, string> = {};

  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50).join(",");
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet&id=${chunk}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) continue;
    const data = await res.json().catch(() => null);
    if (!data) continue;
    for (const video of data.items || []) {
      const id = video.id;
      if (!id) continue;
      durationMap[id] = parseISO8601Duration(video.contentDetails?.duration);
      const sn = video.snippet;
      if (sn?.thumbnails) {
        thumbMap[id] =
          sn.thumbnails.maxres?.url ||
          sn.thumbnails.high?.url ||
          sn.thumbnails.default?.url ||
          "";
      }
    }
  }

  return tracks.map((t) => ({
    ...t,
    duration: durationMap[t.videoId] || t.duration || "0:00",
    thumbnailUrl: thumbMap[t.videoId] || t.thumbnailUrl,
  }));
}

/**
 * `search.list` in category Music (10). YouTube Data API only; uses the signed-in user’s quota.
 */
export async function searchYouTubeMusicCategoryVideos(
  accessToken: string,
  query: string,
  maxResults = 12
): Promise<YouTubeTrack[]> {
  const q = query?.trim();
  if (!q) return [];

  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("q", q);
  url.searchParams.set("type", "video");
  url.searchParams.set("videoCategoryId", "10");
  url.searchParams.set("maxResults", String(Math.min(15, maxResults + 3)));

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    assertNotYouTubeQuotaError(response, errorData);
    console.error("YouTube search (music) error:", errorData);
    return [];
  }

  const data = await response.json();
  const items = (data.items || [])
    .filter((item: any) => item.id?.videoId)
    .map((item: any) => ({
      id: item.id.videoId,
      videoId: item.id.videoId,
      title: item.snippet?.title || "Unknown",
      artist: (item.snippet?.channelTitle || "Unknown").replace(/\s*-\s*Topic$/, ""),
      thumbnailUrl:
        item.snippet?.thumbnails?.maxres?.url ||
        item.snippet?.thumbnails?.high?.url ||
        item.snippet?.thumbnails?.default?.url ||
        "",
    })) as YouTubeTrack[];

  const withDuration = await hydrateYouTubeTrackDetails(accessToken, items);
  return withDuration.slice(0, maxResults);
}

export async function fetchRelatedVideos(accessToken: string, videoId: string): Promise<YouTubeTrack[]> {
  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&relatedToVideoId=${videoId}&type=video&maxResults=15&videoCategoryId=10`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error("YouTube Related error:", errorData);
    return [];
  }

  const data = await response.json().catch(() => null);
  if (!data) return [];
  const items = (data.items || [])
    .filter((item: any) => item.id?.videoId)
    .map((item: any) => ({
      id: item.id.videoId,
      title: item.snippet.title,
      artist: item.snippet.channelTitle.replace(/\s*-\s*Topic$/, ""),
      thumbnailUrl: item.snippet.thumbnails?.maxres?.url || item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url,
      videoId: item.id.videoId,
    })) as YouTubeTrack[];
  return hydrateYouTubeTrackDetails(accessToken, items);
}

export async function fetchChannelStats(accessToken: string, channelId: string) {
  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=${channelId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) return null;
  const data = await response.json();
  return data.items?.[0] || null;
}

export async function scrapeChannelStats(channelId: string) {
  try {
    const url = `https://www.youtube.com/channel/${channelId}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
      next: { revalidate: 86400 } // cache for 24 hours
    });
    if (!response.ok) return null;
    const html = await response.text();
    
    // Look for subscriberCountText
    const match = html.match(/"subscriberCountText"\s*:\s*\{\s*"accessibleText"\s*:\s*\{\s*"text"\s*:\s*"([^"]+)"/i)
               || html.match(/"subscriberCountText"\s*:\s*\{\s*"simpleText"\s*:\s*"([^"]+)"/i);
    
    if (match && match[1]) {
      const text = match[1];
      const cleanedText = text.replace(/subscribers/gi, "").trim();
      
      let rawCount = 0;
      const numMatch = cleanedText.match(/^([\d\.]+)\s*([KMB]?)$/i);
      if (numMatch) {
        const val = parseFloat(numMatch[1]);
        const unit = (numMatch[2] || "").toUpperCase();
        if (unit === "K") rawCount = val * 1000;
        else if (unit === "M") rawCount = val * 1000000;
        else if (unit === "B") rawCount = val * 1000000000;
        else rawCount = val;
      } else {
        const cleanRaw = cleanedText.replace(/,/g, "");
        const parsed = parseInt(cleanRaw);
        if (!isNaN(parsed)) rawCount = parsed;
      }

      return {
        id: channelId,
        snippet: {
          title: "Channel",
        },
        statistics: {
          subscriberCount: String(Math.round(rawCount))
        }
      };
    }
  } catch (err) {
    console.error("Scraping YouTube stats failed:", err);
  }
  return null;
}

export async function subscribeToChannel(accessToken: string, channelId: string): Promise<void> {
  const response = await fetch(
    "https://www.googleapis.com/youtube/v3/subscriptions?part=snippet",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        snippet: {
          resourceId: {
            kind: "youtube#channel",
            channelId,
          },
        },
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    assertNotYouTubeQuotaError(response, errorData);
    console.error("YouTube Subscribe error:", errorData);
    throw new Error("Failed to subscribe to channel");
  }
}

export async function checkSubscriptionStatus(accessToken: string, channelId: string): Promise<boolean> {
  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/subscriptions?part=snippet&forChannelId=${channelId}&mine=true`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) return false;
  const data = await response.json();
  return data.items && data.items.length > 0;
}

export async function searchOfficialChannel(accessToken: string, query: string) {
  const searchRes = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=channel&maxResults=5&relevanceLanguage=en`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!searchRes.ok) return null;
  const searchData = await searchRes.json();
  const candidates = searchData.items || [];
  if (candidates.length === 0) return null;

  // Fetch stats for all candidates to find the most authoritative one
  const ids = candidates.map((c: any) => c.id.channelId).filter(Boolean).join(",");
  const statsRes = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${ids}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!statsRes.ok) return candidates[0]; // fallback to first
  const statsData = await statsRes.json();
  const statsItems = statsData.items || [];

  // Sort by subscriber count descending
  statsItems.sort((a: any, b: any) => parseInt(b.statistics?.subscriberCount || "0") - parseInt(a.statistics?.subscriberCount || "0"));

  const best = statsItems[0];
  if (!best) return candidates[0];

  return {
    id: { channelId: best.id },
    snippet: best.snippet, // This might be missing, but we only really need the ID
    statistics: best.statistics
  };
}

export async function fetchSubscribedChannels(accessToken: string, maxResults = 10): Promise<string[]> {
  const channels = await fetchAllSubscribedChannels(accessToken, maxResults);
  return channels.map((c) => c.name);
}

export type SubscribedChannel = {
  channelId: string;
  name: string;
  thumbnail: string;
};

export async function fetchAllSubscribedChannels(
  accessToken: string,
  maxResults = 200
): Promise<SubscribedChannel[]> {
  const channels: SubscribedChannel[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < 10 && channels.length < maxResults; page++) {
    const url = new URL("https://www.googleapis.com/youtube/v3/subscriptions");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("mine", "true");
    url.searchParams.set("maxResults", "50");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      console.error("fetchAllSubscribedChannels failed", await response.text());
      break;
    }

    const data = await response.json();
    for (const item of data.items || []) {
      const snippet = item.snippet;
      const channelId = snippet?.resourceId?.channelId;
      if (!channelId) continue;
      channels.push({
        channelId,
        name: snippet.title || "Unknown Artist",
        thumbnail:
          snippet.thumbnails?.high?.url ||
          snippet.thumbnails?.medium?.url ||
          snippet.thumbnails?.default?.url ||
          "",
      });
      if (channels.length >= maxResults) break;
    }

    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  return channels;
}
