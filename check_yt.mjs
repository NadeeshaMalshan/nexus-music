import ytmusic from "ytmusic-api";
async function main() {
  const api = new ytmusic();
  await api.initialize();
  console.log("Keys:", Object.keys(api));
  console.log("Proto Keys:", Object.getOwnPropertyNames(Object.getPrototypeOf(api)));
}
main();
