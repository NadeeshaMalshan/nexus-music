"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Sparkles, Play, Loader2, Music, Brain, RefreshCw, ListPlus, PlaySquare, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { m, AnimatePresence } from "motion/react";
import { APPLE_EASE, FADE_IN_VARIANTS, SLIDE_UP_VARIANTS, SCALE_VARIANTS, MOTION_CONFIG } from "@/lib/animations";
import { type Song } from "./types";
import { type YouTubePlaylist } from "@/lib/youtubeData";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useDashboard } from "@/context/DashboardContext";
import { YouTubeLibrary } from "./YouTubeLibrary";
import { PlaylistDetail } from "./PlaylistDetail";
import { AlbumDetail } from "./AlbumDetail";
import { Settings } from "./Settings";
import { useRouter } from "next/navigation";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CenterPanelProps {
  activeView: string;
  selectedPlaylist?: YouTubePlaylist | null;
  accentColor: string;
  onSongClick?: (song: Song) => void;
  onPlaylistClick?: (playlist: YouTubePlaylist) => void;
  onQueueReplace?: (songs: Song[]) => void;
  currentSongId?: string;
  seed?: string;
  playedHistory?: Song[]; // Added: real history from session
  onAddToQueue?: (song: Song) => void;
  onPlayNext?: (song: Song) => void;
  onPlayPlaylist?: (songs: Song[], startIndex: number) => void;
  onNavigateArtist?: (name: string) => void;
}

type ForYouTrack = {
  title: string;
  artist: string;
  reason: string;
  id?: string;
  artwork?: string;
  duration?: string;
};

// ─── Shelf Component ─────────────────────────────────────────────────────────
function Shelf(props: {
  title: string;
  subtitle?: string;
  onRefresh?: () => void;
  loading?: boolean;
  children: React.ReactNode;
}) {
  const { title, subtitle, onRefresh, loading, children } = props;
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = dir === "left" ? -800 : 800;
    scrollRef.current.scrollBy({ left: amount, behavior: "smooth" });
  };

  return (
    <section className="relative group/shelf">
      <div className="mb-6 flex items-center justify-between px-1">
        <div>
          <h2 className="text-[28px] font-black text-white tracking-tight leading-none">{title}</h2>
          {subtitle && <p className="text-[14px] text-zinc-500 mt-2 font-medium">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-4">
          {onRefresh && (
            <button
               onClick={onRefresh}
               disabled={loading}
               className="text-white/40 hover:text-white transition-colors"
            >
               <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            </button>
          )}
          <div className="hidden items-center gap-2 lg:flex opacity-0 group-hover/shelf:opacity-100 transition-opacity">
            <button 
              onClick={() => scroll("left")}
              className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white transition-all backdrop-blur-md"
            >
              <ChevronLeft size={20} />
            </button>
            <button 
              onClick={() => scroll("right")}
              className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white transition-all backdrop-blur-md"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>

      <div 
        ref={scrollRef}
        className="flex items-start gap-x-8 overflow-x-auto no-scrollbar scroll-smooth px-1 pb-4"
      >
        {children}
      </div>
    </section>
  );
}

// ─── ForYouCard Component ────────────────────────────────────────────────────
function ForYouCard(props: {
  track: ForYouTrack & { id?: string; artwork?: string };
  index: number;
  onPlay: () => void;
  isPlaying: boolean;
  accentColor: string;
  onAddToQueue?: (song: Song) => void;
  onPlayNext?: (song: Song) => void;
  onNavigateArtist?: (name: string) => void;
}) {
  const { track, index, onPlay, isPlaying, accentColor, onAddToQueue, onPlayNext, onNavigateArtist } = props;

  return (
    <m.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, ease: APPLE_EASE }}
      className="group relative flex flex-col w-full min-w-0 cursor-pointer"
      onClick={onPlay}
    >
      <div className="relative w-full aspect-square rounded-[22px] overflow-hidden bg-white/5 shadow-[0_20px_40px_rgba(0,0,0,0.4)] transition-all duration-500 group-hover:shadow-[0_40px_80px_rgba(0,0,0,0.6)]">
        {track.artwork ? (
          <Image
            src={track.artwork.replace(/([=|-][swh])\d+/g, '$1800')}
            alt={track.title}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-zinc-900">
            <Music size={32} className="text-white/20" />
          </div>
        )}
        
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-4 transition-all duration-300">
           <div className="flex items-center gap-4">
             <button
               onClick={(e) => {
                 e.stopPropagation();
                 onPlayNext?.({
                   id: track.id!,
                   title: track.title,
                   artist: track.artist,
                   artwork: track.artwork || "",
                   duration: track.duration || "",
                   color: accentColor,
                 });
               }}
               className="p-3 rounded-full bg-white/10 hover:bg-white text-black transition-all hover:scale-110"
               style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: 'white' }}
             >
               <PlaySquare size={20} />
             </button>
             <button
               onClick={(e) => {
                 e.stopPropagation();
                 onAddToQueue?.({
                   id: track.id!,
                   title: track.title,
                   artist: track.artist,
                   artwork: track.artwork || "",
                   duration: track.duration || "",
                   color: accentColor,
                 });
               }}
               className="p-3 rounded-full bg-white/10 hover:bg-white text-black transition-all hover:scale-110"
               style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: 'white' }}
             >
               <ListPlus size={20} />
             </button>
           </div>
           
           <div 
             onClick={onPlay}
             className="w-16 h-16 rounded-full bg-white flex items-center justify-center text-black shadow-2xl hover:scale-105 transition-transform"
           >
             {isPlaying ? (
               <Loader2 size={32} className="animate-spin" />
             ) : (
               <Play size={32} fill="currentColor" className="ml-1" />
             )}
           </div>
        </div>
      </div>

      <div className="mt-4 text-left px-1">
        <h3 className="font-bold text-white text-[17px] tracking-tight line-clamp-2 leading-tight mb-1 group-hover:text-white transition-colors h-[42px]">
          {track.title}
        </h3>
        <p 
          onClick={(e) => {
            e.stopPropagation();
            onNavigateArtist?.(track.artist);
          }}
          className="text-[14px] text-white/40 font-medium truncate hover:text-white transition-colors cursor-pointer"
        >
          {track.artist}
        </p>
      </div>
    </m.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CenterPanel
