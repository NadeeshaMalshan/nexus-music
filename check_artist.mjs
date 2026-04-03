import ytmusic from "ytmusic-api";
import fs from "fs";

async function main() {
  const api = new ytmusic();
  await api.initialize();
  
  const artists = await api.searchArtists("Ariana Grande");
  const firstArtistId = artists[0]?.artistId;
  const artistDetails = await api.getArtist(firstArtistId);
  const artistSongs = await api.getArtistSongs(firstArtistId);

  fs.writeFileSync("artist_dump.json", JSON.stringify({ artists, artistDetails, artistSongs }, null, 2));
}
main();
