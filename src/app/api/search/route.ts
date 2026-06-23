import { NextResponse } from "next/server";
import { searchSongsRobust } from "@/lib/ytmSearchService";
import { fetchYoutubeDataApiWithKeyRotation } from "@/lib/youtubeDataApiFetch";
import https from "https";

function fetchHtmlForceIpv4(urlStr: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
      },
      family: 4, // Force IPv4 to avoid IPv6 connection timeout on Windows
      timeout: 8000,
    };

    const req = https.get(options, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(fetchHtmlForceIpv4(res.headers.location));
        return;
      }
      
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        resolve(data);
      });
    });

    req.on("error", (err) => {
      reject(err);
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });
  });
}

function checkIfVideoIsLive(video: any): boolean {
  if (!video) return false;

  // 1. Check badges
  if (video.badges) {
    const hasLiveBadge = video.badges.some((b: any) => {
      const style = b.metadataBadgeRenderer?.style;
      const label = b.metadataBadgeRenderer?.label || b.metadataBadgeRenderer?.label?.runs?.[0]?.text;
      return style === "BADGE_STYLE_TYPE_LIVE_NOW" || String(label).toLowerCase() === "live";
    });
    if (hasLiveBadge) return true;
  }
  
  // 2. Check thumbnail overlays
  if (video.thumbnailOverlays) {
    const hasLiveOverlay = video.thumbnailOverlays.some((o: any) => {
      const style = o.thumbnailOverlayTimeStatusRenderer?.style;
      const text = o.thumbnailOverlayTimeStatusRenderer?.text?.runs?.[0]?.text || o.thumbnailOverlayTimeStatusRenderer?.text?.simpleText;
      return style === "LIVE" || String(text).toLowerCase() === "live";
    });
    if (hasLiveOverlay) return true;
  }

  // 3. Check duration text
  const durationText = video.lengthText?.simpleText || video.lengthText?.runs?.[0]?.text;
  if (durationText === "LIVE" || durationText === "0:00") return true;

  return false;
}

type SearchItem = {
  videoId: string;
  title: string;
  author: string;
  duration: string;
  thumbnail: string;
};

