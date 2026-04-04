const play = require('play-dl');

async function test() {
  const videoId = 'ojhuTz2uMwU';
  try {
    const info = await play.video_info(`https://www.youtube.com/watch?v=${videoId}`);
    const stream = await play.stream(`https://www.youtube.com/watch?v=${videoId}`, { quality: 2 });
    console.log('URL:', stream.url);
    if (stream.url && stream.url.includes('googlevideo.com')) {
      console.log('SUCCESS: Extracted googlevideo.com URL');
    } else {
      console.log('FAILURE: URL is missing or not from googlevideo.com');
    }
  } catch (e) {
    console.error('ERROR:', e.message);
  }
}

test();
