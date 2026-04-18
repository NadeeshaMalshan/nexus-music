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
    console.warn("[youtube] channels.list mine failed", await res.text());
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
    if (!videosResponse.ok) continue;
    const videosData = await videosResponse.json();
    videosData.items?.forEach((video: any) => {
      durationMap[video.id] = parseISO8601Duration(video.contentDetails?.duration);
      metadataMap[video.id] = video.snippet;
    });
  }

  return allPlaylistRows
    .map((item: any) => {
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
        item.snippet?.thumbnails?.default?.url;

      let artist = item.snippet?.videoOwnerChannelTitle || moreInfo?.channelTitle || "Unknown Artist";
      artist = artist.replace(/\s*-\s*Topic$/, "");

      return {
        id: item.id,
        title: item.snippet?.title || "Unknown",
        artist,
        thumbnailUrl: thumb,
        videoId: vId,
        duration: durationMap[vId] || "0:00",
      };
    })
    .filter((row: YouTubeTrack | null): row is YouTubeTrack => row !== null)
    .filter((item: YouTubeTrack) => {
      if (!musicOnly) return true;
      const catId = metadataMap[item.videoId]?.categoryId;
      return catId === "10";
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
    console.error("activities.list failed", await actRes.text());
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
  if (!vidRes.ok) return [];
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
    const errorData = await response.json();
    console.error("YouTube Related error:", errorData);
    return [];
  }

  const data = await response.json();
  return data.items.map((item: any) => ({
    id: item.id.videoId,
    title: item.snippet.title,
    artist: item.snippet.channelTitle.replace(/\s*-\s*Topic$/, ""),
    thumbnailUrl: item.snippet.thumbnails?.maxres?.url || item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url,
    videoId: item.id.videoId,
  }));
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
    const errorData = await response.json();
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
  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/subscriptions?part=snippet&mine=true&maxResults=${maxResults}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    console.error("fetchSubscribedChannels failed", await response.text());
    return [];
  }

  const data = await response.json();
  return (data.items || []).map((item: any) => item.snippet.title);
}
