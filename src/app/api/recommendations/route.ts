import { NextResponse } from "next/server";
import { searchSongsRobust } from "@/lib/ytmSearchService";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { fetchRecentMusicActivities, fetchLikedSongs, fetchSubscribedChannels, type YouTubeTrack } from "@/lib/youtubeData";
import { fetchYTMusicBrowseHistory } from "@/lib/ytmHistoryBrowse";

export const dynamic = "force-dynamic";

// Gemma 4 26B (A4B) model ID
const GEMMA_MODEL = "gemma-4-26b-a4b-it";
const googleApiKey = process.env.GEMINI_API_KEY;

function extractJSON(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return text;
  return text.slice(start, end + 1);
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * POST /api/recommendations
 * Deep AI Recommendation Pipeline: Profiler -> Brain -> Engine
 * Powered by Gemma 4 26B (A4B)
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { prompt, favoriteArtists = [], genres = [] } = body;

    if (!googleApiKey) return NextResponse.json({ error: "API key missing" }, { status: 500 });

    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(googleApiKey);
    const model = genAI.getGenerativeModel({ 
      model: GEMMA_MODEL,
      generationConfig: { 
        temperature: 0.7, 
        topP: 0.95, 
        topK: 40,
        maxOutputTokens: 4096,
        responseMimeType: "application/json"
      }
    });

    const session = await getServerSession(authOptions);

    // ── PHASE 1: THE PROFILER ──────────────────────────────────────────
    // Gather deep context to build a User Music Persona
    let userPersona = "A general music lover who enjoys global hits.";
    let rawHistoryString = "";

    if (session?.accessToken) {
      console.log("[Recommendations] Phase 1: Profiling user taste...");
      try {
        const [nativeHistory, likedSongs, channels] = await Promise.all([
          fetchYTMusicBrowseHistory().catch(() => []),
          fetchLikedSongs(session.accessToken as string).catch(() => []),
          fetchSubscribedChannels(session.accessToken as string, 10).catch(() => [])
        ]);

        const merged = [...nativeHistory, ...likedSongs].slice(0, 40);
        rawHistoryString = merged.map(t => `${t.title} by ${t.artist}`).join(", ");
        const channelString = channels.join(", ");

        // Generate Persona using Gemma - Sentence Completion Mode
        const profilePrompt = `Based on this music history and channel list, finish this specific sentence:
"The user is a [DESCRIPTIVE TRAITS] music enthusiast who balances [STYLE A] with [STYLE B]."

History: [${rawHistoryString}]
Channels: [${channelString}]

STRICT: OUTPUT ONLY THE COMPLETED SENTENCE. NO BULLETS.
Sentence: "The user is a`;
        
        // We use temperature 0.3 for maximum focus in profiling
        const textModel = genAI.getGenerativeModel({ model: GEMMA_MODEL, generationConfig: { temperature: 0.3 } });
        const profileResult = await textModel.generateContent(profilePrompt);
        userPersona = "The user is a " + profileResult.response.text().trim().replace(/^"|"$|[.*]$/g, "");
        console.log("[Recommendations] Persona Generated:", userPersona);
      } catch (e) {
        console.warn("[Recommendations] Profiler failed, using default persona.");
      }
    }

    // ── PHASE 2: THE BRAIN ──────────────────────────────────────────────
    // Generate the playlist based on Persona + Current Prompt
    console.log("[Recommendations] Phase 2: Curation via Gemma 4...");
    const activePrompt = prompt || "Create a personalized discovery mix.";
    
    const curatorPrompt = `You are a robotic recommendation engine.
CONTEXT: ${userPersona}
REQUEST: ${activePrompt}

TASK: Generate exactly 20 songs.
RULES: 
1. If the request implies a specific language, use it for 100% of songs.
2. DO NOT use ellipses (...) or truncate.
3. DO NOT use markdown code blocks.
4. Output ONLY the raw JSON object.

JSON SCHEMA: {
 "primaryLanguage": "string (e.g. Sinhala)",
 "tracks": [{"title": "string", "artist": "string"}]
}`;

    const curateResult = await model.generateContent(curatorPrompt);
    let rawCuration = curateResult.response.text().trim();
    
    // Defensive cleaning
    rawCuration = extractJSON(rawCuration).replace(/\.{2,}/g, "").replace(/…/g, "");
    
    let curationObj: any;
    try {
      curationObj = JSON.parse(rawCuration);
    } catch (e) {
      console.error("[Recommendations] Final JSON Parse Failed:", rawCuration);
      throw new Error("Gemma output was malformed even after surgical extraction");
    }
    
    const suggestedTracks = curationObj.tracks || [];
    const targetContext = curationObj.primaryLanguage || "Music";

    // ── PHASE 3: THE ENGINE ────────────────────────────────────────────
    // Verification Loop: Smart Search & Filter
    console.log(`[Recommendations] Phase 3: Verification for ${targetContext}...`);
    
    const verifiedTracks = (await Promise.all(
      suggestedTracks.map(async (t: any) => {
        try {
          // Smart Search Query
          const query = `${t.title} ${t.artist} ${targetContext} Song Official Audio`;
          const results = await searchSongsRobust(query);
          if (!results || results.length === 0) return null;

          const topResult = results[0];
          const titleLower = topResult.title.toLowerCase();
          const targetLower = targetContext.toLowerCase();

          // Filter Logic: Check if the title contains the target language/vibe or script
          // For Sinhala, we also check for Sinhala characters (\u0D80-\u0DFF)
          const isSinhala = targetLower.includes("sinhala");
          const hasSinhalaScript = /[\u0D80-\u0DFF]/.test(topResult.title);
          const hasKeyword = titleLower.includes(targetLower);

          if (isSinhala && !hasSinhalaScript && !hasKeyword) {
            console.log(`[Engine] Skipping non-Sinhala result: ${topResult.title}`);
            return null;
          }

          if (!isSinhala && targetLower !== "music" && !hasKeyword) {
            console.log(`[Engine] Verification failed for ${targetLower}: ${topResult.title}`);
            return null;
          }

          return {
            youtubeId: topResult.youtubeId,
            title: topResult.title,
            artist: topResult.artist,
            thumbnail: topResult.thumbnailUrl,
            duration: topResult.duration || "0:00",
          };
        } catch { return null; }
      })
    )).filter(Boolean);

    // ── FINALIZATION ────────────────────────────────────────────────────
    // Explanation Phase
    const tracksString = verifiedTracks.map((t: any, i) => `${i + 1}. "${t.title}" by ${t.artist}`).join("\n");
    const voicePrompt = `Explain why these songs were picked for this prompt: "${activePrompt}".
For each song, write a short 1-sentence reason. 
Format ONLY as a JSON array of strings.`;
    
    let reasons: string[] = [];
    try {
      const explainResult = await model.generateContent(voicePrompt + "\n" + tracksString);
      const jsonMatchVoice = explainResult.response.text().trim().match(/\[[\s\S]*\]/);
      if (jsonMatchVoice) reasons = JSON.parse(jsonMatchVoice[0]);
    } catch {}

    const recommendations = verifiedTracks.map((t: any, i) => ({
      ...t,
      reason: reasons[i] || "Matches your musical persona and requested vibe."
    }));

    return NextResponse.json({ recommendations });
  } catch (error: any) {
    console.error("[Recommendations] Fatal Error:", error);
    return NextResponse.json({ error: "Gemma Pipeline failed", detail: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
