import { NextResponse } from "next/server";
// Migrated from HuggingFace to Gemini API

export const dynamic = "force-dynamic";
import { getRelatedTracksRobust } from "@/lib/youtubeMusicRelated";
import { searchSongsRobust } from "@/lib/ytmSearchService";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { fetchRecentMusicActivities, fetchLikedSongs, type YouTubeTrack } from "@/lib/youtubeData";
import { fetchYTMusicBrowseHistory } from "@/lib/ytmHistoryBrowse";

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

    const { recentTrackId, userHistory = [], prompt, favoriteArtists = [], genres = [] } = body;
    console.log("[Recommendations] Request received. Prompt:", prompt, "Artists:", favoriteArtists, "Genres:", genres);

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
        // Fetch from multiple sources for the ultimate Taste Profile
        // 1. Native YTM History (requires YTM_COOKIE)
        // 2. YouTube Data API Activities (Recent)
        // 3. YouTube Data API Liked Songs
        const [nativeHistory, activities, liked] = await Promise.all([
          fetchYTMusicBrowseHistory().catch(() => [] as YouTubeTrack[]),
          fetchRecentMusicActivities(session.accessToken as string, 15).catch(() => [] as YouTubeTrack[]),
          fetchLikedSongs(session.accessToken as string).catch(() => [] as YouTubeTrack[])
        ]);

        // Deduplicate based on videoId, prioritizing Native History
        const seenIds = new Set<string>();
        const mergedTracks: YouTubeTrack[] = [];
        
        // Order matters for priority: Native > Activities > Liked
        [...nativeHistory, ...activities, ...liked].forEach(track => {
          if (track.videoId && !seenIds.has(track.videoId)) {
            seenIds.add(track.videoId);
            mergedTracks.push(track);
          }
        });

        const allContext = mergedTracks.slice(0, 40);
        authenticatedTracks = allContext.map(t => ({
          youtubeId: t.videoId,
          title: t.title,
          artists: [{ name: t.artist }],
          thumbnailUrl: t.thumbnailUrl,
        }));

        userTasteSummary = allContext.map(t => `${t.title} by ${t.artist}`).join(", ");
        
        // Enhance with explicit user preferences if provided
        if (favoriteArtists.length > 0) {
          userTasteSummary = `Favorite Artists: [${favoriteArtists.join(", ")}]. ${userTasteSummary}`;
        }
        if (genres.length > 0) {
          userTasteSummary = `Preferred Genres: [${genres.join(", ")}]. ${userTasteSummary}`;
        }
      } catch (authErr) {
        console.warn("[Recommendations] Auth context fetch failed:", authErr);
      }
    } else {
      // Non-authenticated but provided seeds
      if (favoriteArtists.length > 0 || genres.length > 0) {
        userTasteSummary = `Artists: [${favoriteArtists.join(", ")}]. Genres: [${genres.join(", ")}]`;
      }
    }

    // ── CASE A: AI PROMPT GENERATION ────────────────────────────────────
    if (prompt) {
      console.log("[Recommendations] Starting AI Prompt Generation for:", prompt);
      
      if (!googleApiKey) {
         return NextResponse.json({ error: "Gemini API key missing" }, { status: 500 });
      }

      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(googleApiKey as string);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const curatorPrompt = `You are a world-class music curator for Nexus Music.
Your mission: Create a playlist that matches the user's specific request while respecting their underlying musical taste "DNA".

USER CONTEXT:
1. Primary Request (Vibe): "${prompt}"
2. Taste DNA (History): [${userTasteSummary || "Varied global hits"}]

STRATEGY:
- CORE CONSTRAINT: If the user specified a language (e.g. Sinhala, Hindi, French) or a genre (e.g. Techno, Jazz), 100% of the songs MUST be in that language/genre. Do NOT mix in songs from the Taste DNA if they don't match the request's language/genre.
- STYLE MAPPING: Use the Taste DNA to determine the *vibe* (e.g. if they like acoustic/melancholic songs in history, suggest melancholic songs in the requested genre).
- NO LOW QUALITY: Strictly ignore "Live" versions, "Concerts", "Festivals", "Remixes" (unless asked), "Covers", "Karaoke", or "Parodies".
- QUANTITY: Suggest EXACTLY 20 songs.

Format ONLY as a JSON array of objects with "title" and "artist" keys. No extra text.`;

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
        // Limit to 20 just in case
        const finalizedList = suggestedTracks.slice(0, 20);
        
        // Phase 2: Search for these songs
        const searchResults = await Promise.all(
          finalizedList.map(async (t) => {
            try {
              // Append "Official Audio" to prioritize studio versions and avoid live/festivals
              const query = `${t.title} ${t.artist} Official Audio`;
              const res = await searchSongsRobust(query);
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
        const voicePrompt = `Explain why these songs were picked for this prompt: "${prompt}".
Use the user's taste summary for context: [${userTasteSummary}].
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
      if (!googleApiKey) throw new Error("GEMINI_API_KEY is not defined");
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


