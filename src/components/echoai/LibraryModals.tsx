"use client";

import { useState, useRef, useEffect } from "react";
import { X, Search, Plus, Minus, Music2, Sparkles, Loader2 } from "lucide-react";
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
}

export function CreatePlaylistModal({ isOpen, onClose }: ModalProps) {
  const [playlistName, setPlaylistName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [addedSongs, setAddedSongs] = useState<Song[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Real search
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
        body: JSON.stringify({
          title: playlistName,
          videoIds: addedSongs.map(s => s.id)
        })
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
    if (!addedSongs.find(s => s.id === song.id)) {
      setAddedSongs([...addedSongs, song]);
    }
    setSearchQuery("");
  };

  const removeSong = (id: string) => {
    setAddedSongs(addedSongs.filter(s => s.id !== id));
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }} 
          className="absolute inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={onClose}
        >
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.9, y: 20 }} 
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="w-full max-w-3xl max-h-[90%] overflow-hidden rounded-[28px] bg-[#1c1c1e] border border-white/10 shadow-[0_32px_64px_rgba(0,0,0,0.6)] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <button onClick={onClose} className="text-[#007AFF] text-[17px] font-medium hover:opacity-70 transition-opacity">Cancel</button>
              <h2 className="text-white text-[17px] font-bold">New Playlist</h2>
              <button 
                disabled={!playlistName || isSaving} 
                className="text-[#007AFF] text-[17px] font-bold disabled:opacity-30 hover:opacity-70 transition-opacity"
                onClick={handleSave}
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
              {/* Info Section */}
              <div className="flex items-center gap-6">
                <div className="w-32 h-32 rounded-lg bg-[#2c2c2e] flex items-center justify-center shadow-lg border border-white/5">
                  <Music2 size={48} className="text-white/20" />
                </div>
                <div className="flex-1">
                  <input 
                    type="text" 
                    placeholder="Playlist Name" 
                    value={playlistName}
                    onChange={(e) => setPlaylistName(e.target.value)}
                    className="w-full bg-transparent text-[28px] font-bold text-white placeholder:text-white/20 focus:outline-none"
                    autoFocus
                  />
                  <div className="h-px bg-white/10 mt-2" />
                </div>
              </div>

              {/* Search Section */}
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
                  <input 
                    type="text" 
                    placeholder="Search for songs" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-11 bg-[#2c2c2e] rounded-xl pl-10 pr-4 text-white text-[15px] focus:outline-none focus:ring-2 ring-blue-500/50 transition-all"
                  />
                </div>

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className="bg-[#2c2c2e]/80 backdrop-blur-md rounded-2xl overflow-hidden border border-white/5 divide-y divide-white/5 shadow-2xl">
                    {searchResults.map(song => (
                      <div key={song.id} className="flex items-center gap-4 p-4 hover:bg-white/5 group transition-colors cursor-pointer" onClick={() => addSong(song)}>
                        <div className="relative w-12 h-12 rounded-lg overflow-hidden shadow-md">
                          <img src={song.artwork} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-[16px] font-bold truncate">{song.title}</p>
                          <p className="text-white/40 text-[14px] truncate">{song.artist}</p>
                        </div>
                        <div className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 group-hover:bg-blue-500 transition-colors">
                          <Plus size={18} className="text-white/40 group-hover:text-white" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Added Songs List */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-white/40 text-[13px] font-bold uppercase tracking-widest">Added Songs ({addedSongs.length})</h3>
                  {addedSongs.length > 0 && (
                     <button onClick={() => setAddedSongs([])} className="text-[#007AFF] text-xs font-semibold hover:underline">Clear All</button>
                  )}
                </div>
                <div className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {addedSongs.map(song => (
                      <motion.div 
                        key={song.id} 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="flex items-center gap-4 p-4 rounded-xl bg-white/5 group border border-white/5"
                      >
                        <img src={song.artwork} alt="" className="w-14 h-14 rounded-xl object-cover shadow-lg border border-white/10" />
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-[16px] font-bold truncate leading-tight">{song.title}</p>
                          <p className="text-white/40 text-[14px] truncate">{song.artist}</p>
                        </div>
                        <button 
                          onClick={() => removeSong(song.id)} 
                          className="w-10 h-10 flex items-center justify-center rounded-full bg-red-500/0 hover:bg-red-500/20 text-white/20 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Minus size={22} />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {addedSongs.length === 0 && (
                    <div className="py-20 text-center space-y-3">
                      <div className="w-20 h-20 bg-white/5 rounded-[2rem] flex items-center justify-center mx-auto text-white/10">
                         <Music2 size={32} />
                      </div>
                      <p className="text-white/20 font-medium">Search for songs above to build your list.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function AiPlaylistModal({ isOpen, onClose }: ModalProps) {
  const [step, setStep] = useState<'input' | 'loading' | 'results'>('input');
  const [prompt, setPrompt] = useState("");
  const [generatedResult, setGeneratedResult] = useState<{ name: string, songs: Song[] }>({ name: "", songs: [] });
  const [isSaving, setIsSaving] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setStep('loading');
    try {
      // Use the new POST endpoint for vibe-based generation
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          recentTrackId: "K4TOrB7at0Y", // Use Starboy as a neutral modern seed if only prompt is given
          userHistory: [prompt] // Use the prompt as the history context
        }),
      });

      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      const recs = (data.recommendations || []).slice(0, 10);

      const resolvedSongs = recs.map((rec: any) => ({
        id: rec.youtubeId,
        title: rec.title,
        artist: rec.artist,
        artwork: rec.thumbnail
      }));

      setGeneratedResult({
        name: `${prompt.charAt(0).toUpperCase() + prompt.slice(1).split(' ')[0]} Mix`,
        songs: resolvedSongs as Song[]
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
        body: JSON.stringify({
          title: generatedResult.name,
          videoIds: generatedResult.songs.map(s => s.id)
        })
      });
      if (res.ok) {
        onClose();
        window.location.reload();
      }
    } catch (err) {
      console.error("AI Save Error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }} 
          className="absolute inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-6"
          onClick={onClose}
        >
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }} 
            animate={{ opacity: 1, scale: 1 }} 
            exit={{ opacity: 0, scale: 0.9 }} 
            transition={{ type: "spring", damping: 30, stiffness: 250 }}
            className="w-full max-w-4xl max-h-[90%] overflow-hidden rounded-[32px] bg-[#0d0d0d] shadow-[0_32px_128px_rgba(124,58,237,0.2)] flex flex-col border border-purple-500/20"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5">
              <button onClick={onClose} className="text-white/40 hover:text-white transition-colors"><X size={24} /></button>
              <div className="flex items-center gap-2">
                <Sparkles size={20} className="text-purple-400" />
                <h2 className="text-white text-lg font-bold tracking-tight">Generate with Llama 3</h2>
              </div>
              <button 
                onClick={handleSaveToYt}
                className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${step === 'results' ? 'bg-purple-600 text-white hover:bg-purple-500' : 'bg-white/5 text-white/20'}`}
                disabled={step !== 'results' || isSaving}
              >
                {isSaving ? "Saving..." : "Save to Library"}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
              {step === 'input' && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center py-12 space-y-10">
                  <div className="w-24 h-24 rounded-[2rem] bg-linear-to-br from-purple-600 to-blue-600 p-6 shadow-2xl shadow-purple-600/30 relative">
                    <Sparkles size={48} className="text-white animate-pulse" />
                  </div>
                  <div className="text-center space-y-3">
                    <h3 className="text-[40px] font-black text-white leading-tight tracking-tight">What's the vibe?</h3>
                    <p className="text-white/40 max-w-sm">Tell Llama 3 about the mood or activity you're planning.</p>
                  </div>
                  <div className="w-full max-w-2xl space-y-6">
                    <div className="flex flex-wrap items-center justify-center gap-2 opacity-50">
                       {['Late night coding', 'Gym motivation', 'Rainy day jazz', 'Retro synthwave'].map(chip => (
                         <button key={chip} onClick={() => setPrompt(chip)} className="px-3 py-1.5 rounded-full border border-white/10 text-xs font-bold text-white hover:bg-white/5 transition-all">{chip}</button>
                       ))}
                    </div>
                    <div className="bg-white/5 rounded-3xl p-6 border border-white/10 focus-within:border-purple-500/50 transition-all">
                      <textarea 
                        placeholder="e.g. Melancholic piano for deep focus..." 
                        className="w-full h-32 bg-transparent text-white text-xl placeholder:text-white/10 resize-none focus:outline-none"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        autoFocus
                      />
                      <div className="flex justify-end pt-4">
                        <button 
                          onClick={handleGenerate}
                          disabled={!prompt.trim()}
                          className="px-10 py-3 bg-white text-black font-black rounded-full hover:bg-zinc-200 transition-all transform active:scale-95"
                        >
                          Generate
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 'loading' && (
                <div className="flex flex-col items-center justify-center py-32 space-y-6 text-center">
                  <div className="relative">
                    <div className="absolute inset-0 bg-purple-500 blur-3xl opacity-20 animate-pulse" />
                    <Loader2 size={64} className="text-purple-500 animate-spin relative" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-2xl font-bold text-white">Llama 3 is thinking...</p>
                    <p className="text-zinc-500 font-medium tracking-wide">Finding the perfect setlist for your vibe.</p>
                  </div>
                </div>
              )}

              {step === 'results' && (
                <div className="space-y-10 pb-20">
                  <div className="flex items-center gap-8">
                    <div className="w-48 h-48 rounded-2xl bg-gradient-to-br from-purple-800 to-black flex items-center justify-center shadow-2xl border border-white/10">
                      <Sparkles size={80} className="text-white/20" />
                    </div>
                    <div className="flex-1 space-y-3">
                      <input 
                        type="text" 
                        value={generatedResult.name}
                        onChange={(e) => setGeneratedResult(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full bg-transparent text-[48px] font-black text-white focus:outline-none leading-none"
                      />
                      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 w-fit">
                        <Sparkles size={12} className="text-purple-400" />
                        <span className="text-[10px] uppercase font-black tracking-[0.2em] text-purple-400">Generated by Nexus AI</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    {generatedResult.songs.map(song => (
                      <div key={song.id} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-white/5 group transition-colors">
                        <img src={song.artwork} alt="" className="w-16 h-16 rounded-xl object-cover shadow-xl" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[17px] font-bold text-white truncate">{song.title}</p>
                          <p className="text-white/40 text-[15px] truncate">{song.artist}</p>
                        </div>
                        <button 
                          onClick={() => setGeneratedResult(prev => ({ ...prev, songs: prev.songs.filter(s => s.id !== song.id) }))}
                          className="opacity-0 group-hover:opacity-100 p-2 text-white/20 hover:text-red-500 transition-all"
                        >
                          <Minus size={24} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
