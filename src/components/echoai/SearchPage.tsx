"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, Mic, X, Play, Clock, ListPlus, PlaySquare, MoreHorizontal, ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { type Song } from "./types";

interface SearchPageProps {
  onClose: () => void;
  onSongSelect: (song: Song) => void;
  onQueueReplace?: (songs: Song[]) => void;
  onAddToQueue?: (song: Song) => void;
  onPlayNext?: (song: Song) => void;
}

type SearchItem = {
  videoId: string;
  title: string;
  author: string;
  duration: string;
  thumbnail: string;
};

export function SearchPage({ onClose, onSongSelect, onQueueReplace, onAddToQueue, onPlayNext }: SearchPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("Top");
  const [isListening, setIsListening] = useState(false);
  const [identifiedSong, setIdentifiedSong] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchItem[]>([]);
  const [songColors, setSongColors] = useState<Record<string, string>>({});
  const searchTimeoutRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const categories = ["Top", "Songs", "Remixes", "Artists", "Albums"];

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const q = urlParams.get("q");
    if (q) {
      setSearchQuery(q);
      void (async () => runSearch(q))();
    }
  }, []);

  const runSearch = useCallback(async (queryOverride?: string, categoryOverride?: string) => {
    const query = (queryOverride ?? searchQuery).trim();
    const cat = categoryOverride ?? activeCategory;
    if (!query) { setSearchResults([]); return; }
    setSearchLoading(true);
    let finalQuery = query;
    if (cat === "Remixes") finalQuery += " remix";
    else if (cat === "Artists") finalQuery += " artist";
    else if (cat === "Albums") finalQuery += " album";
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(finalQuery)}`, { cache: "no-store", });
      if (!response.ok) throw new Error("Search request failed");
      const payload = (await response.json()) as { items: SearchItem[] };
      setSearchResults(payload.items || []);
    } catch (error) { console.error(error); setSearchResults([]); } finally { setSearchLoading(false); }
  }, [searchQuery, activeCategory]);

  useEffect(() => {
    if (searchTimeoutRef.current) window.clearTimeout(searchTimeoutRef.current);
    if (!searchQuery.trim()) { setSearchResults([]); setSearchLoading(false); return; }
    searchTimeoutRef.current = window.setTimeout(() => { void runSearch(searchQuery); }, 400);
    return () => { if (searchTimeoutRef.current) window.clearTimeout(searchTimeoutRef.current); };
  }, [searchQuery, runSearch]);

  const handleMusicIdentifier = async () => {
    try {
      if (isListening) return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder; audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => event.data.size > 0 && audioChunksRef.current.push(event.data);
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        const formData = new FormData(); formData.append("audio", audioBlob);
        try {
          const response = await fetch("/api/identify", { method: "POST", body: formData });
          const data = await response.json();
          if (response.ok) {
             setIdentifiedSong(`${data.title} by ${data.artist}`);
             if (data.id) setSearchResults([{ videoId: data.id, title: data.title, author: data.artist, duration: data.duration, thumbnail: data.artwork }]);
          } else setIdentifiedSong(data.error || "Could not identify song.");
        } catch (err) { setIdentifiedSong("Error identifying song."); } finally { setIsListening(false); stream.getTracks().forEach(track => track.stop()); }
      };
      setIsListening(true); setIdentifiedSong("Listening..."); mediaRecorder.start();
      setTimeout(() => mediaRecorderRef.current?.state === "recording" && mediaRecorderRef.current.stop(), 8000);
    } catch (err) { setIdentifiedSong("Mic access required."); setIsListening(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 h-full overflow-y-auto bg-transparent relative custom-scrollbar flex flex-col">
       {/* ─── NEXUS SEARCH HEADER ────────────────────────────────────────── */}
       <header className="px-6 pt-12 pb-8 lg:px-12 backdrop-blur-3xl sticky top-0 z-20">
          <div className="max-w-[1700px] mx-auto space-y-10">
             <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                <div className="space-y-1">
                   <p className="text-white/10 font-black uppercase tracking-[0.4em] text-xs">Discovery Engine</p>
                   <h1 className="text-[64px] lg:text-[84px] font-black text-white tracking-tighter leading-none">Find</h1>
                </div>
                <button onClick={onClose} className="px-10 py-3 rounded-full bg-white/5 text-[#FA243C] font-black text-lg hover:bg-white/10 active:scale-95 transition-all w-fit">
                   Cancel
                </button>
             </div>

             <div className="flex flex-col xl:flex-row items-center gap-6">
                <div className="relative group flex-1 w-full">
                   <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-white/10 group-focus-within:text-[#FA243C] transition-all" size={24} />
                   <input 
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Artists, Songs, Lyrics..."
                      className="w-full bg-white/3 border border-white/5 rounded-[40px] py-6 pl-16 pr-24 text-[22px] text-white font-black placeholder:text-white/5 focus:bg-white/5 focus:border-white/10 outline-none transition-all shadow-inner"
                      autoFocus
                   />
                   <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                       {searchQuery && <button onClick={() => setSearchQuery("")} className="p-3 text-white/10 hover:text-white"><X size={24} /></button>}
                       <button 
                        onClick={handleMusicIdentifier}
                        className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isListening ? "bg-[#FA233B] text-white shadow-[0_0_40px_rgba(250,35,59,0.4)] animate-pulse" : "bg-white/5 text-white/20 hover:text-white hover:bg-white/10"}`}
                       >
                          <Mic size={24} />
                       </button>
                   </div>
                </div>

                <div className="flex bg-white/5 p-1.5 rounded-[32px] border border-white/5 w-full xl:w-auto overflow-x-auto no-scrollbar">
                   {categories.map(cat => (
                      <button
                         key={cat}
                         onClick={() => { setActiveCategory(cat); void runSearch(searchQuery, cat); }}
                         className={`px-10 py-3.5 rounded-[26px] text-base font-black transition-all duration-500 whitespace-nowrap ${
                            activeCategory === cat ? "bg-white text-black shadow-2xl scale-105" : "text-white/30 hover:text-white/60"
                         }`}
                      >
                         {cat}
                      </button>
                   ))}
                </div>
             </div>
          </div>
       </header>

       {/* ─── SEARCH RESULTS ──────────────────────────────────────────────── */}
       <main className="flex-1 min-h-0 overflow-y-auto px-6 py-12 lg:px-12 custom-scrollbar pb-64">
          <div className="max-w-[1700px] mx-auto">
             {!searchQuery && !identifiedSong ? (
                <div className="py-40 flex flex-col items-center justify-center text-center opacity-10">
                   <Sparkles size={120} className="mb-8" />
                   <h3 className="text-4xl font-black uppercase tracking-tighter">Initiate Global Discovery</h3>
                   <p className="max-w-md mt-4 font-bold text-lg">Input artist names, track titles, or vibes to explore the Nexus music catalog.</p>
                </div>
             ) : (
                <div className="space-y-4">
                   {identifiedSong && !searchQuery && (
                      <div className="mb-12 p-8 rounded-[40px] bg-[#FA233B]/5 border border-[#FA233B]/10 backdrop-blur-3xl flex items-center gap-6 animate-in fade-in slide-in-from-top-6">
                         <div className="w-20 h-20 rounded-full bg-[#FA233B] flex items-center justify-center text-white shadow-2xl">
                            <Mic size={32} />
                         </div>
                         <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[#FA243C] mb-2">{isListening ? "Synchronizing Sound" : "Nexus Audio Match"}</p>
                            <h3 className="text-3xl font-black text-white tracking-tighter">{identifiedSong}</h3>
                         </div>
                      </div>
                   )}

                   {searchLoading ? (
                      <div className="py-48 flex flex-col items-center justify-center text-center">
                         <Loader2 className="w-16 h-16 animate-spin text-[#FA243C]" />
                         <p className="text-white/10 font-black uppercase tracking-[0.2em] text-xs mt-6">Parsing Global Index</p>
                      </div>
                   ) : (
                      <div className="flex flex-col gap-2">
                        {searchResults.map((song, idx) => (
                           <motion.div 
                              key={song.videoId || idx}
                              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.02 }}
                              onClick={() => {
                                 const highRes = song.thumbnail?.replace(/([=|-][swh])\d+/g, '$11200');
                                 onSongSelect({ id: song.videoId, title: song.title, artist: song.author, artwork: highRes, duration: song.duration, color: "#FA243C" });
                                 onClose();
                              }}
                              className="group flex items-center gap-6 p-4 rounded-[32px] bg-white/3 border border-white/5 hover:bg-white/8 hover:border-white/20 hover:scale-[1.01] transition-all cursor-pointer relative overflow-hidden"
                           >
                              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[24px] border border-white/5 shadow-2xl">
                                 <img src={song.thumbnail?.replace(/([=|-][swh])\d+/g, '$1600')} alt="" className="h-full w-full object-cover transition-transform duration-1000 group-hover:scale-110" />
                                 <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                    <Play fill="white" className="text-white w-8 h-8 ml-1" />
                                 </div>
                              </div>
                              <div className="flex-1 min-w-0 pr-8">
                                 <p className="truncate text-2xl font-black text-white leading-tight mb-1">{song.title}</p>
                                 <p className="truncate text-base font-bold text-white/30 uppercase tracking-widest">{song.author}</p>
                              </div>
                              <div className="flex items-center gap-6 shrink-0 pr-4">
                                 <div className="hidden items-center gap-3 lg:flex opacity-0 group-hover:opacity-100 transition-all">
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onAddToQueue?.({ id: song.videoId, title: song.title, artist: song.author, artwork: song.thumbnail, duration: song.duration, color: "#FA243C" });
                                      }}
                                      className="p-3 rounded-full bg-white/5 text-white/30 hover:text-white hover:bg-white/10 transition-all"
                                    >
                                       <ListPlus size={20} />
                                    </button>
                                 </div>
                                 <span className="text-sm font-black text-white/10 uppercase tracking-widest">{song.duration}</span>
                                 <button className="text-white/10 hover:text-white transition-colors"><MoreHorizontal size={24} /></button>
                              </div>
                           </motion.div>
                        ))}
                      </div>
                   )}
                </div>
             )}
          </div>
       </main>
    </motion.div>
  );
}
