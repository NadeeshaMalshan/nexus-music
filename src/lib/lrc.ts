/**
 * Parse LRC synced lyric strings into timed entries.
 * Supports [mm:ss.xx], [m:ss.xx], optional [h:mm:ss.xx] (hours), LRCLIB-style centiseconds.
 */

export type LrcEntry = { at: number; text: string };

const TAG_RE = /\[(\d{1,3}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,4}))?\]/g;

function fractionalSeconds(fracRaw: string | undefined): number {
  if (!fracRaw) return 0;
  const digits = fracRaw.replace(/\D/g, "");
  if (!digits) return 0;
  if (fracRaw.length <= 2) {
    return Number(fracRaw) / 100;
  }
  const ms = Number(fracRaw.slice(0, 3));
  return Number.isNaN(ms) ? 0 : ms / 1000;
}

function parseFirstTag(match: RegExpMatchArray): number {
  const [, a, b, c, frac] = match;
  if (c !== undefined) {
    return (
      Number(a) * 3600 + Number(b) * 60 + Number(c) + fractionalSeconds(frac)
    );
  }
  return Number(a) * 60 + Number(b) + fractionalSeconds(frac);
}

export function parseLrcContent(raw: string): LrcEntry[] {
  const normalized = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const entries: LrcEntry[] = [];
  const seen = new Set<string>();

  for (const rawLine of normalized.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    TAG_RE.lastIndex = 0;
    const first = TAG_RE.exec(line);
    if (!first) continue;

    TAG_RE.lastIndex = 0;
    const text = line.replace(TAG_RE, "").trim();
    if (!text) continue;

    const at = parseFirstTag(first);
    if (Number.isNaN(at)) continue;

    const key = `${at.toFixed(3)}|${text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push({ at, text });
  }

  entries.sort((a, b) => a.at - b.at);
  return entries;
}
