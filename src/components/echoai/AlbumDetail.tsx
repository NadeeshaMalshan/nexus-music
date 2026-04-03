"use client";

import { useEffect, useState } from "react";
import { type Song } from "./types";
import { Play, Shuffle, Loader2, Disc, Music2, Clock, Calendar, User, ChevronLeft } from "lucide-react";
import Image from "next/image";
import { AudioVisualizer } from "./AudioVisualizer";
import { motion, AnimatePresence } from "motion/react";
import { useDashboard } from "@/context/DashboardContext";
import { SwipeableSongRow } from "./SwipeableSongRow";

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

export function AlbumDetail({ albumId, onSongClick, onQueueReplace, onBack, onNavigateArtist, accentColor, currentSongId, onAddToQueue, onPlayNext, onPlayPlaylist }: AlbumDetailProps) {
  const { setOverrideArtwork } = useDashboard();
  const [albumData, setAlbumData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const res = await fetch(`/api/album?id=${albumId}`);
        if (res.ok) {
          const data = await res.json();
          setAlbumData(data);
          
          // Set the global dashboard background based on the artwork
          const artworkUrl = data.thumbnails?.[data.thumbnails.length - 1]?.url;
          if (artworkUrl) {
            setOverrideArtwork(artworkUrl);
          }
        }
      } catch (err) {
        console.error("Failed to load album details:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();

    // Reset background when leaving the page (on unmount)
    return () => {
      setOverrideArtwork(null);
    };
  }, [albumId, setOverrideArtwork]);

  if (loading) {
    return <div className="flex-1 h-full bg-transparent" />;
  }

  if (!albumData) return null;

  const tracks = albumData.songs || [];
  const artistName = albumData.artist?.name || "Unknown Artist";

  const handleTrackClick = (track: any, index: number) => {
    if (onPlayPlaylist) {
      const mappedSongs: Song[] = tracks.map((t: any) => ({
        id: t.videoId,
        title: t.title,
        artist: t.artist || artistName,
        artwork: t.artwork,
        duration: t.duration || "0:00",
        color: accentColor,
      }));
      onPlayPlaylist(mappedSongs, index);
    } else {
      onSongClick({
        id: track.videoId,
        title: track.title,
        artist: track.artist || artistName,
        artwork: track.artwork,
        duration: track.duration || "0:00",
        color: accentColor
      });
    }
  };

  const handlePlayAll = () => {
    if (tracks.length === 0) return;
    const mappedSongs: Song[] = tracks.map((t: any) => ({
      id: t.videoId,
      title: t.title,
      artist: t.artist || artistName,
      artwork: t.artwork,
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
      artwork: t.artwork,
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

  return (
    <div className="flex-1 h-full overflow-y-auto bg-transparent custom-scrollbar pb-40">
      {/* Navigation & Header */}
      <div className="relative px-6 py-8 lg:px-12">
        <button 
          onClick={onBack}
          className="mb-8 p-2 rounded-full bg-white/5 hover:bg-white/10 text-white transition-all flex items-center gap-2 pr-4 border border-white/5"
        >
          <ChevronLeft size={20} />
          <span className="text-xs font-black uppercase tracking-wider">Back</span>
        </button>

        <header className="flex flex-col md:flex-row items-end gap-10">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative w-56 h-56 lg:w-72 lg:h-72 shrink-0 shadow-[0_40px_80px_rgba(0,0,0,0.6)] rounded-3xl overflow-hidden group border border-white/10"
          >
            <Image 
              src={albumData.thumbnails?.[albumData.thumbnails.length - 1]?.url || ""} 
              alt={albumData.name} 
              fill 
              className="object-cover transition-transform duration-1000 group-hover:scale-110" 
            />
          </motion.div>

          <div className="flex-1 space-y-4">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-md bg-white/10 text-[10px] font-black uppercase tracking-widest text-white/60 border border-white/5">
                {albumData.year ? "Full Album" : "EP / Single"}
              </span>
            </div>

            <h1 className="text-4xl lg:text-6xl font-black text-white tracking-tighter leading-none">
              {albumData.name}
            </h1>

            <div className="flex flex-wrap items-center gap-6 pt-2">
              <div 
                className="flex items-center gap-2.5 group cursor-pointer"
                onClick={() => onNavigateArtist?.(artistName)}
              >
                <div className="p-2 rounded-full bg-white/5 text-white/40 group-hover:text-white group-hover:bg-white/10 transition-all">
                  <User size={16} />
                </div>
                <span className="text-lg font-bold text-white/80 group-hover:text-white group-hover:underline underline-offset-4 decoration-2 decoration-red-500 transition-all">
                  {artistName}
                </span>
              </div>
              
              <div className="flex items-center gap-2.5 text-white/40">
                <Calendar size={16} />
                <span className="text-sm font-bold tracking-tight">{albumData.year || "Release"}</span>
              </div>

              <div className="flex items-center gap-2.5 text-white/40">
                <Disc size={16} />
                <span className="text-sm font-bold tracking-tight">{tracks.length} songs</span>
              </div>
            </div>

            <div className="flex items-center gap-4 pt-8">
              <button 
                onClick={handlePlayAll}
                className="px-10 py-4 bg-white text-black font-black rounded-2xl flex items-center gap-3 hover:scale-105 active:scale-95 transition-all shadow-2xl"
              >
                <Play size={20} fill="black" />
                Play All
              </button>
              <button 
                onClick={handleShuffle}
                className="px-10 py-4 bg-white/10 text-white font-black rounded-2xl flex items-center gap-3 hover:bg-white/20 transition-all active:scale-95 border border-white/10 backdrop-blur-xl hover:scale-105"
              >
                <Shuffle size={20} />
                Shuffle
              </button>
            </div>
          </div>
        </header>
      </div>

      {/* Tracklist Container */}
      <div className="px-6 lg:px-12 mt-8">
        <div className="flex items-center gap-4 py-4 border-b border-white/5 text-zinc-500 font-black text-[10px] uppercase tracking-[0.2em] mb-4">
          <span className="w-12 text-center">#</span>
          <span className="flex-1">Track Name</span>
          <span className="w-20 flex justify-end px-4"><Clock size={16} /></span>
        </div>

        <div className="space-y-1.5">
          {tracks.map((track: any, i: number) => {
            const isActive = track.videoId === currentSongId;
            const song: Song = {
              id: track.videoId,
              title: track.title,
              artist: track.artist || artistName,
              artwork: track.artwork,
              duration: track.duration || "0:00",
              color: accentColor,
            };
            return (
              <SwipeableSongRow
                key={track.videoId + i}
                onSwipeRight={() => onPlayNext?.(song)}
                onSwipeLeft={() => onAddToQueue?.(song)}
              >
                <motion.div
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => handleTrackClick(track, i)}
                  className={`group flex items-center gap-4 p-4 rounded-2xl transition-all cursor-pointer border ${
                    isActive ? "bg-white/10 border-white/10 shadow-2xl" : "hover:bg-white/5 border-transparent hover:border-white/10"
                  }`}
                >
                  <div className={`w-12 text-center font-black text-sm ${isActive ? "text-red-500" : "text-white/20 group-hover:text-white/60"}`}>
                    {isActive ? (
                      <AudioVisualizer active={isActive} barCount={4} color="#ef4444" width="100%" />
                    ) : String(i + 1).padStart(2, "0")}
                  </div>

                  <div className="flex-1 flex items-center gap-5 min-w-0">
                    <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-zinc-900/50 shadow-lg border border-white/5">
                      <Image src={track.artwork} alt={track.title} fill className="object-cover" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className={`text-[16px] font-bold truncate transition-colors ${isActive ? "text-red-500" : "text-white"}`}>
                        {track.title}
                      </span>
                      <span className="text-[12px] text-white/30 font-bold tracking-tight">
                        {track.artist || artistName}
                      </span>
                    </div>
                  </div>

                  <span className="text-xs font-black text-white/25 tracking-widest pr-4">{track.duration || "0:00"}</span>
                </motion.div>
              </SwipeableSongRow>
            );
          })}
        </div>
      </div>

      <div className="px-6 lg:px-12 mt-12 mb-20 border-t border-white/5 pt-12">
        <div className="max-w-4xl space-y-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2">Released</p>
              <p className="text-sm font-bold text-white/80">{albumData.year || "2024"}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2">Songs</p>
              <p className="text-sm font-bold text-white/80">{tracks.length} tracks</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2">Duration</p>
              <p className="text-sm font-bold text-white/80">
                {(() => {
                  const totalSec = tracks.reduce((acc: number, t: any) => {
                    const [m, s] = (t.duration || "0:00").split(":").map(Number);
                    return acc + (m * 60 + (s || 0));
                  }, 0);
                  const h = Math.floor(totalSec / 3600);
                  const m = Math.floor((totalSec % 3600) / 60);
                  return h > 0 ? `${h} hr ${m} min` : `${m} min`;
                })()}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2">Genre</p>
              <p className="text-sm font-bold text-white/80">Pop / Modern</p>
            </div>
          </div>

          <div className="pt-8 border-t border-white/5">
             <div className="flex items-center gap-4 text-[11px] font-black uppercase tracking-wider text-white/20 italic">
                <span>℗ {albumData.year || "2024"} Official Album Profile</span>
             </div>
             <p className="text-[10px] text-white/15 mt-2 font-medium max-w-lg leading-relaxed">
                All music and recordings are provided by the official artist profile and managed by their respective record labels.
             </p>
          </div>
        </div>
      </div>
    </div>
  );
}
