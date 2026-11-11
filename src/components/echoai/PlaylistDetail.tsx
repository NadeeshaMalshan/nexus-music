"use client";

import { useEffect, useMemo, useState } from "react";
import { type YouTubePlaylist, type YouTubeTrack } from "@/lib/youtubeData";
import { type Song } from "./types";
import { Play, Shuffle, Loader2, ChevronLeft, Share2, MoreHorizontal, Check } from "lucide-react";
import { AudioVisualizer } from "./AudioVisualizer";
import { MusicArtwork } from "./MusicArtwork";
import { m } from "motion/react";
import { SwipeableSongRow } from "./SwipeableSongRow";
import { SongMenu } from "./SongMenu";
import { useDashboard } from "@/context/DashboardContext";
import { useSession } from "next-auth/react";
import { youtubeApiFetchInit } from "@/lib/youtubeClientFetch";
import { useArtworkColors, getAppleMusicBackground } from "@/lib/useArtworkColors";

interface PlaylistDetailProps {
  playlist: YouTubePlaylist;
  onSongClick: (song: Song) => void;
  onQueueReplace: (songs: Song[]) => void;
  accentColor: string;
  currentSongId?: string;
  onAddToQueue?: (song: Song) => void;
  onPlayNext?: (song: Song) => void;
  onPlayPlaylist?: (songs: Song[], startIndex: number) => void;
  onNavigateArtist?: (name: string) => void;
  onBack?: () => void;
}

