export function extractFeaturedArtists(rawTitle: string, baseArtist: string): { displayTitle: string; displayArtist: string } {
  if (!rawTitle) return { displayTitle: "", displayArtist: baseArtist || "" };
  
  const featMatch = rawTitle.match(/\b(?:feat\.|ft\.|featuring)\s+([^)\]]+)/i);
  const featured = featMatch ? featMatch[1].trim() : "";
  const displayTitle = rawTitle.replace(/\s*[([].*?[)\]]\s*/g, '').trim();
  const baseArtistClean = baseArtist || "Unknown Artist";
  
  const displayArtist = featured && !baseArtistClean.toLowerCase().includes(featured.toLowerCase()) 
    ? `${baseArtistClean} & ${featured}` 
    : baseArtistClean;

  return { displayTitle, displayArtist };
}
