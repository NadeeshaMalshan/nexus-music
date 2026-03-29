"use client";

import { useEffect, useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { 
  Play, Loader2, ChevronRight, Music2, Heart, Plus, Sparkles, 
  Clock, ListMusic, Search, Filter, History, LayoutGrid, List
} from "lucide-react";
import { type YouTubePlaylist } from "@/lib/youtubeData";
import { type Song } from "./types";
import { CreatePlaylistModal, AiPlaylistModal } from "./LibraryModals";
import { motion, AnimatePresence } from "motion/react";

interface YouTubeLibraryProps {
  onPlaylistClick?: (playlist: YouTubePlaylist) => void;
  onAddToQueue?: (song: Song) => void;
  onPlayNext?: (song: Song) => void;
  onSongClick?: (song: Song) => void;
  playedHistory?: Song[];
  accentColor?: string;
}

type LibraryTab = "playlists" | "history" | "liked";

export function YouTubeLibrary({
  onPlaylistClick,
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
      } catch (err) { console.error(err); } finally { setLoading(false); }
    }
    if (session) loadLibrary();
  }, [session]);

  const filteredPlaylists = useMemo(() => 
    playlists.filter(p => p.title?.toLowerCase().includes(searchQuery.toLowerCase())),
    [playlists, searchQuery]
  );

  const filteredLiked = useMemo(() => 
    likedSongs.filter(s => (s.title?.toLowerCase() || "").includes(searchQuery.toLowerCase()) || (s.artist?.toLowerCase() || "").includes(searchQuery.toLowerCase())),
    [likedSongs, searchQuery]
  );

  const unifiedHistory = useMemo(() => {
    const local = playedHistory.map(s => ({ ...s, source: "App" as const }));
    const remote = ytHistory.map(t => ({
      id: t.videoId, title: t.title, artist: t.artist, artwork: t.thumbnailUrl,
      duration: t.duration || "0:00", source: "YouTube" as const, color: accentColor
    }));
    const seenIds = new Set(local.map(s => s.id));
    const uniqueRemote = remote.filter(s => !seenIds.has(s.id));
    return [...local, ...uniqueRemote].filter(s => 
      (s.title?.toLowerCase() || "").includes(searchQuery.toLowerCase()) || 
      (s.artist?.toLowerCase() || "").includes(searchQuery.toLowerCase())
    );
  }, [playedHistory, ytHistory, searchQuery, accentColor]);

  if (!session) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#050505]">
        <div className="w-32 h-32 bg-linear-to-tr from-[#FA233B] to-[#FF5E3A] rounded-[48px] flex items-center justify-center mb-10 shadow-2xl relative overflow-hidden group">
           <div className="absolute inset-x-0 bottom-0 h-full bg-white/20 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
           <Music2 size={56} className="text-white relative z-10" />
        </div>
        <h2 className="text-5xl font-black text-white mb-6 tracking-tighter">Your Nexus Hub</h2>
        <p className="text-white/20 mb-12 max-w-sm font-bold text-lg leading-snug">Connect your Google account to synchronize your entire music existence.</p>
        <button 
          onClick={() => window.location.href = "/api/auth/signin"}
          className="px-12 py-5 bg-white text-black font-black text-xl rounded-full hover:scale-105 transition-all shadow-[0_20px_50px_rgba(255,255,255,0.1)] active:scale-95"
        >
          Sign in with Google
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full flex flex-col bg-transparent">
      {/* ─── NEXUS LIBRARY HEADER ────────────────────────────────────────── */}
      <header className="px-6 pt-12 pb-8 lg:px-12 backdrop-blur-3xl sticky top-0 z-20">
        <div className="max-w-[1700px] mx-auto space-y-10">
           <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
              <div className="space-y-1">
                 <p className="text-white/10 font-black uppercase tracking-[0.4em] text-xs">Nexus Ecosystem</p>
                 <h1 className="text-[64px] lg:text-[84px] font-black text-white tracking-tighter leading-none">Library</h1>
              </div>

              <div className="flex items-center gap-4">
                 <button 
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex items-center gap-3 px-8 py-3.5 rounded-[22px] bg-white/5 border border-white/5 text-white font-black text-base hover:bg-white/10 transition-all shadow-lg active:scale-95"
                 >
                    <Plus size={20} strokeWidth={3} />
                    New Playlist
                 </button>
                 <button 
                    onClick={() => setIsAiModalOpen(true)}
                    className="flex items-center gap-3 px-8 py-3.5 rounded-[22px] font-black text-base transition-all shadow-[0_15px_30px_rgba(0,0,0,0.4)] border active:scale-95"
                    style={{ 
                      backgroundColor: `${accentColor}20`, 
                      borderColor: `${accentColor}40`,
                      color: accentColor 
                    }}
                 >
                    <Sparkles size={20} />
                    AI Build
                 </button>
              </div>
           </div>

           {/* Tab Switcher & Filters */}
           <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-8">
              <div className="flex bg-white/5 p-2 rounded-[28px] border border-white/5 backdrop-blur-xl">
                 {(["playlists", "history", "liked"] as LibraryTab[]).map(tab => (
                    <button
                       key={tab}
                       onClick={() => setActiveTab(tab)}
                       className={`px-10 py-3 rounded-[20px] text-base font-black capitalize transition-all duration-500 ${
                          activeTab === tab 
                          ? "bg-white text-black shadow-2xl scale-105" 
                          : "text-white/30 hover:text-white/60"
                       }`}
                    >
                       {tab}
                    </button>
                 ))}
              </div>

              <div className="flex items-center gap-4 w-full xl:w-auto">
                 <div className="relative flex-1 xl:w-[400px]">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-white/10" size={20} />
                    <input 
                       value={searchQuery}
                       onChange={e => setSearchQuery(e.target.value)}
                       placeholder={`Search in ${activeTab}...`}
                       className="w-full bg-white/3 border border-white/5 rounded-[24px] py-4 pl-14 pr-6 text-lg text-white font-bold placeholder:text-white/10 focus:bg-white/8 focus:border-white/20 outline-none transition-all shadow-inner"
                    />
                 </div>
                 <button className="p-4 rounded-[24px] bg-white/5 border border-white/5 text-white/20 hover:text-white transition-all shadow-lg active:scale-90">
                    <Filter size={22} />
                 </button>
              </div>
           </div>
        </div>
      </header>

      {/* ─── LIBRARY GRID ────────────────────────────────────────────────── */}
      <main className="flex-1 min-h-0 overflow-y-auto px-6 py-12 lg:px-12 custom-scrollbar pb-64">
        <div className="max-w-[1700px] mx-auto">
           {loading ? (
              <div className="flex flex-col items-center justify-center py-48 gap-6">
                 <Loader2 className="w-16 h-16 animate-spin" style={{ color: accentColor }} />
                 <p className="text-white/15 font-black uppercase tracking-[0.3em] text-xs">Synchronizing Nexus</p>
              </div>
           ) : (
              <AnimatePresence mode="wait">
                 {activeTab === "playlists" && (
                    <motion.div 
                       key="playlists-pane"
                       initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                       className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-x-8 gap-y-16"
                    >
                       <div 
                          onClick={() => setActiveTab("liked")}
                          className="group flex flex-col cursor-pointer"
                       >
                          <div className="relative aspect-square mb-6 rounded-[48px] overflow-hidden bg-linear-to-br from-[#FA233B] to-[#8E2DE2] shadow-[0_20px_60px_rgba(250,35,59,0.3)] flex items-center justify-center ring-1 ring-white/10 group-hover:scale-105 transition-all duration-700">
                             <Heart size={80} fill="white" className="text-white drop-shadow-2xl group-hover:scale-110 transition-transform duration-1000" />
                          </div>
                          <h3 className="text-2xl font-black text-white truncate px-1">Liked Songs</h3>
                          <p className="text-sm text-white/20 font-black uppercase tracking-widest px-1">{likedSongs.length} Tracks</p>
                       </div>

                       {filteredPlaylists.map(playlist => (
                          <div 
                             key={playlist.id} 
                             onClick={() => onPlaylistClick?.(playlist)}
                             className="group flex flex-col cursor-pointer"
                          >
                             <div className="relative aspect-square mb-6 rounded-[48px] overflow-hidden bg-white/3 border border-white/5 shadow-2xl transition-all duration-700 group-hover:shadow-[0_40px_100px_rgba(0,0,0,0.6)] group-hover:scale-105 group-hover:border-white/20">
                                {playlist.thumbnailUrl ? (
                                   <Image 
                                      src={playlist.thumbnailUrl.replace("s90", "s800")} 
                                      alt={playlist.title} fill 
                                      className="object-cover transition-transform duration-[3s] group-hover:scale-110 grayscale-[0.2] group-hover:grayscale-0" 
                                   />
                                ) : (
                                   <div className="w-full h-full flex items-center justify-center bg-white/3">
                                      <Music2 className="text-white/5" size={80} />
                                   </div>
                                )}
                                <div className="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-end p-8">
                                   <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-2xl active:scale-90 transition-all translate-y-4 group-hover:translate-y-0 duration-500">
                                      <Play size={28} fill="black" className="text-black ml-1.5" />
                                   </div>
                                </div>
                             </div>
                             <h3 className="text-xl font-black text-white truncate group-hover:text-[#FA243C] transition-colors leading-tight mb-1 px-1">{playlist.title}</h3>
                             <p className="text-[12px] text-white/10 font-black uppercase tracking-[0.2em] px-1">{playlist.itemCount} Collections</p>
                          </div>
                       ))}
                    </motion.div>
                 )}

                 {activeTab === "history" && (
                    <motion.div 
                       key="history-pane"
                       initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                       className="space-y-6"
                    >
                       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {unifiedHistory.map((track, idx) => (
                             <div 
                                key={`hist-${idx}`}
                                onClick={() => onSongClick?.(track as Song)}
                                className="group flex items-center gap-6 p-5 rounded-[32px] bg-white/3 border border-white/5 hover:bg-white/8 hover:border-white/20 hover:scale-[1.02] transition-all cursor-pointer relative overflow-hidden shadow-xl"
                             >
                                <div className="h-20 w-20 shrink-0 rounded-[20px] overflow-hidden bg-white/5 border border-white/5 shadow-2xl relative">
                                   {track.artwork ? (
                                      <Image src={track.artwork} alt="" fill className="object-cover grayscale-[0.3] group-hover:grayscale-0 transition-all duration-700" />
                                   ) : (
                                      <div className="h-full w-full flex items-center justify-center"><Music2 className="text-white/10" size={32} /></div>
                                   )}
                                   <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Play size={24} fill="white" className="text-white" />
                                   </div>
                                </div>
                                <div className="flex-1 min-w-0 pr-4">
                                   <p className="truncate font-black text-white text-xl mb-1">{track.title}</p>
                                   <p className="truncate text-sm font-black text-white/20 uppercase tracking-widest">{track.artist}</p>
                                </div>
                                <div className="flex flex-col items-end gap-2 shrink-0">
                                   <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${
                                      track.source === "App" ? "bg-white/10 text-white shadow-inner" : "bg-white/3 text-white/20"
                                   }`}>
                                      {track.source}
                                   </span>
                                   <span className="text-[12px] text-white/5 font-black">{track.duration}</span>
                                </div>
                             </div>
                          ))}
                       </div>
                       
                       {unifiedHistory.length === 0 && (
                          <div className="py-64 flex flex-col items-center justify-center text-center opacity-10">
                             <History size={100} className="mb-8" />
                             <h3 className="text-3xl font-black uppercase tracking-tighter">No timeline found</h3>
                             <p className="max-w-xs mt-4 font-bold">Initiate playback to begin your musical journey.</p>
                          </div>
                       )}
                    </motion.div>
                 )}

                 {activeTab === "liked" && (
                    <motion.div 
                       key="liked-pane"
                       initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                       className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-x-8 gap-y-16"
                    >
                       {filteredLiked.map((track, idx) => (
                          <div 
                             key={`liked-${idx}`}
                             onClick={() => onSongClick?.({
                                id: track.videoId, title: track.title, artist: track.artist, artwork: track.thumbnailUrl,
                                duration: track.duration || "", color: accentColor,
                             })}
                             className="group flex flex-col cursor-pointer"
                          >
                             <div className="relative aspect-square mb-6 rounded-[48px] overflow-hidden bg-white/3 border border-white/5 shadow-2xl transition-all duration-700 group-hover:scale-105 group-hover:shadow-[0_40px_100px_rgba(250,35,59,0.2)] group-hover:border-[#FA233B]/20">
                                <img src={track.thumbnailUrl?.replace("s90", "s800")} alt="" className="h-full w-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all duration-1000" />
                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                   <div className="w-20 h-20 rounded-full bg-[#FA233B] flex items-center justify-center shadow-[0_0_50px_rgba(250,35,59,0.6)] group-hover:scale-110 active:scale-90 transition-all">
                                      <Play size={32} fill="white" className="text-white ml-2" />
                                   </div>
                                </div>
                             </div>
                             <h3 className="font-black text-white truncate text-xl mb-1 px-1 tracking-tight">{track.title}</h3>
                             <p className="text-white/20 text-xs font-black truncate uppercase tracking-[0.2em] px-1">{track.artist}</p>
                          </div>
                       ))}
                    </motion.div>
                 )}
              </AnimatePresence>
           )}
        </div>
      </main>

      <CreatePlaylistModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
      <AiPlaylistModal isOpen={isAiModalOpen} onClose={() => setIsAiModalOpen(false)} />
    </div>
  );
}
