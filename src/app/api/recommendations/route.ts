import { NextResponse } from "next/server";
import { searchSongsRobust } from "@/lib/ytmSearchService";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { fetchRecentMusicActivities, fetchLikedSongs, type YouTubeTrack } from "@/lib/youtubeData";
import { fetchYTMusicBrowseHistory } from "@/lib/ytmHistoryBrowse";

export const dynamic = "force-dynamic";

// Gemini API Key initialization
const googleApiKey = process.env.GEMINI_API_KEY;

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * POST /api/recommendations
 * Fully AI-Driven Recommendation Engine (Gemini 1.5 Flash)
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { prompt, favoriteArtists = [], genres = [] } = body;

    // 1. GATHER CONTEXT (Taste DNA)
    const session = await getServerSession(authOptions);
    let userTasteSummary = "Varied global hits";
    
    if (session?.accessToken) {
      try {
        const [nativeHistory, activities, liked] = await Promise.all([
          fetchYTMusicBrowseHistory().catch(() => []),
          fetchRecentMusicActivities(session.accessToken as string, 15).catch(() => []),
          fetchLikedSongs(session.accessToken as string).catch(() => [])
        ]);

        const seenIds = new Set<string>();
        const merged: YouTubeTrack[] = [];
        [...nativeHistory, ...activities, ...liked].forEach(t => {
          if (t.videoId && !seenIds.has(t.videoId)) {
            seenIds.add(t.videoId);
            merged.push(t);
          }
        });

        if (merged.length > 0) {
          userTasteSummary = merged.slice(0, 40).map(t => `${t.title} by ${t.artist}`).join(", ");
        }
      } catch (e) {
        console.warn("[Recommendations] History fetch failed, using fallback summary.");
      }
    }

    // Enhance with explicit user seeds
    const seeds = [];
    if (favoriteArtists.length > 0) seeds.push(`Favorite Artists: [${favoriteArtists.join(", ")}]`);
    if (genres.length > 0) seeds.push(`Preferred Genres: [${genres.join(", ")}]`);
    if (seeds.length > 0) userTasteSummary = `${seeds.join(". ")}. ${userTasteSummary}`;

    // 2. AI CURATION PHASE
    if (!googleApiKey) return NextResponse.json({ error: "API key missing" }, { status: 500 });

    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(googleApiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: { temperature: 1.0, topP: 0.95, topK: 40 }
    });

    const activePrompt = prompt || "Create a personalized discovery mix based on my taste. Surprise me with fresh high-quality tracks.";
    
    const curatorPrompt = `You are a world-class music curator for Nexus Music.
MISSION: Create a 20-song setlist matching the request while respecting the user's "Taste DNA".

USER CONTEXT:
- Request/Vibe: "${activePrompt}"
- Taste DNA (History): [${userTasteSummary}]
- Seed: ${Date.now()}_${Math.random().toString(36).substring(7)}

STRATEGY:
- CORE CONSTRAINT: If a language or specific genre is mentioned in the Request, 100% of the songs MUST fit that.
- DISCOVERY: Do NOT suggest any songs actually listed in the Taste DNA list. Suggest fresh alternatives.
- QUALITY: No Live, No Concerts, No Remixes (unless requested), No Covers, No Parodies.
- QUANTITY: EXACTLY 20 songs.

Format ONLY as a JSON array of objects with "title" and "artist" keys.`;

    const result = await model.generateContent(curatorPrompt);
    const rawContent = result.response.text().trim();
    const jsonMatch = rawContent.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("AI failed to return a list");
    const suggested = JSON.parse(jsonMatch[0]).slice(0, 20);

    // 3. RESEARCH PHASE (Search for IDs)
    const validTracks = (await Promise.all(
      suggested.map(async (t: any) => {
        try {
          const res = await searchSongsRobust(`${t.title} ${t.artist} Official Audio`);
          if (res && res.length > 0) {
            const m = res[0];
            return {
              youtubeId: m.youtubeId || "",
              title: m.title || "Unknown",
              artist: m.artist || "Unknown",
              thumbnail: m.thumbnailUrl || "",
              duration: m.duration || "0:00",
            };
          }
          return null;
        } catch { return null; }
      })
    )).filter(Boolean);

    // 4. EXPLAINER PHASE (Why these tracks?)
    const tracksString = validTracks.map((t, i) => `${i + 1}. "${t.title}" by ${t.artist}`).join("\n");
    const voicePrompt = `Explain why these songs were picked for this prompt: "${activePrompt}".
For each song, write a short, charming 1-sentence reason. 
Format ONLY as a JSON array of strings.`;
    
    let reasons: string[] = [];
    try {
      const resResult = await model.generateContent(voicePrompt + "\n" + tracksString);
      const jsonMatchVoice = resResult.response.text().trim().match(/\[[\s\S]*\]/);
      if (jsonMatchVoice) reasons = JSON.parse(jsonMatchVoice[0]);
    } catch {}

    const recommendations = validTracks.map((t, i) => ({
      ...t,
      reason: reasons[i] || "Matches your musical DNA and requested vibe"
    }));

    return NextResponse.json({ recommendations });
  } catch (error: any) {
    console.error("[Recommendations] Fatal Error:", error);
    return NextResponse.json({ error: "Generation failed", detail: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
