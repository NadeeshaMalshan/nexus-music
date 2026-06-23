"use client";

import { useDashboard } from "@/context/DashboardContext";
import { CenterPanel } from "./CenterPanel";
import { SearchPage } from "./SearchPage";
import { ArtistPage } from "./ArtistPage";
import { usePathname, useRouter } from "next/navigation";
import { m, AnimatePresence } from "motion/react";
import { FADE_IN_VARIANTS, MOTION_CONFIG } from "@/lib/animations";
import { Suspense } from "react";

export function EchoAIDashboard() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    currentSong,
    onSongClick,
    setQueueSongs,
    onAddToQueue,
    onPlayNext,
    onPlayPlaylist,
    playedHistory,
    selectedPlaylist,
    palette,
  } = useDashboard();

  // Determine active view based on pathname
  let activeView = "home";
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) activeView = "home";
  else if (segments[0] === "playlists" && segments[1]) activeView = "playlist-detail";
  else if (segments[0] === "artist" && segments[1]) activeView = "artist";
  else if (segments[0] === "album" && segments[1]) activeView = "album";
  else activeView = segments[0];

  // Extract artist name from URL (decode %20 etc.)
  const artistNameFromUrl =
    activeView === "artist" ? decodeURIComponent(segments[1] || "") : "";
  
  const albumIdFromUrl =
    activeView === "album" ? segments[1] : "";

  return (
    <AnimatePresence mode="wait">
      {activeView === "explore" ? (
        <m.div
          key="explore-view"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={MOTION_CONFIG.transition}
          className="flex-1 h-full flex flex-col"
        >
          <Suspense fallback={<div className="flex-1 h-full flex items-center justify-center text-white/50">Loading explore...</div>}>
            <SearchPage
              onClose={() => router.push("/")}
              onSongSelect={onSongClick}
              onAddToQueue={onAddToQueue}
              onPlayNext={onPlayNext}
              onNavigateArtist={(name) => router.push(`/artist/${encodeURIComponent(name)}`)}
            />
          </Suspense>
        </m.div>
      ) : activeView === "artist" && artistNameFromUrl ? (
        <m.div
          key={`artist-view-${artistNameFromUrl}`}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={MOTION_CONFIG.transition}
          className="flex-1 h-full flex flex-col"
        >
          <ArtistPage
            artistName={artistNameFromUrl}
            onBack={() => router.back()}
            onNavigateArtist={(name) => router.push(`/artist/${encodeURIComponent(name)}`)}
            onNavigatePlaylist={(id) => router.push(`/playlists/${id}`)}
            onNavigateAlbum={(id) => router.push(`/album/${id}`)}
          />
        </m.div>
      ) : (
        <m.div
          key="center-view"
          variants={FADE_IN_VARIANTS}
          initial="initial"
          animate="animate"
          exit="exit"
          className="flex-1 h-full min-h-0 flex flex-col"
        >
          <CenterPanel
            activeView={activeView}
            selectedPlaylist={selectedPlaylist}
            accentColor={palette.accent}
            onSongClick={onSongClick}
            onPlaylistClick={(playlist) => {
              router.push(`/playlists/${playlist.id}`);
            }}
            onQueueReplace={setQueueSongs}
            onAddToQueue={onAddToQueue}
            onPlayNext={onPlayNext}
            onPlayPlaylist={onPlayPlaylist}
            currentSongId={currentSong?.id}
            seed={currentSong ? `${currentSong.artist} - ${currentSong.title}` : undefined}
            playedHistory={playedHistory}
            onNavigateArtist={(name) => router.push(`/artist/${encodeURIComponent(name)}`)}
          />
        </m.div>
      )}
    </AnimatePresence>
  );
}
