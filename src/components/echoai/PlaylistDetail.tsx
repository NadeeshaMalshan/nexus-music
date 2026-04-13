"use client";

import { useEffect, useState } from "react";
import { type YouTubePlaylist, type YouTubeTrack } from "@/lib/youtubeData";
import { type Song } from "./types";
import { Play, Shuffle, Loader2, Music2, Clock, MoreHorizontal, ListPlus, PlaySquare, ChevronLeft } from "lucide-react";
import Image from "next/image";
import { AudioVisualizer } from "./AudioVisualizer";
import { m, AnimatePresence } from "motion/react";
import { APPLE_EASE } from "@/lib/animations";
import { SwipeableSongRow } from "./SwipeableSongRow";
import { useDashboard } from "@/context/DashboardContext";
import { titleSuggestsMusicVideo } from "@/lib/musicVideoTitle";

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

export function PlaylistDetail({ playlist, onSongClick, onQueueReplace, accentColor, currentSongId, onAddToQueue, onPlayNext, onPlayPlaylist, onNavigateArtist, onBack }: PlaylistDetailProps) {
  const { setOverrideArtwork } = useDashboard();
  const [currentPlaylist, setCurrentPlaylist] = useState<YouTubePlaylist>(playlist);
  const [tracks, setTracks] = useState<YouTubeTrack[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        // 1. Resolve basic metadata (Title, Description, Art)
        // If it's a deep link (coming from ArtistPage), we might only have an ID
        let meta = { ...playlist };
        
        // Try to get metadata from our dedicated music API first (v. fast for YTM IDs)
        const musicMetaRes = await fetch(`/api/yt-playlist?id=${playlist.id}`);
        if (musicMetaRes.ok) {
           const musicData = await musicMetaRes.json();
           meta = {
             id: playlist.id,
             title: musicData.name || musicData.title || meta.title,
             description: musicData.description || meta.description,
             thumbnailUrl: musicData.thumbnails?.[musicData.thumbnails.length - 1]?.url || meta.thumbnailUrl,
             itemCount: musicData.songs?.length || 0
           };
           // If we got songs from this call, we can set them immediately too!
           if (musicData.songs?.length) {
              const mappedTracks: YouTubeTrack[] = musicData.songs.map((s: any) => ({
                id: s.videoId,
                videoId: s.videoId,
                title: s.title,
                artist: s.artist,
                thumbnailUrl: s.artwork,
                duration: s.duration
              }));
              setTracks(mappedTracks);
              setCurrentPlaylist(meta as YouTubePlaylist);
              setLoading(false);
              return; // Exit early since we have everything
           }
        }

        // 2. Fallback to user library check for metadata
        if (!meta.title || meta.title === "Loading...") {
          const plRes = await fetch(`/api/youtube/playlists`);
          if (plRes.ok) {
            const allPls: YouTubePlaylist[] = await plRes.json();
            const found = allPls.find(p => p.id === playlist.id);
            if (found) meta = { ...meta, ...found };
          }
        }
        setCurrentPlaylist(meta as YouTubePlaylist);

        // 3. Load tracks (Fallback if yt-playlist didn't fulfill it)
        const res = await fetch(`/api/youtube/playlist-items?playlistId=${playlist.id}`);
        if (res.ok) {
          const data = await res.json();
          setTracks(data);
        }
      } catch (err) {
        console.error("Failed to load playlist tracks:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();

    // Reset global theme when leaving playlist page
    return () => {
      setOverrideArtwork(null);
    };
  }, [playlist.id, playlist.title, setOverrideArtwork]);

  // Update override artwork whenever currentPlaylist changes (e.g. after metadata loads)
  useEffect(() => {
    if (currentPlaylist.thumbnailUrl) {
      setOverrideArtwork(currentPlaylist.thumbnailUrl);
    }
  }, [currentPlaylist.thumbnailUrl, setOverrideArtwork]);

  // Use currentPlaylist for rendering
  const displayPlaylist = currentPlaylist;

  const handleTrackClick = (track: YouTubeTrack, index: number) => {
    if (onPlayPlaylist) {
      const mappedSongs: Song[] = tracks.map((t) => ({
        id: t.videoId,
        title: t.title,
        artist: t.artist,
        artwork: t.thumbnailUrl,
        duration: t.duration || "0:00",
        color: accentColor,
        preferVideoPlayback: titleSuggestsMusicVideo(t.title),
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
        preferVideoPlayback: titleSuggestsMusicVideo(track.title),
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
      preferVideoPlayback: titleSuggestsMusicVideo(track.title),
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
      preferVideoPlayback: titleSuggestsMusicVideo(track.title),
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
      {/* Back Button */}
      {onBack && (
        <div className="px-6 pt-8 lg:px-12">
          <button 
            onClick={onBack}
            className="p-3 rounded-full bg-white/5 hover:bg-white/10 text-white transition-all flex items-center gap-2 pr-5 border border-white/5 backdrop-blur-md active:scale-95"
          >
            <ChevronLeft size={20} />
            <span className="text-xs font-black uppercase tracking-widest">Back</span>
          </button>
        </div>
      )}

      {/* Header Section */}
      <header className={`relative px-6 ${onBack ? 'pt-8' : 'pt-16'} pb-12 md:py-16 lg:px-12 flex flex-col md:flex-row items-center md:items-end gap-8 md:gap-12 text-center md:text-left`}>
        <m.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, ease: APPLE_EASE }}
          className="relative w-64 h-64 md:w-56 md:h-56 lg:w-72 lg:h-72 shrink-0 shadow-[0_40px_90px_rgba(0,0,0,0.6)] rounded-[2rem] overflow-hidden group border border-white/10"
        >
          {displayPlaylist.thumbnailUrl ? (
            <Image 
              src={displayPlaylist.thumbnailUrl.replace("s90", "s512")} 
              alt={displayPlaylist.title} 
              fill 
              className="object-cover transition-transform duration-1000 group-hover:scale-110" 
              priority
            />
          ) : (
            <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
              <Music2 size={64} className="text-zinc-700" />
            </div>
          )}
        </m.div>
        
        <div className="flex-1 space-y-4 md:space-y-6 w-full max-w-2xl">
          <div className="flex items-center justify-center md:justify-start gap-2">
            <span className="px-3 py-1 rounded-full bg-white/10 text-[10px] font-black uppercase tracking-[0.2em] text-white/50 border border-white/5 backdrop-blur-sm">
              Playlist
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-7xl font-black text-white tracking-tighter leading-[0.9] drop-shadow-2xl">
            {displayPlaylist.title}
          </h1>

          <p className="text-white/40 font-bold text-sm md:text-base max-w-xl mx-auto md:mx-0 leading-relaxed">
            {displayPlaylist.description || "A curated experience, automatically synchronized to your Nexus library."}
          </p>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-6">
            <button 
              onClick={handlePlayAll}
              className="px-10 py-4.5 bg-white text-black font-black rounded-2xl flex items-center justify-center gap-3 hover:scale-105 active:scale-95 transition-all shadow-2xl"
            >
              <Play size={20} fill="black" />
              <span>Play All</span>
            </button>
            <button 
              onClick={handleShuffle}
              className="px-10 py-4.5 bg-white/10 text-white font-black rounded-2xl flex items-center justify-center gap-3 hover:bg-white/20 transition-all active:scale-95 border border-white/10 backdrop-blur-2xl hover:scale-105"
            >
              <Shuffle size={20} />
              <span>Shuffle</span>
            </button>
          </div>
        </div>
      </header>

      {/* Tracks Container */}
      <div className="px-4 md:px-6 lg:px-12 pb-40 mt-8">
        <div className="hidden md:flex items-center gap-4 py-4 border-b border-white/5 text-zinc-500 font-black text-[10px] uppercase tracking-[0.2em] mb-4 px-4">
          <span className="w-12 text-center">#</span>
          <span className="flex-1">Title</span>
          <span className="w-48 truncate">Artist</span>
          <span className="w-20 flex justify-end px-4"><Clock size={16} /></span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 opacity-20">
            <Loader2 className="w-12 h-12 animate-spin text-white mb-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">Hydrating Tracks...</span>
          </div>
        ) : (
          <div className="space-y-2 md:space-y-1.5">
            {tracks.map((track, i) => {
              const isActive = track.videoId === currentSongId;
              const song: Song = {
                id: track.videoId,
                title: track.title,
                artist: track.artist,
                artwork: track.thumbnailUrl,
                duration: track.duration || "0:00",
                color: accentColor,
                preferVideoPlayback: titleSuggestsMusicVideo(track.title),
              };

              return (
                <SwipeableSongRow
                  key={`pl-${i}-${track.videoId}`}
                  onSwipeRight={() => onPlayNext?.(song)}
                  onSwipeLeft={() => onAddToQueue?.(song)}
                >
                  <m.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02, ease: APPLE_EASE }}
                    onClick={() => handleTrackClick(track, i)}
                    className={`group flex items-center gap-4 p-3 md:p-4 rounded-2xl transition-all cursor-pointer border ${
                      isActive ? "bg-white/10 border-white/10 shadow-2xl backdrop-blur-md" : "hover:bg-white/5 border-transparent hover:border-white/10"
                    }`}
                  >
                    <div className={`w-8 md:w-12 text-center font-black text-sm ${isActive ? "text-red-500" : "text-white/20 group-hover:text-white/60"}`}>
                      {isActive ? (
                        <div className="flex justify-center">
                          <AudioVisualizer active={isActive} barCount={4} color="#ef4444" width="20px" />
                        </div>
                      ) : i + 1}
                    </div>

                    <div className="flex-1 flex items-center gap-4 md:gap-5 min-w-0">
                      <div
                        className={`relative rounded-xl overflow-hidden shrink-0 bg-zinc-900 shadow-xl border border-white/10 ${
                          titleSuggestsMusicVideo(track.title)
                            ? "h-12 md:h-14 w-auto aspect-video"
                            : "w-12 h-12 md:w-14 md:h-14"
                        }`}
                      >
                        <Image src={track.thumbnailUrl} alt={track.title} fill className="object-cover" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className={`text-[16px] md:text-[17px] font-bold truncate transition-colors leading-tight ${isActive ? "text-red-500" : "text-white"}`}>
                          {track.title}
                        </span>
                        <span 
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigateArtist?.(track.artist);
                          }}
                          className="text-[12px] md:text-[13px] text-white/30 font-bold tracking-tight md:hidden hover:text-white transition-colors cursor-pointer mt-0.5"
                        >
                          {track.artist}
                        </span>
                      </div>
                    </div>

                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigateArtist?.(track.artist);
                      }}
                      className="hidden md:block w-48 text-[14px] text-white/40 font-bold truncate hover:text-white transition-colors cursor-pointer"
                    >
                      {track.artist}
                    </div>

                    <div className="w-20 md:w-24 flex justify-end items-center gap-4 pr-2">
                       <span className="text-[11px] font-black text-white/20 tracking-widest">{track.duration}</span>
                    </div>
                  </m.div>
                </SwipeableSongRow>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
