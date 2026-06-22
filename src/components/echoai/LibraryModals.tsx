"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Search, Plus, Minus, Music2, Sparkles, Loader2, ListPlus, Wand2, ChevronRight, PlaySquare, History, Play, Check } from "lucide-react";
import { m, AnimatePresence } from "motion/react";
import { APPLE_EASE, SLIDE_UP_VARIANTS, MOTION_CONFIG, EXPO_OUT, FADE_IN_VARIANTS } from "@/lib/animations";
import { type Song } from "./types";
import { MusicArtwork } from "./MusicArtwork";
import { FlowingBackground } from "./FlowingBackground";
import { MarqueeText } from "./MarqueeText";
import { useArtworkColors } from "@/lib/useArtworkColors";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { youtubeApiFetchInit } from "@/lib/youtubeClientFetch";

interface CreateModalSong {
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

function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

export function CreatePlaylistModal({ isOpen, onClose, accentColor = "#FA233B" }: ModalProps) {
  const { data: session } = useSession();
  const mounted = useMounted();
  const shell = {
    backgroundColor: `color-mix(in srgb, ${accentColor} 9%, rgb(14, 14, 16))`,
    borderColor: `color-mix(in srgb, ${accentColor} 26%, rgba(255,255,255,0.1))`,
  } as const;
  const [playlistName, setPlaylistName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CreateModalSong[]>([]);
  const [addedSongs, setAddedSongs] = useState<CreateModalSong[]>([]);
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
      const res = await fetch(
        "/api/youtube/playlists/create",
        youtubeApiFetchInit(session?.accessToken, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: playlistName, videoIds: addedSongs.map(s => s.id) }),
        })
      );
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

  const addSong = (song: CreateModalSong) => {
    if (!addedSongs.find(s => s.id === song.id)) setAddedSongs([...addedSongs, song]);
    setSearchQuery("");
  };

  const tree = (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
          <m.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60"
            onClick={onClose}
          />
          <m.div 
            initial={{ opacity: 0, scale: 0.95, y: 30 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.95, y: 30 }} 
            transition={MOTION_CONFIG.transition}
            className="w-full h-full md:h-[85vh] md:max-h-[85vh] overflow-hidden md:rounded-[40px] border shadow-[0_40px_100px_rgba(0,0,0,0.8)] flex flex-col relative z-10 animate-gpu"
            style={shell}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Area */}
            <div
              className="flex items-center justify-between px-6 py-6 md:px-10 md:py-8 border-b"
              style={{ borderBottomColor: `color-mix(in srgb, ${accentColor} 20%, rgba(255,255,255,0.06))` }}
            >
              <div className="flex items-center gap-3 md:gap-4 font-black">
                 <div
                   className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center border"
                   style={{
                     backgroundColor: `color-mix(in srgb, ${accentColor} 12%, rgba(255,255,255,0.05))`,
                     borderColor: `color-mix(in srgb, ${accentColor} 22%, rgba(255,255,255,0.08))`,
                     color: `color-mix(in srgb, ${accentColor} 65%, rgb(161, 161, 170))`,
                   }}
                 >
                    <ListPlus className="w-5 h-5 md:w-6 md:h-6" />
                 </div>
                 <div>
                    <h2 className="text-white text-xl md:text-3xl font-black tracking-tighter">New Playlist</h2>
                 </div>
              </div>
              <div className="flex items-center gap-2 md:gap-3">
                 <button onClick={onClose} className="hidden sm:block px-6 py-2.5 rounded-full bg-white/5 text-white/40 font-bold hover:bg-white/10 transition-all">Cancel</button>
                 <button 
                  onClick={handleSave}
                  disabled={!playlistName || isSaving}
                  className="px-6 md:px-8 py-2 md:py-2.5 rounded-full font-black text-black shadow-2xl transition-all hover:scale-105 active:scale-95 disabled:opacity-30"
                  style={{ backgroundColor: accentColor || '#FFF' }}
                 >
                   {isSaving ? "Creating..." : "Save"}
                 </button>
                 <button onClick={onClose} className="sm:hidden p-2 text-white/40"><X size={24} /></button>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-8 md:px-10 md:pb-12 flex flex-col md:flex-row gap-8 md:gap-12 custom-scrollbar">
               {/* Metadata Section */}
               <div className="w-full md:w-72 space-y-6 md:space-y-8">
                  <div className="aspect-square w-48 md:w-full mx-auto md:mx-0 rounded-3xl md:rounded-[36px] bg-white/5 border border-white/10 flex items-center justify-center relative overflow-hidden group">
                     <MusicArtwork
                       src={addedSongs.length > 0 ? addedSongs[0].artwork : null}
                       alt=""
                       iconSize={48}
                       variant="track"
                       rounded="3xl"
                       className={`absolute inset-0 h-full w-full ${addedSongs.length > 0 ? "opacity-60 grayscale-[0.5]" : ""}`}
                     />
                  </div>
                  <div className="space-y-4">
                     <label className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em] text-white/20 px-1">Identity</label>
                     <input 
                        type="text" 
                        placeholder="My Awesome Mix" 
                        value={playlistName}
                        onChange={(e) => setPlaylistName(e.target.value)}
                        className="w-full bg-transparent text-xl md:text-2xl font-black text-white placeholder:text-white/10 focus:outline-none border-b pb-2 transition-all"
                        style={{
                          borderBottomColor: `color-mix(in srgb, ${accentColor} 22%, rgba(255,255,255,0.08))`,
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderBottomColor = `color-mix(in srgb, ${accentColor} 55%, rgba(255,255,255,0.25))`;
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderBottomColor = `color-mix(in srgb, ${accentColor} 22%, rgba(255,255,255,0.08))`;
                        }}
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
                      className="w-full h-14 bg-white/3 rounded-2xl pl-12 pr-6 text-white font-bold placeholder:text-white/10 border focus:bg-white/5 outline-none transition-all shadow-inner"
                      style={{
                        borderColor: `color-mix(in srgb, ${accentColor} 18%, rgba(255,255,255,0.06))`,
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = `color-mix(in srgb, ${accentColor} 45%, rgba(255,255,255,0.2))`;
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = `color-mix(in srgb, ${accentColor} 18%, rgba(255,255,255,0.06))`;
                      }}
                    />
                    
                    {/* Search Result Overlay */}
                    <AnimatePresence>
                       {searchResults.length > 0 && (
                          <m.div 
                            initial={{ opacity: 0, y: 10 }} 
                            animate={{ opacity: 1, y: 0 }} 
                            exit={{ opacity: 0, y: 10 }}
                            transition={MOTION_CONFIG.transition}
                            className="absolute top-16 left-0 right-0 z-20 rounded-3xl border shadow-[0_32px_64px_rgba(0,0,0,0.4)] overflow-hidden animate-gpu"
                            style={shell}
                          >
                             {searchResults.slice(0, 5).map(song => (
                                <div key={song.id} onClick={() => addSong(song)} className="flex items-center gap-4 p-4 hover:bg-white/5 cursor-pointer transition-all border-b border-white/5 last:border-0 group">
                                   <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl">
                                     <MusicArtwork src={song.artwork} alt="" iconSize={20} variant="track" rounded="xl" className="h-full w-full" />
                                   </div>
                                   <div className="flex-1 min-w-0">
                                      <p className="text-white font-bold truncate">{song.title}</p>
                                      <p className="text-white/30 text-xs truncate">{song.artist}</p>
                                   </div>
                                   <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center opacity-0 group-hover:opacity-100 group-hover:scale-110 transition-all">
                                      <Plus size={16} />
                                   </div>
                                </div>
                             ))}
                          </m.div>
                       )}
                    </AnimatePresence>
                  </div>

                  <div className="space-y-4">
                      <h3 className="text-[14px] font-black uppercase text-white/20 tracking-widest pl-1">Selected Tracks ({addedSongs.length})</h3>
                      <div className="space-y-2 max-h-[400px] overflow-y-auto no-scrollbar">
                         {addedSongs.map((song, idx) => (
                            <m.div 
                               layout key={song.id} 
                               className="flex items-center gap-4 p-3 rounded-2xl bg-white/3 border border-white/5 hover:border-white/10 transition-all group animate-gpu"
                            >
                              <div className="text-[11px] font-black text-white/20 w-4 text-center">{idx + 1}</div>
                              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl shadow-md">
                                <MusicArtwork src={song.artwork} alt="" iconSize={20} variant="track" rounded="xl" className="h-full w-full" />
                              </div>
                              <div className="flex-1 min-w-0">
                                 <MarqueeText text={song.title} className="text-white font-bold" />
                                 <p className="text-white/30 text-xs font-bold leading-none">{song.artist}</p>
                              </div>
                              <button onClick={() => setAddedSongs(addedSongs.filter(s => s.id !== song.id))} className="p-2 text-white/10 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                                 <Minus size={20} />
                              </button>
                           </m.div>
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
          </m.div>
        </div>
      )}
    </AnimatePresence>
  );

  if (!mounted) return null;
  return createPortal(tree, document.body);
}

