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
  const response = await fetch(
    "https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&mine=true&maxResults=50",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    console.error("YouTube API error:", errorData);
    throw new Error("Failed to fetch YouTube playlists");
  }

  const data = await response.json();
  
  return data.items.map((item: any) => ({
    id: item.id,
    title: item.snippet.title,
    description: item.snippet.description,
    thumbnailUrl: item.snippet.thumbnails?.maxres?.url || item.snippet.thumbnails?.standard?.url || item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url,
    itemCount: item.contentDetails.itemCount,
  }));
}

export async function fetchPlaylistItems(accessToken: string, playlistId: string, musicOnly = false): Promise<YouTubeTrack[]> {
  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=50`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    console.error("YouTube API Items error:", errorData);
    throw new Error("Failed to fetch YouTube playlist items");
  }

  const data = await response.json();
  const videoIds = data.items.map((item: any) => item.contentDetails.videoId).join(",");

  // Fetch extra details (durations, etc) using the videos endpoint
  const videosResponse = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet&id=${videoIds}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  const videosData = await videosResponse.json();
  const durationMap: Record<string, string> = {};
  const metadataMap: Record<string, any> = {};

  videosData.items?.forEach((video: any) => {
    durationMap[video.id] = parseISO8601Duration(video.contentDetails?.duration);
    metadataMap[video.id] = video.snippet;
  });

  return data.items.map((item: any) => {
    const vId = item.contentDetails.videoId;
    const moreInfo = metadataMap[vId];
    const thumb = item.snippet.thumbnails?.maxres?.url || moreInfo?.thumbnails?.maxres?.url || 
                  item.snippet.thumbnails?.standard?.url || moreInfo?.thumbnails?.standard?.url ||
                  item.snippet.thumbnails?.high?.url || moreInfo?.thumbnails?.high?.url ||
                  item.snippet.thumbnails?.default?.url;
    
    // Clean up " - Topic" from channel titles
    let artist = item.snippet.videoOwnerChannelTitle || moreInfo?.channelTitle || "Unknown Artist";
    artist = artist.replace(/\s*-\s*Topic$/, "");

    return {
      id: item.id,
      title: item.snippet.title,
      artist: artist,
      thumbnailUrl: thumb,
      videoId: vId,
      duration: durationMap[vId] || "0:00",
    };
  }).filter((item: any) => {
    if (!musicOnly) return true;
    const catId = metadataMap[item.videoId]?.categoryId;
    // Category 10 is Music in YouTube Data API
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
  // YT Music "Liked Music" is essentially the "LL" (Liked) playlist
  // We filter for musicOnly=true to exclude non-music YouTube likes
  return fetchPlaylistItems(accessToken, "LL", true);
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
