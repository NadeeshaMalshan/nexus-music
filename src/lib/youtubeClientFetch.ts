/**
 * Same-origin fetches to `/api/youtube/*` must send the Google access token when the
 * session JWT cookie is not decoded reliably in App Router Route Handlers.
 */
export function youtubeApiFetchInit(
  accessToken: string | undefined | null,
  extra?: RequestInit
): RequestInit {
  const headers = new Headers(extra?.headers ?? undefined);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  return {
    credentials: "same-origin",
    ...extra,
    headers,
  };
}
