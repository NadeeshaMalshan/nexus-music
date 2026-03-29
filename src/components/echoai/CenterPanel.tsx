"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Sparkles, Play, Loader2, Music, Brain, RefreshCw, ListPlus, PlaySquare } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { type Song } from "./types";
import { type YouTubePlaylist } from "@/lib/youtubeData";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useDashboard } from "@/context/DashboardContext";
import { YouTubeLibrary } from "./YouTubeLibrary";
import { PlaylistDetail } from "./PlaylistDetail";

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
  playedHistory?: string[]; // Added: real history from session
  onAddToQueue?: (song: Song) => void;
  onPlayNext?: (song: Song) => void;
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
  const {
    track,
    index,
    onPlay,
    isPlaying,
    accentColor,
    onAddToQueue,
    onPlayNext,
  } = props;
  // Make the first card larger (bento hero)
  const isHero = index === 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.93, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: index * 0.055, type: "spring", stiffness: 260, damping: 22 }}
      className={`group relative overflow-hidden rounded-2xl border border-white/8 cursor-pointer
        transition-all duration-300 hover:border-white/20 hover:shadow-2xl
        ${isHero ? "sm:col-span-2 lg:col-span-2" : ""}
      `}
      style={{
        background:
          "linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
      onClick={onPlay}
      whileHover={{ scale: 1.015 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Gradient glow on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at top left, color-mix(in srgb, var(--art-accent, #a855f7) 13%, transparent) 0%, transparent 60%)`,
        }}
      />

      <div className="relative flex items-start gap-4 p-4">
        {/* Artwork */}
        <div
          className={`relative shrink-0 overflow-hidden rounded-xl shadow-lg
            ${isHero ? "h-20 w-20" : "h-14 w-14"}
          `}
        >
          {track.artwork ? (
            <Image
              src={track.artwork}
              alt={track.title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-110"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-white/8">
              <Music size={isHero ? 28 : 20} className="text-white/30" />
            </div>
          )}

          {/* Play overlay */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-300">
            {isPlaying ? (
              <Loader2 size={isHero ? 22 : 16} className="animate-spin text-white" />
            ) : (
              <Play size={isHero ? 22 : 16} fill="white" className="text-white ml-0.5" />
            )}
          </div>
        </div>

        {/* Text info */}
        <div className="flex-1 min-w-0 pr-12">
          <h3
            className={`font-bold text-white leading-tight mb-1 transition-colors truncate
              ${isHero ? "text-[17px]" : "text-[14px]"}
            `}
            style={{ color: "inherit" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--art-accent, #c084fc)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = ""; }}
          >
            {track.title}
          </h3>
          <p className={`text-zinc-400 font-medium truncate ${isHero ? "text-[14px]" : "text-[12px]"}`}>
            {track.artist}
          </p>

          {/* AI reason badge */}
          {track.reason && (
            <div className="mt-2 flex items-start gap-1.5">
              <Sparkles size={10} className="mt-0.5 shrink-0" style={{ color: "var(--art-accent, #a855f7)" }} />
              <p className="text-[11px] text-zinc-500 leading-tight line-clamp-2">
                {track.reason}
              </p>
            </div>
          )}
        </div>

        {/* Action buttons on hover */}
        <div className="absolute right-4 top-4 hidden flex-col gap-2 group-hover:flex">
          {track.id && onPlayNext && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPlayNext({
                  id: track.id!,
                  title: track.title,
                  artist: track.artist,
                  artwork: track.artwork || "",
                  duration: track.duration || "",
                  color: accentColor,
                });
              }}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all shadow-lg"
              title="Play Next"
            >
              <PlaySquare size={16} />
            </button>
          )}
          {track.id && onAddToQueue && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddToQueue({
                  id: track.id!,
                  title: track.title,
                  artist: track.artist,
                  artwork: track.artwork || "",
                  duration: track.duration || "",
                  color: accentColor,
                });
              }}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all shadow-lg"
              title="Add to Queue"
            >
              <ListPlus size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Bottom accent line */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity"
        style={{
          background: `linear-gradient(90deg, transparent, var(--art-accent, #a855f7), transparent)`,
        }}
      />
    </motion.div>
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
  } = props;
  const pathname = usePathname();
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
      // Step 1: Ask for personalised picks using our new Hybrid Engine
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          recentTrackId: currentSongId || "K4TOrB7at0Y", // Fallback to Starboy if nothing playing
          userHistory: playedHistory.length > 0 ? playedHistory : ["Top Hits 2024"] 
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
  }, []);

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
        onSongClick={onSongClick}
        playedHistory={playedHistory}
        accentColor={accentColor}
      />
    );
  }

  if (activeView === "playlists") {
    return (
      <div className="flex-1 h-full overflow-y-auto bg-[#06060a] px-6 py-8 pb-32 lg:px-12 lg:py-10 custom-scrollbar">
        <div className="mb-10 text-left">
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-[34px] flex items-center gap-3">
            Your Playlists
          </h1>
          <div className="mt-4 h-px w-full bg-white/10" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {playlists.map((playlist) => (
            <motion.div
              key={playlist.id}
              whileHover={{ scale: 1.05 }}
              onClick={() => onPlaylistClick?.(playlist)}
              className="cursor-pointer group"
            >
              <div className="relative aspect-square rounded-2xl overflow-hidden bg-white/5 border border-white/5 shadow-xl transition-all group-hover:shadow-purple-500/20">
                {playlist.thumbnailUrl ? (
                  <Image src={playlist.thumbnailUrl} alt={playlist.title} fill className="object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                    <Music className="text-zinc-700" size={48} />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                  <Play fill="white" className="text-white" size={32} />
                </div>
              </div>
              <h3 className="mt-3 font-bold text-white truncate">{playlist.title}</h3>
              <p className="text-xs text-zinc-500">{playlist.itemCount} Tracks</p>
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

  if (activeView === "playlist-detail") {
    // If selectedPlaylist is missing (deep link), we'll let PlaylistDetail handle it by ID
    return (
      <PlaylistDetail
        playlist={selectedPlaylist || { id: pathname.split("/").pop()!, title: "Loading...", itemCount: 0, thumbnailUrl: "", description: "" }}
        onSongClick={onSongClick || (() => {})}
        onQueueReplace={onQueueReplace || (() => {})}
        onAddToQueue={onAddToQueue}
        onPlayNext={onPlayNext}
        accentColor={accentColor}
        currentSongId={currentSongId}
      />
    );
  }

  return (
    <div className="flex-1 h-full overflow-y-auto bg-[#06060a] px-6 py-8 pb-32 lg:px-12 lg:py-10 custom-scrollbar">
      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="mb-10 text-left">
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-[34px] flex items-center gap-3">
          Listen Now
        </h1>
        <div className="mt-4 h-px w-full bg-white/10" />
      </div>

      <div className="grid grid-cols-1 gap-12">
        {/* ═══════════════════════════════════════════════════════════════════
            FOR YOU — Context-Aware AI Recommendations (Llama 3 / Groq)
        ════════════════════════════════════════════════════════════════════ */}
        <section>
          {/* Section header */}
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-1000"
                style={{
                  background: `linear-gradient(135deg, color-mix(in srgb, var(--art-accent, #a855f7) 25%, transparent) 0%, color-mix(in srgb, var(--art-accent, #a855f7) 12%, transparent) 100%)`,
                  border: `1px solid color-mix(in srgb, var(--art-accent, #a855f7) 25%, transparent)`,
                }}
              >
                <Sparkles size={16} style={{ color: "var(--art-accent, #a855f7)" }} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  For You
                </h2>
                <p className="text-[12px] text-zinc-500 mt-0.5">
                  Curated by Llama 3 · based on your taste
                </p>
              </div>
            </div>
            <button
              id="for-you-refresh-btn"
              onClick={fetchForYou}
              disabled={forYouLoading}
              className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw
                size={13}
                className={forYouLoading ? "animate-spin" : ""}
              />
              {forYouLoading ? "Thinking…" : "Refresh"}
            </button>
          </div>

          {/* Glassmorphism container */}
          <div
            className="relative rounded-3xl p-6 border overflow-hidden transition-all duration-1000"
            style={{
              background: `linear-gradient(135deg, color-mix(in srgb, var(--art-accent, #a855f7) 6%, transparent) 0%, rgba(255,255,255,0.02) 50%, color-mix(in srgb, var(--art-primary, #0d0b14) 40%, transparent) 100%)`,
              borderColor: `color-mix(in srgb, var(--art-accent, #a855f7) 12%, rgba(255,255,255,0.08))`,
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
          >
            {/* Decorative glows – artwork-driven */}
            <div
              className="pointer-events-none absolute -top-20 -left-20 w-72 h-72 rounded-full opacity-20 blur-3xl transition-all duration-1000"
              style={{
                background: `radial-gradient(circle, color-mix(in srgb, var(--art-accent, #a855f7) 50%, transparent) 0%, transparent 70%)`,
              }}
            />
            <div
              className="pointer-events-none absolute -bottom-20 -right-20 w-60 h-60 rounded-full opacity-15 blur-3xl transition-all duration-1000"
              style={{
                background: `radial-gradient(circle, color-mix(in srgb, var(--art-secondary, #1a1528) 80%, var(--art-accent, #a855f7)) 0%, transparent 70%)`,
              }}
            />

            {/* Listening history chip strip */}
            <div className="relative mb-5 flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              <span className="shrink-0 text-[11px] font-semibold uppercase tracking-widest text-zinc-600">
                Based on
              </span>
              {(playedHistory.length > 0 ? playedHistory : ["Your vibe"]).map((h, idx) => (
                <span
                  key={idx}
                  className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-zinc-400 backdrop-blur"
                >
                  {h}
                </span>
              ))}
            </div>

            {/* Content */}
            <AnimatePresence mode="wait">
              {forYouLoading ? (
                <motion.div
                  key="skeleton"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <ForYouSkeleton />
                </motion.div>
              ) : forYouTracks.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-16 text-center gap-3"
                >
                  <Brain size={32} className="text-zinc-700" />
                  <p className="text-zinc-500 text-sm">
                    Unable to generate recommendations right now.
                  </p>
                  <button
                    onClick={fetchForYou}
                    className="text-purple-400 hover:text-purple-300 text-sm font-medium transition-colors"
                  >
                    Try again
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="grid"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                >
                  {forYouTracks.map((track, i) => (
                    <ForYouCard
                      key={`${track.title}-${i}`}
                      track={track}
                      index={i}
                      accentColor={accentColor}
                      isPlaying={!!track.id && forYouPlayingId === track.id}
                      onPlay={() => handlePlayForYou(track)}
                      onAddToQueue={onAddToQueue}
                      onPlayNext={onPlayNext}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>


        {/* ═══════════════════════════════════════════════════════════════════
            YouTube Library playlists
        ════════════════════════════════════════════════════════════════════ */}
        {session && (
          <section>
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Your Library
                <span className="text-sm font-normal text-zinc-500">
                  from YouTube Music
                </span>
              </h2>
              <button
                id="library-refresh-btn"
                onClick={fetchPlaylists}
                className="text-sm text-zinc-400 hover:text-white transition-colors flex items-center gap-1"
                disabled={playlistsLoading}
              >
                {playlistsLoading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  "Refresh"
                )}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {playlistsLoading && playlists.length === 0
                ? Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="aspect-square rounded-xl bg-white/5 animate-pulse"
                    />
                  ))
                : playlists.map((playlist) => (
                    <motion.div
                      key={playlist.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => onPlaylistClick?.(playlist)}
                      className="group cursor-pointer flex flex-col gap-2"
                    >
                      <div className="relative aspect-square rounded-xl overflow-hidden bg-white/5 border border-white/5 shadow-md group-hover:shadow-2xl transition-all">
                        {playlist.thumbnailUrl ? (
                          <Image
                            src={playlist.thumbnailUrl}
                            alt={playlist.title}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-zinc-800 to-zinc-900">
                            <Music className="text-zinc-600" size={32} />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                        <div className="absolute bottom-2 right-2 w-8 h-8 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Play
                            size={14}
                            fill="white"
                            className="text-white ml-0.5"
                          />
                        </div>
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-white leading-tight">
                          {playlist.title}
                        </h3>
                        <p className="text-[12px] text-zinc-500">
                          {playlist.itemCount} Items
                        </p>
                      </div>
                    </motion.div>
                  ))}
            </div>
          </section>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            Your Radio placeholder
        ════════════════════════════════════════════════════════════════════ */}
        <section>
          <h2 className="mb-4 text-xl font-bold text-white">Your Radio</h2>
          <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-white/5 bg-white/2 p-8 text-center backdrop-blur-sm">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5 text-white/20">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </div>
            <h3 className="mb-2 text-xl font-bold text-white">
              Personal Station
            </h3>
            <p className="max-w-xs text-[14px] font-medium text-zinc-500">
              Listen to the songs you love and discover new ones picked just for
              you.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
