import { NextResponse } from "next/server";
import { HfInference } from "@huggingface/inference";
import { getRelatedTracksRobust } from "@/lib/youtubeMusicRelated";
import { searchSongsRobust } from "@/lib/ytmSearchService";
import { MusicVideo } from "node-youtube-music";

// Initialize Hugging Face Inference client
const hfToken = process.env.HUGGINGFACE_TOKEN || process.env.HF_TOKEN;
const hf = new HfInference(hfToken);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/recommendations
// Body: { recentTrackId: string, userHistory: string[] }
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error("[Recommendations] Invalid JSON body:", parseError);
      return NextResponse.json(
        { error: "Invalid JSON body", detail: "The request body could not be parsed as JSON." },
        { status: 400 }
      );
    }

    const { recentTrackId, userHistory = [] } = body;
    console.log("[Recommendations] Request received for ID:", recentTrackId);

    if (!recentTrackId && userHistory.length === 0) {
      return NextResponse.json(
        { error: "recentTrackId or userHistory is required" },
        { status: 400 }
      );
    }

    // PART 1: YOUTUBE MUSIC SETUP (The Brain)
    console.log("[Recommendations] Fetching related music...");
    let suggestedMusics: MusicVideo[] = [];
    
    if (recentTrackId) {
       try {
         suggestedMusics = await getRelatedTracksRobust(recentTrackId);
       } catch (ytError) {
         console.error("[Recommendations] getRelatedTracksRobust failed:", ytError);
       }
    }

    if (suggestedMusics.length === 0) {
      console.warn("[Recommendations] No related tracks found, falling back to search.");
      const query = userHistory.length > 0 ? `${userHistory[0]} similar` : "trending hits 2024";
      try {
        suggestedMusics = await searchSongsRobust(query);
      } catch (searchError) {
        console.error("[Recommendations] Search fallback failed:", searchError);
      }
    }

    // 🚀 THE MAGIC: STRICT DIVERSITY FILTER FOR RECOMMENDATIONS
    const uniqueTracks: MusicVideo[] = [];
    const artistCount: Record<string, number> = {};
    const titleSet = new Set<string>();

    for (const track of suggestedMusics || []) {
      const title = track.title || "Unknown Title";
      const artist = track.artists ? track.artists.map((a: any) => a.name).join(", ") : "Unknown Artist";
      
      // Clean title to catch duplicates
      const cleanTitle = title.replace(/\(.*?\)|\[.*?\]/g, '').trim().toLowerCase();

      // Skip covers, live versions, remixes
      if (cleanTitle.includes('cover') || cleanTitle.includes('live') || cleanTitle.includes('remix') || cleanTitle.includes('version')) {
        continue;
      }

      // Skip exact duplicates
      if (titleSet.has(cleanTitle)) {
        continue;
      }

// BALANCED LIMITER: Max 2 or 3 songs per artist to preserve the vibe!
artistCount[artist] = (artistCount[artist] || 0) + 1;
if (artistCount[artist] > 2) { // <--- මෙතන 1 වෙනුවට 2 හරි 3 හරි දාන්න
  continue;
}

      titleSet.add(cleanTitle);
      uniqueTracks.push(track);

      // Stop once we have exactly 10 diverse tracks
      if (uniqueTracks.length === 10) break;
    }

    // Use uniqueTracks instead of blindly slicing suggestedMusics
    const tracks = uniqueTracks.map((m) => ({
      youtubeId: m.youtubeId || "",
      title: m.title || "Unknown Title",
      artist: m.artists ? m.artists.map((a: any) => a.name).join(", ") : "Unknown Artist",
      thumbnail: m.thumbnailUrl || "",
    }));

    console.log(`[Recommendations] Processing ${tracks.length} diverse tracks.`);

    if (tracks.length === 0) {
      return NextResponse.json(
        { recommendations: [], message: "Could not find any recommendations." }
      );
    }

    // PART 2: HUGGING FACE INTEGRATION (The Voice)
    console.log("[Recommendations] HF Voice generation started.");
    
    if (!hfToken) {
       console.warn("[Recommendations] HUGGINGFACE_TOKEN missing. Using default reasons.");
       return NextResponse.json({
         recommendations: tracks.map(t => ({ ...t, reason: "Recommended based on your recent activity" })),
         source: "fallback-no-hf"
       });
    }

    const historyString = userHistory.length > 0 ? userHistory.join(", ") : "varied hits";
    const resultsString = tracks
      .map((t, i) => `${i + 1}. "${t.title}" by ${t.artist}`)
      .join("\n");

    const systemPrompt = `You are an expert music curator. I have selected these 10 songs for a user based on their history: [${historyString}]. 
Recommended songs:
[${resultsString}]
For each song, write a short, engaging 1-sentence reason WHY they will like it. 
Format ONLY as a JSON array of strings. No extra text.`;

    let reasons: string[] = [];
    try {
      const response = await hf.chatCompletion({
        model: "HuggingFaceH4/zephyr-7b-beta",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Provide only the JSON array of strings." }
        ],
        max_tokens: 1024,
        temperature: 0.1,
      });

      const rawContent = response.choices[0].message.content?.trim() || "";
      const jsonMatch = rawContent.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          reasons = JSON.parse(jsonMatch[0]);
        } catch {
          console.warn("[Recommendations] AI Result parsing failed.");
        }
      }
    } catch (hfError) {
      console.error("[Recommendations] HF Error:", hfError);
    }

    const finalRecommendations = tracks.map((track, index) => ({
      ...track,
      reason: reasons[index] || "Perfect match for your current vibe",
    }));

    return NextResponse.json({ recommendations: finalRecommendations });
  } catch (error: any) {
    console.error("[Recommendations] FATAL CRASH:", error);
    return NextResponse.json(
      { 
        error: "Recommendation engine crashed", 
        detail: error?.message || "Unknown error",
        stack: error?.stack || ""
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return NextResponse.json({ 
    message: "Please use POST /api/recommendations with recentTrackId and userHistory" 
  }, { status: 405 });
}


