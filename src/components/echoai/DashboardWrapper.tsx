"use client";

import { useEffect, useMemo, useState } from "react";
import { useDashboard } from "@/context/DashboardContext";
import { LeftSidebar } from "./LeftSidebar";
import { RightSidebar } from "./RightSidebar";
import { FloatingPlayer } from "./FloatingPlayer";
import { ExpandedPlayer } from "./ExpandedPlayer";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { m, AnimatePresence } from "motion/react";
import { EchoAIDashboard } from "./EchoAIDashboard";
import { ListPlus, PlaySquare, Disc, User, Info, X, Loader2 } from "lucide-react";
import { type Song } from "./types";

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
    onAddToQueue,
    onPlayNext,
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

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; song: Song } | null>(null);
  const [infoSong, setInfoSong] = useState<Song | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Responsive device check
  useEffect(() => {
    if (typeof window === "undefined") return;
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Listen to ?watch=songId URLs to trigger direct playback on load
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const watchId = params.get("watch");
    if (!watchId) return;

    // Clear parameter to keep URL clean and prevent loop
    params.delete("watch");
    const queryStr = params.toString() ? `?${params.toString()}` : "";
    const newUrl = `${window.location.pathname}${queryStr}`;
    window.history.replaceState({}, "", newUrl);

    void (async () => {
      try {
        const { songFromYouTubeVideoId } = await import("@/lib/parseYouTubeUrl");
        const song = await songFromYouTubeVideoId(watchId, "var(--art-accent, #FA233B)", false, false);
        onSongClick(song);
      } catch (err) {
        console.error("Failed to load watch query song:", err);
      }
    })();
  }, [onSongClick]);

  // Global Context Menu & Long Press Listeners
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const songElement = target.closest("[data-song-id]");
      if (!songElement) return;

      e.preventDefault();

      const song: Song = {
        id: songElement.getAttribute("data-song-id") || "",
        title: songElement.getAttribute("data-song-title") || "",
        artist: songElement.getAttribute("data-song-artist") || "",
        artwork: songElement.getAttribute("data-song-artwork") || "",
        duration: songElement.getAttribute("data-song-duration") || "",
        color: "",
      };

      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        song,
      });
    };

    const handleGlobalClick = () => {
      setContextMenu(null);
    };

    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("click", handleGlobalClick);

    return () => {
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("click", handleGlobalClick);
    };
  }, []);

  // Long-press detection for mobile
  useEffect(() => {
    let pressTimer: NodeJS.Timeout | null = null;
    let startX = 0;
    let startY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      const songElement = target.closest("[data-song-id]");
      if (!songElement) return;

      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;

      pressTimer = setTimeout(() => {
        e.preventDefault();

        const song: Song = {
          id: songElement.getAttribute("data-song-id") || "",
          title: songElement.getAttribute("data-song-title") || "",
          artist: songElement.getAttribute("data-song-artist") || "",
          artwork: songElement.getAttribute("data-song-artwork") || "",
          duration: songElement.getAttribute("data-song-duration") || "",
          color: "",
        };

        setContextMenu({
          x: touch.clientX,
          y: touch.clientY,
          song,
        });
      }, 600);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!pressTimer) return;
      const touch = e.touches[0];
      if (Math.abs(touch.clientX - startX) > 10 || Math.abs(touch.clientY - startY) > 10) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    };

    const handleTouchEnd = () => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: false });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd);
    window.addEventListener("touchcancel", handleTouchEnd);

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, []);

  const mergedCurrentSong = useMemo(() => {
    if (!currentSong) return null;
    // Preserve multi-artist strings: if currentSong has multiple artists
    // (comma, &, feat., ft.) but audioData only returns one, keep the original.
    const multiArtistRe = /,\s*|\s+&\s+|\s+feat\.\s+|\s+ft\.\s+/i;
    const currentHasMultiple = multiArtistRe.test(currentSong.artist);
    const audioHasMultiple = audioData?.artist ? multiArtistRe.test(audioData.artist) : false;
    const resolvedArtist = liveMetadata?.artist
      || currentSong.artist
      || (audioData?.artist && (!currentHasMultiple || audioHasMultiple) ? audioData.artist : "")
      || "";
    return {
      ...currentSong,
      title: liveMetadata?.title || currentSong.title || audioData?.trackName || "",
      artist: resolvedArtist,
      artwork: liveMetadata?.artwork || currentSong.artwork || audioData?.coverArt || "",
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

    // 1. Specific routes (artist, playlist, album) take priority
    if (segments[0] === "artist" && segments[1]) {
      const artistName = decodeURIComponent(segments[1]);
      finalTitle = `👤 ${artistName} | Nexus Music`;
      finalFavicon = "/icons/icon.svg";
    } else if (segments[0] === "playlists" && segments[1]) {
      finalTitle = `📁 ${selectedPlaylist?.title || "Playlist"} | Nexus Music`;
      finalFavicon = selectedPlaylist?.thumbnailUrl || "/icons/icon.svg";
    } else if (segments[0] === "album" && segments[1]) {
      finalTitle = `💿 ${pageTitle || "Album"} | Nexus Music`;
      finalFavicon = pageFavicon || "/icons/icon.svg";
    }
    // 2. Otherwise, if a song is actively playing, show the song name
    else if (isPlaying && mergedCurrentSong) {
      finalTitle = ` ${mergedCurrentSong.title} • ${mergedCurrentSong.artist}`;
      finalFavicon = mergedCurrentSong.artwork || "/icons/icon.svg";
    }
    // 3. Fallbacks
    else if (pathname === "/") {
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
          onViewChange={() => { }} // Now handled by Next.js routing via Link
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

      {/* Custom Context Menu */}
      <AnimatePresence>
        {contextMenu && (
          isMobile ? (
            <>
              {/* Mobile Drawer Backdrop */}
              <m.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-80 bg-black/60 backdrop-blur-xs"
                onClick={() => setContextMenu(null)}
              />

              {/* Mobile Spotify-style Bottom Sheet */}
              <m.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 220 }}
                className="fixed inset-x-0 bottom-0 z-90 w-full rounded-t-[32px] border-t border-white/10 bg-[#161618] p-6 pb-8 shadow-[0_-15px_40px_rgba(0,0,0,0.5)] flex flex-col max-h-[65vh] overflow-y-auto no-scrollbar"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Drag Handle Indicator */}
                <div className="w-12 h-1 bg-white/10 rounded-full mx-auto mb-6 shrink-0" />

                {/* Bottom Sheet Header */}
                <div className="flex items-center gap-4 border-b border-white/5 pb-4 mb-4">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-zinc-900 border border-white/10 shadow-lg">
                    <img src={contextMenu.song.artwork} alt={contextMenu.song.title} className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-lg font-black text-white leading-tight">{contextMenu.song.title}</p>
                    <p className="truncate text-sm font-bold text-white/50 mt-1">{contextMenu.song.artist}</p>
                  </div>
                </div>

                {/* Touch Action Items List */}
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => {
                      onAddToQueue?.(contextMenu.song);
                      setContextMenu(null);
                    }}
                    className="flex w-full items-center gap-4 rounded-2xl px-4 py-3.5 text-base font-bold text-white/80 hover:text-white transition-all hover:bg-white/5 active:bg-white/10 group"
                  >
                    <ListPlus size={20} className="text-white/40 group-hover:text-white" />
                    <span>Add to Queue</span>
                  </button>

                  <button
                    onClick={() => {
                      onPlayNext?.(contextMenu.song);
                      setContextMenu(null);
                    }}
                    className="flex w-full items-center gap-4 rounded-2xl px-4 py-3.5 text-base font-bold text-white/80 hover:text-white transition-all hover:bg-white/5 active:bg-white/10 group"
                  >
                    <PlaySquare size={20} className="text-white/40 group-hover:text-white" />
                    <span>Play Next</span>
                  </button>

                  <button
                    onClick={() => {
                      const query = `${contextMenu.song.title} ${contextMenu.song.artist} album`;
                      router.push(`/explore?q=${encodeURIComponent(query)}`);
                      setContextMenu(null);
                    }}
                    className="flex w-full items-center gap-4 rounded-2xl px-4 py-3.5 text-base font-bold text-white/80 hover:text-white transition-all hover:bg-white/5 active:bg-white/10 group"
                  >
                    <Disc size={20} className="text-white/40 group-hover:text-white" />
                    <span>Go to Album</span>
                  </button>

                  <button
                    onClick={() => {
                      router.push(`/artist/${encodeURIComponent(contextMenu.song.artist)}`);
                      setContextMenu(null);
                    }}
                    className="flex w-full items-center gap-4 rounded-2xl px-4 py-3.5 text-base font-bold text-white/80 hover:text-white transition-all hover:bg-white/5 active:bg-white/10 group"
                  >
                    <User size={20} className="text-white/40 group-hover:text-white" />
                    <span>Go to Artist</span>
                  </button>

                  <button
                    onClick={() => {
                      setInfoSong(contextMenu.song);
                      setContextMenu(null);
                    }}
                    className="flex w-full items-center gap-4 rounded-2xl px-4 py-3.5 text-base font-bold text-white/80 hover:text-white transition-all hover:bg-white/5 active:bg-white/10 group"
                  >
                    <Info size={20} className="text-white/40 group-hover:text-white" />
                    <span>View Song Info</span>
                  </button>
                </div>
              </m.div>
            </>
          ) : (
            /* Desktop Coordinates Menu */
            <m.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.1 }}
              style={{
                top: typeof window !== "undefined" && contextMenu.y + 250 > window.innerHeight ? window.innerHeight - 260 : contextMenu.y,
                left: typeof window !== "undefined" && contextMenu.x + 224 > window.innerWidth ? window.innerWidth - 234 : contextMenu.x,
              }}
              className="fixed z-90 w-56 overflow-hidden rounded-2xl border border-white/10 bg-[#1c1c1e]/90 backdrop-blur-xl p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.6)]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Context Header */}
              <div className="flex items-center gap-3 border-b border-white/5 p-3 mb-1">
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-zinc-900 border border-white/10">
                  <img src={contextMenu.song.artwork} alt={contextMenu.song.title} className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-black text-white">{contextMenu.song.title}</p>
                  <p className="truncate text-[10px] font-bold text-white/40">{contextMenu.song.artist}</p>
                </div>
              </div>

              {/* Actions */}
              <button
                onClick={() => {
                  onAddToQueue?.(contextMenu.song);
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-white/80 hover:text-white transition-all hover:bg-white/10 group"
              >
                <ListPlus size={18} className="text-white/40 group-hover:text-white" />
                <span>Add to Queue</span>
              </button>

              <button
                onClick={() => {
                  onPlayNext?.(contextMenu.song);
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-white/80 hover:text-white transition-all hover:bg-white/10 group"
              >
                <PlaySquare size={18} className="text-white/40 group-hover:text-white" />
                <span>Play Next</span>
              </button>

              <button
                onClick={() => {
                  const query = `${contextMenu.song.title} ${contextMenu.song.artist} album`;
                  router.push(`/explore?q=${encodeURIComponent(query)}`);
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-white/80 hover:text-white transition-all hover:bg-white/10 group"
              >
                <Disc size={18} className="text-white/40 group-hover:text-white" />
                <span>Go to Album</span>
              </button>

              <button
                onClick={() => {
                  router.push(`/artist/${encodeURIComponent(contextMenu.song.artist)}`);
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-white/80 hover:text-white transition-all hover:bg-white/10 group"
              >
                <User size={18} className="text-white/40 group-hover:text-white" />
                <span>Go to Artist</span>
              </button>

              <button
                onClick={() => {
                  setInfoSong(contextMenu.song);
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-white/80 hover:text-white transition-all hover:bg-white/10 group"
              >
                <Info size={18} className="text-white/40 group-hover:text-white" />
                <span>View Song Info</span>
              </button>
            </m.div>
          )
        )}
      </AnimatePresence>

      {/* Song Info Modal */}
      <AnimatePresence>
        {infoSong && (
          <SongInfoModal song={infoSong} onClose={() => setInfoSong(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function SongInfoModal({ song, onClose }: { song: Song; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const res = await fetch(`/api/lyrics?track=${encodeURIComponent(song.title)}&artist=${encodeURIComponent(song.artist)}`);
        if (res.ok) {
          const payload = await res.json();
          setData(payload);
        }
      } catch (err) {
        console.error("Failed to load song details:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [song.title, song.artist]);

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in"
      onClick={onClose}
    >
      <m.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-[#161618] shadow-2xl flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <Info className="text-white/60" size={24} />
            <h2 className="text-2xl font-black text-white tracking-tight">Song Information</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/5 text-white/40 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
          {/* Track Summary Card */}
          <div className="flex flex-col sm:flex-row gap-6 p-4 rounded-2xl bg-white/5 border border-white/5">
            <div className="w-24 h-24 sm:w-32 sm:h-32 shrink-0 rounded-xl overflow-hidden bg-zinc-900 border border-white/10 shadow-lg">
              <img src={song.artwork} alt={song.title} className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col justify-center min-w-0">
              <h3 className="text-2xl font-black text-white leading-tight truncate tracking-tight">{song.title}</h3>
              <p className="text-base font-bold text-white/60 mt-1 truncate">{song.artist}</p>
              {song.id && (
                <div className="flex items-center gap-2 mt-2 text-xs font-semibold text-white/30">
                  <span>Duration: {song.duration || "N/A"}</span>
                  <span>•</span>
                  <span>ID: {song.id}</span>
                </div>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-white/40">
              <Loader2 className="animate-spin" size={32} />
              <span className="text-sm font-bold">Fetching track insights & credits...</span>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Credits Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                  <span className="text-xs font-black uppercase tracking-widest text-white/35">Performed By</span>
                  <p className="text-sm font-bold text-white mt-1">{song.artist || "Unknown"}</p>
                </div>
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                  <span className="text-xs font-black uppercase tracking-widest text-white/35">Written By</span>
                  <p className="text-sm font-bold text-white mt-1">
                    {data?.geniusData?.writers?.join(", ") || "Unknown / Traditional"}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                  <span className="text-xs font-black uppercase tracking-widest text-white/35">Composed / Produced By</span>
                  <p className="text-sm font-bold text-white mt-1">
                    {data?.geniusData?.producers?.join(", ") || "AI Synthesized / Unknown"}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                  <span className="text-xs font-black uppercase tracking-widest text-white/35">Release Year</span>
                  <p className="text-sm font-bold text-white mt-1">
                    {data?.geniusData?.releaseYear || "Unknown"}
                  </p>
                </div>
              </div>

              {/* Metadata Details */}
              {data?.geniusData?.description && (
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                  <span className="text-xs font-black uppercase tracking-widest text-white/35">Song Background</span>
                  <p className="text-sm font-medium text-white/70 mt-1.5 leading-relaxed">{data.geniusData.description}</p>
                </div>
              )}

              {/* Lyrics Section */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col">
                <span className="text-xs font-black uppercase tracking-widest text-white/35 mb-3">Lyrics</span>
                <div className="bg-black/20 rounded-lg p-4 max-h-60 overflow-y-auto no-scrollbar border border-white/5">
                  <pre className="text-sm font-semibold text-white/80 leading-relaxed whitespace-pre-wrap font-sans">
                    {data?.lyrics?.content || "Lyrics not available for this track."}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      </m.div>
    </div>
  );
}
