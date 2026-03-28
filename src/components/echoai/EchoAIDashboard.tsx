"use client";

import { useDashboard } from "@/context/DashboardContext";
import { CenterPanel } from "./CenterPanel";
import { SearchPage } from "./SearchPage";
import { usePathname } from "next/navigation";

export function EchoAIDashboard() {
  const pathname = usePathname();
  const {
    currentSong,
    onSongClick,
    setQueueSongs,
    onAddToQueue,
    onPlayNext,
    playedHistory,
    selectedPlaylist,
    palette,
  } = useDashboard();

  // Determine active view based on pathname
  let activeView = "home";
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) activeView = "home";
  else if (segments[0] === "playlists" && segments[1]) activeView = "playlist-detail";
  else activeView = segments[0];

  if (activeView === "search") {
    return (
      <SearchPage
        onClose={() => {
          // Use window.history.back() or Link to go home
          window.location.href = "/";
        }}
        onSongSelect={onSongClick}
        onAddToQueue={onAddToQueue}
        onPlayNext={onPlayNext}
      />
    );
  }

  return (
    <CenterPanel 
      activeView={activeView}
      selectedPlaylist={selectedPlaylist}
      accentColor={palette.accent} 
      onSongClick={onSongClick} 
      onPlaylistClick={(playlist) => {
        // Now handled by Link in sidebar, but for internal clicks:
        window.location.href = `/playlists/${playlist.id}`;
      }}
      onQueueReplace={setQueueSongs}
      onAddToQueue={onAddToQueue}
      onPlayNext={onPlayNext}
      currentSongId={currentSong?.id}
      seed={currentSong ? `${currentSong.artist} - ${currentSong.title}` : undefined}
      playedHistory={playedHistory}
    />
  );
}
