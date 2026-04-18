/**
 * YouTube Data API v3 returns 403 with error.errors[].reason === "quotaExceeded"
 * when the project's daily quota is used up.
 */
export class YouTubeQuotaError extends Error {
  constructor(message = "YouTube Data API quota exceeded") {
    super(message);
    this.name = "YouTubeQuotaError";
  }
}

export function isYouTubeQuotaErrorBody(status: number, body: unknown): boolean {
  if (status !== 403 && status !== 429) return false;
  const b = body as { error?: { errors?: Array<{ reason?: string; domain?: string }> } };
  const errors = b?.error?.errors;
  if (!Array.isArray(errors)) return false;
  return errors.some(
    (e) =>
      e?.reason === "quotaExceeded" ||
      e?.reason === "rateLimitExceeded" ||
      e?.reason === "userRateLimitExceeded" ||
      e?.domain === "youtube.quota"
  );
}

/** Throws {@link YouTubeQuotaError} when the response indicates quota / rate limits. */
export function assertNotYouTubeQuotaError(response: Response, body: unknown): void {
  if (response.ok) return;
  if (isYouTubeQuotaErrorBody(response.status, body)) {
    throw new YouTubeQuotaError();
  }
}
