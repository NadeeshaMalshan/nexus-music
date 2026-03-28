export interface YouTubePlaylist {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  itemCount: number;
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
    thumbnailUrl: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url,
    itemCount: item.contentDetails.itemCount,
  }));
}
