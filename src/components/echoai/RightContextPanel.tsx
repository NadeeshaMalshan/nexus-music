"use client";

import { BrainCircuit } from "lucide-react";
import { parseLrcContent } from "@/lib/lrc";

type RightContextPanelProps = {
  lyricsContent: string | null;
  lyricsSource: string | null;
  currentTimeSec: number;
  lyricsLoading: boolean;
  geniusFound: boolean;
  geniusUrl: string | null;
  geniusThumbnail: string | null;
};

export function RightContextPanel({
  lyricsContent,
  lyricsSource,
  currentTimeSec,
  lyricsLoading,
  geniusFound,
  geniusUrl,
  geniusThumbnail,
}: RightContextPanelProps) {
  const lyricLines = (lyricsContent || "").split("\n").map((line) => line.trim()).filter(Boolean);
  const syncedLines = parseLrcContent(lyricsContent || "");
  const useSyncMode = syncedLines.length > 0;

  const activeSyncedIndex = syncedLines.findIndex((line, index) => {
    const next = syncedLines[index + 1];
    return currentTimeSec >= line.at && (!next || currentTimeSec < next.at);
  });

  const visibleSyncedLines =
    activeSyncedIndex >= 0 ? syncedLines.slice(Math.max(0, activeSyncedIndex - 3), activeSyncedIndex + 5) : syncedLines.slice(0, 8);
  const visiblePlainLines = lyricLines.slice(0, 12);

  return (
    <aside className="glass h-[calc(100vh-5.5rem)] w-[360px] rounded-3xl p-6">
      <div className="mb-5 flex items-center gap-2">
        <button
          type="button"
          className="rounded-lg px-4 py-2 text-sm text-white/50 transition hover:bg-white/[0.04] hover:text-white"
        >
          Queue
        </button>
        <button
          type="button"
          className="rounded-lg border border-purple-500/30 bg-white/[0.08] px-4 py-2 text-sm text-white shadow-[0_0_15px_rgba(139,92,246,0.2)]"
        >
          AI Lyrics
        </button>
      </div>

      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
        <p className="mb-3 text-xs uppercase tracking-[0.16em] text-white/40">Synced Lyrics</p>
        <div className="space-y-2 text-base leading-relaxed">
          {lyricsLoading && <p className="text-zinc-500">Loading lyrics...</p>}
          {!lyricsLoading && lyricLines.length === 0 && (
            <p className="text-zinc-500">Lyrics unavailable for this track.</p>
          )}
          {!lyricsLoading && useSyncMode
            ? visibleSyncedLines.map((line, index) => {
                const globalIndex = syncedLines.indexOf(line);
                return (
                  <p
                    key={`${line.at}-${globalIndex}-${index}`}
                    className={globalIndex === activeSyncedIndex ? "text-xl font-semibold text-white" : "text-white/30"}
                  >
                    {line.text}
                  </p>
                );
              })
            : !lyricsLoading &&
              visiblePlainLines.map((line, index) => (
                <p key={`${line}-${index}`} className={index === 0 ? "text-xl font-semibold text-white" : "text-white/30"}>
                  {line}
                </p>
              ))}
        </div>
        <p className="mt-3 text-[11px] text-white/35">
          Source: {lyricsSource || "N/A"} {useSyncMode ? "(Synced)" : "(Plain)"}
        </p>
      </section>

      <section className="mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
        <div className="mb-3 flex items-center gap-2">
          <BrainCircuit className="h-4 w-4 text-violet-200" />
          <h3 className="text-sm font-medium text-zinc-100">
            AI Behind the Lyrics (Powered by Llama 3)
          </h3>
        </div>
        {geniusFound ? (
          <div className="space-y-3">
            {geniusThumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={geniusThumbnail} alt="Genius song thumbnail" className="h-20 w-20 rounded-xl object-cover" />
            ) : null}
            <p className="text-sm leading-relaxed text-white/80">
              Genius metadata found. This track is ready for annotation-enrichment with Llama 3.
            </p>
            {geniusUrl ? (
              <a
                href={geniusUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-purple-300 underline underline-offset-4"
              >
                Open Genius Page
              </a>
            ) : null}
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-white/70">
            Genius metadata not found for this track yet.
          </p>
        )}
      </section>

      <div className="mt-4 rounded-2xl border border-dashed border-white/15 p-3 text-xs text-white/35">
        Placeholder: ACRCloud audio fingerprinting results + contextual scene recognition.
      </div>
    </aside>
  );
}
