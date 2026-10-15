import { NextResponse } from "next/server";
import { searchSongsRobust, searchVideosRobust } from "@/lib/ytmSearchService";
import { isTitleMatch } from "@/lib/lyrics/matchUtils";

interface VideoSearchResult {
  youtubeId: string;
  title: string;
  artist: string;
}

function youtubeHqThumbnail(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

function upgradeThumbnail(url?: string, videoId?: string): string {
  if (!url && videoId) return youtubeHqThumbnail(videoId);
  if (!url) return "";
  
  // High quality fallback for YouTube video thumbnails
  if (videoId && (url.includes("i.ytimg.com") || url.includes("img.youtube.com"))) {
    return `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
  }

  // Handle YouTube Music resolution parameters
  if (url.includes("=w") && url.includes("-h")) {
    return url.replace(/=w\d+-h\d+(-.*?)?$/, "=w1024-h1024");
  }

  // Handle older YouTube Music resolution parameters
  if (url.includes("lh3.googleusercontent.com") && !url.includes("=w")) {
    return `${url}=w1024-h1024-l90-rj`;
  }

  return url;
}

function cleanSongTitleForVideoSearch(title: string): string {
  return title
    .replace(/\s*[\(\[][^)]*?(radio|edit|audio|lyric|visualizer|remaster|version|feat|ft|with|clip|cover|tribute|karaoke|instrumental|hd|4k|video|mv|m\/v)[^)]*?[\)\]]/gi, "")
    .replace(/\s+-\s+.*$/gi, "") // remove anything after " - " if it got added to the title
    .replace(/\s{2,}/g, " ")
    .trim();
}


export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query")?.trim();
  const directVideoId = searchParams.get("videoId")?.trim();
  const isVideo = searchParams.get("isVideo") === "true";
  const passedArtist = searchParams.get("artist")?.trim();
  const passedTitle = searchParams.get("title")?.trim();

  if (!query && !directVideoId) {
    return NextResponse.json(
      { error: "Missing required param: query or videoId" },
      { status: 400 }
    );
  }

  try {
    const isLive = searchParams.get("isLive") === "true";

    let videoId: string | undefined = directVideoId;
    let trackName = passedTitle || query || "YouTube Video";
    let artist = passedArtist || "Unknown Artist";
    let thumbnailUrl = directVideoId ? youtubeHqThumbnail(directVideoId) : "";
    let musicVideoId = directVideoId;

    if (isLive && directVideoId) {
      const finalVideoId = directVideoId;
      const thumbnail = upgradeThumbnail(thumbnailUrl, finalVideoId);
      return NextResponse.json({
        audioUrl: `https://www.youtube.com/watch?v=${finalVideoId}`,
        trackName,
        artist: artist.replace(/\s*-\s*Topic\s*$/i, ""),
        coverArt: thumbnail,
        videoId: finalVideoId,
        musicVideoId: finalVideoId,
        source: "youtube.com",
      });
    }

    if (isVideo && directVideoId) {
       // For standard videos, we prioritize the passed metadata (from YouTube oembed)
       // This ensures channel name -> artist and video title -> trackName
       try {
         const cleanTitle = cleanSongTitleForVideoSearch(trackName);
         const cleanArtist = artist.replace(/\s*-\s*Topic\s*$/i, "").trim();
         const videoQuery = `${cleanArtist} ${cleanTitle} official music video`.trim();
         console.log(`[audio] Searching official M/V for: "${videoQuery}"`);
         
         const searchResults = await searchVideosRobust(videoQuery);
         if (searchResults && searchResults.length > 0) {
           let bestMatch: VideoSearchResult | null = null;
           let backupMatch: VideoSearchResult | null = null;
           const queryArtistLower = cleanArtist.toLowerCase();
           const queryTitleLower = cleanTitle.toLowerCase();
           
           const channelBlacklist = [
             "fan club", "fanclub", "karaoke", "lyrics", "tribute", 
             "cover", "upscaled", "bootleg", "fan page", "fanpage", 
             "nightcore", "slowed", "reverb", "loop", "mashup", "unofficial"
           ];

           const titleBlacklist = [
             "unofficial", "fan-made", "fanmade", "tribute", "cover", 
             "bootleg", "karaoke", "instrumental", "preview", "teaser"
           ];

           for (const searchItem of searchResults) {
             const res = searchItem as VideoSearchResult;
             const titleLower = res.title.toLowerCase();
             const artistLower = res.artist.toLowerCase();
             const cleanResultArtist = artistLower.replace(/\s*-\s*Topic\s*$/i, "").trim();
             const cleanResultTitle = cleanSongTitleForVideoSearch(res.title).toLowerCase();
             
             const hasBlacklistedArtistWord = channelBlacklist.some(word => cleanResultArtist.includes(word));
             const hasBlacklistedTitleWord = titleBlacklist.some(word => titleLower.includes(word));
             
             if (hasBlacklistedArtistWord || hasBlacklistedTitleWord) {
               continue;
             }
             
             const artistMatches = cleanResultArtist.includes(queryArtistLower) || queryArtistLower.includes(cleanResultArtist);
             const titleMatches = cleanResultTitle.includes(queryTitleLower) || queryTitleLower.includes(cleanResultTitle);
             
             if (artistMatches && titleMatches) {
               const isOfficialMV = titleLower.includes("official") && (titleLower.includes("video") || titleLower.includes("m/v") || titleLower.includes("mv"));
               const isMV = titleLower.includes("music video") || titleLower.includes("m/v") || titleLower.includes("mv");
               const isLyricOrAudio = titleLower.includes("lyric") || titleLower.includes("audio") || titleLower.includes("karaoke");
               
               if (isOfficialMV && !isLyricOrAudio) {
                 bestMatch = res;
                 break; // Perfect match found
               } else if (isMV && !isLyricOrAudio) {
                 bestMatch = res; // Good match
               } else if (!backupMatch && !isLyricOrAudio) {
                 backupMatch = res; // Keep as backup (first match with clean artist)
               }
             }
           }
           
           const finalMatch = bestMatch || backupMatch;
           if (finalMatch) {
             console.log(`[audio] Found M/V: "${finalMatch.title}" (${finalMatch.youtubeId})`);
             musicVideoId = finalMatch.youtubeId;
           }
         }
       } catch (err) {
         console.error("[audio] Error searching for official video:", err);
       }
    } else {
      // Fetch refined metadata from YouTube Music based on the query
      const searchResults = await searchSongsRobust(query || "");
      
      // Try to find an exact ID match or title match, avoid blindly picking a different song
      const exactMatch = directVideoId ? searchResults.find((r: any) => r.youtubeId === directVideoId) : null;
      const targetTitle = passedTitle || query || "";
      const titleMatch = searchResults.find((r: any) => isTitleMatch(targetTitle, r.title));
      const metadataSource = exactMatch || titleMatch || (directVideoId ? null : searchResults[0]);

      if (metadataSource) {
        if (!directVideoId) videoId = metadataSource.youtubeId?.trim();
        
        // Only update trackName if metadataSource matches or if we didn't have a reliable passedTitle
        if (isTitleMatch(trackName, metadataSource.title)) {
          trackName = metadataSource.title?.trim() || trackName;
        } else if (!passedTitle) {
          trackName = metadataSource.title?.trim() || trackName;
        }
        artist = metadataSource.artist || 
                 metadataSource.artists?.map((a: any) => a.name).filter(Boolean).join(", ") || 
                 "Unknown Artist";
        thumbnailUrl = metadataSource.thumbnailUrl || metadataSource.thumbnail || thumbnailUrl;

        // Keep music.youtube.com resolution only — use the same YTM song id (no main-YouTube video search).
        if (!directVideoId) {
          musicVideoId = videoId;
        }
      }
    }

    // Fallback cleanup
    if ((!artist || artist === "Unknown Artist" || (isVideo && artist === "YouTube")) && query?.includes(" - ")) {
       const parts = query.split(" - ");
       artist = parts[0].trim();
       if (!trackName || trackName === "YouTube Video") trackName = parts[1].trim();
    }

    if (!videoId && !directVideoId) {
      return NextResponse.json(
        { error: "No track found and no direct ID provided" },
        { status: 404 }
      );
    }

    const finalVideoId = videoId || directVideoId!;
    const thumbnail = upgradeThumbnail(thumbnailUrl, finalVideoId);

    const payload = {
      audioUrl: `https://www.youtube.com/watch?v=${finalVideoId}`,
      trackName,
      artist: artist.replace(/\s*-\s*Topic\s*$/i, ""),
      coverArt: thumbnail,
      videoId: finalVideoId,
      musicVideoId: musicVideoId || finalVideoId,
      source: directVideoId ? "youtube.com" : "music.youtube.com",
    };

    return NextResponse.json(payload);
  } catch (error: any) {
    console.error("[audio] Failed to resolve audio for query:", query, error);
    return NextResponse.json(
      {
        error: "Failed to resolve audio metadata.",
        detail: error?.message ?? "Unknown error",
      },
      { status: 500 }
    );
  }
}