export function PlaylistDetail({
  playlist,
  onSongClick,
  onQueueReplace,
  accentColor,
  currentSongId,
  onAddToQueue,
  onPlayNext,
  onPlayPlaylist,
  onNavigateArtist,
  onBack,
}: PlaylistDetailProps) {
  const { data: session } = useSession();
  const { setOverrideArtwork, isRightSidebarOpen, songIsInLikedLibrary, onRateSong } = useDashboard();
  const [currentPlaylist, setCurrentPlaylist] = useState<YouTubePlaylist>(playlist);
  const [tracks, setTracks] = useState<YouTubeTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [openMenuSongId, setOpenMenuSongId] = useState<string | null>(null);
  const [hoveredTrackIndex, setHoveredTrackIndex] = useState<number | null>(null);
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  useEffect(() => {
    async function loadData() {
      const cacheKey = `nexus-playlist-tracks-${playlist.id}`;

      // 0. Load cached tracks first for zero-latency instant offline display
      if (typeof window !== "undefined") {
        try {
          const cachedRaw = localStorage.getItem(cacheKey);
          if (cachedRaw) {
            const cachedParsed = JSON.parse(cachedRaw);
            if (Date.now() - cachedParsed.at < 7 * 24 * 60 * 60 * 1000) {
              setTracks(cachedParsed.data || []);
              setLoading(false);
            }
          }
        } catch {}
      }

      // 0.5 Load from Redis database
      try {
        const dbTracksRes = await fetch(`/api/user/playlist-tracks?playlistId=${playlist.id}`);
        if (dbTracksRes.ok) {
          const dbTracksData = await dbTracksRes.json();
          if (dbTracksData.tracks && Array.isArray(dbTracksData.tracks) && dbTracksData.tracks.length) {
            setTracks(dbTracksData.tracks);
            setLoading(false);
          }
        }
      } catch (err) {
        console.warn("Failed to load playlist tracks from Redis database:", err);
      }

      try {
        let meta = { ...playlist };

        // 1. Dedicated music API lookup
        const musicMetaRes = await fetch(`/api/yt-playlist?id=${playlist.id}`);
        if (musicMetaRes.ok) {
          const musicData = await musicMetaRes.json();
          meta = {
            id: playlist.id,
            title: musicData.name || musicData.title || (meta.title && meta.title !== "Loading..." ? meta.title : "Radio Mix"),
            description: musicData.description || (meta.description ? meta.description : "Endless radio mix based on your selection."),
            thumbnailUrl: musicData.thumbnails?.[musicData.thumbnails.length - 1]?.url || meta.thumbnailUrl,
            itemCount: musicData.songs?.length || 0,
          };

          if (musicData.songs?.length) {
            const mappedTracks: YouTubeTrack[] = musicData.songs.map((s: any) => ({
              id: s.videoId,
              videoId: s.videoId,
              title: s.title,
              artist: s.artist,
              thumbnailUrl: s.artwork,
              duration: s.duration,
            }));
            setTracks(mappedTracks);
            setCurrentPlaylist(meta as YouTubePlaylist);
            setLoading(false);

            if (typeof window !== "undefined") {
              localStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), data: mappedTracks }));
            }
            void fetch("/api/user/playlist-tracks", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ playlistId: playlist.id, tracks: mappedTracks }),
            }).catch(() => {});

            return;
          }
        }

        // 2. Fallback to user library check for metadata
        if (!meta.title || meta.title === "Loading...") {
          const plRes = await fetch(`/api/youtube/playlists`, youtubeApiFetchInit(session?.accessToken));
          if (plRes.ok) {
            const allPls: YouTubePlaylist[] = await plRes.json();
            const found = allPls.find((p) => p.id === playlist.id);
            if (found) meta = { ...meta, ...found };
          }
        }
        setCurrentPlaylist(meta as YouTubePlaylist);

        // 3. Fallback to playlist items fetch
        const res = await fetch(`/api/youtube/playlist-items?playlistId=${playlist.id}`, youtubeApiFetchInit(session?.accessToken));
        if (res.ok) {
          const data = await res.json();
          setTracks(data);

          if (typeof window !== "undefined") {
            localStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), data }));
          }
          void fetch("/api/user/playlist-tracks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ playlistId: playlist.id, tracks: data }),
          }).catch(() => {});
        }
      } catch (err) {
        console.error("Failed to load playlist tracks:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();

    return () => {
      setOverrideArtwork(null);
    };
  }, [playlist.id, playlist.title, setOverrideArtwork, session?.accessToken]);

  useEffect(() => {
    if (currentPlaylist.thumbnailUrl) {
      setOverrideArtwork(currentPlaylist.thumbnailUrl);
    }
  }, [currentPlaylist.thumbnailUrl, setOverrideArtwork]);

  const displayPlaylist = currentPlaylist;
  const artworkUrl = useMemo(
    () => displayPlaylist.thumbnailUrl?.replace("s90", "s512") || "",
    [displayPlaylist.thumbnailUrl]
  );

  // Dynamic Apple Music tinted background
  const palette = useArtworkColors(artworkUrl, accentColor);
  const effectiveBgColor = palette.coverTone || palette.primary || "#2b3439";
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
    if (displayPlaylist.description) {
      const desc = displayPlaylist.description.trim();
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
      editorialHeadline: "A curated playlist synchronized with your Nexus library.",
      editorialBody: `Featuring ${tracks.length} tracks. Stream seamless high-fidelity audio anytime.`,
    };
  }, [displayPlaylist.description, tracks.length]);

  const handleShare = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2000);
    }
  };

  const handleTrackClick = (track: YouTubeTrack, index: number) => {
    if (onPlayPlaylist) {
      const mappedSongs: Song[] = tracks.map((t) => ({
        id: t.videoId,
        title: t.title,
        artist: t.artist,
        artwork: t.thumbnailUrl,
        duration: t.duration || "0:00",
        color: accentColor,
      }));
      onPlayPlaylist(mappedSongs, index);
    } else {
      onSongClick({
        id: track.videoId,
        title: track.title,
        artist: track.artist,
        artwork: track.thumbnailUrl,
        duration: track.duration || "0:00",
        color: accentColor,
      });
    }
  };

  const handlePlayAll = () => {
    if (tracks.length === 0) return;
    const mappedSongs: Song[] = tracks.map((track) => ({
      id: track.videoId,
      title: track.title,
      artist: track.artist,
      artwork: track.thumbnailUrl,
      duration: track.duration || "0:00",
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
    const mappedSongs: Song[] = shuffled.map((track) => ({
      id: track.videoId,
      title: track.title,
      artist: track.artist,
      artwork: track.thumbnailUrl,
      duration: track.duration || "0:00",
      color: accentColor,
    }));
    if (onPlayPlaylist) {
      onPlayPlaylist(mappedSongs, 0);
    } else {
      onQueueReplace(mappedSongs);
      onSongClick(mappedSongs[0]);
    }
  };

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
          {onBack ? (
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/15 text-white/80 hover:text-white text-xs font-semibold backdrop-blur-md transition-all border border-white/5 active:scale-95"
              aria-label="Back"
            >
              <ChevronLeft size={16} />
              <span>Back</span>
            </button>
          ) : (
            <div />
          )}

          <button
            onClick={handleShare}
            className="p-2 rounded-full bg-white/10 hover:bg-white/15 text-white/70 hover:text-white transition-all border border-white/5 backdrop-blur-md active:scale-95 flex items-center gap-1.5 text-xs font-medium"
            title="Share Playlist"
            aria-label="Share Playlist"
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
          {/* Playlist Artwork */}
          <m.div
            initial={false}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative w-56 h-56 sm:w-64 sm:h-64 lg:w-72 lg:h-72 shrink-0 rounded-2xl md:rounded-3xl overflow-hidden shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] border border-white/10 bg-black/40 group"
          >
            <MusicArtwork
              src={artworkUrl}
              alt={displayPlaylist.title}
              iconSize={56}
              variant="track"
              rounded="none"
              className="group-hover:scale-105 transition-transform duration-700"
            />
          </m.div>

          {/* Right Details Panel */}
          <div className="flex-1 flex flex-col justify-center text-center md:text-left min-w-0 space-y-3">
            {/* Tag / Category */}
            <div className="text-xs font-bold text-white/50 uppercase tracking-widest">
              PLAYLIST
            </div>

            {/* Title */}
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-[40px] font-bold text-white tracking-tight leading-[1.1] drop-shadow-sm">
              {displayPlaylist.title}
            </h1>

            {/* Metadata Line */}
            <div className="text-xs sm:text-sm font-medium text-white/50 tracking-wide">
              {tracks.length} Songs {totalRuntime ? `· ${totalRuntime}` : ""}
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

            {/* Action Buttons: Play All & Shuffle */}
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
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 opacity-30">
            <Loader2 className="w-8 h-8 animate-spin text-white mb-3" />
            <span className="text-xs font-semibold uppercase tracking-widest text-white">Loading Tracks...</span>
          </div>
        ) : (
          <div className="space-y-0.5">
            {tracks.map((track, i) => {
              const isActive = track.videoId === currentSongId;
              const isHovered = hoveredTrackIndex === i;
              const isTopTrack = i === 0 || i === 1;
              const song: Song = {
                id: track.videoId,
                title: track.title,
                artist: track.artist,
                artwork: track.thumbnailUrl,
                duration: track.duration || "0:00",
                color: accentColor,
              };

              return (
                <SwipeableSongRow
                  key={track.id + i}
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
                    className={`group flex items-center px-3 sm:px-4 py-2.5 rounded-xl border-b border-white/[0.04] transition-colors duration-150 cursor-pointer select-none ${
                      isActive ? "bg-white/10 text-white" : "hover:bg-white/[0.06] text-white/90"
                    }`}
                  >
                    {/* Left: Popular Bullet & Track Number / Play icon / Visualizer */}
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

                    {/* Middle: Artwork Thumbnail + Title & Artist */}
                    <div className="flex-1 min-w-0 pr-3 sm:pr-4 flex items-center gap-3">
                      <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-black/40 border border-white/5">
                        <MusicArtwork src={track.thumbnailUrl} alt={track.title} iconSize={18} variant="track" rounded="md" />
                      </div>

                      <div className="flex flex-col min-w-0">
                        <span
                          className={`text-sm sm:text-[15px] font-medium truncate ${
                            isActive ? "text-white font-semibold" : "text-white"
                          }`}
                        >
                          {track.title}
                        </span>
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigateArtist?.(track.artist);
                          }}
                          className="text-xs text-white/45 truncate hover:text-white transition-colors cursor-pointer mt-0.5"
                        >
                          {track.artist}
                        </span>
                      </div>
                    </div>

                    {/* Right: Duration & SongMenu Trigger */}
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
        )}

        {/* Footer Metadata */}
        {!loading && tracks.length > 0 && (
          <div className="mt-12 pt-6 border-t border-white/5 text-xs text-white/40 space-y-1.5">
            <p className="font-medium text-white/50">
              {tracks.length} songs, {totalRuntime}
            </p>
            <p className="tracking-wide">
              Curated and synchronized via Nexus Music.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
