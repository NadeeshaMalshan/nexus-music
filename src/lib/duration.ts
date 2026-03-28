/** YouTube-style timestamps: "3:42", "1:02:03", or "Live". */
export function youtubeTimestampToSeconds(ts: string | undefined): number | null {
  if (!ts || ts === "Live") return null;
  const parts = ts.split(":").map((p) => Number(p.trim()));
  if (parts.some((n) => Number.isNaN(n))) return null;
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}
