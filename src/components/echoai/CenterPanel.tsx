import React from "react";

interface CenterPanelProps {
  onPlaylistClick: (playlistId: string) => void;
  accentColor: string;
}

export function CenterPanel({ onPlaylistClick, accentColor }: CenterPanelProps) {
  return (
    <div className="flex-1 h-full overflow-y-auto bg-[#1C1C1E] px-6 py-8 pb-32 lg:px-12 lg:py-10">
      <div className="mb-10 text-left">
        <h1 className="text-[34px] font-bold tracking-tight text-white">Listen Now</h1>
        <div className="mt-4 h-[1px] w-full bg-white/10" />
      </div>

      <div className="mb-6">
        <h2 className="mb-4 text-xl font-bold text-white">Recently Added</h2>
      </div>

      <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-white/5 bg-[#2C2C2E]/60 p-8 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-white/40">
           <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
        </div>
        <h3 className="mb-2 text-xl font-bold text-white">No playlists yet</h3>
        <p className="mb-8 max-w-sm text-[15px] font-medium text-[#EBEBF5]/60">
          Mock playlists removed. Search songs and build your queue from real results.
        </p>
        <button
          onClick={() => onPlaylistClick("queue")}
          className="rounded-full px-8 py-3.5 text-[15px] font-semibold text-white transition-opacity hover:opacity-80 active:opacity-60"
          style={{ backgroundColor: accentColor || '#FA243C' }}
        >
          Open Search
        </button>
      </div>
    </div>
  );
}
