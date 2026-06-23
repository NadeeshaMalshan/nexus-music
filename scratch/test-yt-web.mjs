import https from "https";

function fetchHtmlForceIpv4(urlStr) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
      },
      family: 4, // Force IPv4
      timeout: 8000,
    };

    const req = https.get(options, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(fetchHtmlForceIpv4(res.headers.location));
        return;
      }
      
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        resolve(data);
      });
    });

    req.on("error", (err) => {
      reject(err);
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });
  });
}

async function testSearch(q) {
  try {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&sp=EgJAAQ%253D%253D`;
    console.log("Fetching URL:", url);
    const html = await fetchHtmlForceIpv4(url);
    const match = html.match(/(?:var\s+)?ytInitialData\s*=\s*({.+?});/);
    if (!match) {
      console.log("ytInitialData not found!");
      return;
    }
    const data = JSON.parse(match[1]);
    const contents = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents
      || data.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents;

    if (!contents) {
      console.log("No contents found in JSON!");
      return;
    }

    const items = [];
    for (const content of contents) {
      const itemSection = content.itemSectionRenderer;
      if (!itemSection?.contents) continue;
      for (const item of itemSection.contents) {
        const video = item.videoRenderer;
        if (!video) continue;
        const videoId = video.videoId;
        const title = video.title?.runs?.[0]?.text;
        const author = video.ownerText?.runs?.[0]?.text;
        const duration = video.lengthText?.simpleText || "LIVE";
        const thumbnail = video.thumbnail?.thumbnails?.[0]?.url;
        const isLive = video.badges?.some(b => b.metadataBadgeRenderer?.style === "BADGE_STYLE_TYPE_LIVE_NOW") || false;

        items.push({
          videoId,
          title,
          author,
          duration,
          thumbnail,
          isLive
        });
      }
    }
    console.log("Found items:", JSON.stringify(items.slice(0, 3), null, 2));
  } catch (err) {
    console.error("Test failed:", err);
  }
}

testSearch("one world radio");
