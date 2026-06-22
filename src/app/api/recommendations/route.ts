import { NextResponse } from "next/server";
import { searchSongsRobust } from "@/lib/ytmSearchService";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { fetchRecentMusicActivities, fetchLikedSongs, fetchSubscribedChannels, type YouTubeTrack } from "@/lib/youtubeData";
import { fetchYTMusicBrowseHistory } from "@/lib/ytmHistoryBrowse";

export const dynamic = "force-dynamic";

// Gemini 2.5 Flash (recommendation pipeline: profiler, curation, explanations)
const RECOMMENDATIONS_MODEL = "gemini-2.5-flash";
const googleApiKey = process.env.GEMINI_API_KEY;

/** Normalize common model quirks before JSON.parse */
function normalizeJsonish(text: string): string {
  return text
    .replace(/^\uFEFF/, "")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'");
}

/**
 * Extract a balanced `{ ... }` object starting at `start`, respecting JSON strings.
 * Fixes naive first-`{`..last-`}` slicing when extra `}` appear inside reasoning.
 */
function extractBalancedJsonObjectFrom(text: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (c === "\\") {
        escape = true;
        continue;
      }
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === "{") depth++;
    if (c === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function extractFirstJsonObject(text: string): string | null {
  const normalized = normalizeJsonish(text);
  const start = normalized.indexOf("{");
  if (start === -1) return null;
  return extractBalancedJsonObjectFrom(normalized, start);
}

/** Profile response: prefer object containing "persona" if the model prefixes noise. */
function extractPersonaJsonObject(text: string): string | null {
  const normalized = normalizeJsonish(text);
  const keyIdx = normalized.search(/"persona"\s*:/);
  if (keyIdx === -1) return extractFirstJsonObject(normalized);
  const objStart = normalized.lastIndexOf("{", keyIdx);
  if (objStart === -1) return extractFirstJsonObject(normalized);
  return extractBalancedJsonObjectFrom(normalized, objStart);
}

/** Prefer the curation object keyed by primaryLanguage; otherwise first balanced object. */
function extractCurationJsonObject(text: string): string | null {
  const normalized = normalizeJsonish(text);
  const re = /\{\s*"primaryLanguage"\s*:/g;
  let last: string | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(normalized)) !== null) {
    const slice = extractBalancedJsonObjectFrom(normalized, m.index);
    if (slice) last = slice;
  }
  if (last) return last;
  return extractFirstJsonObject(normalized);
}

function sanitizePersonaForPrompt(persona: string): string {
  const oneLine = persona.replace(/\s+/g, " ").trim();
  return oneLine.length > 2000 ? oneLine.slice(0, 2000) + "…" : oneLine;
}