function youtubeHqThumbnail(videoId: string): string {
  // hqdefault (480x360) is universally available and safe.
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

function upgradeYtMusicThumbnail(url: string): string {
  if (!url) return url;
  // YT Music thumbnails often have =w120-h120-... or similar. We replace with high res.
  if (url.includes("=w") && url.includes("-h")) {
    return url.replace(/=w\d+-h\d+/, "=w1024-h1024");
  }
  // Some other patterns exist
  return url;
}

function formatSeconds(total: number): string {
  if (!Number.isFinite(total) || total < 0) return "0:00";
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function musicVideoToItem(m: {
  youtubeId?: string;
  title?: string;
  artists?: { name: string }[];
  duration?: { label: string; totalSeconds: number };
  thumbnailUrl?: string;
}): SearchItem | null {
  const id = m.youtubeId?.trim();
  if (!id) return null;
  const artist = m.artists?.map((a) => a.name).filter(Boolean).join(", ") || "Unknown Artist";
  const dur =
    (m as any).durationObj?.label ||
    m.duration?.label ||
    ((m as any).durationObj?.totalSeconds != null ? formatSeconds((m as any).durationObj.totalSeconds) : 
     (m.duration?.totalSeconds != null ? formatSeconds(m.duration.totalSeconds) : 
      (typeof m.duration === 'string' ? m.duration : "0:00")));

  let thumb = m.thumbnailUrl?.trim() || youtubeHqThumbnail(id);
  thumb = upgradeYtMusicThumbnail(thumb);

  return {
    videoId: id,
    title: m.title?.trim() || "Unknown title",
    author: artist,
    duration: dur,
    thumbnail: thumb,
  };
}

async function searchYouTubeMusic(query: string): Promise<SearchItem[]> {
  const results = await searchSongsRobust(query);
  const items: SearchItem[] = [];
  for (const r of results) {
    const item = musicVideoToItem(r);
    if (item) items.push(item);
    if (items.length >= 12) break;
  }
  return items;
}

async function searchYouTubeMusicVideos(query: string): Promise<SearchItem[]> {
  const { searchVideosRobust } = await import("@/lib/ytmSearchService");
  const results = await searchVideosRobust(query);
  const items: SearchItem[] = [];
  for (const r of results) {
    const item = musicVideoToItem(r);
    if (item) items.push(item);
    if (items.length >= 12) break;
  }
  return items;
}

async function searchYouTubeMusicAlbums(query: string) {
  const { searchAlbumsRobust } = await import("@/lib/ytmSearchService");
  const results = await searchAlbumsRobust(query);

  return (results || [])
    .map((a: any) => ({
      type: "ALBUM" as const,
      id: (a as any).browseId || (a as any).albumId || (a as any).id || "",
      title: a.title || a.name || "Unknown Album",
      author:
        a.artist?.name ||
        a.artist ||
        a.author ||
        (a.artists?.map((x: any) => x?.name).filter(Boolean).join(", ") || "Unknown Artist"),
      thumbnail: a.thumbnailUrl || a.thumbnail || "",
      year: (a as any).year,
    }))
    .filter((x: any) => x.id)
    .slice(0, 12);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();
    const type = searchParams.get("type") || "songs";

    if (!q) {
      return NextResponse.json({ error: "Missing required query param: q" }, { status: 400 });
    }

    if (type === "artists") {
       const { searchArtistsRobust } = await import("@/lib/ytmSearchService");
       const artists = await searchArtistsRobust(q);
       return NextResponse.json({ items: artists, source: "music.youtube.com" });
    }

    if (type === "playlists") {
       const { searchPlaylistsRobust } = await import("@/lib/ytmSearchService");
       const playlists = await searchPlaylistsRobust(q);
       return NextResponse.json({ items: playlists, source: "music.youtube.com" });
    }

    if (type === "albums") {
      const albums = await searchYouTubeMusicAlbums(q);
      return NextResponse.json({ items: albums, source: "music.youtube.com" as const });
    }

    if (type === "live") {
      let finalItems: any[] = [];
      let ytSearchSuccess = false;

      try {
        const { getServerSession } = await import("next-auth/next");
        const { authOptions } = await import("@/lib/auth");
        const session = await getServerSession(authOptions);

        const headers: Record<string, string> = {};
        if (session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;

        // 1. Try search API with category 10 (Music)
        let searchRes = await fetchYoutubeDataApiWithKeyRotation(
          (apiKey) => {
            const url = new URL("https://www.googleapis.com/youtube/v3/search");
            url.searchParams.set("part", "snippet");
            url.searchParams.set("q", q);
            url.searchParams.set("type", "video");
            url.searchParams.set("eventType", "live");
            url.searchParams.set("videoCategoryId", "10");
            url.searchParams.set("maxResults", "12");
            if (apiKey) url.searchParams.set("key", apiKey);
            return url.toString();
          },
          { headers }
        );

        let searchItems = [];
        if (searchRes.ok) {
          ytSearchSuccess = true;
          const searchData = await searchRes.json();
          searchItems = searchData.items || [];
        }

        // 2. Try search API without category 10 if we got nothing (and first request was OK)
        if (ytSearchSuccess && searchItems.length === 0) {
          const searchResNoCat = await fetchYoutubeDataApiWithKeyRotation(
            (apiKey) => {
              const url = new URL("https://www.googleapis.com/youtube/v3/search");
              url.searchParams.set("part", "snippet");
              url.searchParams.set("q", q);
              url.searchParams.set("type", "video");
              url.searchParams.set("eventType", "live");
              url.searchParams.set("maxResults", "12");
              if (apiKey) url.searchParams.set("key", apiKey);
              return url.toString();
            },
            { headers }
          );
          if (searchResNoCat.ok) {
            const dataNoCat = await searchResNoCat.json();
            searchItems = dataNoCat.items || [];
          }
        }

        const videoIds = searchItems.map((item: any) => item.id?.videoId).filter(Boolean);
        if (videoIds.length > 0 && ytSearchSuccess) {
          const { parseISO8601Duration } = await import("@/lib/youtubeData");
          // Batch fetch detailed video object
          const detailsRes = await fetchYoutubeDataApiWithKeyRotation(
            (apiKey) => {
              const url = new URL("https://www.googleapis.com/youtube/v3/videos");
              url.searchParams.set("part", "snippet,contentDetails,statistics");
              url.searchParams.set("id", videoIds.join(","));
              if (apiKey) url.searchParams.set("key", apiKey);
              return url.toString();
            },
            { headers }
          );

          if (detailsRes.ok) {
            const detailsData = await detailsRes.json();
            const detailsItems = detailsData.items || [];

            finalItems = detailsItems.map((item: any) => {
              const id = item.id;
              const title = item.snippet?.title || "Unknown Title";
              const author = (item.snippet?.channelTitle || "Unknown Artist").replace(/\s*-\s*Topic$/, "");

              let duration = "LIVE";
              const ytDuration = item.contentDetails?.duration;
              if (ytDuration) {
                if (ytDuration === "PT0S" || ytDuration === "P0D" || ytDuration === "PT0H0M0S") {
                  duration = "LIVE";
                } else {
                  duration = parseISO8601Duration(ytDuration);
                }
              }

              const thumbnail = item.snippet?.thumbnails?.maxres?.url ||
                                item.snippet?.thumbnails?.high?.url ||
                                item.snippet?.thumbnails?.medium?.url ||
                                youtubeHqThumbnail(id);

              return {
                videoId: id,
                title,
                author,
                duration,
                thumbnail,
                views: item.statistics?.viewCount || "0",
                isLive: true,
              };
            });
          } else {
            ytSearchSuccess = false;
          }
        }
      } catch (err) {
        console.warn("[Search API] YouTube Data API live search failed, falling back to YTM scraper:", err);
        ytSearchSuccess = false;
      }

      if (!ytSearchSuccess) {
        // Fallback 1: Scrape standard YouTube search page with the "Live" filter
        let scrapedItems: any[] = [];
        try {
          const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&sp=EgJAAQ%253D%253D`;
          const html = await fetchHtmlForceIpv4(url);
            const match = html.match(/(?:var\s+)?ytInitialData\s*=\s*({.+?});/);
            if (match) {
              const data = JSON.parse(match[1]);
              const contents = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents
                || data.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents;

              if (contents) {
                for (const content of contents) {
                  const itemSection = content.itemSectionRenderer;
                  if (!itemSection?.contents) continue;
                  for (const item of itemSection.contents) {
                    const video = item.videoRenderer;
                    if (!video) continue;
                    const videoId = video.videoId;
                    const title = video.title?.runs?.[0]?.text || "Unknown Stream";
                    const author = video.ownerText?.runs?.[0]?.text || "Unknown Channel";
                    const duration = video.lengthText?.simpleText || "LIVE";
                    const thumbnail = video.thumbnail?.thumbnails?.[0]?.url || youtubeHqThumbnail(videoId);
                    const isLive = checkIfVideoIsLive(video);

                    if (isLive) {
                      scrapedItems.push({
                        videoId,
                        title,
                        author,
                        duration: "LIVE",
                        thumbnail,
                        isLive: true
                      });
                    }
                  }
                }
              }
            }
        } catch (err) {
          console.warn("[Search API] YouTube Web live scraping failed:", err);
        }

        if (scrapedItems.length > 0) {
          return NextResponse.json({
            items: scrapedItems.slice(0, 12),
            source: "youtube.com",
          });
        }

        // Fallback 2: YTM Scraper search as last resort
        const liveQuery = q.toLowerCase().includes("live") ? q : `${q} live`;
        finalItems = await searchYouTubeMusicVideos(liveQuery);
        finalItems = finalItems.map((item) => ({
          ...item,
          isLive: item.duration === "0:00" || item.duration === "LIVE",
        }));
      }

      return NextResponse.json({
        items: finalItems.slice(0, 12),
        source: ytSearchSuccess ? "youtube.googleapis.com" : "music.youtube.com",
      });
    }

    if (type === "videos" || type === "musicVideos") {
      let finalItems = await searchYouTubeMusicVideos(q);

      // Batch fetch view counts for videos
      const ids = finalItems.map((i) => i.videoId).filter(Boolean);
      if (ids.length > 0) {
        try {
          const { getServerSession } = await import("next-auth/next");
          const { authOptions } = await import("@/lib/auth");
          const session = await getServerSession(authOptions);

          const headers: Record<string, string> = {};
          if (session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;

          const vidRes = await fetchYoutubeDataApiWithKeyRotation(
            (apiKey) => {
              const url = new URL("https://www.googleapis.com/youtube/v3/videos");
              url.searchParams.set("part", "statistics");
              url.searchParams.set("id", ids.join(","));
              if (apiKey) url.searchParams.set("key", apiKey);
              return url.toString();
            },
            { headers }
          );
          if (vidRes.ok) {
            const vidData = await vidRes.json();
            const viewsMap: Record<string, string> = {};
            vidData.items?.forEach((v: any) => {
              viewsMap[v.id] = v.statistics?.viewCount || "0";
            });

            finalItems = finalItems.map((item) => ({ ...item, views: viewsMap[item.videoId] || "0" }));
          }
        } catch (err) {
          console.warn("[Search API] View count batch fetch failed:", err);
        }
      }

      return NextResponse.json({ items: finalItems.slice(0, 12), source: "music.youtube.com" as const });
    }

    // Default: Songs (with Top Artist Heuristic)
    const { searchArtistsRobust } = await import("@/lib/ytmSearchService");
    const [artists, songs] = await Promise.all([
      searchArtistsRobust(q),
      searchYouTubeMusic(q)
    ]);

    // Interleave
    const topArtist = artists[0] ? { ...artists[0], type: "ARTIST" } : null;
    let finalItems: any[] = topArtist ? [topArtist, ...songs] : songs;
    
    // Batch fetch view counts for songs
    const videoIds = finalItems
      .filter((i) => i && i.videoId && i.type !== "ARTIST" && i.type !== "PLAYLIST")
      .map((s) => s.videoId);
    if (videoIds.length > 0) {
       try {
          const { getServerSession } = await import("next-auth/next");
          const { authOptions } = await import("@/lib/auth");
          const session = await getServerSession(authOptions);
          
          const headers: Record<string, string> = {};
          if (session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;

          const vidRes = await fetchYoutubeDataApiWithKeyRotation(
            (apiKey) => {
              const url = new URL("https://www.googleapis.com/youtube/v3/videos");
              url.searchParams.set("part", "statistics");
              url.searchParams.set("id", videoIds.join(","));
              if (apiKey) url.searchParams.set("key", apiKey);
              return url.toString();
            },
            { headers }
          );
          if (vidRes.ok) {
             const vidData = await vidRes.json();
             const viewsMap: Record<string, string> = {};
             vidData.items?.forEach((v: any) => {
                viewsMap[v.id] = v.statistics?.viewCount || "0";
             });
             
             finalItems = finalItems.map(item => {
                if (item && item.videoId && item.type !== "ARTIST" && item.type !== "PLAYLIST") {
                   return { ...item, views: viewsMap[item.videoId] || "0" };
                }
                return item;
             });
          }
       } catch (err) {
          console.warn("[Search API] View count batch fetch failed:", err);
       }
    }

    return NextResponse.json({ items: finalItems.slice(0, 12), source: "music.youtube.com" as const });
  } catch (error) {
    console.error("Search route failed:", error);
    return NextResponse.json({ error: "Failed to search tracks." }, { status: 500 });
  }
}
