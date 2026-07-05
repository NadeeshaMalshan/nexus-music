export type VideoQuality = "auto" | "1080p" | "720p" | "480p" | "360p";
export type AudioQuality = "high" | "normal" | "low";
export type DefaultPlayMode = "audio" | "video";

export interface UserSettings {
  gaplessPlayback: boolean;
  videoQuality: VideoQuality;
  audioQuality: AudioQuality;
  defaultPlayMode: DefaultPlayMode;
  reduceAnimations: boolean;
  crossfade: number; // 0 to 12 seconds
  autoplay: boolean;
  serverProxyStreaming: boolean;
}

export const DEFAULT_SETTINGS: UserSettings = {
  gaplessPlayback: true,
  videoQuality: "auto",
  audioQuality: "high",
  defaultPlayMode: "audio",
  reduceAnimations: false,
  crossfade: 0,
  autoplay: true,
  serverProxyStreaming: false,
};
