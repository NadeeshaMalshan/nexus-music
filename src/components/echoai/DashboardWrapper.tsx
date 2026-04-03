"use client";

import { useEffect } from "react";
import { useDashboard } from "@/context/DashboardContext";
import { LeftSidebar } from "./LeftSidebar";
import { RightSidebar } from "./RightSidebar";
import { FloatingPlayer } from "./FloatingPlayer";
import { ExpandedPlayer } from "./ExpandedPlayer";
import { ListMusic } from "lucide-react";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";

export function DashboardWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { status } = useSession();
  const {
    palette,
    isRightSidebarOpen,
    isExpandedPlayerOpen,
    currentSong,
    audioData,
    isPlaying,
    currentTimeSec,
    durationSec,
    likedSongs,
    onTogglePlay,
    onNext,
    onPrev,
    onRateSong,
    setIsExpandedPlayerOpen,
    setIsRightSidebarOpen,
    upNextQueue,
    lyricsData,
    lyricsLoading,
    onSongClick,
    onSeek,
    knowFacts,
    knowLoading,
    volume,
    setVolume,
    onRemoveFromUpNext,
    onClearQueue,
    onPlayPlaylist,
    onReorderUpNext,
    aiLoading,
    playVideo,
    pauseVideo,
    pauseBackgroundPlayer,
    setCurrentTimeSec,
    setIsPlaying,
    viewMode,
    setViewMode,
    rightSidebarMode,
    setRightSidebarMode,
  } = useDashboard();

  const themeColor = palette.accent;

  // Sync PWA status bar/theme color with artwork accent
  useEffect(() => {
    if (typeof document === "undefined") return;
    
    // Update theme-color meta tag
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      (meta as any).name = "theme-color";
      document.getElementsByTagName('head')[0].appendChild(meta);
    }
    
    // When a song is playing, let the status bar follow the artwork vibe.
    // Use the current accent color if a song is loaded, otherwise default to black.
    const activeColor = currentSong ? palette.accent : "#050505";
    meta.setAttribute("content", activeColor);
    
    // For iOS specific status bar
    let appleMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (appleMeta) {
      // 'black-translucent' allows our app background (which is themed) to show through
      appleMeta.setAttribute("content", currentSong ? "black-translucent" : "black");
    }
  }, [palette.accent, currentSong]);

  // Determine active view based on pathname
  const activeView = pathname === "/" ? "home" : pathname.split("/")[1] || "home";

  return (
    <div className="relative h-screen overflow-hidden text-zinc-100">
      <div
        className="pointer-events-none absolute inset-0 transition-all duration-2000 ease-in-out"
        style={{
          backgroundImage: `
            radial-gradient(circle at 15% 15%, ${palette.primary}cc, transparent 70%),
            radial-gradient(circle at 85% 85%, ${palette.secondary}99, transparent 70%),
            radial-gradient(circle at 50% 50%, ${palette.accent}22, transparent 90%)
          `,
          filter: "blur(120px) saturate(2.5)",
          backgroundColor: "#06060c",
        }}
      >
          <div className="absolute inset-0 opacity-[0.15]" style={{
            backgroundImage: `radial-gradient(circle at 50% 50%, ${palette.accent}, transparent)`,
          }} />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-black/10" />
      <main
        className={`relative z-10 flex h-full min-h-0 w-full min-w-0 transition-all duration-300 ${isRightSidebarOpen && !isExpandedPlayerOpen ? "lg:pr-[380px]" : ""}`}
      >
        <LeftSidebar
          activeView={activeView}
          onViewChange={() => {}} // Now handled by Next.js routing via Link
          accentColor={themeColor}
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
      </main>

      {!isExpandedPlayerOpen && (
        <FloatingPlayer
          onExpand={() => setIsExpandedPlayerOpen(true)}
          currentSong={currentSong ? {
            ...currentSong,
            title: audioData?.trackName || currentSong.title,
            artist: audioData?.artist || currentSong.artist,
            artwork: audioData?.coverArt || currentSong.artwork,
          } : null}
          isPlaying={isPlaying}
          onTogglePlay={onTogglePlay}
          onNext={onNext}
          onPrev={onPrev}
          currentTimeSec={currentTimeSec}
          durationSec={durationSec}
          onRateSong={onRateSong}
          isLiked={currentSong ? likedSongs.has(audioData?.videoId || currentSong.id) : false}
          isLoggedIn={status === "authenticated"}
          onToggleRightSidebar={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
          isRightSidebarOpen={isRightSidebarOpen}
          rightSidebarMode={rightSidebarMode}
          onSetRightSidebarMode={setRightSidebarMode}
          volume={volume}
          onVolumeChange={setVolume}
          onArtistClick={(name) => router.push(`/artist/${encodeURIComponent(name)}`)}
        />
      )}

      {isExpandedPlayerOpen && currentSong && (
        <ExpandedPlayer
          onClose={() => setIsExpandedPlayerOpen(false)}
          currentSong={{
            ...currentSong,
            title: audioData?.trackName || currentSong.title,
            artist: audioData?.artist || currentSong.artist,
            artwork: audioData?.coverArt || currentSong.artwork,
            musicVideoId: audioData?.musicVideoId,
          }}
          onSongClick={onSongClick}
          isPlaying={isPlaying}
          onTogglePlay={onTogglePlay}
          onNext={onNext}
          onPrev={onPrev}
          upNextQueue={upNextQueue}
          onRemoveFromUpNext={onRemoveFromUpNext}
          onClearQueue={onClearQueue}
          onReorderUpNext={onReorderUpNext}
          lyricsContent={
            lyricsData?.lyrics.content ||
            (lyricsLoading ? "Loading lyrics..." : "Lyrics not available for this track yet.")
          }
          lyricsSource={lyricsData?.lyrics.source || null}
          currentTimeSec={currentTimeSec}
          durationSec={durationSec}
          onSeek={onSeek}
          volume={volume}
          onVolumeChange={setVolume}
          geniusData={lyricsData?.geniusData}
          knowFacts={knowFacts}
          knowLoading={knowLoading}
          onRateSong={onRateSong}
          isLiked={currentSong ? likedSongs.has(audioData?.videoId || currentSong.id) : false}
          isLoggedIn={status === "authenticated"}
          playVideo={playVideo}
          pauseVideo={pauseVideo}
          pauseBackgroundPlayer={pauseBackgroundPlayer}
          setCurrentTimeSec={setCurrentTimeSec}
          setIsPlaying={setIsPlaying}
          viewMode={viewMode}
          setViewMode={setViewMode}
          onArtistClick={(name) => {
            setIsExpandedPlayerOpen(false);
            router.push(`/artist/${encodeURIComponent(name)}`);
          }}
        />
      )}

      <RightSidebar
        isOpen={isRightSidebarOpen && !isExpandedPlayerOpen}
        onClose={() => setIsRightSidebarOpen(false)}
        mode={rightSidebarMode}
        onSongClick={onSongClick}
        upNextQueue={upNextQueue}
        currentSongId={currentSong?.id}
        currentArtist={audioData?.artist || currentSong?.artist || "Unknown"}
        accentColor={themeColor}
        lyricsContent={lyricsData?.lyrics.content || null}
        lyricsSource={lyricsData?.lyrics.source || null}
        currentTimeSec={currentTimeSec}
        aiInsights={lyricsData?.geniusData.found ? "Genius metadata found for this song." : "AI insights are not available yet."}
        aiLoading={aiLoading}
        onSeek={onSeek}
        onRemoveFromUpNext={onRemoveFromUpNext}
        onClearQueue={onClearQueue}
        onReorderUpNext={onReorderUpNext}
      />
    </div>
  );
}
