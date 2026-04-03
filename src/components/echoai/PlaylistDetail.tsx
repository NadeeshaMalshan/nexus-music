"use client";

import { useEffect, useState } from "react";
import { type YouTubePlaylist, type YouTubeTrack } from "@/lib/youtubeData";
import { type Song } from "./types";
import { Play, Shuffle, Loader2, Music2, Clock, MoreHorizontal, ListPlus, PlaySquare } from "lucide-react";
import Image from "next/image";
import { AudioVisualizer } from "./AudioVisualizer";

interface PlaylistDetailProps {
  playlist: YouTubePlaylist;
  onSongClick: (song: Song) => void;
  onQueueReplace: (songs: Song[]) => void;
  accentColor: string;
  currentSongId?: string;
  onAddToQueue?: (song: Song) => void;
  onPlayNext?: (song: Song) => void;
  onPlayPlaylist?: (songs: Song[], startIndex: number) => void;
}

export function PlaylistDetail({ playlist, onSongClick, onQueueReplace, accentColor, currentSongId, onAddToQueue, onPlayNext, onPlayPlaylist }: PlaylistDetailProps) {
  const [currentPlaylist, setCurrentPlaylist] = useState<YouTubePlaylist>(playlist);
  const [tracks, setTracks] = useState<YouTubeTrack[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        // If playlist is just a shell with an ID (from deep link)
        if (!playlist.title || playlist.title === "Loading...") {
          const plRes = await fetch(`/api/youtube/playlists`);
          if (plRes.ok) {
            const allPls: YouTubePlaylist[] = await plRes.json();
            const found = allPls.find(p => p.id === playlist.id);
            if (found) setCurrentPlaylist(found);
          }
        }

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
  }, [playlist.id, playlist.title]);

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
      }));
      onPlayPlaylist(mappedSongs, index);
    } else {
      onSongClick({
        id: track.videoId,
        title: track.title,
        artist: track.artist,
        artwork: track.thumbnailUrl,
        duration: track.duration || "0:00",
        color: accentColor
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
    <div className="flex-1 h-full overflow-y-auto bg-transparent custom-scrollbar pb-32">
      {/* Header Section */}
      <header className="relative px-6 py-12 lg:px-12 flex flex-col md:flex-row items-end gap-8">
        <div className="relative w-48 h-48 lg:w-64 lg:h-64 shrink-0 shadow-[0_30px_60px_rgba(0,0,0,0.5)] rounded-2xl overflow-hidden group border border-white/10">
          {displayPlaylist.thumbnailUrl ? (
            <Image 
              src={displayPlaylist.thumbnailUrl.replace("s90", "s512")} 
              alt={displayPlaylist.title} 
              fill 
              className="object-cover transition-transform duration-700 group-hover:scale-110" 
            />
          ) : (
            <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
              <Music2 size={64} className="text-zinc-700" />
            </div>
          )}
        </div>
        
        <div className="flex-1 space-y-4">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-white/40">Playlist</p>
          <h1 className="text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight">
            {displayPlaylist.title}
          </h1>
          <p className="text-white/60 font-medium max-w-2xl line-clamp-2">
            {displayPlaylist.description || "A custom YouTube playlist imported to Nexus."}
          </p>
          
          <div className="flex items-center gap-4 pt-4">
            <button 
              onClick={handlePlayAll}
              className="px-8 py-3 bg-white text-black font-bold rounded-xl flex items-center gap-2 hover:bg-zinc-200 transition-all active:scale-95 shadow-xl"
            >
              <Play size={20} fill="black" />
              Play
            </button>
            <button 
              onClick={handleShuffle}
              className="px-8 py-3 bg-white/10 text-white font-bold rounded-xl flex items-center gap-2 hover:bg-white/20 transition-all active:scale-95 border border-white/10 backdrop-blur-xl"
            >
              <Shuffle size={20} />
              Shuffle
            </button>
          </div>
        </div>
      </header>

      {/* Tracks Table */}
      <div className="px-6 lg:px-12 pb-32">
        <div className="flex items-center gap-4 py-3 border-b border-white/5 text-zinc-500 font-bold text-xs uppercase tracking-wider mb-2">
          <span className="w-10 text-center">#</span>
          <span className="flex-1">Title</span>
          <span className="hidden md:block w-48 truncate">Artist</span>
          <span className="w-20 flex justify-end px-4"><Clock size={16} /></span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-zinc-700" />
          </div>
        ) : (
          <div className="space-y-1">
            {tracks.map((track, i) => {
              const isActive = track.videoId === currentSongId;
              return (
                <div 
                  key={track.id}
                  onClick={() => handleTrackClick(track, i)}
                  className={`group flex items-center gap-4 p-3 rounded-xl transition-all cursor-pointer border ${
                    isActive ? "bg-white/10 border-white/10 shadow-lg" : "hover:bg-white/5 border-transparent hover:border-white/5"
                  }`}
                >
                  <div className={`w-10 text-center font-medium ${isActive ? "text-red-500" : "text-zinc-500 group-hover:text-white"}`}>
                    {isActive ? (
                      <AudioVisualizer active={isActive} barCount={4} color="#ef4444" width="100%" />
                    ) : i + 1}
                  </div>
                <div className="flex-1 flex items-center gap-4 min-w-0">
                  <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-zinc-900 shadow-lg">
                    <Image src={track.thumbnailUrl} alt={track.title} fill className="object-cover" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className={`text-[15px] font-semibold truncate group-hover:text-red-500 transition-colors ${isActive ? "text-red-500" : "text-white"}`}>
                      {track.title}
                    </span>
                    <span className="text-[13px] text-zinc-500 font-medium truncate md:hidden">
                      {track.artist}
                    </span>
                  </div>
                </div>
                <div className="hidden md:block w-48 text-[14px] text-zinc-400 font-medium truncate">
                  {track.artist}
                </div>
                <div className="w-20 md:w-32 flex justify-end items-center gap-2 px-4 text-zinc-500 group-hover:text-zinc-300">
                  <div className="hidden group-hover:flex items-center gap-1">
                    {onPlayNext && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onPlayNext({
                            id: track.videoId,
                            title: track.title,
                            artist: track.artist,
                            artwork: track.thumbnailUrl,
                            duration: track.duration || "0:00",
                            color: accentColor,
                          });
                        }}
                        className="p-2 hover:bg-white/10 rounded-full transition-all"
                        title="Play Next"
                      >
                        <PlaySquare size={16} />
                      </button>
                    )}
                    {onAddToQueue && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddToQueue({
                            id: track.videoId,
                            title: track.title,
                            artist: track.artist,
                            artwork: track.thumbnailUrl,
                            duration: track.duration || "0:00",
                            color: accentColor,
                          });
                        }}
                        className="p-2 hover:bg-white/10 rounded-full transition-all"
                        title="Add to Queue"
                      >
                        <ListPlus size={16} />
                      </button>
                    )}
                  </div>
                  <span className="text-xs font-mono">{track.duration}</span>
                </div>
              </div>
            );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
