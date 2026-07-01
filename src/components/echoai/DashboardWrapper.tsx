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
import { EchoAIDashboard } from "./EchoAIDashboard";

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
    pageTitle,
    pageFavicon,
    selectedPlaylist,
  } = useDashboard();

  const themeColor = palette.accent;

  const mergedCurrentSong = useMemo(() => {
    if (!currentSong) return null;
    // Preserve multi-artist strings: if currentSong has multiple artists
    // (comma, &, feat., ft.) but audioData only returns one, keep the original.
    const multiArtistRe = /,\s*|\s+&\s+|\s+feat\.\s+|\s+ft\.\s+/i;
    const currentHasMultiple = multiArtistRe.test(currentSong.artist);
    const audioHasMultiple = audioData?.artist ? multiArtistRe.test(audioData.artist) : false;
    const resolvedArtist = liveMetadata?.artist
      || (audioData?.artist && (!currentHasMultiple || audioHasMultiple) ? audioData.artist : null)
      || currentSong.artist;
    return {
      ...currentSong,
      title: liveMetadata?.title || audioData?.trackName || currentSong.title,
      artist: resolvedArtist,
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
    // Use the current accent color if a song is loaded, otherwise default to #0D0D0D.
    const activeColor = currentSong ? palette.accent : "#0D0D0D";
    meta.setAttribute("content", activeColor);
    
    // For iOS specific status bar
    const appleMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (appleMeta) {
      // 'black-translucent' allows our app background (which is themed) to show through
      appleMeta.setAttribute("content", currentSong ? "black-translucent" : "black");
    }
  }, [palette.accent, currentSong]);

  // Sync Tab Title and Favicon based on routing & playback state
  useEffect(() => {
    if (typeof document === "undefined") return;

    let finalTitle = "Nexus Music | Premium AI Ecosystem";
    let finalFavicon = "/icons/icon.svg";

    const segments = pathname.split("/").filter(Boolean);

    // 1. Song playing state (takes priority)
    if (isPlaying && mergedCurrentSong) {
      finalTitle = `🎵 ${mergedCurrentSong.title} • ${mergedCurrentSong.artist}`;
      finalFavicon = mergedCurrentSong.artwork || "/icons/icon.svg";
    } 
    // 2. Specific routes
    else if (segments[0] === "artist" && segments[1]) {
      const artistName = decodeURIComponent(segments[1]);
      finalTitle = `👤 ${artistName} | Nexus Music`;
      finalFavicon = "/icons/icon.svg";
    } else if (segments[0] === "playlists" && segments[1]) {
      finalTitle = `📁 ${selectedPlaylist?.title || "Playlist"} | Nexus Music`;
      finalFavicon = selectedPlaylist?.thumbnailUrl || "/icons/icon.svg";
    } else if (segments[0] === "album" && segments[1]) {
      finalTitle = `💿 ${pageTitle || "Album"} | Nexus Music`;
      finalFavicon = pageFavicon || "/icons/icon.svg";
    } else if (pathname === "/") {
      finalTitle = "Nexus Music | Premium AI Ecosystem";
      finalFavicon = "/icons/icon.svg";
    } else {
      finalTitle = pageTitle ? `${pageTitle} | Nexus Music` : "Nexus Music";
      finalFavicon = pageFavicon || "/icons/icon.svg";
    }

    document.title = finalTitle;

    const faviconSelectors = ['link[rel="icon"]', 'link[rel="shortcut icon"]', 'link[rel="apple-touch-icon"]'];
    faviconSelectors.forEach(selector => {
      let link = document.querySelector(selector) as HTMLLinkElement | null;
      if (link) {
        link.setAttribute("href", finalFavicon);
      } else {
        link = document.createElement("link");
        if (selector.includes("apple-touch-icon")) {
          link.rel = "apple-touch-icon";
        } else if (selector.includes("shortcut")) {
          link.rel = "shortcut icon";
        } else {
          link.rel = "icon";
        }
        link.href = finalFavicon;
        document.getElementsByTagName("head")[0].appendChild(link);
      }
    });
  }, [isPlaying, mergedCurrentSong, pathname, selectedPlaylist, pageTitle, pageFavicon]);

  // Determine active view based on pathname
  const activeView = pathname === "/" ? "home" : pathname.split("/")[1] || "home";

  return (
    <div className="relative h-screen overflow-hidden text-zinc-100 bg-[#0D0D0D]">
      {/* Redesigned Background: Solid #0D0D0D by default, ambient artwork glows when playing */}
      <div
        className="pointer-events-none absolute -inset-16 scale-110 transition-opacity duration-[1200ms] ease-out"
        style={{
          opacity: currentSong ? 1 : 0,
        }}
      >
        <div
          className="w-full h-full bg-gradient-animate animate-gpu"
          style={{
            backgroundImage: currentSong ? `
              radial-gradient(circle at 0% 0%, ${palette.primary}33 0%, ${palette.primary}0a 45%, transparent 75%),
              radial-gradient(circle at 100% 100%, ${palette.secondary}29 0%, ${palette.secondary}08 45%, transparent 75%)
            ` : "none",
            filter: "blur(140px) saturate(2.0)",
          }}
        />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-black/[0.08]" />
      <main
        className="relative z-10 flex h-full min-h-0 w-full min-w-0"
      >
        <LeftSidebar
          activeView={activeView}
          onViewChange={() => {}} // Now handled by Next.js routing via Link
          accentColor={themeColor}
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <EchoAIDashboard />
          <div className="hidden">{children}</div>
        </div>
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
              onSeek={onSeek}
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
        currentSong={currentSong}
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
