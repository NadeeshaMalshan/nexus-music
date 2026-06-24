import process from 'process';
async function run() {
  try {
    const r = await fetch('http://localhost:3000/api/lyrics?track=LEMONADE&artist=aespa');
    const d = await r.json();
    console.log(JSON.stringify(d, null, 2));
  } catch (e) { console.error(e); }
}
run();
