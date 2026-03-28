const youtubeMusic = require('node-youtube-music');
youtubeMusic.getSuggestions('vP8p8_866c8').then(res => {
  console.log('Success:', res.length);
}).catch(err => {
  console.error('FAILED:', err);
});
