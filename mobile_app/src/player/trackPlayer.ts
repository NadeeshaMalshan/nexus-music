import TrackPlayer, {
  AppKilledPlaybackBehavior,
  Capability,
  type Track,
} from 'react-native-track-player';

let isSetup = false;

export async function ensureTrackPlayer() {
  if (isSetup) return;

  await TrackPlayer.setupPlayer();

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

