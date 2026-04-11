/** Mirrors `src/types/settings.ts` in the Next.js app. */
export type VideoQuality = 'auto' | '1080p' | '720p' | '480p' | '360p';
export type AudioQuality = 'high' | 'normal' | 'low';
export type DefaultPlayMode = 'audio' | 'video';

export interface UserSettings {
  gaplessPlayback: boolean;
  videoQuality: VideoQuality;
  audioQuality: AudioQuality;
  defaultPlayMode: DefaultPlayMode;
  reduceAnimations: boolean;
  crossfade: number;
  autoplay: boolean;
}

export const DEFAULT_SETTINGS: UserSettings = {
  gaplessPlayback: true,
  videoQuality: 'auto',
  audioQuality: 'high',
  defaultPlayMode: 'audio',
  reduceAnimations: false,
  crossfade: 0,
  autoplay: true,
};
