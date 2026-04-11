import TrackPlayer, {
  AndroidAudioContentType,
  AppKilledPlaybackBehavior,
  Capability,
  type Track,
} from 'react-native-track-player';

let isSetup = false;

function isAlreadyInitializedError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.includes('already been initialized');
}

/**
 * After Fast Refresh / Metro reload, JS state resets but the native player may still exist.
 * A second `setupPlayer()` throws — catch that and still apply options so playback works.
 */
export async function ensureTrackPlayer() {
  if (isSetup) return;

  try {
    await TrackPlayer.setupPlayer({
      minBuffer: 15,
      maxBuffer: 120,
      playBuffer: 3,
      autoHandleInterruptions: true,
      androidAudioContentType: AndroidAudioContentType.Music,
    });
  } catch (e) {
    if (!isAlreadyInitializedError(e)) throw e;
  }

  await TrackPlayer.updateOptions({
    android: {
      appKilledPlaybackBehavior: AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
    },
    capabilities: [
      Capability.Play,
      Capability.Pause,
      Capability.SeekTo,
      Capability.SkipToNext,
      Capability.SkipToPrevious,
      Capability.Stop,
    ],
    compactCapabilities: [Capability.Play, Capability.Pause, Capability.SkipToNext],
  });

  isSetup = true;
}

export type NexusTrack = Track & {
  videoId?: string;
  artist?: string;
  artwork?: string;
};

export async function loadQueue(tracks: NexusTrack[], startIndex = 0) {
  await ensureTrackPlayer();
  await TrackPlayer.reset();
  await TrackPlayer.add(tracks);
  if (tracks.length > 0) {
    const si = Math.min(Math.max(0, startIndex), tracks.length - 1);
    await TrackPlayer.skip(si);
  }
}

