import { apiFetchJson, qs } from './http';
import type { UserSettings } from '@/src/types/settings';

export type SearchType = 'songs' | 'artists' | 'playlists';

export type SearchResponse<TItem> = {
  items: TItem[];
  source?: string;
};

export type LyricsResponse = {
  success: boolean;
  lyrics: {
    isSynced: boolean;
    content: string | null;
    source: 'LRCLIB' | 'Lyrics.ovh' | null;
  };
  geniusData: {
    found: boolean;
    songId: number | null;
    url?: string | null;
    thumbnail: string | null;
    description?: string | null;
  };
};

export type AudioResolveResponse = {
  audioUrl?: string;
  trackName: string;
  artist: string;
  coverArt: string;
  videoId: string;
  musicVideoId?: string;
  directUrl?: string;
  source?: string;
};

export type GetAudioUrlResponse = { url: string };

export async function apiSearch(q: string, type: SearchType) {
  return apiFetchJson<SearchResponse<unknown>>(`/api/search${qs({ q, type })}`);
}

export async function apiLyrics(params: {
  track: string;
  artist: string;
  duration?: string | number;
  album?: string;
}) {
  return apiFetchJson<LyricsResponse>(`/api/lyrics${qs(params)}`);
}

export async function apiAudio(query: string) {
  return apiFetchJson<AudioResolveResponse>(`/api/audio${qs({ query })}`);
}

export async function apiGetAudioUrl(videoId: string) {
  return apiFetchJson<GetAudioUrlResponse>(`/api/get-audio-url${qs({ videoId })}`, { timeoutMs: 30_000 });
}

export async function apiRecommendations(payload?: unknown) {
  return apiFetchJson<unknown>('/api/recommendations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload ?? {}),
  });
}

export async function apiQueue(videoId: string) {
  return apiFetchJson<unknown>(`/api/queue${qs({ videoId })}`);
}

export async function apiYouTubeLiked() {
  return apiFetchJson<unknown>('/api/youtube/liked');
}

export async function apiYouTubePlaylists() {
  return apiFetchJson<unknown>('/api/youtube/playlists');
}

export async function apiYouTubeHistory() {
  return apiFetchJson<unknown>('/api/youtube/history');
}

export async function apiYouTubeRate(videoId: string, rating: 'like' | 'none') {
  return apiFetchJson<{ success: true }>('/api/youtube/rate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ videoId, rating }),
  });
}

export async function apiArtist(name: string) {
  return apiFetchJson<unknown>(`/api/artist${qs({ name })}`);
}

export async function apiAlbum(id: string) {
  return apiFetchJson<unknown>(`/api/album${qs({ id })}`);
}

export async function apiYtPlaylist(id: string) {
  return apiFetchJson<unknown>(`/api/yt-playlist${qs({ id })}`);
}

export async function apiYoutubePlaylistItems(playlistId: string) {
  return apiFetchJson<unknown[]>(`/api/youtube/playlist-items${qs({ playlistId })}`);
}

export async function apiSettingsGet() {
  // Dev Next.js cold starts / slow LAN can exceed a few seconds; 12s was too aggressive (AbortError).
  return apiFetchJson<UserSettings>('/api/settings', { timeoutMs: 45_000 });
}

export async function apiSettingsSave(settings: UserSettings) {
  return apiFetchJson<{ success: true }>('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
}

