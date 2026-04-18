export type LiveMetadata = {
  title: string;
  artist: string;
  source: string;
  artwork?: string;
};

// ─── Env ──────────────────────────────────────────────────────────────────────
const ACR_HOST   = process.env.ACR_HOST   ?? "identify-eu-west-1.acrcloud.com";
const ACR_KEY    = process.env.ACR_ACCESS_KEY    ?? "";
const ACR_SECRET = process.env.ACR_ACCESS_SECRET ?? "";

// ─── YouTube Music Artwork ───────────────────────────────────────────────────
async function getArtwork(artist: string, title: string): Promise<string | undefined> {
  // Clean terms
  const clean = (s: string) => s.replace(/\(.*\)|\[.*\]/g, "").replace(/feat\..*/gi, "").trim();
  const cArtist = clean(artist);
  const cTitle = clean(title);

  try {
     const { getYTMusic } = await import("./ytmClient");
     const yt = await getYTMusic();
     const results = await yt.searchSongs(`${cArtist} ${cTitle}`);
     if (results && results.length > 0) {
        const best: any = results[0];
        return best.thumbnails?.[best.thumbnails.length - 1]?.url || best.thumbnail?.url || undefined;
     }
  } catch (e) {
    console.warn("[Artwork] YTM search failed:", e);
  }

  return undefined;
}

// ─── ACRCloud Audio Fingerprint ──────────────────────────────────────────────
/**
 * Fetches a short audio chunk from a URL and identifies it via ACRCloud.
 * Used for Tomorrowland fallbacks when the API returns generic branding.
 */
async function identifyViaACRCloud(audioUrl: string): Promise<LiveMetadata | null> {
  if (!ACR_KEY || !ACR_SECRET) return null;

  try {
    const audioRes = await fetch(audioUrl, {
      headers: { Range: "bytes=0-307200" }, // ~15s
      signal: AbortSignal.timeout(8000),
    });
    if (!audioRes.ok) return null;

    const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
    const crypto = await import("node:crypto");
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const stringToSign = ["POST", "/v1/identify", ACR_KEY, "audio", "1", timestamp].join("\n");
    const signature = crypto
      .createHmac("sha1", ACR_SECRET)
      .update(Buffer.from(stringToSign, "utf-8"))
      .digest("base64");

    const form = new FormData();
    form.append("sample", new Blob([audioBuffer], { type: "audio/mpeg" }), "sample.mp3");
    form.append("access_key", ACR_KEY);
    form.append("data_type", "audio");
    form.append("signature_version", "1");
    form.append("signature", signature);
    form.append("sample_bytes", audioBuffer.length.toString());
    form.append("timestamp", timestamp);

    const acrRes = await fetch(`https://${ACR_HOST}/v1/identify`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(10000),
    });
    if (!acrRes.ok) return null;

    const result = await acrRes.json();
    if (result.status?.code !== 0) return null;

    const music = result.metadata?.music?.[0];
    if (!music) return null;

    const artist = music.artists?.map((a: any) => a.name).join(", ") ?? "Unknown";
    const title  = music.title ?? "Unknown";
    const artwork = await getArtwork(artist, title);
    return { artist, title, source: "ACRCloud", artwork };
  } catch (e) {
    console.warn("[ACRCloud] Identify failed:", e);
    return null;
  }
}

// ─── YouTube Stream Resolver ─────────────────────────────────────────────────
async function getYoutubeAudioStreamUrl(videoId: string): Promise<string | null> {
  try {
    const playdl = await import("play-dl");
    const info = await playdl.video_info(`https://www.youtube.com/watch?v=${videoId}`);
    const formats = info.format?.filter((f: any) => f.mimeType?.includes("audio") && f.url);
    if (formats && formats.length > 0) {
      const sorted = [...formats].sort((a: any, b: any) => (a.bitrate ?? 999999) - (b.bitrate ?? 999999));
      return sorted[0].url ?? null;
    }
  } catch (e) {
    console.warn("[LiveTracker] play-dl stream URL failed:", e);
  }
  return null;
}

