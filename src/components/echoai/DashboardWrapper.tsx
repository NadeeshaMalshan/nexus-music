"use client";

import { useDashboard } from "@/context/DashboardContext";
import { LeftSidebar } from "./LeftSidebar";
import { RightSidebar } from "./RightSidebar";
import { FloatingPlayer } from "./FloatingPlayer";
import { ExpandedPlayer } from "./ExpandedPlayer";
import { ListMusic } from "lucide-react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";

export function DashboardWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
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
  } = useDashboard();

  const themeColor = palette.accent;

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
            animation: 'pulse 10s infinite alternate ease-in-out'
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

      {currentSong && (
        <FloatingPlayer
          onExpand={() => setIsExpandedPlayerOpen(true)}
          currentSong={{
            ...currentSong,
            title: audioData?.trackName || currentSong.title,
            artist: audioData?.artist || currentSong.artist,
            artwork: audioData?.coverArt || currentSong.artwork,
          }}
          isPlaying={isPlaying}
          onTogglePlay={onTogglePlay}
          onNext={onNext}
          onPrev={onPrev}
          currentTimeSec={currentTimeSec}
          durationSec={durationSec}
          onRateSong={onRateSong}
          isLiked={likedSongs.has(audioData?.videoId || currentSong.id)}
          isLoggedIn={status === "authenticated"}
          onToggleRightSidebar={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
          isRightSidebarOpen={isRightSidebarOpen}
          volume={volume}
          onVolumeChange={setVolume}
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
        />
      )}

      <RightSidebar
        isOpen={isRightSidebarOpen && !isExpandedPlayerOpen}
        onClose={() => setIsRightSidebarOpen(false)}
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