// ─────────────────────────────────────────────────────────────────────────────
export function CenterPanel(props: CenterPanelProps) {
  const {
    activeView,
    selectedPlaylist,
    accentColor,
    onSongClick,
    onPlaylistClick,
    onQueueReplace,
    currentSongId,
    playedHistory = [],
    onAddToQueue,
    onPlayNext,
    onPlayPlaylist,
    onNavigateArtist,
  } = props;
  
  const pathname = usePathname();
  const router = useRouter();
  const segments = pathname.split("/").filter(Boolean);
  const { data: session } = useSession();
  const [playlists, setPlaylists] = useState<YouTubePlaylist[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(false);
  const [forYouTracks, setForYouTracks] = useState<(ForYouTrack & { id?: string; artwork?: string })[]>([]);
  const [forYouLoading, setForYouLoading] = useState(false);
  const [forYouPlayingId, setForYouPlayingId] = useState<string | null>(null);

  const fetchPlaylists = useCallback(async () => {
    if (!session?.accessToken) return;
    setPlaylistsLoading(true);
    try {
      const response = await fetch("/api/youtube/playlists");
      if (response.ok) {
        const data = await response.json();
        setPlaylists(data.slice(0, 12));
      }
    } catch (err) {
      console.error("Failed to fetch playlists:", err);
    } finally {
      setPlaylistsLoading(false);
    }
  }, [session]);

  const fetchForYou = useCallback(async () => {
    setForYouLoading(true);
    try {
      const historyStrings = playedHistory && playedHistory.length > 0 
        ? playedHistory.map(s => `${s.title} by ${s.artist}`).slice(0, 10)
        : ["Top Hits 2024"];

      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          recentTrackId: currentSongId || (playedHistory && playedHistory.length > 0 ? playedHistory[0].id : null),
          userHistory: historyStrings 
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const resolved = (data.recommendations || []).map((track: any) => ({
          ...track,
          id: track.youtubeId,
          artwork: track.thumbnail,
        }));
        setForYouTracks(resolved);
      }
    } catch (err) {
      console.error("For You fetch failed:", err);
    } finally {
      setForYouLoading(false);
    }
  }, [playedHistory, currentSongId]);

  useEffect(() => {
    fetchForYou();
    if (session) fetchPlaylists();
  }, [fetchForYou, fetchPlaylists, session]);

  const handlePlayForYou = async (track: ForYouTrack & { id?: string; artwork?: string }) => {
    if (!track.id || !onSongClick) return;
    setForYouPlayingId(track.id);
    onSongClick({
      id: track.id,
      title: track.title,
      artist: track.artist,
      artwork: track.artwork || "",
      duration: track.duration || "",
      color: accentColor,
    });
    setForYouPlayingId(null);
  };

  return (
    <div className="flex-1 h-full flex flex-col overflow-hidden relative">
      <div className="flex-1 h-full min-h-0 flex flex-col">
        <AnimatePresence mode="wait">
          {activeView === "playlist-detail" && (
            <m.div 
              key="playlist-detail" 
              className="flex-1 h-full min-h-0 flex flex-col overflow-hidden"
              {...FADE_IN_VARIANTS}
            >
                <PlaylistDetail
                  playlist={selectedPlaylist || { id: segments[1], title: "Loading...", itemCount: 0, thumbnailUrl: "", description: "" }}
                  accentColor={accentColor}
                  onSongClick={onSongClick || (() => {})}
                  onQueueReplace={onQueueReplace || (() => {})}
                  onAddToQueue={onAddToQueue}
                  onPlayNext={onPlayNext}
                  onPlayPlaylist={onPlayPlaylist}
                  currentSongId={currentSongId}
                  onNavigateArtist={onNavigateArtist}
                />
            </m.div>
          )}

          {activeView === "album" && (
            <m.div 
              key="album-detail" 
              className="flex-1 h-full min-h-0 flex flex-col overflow-hidden"
              {...FADE_IN_VARIANTS}
            >
                <AlbumDetail
                  albumId={segments[1]}
                  onBack={() => router.back()}
                  accentColor={accentColor}
                  onSongClick={onSongClick || (() => {})}
                  onQueueReplace={onQueueReplace || (() => {})}
                  onAddToQueue={onAddToQueue}
                  onPlayNext={onPlayNext}
                  onPlayPlaylist={onPlayPlaylist}
                  currentSongId={currentSongId}
                  onNavigateArtist={onNavigateArtist}
                />
            </m.div>
          )}

          {activeView === "library" && (
            <m.div 
               key="library" 
               className="flex-1 h-full min-h-0 flex flex-col overflow-y-auto custom-scrollbar"
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: 20 }}
               transition={MOTION_CONFIG.transition}
            >
              <YouTubeLibrary
                onPlaylistClick={onPlaylistClick}
                onAddToQueue={onAddToQueue}
                onPlayNext={onPlayNext}
                onPlayPlaylist={onPlayPlaylist}
                onSongClick={onSongClick}
                playedHistory={playedHistory}
                accentColor={accentColor}
              />
            </m.div>
          )}

          {activeView === "settings" && (
            <m.div 
              key="settings" 
              className="flex-1 h-full min-h-0 flex flex-col overflow-hidden"
              {...FADE_IN_VARIANTS}
            >
              <Settings />
            </m.div>
          )}

          {activeView === "home" && (
            <m.div
              key="home"
              initial="initial"
              animate="animate"
              exit="exit"
              variants={FADE_IN_VARIANTS}
              className="flex-1 h-full min-h-0 overflow-y-auto custom-scrollbar px-6 md:px-10 lg:px-16 pt-12 pb-40 space-y-20"
            >
              <header className="mb-12">
                <h1 className="text-[48px] font-black tracking-tighter text-white leading-none mb-3">Listen Now</h1>
                <p className="text-[20px] font-medium text-white/40">Personalized for you</p>
              </header>

              <Shelf title="For You" onRefresh={fetchForYou} loading={forYouLoading}>
                {forYouLoading ? (
                   Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="w-[240px] shrink-0 aspect-square rounded-[24px] bg-white/5 animate-pulse" />
                   ))
                ) : (
                  forYouTracks.map((track, i) => (
                    <div key={`${track.id || track.title}-${i}`} className="w-[200px] sm:w-[220px] lg:w-[240px] shrink-0 translate-y-0 hover:-translate-y-1 transition-all duration-300">
                      <ForYouCard
                        track={track}
                        index={i}
                        accentColor={accentColor}
                        isPlaying={forYouPlayingId === track.id}
                        onPlay={() => handlePlayForYou(track)}
                        onAddToQueue={onAddToQueue}
                        onPlayNext={onPlayNext}
                        onNavigateArtist={props.onNavigateArtist}
                      />
                    </div>
                  ))
                )}
              </Shelf>

              {session && (
                <Shelf title="Your Playlists" onRefresh={fetchPlaylists} loading={playlistsLoading}>
                  {playlists.map((playlist) => (
                    <div
                      key={playlist.id}
                      onClick={() => onPlaylistClick?.(playlist)}
                      className="w-[200px] shrink-0 cursor-pointer group flex flex-col"
                    >
                      <div className="relative aspect-square rounded-[20px] overflow-hidden bg-white/5 shadow-2xl transition-all duration-500 group-hover:shadow-[0_20px_50px_rgba(0,0,0,0.4)]">
                        {playlist.thumbnailUrl ? (
                          <Image
                            src={playlist.thumbnailUrl?.replace(/([=|-][swh])\d+/g, '$1800') || playlist.thumbnailUrl || ""}
                            alt={playlist.title}
                            fill
                            className="object-cover transition-transform duration-700 group-hover:scale-110"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-zinc-900 border border-white/5">
                            <Music className="text-zinc-700" size={32} />
                          </div>
                        )}
                      </div>
                      <div className="mt-4">
                        <h3 className="font-bold text-white text-[16px] tracking-tight truncate leading-tight mb-1">{playlist.title}</h3>
                        <p className="text-[13px] text-white/40 font-medium truncate">YouTube Library</p>
                      </div>
                    </div>
                  ))}
                </Shelf>
              )}
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
