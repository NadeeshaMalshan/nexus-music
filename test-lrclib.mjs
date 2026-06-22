import fetch from 'node-fetch'; // built-in fetch in node 20+

async function testLrcLib() {
  const url = 'https://lrclib.net/api/search?track_name=Rolling+in+the+Deep&artist_name=Adele';
  const res = await fetch(url, { headers: { 'User-Agent': 'Nexus/1.0 (music dashboard)' } });
  const data = await res.json();
  console.log("LRCLib:", Array.isArray(data) ? data.length : data);
}

testLrcLib();
