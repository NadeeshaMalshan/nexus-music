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

// ─── iTunes Artwork ─────────────────────────────────────────────────────────
async function getArtwork(artist: string, title: string): Promise<string | undefined> {
  // 1. Clean terms
  const clean = (s: string) => s.replace(/\(.*\)|\[.*\]/g, "").replace(/feat\..*/gi, "").trim();
  const cArtist = clean(artist);
  const cTitle = clean(title);
  
  try {
    const searchTerm = encodeURIComponent(`${cArtist} ${cTitle}`);
    const res = await fetch(`https://itunes.apple.com/search?term=${searchTerm}&limit=1&entity=song`, {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(4000)
    });
    if (res.ok) {
      const data = await res.json();
      if (data.results?.length > 0) {
        return data.results[0].artworkUrl100.replace("100x100bb.jpg", "800x800bb.jpg");
      }
    }
  } catch {}

  // 2. Fallback to YTM search for thumb
  try {
     const { getYTMusic } = await import("./ytmClient");
     const yt = await getYTMusic();
     const results = await yt.searchSongs(`${cArtist} ${cTitle}`);
     if (results && results.length > 0) {
        const best: any = results[0];
        return best.thumbnails?.[best.thumbnails.length - 1]?.url || best.thumbnail?.url || undefined;
     }
  } catch {}

  return undefined;
}

// ─── ACRCloud Audio Fingerprint ──────────────────────────────────────────────
/**
 * Fetches a short audio chunk from a URL and identifies it via ACRCloud.
 * Used for Coachella, Ultra, and any festival without a metadata API.
 */
