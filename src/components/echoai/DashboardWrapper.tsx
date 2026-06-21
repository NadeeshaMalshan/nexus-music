"use client";

import { useEffect, useMemo } from "react";
import { useDashboard } from "@/context/DashboardContext";
import { LeftSidebar } from "./LeftSidebar";
import { RightSidebar } from "./RightSidebar";
import { FloatingPlayer } from "./FloatingPlayer";
import { ExpandedPlayer } from "./ExpandedPlayer";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { m, AnimatePresence } from "motion/react";

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
    songIsInLikedLibrary,
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
    liveMetadata,
  } = useDashboard();

  const themeColor = palette.accent;

  const mergedCurrentSong = useMemo(() => {
    if (!currentSong) return null;
    return {
      ...currentSong,
      title: liveMetadata?.title || audioData?.trackName || currentSong.title,
      artist: liveMetadata?.artist || audioData?.artist || currentSong.artist,
      artwork: liveMetadata?.artwork || audioData?.coverArt || currentSong.artwork,
      musicVideoId: audioData?.musicVideoId || currentSong.musicVideoId,
    };
  }, [
    currentSong, 
    liveMetadata?.title, 
    liveMetadata?.artist, 
    liveMetadata?.artwork,
    audioData?.trackName,
    audioData?.artist, 
    audioData?.coverArt,
    audioData?.musicVideoId
  ]);

  const isLiked = useMemo(() => {
    if (!mergedCurrentSong) return false;
    return songIsInLikedLibrary(mergedCurrentSong, audioData);
  }, [mergedCurrentSong, audioData, songIsInLikedLibrary]);

  // Sync PWA status bar/theme color with artwork accent
  useEffect(() => {
    if (typeof document === "undefined") return;
    
    // Update theme-color meta tag
    let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = "theme-color";
      document.getElementsByTagName('head')[0].appendChild(meta);
    }
    
    // When a song is playing, let the status bar follow the artwork vibe.
    // Use the current accent color if a song is loaded, otherwise default to black.
    const activeColor = currentSong ? palette.accent : "#050505";
    meta.setAttribute("content", activeColor);
    
    // For iOS specific status bar
    const appleMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (appleMeta) {
      // 'black-translucent' allows our app background (which is themed) to show through
      appleMeta.setAttribute("content", currentSong ? "black-translucent" : "black");
    }
  }, [palette.accent, currentSong]);

  // Determine active view based on pathname
  const activeView = pathname === "/" ? "home" : pathname.split("/")[1] || "home";

  return (
    <div className="relative h-screen overflow-hidden text-zinc-100 bg-[#06060c]">
      {/* Background with optimized CSS transition */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-animate animate-gpu"
        style={{
          backgroundImage: `
            radial-gradient(circle at 15% 15%, ${palette.primary}cc, transparent 70%),
            radial-gradient(circle at 85% 85%, ${palette.secondary}99, transparent 70%),
            radial-gradient(circle at 50% 50%, ${palette.accent}22, transparent 90%)
          `,
          filter: "blur(120px) saturate(2.5)",
        }}
      >
          <div className="absolute inset-0 opacity-[0.15] bg-gradient-animate" style={{
            backgroundImage: `radial-gradient(circle at 50% 50%, ${palette.accent}, transparent)`,
          }} />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-black/10" />
      <main
        className={`relative z-10 flex h-full min-h-0 w-full min-w-0 ${isRightSidebarOpen && !isExpandedPlayerOpen ? "lg:pr-[380px]" : ""}`}
      >
        <LeftSidebar
          activeView={activeView}
          onViewChange={() => {}} // Now handled by Next.js routing via Link
          accentColor={themeColor}
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
      </main>

      <AnimatePresence>
        {!isExpandedPlayerOpen && (
          <m.div
            key="floating-player"
            initial={false}
            animate={{ y: 0, opacity: 1 }}
            className="fixed inset-x-0 bottom-0 z-70 pointer-events-none flex items-center justify-center px-4 pb-safe"
          >
            <FloatingPlayer
              onExpand={() => {
                // In video/live scenarios, ExpandedPlayer owns playback.
                // Pause the hidden/background player to prevent double audio overlap.
                if (viewMode === "video" || mergedCurrentSong?.isLive) {
                  pauseBackgroundPlayer();
                }
                setIsExpandedPlayerOpen(true);
              }}
              currentSong={mergedCurrentSong!}
              isPlaying={isPlaying}
              onTogglePlay={onTogglePlay}
              onNext={onNext}
              onPrev={onPrev}
              currentTimeSec={currentTimeSec}
              durationSec={durationSec}
              onRateSong={onRateSong}
              isLiked={isLiked}
              isLoggedIn={status === "authenticated"}
              onToggleRightSidebar={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
              isRightSidebarOpen={isRightSidebarOpen}
              rightSidebarMode={rightSidebarMode}
              onSetRightSidebarMode={setRightSidebarMode}
              volume={volume}
              onVolumeChange={setVolume}
              onArtistClick={(name) => router.push(`/artist/${encodeURIComponent(name)}`)}
            />
          </m.div>
        )}
      </AnimatePresence>

      {/*
        ExpandedPlayer is kept mounted whenever viewMode === "video" so the react-youtube
        iframe is never destroyed and background audio continues even when minimised.
        In music mode it only mounts when actually open (background player handles audio).
      */}
      {mergedCurrentSong && (isExpandedPlayerOpen || viewMode === "video" || mergedCurrentSong.isLive) && (
        <div
          className="fixed z-50 transition-none"
          style={
            isExpandedPlayerOpen
              ? { inset: 0 }
              : {
                  top: 0, left: 0,
                  width: "1px", height: "1px",
                  overflow: "hidden",
                  opacity: 0.01,
                  pointerEvents: "none",
                  zIndex: -10,
                }
          }
        >
          <ExpandedPlayer
            isOpen={isExpandedPlayerOpen}
            onClose={() => setIsExpandedPlayerOpen(false)}
            currentSong={mergedCurrentSong}
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
            isLiked={isLiked}
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
        </div>
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
        onNavigateArtist={(name) => {
          setIsExpandedPlayerOpen(false);
          router.push(`/artist/${encodeURIComponent(name)}`);
        }}
      />
    </div>
  );
}
