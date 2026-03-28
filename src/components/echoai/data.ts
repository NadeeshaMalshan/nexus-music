import type { NavItem, PlaylistItem, UserPlaylist, WeeklyStat } from "./types";

export const navItems: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "AI Explorer", href: "/explorer" },
  { label: "Stats", href: "/stats" },
  { label: "Settings", href: "/settings" },
];

export const yourPlaylists: UserPlaylist[] = [
  { id: "p1", name: "Neon Midnight Drive", trackCount: 43 },
  { id: "p2", name: "Rain + Lo-Fi Coding", trackCount: 61 },
  { id: "p3", name: "Synthwave Gym Pulse", trackCount: 37 },
  { id: "p4", name: "Sunday Vinyl Emotions", trackCount: 29 },
  { id: "p5", name: "Deep Focus AI Session", trackCount: 54 },
  { id: "p6", name: "Late Night Storycore", trackCount: 19 },
];

export const aiPlaylists: PlaylistItem[] = [
  {
    id: "a1",
    title: "Adaptive Focus Loop",
    subtitle: "Generated from your morning productivity pattern",
    bpm: 118,
    mood: "Energized",
  },
  {
    id: "a2",
    title: "Emotional Reset",
    subtitle: "Llama 3 identified lyrical catharsis themes",
    bpm: 92,
    mood: "Reflective",
  },
  {
    id: "a3",
    title: "Night Drive Bloom",
    subtitle: "Built from late-session synth preferences",
    bpm: 108,
    mood: "Futuristic",
  },
  {
    id: "a4",
    title: "Flow State Hyperpop",
    subtitle: "Auto-curated from high-completion tracks",
    bpm: 132,
    mood: "Intense",
  },
];

export const weeklyStats: WeeklyStat[] = [
  { label: "Listening Time", value: "26h 34m", trend: "+18%" },
  { label: "Discovery Rate", value: "42 tracks", trend: "+11%" },
  { label: "Mood Stability", value: "81%", trend: "+4%" },
];