type LibrarySyncStatus = "idle" | "saving" | "synced" | "error";

export function AiPlaylistModal({ isOpen, onClose, accentColor = "#FA233B" }: ModalProps) {
  const { data: session } = useSession();
  const mounted = useMounted();
  const router = useRouter();
  const shell = {
    backgroundColor: `color-mix(in srgb, ${accentColor} 11%, rgb(11, 11, 13))`,
    borderColor: `color-mix(in srgb, ${accentColor} 28%, rgba(255,255,255,0.1))`,
  } as const;
  const [step, setStep] = useState<'input' | 'loading' | 'results'>('input');
  const [prompt, setPrompt] = useState("");
  const [favoriteArtists, setFavoriteArtists] = useState("");
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [generatedResult, setGeneratedResult] = useState<{ name: string, songs: CreateModalSong[] }>({ name: "", songs: [] });
  const [librarySyncStatus, setLibrarySyncStatus] = useState<LibrarySyncStatus>("idle");

  useEffect(() => {
    if (isOpen) setLibrarySyncStatus("idle");
  }, [isOpen]);
  
  const GENRE_CHIPS = ['Lofi', 'Pop', 'Classical', 'Retrowave', 'Electronic', 'Jazz', 'Acoustic', 'Hip Hop', 'Rock'];

  const firstArtwork = generatedResult.songs.length > 0 ? generatedResult.songs[0].artwork : null;
  const palette = useArtworkColors(firstArtwork, accentColor);

  const toggleGenre = (genre: string) => {
    setSelectedGenres(prev => prev.includes(genre) ? prev.filter(g => g !== genre) : [...prev, genre]);
  };

  const handleGenerate = async () => {
    if (!prompt.trim() && !favoriteArtists.trim() && selectedGenres.length === 0) return;
    setStep('loading');
    try {
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          prompt: prompt || "Personalized Mix", 
          favoriteArtists: favoriteArtists.split(',').map(s => s.trim()).filter(Boolean),
          genres: selectedGenres
        }),
      });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      const recs = (data.recommendations || []).slice(0, 20);
      setGeneratedResult({
        name: prompt ? `${prompt.charAt(0).toUpperCase() + prompt.slice(1).split(' ')[0]} Evolution` : "Neural DNA Mix",
        songs: recs.map((rec: any) => ({
          id: rec.youtubeId,
          title: rec.title,
          artist: rec.artist,
          artwork: rec.thumbnail
        })) as CreateModalSong[]
      });
      setLibrarySyncStatus("idle");
      setStep('results');
    } catch (err) {
      console.error("AI Error:", err);
      setStep('input');
    }
  };

  const handleSaveToYt = async () => {
    if (librarySyncStatus === "saving" || librarySyncStatus === "synced") return;
    const title = generatedResult.name?.trim();
    const ids = generatedResult.songs.map((s) => s.id).filter(Boolean);
    if (!title || ids.length === 0) return;

    setLibrarySyncStatus("saving");
    try {
      const res = await fetch(
        "/api/youtube/playlists/create",
        youtubeApiFetchInit(session?.accessToken, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, videoIds: ids }),
        })
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Failed to save playlist");
      }
      setLibrarySyncStatus("synced");
      router.refresh();
    } catch (err) {
      console.error("AI Save Error:", err);
      setLibrarySyncStatus("error");
    }
  };

  const tree = (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-0 md:p-6 lg:p-12">
          <m.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-3xl"
            onClick={onClose}
          />
          <m.div 
            initial={{ opacity: 0, scale: 0.95, y: 30 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.95, y: 30 }} 
            transition={{ type: "spring", damping: 30, stiffness: 300, mass: 1 }}
            className="w-full h-full md:max-w-5xl md:h-[90vh] md:max-h-[90vh] overflow-hidden md:rounded-[48px] border shadow-[0_50px_150px_rgba(0,0,0,0.9)] flex flex-col relative z-10 animate-gpu"
            style={shell}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Immersive Background */}
            <div className="absolute inset-0 z-0">
               <FlowingBackground palette={palette} artwork={firstArtwork} opacity={step === 'results' ? 0.35 : 0.15} />
            </div>

            {/* AI Top Bar */}
            <div
              className="relative z-20 flex items-center justify-between px-6 py-6 md:px-12 md:py-8 border-b backdrop-blur-md"
              style={{
                backgroundColor: `color-mix(in srgb, ${accentColor} 8%, rgba(0,0,0,0.35))`,
                borderBottomColor: `color-mix(in srgb, ${accentColor} 22%, rgba(255,255,255,0.06))`,
              }}
            >
              <div className="flex items-center gap-3 md:gap-4">
                 <div
                   className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center border shadow-lg"
                   style={{
                     backgroundColor: `color-mix(in srgb, ${accentColor} 14%, rgba(255,255,255,0.06))`,
                     borderColor: `color-mix(in srgb, ${accentColor} 30%, rgba(255,255,255,0.12))`,
                   }}
                 >
                    <Wand2 className="w-5 h-5 md:w-6 md:h-6" style={{ color: `color-mix(in srgb, ${accentColor} 75%, white)` }} />
                 </div>
                 <div>
                    <h2 className="text-white text-xl md:text-3xl font-black tracking-tighter">Echo AI</h2>
                    <p className="hidden sm:block text-white/20 text-[10px] md:text-xs font-bold uppercase tracking-widest leading-none mt-1">Direct from your imagination</p>
                 </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 md:p-3 rounded-full bg-white/5 text-white/40 hover:text-white transition-all hover:bg-white/10"
              >
                 <X className="w-5 h-5 md:w-6 md:h-6" />
              </button>
            </div>

             <div className="relative z-10 flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-6 md:p-12 custom-scrollbar">
                {step === 'input' && (
                  <m.div 
                    initial={{ opacity: 0, y: 20 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    transition={MOTION_CONFIG.transition}
                    className="flex flex-col min-h-[50vh] py-8 md:py-12 space-y-12 md:space-y-16 animate-gpu pb-4 md:pb-0"
                  >
                   <div className="text-center space-y-4 md:space-y-6">
                      <m.h3 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 1, ease: EXPO_OUT }}
                        className="text-4xl md:text-6xl lg:text-7xl font-black text-white leading-[0.85] tracking-tighter"
                      >
                        Design your <br/>
                        <span
                          className="text-transparent bg-clip-text"
                          style={{
                            backgroundImage: `linear-gradient(to right, white, color-mix(in srgb, ${accentColor} 85%, white), rgba(255,255,255,0.2))`,
                          }}
                        >
                          Sound Profile
                        </span>
                      </m.h3>
                    </div>
                    
                    <div className="w-full max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 md:gap-16">
                      {/* Left: Preferences */}
                      <div className="space-y-10">
                        <div className="space-y-4">
                           <label className="text-[11px] font-black uppercase tracking-[0.3em] text-white/20 px-1">Favorite Artists</label>
                           <input 
                             type="text" 
                             placeholder="e.g. Gunadasa Kapuge, The Weeknd..." 
                             className="w-full bg-white/5 rounded-2xl p-5 text-lg font-black text-white transition-all outline-none border"
                             style={{
                               borderColor: `color-mix(in srgb, ${accentColor} 20%, rgba(255,255,255,0.06))`,
                             }}
                             onFocus={(e) => {
                               e.currentTarget.style.borderColor = `color-mix(in srgb, ${accentColor} 50%, rgba(255,255,255,0.2))`;
                             }}
                             onBlur={(e) => {
                               e.currentTarget.style.borderColor = `color-mix(in srgb, ${accentColor} 20%, rgba(255,255,255,0.06))`;
                             }}
                             value={favoriteArtists}
                             onChange={(e) => setFavoriteArtists(e.target.value)}
                           />
                        </div>

                        <div className="space-y-4">
                           <label className="text-[11px] font-black uppercase tracking-[0.3em] text-white/20 px-1">Target Genres</label>
                           <div className="flex flex-wrap gap-2.5">
                             {GENRE_CHIPS.map(genre => (
                               <m.button 
                                 key={genre}
                                 whileHover={{ scale: 1.05 }}
                                 whileTap={{ scale: 0.95 }}
                                 onClick={() => toggleGenre(genre)}
                                 className={`px-5 py-2.5 rounded-full border text-xs font-black transition-all ${
                                   selectedGenres.includes(genre)
                                     ? "text-black border-transparent shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
                                     : "bg-white/5 text-white/40 border-white/5 hover:border-white/10"
                                 }`}
                                 style={
                                   selectedGenres.includes(genre)
                                     ? {
                                         backgroundColor: accentColor,
                                         borderColor: `color-mix(in srgb, ${accentColor} 65%, transparent)`,
                                       }
                                     : undefined
                                 }
                               >
                                 {genre}
                               </m.button>
                             ))}
                           </div>
                        </div>
                      </div>

                      {/* Right: Vibe Prompt */}
                      <div className="space-y-10">
                        <div className="space-y-4">
                           <label className="text-[11px] font-black uppercase tracking-[0.3em] text-white/20 px-1">Final Vibe / Prompt</label>
                           <div className="relative group/input">
                              <div
                                className="absolute -inset-0.5 rounded-[32px] blur-xl opacity-0 group-focus-within/input:opacity-100 transition-opacity duration-1000"
                                style={{
                                  background: `linear-gradient(to right, color-mix(in srgb, ${accentColor} 45%, transparent), transparent)`,
                                }}
                              />
                              <textarea 
                                placeholder="Describe the vibe... e.g. Night drive with heavy bass" 
                                className="relative w-full h-40 md:h-52 bg-white/[0.03] rounded-3xl p-8 text-xl md:text-2xl font-black text-white placeholder:text-white/5 border transition-all resize-none focus:outline-none shadow-2xl backdrop-blur-xl"
                                style={{
                                  borderColor: `color-mix(in srgb, ${accentColor} 18%, rgba(255,255,255,0.06))`,
                                }}
                                onFocus={(e) => {
                                  e.currentTarget.style.borderColor = `color-mix(in srgb, ${accentColor} 45%, rgba(255,255,255,0.25))`;
                                }}
                                onBlur={(e) => {
                                  e.currentTarget.style.borderColor = `color-mix(in srgb, ${accentColor} 18%, rgba(255,255,255,0.06))`;
                                }}
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                              />
                              <m.button 
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={handleGenerate}
                                disabled={!prompt.trim() && !favoriteArtists.trim() && selectedGenres.length === 0}
                                className="hidden md:flex absolute bottom-6 right-6 items-center gap-3 px-8 md:px-12 py-4 md:py-5 font-black rounded-full shadow-[0_20px_40px_rgba(0,0,0,0.5)] transition-all disabled:opacity-30 disabled:grayscale"
                                style={{ backgroundColor: accentColor || '#FFF', color: '#000' }}
                              >
                                 <span className="text-sm md:text-lg">Generate</span>
                                 <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
                              </m.button>
                           </div>
                        </div>
                      </div>
                    </div>
                  </m.div>
                )}

                {step === 'loading' && (
                  <div className="flex flex-col items-center justify-center min-h-[60vh] py-24 md:py-40 space-y-10 md:space-y-14">
                     <div className="relative">
                        <div className="absolute inset-x-[-80%] inset-y-[-80%] blur-[120px] opacity-20 animate-pulse" style={{ backgroundColor: accentColor }} />
                        <div className="relative w-32 h-32 md:w-48 md:h-48 rounded-full border-4 border-white/5 flex items-center justify-center overflow-hidden bg-black/40 backdrop-blur-3xl shadow-2xl">
                           <m.div
                             animate={{ 
                               rotate: 360,
                               scale: [1, 1.1, 1],
                             }}
                             transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                             className="absolute inset-0 opacity-40"
                             style={{ 
                                background: `conic-gradient(from 0deg, transparent, ${accentColor}, transparent)`
                             }}
                           />
                           <Wand2 className="w-12 h-12 md:w-16 md:h-16 text-white animate-bounce" style={{ color: accentColor }} />
                        </div>
                     </div>
                     <div className="text-center space-y-4 px-6">
                        <m.p 
                          animate={{ opacity: [0.4, 1, 0.4] }}
                          transition={{ duration: 2, repeat: Infinity }}
                          className="text-3xl md:text-5xl font-black text-white tracking-tighter"
                        >
                          Synthesizing DNA...
                        </m.p>
                        <p className="text-white/20 font-bold uppercase tracking-[0.3em] text-[10px] md:text-sm max-w-sm mx-auto leading-relaxed">Analyzing your Taste Profile and scouting the grid</p>
                     </div>
                  </div>
                )}

                {step === 'results' && (
                  <m.div 
                    initial="initial" 
                    animate="animate" 
                    variants={FADE_IN_VARIANTS}
                    className="space-y-12 md:space-y-20 pb-40 animate-gpu"
                  >
                    {/* Results Portfolio Header */}
                    <div className="flex flex-col lg:flex-row items-center lg:items-end gap-8 md:gap-14 text-center lg:text-left">
                       <m.div 
                         initial={{ opacity: 0, scale: 0.8, rotate: -5 }}
                         animate={{ opacity: 1, scale: 1, rotate: 0 }}
                         transition={{ duration: 0.8, ease: EXPO_OUT }}
                         className="relative w-56 h-56 md:w-80 md:h-80 rounded-[40px] md:rounded-[64px] border shadow-[0_40px_100px_rgba(0,0,0,0.8)] overflow-hidden shrink-0 group/cover"
                         style={{
                           backgroundColor: `color-mix(in srgb, ${accentColor} 14%, rgba(255,255,255,0.06))`,
                           borderColor: `color-mix(in srgb, ${accentColor} 28%, rgba(255,255,255,0.1))`,
                         }}
                       >
                          {generatedResult.songs.length > 0 ? (
                            <MusicArtwork
                              src={generatedResult.songs[0].artwork.replace(/([=|-][swh])\d+/g, "$1800")}
                              alt=""
                              iconSize={80}
                              variant="track"
                              rounded="none"
                              className="h-full w-full transform transition-transform duration-1000 group-hover/cover:scale-110"
                            />
                          ) : null}
                          <div className="absolute inset-0 bg-black/20" />
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/cover:opacity-100 transition-opacity duration-500">
                             <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-2xl flex items-center justify-center text-white scale-0 group-hover/cover:scale-100 transition-transform duration-500 delay-100">
                                <Play size={32} fill="white" />
                             </div>
                          </div>
                          {/* AI Floating Badge */}
                          <div className="absolute top-6 left-6 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-xl border border-white/20 shadow-2xl">
                             <Sparkles size={12} style={{ color: accentColor }} />
                             <span className="text-[10px] font-black text-white uppercase tracking-widest">Neural Vibe</span>
                          </div>
                       </m.div>

                       <div className="flex-1 space-y-6 md:space-y-10 w-full max-w-2xl">
                          <div className="space-y-4">
                            <div className="flex items-center justify-center lg:justify-start gap-3 opacity-40">
                               <Wand2 className="w-4 h-4" style={{ color: accentColor }} />
                               <span className="text-[11px] md:text-sm font-black uppercase tracking-[0.4em]">Generated Setlist</span>
                            </div>
                            <input 
                                type="text" 
                                value={generatedResult.name}
                                onChange={(e) => setGeneratedResult(prev => ({ ...prev, name: e.target.value }))}
                                className="w-full bg-transparent text-5xl md:text-7xl lg:text-8xl font-black text-white focus:outline-none tracking-tighter leading-[0.9] border-b-2 border-white/5 pb-4 focus:border-white/20 transition-all text-center lg:text-left selection:bg-white/20"
                            />
                            <p className="text-white/30 text-lg md:text-2xl font-bold italic line-clamp-2 leading-tight">" {prompt} "</p>
                          </div>

                          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4">
                            <m.button 
                              whileHover={librarySyncStatus === "synced" || librarySyncStatus === "saving" ? undefined : { scale: 1.05 }}
                              whileTap={librarySyncStatus === "synced" || librarySyncStatus === "saving" ? undefined : { scale: 0.95 }}
                              onClick={handleSaveToYt}
                              disabled={librarySyncStatus === "saving" || librarySyncStatus === "synced"}
                              className={`flex items-center justify-center gap-3 px-10 md:px-14 py-4 md:py-5 font-black rounded-full shadow-[0_20px_60px_rgba(0,0,0,0.6)] transition-all active:shadow-none ${
                                librarySyncStatus === "synced"
                                  ? "bg-white/10 text-white border border-white/20 cursor-default"
                                  : librarySyncStatus === "error"
                                    ? "bg-red-500/20 text-red-200 border border-red-500/30"
                                    : ""
                              }`}
                              style={
                                librarySyncStatus === "synced" || librarySyncStatus === "error"
                                  ? undefined
                                  : { backgroundColor: accentColor || "#FFF", color: "#000" }
                              }
                            >
                               {librarySyncStatus === "saving" && (
                                 <Loader2 className="w-5 h-5 md:w-6 md:h-6 shrink-0 animate-spin" />
                               )}
                               {librarySyncStatus === "synced" && (
                                 <Check className="w-5 h-5 md:w-6 md:h-6 shrink-0" strokeWidth={3} />
                               )}
                               <span className="text-base md:text-xl">
                                 {librarySyncStatus === "saving" && "Syncing…"}
                                 {librarySyncStatus === "synced" && "Synced"}
                                 {librarySyncStatus === "error" && "Retry sync"}
                                 {librarySyncStatus === "idle" && "Sync to Library"}
                               </span>
                               {(librarySyncStatus === "idle" || librarySyncStatus === "error") && (
                                 <Plus size={24} />
                               )}
                            </m.button>
                            <button 
                              onClick={() => {
                                setLibrarySyncStatus("idle");
                                setStep('input');
                              }}
                              className="px-10 py-4 md:py-5 rounded-full bg-white/5 border border-white/10 text-white font-black hover:bg-white/10 transition-all text-base md:text-xl"
                            >
                              New Prompt
                            </button>
                          </div>
                       </div>
                    </div>

                    {/* Track List */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
                       {generatedResult.songs.map((song, i) => (
                          <m.div 
                            key={song.id} 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 + (i * 0.05), duration: 0.5, ease: EXPO_OUT }}
                            className="group relative flex items-center gap-5 p-4 md:p-6 rounded-[32px] bg-white/[0.03] border border-white/5 hover:bg-white/[0.08] hover:border-white/20 transition-all animate-gpu shadow-xl hover:shadow-2xl"
                          >
                             <div className="relative h-16 w-16 md:h-24 md:w-24 shrink-0 overflow-hidden rounded-2xl md:rounded-[28px] shadow-2xl transition-all duration-500 group-hover:scale-105 group-hover:rotate-2">
                               <MusicArtwork src={song.artwork} alt="" iconSize={32} variant="track" rounded="none" className="h-full w-full" />
                               <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <Play size={24} fill="white" className="text-white" />
                               </div>
                             </div>
                             <div className="flex-1 min-w-0 pr-4">
                                <MarqueeText 
                                  text={song.title} 
                                  className="text-lg md:text-2xl font-black text-white leading-tight mb-1" 
                                />
                                <p className="text-white/40 text-xs md:text-base font-bold truncate uppercase tracking-widest">{song.artist}</p>
                             </div>
                             <button 
                               onClick={() => setGeneratedResult(prev => ({ ...prev, songs: prev.songs.filter(s => s.id !== song.id) }))} 
                               className="absolute -top-2 -right-2 p-2 bg-white/10 backdrop-blur-xl border border-white/10 rounded-full text-white/40 hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100"
                             >
                                <Minus size={18} />
                             </button>
                          </m.div>
                       ))}
                    </div>
                  </m.div>
                )}
             </div>

             {/* Mobile only: docked above home indicator — sibling of scroll so it stays visible */}
             {step === "input" && (
               <div
                 className="lg:hidden shrink-0 relative z-30 border-t backdrop-blur-md px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
                 style={{
                   backgroundColor: `color-mix(in srgb, ${accentColor} 12%, rgba(13,13,15,0.95))`,
                   borderTopColor: `color-mix(in srgb, ${accentColor} 22%, rgba(255,255,255,0.1))`,
                 }}
               >
                 <m.button 
                   whileHover={{ scale: 1.01 }}
                   whileTap={{ scale: 0.99 }}
                   onClick={handleGenerate}
                   disabled={!prompt.trim() && !favoriteArtists.trim() && selectedGenres.length === 0}
                   className="flex w-full items-center justify-center gap-3 px-6 py-4 font-black rounded-2xl shadow-lg transition-all disabled:opacity-30 disabled:grayscale"
                   style={{ backgroundColor: accentColor || "#FFF", color: "#000" }}
                 >
                   <span className="text-base">Generate playlist</span>
                   <ChevronRight className="w-5 h-5" />
                 </m.button>
               </div>
             )}
          </m.div>
        </div>
      )}
    </AnimatePresence>
  );

  if (!mounted) return null;
  return createPortal(tree, document.body);
}

