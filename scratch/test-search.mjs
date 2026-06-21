import { searchVideosRobust } from "../src/lib/ytmSearchService.ts";

function cleanSongTitleForVideoSearch(title) {
  return title
    .replace(/\s*[\(\[][^)]*?(radio|edit|audio|lyric|visualizer|remaster|version|feat|ft|with|clip|cover|tribute|karaoke|instrumental|hd|4k|video|mv|m\/v)[^)]*?[\)\]]/gi, "")
    .replace(/\s+-\s+.*$/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

async function testMatch(artist, title) {
  const cleanTitle = cleanSongTitleForVideoSearch(title);
  const cleanArtist = artist.replace(/\s*-\s*Topic\s*$/i, "").trim();
  const videoQuery = `${cleanArtist} ${cleanTitle} official music video`.trim();

  console.log(`\nTesting search for: "${videoQuery}"`);
  
  const searchResults = await searchVideosRobust(videoQuery);
  if (!searchResults || searchResults.length === 0) {
    console.log("No results found.");
    return;
  }

  let bestMatch = null;
  let backupMatch = null;
  const queryArtistLower = cleanArtist.toLowerCase();
  const queryTitleLower = cleanTitle.toLowerCase();

  const channelBlacklist = [
    "fan club", "fanclub", "karaoke", "lyrics", "tribute", 
    "cover", "upscaled", "bootleg", "fan page", "fanpage", 
    "nightcore", "slowed", "reverb", "loop", "mashup", "unofficial"
  ];

  const titleBlacklist = [
    "unofficial", "fan-made", "fanmade", "tribute", "cover", 
    "bootleg", "karaoke", "instrumental", "preview", "teaser"
  ];

  for (const res of searchResults) {
    const titleLower = res.title.toLowerCase();
    const artistLower = res.artist.toLowerCase();
    const cleanResultArtist = artistLower.replace(/\s*-\s*Topic\s*$/i, "").trim();
    const cleanResultTitle = cleanSongTitleForVideoSearch(res.title).toLowerCase();
    
    const hasBlacklistedArtistWord = channelBlacklist.some(word => cleanResultArtist.includes(word));
    const hasBlacklistedTitleWord = titleBlacklist.some(word => titleLower.includes(word));
    
    if (hasBlacklistedArtistWord || hasBlacklistedTitleWord) {
      continue;
    }
    
    const artistMatches = cleanResultArtist.includes(queryArtistLower) || queryArtistLower.includes(cleanResultArtist);
    const titleMatches = cleanResultTitle.includes(queryTitleLower) || queryTitleLower.includes(cleanResultTitle);
    
    if (artistMatches && titleMatches) {
      const isOfficialMV = titleLower.includes("official") && (titleLower.includes("video") || titleLower.includes("m/v") || titleLower.includes("mv"));
      const isMV = titleLower.includes("music video") || titleLower.includes("m/v") || titleLower.includes("mv");
      const isLyricOrAudio = titleLower.includes("lyric") || titleLower.includes("audio") || titleLower.includes("karaoke");
      
      if (isOfficialMV && !isLyricOrAudio) {
        bestMatch = res;
        break;
      } else if (isMV && !isLyricOrAudio) {
        bestMatch = res;
      } else if (!backupMatch && !isLyricOrAudio) {
        backupMatch = res;
      }
    }
  }

  const finalMatch = bestMatch || backupMatch;
  if (finalMatch) {
    console.log(`SELECTED: "${finalMatch.title}" - "${finalMatch.artist}" (${finalMatch.youtubeId})`);
  } else {
    console.log("No clean match found, would fall back to original video ID.");
  }
}

async function run() {
  await testMatch("Jennifer Lopez", "On The Floor (Radio Edit)");
  await testMatch("Jennifer Lopez", "Save Me Tonight");
}

run();
