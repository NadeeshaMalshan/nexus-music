export type Song = {
  /** YouTube video id (preferred). */
  id: string;
  title: string;
  artist: string;
  artwork: string;
  duration?: string;
  musicVideoId?: string;
};

