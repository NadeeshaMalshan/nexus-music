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

    const { recentTrackId, userHistory = [] } = body;
    console.log("[Recommendations] Request received for ID:", recentTrackId);

    if (!recentTrackId && userHistory.length === 0) {
      return NextResponse.json(
        { error: "recentTrackId or userHistory is required" },
        { status: 400 }
      );
    }

    // ── AUTHENTICATED CONTEXT ──────────────────────────────────────────
    const session = await getServerSession(authOptions);
    let authenticatedTracks: any[] = [];

    if (session?.accessToken) {
      console.log("[Recommendations] Fetching authenticated user context...");
      try {
        // Fetch real history/recommendations from YouTube Data API
        const activities = await fetchRecentMusicActivities(session.accessToken as string, 10);
        authenticatedTracks = activities.map(t => ({
          youtubeId: t.videoId,
          title: t.title,
          artists: [{ name: t.artist }],
          thumbnailUrl: t.thumbnailUrl,
        }));
      } catch (authErr) {
        console.warn("[Recommendations] Auth context fetch failed:", authErr);
      }
    }
    // ──────────────────────────────────────────────────────────────────
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
      // Localized fallbacks for Sri Lankan users ONLY IF we have nothing yet
      searchQueries.push("top sri lankan sinhala songs 2024 hits");
      searchQueries.push("global pop chart hits international");
      searchQueries.push("trending songs sri lanka");
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

    // Shuffle the combined pool ONLY IF we have too many tracks, or just a bit to keep it fresh
    // But keep the 'related' ones near the top if we want high relevance for queue.
    // Let's do a weighted shuffle or just a partial shuffle.
    if (recentTrackId && suggestedMusics.length > 15) {
      // Keep first few related ones but shuffle the rest
      const top = suggestedMusics.slice(0, 5);
      const rest = suggestedMusics.slice(5).sort(() => 0.5 - Math.random());
      suggestedMusics = [...top, ...rest];
    } else {
      suggestedMusics = suggestedMusics.sort(() => 0.5 - Math.random());
    }


    // 🚀 THE MAGIC: STRICT DIVERSITY FILTER FOR RECOMMENDATIONS
    const uniqueTracks: any[] = [];
    const artistCount: Record<string, number> = {};
    const titleSet = new Set<string>();
    const historyString = userHistory.length > 0 ? userHistory.join(", ") : "varied hits";

    for (const track of suggestedMusics || []) {
      const title = (track.title || "Unknown Title").trim();
      const artist = (track.artists ? track.artists.map((a: any) => a.name).join(", ") : "Unknown Artist").trim();

      // Strict Cleaning and Duplication check
      const cleanTitle = title.replace(/\(.*?\)|\[.*?\]/g, '').trim().toLowerCase();

      // Skip covers, live versions, etc.
      if (cleanTitle.includes('cover') || cleanTitle.includes('live') || cleanTitle.includes('remix') || cleanTitle.includes('version')) {
        continue;
      }

      // ── Genre/Regional Cleaning ───────────────────────────────────────────
      // We explicitly exclude Hindi/Punjabi/Bollywood spam UNLESS the user history shows interest.
      // We preserve "Sinhala" and "Sri Lankan" content.
      const lowHistory = historyString.length < 20;
      const isRegionalQuery = historyString.toLowerCase().includes("hindi") ||
        historyString.toLowerCase().includes("punjabi") ||
        historyString.toLowerCase().includes("bollywood");

      if (!isRegionalQuery) {
        const unwantedKeywords = [
          // Common Languages/Categories
          "hindi", "punjabi", "bollywood", "tollywood", "kollywood", "bhojpuri", "telugu", "tamil", "malayalam", "kannada",
          "indian", "pakistani", "punjab", "haryana", "panjabi", "deshi", "sidhu", "moose wala", "haryanvi",
          // Major regional artists that often leak into general trends
          "arijit singh", "pritam", "badshah", "anirudh", "sid sriram", "anirudh ravichander", "vijay antony", "ar rahman",
          "honey singh", "diljit dosanjh", "tony kakkar", "nehak kakkar", "armadaan malik", "vishal-shekhar"
        ];
        const textToSearch = (title + " " + artist).toLowerCase();

        // Block these if they're not explicitly "Sinhala" or "Lankan"
        if (unwantedKeywords.some(kw => textToSearch.includes(kw)) &&
          !textToSearch.includes("sinhala") &&
          !textToSearch.includes("lankan")) {
          continue;
        }
      }
      // ──────────────────────────────────────────────────────────────────────
      // ──────────────────────────────────────────────────────────────────────

      if (titleSet.has(cleanTitle)) {
        continue;
      }

      // Limit per artist based on history size
      const limitPerArtist = userHistory.length > 5 ? 2 : 1;
      artistCount[artist] = (artistCount[artist] || 0) + 1;
      if (artistCount[artist] > limitPerArtist) {
        continue;
      }

      titleSet.add(cleanTitle);
      uniqueTracks.push(track);

      // Stop once we have 16 diverse tracks for the carousel/shelf
      if (uniqueTracks.length === 16) break;
    }

    // Use uniqueTracks instead of blindly slicing suggestedMusics
    const tracks = uniqueTracks.map((m) => ({
      youtubeId: m.youtubeId || "",
      title: m.title || "Unknown Title",
      artist: m.artists ? m.artists.map((a: any) => a.name).join(", ") : "Unknown Artist",
      thumbnail: m.thumbnailUrl || "",
      duration: m.duration || "0:00",
    }));

    console.log(`[Recommendations] Processing ${tracks.length} diverse tracks.`);

    if (tracks.length === 0) {
      return NextResponse.json(
        { recommendations: [], message: "Could not find any recommendations." }
      );
    }

    // PART 2: GOOGLE GEMINI INTEGRATION (The Voice)
    console.log("[Recommendations] Gemini Voice generation started.");

    if (!googleApiKey) {
      console.warn("[Recommendations] GOOGLE_API_KEY missing. Using default reasons.");
      const finalRecs = tracks.map(t => ({ ...t, reason: "Recommended based on your recent activity" }));
      return NextResponse.json({ recommendations: finalRecs, source: "fallback-no-gemini" });
    }

    const resultsString = tracks
      .map((t, i) => `${i + 1}. "${t.title}" by ${t.artist}`)
      .join("\n");

    const systemPrompt = `You are an expert music curator. I have selected these songs for a user based on their history: [${historyString}]. 
Recommended songs:
[${resultsString}]
For each song, write a short, engaging 1-sentence reason WHY they will like it. 
Format ONLY as a JSON array of strings. No extra text, no code blocks.`;

    let reasons: string[] = [];
    try {
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("GEMINI_API_KEY is not defined");
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }, { apiVersion: "v1" });
      const result = await model.generateContent(systemPrompt);
      const rawContent = result.response.text().trim();

      // Robustly extract JSON array even if model wraps it in markdown backticks
      const jsonMatch = rawContent.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          reasons = JSON.parse(jsonMatch[0]);
        } catch {
          console.warn("[Recommendations] Gemini JSON parsing failed.");
        }
      }
    } catch (geminiError) {
      console.error("[Recommendations] Gemini Error:", geminiError);
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
    status: "online",
    message: "Recommendations engine is ready. Please use POST with recentTrackId.",
    timestamp: new Date().toISOString()
  });
}


