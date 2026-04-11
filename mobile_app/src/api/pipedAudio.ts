/**
 * When the Next.js API cannot extract streams (Vercel IP limits), fetch a direct audio URL from a
 * Piped instance on-device (no CORS issue in native). Same idea as server-side Piped fallback.
 *
 * @see https://github.com/TeamPiped/Piped/wiki/Instances
 */

const DEFAULT_BASE = 'https://pipedapi.kavin.rocks';

type PipedStreamsJson = {
  audioStreams?: Array<{ url?: string; bitrate?: number; mimeType?: string }>;
};

export type PipedAudio = {
  url: string;
  /** Helps ExoPlayer pick a decoder (critical on some Android devices). */
  contentType?: string;
};

function resolveBase(): string | null {
  const raw = process.env.EXPO_PUBLIC_PIPED_API_BASE_URL?.trim();
  if (raw?.toLowerCase() === 'off' || raw === '0') return null;
  return (raw || DEFAULT_BASE).replace(/\/+$/, '');
}

/** Prefer AAC/M4A over Opus/WebM — many phones decode AAC reliably; Opus-in-WebM can stall with no error. */
function mimePreferenceScore(mimeType: string | undefined): number {
  const m = (mimeType || '').toLowerCase();
  if (m.includes('mp4') || m.includes('aac') || m.includes('m4a')) return 100;
  if (m.includes('webm')) return 10;
  return 50;
}

function mimeToContentType(mimeType: string | undefined): string | undefined {
  const m = (mimeType || '').toLowerCase();
  if (m.includes('mp4') || m.includes('aac')) return 'audio/mp4';
  if (m.includes('webm')) return 'audio/webm';
  return undefined;
}

/**
 * Best-effort direct stream from Piped (on-device).
 */
export async function fetchPipedAudio(videoId: string): Promise<PipedAudio | null> {
  const base = resolveBase();
  if (!base) return null;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 18_000);
  try {
    const res = await fetch(`${base}/streams/${encodeURIComponent(videoId)}`, {
      method: 'GET',
      signal: ac.signal,
      headers: {
        Accept: 'application/json',
      },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = (await res.json()) as PipedStreamsJson;
    const streams = data.audioStreams;
    if (!Array.isArray(streams) || streams.length === 0) return null;

    const withUrl = streams.filter((s): s is typeof s & { url: string } => typeof s.url === 'string' && s.url.length > 0);
    if (withUrl.length === 0) return null;
    withUrl.sort((a, b) => {
      const d = mimePreferenceScore(b.mimeType) - mimePreferenceScore(a.mimeType);
      if (d !== 0) return d;
      return (b.bitrate ?? 0) - (a.bitrate ?? 0);
    });
    const best = withUrl[0];
    return {
      url: best.url,
      contentType: mimeToContentType(best.mimeType),
    };
  } catch {
    clearTimeout(timer);
    return null;
  }
}

export async function fetchPipedAudioUrl(videoId: string): Promise<string | null> {
  const r = await fetchPipedAudio(videoId);
  return r?.url ?? null;
}
