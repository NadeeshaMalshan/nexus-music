export type LiveMetadata = {
  title: string;
  artist: string;
  source: string;
};

/**
 * Tomorrowland One World Radio Scraper
 * Uses the StreamTheWorld metadata endpoint
 */
async function getTomorrowlandOWR(): Promise<LiveMetadata | null> {
  // 1. Primary: Triton Digital (ADP Mount)
  try {
    const res = await fetch("https://np.tritondigital.com/public/nowplaying?mountName=OWR_INTERNATIONAL_ADP&numberToFetch=1", { 
      cache: 'no-store',
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (res.ok) {
      const xml = await res.text();
      // Triton ADP XML uses track_artist_name and cue_title
      const artist = xml.match(/<property name="track_artist_name"><!\[CDATA\[(.*?)\]\]><\/property>/)?.[1] || 
                     xml.match(/<property name="now_playing_artist">(.*?)<\/property>/)?.[1];
      const title = xml.match(/<property name="cue_title"><!\[CDATA\[(.*?)\]\]><\/property>/)?.[1] || 
                    xml.match(/<property name="now_playing_title">(.*?)<\/property>/)?.[1];
      
      if (artist && title) {
        return { artist: artist.trim(), title: title.trim(), source: "TML OWR (Triton)" };
      }
    }
  } catch (e) {
    console.warn("Triton Fetch Failed, trying TuneIn...");
  }

  // 2. Fallback: TuneIn Metadata (Scraping the verified station page)
  try {
    const res = await fetch("https://tunein.com/radio/Tomorrowland-One-World-Radio-s307749/", {
      cache: 'no-store',
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (res.ok) {
      const html = await res.text();
      // TuneIn often has "Artist - Song" in the title or og:description
      const match = html.match(/<meta property="og:description" content="(.*?) - (.*?)"/);
      if (match) {
        return { 
          artist: match[1]?.trim() || "Tomorrowland", 
          title: match[2]?.trim() || "One World Radio", 
          source: "TML OWR (TuneIn)" 
        };
      }
    }
  } catch (e) {
    console.error("TuneIn Fallback Failed:", e);
  }

  return null;
}

/**
 * General YouTube Live Title Parser
 */
function parseLiveTitle(title: string, festival: string): LiveMetadata | null {
  if (!title) return null;
  // Patterns like "Artist - Track | ...", "Artist - Track (...)", "Artist - Track"
  const parts = title.split(/[|(\]\[]/)[0].split(" - ");
  
  if (parts.length >= 2) {
    return {
      artist: parts[0].trim(),
      title: parts[1].trim(),
      source: festival
    };
  }
  return null;
}

export async function getLiveMetadata(query: string, currentTitle: string): Promise<LiveMetadata | null> {
  const q = (query || "").toLowerCase();
  const t = (currentTitle || "").toLowerCase();
  
  // 1. Tomorrowland One World Radio
  if ((q.includes("tomorrowland") && q.includes("radio")) || 
      (t.includes("tomorrowland") && t.includes("radio"))) {
    return await getTomorrowlandOWR();
  }

  // 2. Coachella
  if (q.includes("coachella") || t.includes("coachella")) {
    return parseLiveTitle(currentTitle, "Coachella");
  }

  // 3. Ultra / UMF
  if (q.includes("ultra") || q.includes("umf") || t.includes("ultra") || t.includes("umf")) {
    return parseLiveTitle(currentTitle, "Ultra Music Festival");
  }

  // 4. Tomorrowland Mainstage
  if (q.includes("tomorrowland") || t.includes("tomorrowland")) {
    return parseLiveTitle(currentTitle, "Tomorrowland Mainstage");
  }

  return null;
}
