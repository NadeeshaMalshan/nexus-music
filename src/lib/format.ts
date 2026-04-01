/**
 * Formats seconds into MM:SS format.
 * @param seconds Total number of seconds.
 * @returns Formatted duration string (e.g., "03:45").
 */
export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