async function identifyViaACRCloud(audioUrl: string): Promise<LiveMetadata | null> {
  if (!ACR_KEY || !ACR_SECRET) return null;

  try {
    // Fetch a 15-second chunk from the live stream (range header)
    const audioRes = await fetch(audioUrl, {
      headers: { Range: "bytes=0-307200" }, // ~15s at 160kbps
      signal: AbortSignal.timeout(8000),
    });
    if (!audioRes.ok) return null;

    const audioBuffer = Buffer.from(await audioRes.arrayBuffer());

    // Build ACRCloud HMAC signature
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

// ─── YouTube HLS Audio URL ────────────────────────────────────────────────────
/**
 * Gets the direct audio stream URL from a YouTube live video ID.
 * Uses oEmbed + play-dl to resolve the HLS/DASH manifest.
 */
async function getYoutubeAudioStreamUrl(videoId: string): Promise<string | null> {
  try {
    const playdl = await import("play-dl");
    const info = await playdl.video_info(`https://www.youtube.com/watch?v=${videoId}`);
    const formats = info.format?.filter((f: any) => f.mimeType?.includes("audio") && f.url);
    if (formats && formats.length > 0) {
      // Pick lowest bitrate for quick sampling
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
  // 1. Triton Digital
  try {
    const res = await fetch(
      `https://np.tritondigital.com/public/nowplaying?mountName=${mountName}&numberToFetch=1`,
      { 
        cache: "no-store", 
        headers: { 
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Referer": "https://www.tomorrowland.com/"
        },
        signal: AbortSignal.timeout(5000)
      }
    );
    if (res.ok) {
      const xml = await res.text();
      const artist =
        xml.match(/<property name="track_artist_name">[\s\S]*?<!\[CDATA\[(.*?)\]\]>[\s\S]*?<\/property>/)?.[1] ||
        xml.match(/<property name="now_playing_artist">(.*?)<\/property>/)?.[1];
      const title =
        xml.match(/<property name="cue_title">[\s\S]*?<!\[CDATA\[(.*?)\]\]>[\s\S]*?<\/property>/)?.[1] ||
        xml.match(/<property name="now_playing_title">(.*?)<\/property>/)?.[1];

      if (artist && title) {
        const a = artist.trim();
        const t = title.trim();

        // If the API returns generic branding, try ACRCloud as a better fallback
        if ((a.toLowerCase() === "tomorrowland" || a.toLowerCase().includes("world radio")) && videoId) {
           const streamUrl = await getYoutubeAudioStreamUrl(videoId);
           if (streamUrl) {
             const acr = await identifyViaACRCloud(streamUrl);
             if (acr) return { ...acr, source: "One World Radio (Audio Fingerprint)" };
           }
        }

        const sourceName = mountName.includes("DAYBREAK")
          ? "Daybreak Sessions"
          : mountName.includes("ANTHEMS")
          ? "TML Anthems"
          : "One World Radio";
        const artwork = await getArtwork(a, t);
        return { artist: a, title: t, source: sourceName, artwork };
      }
    }
  } catch (err) {
    console.warn(`[Triton] Fetch failed for ${mountName}`, err);
  }

  // 1.1 Try OWR_INTERNATIONAL (sometimes different mount is active)
  if (mountName === "OWR_INTERNATIONAL_ADP") {
     try {
       const res = await fetch(
         `https://np.tritondigital.com/public/nowplaying?mountName=OWR_INTERNATIONAL&numberToFetch=1`,
         { cache: "no-store", headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(5000) }
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
           if (a.toLowerCase() !== "tomorrowland") {
             const artwork = await getArtwork(a, t);
             return { artist: a, title: t, source: "One World Radio", artwork };
           }
         }
       }
     } catch {}
  }

  // 2. TuneIn fallback (OWR only)
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

// ─── YouTube Title Parser (fallback) ─────────────────────────────────────────
/**
 * Parses "Artist Name - Song Title | Festival 2025" style YouTube titles.
 * Coachella often formats: "Artist LIVE | Stage | Coachella 2025"
 */
async function parseLiveTitle(rawTitle: string, festival: string): Promise<LiveMetadata | null> {
  if (!rawTitle) return null;

  // Remove stage names, year tags, "LIVE", and festival branding from title
  const cleaned = rawTitle
    .replace(/coachella\s*\d*/gi, "")
    .replace(/ultra\s*(music festival)?\s*\d*/gi, "")
    .replace(/tomorrowland\s*\d*/gi, "")
    .replace(/\blive\b/gi, "")
    .replace(/weekend\s*[12]/gi, "")
    .replace(/\|\s*(mainstage|sahara|coachella stage|outdoor theatre|gobi|mojave|sonora|yuma|GV\d)\b.*/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  // Try "Artist - Song" format first
  const dashParts = cleaned.split(/\s*-\s*/);
  if (dashParts.length >= 2) {
    const artist = dashParts[0].trim();
    const song   = dashParts.slice(1).join(" - ").split(/[|(]/)[0].trim();
    if (artist && song && artist.length < 60 && song.length < 80) {
      const artwork = await getArtwork(artist, song);
      return { artist, title: song, source: festival, artwork };
    }
  }

  // If title before "|" looks like just an artist name, return partial info
  const pipeParts = cleaned.split("|");
  const artistOnly = pipeParts[0].trim();
  if (artistOnly && artistOnly.length < 60) {
    const artwork = await getArtwork(artistOnly, festival);
    return { artist: artistOnly, title: `Live at ${festival}`, source: festival, artwork };
  }

  return null;
}

// ─── Coachella: ACRCloud + title fallback ────────────────────────────────────
async function getCoachellaMetadata(videoId?: string, rawTitle?: string): Promise<LiveMetadata | null> {
  // 1. ACRCloud audio fingerprint (most accurate)
  if (videoId && ACR_KEY && ACR_SECRET) {
    const streamUrl = await getYoutubeAudioStreamUrl(videoId);
    if (streamUrl) {
      const acr = await identifyViaACRCloud(streamUrl);
      if (acr) return { ...acr, source: "Coachella (ACRCloud)" };
    }
  }

  // 2. YouTube title parse (fallback)
  if (rawTitle) {
    const parsed = await parseLiveTitle(rawTitle, "Coachella");
    if (parsed) return parsed;
  }

  return null;
}

// ─── Ultra / UMF ─────────────────────────────────────────────────────────────
async function getUltraMetadata(videoId?: string, rawTitle?: string): Promise<LiveMetadata | null> {
  if (videoId && ACR_KEY && ACR_SECRET) {
    const streamUrl = await getYoutubeAudioStreamUrl(videoId);
    if (streamUrl) {
      const acr = await identifyViaACRCloud(streamUrl);
      if (acr) return { ...acr, source: "Ultra Music Festival (ACRCloud)" };
    }
  }
  if (rawTitle) return parseLiveTitle(rawTitle, "Ultra Music Festival");
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

  // 1. Tomorrowland / One World Radio
  const isTML = q.includes("tomorrowland") || t.includes("tomorrowland") || q.includes("one world") || t.includes("one world") || q.includes("owr") || t.includes("owr");
  
  if (isTML) {
    if (q.includes("daybreak") || t.includes("daybreak"))
      return getTomorrowlandMetadata("OWR_DAYBREAK", videoId);
    if (q.includes("anthem") || t.includes("anthem"))
      return getTomorrowlandMetadata("OWR_ANTHEMS", videoId);
      
    // Default OWR
    const data = await getTomorrowlandMetadata("OWR_INTERNATIONAL_ADP", videoId);
    if (data && data.artist.toLowerCase() !== "tomorrowland") return data;
    
    // Fallback search
    return getTomorrowlandMetadata("OWR_INTERNATIONAL", videoId);
  }

  // 2. Coachella
  if (q.includes("coachella") || t.includes("coachella")) {
    return getCoachellaMetadata(videoId, currentTitle);
  }

  // 3. Ultra / UMF
  if (q.includes("ultra") || q.includes("umf") || t.includes("ultra") || t.includes("umf")) {
    return getUltraMetadata(videoId, currentTitle);
  }

  return null;
}
