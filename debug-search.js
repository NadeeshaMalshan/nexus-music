const YTMusic = require("ytmusic-api");

async function test() {
  const ytmusic = new YTMusic.default();
  await ytmusic.initialize();
  const songs = await ytmusic.searchSongs("Final Song MO");
  console.log("FIRST SONG:", JSON.stringify(songs[0], null, 2));
}

test();