// ─── Tomorrowland (Triton Digital) ───────────────────────────────────────────
async function getTomorrowlandMetadata(mountName = "OWR_INTERNATIONAL_ADP", videoId?: string): Promise<LiveMetadata | null> {
  try {
    const res = await fetch(
      `https://np.tritondigital.com/public/nowplaying?mountName=${mountName}&numberToFetch=1`,
      { 
        cache: "no-store", 
        headers: { 
          "User-Agent": "Mozilla/5.0",
          "Referer": "https://www.tomorrowland.com/"
        },
        signal: AbortSignal.timeout(5000)
      }
    );
    if (res.ok) {
      const xml = await res.text();
      const artist = xml.match(/<property name="track_artist_name">[\s\S]*?<!\[CDATA\[(.*?)\]\]>[\s\S]*?<\/property>/)?.[1] ||
                    xml.match(/<property name="now_playing_artist">(.*?)<\/property>/)?.[1];
      const title = xml.match(/<property name="cue_title">[\s\S]*?<!\[CDATA\[(.*?)\]\]>[\s\S]*?<\/property>/)?.[1] ||
                   xml.match(/<property name="now_playing_title">(.*?)<\/property>/)?.[1];

      if (artist && title) {
        const a = artist.trim();
        const t = title.trim();

        if ((a.toLowerCase() === "tomorrowland" || a.toLowerCase().includes("world radio")) && videoId) {
           const streamUrl = await getYoutubeAudioStreamUrl(videoId);
           if (streamUrl) {
             const acr = await identifyViaACRCloud(streamUrl);
             if (acr) return { ...acr, source: "One World Radio (Audio Fingerprint)" };
           }
        }

        const sourceName = mountName.includes("DAYBREAK") ? "Daybreak Sessions" : 
                           mountName.includes("ANTHEMS") ? "TML Anthems" : "One World Radio";
        const artwork = await getArtwork(a, t);
        return { artist: a, title: t, source: sourceName, artwork };
      }
    }
  } catch (err) {
    console.warn(`[Triton] Fetch failed for ${mountName}`, err);
  }

  // OWR Fallback
  if (mountName === "OWR_INTERNATIONAL_ADP") {
    try {
      const res = await fetch("https://tunein.com/radio/Tomorrowland-One-World-Radio-s307749/", {
        cache: "no-store",
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      if (res.ok) {
        const html = await res.text();
        const match = html.match(/<meta property="og:description" content="(.*?) - (.*?)"/);
        if (match) {
          const artist = match[1]?.trim() ?? "Tomorrowland";
          const title  = match[2]?.trim() ?? "One World Radio";
          const artwork = await getArtwork(artist, title);
          return { artist, title, source: "TML OWR (TuneIn)", artwork };
        }
      }
    } catch {}
  }

  return null;
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export async function getLiveMetadata(
  query: string,
  currentTitle: string,
  videoId?: string
): Promise<LiveMetadata | null> {
  const q = (query || "").toLowerCase();
  const t = (currentTitle || "").toLowerCase();

  const isTML = q.includes("tomorrowland") || t.includes("tomorrowland") || 
                q.includes("one world") || t.includes("one world") || 
                q.includes("owr") || t.includes("owr");
  
  if (isTML) {
    if (q.includes("daybreak") || t.includes("daybreak"))
      return getTomorrowlandMetadata("OWR_DAYBREAK", videoId);
    if (q.includes("anthem") || t.includes("anthem"))
      return getTomorrowlandMetadata("OWR_ANTHEMS", videoId);
      
    const data = await getTomorrowlandMetadata("OWR_INTERNATIONAL_ADP", videoId);
    if (data && data.artist.toLowerCase() !== "tomorrowland") return data;
    
    return getTomorrowlandMetadata("OWR_INTERNATIONAL", videoId);
  }

  return null;
}
