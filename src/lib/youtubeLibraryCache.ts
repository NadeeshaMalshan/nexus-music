const PREFIX = "nexus-yt-library-";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type LibraryCacheKey = "playlists" | "liked" | "history";

export function readLibraryCache<T>(key: LibraryCacheKey): T | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at?: number; data?: T };
    if (typeof parsed.at !== "number" || Date.now() - parsed.at > MAX_AGE_MS) return null;
    return parsed.data ?? null;
  } catch {
    return null;
  }
}

export function writeLibraryCache<T>(key: LibraryCacheKey, data: T): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(PREFIX + key, JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* storage full or private mode */
  }
}
