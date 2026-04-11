/** Resolve Google account email from an OAuth access token (mobile / non-cookie clients). */
export async function fetchGoogleUserEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { email?: string };
    return typeof data.email === "string" && data.email ? data.email : null;
  } catch {
    return null;
  }
}
