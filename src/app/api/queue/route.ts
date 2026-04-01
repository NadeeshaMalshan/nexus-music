import { NextResponse } from "next/server";
import { getRelatedTracksRobust } from "@/lib/youtubeMusicRelated";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/queue?videoId=[currentSongId]
// Bypasses LLMs for zero-latency, using YouTube's algorithm
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get("videoId");

    if (!videoId) {
      return NextResponse.json({ error: "videoId is required" }, { status: 400 });
    }

    console.log("[Queue API] Executing STRICT Radio Mix Algorithm for:", videoId);

    // 1. FETCHING STRATEGY: Get the raw radio pool
    const rawSuggestions = await getRelatedTracksRobust(videoId);
    
    // 2. STRICT FILTERING LOGIC
    const uniqueTracks = [];
    const artistCounts = new Map<string, number>();
    const titleSet = new Set<string>();

    for (const track of rawSuggestions) {
      if (!track.youtubeId || track.youtubeId === videoId) continue;

      const title = track.title || "Unknown Title";
      const artist = track.artists ? track.artists[0]?.name : "Unknown Artist";
      
      // A: CLEAN TITLE (remove text in brackets/parentheses)
      const cleanTitle = title.replace(/\(.*?\)|\[.*?\]/g, '').trim().toLowerCase();
      const rawTitleLower = title.toLowerCase();

      // B: BLOCK UNWANTED CLUTTER (Covers, Live, Mixes, Remixes, Versions)
      if (
        rawTitleLower.includes('cover') || 
        rawTitleLower.includes('live') || 
        rawTitleLower.includes('remix') || 
        rawTitleLower.includes('version') ||
        rawTitleLower.includes('decaf') ||
        rawTitleLower.includes('karaoke')
      ) {
        continue; 
      }

      // C: BLOCK EXACT DUPLICATES (based on clean title)
      if (titleSet.has(cleanTitle)) {
        continue;
      }

      // D: STRICT ARTIST LIMITER (MAX 2 per artist)
      const artistKey = artist.toLowerCase();
      const currentArtistCount = artistCounts.get(artistKey) || 0;
      if (currentArtistCount >= 2) {
        continue;
      }

      // If it passes all checks, add to our clean queue
      titleSet.add(cleanTitle);
      artistCounts.set(artistKey, currentArtistCount + 1);

      uniqueTracks.push({
        youtubeId: track.youtubeId,
        title: title,
        artist: artist,
        thumbnail: track.thumbnail || track.thumbnailUrl || "",
        duration: track.durationObj?.label || track.duration || "0:00",
      });

      // Stop once we have 15 perfect tracks
      if (uniqueTracks.length === 15) break;
    }

    console.log(`[Queue API] Curated ${uniqueTracks.length} strictly diverse radio tracks.`);

    return NextResponse.json({ 
        queue: uniqueTracks,
        source: "YouTube Music (Strict Radio Mix Algorithm)" 
    });
  } catch (error: any) {
    console.error("[Queue API] FAILED:", error);
    return NextResponse.json(
      { error: "Strict Radio Mix generation failed", detail: error.message },
      { status: 500 }
    );
  }
}
