import { NextResponse } from "next/server";
import { HfInference } from "@huggingface/inference";
import { Redis } from "@upstash/redis";

// Initialize Redis client if environment variables are present
const redis = (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

const hf = new HfInference(process.env.HUGGINGFACE_TOKEN || process.env.HF_TOKEN);

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
    // 1. CACHE CHECK
    if (redis) {
      const cached = await redis.get(`song_facts:${videoId}`);
      if (cached) {
        return NextResponse.json(typeof cached === 'string' ? JSON.parse(cached) : cached);
      }
    }

    // 2. IF CACHE MISS -> Fetch Genius
    const rawData = await fetchGeniusRawData(track, artist);
    if (!rawData || (!rawData.about && !rawData.title)) {
       return NextResponse.json(FALLBACK_FACTS);
    }

    // 3. Hugging Face Fact Extraction
    const systemPrompt = `You are an expert music historian. Analyze this song data: 
Title: ${rawData.title}
Artist: ${rawData.artist}
Background: ${rawData.about || "No background available."}
Release Date: ${rawData.releaseDate || "Unknown"}

Extract 5 to 7 'Mysterious Facts' or 'Did You Know?' trivia points about its hidden meaning, production, or backstory. 
Write them as short, engaging, single sentences.
Output ONLY a valid JSON array of strings: ["Fact 1", "Fact 2"]. 
No extra text, no markdown code blocks.`;

    const response = await hf.textGeneration({
      model: "HuggingFaceH4/zephyr-7b-beta",
      inputs: `<|system|>\n${systemPrompt}\n<|assistant|>\n`,
      parameters: {
        max_new_tokens: 500,
        return_full_text: false,
      },
    });

    try {
      let factsContent = response.generated_text.trim();
      // Basic cleanup in case model returns markdown or extra text
      if (factsContent.includes("[") && factsContent.includes("]")) {
        factsContent = factsContent.substring(factsContent.indexOf("["), factsContent.lastIndexOf("]") + 1);
      }
      
      const facts = JSON.parse(factsContent);
      if (Array.isArray(facts) && facts.length > 0) {
        // 4. CACHE SAVE & RETURN
        if (redis) {
          await redis.set(`song_facts:${videoId}`, JSON.stringify(facts));
        }
        return NextResponse.json(facts);
      }
    } catch (parseError) {
      console.error("HF JSON parse error:", parseError, "Content:", response.generated_text);
    }

    return NextResponse.json(FALLBACK_FACTS);
  } catch (error) {
    console.error("Did You Know API error:", error);
    return NextResponse.json(FALLBACK_FACTS);
  }
}
