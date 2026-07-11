export type Song = {
  id: string;
  title: string;
  artist: string;
  artwork: string;
  duration: string;
  color: string;
  musicVideoId?: string;
  isManual?: boolean;
  isDirectLink?: boolean;
  /** When true, open expanded player and play as YouTube video (not audio-only). */
  preferVideoPlayback?: boolean;
  isLive?: boolean;
  durationObj?: { totalSeconds: number; label: string };
};
export type NavItem = {
  label: string;
  href: string;
  isActive?: boolean;
};

export type PlaylistItem = {
  id: string;
  title: string;
  subtitle: string;
  bpm: number;
  mood: string;
};

export type UserPlaylist = {
  id: string;
  name: string;
  trackCount: number;
};

export type WeeklyStat = {
  label: string;
  value: string;
  trend: string;
};

export interface ExpandedPlayerProps {
  onClose: () => void;
  currentSong: Song;
  onSongClick: (song: Song, reset?: boolean) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  upNextQueue?: Song[];
  onRemoveFromUpNext?: (index: number) => void;
  lyricsContent: string | null;
  lyricsSource: string | null;
  currentTimeSec: number;
  durationSec: number;
  onSeek: (nextTimeSec: number) => void;
  volume: number;
  onVolumeChange: (nextVolume: number) => void;
  geniusData?: {
    found: boolean;
    songId: number | null;
    url: string | null;
    thumbnail: string | null;
    description?: string | null;
    writers?: string[] | null;
  };
  knowFacts?: string[];
  knowLoading?: boolean;
  onRateSong: (videoId: string, rating: "like" | "none", meta?: { title: string; artist: string }) => void | Promise<{ pendingSync?: boolean }>;
  isLiked?: boolean;
  isLoggedIn?: boolean;
  playVideo: () => void;
  pauseVideo: () => void;
  pauseBackgroundPlayer: () => void;
  setCurrentTimeSec: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
  viewMode: "music" | "video";
  setViewMode: (mode: "music" | "video") => void;
  onClearQueue?: () => void;
  onReorderUpNext?: (newQueue: Song[]) => void;
  onArtistClick?: (artistName: string) => void;
  isOpen?: boolean;
  setDurationSec?: (duration: number) => void;
}
