import { getYoutubeDirectAudioUrl } from "./src/lib/youtubeDirectAudioUrl";

async function main() {
  try {
    console.log("Fetching direct URL for dQw4w9WgXcQ...");
    const url = await getYoutubeDirectAudioUrl("dQw4w9WgXcQ", false);
    console.log("Direct URL:", url);
  } catch (e) {
    console.error("Failed:", e);
  }
}
main();
