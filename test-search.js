const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const key = env.match(/YOUTUBE_API_KEY=(.*)/)[1].trim();

fetch('https://www.googleapis.com/youtube/v3/search?part=snippet&q=BLACKPINK&type=channel&maxResults=5&key=' + key)
  .then(res => res.json())
  .then(searchData => {
      const candidates = searchData.items || [];
      const ids = candidates.map((c) => c.id.channelId).filter(Boolean).join(',');
      console.log('candidates ids:', ids);
      if(!ids) return;
      return fetch('https://www.googleapis.com/youtube/v3/channels?part=statistics&id=' + ids + '&key=' + key)
         .then(r => r.json())
         .then(d => console.log(JSON.stringify(d, null, 2)));
  });
