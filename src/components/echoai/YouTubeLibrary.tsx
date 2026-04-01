"use client";

import { useEffect, useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { 
  Play, Loader2, Music2, Heart, Plus, Sparkles, 
  Search, Filter, History, ListPlus, PlaySquare
} from "lucide-react";
import { type YouTubePlaylist } from "@/lib/youtubeData";
import { type Song } from "./types";
import { CreatePlaylistModal, AiPlaylistModal } from "./LibraryModals";
import { motion, AnimatePresence } from "motion/react";

interface YouTubeLibraryProps {
  onPlaylistClick?: (playlist: YouTubePlaylist) => void;
  onAddToQueue?: (song: Song) => void;
  onPlayNext?: (song: Song) => void;
  onPlayPlaylist?: (songs: Song[], startIndex: number) => void;
  onSongClick?: (song: Song, reset?: boolean) => void;
  playedHistory?: Song[];
  accentColor?: string;
}

type LibraryTab = "playlists" | "history" | "liked";

export function YouTubeLibrary({
  onPlaylistClick,
  onAddToQueue,
  onPlayNext,
  onPlayPlaylist,
  onSongClick,
  playedHistory = [],
  accentColor = "#FA233B",
}: YouTubeLibraryProps) {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<LibraryTab>("playlists");
  const [searchQuery, setSearchQuery] = useState("");
  
  const [playlists, setPlaylists] = useState<YouTubePlaylist[]>([]);
  const [likedSongs, setLikedSongs] = useState<any[]>([]);
  const [ytHistory, setYtHistory] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  useEffect(() => {
    async function loadLibrary() {
      if (!session?.accessToken) return;
      setLoading(true);
      try {
        const [pRes, lRes, hRes] = await Promise.all([
          fetch("/api/youtube/playlists"),
          fetch("/api/youtube/liked"),
          fetch("/api/youtube/history")
        ]);
        
        if (pRes.ok) setPlaylists(await pRes.json());
        if (lRes.ok) setLikedSongs(await lRes.json());
        if (hRes.ok) {
           const hData = await hRes.json();
           setYtHistory(Array.isArray(hData.tracks) ? hData.tracks : []);
        }
      } catch (err) {
        setError("Failed to sync library data.");
      } finally {
        setLoading(false);
      }
    }
    if (session) loadLibrary();
  }, [session]);

  const filteredPlaylists = useMemo(() => 
    playlists.filter(p => (p.title || "").toLowerCase().includes(searchQuery.toLowerCase())),
    [playlists, searchQuery]
  );

  const filteredLiked = useMemo(() => 
    likedSongs.filter(s => (s.title?.toLowerCase() || "").includes(searchQuery.toLowerCase()) || (s.artist?.toLowerCase() || "").includes(searchQuery.toLowerCase())),
    [likedSongs, searchQuery]
  );

  const unifiedHistory = useMemo(() => {
    const local = playedHistory.map(s => ({ ...s, source: "App" as const }));
    const remote = ytHistory.map(t => ({
      id: t.videoId,
      title: t.title,
      artist: t.artist,
      artwork: t.thumbnailUrl,
      duration: t.duration || "0:00",
      source: "YouTube" as const,
      color: accentColor
    }));

    const seenIds = new Set(local.map(s => s.id));
    const uniqueRemote = remote.filter(s => !seenIds.has(s.id));

    return [...local, ...uniqueRemote].filter(s => 
      (s.title?.toLowerCase() || "").includes(searchQuery.toLowerCase()) || 
      (s.artist?.toLowerCase() || "").includes(searchQuery.toLowerCase())
    ).map(track => ({ ...track, source: (track as any).source || "YouTube" }));
  }, [playedHistory, ytHistory, searchQuery, accentColor]);

  if (!session) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#050505]">
        <div className="w-20 h-20 md:w-24 md:h-24 bg-linear-to-tr from-[#FA233B] to-[#FF5E3A] rounded-[32px] flex items-center justify-center mb-10 shadow-2xl">
          <Music2 className="w-10 h-10 md:w-12 md:h-12 text-white" />
        </div>
        <h2 className="text-3xl md:text-4xl font-black text-white mb-4">Your Music Library</h2>
        <p className="text-white/40 mb-10 max-w-sm text-sm">Connect your Google account to access your playlists and history.</p>
        <button 
          onClick={() => window.location.href = "/api/auth/signin"}
          className="px-10 py-4 bg-white text-black font-bold rounded-full hover:bg-zinc-200 transition-all shadow-xl"
        >
          Sign in with Google
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full flex flex-col bg-transparent">
      <header className="px-6 pt-8 pb-4 md:px-8 md:pt-10 md:pb-6 lg:px-12 border-b border-white/3 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-[1600px] mx-auto space-y-6 md:space-y-8">
           <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6">
              <div>
                 <h1 className="text-3xl md:text-4xl lg:text-[44px] font-black text-white tracking-tighter leading-none mb-2 md:mb-4">Library</h1>
                 <p className="text-white/30 font-bold uppercase tracking-[0.2em] text-[10px] md:text-[11px]">Personal Music Ecosystem</p>
              </div>

              <div className="flex items-center gap-2 md:gap-3">
                 <button 
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 md:px-6 py-2 md:py-2.5 rounded-xl bg-white/5 border border-white/5 text-white font-bold text-xs md:text-sm hover:bg-white/10 transition-all"
                 >
                    <Plus className="w-4 h-4 md:w-5 md:h-5 shrink-0" strokeWidth={3} />
                    <span className="truncate">New Playlist</span>
                 </button>
                 <button 
                    onClick={() => setIsAiModalOpen(true)}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 md:px-6 py-2 md:py-2.5 rounded-xl font-bold text-xs md:text-sm transition-all shadow-inner border"
                    style={{ 
                      backgroundColor: `${accentColor}15`, 
                      borderColor: `${accentColor}30`,
                      color: accentColor 
                    }}
                 >
                    <Sparkles className="w-4 h-4 md:w-5 md:h-5 shrink-0" />
                    <span className="truncate">AI Build</span>
                 </button>
              </div>
           </div>

           <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 md:gap-6">
              <div className="flex w-full sm:w-auto bg-white/3 p-1 rounded-xl md:rounded-2xl border border-white/5 overflow-x-auto no-scrollbar">
                 {(["playlists", "history", "liked"] as LibraryTab[]).map(tab => (
                    <button
                       key={tab}
                       onClick={() => setActiveTab(tab)}
                       className={`flex-1 sm:flex-none px-4 md:px-8 py-2 md:py-2.5 rounded-lg md:rounded-xl text-xs md:text-sm font-bold capitalize transition-all duration-300 ${
                          activeTab === tab 
                          ? "bg-white text-black shadow-2xl" 
                          : "text-white/40 hover:text-white/60"
                       }`}
                    >
                       {tab}
                    </button>
                 ))}
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                 <div className="relative flex-1 sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 w-4 h-4 md:w-5 md:h-5" />
                    <input 
                       value={searchQuery}
                       onChange={e => setSearchQuery(e.target.value)}
                       placeholder={`Search...`}
                       className="w-full bg-white/3 border border-white/5 rounded-xl py-2 md:py-2.5 pl-9 md:pl-10 pr-4 text-xs md:text-sm text-white placeholder:text-white/20 focus:bg-white/5 focus:border-white/10 outline-none transition-all"
                    />
                 </div>
                 <button className="p-2 md:p-2.5 rounded-xl bg-white/3 border border-white/5 text-white/40 hover:text-white transition-all">
                    <Filter className="w-4 h-4 md:w-5 md:h-5" />
                 </button>
              </div>
           </div>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto px-6 py-8 md:px-8 md:py-10 lg:px-12 custom-scrollbar pb-32 md:pb-40 text-left">
        <div className="max-w-[1600px] mx-auto">
           {loading ? (
              <div className="flex flex-col items-center justify-center py-20 md:py-40 gap-4">
                 <Loader2 className="w-8 h-8 md:w-10 md:h-10 animate-spin text-[#FA233B]" />
                 <p className="text-white/20 font-bold uppercase tracking-widest text-[9px] md:text-[10px]">Syncing Database...</p>
              </div>
           ) : (
              <AnimatePresence mode="wait">
                 {activeTab === "playlists" && (
                    <motion.div 
                       key="playlists-pane"
                       initial={{ opacity: 0, y: 10 }}
                       animate={{ opacity: 1, y: 0 }}
                       exit={{ opacity: 0, y: -10 }}
                       className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 md:gap-x-8 gap-y-8 md:gap-y-12"
                    >
                       <div 
                          onClick={() => setActiveTab("liked")}
                          className="group flex flex-col cursor-pointer"
                       >
                          <div className="relative aspect-square mb-3 md:mb-4 rounded-3xl md:rounded-[28px] overflow-hidden bg-linear-to-br from-[#FA233B] to-[#8E2DE2] shadow-2xl flex items-center justify-center ring-1 ring-white/10 transition-transform duration-500 hover:scale-[1.03]">
                             <Heart className="w-8 h-8 md:w-16 md:h-16 text-white drop-shadow-xl" fill="white" />
                          </div>
                          <h3 className="text-base md:text-lg font-bold text-white truncate">Liked Songs</h3>
                          <p className="text-xs md:text-sm text-white/30 font-bold uppercase tracking-wider">{likedSongs.length} Tracks</p>
                       </div>

                       {filteredPlaylists.map(playlist => (
                          <div 
                             key={playlist.id} 
                             onClick={() => onPlaylistClick?.(playlist)}
                             className="group flex flex-col cursor-pointer"
                          >
                             <div className="relative aspect-square mb-3 md:mb-4 rounded-3xl md:rounded-[28px] overflow-hidden bg-zinc-900 border border-white/5 shadow-xl transition-all duration-500 hover:scale-[1.03]">
                                {playlist.thumbnailUrl ? (
                                   <Image src={playlist.thumbnailUrl.replace("s90", "s600")} alt={playlist.title} fill className="object-cover" />
                                ) : (
                                   <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                                      <Music2 className="text-white/10 w-10 h-10 md:w-16 md:h-16" />
                                   </div>
                                )}
                             </div>
                             <h3 className="text-sm md:text-[17px] font-bold text-white truncate group-hover:text-[#FA243C] transition-colors leading-tight mb-0.5 md:mb-1">{playlist.title}</h3>
                             <p className="text-xs md:text-[14px] text-white/20 font-bold">{playlist.itemCount} Items</p>
                          </div>
                       ))}
                    </motion.div>
                 )}

                 {activeTab === "history" && (
                    <motion.div 
                       key="history-pane"
                       initial={{ opacity: 0, y: 10 }}
                       animate={{ opacity: 1, y: 0 }}
                       exit={{ opacity: 0, y: -10 }}
                       className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4"
                    >
                        {unifiedHistory.map((track, idx) => (
                           <div 
                              key={`hist-${idx}`}
                              onClick={() => {
                                if (onPlayPlaylist) {
                                  onPlayPlaylist(unifiedHistory as Song[], idx);
                                } else {
                                  onSongClick?.(track as Song);
                                }
                              }}
                              className="group flex items-center gap-3 md:gap-4 p-3 md:p-4 rounded-2xl bg-white/3 border border-white/5 hover:bg-white/8 transition-all cursor-pointer relative overflow-hidden"
                           >
                              <div className="h-12 w-12 md:h-16 md:w-16 shrink-0 rounded-xl overflow-hidden bg-zinc-800 border border-white/10 shadow-lg relative">
                                 {track.artwork ? (
                                    <Image src={track.artwork} alt="" fill className="object-cover" />
                                 ) : (
                                    <div className="h-full w-full flex items-center justify-center">
                                       <Music2 className="text-white/10 w-5 h-5 md:w-6 md:h-6" />
                                    </div>
                                 )}
                              </div>
                              <div className="flex-1 min-w-0">
                                 <p className="truncate font-bold text-white text-sm md:text-[16px] mb-0.5">{track.title}</p>
                                 <p className="truncate text-xs md:text-[13px] text-white/40 font-medium">{track.artist}</p>
                              </div>
                              <div className="flex flex-row items-center gap-2 shrink-0">
                                 <div className="hidden group-hover:flex items-center gap-1">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onPlayNext?.(track as Song);
                                      }}
                                      className="p-2 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-all focus:outline-none"
                                      title="Play Next"
                                    >
                                      <PlaySquare size={16} />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onAddToQueue?.(track as Song);
                                      }}
                                      className="p-2 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-all focus:outline-none"
                                      title="Add to Queue"
                                    >
                                      <ListPlus size={16} />
                                    </button>
                                 </div>
                                 <span className={`text-[8px] md:text-[9px] font-black px-1.5 md:px-2 py-0.5 rounded-full uppercase tracking-tighter ${
                                    (track as any).source === "App" ? "bg-[#FA233B]/20 text-[#FA233B]" : "bg-white/10 text-white/40"
                                 }`}>
                                    {(track as any).source}
                                 </span>
                              </div>
                           </div>
                        ))}
                    </motion.div>
                 )}

                 {activeTab === "liked" && (
                    <motion.div 
                       key="liked-pane"
                       initial={{ opacity: 0, y: 10 }}
                       animate={{ opacity: 1, y: 0 }}
                       exit={{ opacity: 0, y: -10 }}
                       className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6"
                    >
                       {filteredLiked.map((track, idx) => {
                          const likedSongsList: Song[] = filteredLiked.map(t => ({
                             id: t.videoId,
                             title: t.title,
                             artist: t.artist,
                             artwork: t.thumbnailUrl,
                             duration: t.duration || "",
                             color: accentColor,
                          }));
                          
                          const songObj = likedSongsList[idx];
                          return (
                            <div 
                               key={`liked-${idx}`}
                               onClick={() => {
                                 if (onPlayPlaylist) {
                                   onPlayPlaylist(likedSongsList, idx);
                                 } else {
                                   onSongClick?.(songObj);
                                 }
                               }}
                               className="group flex flex-col cursor-pointer"
                            >
                               <div className="relative aspect-square mb-3 md:mb-4 rounded-3xl md:rounded-[28px] overflow-hidden bg-zinc-900 border border-white/5 shadow-xl transition-all duration-500 hover:scale-[1.03]">
                                  <img src={track.thumbnailUrl?.replace("s90", "s600")} alt="" className="h-full w-full object-cover" />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-3 transition-opacity duration-300">
                                     <button
                                       onClick={(e) => {
                                         e.stopPropagation();
                                         onPlayNext?.(songObj);
                                       }}
                                       className="p-3 rounded-full bg-white/20 hover:bg-white text-white hover:text-black transition-all hover:scale-110 focus:outline-none"
                                       title="Play Next"
                                     >
                                       <PlaySquare size={20} />
                                     </button>
                                     <button
                                       onClick={(e) => {
                                         e.stopPropagation();
                                         onAddToQueue?.(songObj);
                                       }}
                                       className="p-3 rounded-full bg-white/20 hover:bg-white text-white hover:text-black transition-all hover:scale-110 focus:outline-none"
                                       title="Add to Queue"
                                     >
                                       <ListPlus size={20} />
                                     </button>
                                  </div>
                               </div>
                               <h3 className="font-bold text-white truncate text-base md:text-[17px] mb-0.5 md:mb-1 leading-tight">{track.title}</h3>
                               <p className="text-white/30 text-xs md:text-[14px] font-bold truncate">{track.artist}</p>
                            </div>
                          );
                       })}
                    </motion.div>
                 )}
              </AnimatePresence>
           )}
        </div>
      </main>

      <CreatePlaylistModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} accentColor={accentColor} />
      <AiPlaylistModal isOpen={isAiModalOpen} onClose={() => setIsAiModalOpen(false)} accentColor={accentColor} />
    </div>
  );
}
