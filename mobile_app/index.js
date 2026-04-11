/* eslint-disable @typescript-eslint/no-var-requires */

/**
 * React Native Track Player: `registerPlaybackService` must run before Expo Router
 * boots the JS tree. Static `import` is hoisted, so use `require()` order here.
 * @see https://rntp.dev/docs/next/guides/with-expo
 */
try {
  const { Platform } = require('react-native');
  if (Platform.OS !== 'web') {
    const TrackPlayer = require('react-native-track-player').default;
    TrackPlayer.registerPlaybackService(() => require('./src/player/service').playbackService);
  }
} catch (e) {
  console.warn('[TrackPlayer] registerPlaybackService skipped:', e);
}

require('expo-router/entry');
