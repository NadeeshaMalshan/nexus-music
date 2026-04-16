import { NextResponse } from "next/server";
// Migrated from HuggingFace to Gemini API
import { Redis } from "@upstash/redis";

// Initialize Redis client if environment variables are present
const redis = (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

const googleApiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

const FALLBACK_FACTS = [
  "Did you know this song has a hidden backstory that fans are still decoding?",
  "The production of this track involved layers of experimental sounds and unique textures.",
  "Listen closely to the bridge; many believe it contains a subtle message from the artist.",
  "This track's unique sound was heavily influenced by the artist's personal experiences during its creation.",
  "Behind the scenes, the recording session for this song was described as intense and deeply emotional."
];

async function fetchGeniusRawData(track: string, artist: string) {
  const token = process.env.GENIUS_ACCESS_TOKEN;
  if (!token) return null;

  try {
    const searchRes = await fetch(`https://api.genius.com/search?q=${encodeURIComponent(`${artist} ${track}`)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();
    const songId = searchData.response?.hits?.[0]?.result?.id;
    if (!songId) return null;

    const detailsRes = await fetch(`https://api.genius.com/songs/${songId}?text_format=plain`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!detailsRes.ok) return null;
    const detailsData = await detailsRes.json();
    const song = detailsData.response?.song;
    
    return {
      title: song.title,
      artist: song.primary_artist?.name,
      about: song.description?.plain,
      releaseDate: song.release_date_for_display,
    };
  } catch (e) {
    console.error("Genius fetch error:", e);
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const track = searchParams.get("track")?.trim();
  const artist = searchParams.get("artist")?.trim();
  const videoId = searchParams.get("videoId")?.trim();

  if (!track || !artist || !videoId) {
    return NextResponse.json({ error: "Missing required params" }, { status: 400 });
  }

  try {
    // 1. CACHE CHECK - Incorporating Artist/Track for unique live stream identification
    const cacheKey = `song_facts:${videoId}:${artist.toLowerCase().replace(/[^a-z0-t]/g, '')}:${track.toLowerCase().replace(/[^a-z0-t]/g, '')}`;
    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
        // If the cached version is the OLD static fallback, ignore it and re-generate
        if (!parsed[0]?.includes("hidden backstory")) {
          return NextResponse.json(parsed);
        }
      }
    }

    // 2. IF CACHE MISS -> Fetch Genius
    const rawData = await fetchGeniusRawData(track, artist);
    
    // 3. AI Fact Generation (Gemini)
    const prompt = `Generate 5-7 immersive, highly specific "Behind the Lyrics" story snippets for the track "${track}" by "${artist}". 
Focus on:
1. Recording studio secrets and behind-the-scenes moments.
2. The specific inspiration or events that led to the lyrics.
3. The song's legacy and what happened after release.

${rawData?.about ? `CRITICAL SOURCE MATERIAL: ${rawData.about}` : "Use your advanced musical knowledge for this specific track."}

RULES:
- IMPORTANT: ALL SNIPPETS MUST BE IN THE ENGLISH LANGUAGE ONLY.
- NEVER use generic PR phrases (e.g., "is a testament to", "significant milestone", "reflection of journey").
- Each snippet must be a unique, fact-heavy, single sentence.
- Output ONLY a valid JSON array of strings. No intro/outro text, no code blocks.`;

    let facts: string[] | null = null;
    
    if (googleApiKey) {
      try {
        const { GoogleGenerativeAI } = await import("@google/generative-ai");
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("GEMINI_API_KEY is not defined");
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" });

        const result = await model.generateContent(prompt);
        const content = result.response.text().trim();
        
        // Robustly extract JSON array even if model wraps it in markdown backticks
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            if (Array.isArray(parsed) && parsed.length > 0) {
              facts = parsed;
            }
          } catch (e) {
            console.warn("[Know] Gemini JSON parsing failed.");
          }
        }
      } catch (e) {
        console.error("Gemini fact generation failed:", e);
      }
    }

    if (facts) {
      if (redis) {
        await redis.set(cacheKey, JSON.stringify(facts), { ex: 604800 });
      }
      return NextResponse.json(facts);
    }

    // 4. SMART FALLBACK: If AI fails, use Genius Description directly
    if (rawData?.about && rawData.about.length > 50 && !rawData.about.includes("is a song by")) {
      // Split description into sentences (roughly)
      const storySnippets = (rawData.about as string)
        .split(/[.!?]\s+/)
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 20 && s.length < 300)
        .slice(0, 7);
      
      if (storySnippets.length > 0) {
        if (redis) {
          await redis.set(cacheKey, JSON.stringify(storySnippets), { ex: 604800 });
        }
        return NextResponse.json(storySnippets);
      }
    }

    // 5. Hard Fallback (Last resort)
    return NextResponse.json([
      `${track} by ${artist} is recognized for its distinctive production and the artistic vision ${artist} brought to the project.`,
      `The creative direction of "${track}" showcases many of the signatures that define ${artist}'s sound.`,
      `Critics and fans alike have noted that "${track}" represents a key moment in ${artist}'s musical development.`,
      `The recording of "${track}" involved hours of dedicated studio performance to capture the exact mood ${artist} intended.`,
      `Since its debut, "${track}" continues to resonate as a significant entry in ${artist}'s performance history.`
    ]);
  } catch (error) {
    console.error("Did You Know API error:", error);
    return NextResponse.json([
      "Exploring the deeper context and creative journey of this track...",
      "Connecting with music archives to bring you the full story of this performance.",
      "Uncovering the unique trivia and behind-the-scenes moments for this artist."
    ]);
  }
}
