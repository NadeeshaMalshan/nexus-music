import YTMusic from 'ytmusic-api'; const api = new YTMusic(); api.initialize().then(() => api.searchArtists('BLACKPINK')).then(d => { console.log(d[0]); }).catch(console.error);