function parseCurationJson(raw: string): { primaryLanguage?: string; tracks?: unknown[] } {
  const trimmed = normalizeJsonish(raw.trim())
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/gi, "")
    .replace(/`/g, "")
    .trim();
  const jsonText = extractCurationJsonObject(trimmed);
  if (!jsonText) throw new Error("No JSON object found in model output");
  return JSON.parse(jsonText);
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * POST /api/recommendations
 * Deep AI Recommendation Pipeline: Profiler -> Brain -> Engine
 * Powered by Gemini 2.5 Flash
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { prompt, favoriteArtists = [], genres = [], recentTrackId } = body;

  try {
    if (!googleApiKey) {
      throw new Error("API key missing");
    }

    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(googleApiKey);
    const model = genAI.getGenerativeModel({ 
      model: RECOMMENDATIONS_MODEL,
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

        // Generate Persona — JSON-only so we don't embed chain-of-thought into Phase 2
        const profilePrompt = `Based on this music history and channel list, finish this sentence (one line, no markdown):
"The user is a [DESCRIPTIVE TRAITS] music enthusiast who balances [STYLE A] with [STYLE B]."

History: [${rawHistoryString}]
Channels: [${channelString}]

Return ONLY valid JSON in this exact shape (the full sentence as the value of "persona"):
{"persona":"The user is a ..."}`;
        
        const textModel = genAI.getGenerativeModel({
          model: RECOMMENDATIONS_MODEL,
          generationConfig: {
            temperature: 0.3,
            responseMimeType: "application/json",
            maxOutputTokens: 512,
          },
        });
        const profileResult = await textModel.generateContent(profilePrompt);
        const profileRaw = normalizeJsonish(profileResult.response.text().trim());
        const profileJson = extractPersonaJsonObject(profileRaw);
        try {
          if (profileJson) {
            const parsed = JSON.parse(profileJson) as { persona?: string };
            if (parsed.persona?.trim()) userPersona = parsed.persona.trim();
          }
        } catch {
          const fallback = profileRaw.replace(/^[\s\S]*?The user is a/m, "The user is a").split("\n")[0]?.trim();
          if (fallback?.startsWith("The user is a")) userPersona = fallback.replace(/^["']|["']$/g, "");
        }
        console.log("[Recommendations] Persona Generated:", userPersona);
      } catch (e) {
        console.warn("[Recommendations] Profiler failed, using default persona.");
      }
    }

    // ── PHASE 2: THE BRAIN ──────────────────────────────────────────────
    // Generate the playlist based on Persona + Current Prompt
    console.log("[Recommendations] Phase 2: Curation via Gemini 2.5 Flash...");
    const activePrompt = prompt || "Create a personalized discovery mix.";
    
    const curatorPrompt = `You are a music recommendation engine. Output ONLY raw JSON, no markdown, no explanation.
User profile: ${sanitizePersonaForPrompt(userPersona)}
Request: ${activePrompt}

Generate exactly 20 songs. If the request implies a specific language, use it for all 20 tracks.
Return this exact structure with real values (not placeholders):
{"primaryLanguage":"English","tracks":[{"title":"Song Name","artist":"Artist Name"}]}`;

    const curateResult = await model.generateContent(curatorPrompt);
    const rawCuration = curateResult.response.text();

    let curationObj: { tracks?: unknown[]; primaryLanguage?: string };
    try {
      curationObj = parseCurationJson(rawCuration);
    } catch (e) {
      const preview = rawCuration.length > 2000 ? rawCuration.slice(0, 2000) + "…" : rawCuration;
      console.error("[Recommendations] Final JSON Parse Failed:", preview);
      throw new Error("Model output was malformed even after surgical extraction");
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
          // Trust the search: the query already includes `${targetContext}` (e.g. Sinhala / English).
          // Do NOT require that word in the *video title* — real titles rarely contain "english",
          // "mixed", or "sinhala", and Sinhala songs are often Latin-transliterated on YouTube.

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
    console.error("[Recommendations] Fatal Gemini Error:", error);

    // Fallback: If Gemini fails (429 quota, missing key, etc.), get related tracks from YouTube Music
    if (recentTrackId) {
      console.log(`[Recommendations] Falling back to YouTube Music Related Tracks for: ${recentTrackId}`);
      try {
        const { getRelatedTracksRobust } = await import("@/lib/youtubeMusicRelated");
        const rawSuggestions = await getRelatedTracksRobust(recentTrackId);

        const fallbackRecommendations = rawSuggestions.slice(0, 10).map((t: any) => ({
          youtubeId: t.youtubeId,
          title: t.title,
          artist: t.artists ? t.artists[0]?.name : "Unknown Artist",
          thumbnail: t.thumbnail || t.thumbnailUrl || "",
          duration: t.duration || "0:00",
          reason: ""
        })).filter((t: any) => t.youtubeId && t.youtubeId !== recentTrackId);

        if (fallbackRecommendations.length > 0) {
          return NextResponse.json({ recommendations: fallbackRecommendations });
        }
      } catch (fallbackError: any) {
        console.error("[Recommendations] Fallback recommendation failed:", fallbackError);
      }
    }

    return NextResponse.json({ error: "Recommendation pipeline failed", detail: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
