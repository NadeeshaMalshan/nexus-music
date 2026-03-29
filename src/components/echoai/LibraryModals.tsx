"use client";

import { useState, useRef, useEffect } from "react";
import { X, Search, Plus, Minus, Music2, Sparkles, Loader2, ListPlus, Wand2, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Image from "next/image";

interface Song {
  id: string;
  title: string;
  artist: string;
  artwork: string;
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  accentColor?: string;
}

export function CreatePlaylistModal({ isOpen, onClose, accentColor = "#FA233B" }: ModalProps) {
  const [playlistName, setPlaylistName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [addedSongs, setAddedSongs] = useState<Song[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.trim().length > 2) {
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
          const data = await res.json();
          if (data.items) {
            setSearchResults(data.items.map((item: any) => ({
              id: item.videoId,
              title: item.title,
              artist: item.author,
              artwork: item.thumbnail
            })));
          }
        } catch (err) {
          console.error("Search error:", err);
        }
      } else {
        setSearchResults([]);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSave = async () => {
    if (!playlistName || isSaving) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/youtube/playlists/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: playlistName, videoIds: addedSongs.map(s => s.id) })
      });
      if (res.ok) {
        onClose();
        window.location.reload();
      }
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const addSong = (song: Song) => {
    if (!addedSongs.find(s => s.id === song.id)) setAddedSongs([...addedSongs, song]);
    setSearchQuery("");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-xl"
            onClick={onClose}
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 30 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.95, y: 30 }} 
            className="w-full max-w-4xl max-h-[85vh] overflow-hidden rounded-[40px] bg-white/5 border border-white/10 shadow-[0_40px_100px_rgba(0,0,0,0.8)] backdrop-blur-3xl flex flex-col relative z-10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Area */}
            <div className="flex items-center justify-between px-10 py-8">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-white/40">
                    <ListPlus size={24} />
                 </div>
                 <div>
                    <h2 className="text-white text-3xl font-black tracking-tighter">New Playlist</h2>
                    <p className="text-white/20 text-sm font-bold uppercase tracking-widest">Curation Studio</p>
                 </div>
              </div>
              <div className="flex items-center gap-3">
                 <button onClick={onClose} className="px-6 py-2.5 rounded-full bg-white/5 text-white/40 font-bold hover:bg-white/10 transition-all">Cancel</button>
                 <button 
                  onClick={handleSave}
                  disabled={!playlistName || isSaving}
                  className="px-8 py-2.5 rounded-full font-black text-black shadow-2xl transition-all hover:scale-105 active:scale-95 disabled:opacity-30"
                  style={{ backgroundColor: accentColor || '#FFF' }}
                 >
                   {isSaving ? "Creating..." : "Save Playlist"}
                 </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar px-10 pb-12 flex flex-col md:flex-row gap-12">
               {/* Metadata Section */}
               <div className="w-full md:w-72 space-y-8">
                  <div className="aspect-square rounded-[36px] bg-white/5 border border-white/10 flex items-center justify-center relative overflow-hidden group">
                     {addedSongs.length > 0 ? (
                        <Image src={addedSongs[0].artwork} alt="" fill className="object-cover opacity-60 grayscale-[0.5]" />
                     ) : (
                        <Music2 size={64} className="text-white/10" />
                     )}
                     <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Plus className="text-white/40" />
                     </div>
                  </div>
                  <div className="space-y-4">
                     <label className="text-[11px] font-black uppercase tracking-[0.2em] text-white/20 px-1">Identity</label>
                     <input 
                        type="text" 
                        placeholder="My Awesome Mix" 
                        value={playlistName}
                        onChange={(e) => setPlaylistName(e.target.value)}
                        className="w-full bg-transparent text-2xl font-black text-white placeholder:text-white/10 focus:outline-none border-b border-white/5 pb-2 focus:border-white/20 transition-all"
                        autoFocus
                      />
                  </div>
               </div>

               {/* Tracklist & Search Section */}
               <div className="flex-1 space-y-10">
                  <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-white/60 transition-colors" size={20} />
                    <input 
                      type="text" 
                      placeholder="Search tracks to add..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full h-14 bg-white/3 rounded-2xl pl-12 pr-6 text-white font-bold placeholder:text-white/10 border border-white/5 focus:bg-white/5 focus:border-white/20 outline-none transition-all shadow-inner"
                    />
                    
                    {/* Search Result Overlay */}
                    <AnimatePresence>
                       {searchResults.length > 0 && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                            className="absolute top-16 left-0 right-0 z-20 bg-[#161618]/95 backdrop-blur-3xl rounded-3xl border border-white/10 shadow-[0_32px_64px_rgba(0,0,0,0.4)] overflow-hidden"
                          >
                             {searchResults.slice(0, 5).map(song => (
                                <div key={song.id} onClick={() => addSong(song)} className="flex items-center gap-4 p-4 hover:bg-white/5 cursor-pointer transition-all border-b border-white/5 last:border-0 group">
                                   <img src={song.artwork} alt="" className="w-12 h-12 rounded-xl object-cover" />
                                   <div className="flex-1 min-w-0">
                                      <p className="text-white font-bold truncate">{song.title}</p>
                                      <p className="text-white/30 text-xs truncate">{song.artist}</p>
                                   </div>
                                   <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center opacity-0 group-hover:opacity-100 group-hover:scale-110 transition-all">
                                      <Plus size={16} />
                                   </div>
                                </div>
                             ))}
                          </motion.div>
                       )}
                    </AnimatePresence>
                  </div>

                  <div className="space-y-4">
                     <h3 className="text-[14px] font-black uppercase text-white/20 tracking-widest pl-1">Selected Tracks ({addedSongs.length})</h3>
                     <div className="space-y-2 max-h-[400px] overflow-y-auto no-scrollbar">
                        {addedSongs.map((song, idx) => (
                           <motion.div 
                              layout key={song.id} 
                              className="flex items-center gap-4 p-3 rounded-2xl bg-white/3 border border-white/5 hover:border-white/10 transition-all group"
                           >
                              <div className="text-[11px] font-black text-white/20 w-4 text-center">{idx + 1}</div>
                              <img src={song.artwork} alt="" className="w-12 h-12 rounded-xl shadow-md" />
                              <div className="flex-1 min-w-0">
                                 <p className="text-white font-bold truncate">{song.title}</p>
                                 <p className="text-white/30 text-xs font-bold leading-none">{song.artist}</p>
                              </div>
                              <button onClick={() => setAddedSongs(addedSongs.filter(s => s.id !== song.id))} className="p-2 text-white/10 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                                 <Minus size={20} />
                              </button>
                           </motion.div>
                        ))}
                        {addedSongs.length === 0 && (
                           <div className="py-20 flex flex-col items-center justify-center text-center opacity-10">
                              <Music2 size={64} className="mb-4" />
                              <p className="text-xl font-black">Curate your mix</p>
                              <p className="text-sm font-bold">Search and add tracks from YouTube</p>
                           </div>
                        )}
                     </div>
                  </div>
               </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function AiPlaylistModal({ isOpen, onClose, accentColor = "#FA233B" }: ModalProps) {
  const [step, setStep] = useState<'input' | 'loading' | 'results'>('input');
  const [prompt, setPrompt] = useState("");
  const [generatedResult, setGeneratedResult] = useState<{ name: string, songs: Song[] }>({ name: "", songs: [] });
  const [isSaving, setIsSaving] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setStep('loading');
    try {
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recentTrackId: "K4TOrB7at0Y", userHistory: [prompt] }),
      });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      const recs = (data.recommendations || []).slice(0, 12);
      setGeneratedResult({
        name: `${prompt.charAt(0).toUpperCase() + prompt.slice(1).split(' ')[0]} Exploration`,
        songs: recs.map((rec: any) => ({
          id: rec.youtubeId,
          title: rec.title,
          artist: rec.artist,
          artwork: rec.thumbnail
        })) as Song[]
      });
      setStep('results');
    } catch (err) {
      console.error("AI Error:", err);
      setStep('input');
    }
  };

  const handleSaveToYt = async () => {
    if (isSaving || !generatedResult.name) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/youtube/playlists/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: generatedResult.name, videoIds: generatedResult.songs.map(s => s.id) })
      });
      if (res.ok) { onClose(); window.location.reload(); }
    } catch (err) { console.error("AI Save Error:", err);
    } finally { setIsSaving(false); }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-2xl"
            onClick={onClose}
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 30 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.95, y: 30 }} 
            className="w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-[48px] bg-white/[0.03] border border-white/10 shadow-[0_50px_150px_rgba(0,0,0,0.9)] backdrop-blur-3xl flex flex-col relative z-10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* AI Top Bar */}
            <div className="flex items-center justify-between px-12 py-8 border-b border-white/5">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-2xl bg-linear-to-tr from-white/10 to-white/5 flex items-center justify-center">
                    <Wand2 size={24} className="text-white/60" />
                 </div>
                 <div>
                    <h2 className="text-white text-3xl font-black tracking-tighter">Nexus Intelligence</h2>
                    <p className="text-white/20 text-xs font-bold uppercase tracking-widest">Llama 3 Vibe Engine</p>
                 </div>
              </div>
              <button 
                onClick={onClose}
                className="p-3 rounded-full bg-white/5 text-white/40 hover:text-white transition-colors"
              >
                 <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar p-12">
               {step === 'input' && (
                 <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center py-12 space-y-12">
                   <div className="text-center space-y-4">
                     <h3 className="text-[64px] font-black text-white leading-none tracking-tighter">What's the <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-white/40">vibe?</span></h3>
                     <p className="text-white/20 text-xl font-bold max-w-md mx-auto">Describe a mood, a memory, or an activity you're planning.</p>
                   </div>
                   
                   <div className="w-full max-w-3xl space-y-10">
                     <div className="relative">
                        <textarea 
                          placeholder="e.g. 80s inspired synthwave for late night desert driving..." 
                          className="w-full h-40 bg-white/5 rounded-3xl p-8 text-2xl font-black text-white placeholder:text-white/5 border border-white/10 focus:border-white/20 transition-all resize-none focus:outline-none shadow-inner"
                          value={prompt}
                          onChange={(e) => setPrompt(e.target.value)}
                          autoFocus
                        />
                        <button 
                          onClick={handleGenerate}
                          disabled={!prompt.trim()}
                          className="absolute bottom-6 right-6 flex items-center gap-2 px-10 py-4 font-black rounded-full shadow-2xl transition-all hover:scale-105 active:scale-95 disabled:opacity-30"
                          style={{ backgroundColor: accentColor || '#FFF', color: '#000' }}
                        >
                           Generate 
                           <ChevronRight size={20} />
                        </button>
                     </div>

                     <div className="flex flex-wrap items-center justify-center gap-3">
                        {['Late night coding', 'Rainy afternoon', 'Deep focus', 'High energy workout', 'Road trip vibes'].map(v => (
                           <button 
                             key={v} 
                             onClick={() => setPrompt(v)}
                             className="px-5 py-2.5 rounded-full bg-white/3 border border-white/5 text-sm font-black text-white/40 hover:bg-white/10 hover:text-white transition-all capitalize"
                           >
                             {v}
                           </button>
                        ))}
                     </div>
                   </div>
                 </motion.div>
               )}

               {step === 'loading' && (
                 <div className="flex flex-col items-center justify-center py-40 space-y-10">
                    <div className="relative">
                       <div className="absolute inset-0 blur-3xl opacity-30 animate-pulse" style={{ backgroundColor: accentColor }} />
                       <Loader2 size={80} className="animate-spin relative" style={{ color: accentColor }} />
                    </div>
                    <div className="text-center space-y-2">
                       <p className="text-3xl font-black text-white tracking-tight">Synthesizing Audio...</p>
                       <p className="text-white/20 font-bold uppercase tracking-widest text-sm">Nexus is scouting YouTube for the perfect setlist</p>
                    </div>
                 </div>
               )}

               {step === 'results' && (
                 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12">
                    <div className="flex flex-col md:flex-row items-end gap-10">
                       <div className="w-56 h-56 rounded-[40px] bg-linear-to-tr from-white/10 to-white/5 flex items-center justify-center border border-white/10 shadow-2xl relative overflow-hidden">
                          {generatedResult.songs.length > 0 && <Image src={generatedResult.songs[0].artwork} alt="" fill className="object-cover opacity-20" />}
                          <Sparkles size={80} className="text-white relative" style={{ color: accentColor }} />
                       </div>
                       <div className="flex-1 space-y-4">
                          <div className="flex items-center gap-2 opacity-40">
                             <Sparkles size={14} style={{ color: accentColor }} />
                             <span className="text-[11px] font-black uppercase tracking-[0.3em]">AI Generated Evolution</span>
                          </div>
                          <input 
                              type="text" 
                              value={generatedResult.name}
                              onChange={(e) => setGeneratedResult(prev => ({ ...prev, name: e.target.value }))}
                              className="w-full bg-transparent text-6xl font-black text-white focus:outline-none tracking-tighter leading-none border-b-2 border-white/5 pb-2 focus:border-white/20 transition-all uppercase"
                          />
                          <button 
                            onClick={handleSaveToYt}
                            disabled={isSaving}
                            className="flex items-center gap-3 px-10 py-4 font-black rounded-full shadow-2xl transition-all hover:scale-105 active:scale-95 disabled:opacity-30"
                            style={{ backgroundColor: accentColor || '#FFF', color: '#000' }}
                          >
                             {isSaving ? "Syncing..." : "Sync to Library"}
                             <Plus size={20} />
                          </button>
                       </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                       {generatedResult.songs.map((song, i) => (
                          <div key={song.id} className="flex items-center gap-4 p-4 rounded-3xl bg-white/3 border border-white/5 hover:bg-white/5 transition-all group">
                             <img src={song.artwork} alt="" className="w-16 h-16 rounded-2xl object-cover shadow-xl grayscale-[0.2] group-hover:grayscale-0 transition-all" />
                             <div className="flex-1 min-w-0 pr-2">
                                <p className="text-[17px] font-black text-white truncate leading-tight mb-1">{song.title}</p>
                                <p className="text-white/30 text-xs font-bold truncate uppercase tracking-wider">{song.artist}</p>
                             </div>
                             <button onClick={() => setGeneratedResult(prev => ({ ...prev, songs: prev.songs.filter(s => s.id !== song.id) }))} className="p-2 text-white/5 hover:text-red-500 transition-colors">
                                <Minus size={20} />
                             </button>
                          </div>
                       ))}
                    </div>
                 </motion.div>
               )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
