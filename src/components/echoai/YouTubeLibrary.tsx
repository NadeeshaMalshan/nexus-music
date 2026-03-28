"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { Play, ListMusic, Loader2 } from "lucide-react";
import { type YouTubePlaylist } from "@/lib/youtubeData";

interface YouTubeLibraryProps {
  onPlaylistClick?: (playlist: YouTubePlaylist) => void;
}

export function YouTubeLibrary({ onPlaylistClick }: YouTubeLibraryProps) {
  const { data: session } = useSession();
  const [playlists, setPlaylists] = useState<YouTubePlaylist[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPlaylists() {
      if (!session?.accessToken) return;
      
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/youtube/playlists");
        if (!response.ok) throw new Error("Failed to fetch playlists");
        const data = await response.json();
        setPlaylists(data);
      } catch (err) {
        console.error("Error loading YouTube playlists:", err);
        setError("Could not load your YouTube playlists. Please make sure you've granted the necessary permissions.");
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
      <div className="flex flex-col items-center justify-center h-full text-zinc-500 space-y-4">
        <ListMusic size={48} strokeWidth={1} />
        <p className="text-lg">Sign in with Google to import your YouTube data</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-red-400 p-8 text-center space-y-4">
        <p>{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 overflow-y-auto h-full custom-scrollbar">
      <h2 className="text-2xl font-bold mb-6 text-white flex items-center gap-3">
        <ListMusic className="text-purple-400" />
        Your YouTube Playlists
      </h2>
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {playlists.map((playlist) => (
          <div 
            key={playlist.id}
            onClick={() => onPlaylistClick?.(playlist)}
            className="group cursor-pointer space-y-3"
          >
            <div className="relative aspect-square rounded-2xl overflow-hidden bg-zinc-900 shadow-xl group-hover:shadow-purple-500/10 transition-all duration-300">
              {playlist.thumbnailUrl ? (
                <Image
                  src={playlist.thumbnailUrl}
                  alt={playlist.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                  <ListMusic className="text-zinc-700" size={48} />
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-purple-500 flex items-center justify-center text-white transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                  <Play size={24} fill="currentColor" />
                </div>
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-white truncate">{playlist.title}</h3>
              <p className="text-xs text-zinc-500">{playlist.itemCount} tracks</p>
            </div>
          </div>
        ))}
      </div>

      {playlists.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-500 space-y-2">
          <p className="text-lg">No playlists found in your YouTube library</p>
          <p className="text-sm">They will appear here once you create some on YouTube</p>
        </div>
      )}
    </div>
  );
}
