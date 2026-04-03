"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Sparkles, Play, Loader2, Music, Brain, RefreshCw, ListPlus, PlaySquare, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
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
}

type RecommendationTrack = {
  title: string;
  artist: string;
};

type ForYouTrack = {
  title: string;
  artist: string;
  reason: string;
  // resolved after YouTube search
  id?: string;
  artwork?: string;
  duration?: string;
};



// ─── Glassmorphism skeleton card ─────────────────────────────────────────────
function ForYouSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06 }}
          className="relative overflow-hidden rounded-2xl border border-white/8 bg-white/4 backdrop-blur-xl p-4 h-[120px]"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)",
          }}
        >
          {/* Shimmer overlay */}
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_infinite]"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)",
              animationDelay: `${i * 0.15}s`,
            }}
          />
          <div className="flex items-center gap-3 h-full">
            {/* Artwork placeholder */}
            <div className="h-14 w-14 shrink-0 rounded-xl bg-white/8 animate-pulse" />
            <div className="flex-1 space-y-2 min-w-0">
              <div className="h-3 w-3/4 rounded-full bg-white/10 animate-pulse" />
              <div className="h-2.5 w-1/2 rounded-full bg-white/6 animate-pulse" />
              <div className="h-2 w-2/3 rounded-full bg-white/4 animate-pulse" />
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ─── "For You" bento card ─────────────────────────────────────────────────────
function ForYouCard(props: {
  track: ForYouTrack & { id?: string; artwork?: string };
  index: number;
  onPlay: () => void;
  isPlaying: boolean;
  accentColor: string;
  onAddToQueue?: (song: Song) => void;
  onPlayNext?: (song: Song) => void;
}) {
  const { track, index, onPlay, isPlaying, accentColor, onAddToQueue, onPlayNext } = props;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="group relative flex flex-col cursor-pointer"
      onClick={onPlay}
    >
      <div className="relative aspect-square rounded-[18px] overflow-hidden bg-white/5 shadow-[0_20px_40px_rgba(0,0,0,0.4)] transition-all duration-500">
        {track.artwork ? (
          <Image
            src={track.artwork?.replace(/([=|-][swh])\d+/g, '$11200') || track.artwork || ""}
            alt={track.title}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-zinc-900">
            <Music size={32} className="text-white/20" />
          </div>
        )}
        
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-4 transition-all duration-300">
           <div className="flex items-center gap-6 animate-in fade-in slide-in-from-bottom-2 duration-400">
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
               className="p-3 rounded-full bg-white/10 hover:bg-white text-white hover:text-black transition-all hover:scale-110"
               title="Play Next"
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
               className="p-3 rounded-full bg-white/10 hover:bg-white text-white hover:text-black transition-all hover:scale-110"
               title="Add to Queue"
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

      <div className="mt-4">
        <h3 className="font-bold text-white text-[17px] tracking-tight truncate leading-tight mb-1 group-hover:text-white/80 transition-colors">
          {track.title}
        </h3>
        <p className="text-[14px] text-white/40 font-medium truncate">
          {track.artist}
        </p>
      </div>
    </motion.div>
  );
}

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
    seed,
    playedHistory = [],
    onAddToQueue,
    onPlayNext,
    onPlayPlaylist,
  } = props;
  const pathname = usePathname();
  const router = useRouter();
  const segments = pathname.split("/").filter(Boolean);
  const { data: session } = useSession();
  const [playlists, setPlaylists] = useState<YouTubePlaylist[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(false);

  // ── "For You" state ─────────────────────────────────────────────────────────
  const [forYouTracks, setForYouTracks] = useState<(ForYouTrack & { id?: string; artwork?: string })[]>([]);
  const [forYouLoading, setForYouLoading] = useState(false);
  const [forYouPlayingId, setForYouPlayingId] = useState<string | null>(null);

  // ── Fetch existing seed-based recommendations ───────────────────────────────
  const fetchPlaylists = useCallback(async () => {
    if (!session?.accessToken) return;
    setPlaylistsLoading(true);
    try {
      const response = await fetch("/api/youtube/playlists");
      if (response.ok) {
        const data = await response.json();
        setPlaylists(data.slice(0, 6));
      }
    } catch (err) {
      console.error("Failed to fetch playlists for center panel:", err);
    } finally {
      setPlaylistsLoading(false);
    }
  }, [session]);


  // ── Fetch "For You" context-aware recommendations ───────────────────────────
  const fetchForYou = useCallback(async () => {
    setForYouLoading(true);
    setForYouTracks([]);
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

      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      const aiTracks: ForYouTrack[] = Array.isArray(data.recommendations)
        ? data.recommendations
        : [];

      // Step 2: Use the unified data (the API now returns rich track data + reasons)
      const resolved = aiTracks.map((track: any) => ({
        ...track,
        id: track.youtubeId,
        artwork: track.thumbnail,
      }));

      setForYouTracks(resolved);
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

  const handlePlayForYou = async (
    track: ForYouTrack & { id?: string; artwork?: string }
  ) => {
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

  if (activeView === "library") {
    return (
      <YouTubeLibrary
        onPlaylistClick={onPlaylistClick}
        onAddToQueue={onAddToQueue}
        onPlayNext={onPlayNext}
        onPlayPlaylist={onPlayPlaylist}
        onSongClick={onSongClick}
        playedHistory={playedHistory || []}
        accentColor={accentColor}
      />
    );
  }

  if (activeView === "playlists") {
    return (
      <div className="flex-1 h-full overflow-y-auto bg-transparent px-8 py-10 pb-32 lg:px-12 lg:py-12 custom-scrollbar">
        {/* Apple Music Style Header */}
        <div className="mb-14 text-left">
          <h1 className="text-[48px] font-black tracking-tight text-white leading-none mb-3">
            Playlist
          </h1>
          <p className="text-[20px] font-medium text-white/40 mb-10">{playlists.length} Playlist</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-10 gap-y-12">
          {playlists.map((playlist) => (
            <motion.div
              key={playlist.id}
              whileHover={{ scale: 1.01 }}
              onClick={() => onPlaylistClick?.(playlist)}
              className="cursor-pointer group flex flex-col"
            >
              <div className="relative aspect-square rounded-[18px] overflow-hidden bg-white/5 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] transition-all duration-300">
                {playlist.thumbnailUrl ? (
                  <Image src={playlist.thumbnailUrl.replace("s90", "s600")} alt={playlist.title} fill className="object-cover transition-transform duration-700 group-hover:scale-110" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                    <Music className="text-zinc-700" size={48} />
                  </div>
                )}
              </div>
              <div className="mt-4">
                <h3 className="font-bold text-white text-[17px] tracking-tight truncate leading-tight mb-1">{playlist.title}</h3>
                <p className="text-[14px] text-white/40 font-medium truncate">Nexus</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  if (activeView === "nowplaying") {
    return (
      <div className="flex-1 h-full overflow-y-auto bg-[#06060a] px-6 py-8 pb-32 lg:px-12 lg:py-10 custom-scrollbar">
          <div className="flex flex-col items-center justify-center min-h-[70vh] text-center">
            {seed ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-xl w-full"
              >
                <div className="relative aspect-square w-full max-w-md mx-auto mb-12 rounded-3xl overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.5)] border border-white/10">
                  {forYouTracks.find(t => t.id === currentSongId)?.artwork ? (
                    <Image 
                      src={forYouTracks.find(t => t.id === currentSongId)!.artwork!} 
                      alt="Playing" 
                      fill 
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-white/5">
                      <Music className="text-white/20" size={120} />
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-black/80 to-transparent" />
                </div>
                <h1 className="text-4xl font-black text-white mb-2">{seed.split(" - ")[1]}</h1>
                <p className="text-2xl font-bold text-white/50">{seed.split(" - ")[0]}</p>
                
                <div className="mt-12 p-8 rounded-3xl border border-white/5 bg-white/2 backdrop-blur-xl">
                    <p className="text-zinc-400 italic">"This track is part of your AI-generated radio experience."</p>
                </div>
              </motion.div>
            ) : (
              <div className="space-y-4">
                <Music className="text-white/10 mx-auto" size={80} />
                <h2 className="text-2xl font-bold text-white/40">Nothing is playing</h2>
                <p className="text-zinc-500">Pick a track to see details here.</p>
              </div>
            )}
          </div>
      </div>
    );
  }

  if (activeView === "album") {
    return (
       <AlbumDetail
         albumId={segments[1]} 
         onBack={() => router.back()}
         onNavigateArtist={(name: string) => router.push(`/artist/${encodeURIComponent(name)}`)}
         onSongClick={onSongClick || (() => {})}
         onQueueReplace={onQueueReplace || (() => {})}
         onPlayNext={onPlayNext}
         onAddToQueue={onAddToQueue}
         onPlayPlaylist={onPlayPlaylist}
         accentColor={accentColor}
         currentSongId={currentSongId}
       />
    )
  }

  if (activeView === "playlist-detail") {
    // If selectedPlaylist is missing (deep link), we'll let PlaylistDetail handle it by ID
    return (
      <PlaylistDetail
        playlist={selectedPlaylist || { id: pathname.split("/").pop()!, title: "Loading...", itemCount: 0, thumbnailUrl: "", description: "" }}
        onSongClick={onSongClick || (() => {})}
        onQueueReplace={onQueueReplace || (() => {})}
        onAddToQueue={onAddToQueue}
        onPlayNext={onPlayNext}
        onPlayPlaylist={onPlayPlaylist}
        accentColor={accentColor}
        currentSongId={currentSongId}
      />
    );
  }
  if (activeView === "settings") {
    return <Settings />;
  }

  return (
    <div className="flex-1 h-full overflow-y-auto bg-transparent px-4 py-8 md:px-10 md:py-12 lg:px-16 pb-40 custom-scrollbar">
      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="mb-8 md:mb-14 text-left">
        <h1 className="text-3xl md:text-4xl lg:text-[48px] font-black tracking-tight text-white leading-none mb-3">
          Listen Now
        </h1>
        <p className="text-lg md:text-[20px] font-medium text-white/40 mb-6 md:mb-10">Personalized for you</p>
      </div>

      <div className="space-y-16">
        {/* ═══════════════════════════════════════════════════════════════════
            FOR YOU (Llama 3 / Groq)
        ════════════════════════════════════════════════════════════════════ */}
        <Shelf 
          title="For You" 
          onRefresh={fetchForYou} 
          loading={forYouLoading}
        >
          {forYouLoading ? (
            Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="w-[200px] shrink-0 aspect-square rounded-[18px] bg-white/5 animate-pulse" />
            ))
          ) : (
            forYouTracks.map((track, i) => (
              <div key={`${track.title}-${i}`} className="w-[200px] sm:w-[220px] lg:w-[240px] shrink-0 translate-y-0 hover:-translate-y-1 transition-transform duration-300">
                <ForYouCard
                  track={track}
                  index={i}
                  accentColor={accentColor}
                  isPlaying={!!track.id && forYouPlayingId === track.id}
                  onPlay={() => handlePlayForYou(track)}
                  onAddToQueue={onAddToQueue}
                  onPlayNext={onPlayNext}
                />
              </div>
            ))
          )}
        </Shelf>


        {/* ═══════════════════════════════════════════════════════════════════
            YouTube Library playlists
        ════════════════════════════════════════════════════════════════════ */}
        {session && (
          <Shelf
            title="Your Library"
            subtitle="from YouTube Music"
            onRefresh={fetchPlaylists}
            loading={playlistsLoading}
          >
            {playlists.map((playlist) => (
              <div
                key={playlist.id}
                onClick={() => onPlaylistClick?.(playlist)}
                className="w-[180px] sm:w-[200px] shrink-0 cursor-pointer group"
              >
                <div className="relative aspect-square rounded-[14px] overflow-hidden bg-white/5 shadow-lg group-hover:shadow-2xl transition-all duration-500">
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
                <div className="mt-3">
                  <h3 className="font-bold text-white text-[15px] tracking-tight truncate leading-tight mb-0.5">{playlist.title}</h3>
                  <p className="text-[12px] text-white/40 font-medium truncate">Nexus</p>
                </div>
              </div>
            ))}
          </Shelf>
        )}
      </div>
    </div>
  );
}
