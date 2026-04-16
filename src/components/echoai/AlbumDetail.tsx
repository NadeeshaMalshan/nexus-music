"use client";

import { useEffect, useState } from "react";
import { type Song } from "./types";
import { Play, Shuffle, Loader2, Disc, Music2, Clock, Calendar, User, ChevronLeft } from "lucide-react";
import { AudioVisualizer } from "./AudioVisualizer";
import { MusicArtwork } from "./MusicArtwork";
import { m, AnimatePresence } from "motion/react";
import { APPLE_EASE, MOTION_CONFIG } from "@/lib/animations";
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
          className="mb-8 p-3 rounded-full bg-white/5 hover:bg-white/10 text-white flex items-center gap-2 pr-5 border border-white/5"
        >
          <ChevronLeft size={20} />
          <span className="text-xs font-black uppercase tracking-widest">Back</span>
        </button>

        <header className="flex flex-col md:flex-row items-center md:items-end gap-8 md:gap-12 text-center md:text-left">
          <m.div 
            initial={false}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="relative w-64 h-64 md:w-56 md:h-56 lg:w-72 lg:h-72 shrink-0 shadow-[0_40px_100px_rgba(0,0,0,0.7)] rounded-[2.5rem] overflow-hidden group border border-white/10 animate-gpu bg-zinc-900/40"
          >
            <MusicArtwork
              src={albumData.thumbnails?.[albumData.thumbnails.length - 1]?.url}
              alt={albumData.name}
              iconSize={56}
              variant="track"
              rounded="none"
              className="group-hover:scale-110"
            />
          </m.div>

          <div className="flex-1 space-y-4 md:space-y-6 w-full max-w-xl">
            <div className="flex items-center justify-center md:justify-start gap-2">
              <span className="px-3 py-1 rounded-full bg-white/10 text-[10px] font-black uppercase tracking-[0.2em] text-white/50 border border-white/5">
                {albumData.year ? "Full Album" : "EP / Single"}
              </span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-7xl font-black text-white tracking-tighter leading-[0.9] drop-shadow-2xl">
              {albumData.name}
            </h1>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-6 gap-y-3 pt-2">
              <div 
                className="flex items-center gap-3 group cursor-pointer"
                onClick={() => onNavigateArtist?.(artistName)}
              >
                <div className="p-2.5 rounded-full bg-white/5 text-white/40 group-hover:text-white group-hover:bg-white/10 border border-white/5">
                  <User size={18} />
                </div>
                <span className="text-xl md:text-2xl font-bold text-white/90 group-hover:text-white group-hover:underline underline-offset-8 decoration-2 decoration-red-500/50">
                  {artistName}
                </span>
              </div>
              
              <div className="flex items-center gap-2.5 text-white/30 font-bold bg-white/5 px-4 py-1.5 rounded-full border border-white/5">
                <Calendar size={14} className="opacity-50" />
                <span className="text-xs uppercase tracking-widest">{albumData.year || "Release"}</span>
              </div>

              <div className="flex items-center gap-2.5 text-white/30 font-bold bg-white/5 px-4 py-1.5 rounded-full border border-white/5">
                <Disc size={14} className="opacity-50" />
                <span className="text-xs uppercase tracking-widest">{tracks.length} Songs</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-8 md:pt-4">
              <button 
                onClick={handlePlayAll}
                className="flex-1 sm:flex-initial px-10 py-5 bg-white text-black font-black rounded-2xl flex items-center justify-center gap-3 shadow-2xl"
              >
                <Play size={22} fill="black" />
                <span>Play All</span>
              </button>
              <button 
                onClick={handleShuffle}
                className="flex-1 sm:flex-initial px-10 py-5 bg-white/10 text-white font-black rounded-2xl flex items-center justify-center gap-3 hover:bg-white/20 border border-white/10"
              >
                <Shuffle size={20} />
                <span>Shuffle</span>
              </button>
            </div>
          </div>
        </header>
      </div>

      {/* Tracklist Container */}
      <div className="px-4 md:px-6 lg:px-12 mt-12 md:mt-16">
        <div className="hidden md:flex items-center gap-4 py-4 border-b border-white/5 text-zinc-500 font-black text-[10px] uppercase tracking-[0.2em] mb-4 px-4">
          <span className="w-12 text-center">#</span>
          <span className="flex-1">Track Name</span>
          <span className="w-20 flex justify-end px-4"><Clock size={16} /></span>
        </div>

        <div className="space-y-2 md:space-y-1.5">
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
                <m.div
                  initial={false}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => handleTrackClick(track, i)}
                  className={`group flex items-center gap-4 p-3 md:p-4 rounded-2xl cursor-pointer border ${
                    isActive ? "bg-white/10 border-white/10 shadow-2xl" : "hover:bg-white/5 border-transparent hover:border-white/10"
                  }`}
                >
                  <div className={`w-8 md:w-12 text-center font-black text-sm ${isActive ? "text-red-500" : "text-white/20 group-hover:text-white/60"}`}>
                    {isActive ? (
                      <div className="flex justify-center">
                        <AudioVisualizer active={isActive} barCount={4} color="#ef4444" width="20px" />
                      </div>
                    ) : String(i + 1).padStart(2, "0")}
                  </div>

                  <div className="flex-1 flex items-center gap-4 md:gap-5 min-w-0">
                    <div className="relative w-12 h-12 md:w-14 md:h-14 rounded-xl overflow-hidden shrink-0 bg-zinc-900 shadow-xl border border-white/10">
                      <MusicArtwork src={track.artwork} alt={track.title} iconSize={22} variant="track" rounded="xl" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className={`text-[16px] md:text-[17px] font-bold truncate leading-tight ${isActive ? "text-red-500" : "text-white"}`}>
                        {track.title}
                      </span>
                      <span 
                        onClick={(e) => {
                           e.stopPropagation();
                           onNavigateArtist?.(track.artist || artistName);
                        }}
                        className="text-[12px] md:text-[13px] text-white/30 font-bold tracking-tight hover:text-white cursor-pointer mt-0.5"
                      >
                        {track.artist || artistName}
                      </span>
                    </div>
                  </div>

                  <span className="text-xs font-black text-white/25 tracking-widest pr-2 md:pr-4">{track.duration || "0:00"}</span>
                </m.div>
              </SwipeableSongRow>
            );
          })}
        </div>
      </div>

      <div className="px-6 md:px-12 mt-20 mb-32 border-t border-white/5 pt-16">
        <div className="max-w-4xl space-y-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-10">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-3">Released</p>
              <p className="text-base font-bold text-white/80">{albumData.year || "2024"}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-3">Songs</p>
              <p className="text-base font-bold text-white/80">{tracks.length} Tracks</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-3">Duration</p>
              <p className="text-base font-bold text-white/80">
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
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-3">Genre</p>
              <p className="text-base font-bold text-white/80">Pop / Modern</p>
            </div>
          </div>

          <div className="pt-12 border-t border-white/5">
             <div className="flex items-center gap-4 text-[12px] font-black uppercase tracking-widest text-white/20 italic">
                <span>℗ {albumData.year || "2024"} Official Album Profile</span>
             </div>
             <p className="text-[11px] text-white/10 mt-4 font-medium max-w-xl leading-relaxed">
                All music and recordings are provided by the official artist profile and managed by their respective record labels. Content metadata and licensing are distributed via Nexus Services.
             </p>
          </div>
        </div>
      </div>
    </div>
  );
}
