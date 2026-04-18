/**
 * YouTube Data API v3 calls with automatic key rotation when quota is exceeded.
 * Keys: YT_KEY_1, YT_KEY_2, YT_KEY_3 (preferred), plus legacy YOUTUBE_API_KEY / YOUTUBE_DATA_API_KEY.
 */

const QUOTA_REASONS = new Set([
  "quotaExceeded",
  "dailyLimitExceeded",
  "rateLimitExceeded",
  "userRateLimitExceeded",
]);

export function getYoutubeDataApiKeys(): string[] {
  const raw = [
    process.env.YT_KEY_1,
    process.env.YT_KEY_2,
    process.env.YT_KEY_3,
    process.env.YOUTUBE_API_KEY,
    process.env.YOUTUBE_DATA_API_KEY,
  ];
  const keys = raw.map((k) => k?.trim()).filter((k): k is string => Boolean(k));
  return [...new Set(keys)];
}

async function isQuotaExceeded403(res: Response): Promise<boolean> {
  if (res.status !== 403) return false;
  try {
    const j = await res.clone().json();
    const reason = j?.error?.errors?.[0]?.reason;
    if (reason && QUOTA_REASONS.has(reason)) return true;
    const msg = String(j?.error?.message || "").toLowerCase();
    if (msg.includes("quota") || msg.includes("rate limit")) return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * Tries each configured API key in order. On 403 with quota/rate-limit semantics, retries with the next key.
 * If no keys are configured, calls `buildUrl(undefined)` once (e.g. OAuth-only requests).
 */
export async function fetchYoutubeDataApiWithKeyRotation(
  buildUrl: (apiKey: string | undefined) => string,
  init?: RequestInit
): Promise<Response> {
  const keys = getYoutubeDataApiKeys();
  if (keys.length === 0) {
    return fetch(buildUrl(undefined), init);
  }

  let last: Response | null = null;
  for (const key of keys) {
    const res = await fetch(buildUrl(key), init);
    last = res;
    if (res.status !== 403) return res;
    const retry = await isQuotaExceeded403(res);
    if (!retry) return res;
  }
  return last!;
}
