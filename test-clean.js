function cleanLyricsQuery(track, artist) {
  let cleanArtist = artist
    .replace(/\s*-\s*Topic$/i, "")
    .replace(/\s*VEVO$/i, "")
    .trim();
  
  let cleanTrack = track
    .replace(/\s*[\(\[][^)]*?(official|music|video|audio|lyric|visualizer|remaster|edit|version|feat|ft|with|clip|cover|tribute|karaoke|instrumental|hd|4k|mv|m\/v)[^)]*?[\)\]]/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  const hyphenIndex = cleanTrack.indexOf(" - ");
  if (hyphenIndex !== -1) {
    const part1 = cleanTrack.substring(0, hyphenIndex).trim();
    const part2 = cleanTrack.substring(hyphenIndex + 3).trim();
    
    const part1Lower = part1.toLowerCase();
    const artistLower = cleanArtist.toLowerCase();
    
    if (part1Lower.includes(artistLower) || artistLower.includes(part1Lower)) {
      cleanTrack = part2;
    } else if (artistLower === "unknown artist" || artistLower === "unknown") {
      cleanTrack = part2;
      cleanArtist = part1;
    } else {
      cleanTrack = part2;
    }
  }

  cleanTrack = cleanTrack.replace(/\s+(feat|ft|with)\.?\s+.*$/gi, "").trim();

  return { track: cleanTrack, artist: cleanArtist };
}

console.log(cleanLyricsQuery("Rolling in the Deep", "Adele"));
console.log(cleanLyricsQuery("Rolling in the Deep — Adele", "Adele"));
