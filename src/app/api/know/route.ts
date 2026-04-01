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
        const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
        // If the cached version is the OLD static fallback, ignore it and re-generate
        if (!parsed[0]?.includes("hidden backstory")) {
          return NextResponse.json(parsed);
        }
      }
    }

    // 2. IF CACHE MISS -> Fetch Genius
    const rawData = await fetchGeniusRawData(track, artist);
    
    // 3. AI Fact Generation (Dual Model Strategy)
    const prompt = `Generate 5-7 unique music history facts or "Did You Know?" trivia for: "${track}" by "${artist}". ${rawData?.about ? `Use this context: ${rawData.about}` : "Use your internal knowledge."} Output ONLY a JSON array of strings. No extra text.`;

    let facts: string[] | null = null;
    
    const tryModel = async (model: string) => {
      try {
        const res = await hf.textGeneration({
          model,
          inputs: `[INST] ${prompt} [/INST]`,
          parameters: { max_new_tokens: 500, temperature: 0.7 },
        });
        let content = res.generated_text.trim();
        if (content.includes("[") && content.includes("]")) {
          content = content.substring(content.indexOf("["), content.lastIndexOf("]") + 1);
        }
        const parsed = JSON.parse(content);
        return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
      } catch (e) {
        console.error(`Model ${model} failed:`, e);
        return null;
      }
    };

    // Primary: Mistral
    facts = await tryModel("mistralai/Mistral-7B-Instruct-v0.2");
    
    // Secondary: Zephyr (Better for instruction following if Mistral is busy)
    if (!facts) {
      facts = await tryModel("HuggingFaceH4/zephyr-7b-beta");
    }

    if (facts) {
      if (redis) {
        await redis.set(`song_facts:${videoId}`, JSON.stringify(facts), { ex: 604800 });
      }
      return NextResponse.json(facts);
    }

    return NextResponse.json([
      `The production of "${track}" is a testament to ${artist}'s unique evolution in the music industry.`,
      `Many fans interpret the lyrics of "${track}" as a deeply personal reflection of ${artist}'s journey.`,
      `Critics have praised the innovative soundscapes and melodic complexity found throughout "${track}".`,
      `The creative process behind "${track}" involved intensive collaboration and sonic experimentation.`,
      `Since its release, "${track}" has become a significant milestone in ${artist}'s discography.`
    ]);
  } catch (error) {
    console.error("Did You Know API error:", error);
    return NextResponse.json([
      "The story behind this track is currently being compiled from various musical archives.",
      "Musical history is rich with hidden details about tracks like this one.",
      "Stay tuned as our AI uncovers more unique trivia about this artist's creative process."
    ]);
  }
}