/** History list for Library (YouTube Music browse + OAuth activity); lives here alongside other library modals/panes. */
export type LibraryHistoryRow = Song & { source?: string };

interface LibraryHistoryPaneProps {
  tracks: LibraryHistoryRow[];
  accentColor: string;
  subtitle?: string | null;
  onPlayPlaylist?: (songs: Song[], startIndex: number) => void;
  onSongClick?: (song: Song, reset?: boolean) => void;
  onPlayNext?: (song: Song) => void;
  onAddToQueue?: (song: Song) => void;
}

export function LibraryHistoryPane({
  tracks,
  accentColor,
  subtitle,
  onPlayPlaylist,
  onSongClick,
  onPlayNext,
  onAddToQueue,
}: LibraryHistoryPaneProps) {
  return (
    <m.div
      variants={SLIDE_UP_VARIANTS}
      initial="initial"
      animate="animate"
      exit="exit"
      className="animate-gpu space-y-4"
    >
      {subtitle ? (
        <p className="text-[11px] md:text-xs font-bold uppercase tracking-wider text-white/35 px-1">{subtitle}</p>
      ) : null}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {tracks.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-20 md:py-28 text-center px-4">
            <History className="w-12 h-12 md:w-14 md:h-14 text-white/15 mb-4" />
            <p className="text-lg font-black text-white/40">No history yet</p>
            <p className="text-sm text-white/25 font-medium mt-2 max-w-sm">
              When you are signed in, we show music-related activity from your YouTube account (Google does not expose full watch history to third-party apps).
            </p>
          </div>
        ) : (
          tracks.map((track, idx) => (
            <div
              key={`hist-${track.id}-${idx}`}
              onClick={() => {
                if (onPlayPlaylist) {
                  onPlayPlaylist(tracks as Song[], idx);
                } else {
                  onSongClick?.(track as Song);
                }
              }}
              className="group flex items-center gap-3 md:gap-4 p-3 md:p-4 rounded-2xl bg-white/[0.02] border border-transparent hover:bg-white/[0.06] transition-all duration-300 cursor-pointer relative overflow-hidden"
            >
              <div className="h-12 w-12 md:w-16 md:h-16 shrink-0 rounded-xl overflow-hidden bg-zinc-800/40 shadow-lg relative">
                <MusicArtwork
                  src={track.artwork}
                  alt={track.title}
                  iconSize={24}
                  variant="track"
                  rounded="xl"
                  className="h-full w-full"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate font-bold text-white text-sm md:text-[16px] mb-0.5">{track.title}</p>
                <p className="truncate text-xs md:text-[13px] text-white/40 font-medium">{track.artist}</p>
              </div>
              <div className="flex flex-row items-center gap-2 shrink-0">
                <div className="hidden group-hover:flex items-center gap-1">
                  <button
                    type="button"
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
                    type="button"
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
                <span
                  className="text-[8px] md:text-[9px] font-black px-1.5 md:px-2 py-0.5 rounded-full uppercase tracking-tighter transition-colors"
                  style={
                    track.source === "App"
                      ? { backgroundColor: `${accentColor}33`, color: accentColor }
                      : { backgroundColor: "rgb(255 255 255 / 0.1)", color: "rgb(255 255 255 / 0.4)" }
                  }
                >
                  {track.source || "YouTube"}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </m.div>
  );
}
