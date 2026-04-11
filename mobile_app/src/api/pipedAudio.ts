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

function resolveBase(): string | null {
  const raw = process.env.EXPO_PUBLIC_PIPED_API_BASE_URL?.trim();
  if (raw?.toLowerCase() === 'off' || raw === '0') return null;
  return (raw || DEFAULT_BASE).replace(/\/+$/, '');
}

export async function fetchPipedAudioUrl(videoId: string): Promise<string | null> {
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
    withUrl.sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0));
    return withUrl[0].url;
  } catch {
    clearTimeout(timer);
    return null;
  }
}
