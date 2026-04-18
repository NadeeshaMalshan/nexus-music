import { NextResponse } from "next/server";
// Migrated from HuggingFace to Gemini API

export const dynamic = "force-dynamic";
import { getRelatedTracksRobust } from "@/lib/youtubeMusicRelated";
import { searchSongsRobust } from "@/lib/ytmSearchService";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { fetchRecentMusicActivities, fetchLikedSongs } from "@/lib/youtubeData";

// Gemini API Key initialization
const googleApiKey = process.env.GEMINI_API_KEY;

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

    const { recentTrackId, userHistory = [], prompt } = body;
    console.log("[Recommendations] Request received. Prompt:", prompt, "RecentID:", recentTrackId);

    if (!recentTrackId && userHistory.length === 0 && !prompt) {
      return NextResponse.json(
        { error: "recentTrackId, userHistory, or prompt is required" },
        { status: 400 }
      );
    }

    // ── AUTHENTICATED CONTEXT ──────────────────────────────────────────
    const session = await getServerSession(authOptions);
    let authenticatedTracks: any[] = [];
    let userTasteSummary = "";

    if (session?.accessToken) {
      console.log("[Recommendations] Fetching authenticated user context...");
      try {
        // Fetch real history/recommendations from YouTube Data API
        const [activities, liked] = await Promise.all([
          fetchRecentMusicActivities(session.accessToken as string, 15),
          fetchLikedSongs(session.accessToken as string).catch(() => [])
        ]);

        const allContext = [...activities, ...liked].slice(0, 30);
        authenticatedTracks = allContext.map(t => ({
          youtubeId: t.videoId,
          title: t.title,
          artists: [{ name: t.artist }],
          thumbnailUrl: t.thumbnailUrl,
        }));

        userTasteSummary = allContext.map(t => `${t.title} by ${t.artist}`).join(", ");
      } catch (authErr) {
        console.warn("[Recommendations] Auth context fetch failed:", authErr);
      }
    }

    // ── CASE A: AI PROMPT GENERATION ────────────────────────────────────
    if (prompt) {
      console.log("[Recommendations] Starting AI Prompt Generation for:", prompt);
      
      if (!googleApiKey) {
         return NextResponse.json({ error: "Gemini API key missing" }, { status: 500 });
      }

      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(googleApiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const curatorPrompt = `You are an expert music curator. 
User's Music Taste/History: [${userTasteSummary || "Varied global hits"}]
User's Vibe Request: "${prompt}"

Based on their taste and the request, suggest EXACTLY 15 songs that would create the perfect playlist. 
The songs should be a mix of their existing taste and new discoveries that fit the request.
Format ONLY as a JSON array of objects with "title" and "artist" keys. 
No extra text, no markdown blocks.`;

      let suggestedTracks: { title: string, artist: string }[] = [];
      try {
        const result = await model.generateContent(curatorPrompt);
        const rawContent = result.response.text().trim();
        const jsonMatch = rawContent.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          suggestedTracks = JSON.parse(jsonMatch[0]);
        }
      } catch (err) {
        console.error("[Recommendations] Gemini Curator failed:", err);
      }

      if (suggestedTracks.length > 0) {
        // Phase 2: Search for these songs
        const searchResults = await Promise.all(
          suggestedTracks.map(async (t) => {
            try {
              const res = await searchSongsRobust(`${t.title} ${t.artist}`);
              return res && res.length > 0 ? res[0] : null;
            } catch {
              return null;
            }
          })
        );

        const validTracks = searchResults
          .filter(t => t !== null)
          .map(m => ({
            youtubeId: m.youtubeId || "",
            title: m.title || "Unknown Title",
            artist: m.artists ? m.artists.map((a: any) => a.name).join(", ") : "Unknown Artist",
            thumbnail: m.thumbnailUrl || "",
            duration: m.duration || "0:00",
          }));

        // Phase 3: Reasons
        const tracksString = validTracks.map((t, i) => `${i + 1}. "${t.title}" by ${t.artist}`).join("\n");
        const voicePrompt = `Explain why these 15 songs were picked for this prompt: "${prompt}".
For each song, write a short, charming 1-sentence reason. 
Format ONLY as a JSON array of strings.`;
        
        let reasons: string[] = [];
        try {
          const resResult = await model.generateContent(voicePrompt + "\n" + tracksString);
          const rawVoice = resResult.response.text().trim();
          const jsonMatch = rawVoice.match(/\[[\s\S]*\]/);
          if (jsonMatch) reasons = JSON.parse(jsonMatch[0]);
        } catch {}

        const finalRecs = validTracks.map((t, i) => ({
          ...t,
          reason: reasons[i] || "Perfect match for your requested vibe"
        }));

        return NextResponse.json({ recommendations: finalRecs });
      }
    }

    // ── CASE B: LEGACY RECOMMENDATIONS (DASHBOARD) ──────────────────────
    let suggestedMusics: any[] = [];
    const searchQueries: string[] = [];

    // ── PRIMARY: REAL RELATED TRACKS FOR THE QUEUE ────────────────────
    if (recentTrackId) {
      console.log("[Recommendations] Fetching real related tracks for videoId:", recentTrackId);
      try {
        const related = await getRelatedTracksRobust(recentTrackId);
        if (related && related.length > 0) {
          suggestedMusics.push(...related);
          console.log(`[Recommendations] Added ${related.length} related tracks.`);
        }
      } catch (relErr) {
        console.warn("[Recommendations] Failed to fetch related tracks:", relErr);
      }
    }

    // ── SECONDARY: SEARCH-BASED FROM HISTORY ──────────────────────────
    if (userHistory && userHistory.length > 0) {
      // Pick random entries to ensure fresh results on reload!
      const shuffledHistory = [...userHistory].sort(() => 0.5 - Math.random());
      const firstSrc = shuffledHistory[0];
      const secondSrc = shuffledHistory.length > 1 ? shuffledHistory[1] : shuffledHistory[0];

      // Extract artist safely if formatted as "Title by Artist"
      const artist1 = firstSrc.includes(" by ") ? firstSrc.split(" by ")[1] : firstSrc;
      const artist2 = secondSrc.includes(" by ") ? secondSrc.split(" by ")[1] : secondSrc;

      const modifiers = ["radio hits", "similar popular songs", "essential tracks", "best songs playlist", "mix"];
      const mod1 = modifiers[Math.floor(Math.random() * modifiers.length)];
      const mod2 = modifiers[Math.floor(Math.random() * modifiers.length)];

      searchQueries.push(`${artist1} ${mod1}`);
      if (artist1 !== artist2) {
        searchQueries.push(`${artist2} ${mod2}`);
      } else {
        searchQueries.push(`${firstSrc.split(" by ")[0]} audio`);
      }
    } else if (authenticatedTracks.length > 0) {
      // If we have auth history but no recent request history, use auth history as seeds
      const seed1 = authenticatedTracks[0].artists[0].name;
      const seed2 = authenticatedTracks.length > 1 ? authenticatedTracks[1].artists[0].name : seed1;
      searchQueries.push(`${seed1} radio`);
      searchQueries.push(`${seed2} similar`);
    } else if (suggestedMusics.length === 0) {
      // Localized fallbacks
      searchQueries.push("global pop chart hits international");
      searchQueries.push("trending songs global");
    }

    // Execute searches in parallel to supplement related tracks
    if (searchQueries.length > 0) {
      try {
        const searchResults = await Promise.all(
          searchQueries.map(q => searchSongsRobust(q))
        );
        // Flatten arrays and interleave them for maximum diversity
        const arr1 = searchResults[0] || [];
        const arr2 = searchResults[1] || [];
        const maxLength = Math.max(arr1.length, arr2.length);
        for (let i = 0; i < maxLength; i++) {
          if (arr1[i]) suggestedMusics.push(arr1[i]);
          if (arr2[i]) suggestedMusics.push(arr2[i]);
        }
      } catch (searchError) {
        console.error("[Recommendations] Personalized searches failed:", searchError);
      }
    }

    // Interleave authenticated context tracks for high relevance
    if (authenticatedTracks.length > 0) {
      suggestedMusics = [...authenticatedTracks.slice(0, 5), ...suggestedMusics];
    }

    // Shuffle the combined pool ONLY IF we have too many tracks
    if (recentTrackId && suggestedMusics.length > 15) {
      const top = suggestedMusics.slice(0, 5);
      const rest = suggestedMusics.slice(5).sort(() => 0.5 - Math.random());
      suggestedMusics = [...top, ...rest];
    } else {
      suggestedMusics = suggestedMusics.sort(() => 0.5 - Math.random());
    }


    // 🚀 THE MAGIC: STRICT DIVERSITY FILTER
    const uniqueTracks: any[] = [];
    const artistCount: Record<string, number> = {};
    const titleSet = new Set<string>();
    const historyString = userTasteSummary || (userHistory.length > 0 ? userHistory.join(", ") : "varied hits");

    for (const track of suggestedMusics || []) {
      const title = (track.title || "Unknown Title").trim();
      const artist = (track.artists ? track.artists.map((a: any) => a.name).join(", ") : "Unknown Artist").trim();
      const cleanTitle = title.replace(/\(.*?\)|\[.*?\]/g, '').trim().toLowerCase();

      if (cleanTitle.includes('cover') || cleanTitle.includes('live')) continue;
      if (titleSet.has(cleanTitle)) continue;

      const limitPerArtist = userHistory.length > 5 ? 2 : 1;
      artistCount[artist] = (artistCount[artist] || 0) + 1;
      if (artistCount[artist] > limitPerArtist) continue;

      titleSet.add(cleanTitle);
      uniqueTracks.push(track);
      if (uniqueTracks.length === 16) break;
    }

    const tracks = uniqueTracks.map((m) => ({
      youtubeId: m.youtubeId || "",
      title: m.title || "Unknown Title",
      artist: m.artists ? m.artists.map((a: any) => a.name).join(", ") : "Unknown Artist",
      thumbnail: m.thumbnailUrl || "",
      duration: m.duration || "0:00",
    }));

    if (tracks.length === 0) {
      return NextResponse.json({ recommendations: [], message: "Could not find any recommendations." });
    }

    // PART 2: GEMINI REASONS
    const resultsString = tracks.map((t, i) => `${i + 1}. "${t.title}" by ${t.artist}`).join("\n");
    const systemPrompt = `You are an expert music curator. Users history: [${historyString}]. 
Recommended songs:
[${resultsString}]
For each song, write a short 1-sentence reason WHY they will like it. 
Format ONLY as a JSON array of strings.`;

    let reasons: string[] = [];
    try {
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(googleApiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(systemPrompt);
      const rawContent = result.response.text().trim();
      const jsonMatch = rawContent.match(/\[[\s\S]*\]/);
      if (jsonMatch) reasons = JSON.parse(jsonMatch[0]);
    } catch {}

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
    status: "online",
    message: "Recommendations engine is ready. Please use POST with recentTrackId.",
    timestamp: new Date().toISOString()
  });
}


