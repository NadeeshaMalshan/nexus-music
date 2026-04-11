import { chooseFormat, getInfo } from "@distube/ytdl-core";
import play from "play-dl";

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/**
 * Best-effort direct googlevideo URL for a YouTube video. Tries @distube/ytdl-core first,
 * then play-dl (often succeeds when the other fails — especially on serverless / Vercel).
 */
export async function getYoutubeDirectAudioUrl(videoId: string): Promise<string | null> {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

  try {
    const info = await getInfo(videoUrl, {
      requestOptions: { headers: { "User-Agent": CHROME_UA, "Accept-Language": "en-US,en;q=0.9" } },
    });
    const format = chooseFormat(info.formats, {
      quality: "highestaudio",
      filter: "audioonly",
    });
    if (format?.url) return format.url;
  } catch (e) {
    console.warn("[youtubeDirectAudioUrl] ytdl:", e instanceof Error ? e.message : e);
  }

  try {
    const stream = await play.stream(videoUrl, { quality: 2 });
    const url =
      stream && typeof stream === "object" && stream !== null && "url" in stream
        ? String((stream as unknown as { url: string }).url)
        : "";
    if (url) return url;
  } catch (e) {
    console.warn("[youtubeDirectAudioUrl] play-dl:", e instanceof Error ? e.message : e);
  }

  return null;
}
