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

function parseISO8601Duration(duration: string): string {
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
