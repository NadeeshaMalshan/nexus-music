/**
 * Parse JSON from a fetch Response, including empty or whitespace-only bodies
 * (avoids "Unexpected end of JSON input" from `response.json()` on 204/empty error bodies).
 */
export async function readResponseJson<T = unknown>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (text == null || text.trim() === "") return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
