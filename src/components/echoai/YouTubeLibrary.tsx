"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { Play, Loader2, ChevronRight, Music2, Heart, Plus, Sparkles } from "lucide-react";
import { type YouTubePlaylist } from "@/lib/youtubeData";
import { type Song } from "./types";
import { CreatePlaylistModal, AiPlaylistModal } from "./LibraryModals";

interface YouTubeLibraryProps {
  onPlaylistClick?: (playlist: YouTubePlaylist) => void;
  onAddToQueue?: (song: Song) => void;
  onPlayNext?: (song: Song) => void;
}

export function YouTubeLibrary({ onPlaylistClick, onAddToQueue, onPlayNext }: YouTubeLibraryProps) {
  const { data: session } = useSession();
  const [playlists, setPlaylists] = useState<YouTubePlaylist[]>([]);
  const [likedSongs, setLikedSongs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  useEffect(() => {
    async function loadPlaylists() {
      if (!session?.accessToken) return;
      
      setLoading(true);
      setError(null);
      try {
        const [pRes, lRes] = await Promise.all([
          fetch("/api/youtube/playlists"),
          fetch("/api/youtube/liked")
        ]);
        
        if (!pRes.ok || !lRes.ok) throw new Error("Failed to fetch library data");
        
        const [pData, lData] = await Promise.all([pRes.json(), lRes.json()]);
        setPlaylists(pData);
        setLikedSongs(lData);
      } catch (err) {
        console.error("Error loading YouTube library:", err);
        setError("Could not load your YouTube library. Please make sure you've granted the necessary permissions.");
      } finally {
        setLoading(false);
      }
    }

    if (session) {
      loadPlaylists();
    }
  }, [session]);

  if (!session) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full bg-[#050505]">
        <div className="text-center p-8 max-w-md">
          <div className="w-20 h-20 bg-gradient-to-tr from-[#007AFF] to-[#5856D6] rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
            <Music2 size={40} className="text-white" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-3">Your Music Library</h2>
          <p className="text-zinc-400 mb-8 font-medium">Sign in to sync your playlists and start building your personal collection.</p>
          <button 
            onClick={() => window.location.href = "/api/auth/signin"}
            className="px-8 py-3 bg-white text-black font-bold rounded-full hover:bg-zinc-200 transition-all transform active:scale-95"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center h-full bg-[#050505]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-[#007AFF]" />
          <p className="text-zinc-500 font-medium">Loading Library...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full relative overflow-hidden bg-[#050505]">
      <div className="h-full overflow-y-auto px-6 py-10 lg:px-12 custom-scrollbar pb-32">
        <div className="max-w-[1600px] mx-auto">
        <header className="mb-10 space-y-6">
          <h1 className="text-[34px] font-bold text-white tracking-tight">Library</h1>
          
          {/* Main Action Buttons */}
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2.5 px-6 py-2.5 rounded-full bg-white text-black font-bold text-[15px] hover:bg-zinc-200 transition-all active:scale-95"
            >
              <Plus size={18} strokeWidth={3} />
              Create a Playlist
            </button>
            <button 
              onClick={() => setIsAiModalOpen(true)}
              className="group flex items-center gap-2.5 px-6 py-2.5 rounded-full bg-black/40 text-purple-400 font-bold text-[15px] border border-purple-500/20 hover:border-purple-500/50 hover:bg-purple-500/10 transition-all active:scale-95 shadow-lg shadow-purple-500/5"
            >
              <Sparkles size={18} strokeWidth={2.5} className="group-hover:animate-pulse" />
              Generate Playlist
            </button>
          </div>
          
          <div className="h-px w-full bg-white/5" />
        </header>

        {/* Liked Songs Special Card */}
        <section className="mb-12">
          <div 
            onClick={() => onPlaylistClick?.({
              id: "LL",
              title: "Liked Songs",
              description: "Your liked songs from YouTube Music",
              thumbnailUrl: likedSongs[0]?.thumbnailUrl || "",
              itemCount: likedSongs.length
            })}
            className="group relative h-48 overflow-hidden rounded-2xl bg-[#1c1c1e] p-8 cursor-pointer shadow-xl transition-all duration-300 hover:bg-[#2c2c2e] border border-white/5"
          >
            <div className="relative z-10 flex h-full flex-col justify-end">
              <div className="flex items-center gap-4 mb-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-tr from-pink-500 to-red-600 shadow-lg">
                  <Heart size={24} fill="white" className="text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">Liked Songs</h2>
                  <p className="text-zinc-500 text-sm font-medium uppercase tracking-[0.2em]">Playlist</p>
                </div>
              </div>
              <p className="text-zinc-400 font-bold">{likedSongs.length} Songs</p>
            </div>
            {/* Glossy Overlay */}
            <div className="absolute inset-0 bg-linear-to-tr from-transparent via-white/5 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="absolute top-1/2 right-8 -translate-y-1/2 w-14 h-14 rounded-full bg-red-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transform translate-x-4 group-hover:translate-x-0 transition-all shadow-xl">
               <Play size={24} fill="white" className="text-white ml-1" />
            </div>
          </div>
        </section>

        {/* Playlists Grid */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-[22px] font-bold text-white tracking-tight">Playlists</h2>
            <button className="text-[#007AFF] text-sm font-semibold hover:underline">See All</button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-6 gap-y-10">
            {playlists.map((playlist) => (
              <div 
                key={playlist.id}
                onClick={() => onPlaylistClick?.(playlist)}
                className="group flex flex-col cursor-pointer"
              >
                <div className="relative aspect-square mb-4 rounded-xl overflow-hidden bg-zinc-900 border border-white/5 shadow-md transition-all duration-500 group-hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)]">
                  {playlist.thumbnailUrl ? (
                    <Image
                      src={playlist.thumbnailUrl}
                      alt={playlist.title}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                      <Music2 className="text-zinc-600" size={48} />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
                  <div className="absolute bottom-3 right-3 w-10 h-10 bg-white shadow-xl rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                    <Play size={18} fill="black" className="text-black ml-0.5" />
                  </div>
                </div>
                <div className="min-w-0">
                  <h3 className="text-[15px] font-bold text-white truncate leading-tight mb-1 group-hover:text-[#FA243C] transition-colors">
                    {playlist.title}
                  </h3>
                  <p className="text-[13px] text-zinc-500 font-medium truncate">
                    {playlist.itemCount} Items
                  </p>
                </div>
              </div>
            ))}
            
            {/* Placeholder for newly created ones */}
            {playlists.length === 0 && !loading && (
              <div className="flex flex-col opacity-40">
                <div className="aspect-square mb-4 rounded-xl border border-dashed border-white/20 flex flex-col items-center justify-center gap-2">
                   <Music2 size={32} />
                   <span className="text-xs font-medium">No Playlists</span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Categories Section */}
        <section>
          <h2 className="text-[22px] font-bold text-white tracking-tight mb-8">More to Explore</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {['Recently Added', 'Artists', 'Albums', 'Songs'].map((cat) => (
              <div key={cat} className="h-16 flex items-center justify-between px-6 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all cursor-pointer group active:scale-[0.98]">
                <span className="text-lg font-bold text-white">{cat}</span>
                <ChevronRight className="text-zinc-600 group-hover:text-white transition-all transform group-hover:translate-x-1" size={20} />
              </div>
            ))}
          </div>
        </section>
      </div>

      {error && !loading && (
        <div className="mt-20 flex flex-col items-center justify-center text-red-500 p-8 text-center max-w-lg mx-auto">
          <p className="mb-4 font-bold">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-red-600 text-white font-bold rounded-full"
          >
            Retry
          </button>
        </div>
      )}

      </div>

      {/* Modals - Now absolute to parent container */}
      <CreatePlaylistModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
      <AiPlaylistModal isOpen={isAiModalOpen} onClose={() => setIsAiModalOpen(false)} />
    </div>
  );
}
