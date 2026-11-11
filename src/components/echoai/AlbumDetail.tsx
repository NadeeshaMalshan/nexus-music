"use client";

import { useEffect, useMemo, useState } from "react";
import { type Song } from "./types";
import { Play, Shuffle, ChevronLeft, Share2, MoreHorizontal, Check } from "lucide-react";
import { AudioVisualizer } from "./AudioVisualizer";
import { AnimatedCanvasArtwork } from "./AnimatedCanvasArtwork";
import { m, AnimatePresence } from "motion/react";
import { useDashboard } from "@/context/DashboardContext";
import { SwipeableSongRow } from "./SwipeableSongRow";
import { SongMenu } from "./SongMenu";
import { useArtworkColors, getAppleMusicBackground } from "@/lib/useArtworkColors";

interface AlbumDetailProps {
  albumId: string;
  onSongClick: (song: Song) => void;
  onQueueReplace: (songs: Song[]) => void;
  onBack: () => void;
  onNavigateArtist?: (name: string) => void;
  accentColor: string;
  currentSongId?: string;
  onAddToQueue?: (song: Song) => void;
  onPlayNext?: (song: Song) => void;
  onPlayPlaylist?: (songs: Song[], startIndex: number) => void;
}

export function AlbumDetail({
  albumId,
  onSongClick,
  onQueueReplace,
  onBack,
  onNavigateArtist,
  accentColor,
  currentSongId,
  onAddToQueue,
  onPlayNext,
  onPlayPlaylist,
}: AlbumDetailProps) {
  const { setOverrideArtwork, isRightSidebarOpen, setPageTitle, setPageFavicon, songIsInLikedLibrary, onRateSong } = useDashboard();
  const [albumData, setAlbumData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [canvasBgColor, setCanvasBgColor] = useState<string | null>(null);
  const [openMenuSongId, setOpenMenuSongId] = useState<string | null>(null);
  const [hoveredTrackIndex, setHoveredTrackIndex] = useState<number | null>(null);
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const res = await fetch(`/api/album?id=${albumId}`);
        if (res.ok) {
          const data = await res.json();
          setAlbumData(data);

          // Set the global dashboard background and tab metadata
          const artworkUrl = data.thumbnails?.[data.thumbnails.length - 1]?.url || data.thumbnails?.[0]?.url;
          if (artworkUrl) {
            setOverrideArtwork(artworkUrl);
            setPageFavicon(artworkUrl);
          }
          setPageTitle(data.name || data.title || "Album");
        }
      } catch (err) {
        console.error("Failed to load album details:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();

    return () => {
      setOverrideArtwork(null);
      setPageTitle(null);
      setPageFavicon(null);
    };
  }, [albumId, setOverrideArtwork, setPageTitle, setPageFavicon]);

  const tracks = useMemo(() => albumData?.songs || [], [albumData]);
  const artistName = albumData?.artist?.name || "Unknown Artist";
  const artworkUrl = useMemo(
    () => albumData?.thumbnails?.[albumData.thumbnails.length - 1]?.url || albumData?.thumbnails?.[0]?.url || "",
    [albumData]
  );

  // Dynamic Apple Music tinted background
  const palette = useArtworkColors(artworkUrl, accentColor);
  const effectiveBgColor = canvasBgColor || palette.coverTone || palette.primary || "#2b3439";
  const backgroundStyle = useMemo(() => getAppleMusicBackground(effectiveBgColor), [effectiveBgColor]);

  // Total runtime calculation
  const totalRuntime = useMemo(() => {
    if (!tracks.length) return "";
    const totalSec = tracks.reduce((acc: number, t: any) => {
      const [m, s] = (t.duration || "0:00").split(":").map(Number);
      return acc + (m * 60 + (s || 0));
    }, 0);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    return h > 0 ? `${h} hr ${m} min` : `${m} minutes`;
  }, [tracks]);

  // Editorial description extraction
  const { editorialHeadline, editorialBody } = useMemo(() => {
    if (albumData?.description) {
      const desc = albumData.description.trim();
      const dotIndex = desc.indexOf(". ");
      if (dotIndex > 0) {
        return {
          editorialHeadline: desc.slice(0, dotIndex + 1),
          editorialBody: desc.slice(dotIndex + 2),
        };
      }
      return {
        editorialHeadline: desc,
        editorialBody: "",
      };
    }
    return {
      editorialHeadline: `An essential album release by ${artistName}.`,
      editorialBody: `Featuring ${tracks.length} tracks including "${tracks[0]?.title || "lead singles"}". Available in lossless high-fidelity audio on Nexus.`,
    };
  }, [albumData, artistName, tracks]);

  // Explicit badge check
  const isAlbumExplicit = useMemo(() => {
    if (!albumData) return false;
    if (albumData.explicit) return true;
    return tracks.some(
      (t: any) =>
        t.explicit ||
        /\b(explicit|dirty|advisory)\b/i.test(t.title || "") ||
        /shit|fuck|bitch|damn/i.test(t.title || "")
    );
  }, [albumData, tracks]);

  const handleShare = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2000);
    }
  };

  const handleTrackClick = (track: any, index: number) => {
    if (onPlayPlaylist) {
      const mappedSongs: Song[] = tracks.map((t: any) => ({
        id: t.videoId,
        title: t.title,
        artist: t.artist || artistName,
        album: albumData?.name,
        artwork: t.artwork || artworkUrl,
        duration: t.duration || "0:00",
        color: accentColor,
      }));
      onPlayPlaylist(mappedSongs, index);
    } else {
      onSongClick({
        id: track.videoId,
        title: track.title,
        artist: track.artist || artistName,
        album: albumData?.name,
        artwork: track.artwork || artworkUrl,
        duration: track.duration || "0:00",
        color: accentColor,
      });
    }
  };

  const handlePlayAll = () => {
    if (tracks.length === 0) return;
    const mappedSongs: Song[] = tracks.map((t: any) => ({
      id: t.videoId,
      title: t.title,
      artist: t.artist || artistName,
      album: albumData?.name,
      artwork: t.artwork || artworkUrl,
      duration: t.duration || "0:00",
      color: accentColor,
    }));
    if (onPlayPlaylist) {
      onPlayPlaylist(mappedSongs, 0);
    } else {
      onQueueReplace(mappedSongs);
      onSongClick(mappedSongs[0]);
    }
  };

  const handleShuffle = () => {
    if (tracks.length === 0) return;
    const shuffled = [...tracks].sort(() => Math.random() - 0.5);
    const mappedSongs: Song[] = shuffled.map((t: any) => ({
      id: t.videoId,
      title: t.title,
      artist: t.artist || artistName,
      album: albumData?.name,
      artwork: t.artwork || artworkUrl,
      duration: t.duration || "0:00",
      color: accentColor,
    }));
    if (onPlayPlaylist) {
      onPlayPlaylist(mappedSongs, 0);
    } else {
      onQueueReplace(mappedSongs);
      onSongClick(mappedSongs[0]);
    }
  };

  if (loading) {
    return <div className="flex-1 h-full bg-transparent" />;
  }

  if (!albumData) return null;

  return (
    <div
      style={{ background: backgroundStyle }}
      className={`flex-1 h-full overflow-y-auto custom-scrollbar pb-40 transition-[padding-right,background] duration-700 ease-out ${
        isRightSidebarOpen ? "lg:pr-[380px]" : "lg:pr-0"
      }`}
    >
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 py-6">
        {/* Top Bar: Back & Share */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/15 text-white/80 hover:text-white text-xs font-semibold backdrop-blur-md transition-all border border-white/5 active:scale-95"
            aria-label="Back"
          >
            <ChevronLeft size={16} />
            <span>Back</span>
          </button>

          <button
            onClick={handleShare}
            className="p-2 rounded-full bg-white/10 hover:bg-white/15 text-white/70 hover:text-white transition-all border border-white/5 backdrop-blur-md active:scale-95 flex items-center gap-1.5 text-xs font-medium"
            title="Share Album"
            aria-label="Share Album"
          >
            {copiedShare ? (
              <>
                <Check size={16} className="text-emerald-400" />
                <span className="text-emerald-400 font-semibold pr-1">Copied</span>
              </>
            ) : (
              <Share2 size={16} />
            )}
          </button>
        </div>

        {/* Apple Music Header */}
        <header className="flex flex-col md:flex-row items-center md:items-start gap-8 lg:gap-10 pb-4">
          {/* Album Cover / Motion Video Canvas */}
          <m.div
            initial={false}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="relative w-56 h-56 sm:w-64 sm:h-64 lg:w-72 lg:h-72 shrink-0 rounded-2xl md:rounded-3xl overflow-hidden shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] border border-white/10 bg-black/40 group"
          >
            <AnimatedCanvasArtwork
              title={albumData.name}
              artist={artistName}
              album={albumData.name}
              src={artworkUrl}
              alt={albumData.name}
              iconSize={56}
              onHasCanvasChange={(hasCanvas, bg) => {
                if (bg) setCanvasBgColor(bg);
              }}
              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-700"
            />
          </m.div>

          {/* Right Details Panel */}
          <div className="flex-1 flex flex-col justify-center text-center md:text-left min-w-0 space-y-3">
            {/* Title with Explicit Badge */}
            <div className="flex flex-wrap items-baseline justify-center md:justify-start gap-2">
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-[40px] font-bold text-white tracking-tight leading-[1.1] drop-shadow-sm">
                {albumData.name}
              </h1>
              {isAlbumExplicit && (
                <span
                  className="inline-flex items-center justify-center w-4 h-4 rounded-[3px] bg-white/20 text-white text-[9px] font-bold tracking-normal shrink-0 select-none align-middle"
                  title="Explicit"
                >
                  E
                </span>
              )}
            </div>

            {/* Artist Name */}
            <div>
              <button
                onClick={() => onNavigateArtist?.(artistName)}
                className="text-lg sm:text-xl md:text-2xl font-semibold text-white/90 hover:text-white transition-colors cursor-pointer text-left"
              >
                {artistName}
              </button>
            </div>

            {/* Genre & Year Metadata */}
            <div className="text-xs sm:text-sm font-medium text-white/50 tracking-wide">
              {albumData.genre || "Pop"} · {albumData.year || "2026"}
            </div>

            {/* Editorial Description with Apple-style MORE toggle */}
            <div className="pt-1 max-w-2xl text-left">
              <p className="text-sm font-semibold text-white/90 leading-snug">
                {editorialHeadline}
              </p>
              {editorialBody && (
                <div className="text-xs sm:text-sm text-white/55 leading-relaxed mt-1">
                  {isDescExpanded ? (
                    <div>
                      <p className="whitespace-pre-line">{editorialBody}</p>
                      <button
                        onClick={() => setIsDescExpanded(false)}
                        className="mt-1.5 text-white font-bold text-xs uppercase hover:underline inline-block"
                      >
                        LESS
                      </button>
                    </div>
                  ) : (
                    <p className="line-clamp-2">
                      {editorialBody}{" "}
                      <button
                        onClick={() => setIsDescExpanded(true)}
                        className="text-white font-bold text-xs uppercase hover:underline inline ml-1"
                      >
                        MORE
                      </button>
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons: Preview / Play & Shuffle */}
            <div className="flex items-center justify-center md:justify-start gap-3 pt-3">
              <button
                onClick={handlePlayAll}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white text-black font-semibold text-sm hover:bg-white/90 active:scale-95 transition shadow-lg shrink-0"
              >
                <Play size={16} fill="black" className="ml-0.5" />
                <span>Play All</span>
              </button>
              <button
                onClick={handleShuffle}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/15 text-white font-semibold text-sm border border-white/10 active:scale-95 transition backdrop-blur-md shrink-0"
              >
                <Shuffle size={16} />
                <span>Shuffle</span>
              </button>
            </div>
          </div>
        </header>

        {/* Minimal Apple Music Divider */}
        <div className="border-t border-white/10 my-6 sm:my-8" />

        {/* Tracklist Container */}
        <div className="space-y-0.5">
          {tracks.map((track: any, i: number) => {
            const isActive = track.videoId === currentSongId;
            const isHovered = hoveredTrackIndex === i;
            const isTopTrack = i === 0 || i === 1; // Apple Music bullet for popular tracks
            const song: Song = {
              id: track.videoId,
              title: track.title,
              artist: track.artist || artistName,
              album: albumData.name,
              artwork: track.artwork || artworkUrl,
              duration: track.duration || "0:00",
              color: accentColor,
            };

            return (
              <SwipeableSongRow
                key={track.videoId + i}
                onSwipeRight={() => onPlayNext?.(song)}
                onSwipeLeft={() => onAddToQueue?.(song)}
              >
                <div
                  onClick={() => handleTrackClick(track, i)}
                  onMouseEnter={() => setHoveredTrackIndex(i)}
                  onMouseLeave={() => setHoveredTrackIndex(null)}
                  data-song-id={song.id}
                  data-song-title={song.title}
                  data-song-artist={song.artist}
                  data-song-artwork={song.artwork || ""}
                  data-song-duration={song.duration || ""}
                  className={`group flex items-center px-3 sm:px-4 py-3 rounded-xl border-b border-white/[0.04] transition-colors duration-150 cursor-pointer select-none ${
                    isActive ? "bg-white/10 text-white" : "hover:bg-white/[0.06] text-white/90"
                  }`}
                >
                  {/* Left Column: Popular bullet & Track Number / Play icon / Visualizer */}
                  <div className="flex items-center gap-1.5 w-10 sm:w-12 shrink-0">
                    <span className="w-2.5 text-center text-xs text-white/40">
                      {isTopTrack ? "•" : ""}
                    </span>

                    <div className="w-6 flex justify-center items-center">
                      {isActive ? (
                        <AudioVisualizer active={isActive} barCount={3} color={palette.accent || "#ef4444"} width="14px" />
                      ) : isHovered ? (
                        <Play size={13} fill="white" className="text-white ml-0.5" />
                      ) : (
                        <span className="text-white/40 text-sm font-normal tabular-nums">{i + 1}</span>
                      )}
                    </div>
                  </div>

                  {/* Middle Column: Title & Subtitle */}
                  <div className="flex-1 min-w-0 pr-3 sm:pr-4 flex items-center gap-2">
                    <span
                      className={`text-sm sm:text-[15px] font-medium truncate ${
                        isActive ? "text-white font-semibold" : "text-white"
                      }`}
                    >
                      {track.title}
                    </span>
                    {track.explicit && (
                      <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-[2px] bg-white/20 text-white text-[8px] font-bold tracking-normal shrink-0">
                        E
                      </span>
                    )}
                  </div>

                  {/* Right Column: Duration & SongMenu Trigger */}
                  <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    <span className="text-xs sm:text-sm font-normal text-white/45 tabular-nums font-mono">
                      {track.duration || "0:00"}
                    </span>

                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuSongId(openMenuSongId === track.videoId ? null : track.videoId);
                        }}
                        className="p-1.5 rounded-full text-white/40 hover:text-white hover:bg-white/10 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all"
                        aria-label="More options"
                      >
                        <MoreHorizontal size={18} />
                      </button>

                      {openMenuSongId === track.videoId && (
                        <SongMenu
                          song={song}
                          isOpen={openMenuSongId === track.videoId}
                          onClose={() => setOpenMenuSongId(null)}
                          onAddToQueue={() => {
                            onAddToQueue?.(song);
                            setOpenMenuSongId(null);
                          }}
                          onPlayNext={() => {
                            onPlayNext?.(song);
                            setOpenMenuSongId(null);
                          }}
                          onLike={() => {
                            const isLiked = songIsInLikedLibrary(song);
                            onRateSong(song.id, isLiked ? "none" : "like", { title: song.title, artist: song.artist });
                            setOpenMenuSongId(null);
                          }}
                          isLiked={songIsInLikedLibrary(song)}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </SwipeableSongRow>
            );
          })}
        </div>

        {/* Footer Metadata */}
        <div className="mt-12 pt-6 border-t border-white/5 text-xs text-white/40 space-y-1.5">
          <p className="font-medium text-white/50">
            {tracks.length} songs, {totalRuntime}
          </p>
          <p className="tracking-wide">
            ℗ {albumData.year || "2026"} {artistName}. Distributed via Nexus Services.
          </p>
        </div>
      </div>
    </div>
  );
}
