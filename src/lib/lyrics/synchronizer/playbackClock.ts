/**
 * Ultra-high precision playback clock for 60fps/120fps continuous karaoke lyric animation.
 *
 * Samples active HTML5 <audio> DOM elements directly when available (hardware audio clock),
 * and falls back to performance.now() interpolation between React state updates
 * when using background/iframe players.
 */

export interface PlaybackSyncMeta {
  lastSyncTime: number;
  lastSyncPerf: number;
}

export function getContinuousPlaybackTime(
  fallbackTimeSec: number,
  isPlaying: boolean,
  syncMeta: PlaybackSyncMeta
): number {
  if (typeof window === "undefined") {
    return fallbackTimeSec;
  }

  // 1. Check for actively playing HTML5 <audio> element
  try {
    const audioElements = document.querySelectorAll<HTMLAudioElement>("audio");
    for (let i = 0; i < audioElements.length; i++) {
      const a = audioElements[i];
      if (!a.paused && Number.isFinite(a.currentTime) && a.currentTime > 0) {
        return a.currentTime;
      }
    }
  } catch {
    // querySelector safety fallback
  }

  // 2. If playback is paused, stay frozen at fallbackTimeSec
  if (!isPlaying) {
    return fallbackTimeSec;
  }

  // 3. High-resolution wall-clock interpolation between state updates
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  const elapsed = (now - syncMeta.lastSyncPerf) / 1000;

  // Guard against drift / tab sleep / lag spikes (max 2 seconds)
  if (elapsed < 0 || elapsed > 2.0) {
    return fallbackTimeSec;
  }

  return fallbackTimeSec + elapsed;
}
