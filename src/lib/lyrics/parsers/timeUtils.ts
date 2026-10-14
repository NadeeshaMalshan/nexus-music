/**
 * Timing utilities for lyrics parsers
 */

/**
 * Parses time formats into seconds:
 * - [mm:ss.xx] or [m:ss.xx]
 * - [hh:mm:ss.xx] or [h:mm:ss.xxx]
 * - 00:01:23.450
 * - 01:23.450
 * - 83.45s or 83450ms
 */
export function parseTimeToSeconds(timeStr: string): number | null {
  if (!timeStr) return null;
  const clean = timeStr.trim().replace(/^\[|\]$|^<|>$|^\(|\)$/g, "");

  // Milliseconds format: e.g. "83450ms"
  if (/^\d+(\.\d+)?ms$/i.test(clean)) {
    return parseFloat(clean) / 1000;
  }

  // Seconds format: e.g. "83.45s"
  if (/^\d+(\.\d+)?s$/i.test(clean)) {
    return parseFloat(clean);
  }

  // Colon-separated format: hh:mm:ss.frac or mm:ss.frac
  const parts = clean.split(":");
  if (parts.length === 2) {
    const min = parseFloat(parts[0]);
    const sec = parseFloat(parts[1]);
    if (Number.isNaN(min) || Number.isNaN(sec)) return null;
    return min * 60 + sec;
  }

  if (parts.length === 3) {
    const hr = parseFloat(parts[0]);
    const min = parseFloat(parts[1]);
    const sec = parseFloat(parts[2]);
    if (Number.isNaN(hr) || Number.isNaN(min) || Number.isNaN(sec)) return null;
    return hr * 3600 + min * 60 + sec;
  }

  // Raw number (assumed seconds)
  const num = parseFloat(clean);
  return Number.isNaN(num) ? null : num;
}

/**
 * Formats seconds to mm:ss.xx
 */
export function formatSecondsToTime(sec: number): string {
  if (sec < 0 || Number.isNaN(sec)) return "00:00.00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const cs = Math.floor((sec % 1) * 100);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}
