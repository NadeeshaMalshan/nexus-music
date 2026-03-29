export type Song = {
  id: string;
  title: string;
  artist: string;
  artwork: string;
  duration: string;
  color: string;
  musicVideoId?: string;
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
