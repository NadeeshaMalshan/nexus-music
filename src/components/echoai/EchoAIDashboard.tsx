"use client";

import { useDashboard } from "@/context/DashboardContext";
import { CenterPanel } from "./CenterPanel";
import { SearchPage } from "./SearchPage";
import { ArtistPage } from "./ArtistPage";
import { usePathname, useRouter } from "next/navigation";

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

  if (activeView === "search") {
    return (
      <SearchPage
        onClose={() => router.push("/")}
        onSongSelect={onSongClick}
        onAddToQueue={onAddToQueue}
        onPlayNext={onPlayNext}
        onNavigateArtist={(name) => router.push(`/artist/${encodeURIComponent(name)}`)}
      />
    );
  }

  if (activeView === "artist" && artistNameFromUrl) {
    return (
      <ArtistPage
        key={artistNameFromUrl}
        artistName={artistNameFromUrl}
        onBack={() => router.back()}
        onNavigateArtist={(name) => router.push(`/artist/${encodeURIComponent(name)}`)}
        onNavigatePlaylist={(id) => router.push(`/playlists/${id}`)}
        onNavigateAlbum={(id) => router.push(`/album/${id}`)}
      />
    );
  }

  return (
    <CenterPanel
      activeView={activeView}
      selectedPlaylist={selectedPlaylist}
      accentColor={palette.accent}
      onSongClick={onSongClick}
      onPlaylistClick={(playlist) => router.push(`/playlists/${playlist.id}`)}
      onQueueReplace={setQueueSongs}
      onAddToQueue={onAddToQueue}
      onPlayNext={onPlayNext}
      onPlayPlaylist={onPlayPlaylist}
      currentSongId={currentSong?.id}
      seed={currentSong ? `${currentSong.artist} - ${currentSong.title}` : undefined}
      playedHistory={playedHistory}
    />
  );
}
