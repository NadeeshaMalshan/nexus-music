import { NextResponse } from "next/server";
import YTMusic from "ytmusic-api";

// ─── YTMusic Instance Cache ───────────────────────────────────────────────────
let ytmusicInstance: any = null;

async function getYTMusic() {
  if (!ytmusicInstance) {
    ytmusicInstance = new YTMusic();
    await ytmusicInstance.initialize();
  }
  return ytmusicInstance;
}

// ─── GET /api/artist?name=<artistName> ───────────────────────────────────────
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get("name")?.trim();

    if (!name) {
      return NextResponse.json({ error: "Missing name param" }, { status: 400 });
    }

    const api = await getYTMusic();

    const { getServerSession } = await import("next-auth/next");
    const { authOptions } = await import("@/lib/auth");
    const session = await getServerSession(authOptions);

    // 1. Search for the artist
    const searchResults = await api.searchArtists(name);
    
    // Find a match that closely follows the name or just take the first
    // PRIORITIZE Official Artist Channels if multiple results exist
    let artistBasic = searchResults.find(
      (a: any) => a.name.toLowerCase() === name.toLowerCase() && !a.name.includes("- Topic")
    ) || searchResults.find(
      (a: any) => a.name.toLowerCase().includes(name.toLowerCase()) && !a.name.includes("- Topic")
    ) || searchResults[0];

    if (!artistBasic) {
      console.warn(`[Artist API] No artist found for query: ${name}`);
      return NextResponse.json({ error: "Artist not found" }, { status: 404 });
    }

    let artistId = artistBasic.artistId;

    // ─── Authority Check & Upgrade ──────────────────────────────────────────
    // Cross-reference with known OACs or YouTube Data API to find the TRUE Official Artist Channel (OAC)
    // This resolves the issue where YTM returns a sub-optimal ID (e.g. 33K subs vs 100M subs).
    
    // 1. High-Authority Fast Path Mapping (Bypasses API Quotas)
    const KNOWN_OAC_MAP: Record<string, string> = {
      "blackpink": "UCOmHUn--16B90oW2L6FRR3A",
      "bts": "UCLkAepWjdylmXSltofFvsYQ",
      "taylor swift": "UCqECaJ8Gagnn7YCbPEzWH6g",
      "the weeknd": "UC0WP5P-ufpRfjbNrmOWwLBQ"
    };

    const normalizedName = name.toLowerCase().trim();
    if (KNOWN_OAC_MAP[normalizedName]) {
      artistId = KNOWN_OAC_MAP[normalizedName];
      console.log(`[Artist API] Fast-path OAC mapping for ${name} -> ${artistId}`);
    } else {
      // 2. Dynamic Fallback Search (if quota allows)
      try {
        const { searchOfficialChannel } = await import("@/lib/youtubeData");
        
        if (session?.accessToken) {
          // We search for the name and find the candidate with the MOST subscribers
          const official = await searchOfficialChannel(session.accessToken, name);
          if (official?.id?.channelId && official.id.channelId !== artistId) {
            console.log(`[Artist API] UPGRADING ID: ${name} (${artistId}) -> OAC (${official.id.channelId})`);
            artistId = official.id.channelId;
          }
        }
      } catch (err) {
        console.warn("[Artist API] Authority upgrade lookup failed:", err);
      }
    }

    // 2. Fetch full artist details
    let details: any;
    try {
      details = await api.getArtist(artistId);
    } catch (err) {
      console.error(`[Artist API] Failed to getArtist for ID ${artistId}:`, err);
      // Fallback: use basic info from search if details fail
      details = {
        name: artistBasic.name,
        thumbnails: artistBasic.thumbnails,
        topSongs: [],
        topAlbums: [],
        topVideos: [],
        featuredOn: [],
        similarArtists: []
      };
    }

    // 3. Map to our ArtistData interface
    const thumbnails = details.thumbnails || [];
    // Get the highest resolution thumbnail
    const mainImage = thumbnails.length > 0 ? thumbnails[thumbnails.length - 1].url : "";
    const smallImage = thumbnails.length > 0 ? thumbnails[0].url : "";

    // 3. Map top tracks & fetch metadata in bulk
    const rawTopTracks = (details.topSongs || []).slice(0, 50);
    const trackIds = rawTopTracks.map((t: any) => t.videoId).filter(Boolean);
    
    // Batch fetch metadata (duration, views)
    const metadataMap: Record<string, { duration: string; views: string }> = {};
    if (trackIds.length > 0) {
       try {
          const { parseISO8601Duration } = await import("@/lib/youtubeData");
          const headers: any = {};
          if (session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;

          const vidRes = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics&id=${trackIds.join(",")}`,
            { headers }
          );
          if (vidRes.ok) {
             const vidData = await vidRes.json();
             vidData.items?.forEach((video: any) => {
                metadataMap[video.id] = {
                   duration: parseISO8601Duration(video.contentDetails?.duration || ""),
                   views: video.statistics?.viewCount || "0"
                };
             });
          } else {
             console.warn("[Artist API] YouTube Metadata API responded with status:", vidRes.status);
          }
       } catch (err) {
          console.warn("[Artist API] Metadata batch fetch failed:", err);
       }
    }

    const topTracks = rawTopTracks.map((t: any) => {
      const trackThumbnails = t.thumbnails || [];
      const thumb = trackThumbnails.length > 0 ? trackThumbnails[trackThumbnails.length - 1].url : "";
      const meta = metadataMap[t.videoId];
      
      return {
        spotifyId: t.videoId,
        name: t.name,
        albumName: t.album?.name || "Single",
        albumArt: thumb,
        durationMs: 0,
        popularity: meta?.views ? Math.min(100, Math.floor(parseInt(meta.views) / 1000000)) : (75 + Math.floor(Math.random() * 20)),
        previewUrl: null,
        videoId: t.videoId,
        thumbnail: thumb,
        duration: meta?.duration || "0:00",
        views: meta?.views || "0"
      };
    });

    // Map albums (combining albums and singles)
    const albums = (details.topAlbums || []).map((a: any) => ({
      id: a.albumId,
      name: a.name,
      image: (a.thumbnails || [])[a.thumbnails.length - 1]?.url || "",
      year: a.year,
      type: "ALBUM"
    }));

    const singles = (details.topSingles || []).map((a: any) => ({
      id: a.albumId,
      name: a.name,
      image: (a.thumbnails || [])[a.thumbnails.length - 1]?.url || "",
      year: a.year,
      type: "SINGLE"
    }));

    // ─── Shelf Mapping & Segregation ──────────────────────────────────────────
    
    // 1. Gather all potential playlists (from featuredOn and similarArtists)
    const allPotentialPlaylists = [
      ...(details.featuredOn || []),
      ...(details.similarArtists || [])
    ];

    const playlists = allPotentialPlaylists
      .filter((item: any) => {
        const isPlaylist = !!item.playlistId;
        const isRadio = (item.artistId || "").startsWith("VLRD");
        const containsRadioKeywords = (item.name || "").match(/Radio|Essentials|Presenting|Hits|Mix|Mixed/i);
        return isPlaylist || isRadio || (containsRadioKeywords && !item.artistId?.startsWith("UC"));
      })
      .map((p: any) => ({
        id: p.playlistId || p.artistId,
        name: p.name,
        image: (p.thumbnails || [])[p.thumbnails.length - 1]?.url || "",
        author: p.author?.name || "YouTube Music"
      }));

    // 2. Gather actual related artists
    let relatedArtists = (details.similarArtists || [])
      .filter((item: any) => (item.artistId || "").startsWith("UC"))
      .map((a: any) => {
        const aThumbs = a.thumbnails || [];
        return {
          id: a.artistId,
          name: a.name,
          image: aThumbs.length > 0 ? aThumbs[aThumbs.length - 1].url : "",
          genres: [],
          followers: "Artist profile",
          popularity: 0,
        };
      });

    // Fallback: If no profiles found, search for peers
    if (relatedArtists.length === 0) {
      try {
        const peers = await api.searchArtists(details.name + " related");
        relatedArtists = peers
          .filter((p: any) => p.name.toLowerCase() !== details.name.toLowerCase())
          .slice(0, 10)
          .map((a: any) => {
            const aThumbs = a.thumbnails || [];
            return {
              id: a.artistId,
              name: a.name,
              image: aThumbs.length > 0 ? aThumbs[aThumbs.length - 1].url : "",
              genres: [],
              followers: "Suggested Artist",
              popularity: 0,
            };
          });
      } catch (err) {
        console.warn("[Artist API] Peer search failed:", err);
      }
    }

    // 3. Map videos (strictly videos)
    const videos = [
      ...(details.topVideos || []),
      ...(details.featuredOn || []).filter((item: any) => 
        !item.playlistId && !item.artistId?.startsWith("VLRD") && !item.name.match(/Radio|Essentials|Presenting|Hits|Mix/i)
      )
    ].map((v: any) => ({
      id: v.videoId || v.id,
      name: v.name,
      image: (v.thumbnails || [])[v.thumbnails.length - 1]?.url || "",
    }));

    // 4. Map albums and tracks as before (they are already mapped earlier)


    // 3. Resolve Statistics (Embedded for UI accuracy)
    let ytStats: any = null;
    try {
      const { fetchChannelStats } = await import("@/lib/youtubeData");
      ytStats = await fetchChannelStats(session?.accessToken || "", artistId);
    } catch (err) {
      console.warn("[Artist API] Stats resolution failed:", err);
    }

    // Final response
    return NextResponse.json({
      id: artistId,
      name: details.name,
      image: mainImage,
      smallImage: smallImage,
      genres: [], 
      followers: ytStats?.statistics?.subscriberCount ? String(ytStats.statistics.subscriberCount) : "Artist Profile",
      followersRaw: parseInt(ytStats?.statistics?.subscriberCount || "0"),
      popularity: 80, 
      worldRank: "Official Artist",
      verified: true,
      topTracks,
      relatedArtists,
      albums,
      singles,
      videos,
      playlists,
      stats: {
        songs: (details.topSongs || []).length,
        albums: (details.topAlbums || []).length,
        videos: (details.topVideos || []).length
      },
      youtube: ytStats
    });

  } catch (error: any) {
    console.error("[Artist API] Fatal Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch artist data from YouTube Music", detail: error?.message },
      { status: 500 }
    );
  }
}
