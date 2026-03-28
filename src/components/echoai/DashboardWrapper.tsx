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
    queueSongs,
    upNextQueue,
    lyricsData,
    lyricsLoading,
    onSongClick,
    onSeek,
    knowFacts,
    knowLoading,
    volume,
    setVolume,
    onRemoveFromQueue,
    onRemoveFromUpNext,
    onReorderQueue,
    aiLoading,
  } = useDashboard();

  const themeColor = palette.accent;

  // Determine active view based on pathname
  const activeView = pathname === "/" ? "home" : pathname.split("/")[1] || "home";

  return (
    <div className="relative h-screen overflow-hidden bg-[#06060a] text-zinc-100">
      {/* Global 60-30-10 background wash */}
      <div
        className="pointer-events-none absolute inset-0 transition-all duration-1200 ease-in-out"
        style={{
          background: [
            `radial-gradient(ellipse 80% 60% at 0% 0%, ${palette.primary}e0, transparent 65%)`,
            `radial-gradient(ellipse 70% 50% at 100% 100%, ${palette.secondary}cc, transparent 60%)`,
            `radial-gradient(circle 35% at 50% 40%, ${palette.accent}26, transparent 55%)`,
          ].join(", "),
          opacity: 0.9,
        }}
      />
      <main className={`relative z-10 flex h-full w-full transition-all duration-300 ${isRightSidebarOpen && !isExpandedPlayerOpen ? "lg:pr-[380px]" : ""}`}>
        <LeftSidebar 
          activeView={activeView} 
          onViewChange={() => {}} // Now handled by Next.js routing via Link
          accentColor={themeColor} 
        />
        
        {children}
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
        />
      )}

      {!isRightSidebarOpen && !isExpandedPlayerOpen && (
        <button
          onClick={() => setIsRightSidebarOpen(true)}
          className="fixed right-8 top-8 z-40 hidden h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/40 transition-all backdrop-blur-3xl hover:bg-white/10 hover:text-white lg:flex"
          title="Show Queue & Lyrics"
        >
          <ListMusic size={22} />
        </button>
      )}

      {isExpandedPlayerOpen && currentSong && (
        <ExpandedPlayer
          onClose={() => setIsExpandedPlayerOpen(false)}
          currentSong={{
            ...currentSong,
            title: audioData?.trackName || currentSong.title,
            artist: audioData?.artist || currentSong.artist,
            artwork: audioData?.coverArt || currentSong.artwork,
          }}
          onSongClick={onSongClick}
          isPlaying={isPlaying}
          onTogglePlay={onTogglePlay}
          onNext={onNext}
          onPrev={onPrev}
          queueSongs={queueSongs}
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
          onRemoveFromQueue={onRemoveFromQueue}
          onReorderQueue={onReorderQueue}
          isLoggedIn={status === "authenticated"}
        />
      )}

      <RightSidebar
        isOpen={isRightSidebarOpen && !isExpandedPlayerOpen}
        onClose={() => setIsRightSidebarOpen(false)}
        onSongClick={onSongClick}
        queueSongs={queueSongs}
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
        onRemoveFromQueue={onRemoveFromQueue}
        onRemoveFromUpNext={onRemoveFromUpNext}
      />
    </div>
  );
}
