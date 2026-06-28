"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Search, Plus, Minus, Music2, Sparkles, Loader2, ListPlus, Wand2, ChevronRight, PlaySquare, History, Play, Check, Flame, Coffee, Compass, Zap, Moon } from "lucide-react";
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
  const router = useRouter();
  
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
        router.refresh();
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

  const firstArtwork = addedSongs.length > 0 ? addedSongs[0].artwork : null;
  const palette = useArtworkColors(firstArtwork, accentColor);
  const currentAccent = palette.accent || accentColor;

  const tree = (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-0 md:p-6 lg:p-12 overflow-hidden">
          {/* Softer Depth-of-Field Overlay */}
          <m.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/30 backdrop-blur-[8px]"
            onClick={onClose}
          />

          <m.div 
            initial={{ opacity: 0, scale: 0.96, y: 40 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.96, y: 40 }} 
            transition={{ type: "spring", damping: 26, stiffness: 220, mass: 1 }}
            className="w-full h-full md:max-w-5xl md:h-[90vh] md:max-h-[90vh] overflow-hidden md:rounded-[40px] shadow-[0_50px_200px_rgba(0,0,0,0.95)] flex flex-col relative z-10 animate-gpu bg-zinc-950/90"
            style={{
              backgroundColor: `color-mix(in srgb, ${currentAccent} 6%, rgb(8, 8, 10))`,
              borderColor: `color-mix(in srgb, ${currentAccent} 24%, rgba(255,255,255,0.08))`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Immersive background covering the entire modal shell */}
            <div className="absolute inset-0 z-0 pointer-events-none">
              <img
                src={firstArtwork || "https://images.unsplash.com/photo-1614149162883-504ce4d13909?q=80&w=1000&auto=format&fit=crop"}
                alt="Background"
                className="w-full h-full object-cover opacity-45 mix-blend-screen scale-105 group-hover:scale-100 transition-transform duration-[2s] ease-out"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#0d0d0d]/90 via-[#0d0d0d]/60 to-[#0d0d0d]/90" />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0d0d0d]/50 to-[#0d0d0d]" />
            </div>

            {/* Floating Close Button */}
            <m.button 
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.95 }}
              onClick={onClose}
              className="absolute top-6 right-6 p-2.5 rounded-full bg-white/5 text-white/40 hover:text-white transition-all hover:bg-white/10 z-30 backdrop-blur-md border border-white/5"
            >
               <X className="w-5 h-5" />
            </m.button>

            <div className="relative z-10 flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-6 md:p-12 custom-scrollbar">
              <div className="flex flex-col min-h-[50vh] py-4 space-y-8 items-center justify-center">
                {/* Center aligned stacked branding header */}
                <div className="relative flex flex-col group w-full justify-center items-center p-4 gap-6 text-center">
                  
                  {/* cover image blob preview */}
                  <div className="relative w-32 h-32 md:w-36 md:h-36 flex items-center justify-center shadow-2xl">
                    <m.div 
                      animate={{
                        borderRadius: ["30% 70% 70% 30% / 30% 30% 70% 70%", "50% 50% 30% 70% / 50% 60% 40% 50%", "30% 70% 70% 30% / 30% 30% 70% 70%"]
                      }}
                      transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                      className="absolute inset-0 bg-black/40 border border-white/10 overflow-hidden"
                    >
                      <MusicArtwork
                        src={addedSongs.length > 0 ? addedSongs[0].artwork : null}
                        alt=""
                        iconSize={32}
                        variant="track"
                        rounded="none"
                        className="w-full h-full object-cover"
                      />
                    </m.div>
                  </div>

                  <div className="flex flex-col items-center justify-center text-center w-full max-w-xl">
                    <h1 className="text-[36px] sm:text-[52px] lg:text-[64px] font-black tracking-tighter text-white leading-[1.05] drop-shadow-xl text-center">
                      Create <br />
                      <input 
                        type="text" 
                        placeholder="My Awesome Mix" 
                        value={playlistName}
                        onChange={(e) => setPlaylistName(e.target.value)}
                        className="bg-transparent text-white/35 focus:text-white/80 focus:outline-none w-full tracking-tighter font-black block mt-1 text-center"
                      />
                    </h1>
                  </div>

                  {/* search and select segment */}
                  <div className="w-full max-w-2xl flex flex-col gap-4 justify-center mx-auto relative z-30">
                    <div className="relative group">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-white/60 transition-colors" size={20} />
                      <input 
                        type="text" 
                        placeholder="Search tracks to add..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-14 bg-black/20 hover:bg-white/10 border border-white/10 focus:border-white/20 rounded-2xl pl-12 pr-6 text-white font-bold placeholder:text-white/20 focus:outline-none resize-none transition-all backdrop-blur-md text-left"
                      />

                      {/* Dropdown search suggestions */}
                      <AnimatePresence>
                        {searchResults.length > 0 && (
                          <m.div 
                            initial={{ opacity: 0, y: 10 }} 
                            animate={{ opacity: 1, y: 0 }} 
                            exit={{ opacity: 0, y: 10 }}
                            transition={MOTION_CONFIG.transition}
                            className="absolute top-16 left-0 right-0 z-40 rounded-3xl border shadow-[0_32px_64px_rgba(0,0,0,0.6)] overflow-hidden bg-[#0d0d0d]/95 backdrop-blur-3xl"
                            style={{ borderColor: `color-mix(in srgb, ${currentAccent} 24%, rgba(255,255,255,0.08))` }}
                          >
                            {searchResults.slice(0, 5).map(song => (
                              <div 
                                key={song.id} 
                                onClick={() => addSong(song)} 
                                className="flex items-center gap-4 p-4 hover:bg-white/5 cursor-pointer transition-all border-b border-white/5 last:border-0 group"
                              >
                                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-black">
                                  <MusicArtwork src={song.artwork} alt="" iconSize={20} variant="track" rounded="xl" className="h-full w-full" />
                                </div>
                                <div className="flex-1 min-w-0 text-left">
                                  <p className="text-white font-bold truncate">{song.title}</p>
                                  <p className="text-white/30 text-xs truncate">{song.artist}</p>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center opacity-0 group-hover:opacity-100 group-hover:scale-110 transition-all text-white">
                                  <Plus size={16} />
                                </div>
                              </div>
                            ))}
                          </m.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <div className="flex gap-3 justify-center w-full">
                      <m.button 
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleSave}
                        disabled={!playlistName || addedSongs.length === 0 || isSaving}
                        className="px-6 py-3.5 rounded-2xl font-black text-sm tracking-tight hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
                        style={{ backgroundColor: currentAccent, color: '#000' }}
                      >
                        {isSaving ? "Creating..." : "Save Playlist"}
                      </m.button>
                      <m.button 
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={onClose}
                        className="px-6 py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black text-sm transition-all"
                      >
                        Cancel
                      </m.button>
                    </div>
                  </div>

                  {/* Selected Track Cards */}
                  <div className="w-full max-w-2xl flex flex-col gap-3 justify-center mx-auto mt-6 relative z-10">
                    <h3 className="text-[14px] font-black uppercase text-white/20 tracking-widest pl-1 text-center">Selected Tracks ({addedSongs.length})</h3>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto no-scrollbar">
                      {addedSongs.map((song, idx) => (
                        <m.div 
                          layout key={song.id} 
                          className="group/item flex items-center gap-5 bg-black/20 hover:bg-white/10 backdrop-blur-md border border-white/10 p-3 rounded-2xl cursor-pointer transition-all duration-300 hover:translate-x-2"
                        >
                          <div className="text-[11px] font-black text-white/20 w-4 text-center shrink-0">{idx + 1}</div>
                          <div className="w-[72px] h-[72px] shrink-0 bg-black overflow-hidden rounded-xl relative shadow-lg">
                            <MusicArtwork src={song.artwork} alt="" rounded="none" className="w-full h-full" />
                          </div>
                          <div className="flex-1 min-w-0 pr-2 text-left">
                            <p className="text-white font-black text-[18px] truncate tracking-tight mb-0.5">{song.title}</p>
                            <p className="text-white/50 font-bold text-[14px] truncate tracking-wide uppercase">{song.artist}</p>
                          </div>
                          <button 
                            onClick={() => setAddedSongs(addedSongs.filter(s => s.id !== song.id))} 
                            className="p-1.5 hover:text-red-400 text-white/20 transition-all shrink-0"
                          >
                            <Minus size={16} />
                          </button>
                        </m.div>
                      ))}
                      {addedSongs.length === 0 && (
                        <div className="py-12 flex flex-col items-center justify-center text-center opacity-10">
                          <Music2 size={48} className="mb-3 text-white" />
                          <p className="text-lg font-black text-white">Curate your mix</p>
                          <p className="text-xs font-bold text-white">Search and add tracks above</p>
                        </div>
                      )}
                    </div>
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
    backgroundColor: `color-mix(in srgb, ${accentColor} 6%, rgb(8, 8, 10))`,
    borderColor: `color-mix(in srgb, ${accentColor} 24%, rgba(255,255,255,0.08))`,
  } as const;
  const [step, setStep] = useState<'input' | 'loading' | 'results'>('input');
  const [prompt, setPrompt] = useState("");
  const [generatedResult, setGeneratedResult] = useState<{ name: string, songs: CreateModalSong[] }>({ name: "", songs: [] });
  const [librarySyncStatus, setLibrarySyncStatus] = useState<LibrarySyncStatus>("idle");
  const [loadingStatus, setLoadingStatus] = useState("Analyzing taste profile...");

  useEffect(() => {
    if (isOpen) setStep('input');
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) setLibrarySyncStatus("idle");
  }, [isOpen]);

  // Loading state status text rotation
  useEffect(() => {
    if (step !== 'loading') return;
    const statuses = [
      "Initializing quantum neural weights...",
      "Analyzing taste profile...",
      "Scouting the Grid database...",
      "Synthesizing melodic sequences...",
      "Structuring neural flow...",
      "Polishing final setlist..."
    ];
    let idx = 0;
    setLoadingStatus(statuses[0]);
    const interval = setInterval(() => {
      idx = (idx + 1) % statuses.length;
      setLoadingStatus(statuses[idx]);
    }, 1800);
    return () => clearInterval(interval);
  }, [step]);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setStep('loading');
    try {
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          prompt: prompt || "Personalized Mix", 
          favoriteArtists: [],
          genres: []
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

  const firstArtwork = generatedResult.songs.length > 0 ? generatedResult.songs[0].artwork : null;
  const palette = useArtworkColors(firstArtwork, accentColor);
  const currentAccent = palette.accent || accentColor;

  const tree = (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-0 md:p-6 lg:p-12 overflow-hidden">
          <m.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/30 backdrop-blur-[8px]"
            onClick={onClose}
          />

          <m.div 
            initial={{ opacity: 0, scale: 0.96, y: 40 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.96, y: 40 }} 
            transition={{ type: "spring", damping: 26, stiffness: 220, mass: 1 }}
            className="w-full h-full md:max-w-5xl md:h-[90vh] md:max-h-[90vh] overflow-hidden md:rounded-[40px] shadow-[0_50px_200px_rgba(0,0,0,0.95)] flex flex-col relative z-10 animate-gpu bg-zinc-950/90"
            style={{
              backgroundColor: `color-mix(in srgb, ${currentAccent} 6%, rgb(8, 8, 10))`,
              borderColor: `color-mix(in srgb, ${currentAccent} 24%, rgba(255,255,255,0.08))`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Immersive background covering the entire modal shell */}
            <div className="absolute inset-0 z-0 pointer-events-none">
              <img
                src={firstArtwork || "https://images.unsplash.com/photo-1614149162883-504ce4d13909?q=80&w=1000&auto=format&fit=crop"}
                alt="Background"
                className="w-full h-full object-cover opacity-45 mix-blend-screen scale-105 group-hover:scale-100 transition-transform duration-[2s] ease-out"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#0d0d0d]/90 via-[#0d0d0d]/60 to-[#0d0d0d]/90" />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0d0d0d]/50 to-[#0d0d0d]" />
            </div>

            {/* Floating Close Button */}
            <m.button 
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.95 }}
              onClick={onClose}
              className="absolute top-6 right-6 p-2.5 rounded-full bg-white/5 text-white/40 hover:text-white transition-all hover:bg-white/10 z-30 backdrop-blur-md border border-white/5"
            >
               <X className="w-5 h-5" />
            </m.button>

            <div className="relative z-10 flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-6 md:p-12 custom-scrollbar">
                {step === 'input' && (
                  <m.div 
                    initial={{ opacity: 0, y: 15 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    transition={MOTION_CONFIG.transition}
                    className="flex flex-col min-h-[50vh] py-4 space-y-8 animate-gpu pb-4 md:pb-0 items-center justify-center"
                  >
                    {/* Center aligned stacked banner */}
                    <div className="relative flex flex-col group w-full justify-center items-center p-8 md:p-14 gap-8 text-center">
                      <div className="flex flex-col items-center justify-center text-center">
                        <h1 className="text-[36px] sm:text-[52px] lg:text-[64px] font-black tracking-tighter text-white leading-[1.05] drop-shadow-xl text-center">
                          Synthesize <br />
                          <span className="text-white/35 text-center">your vibe</span>
                        </h1>
                        <p className="text-[17px] text-white/40 font-medium leading-relaxed max-w-xl mt-4 text-center">
                          Describe the mood, vibe, or style you want. Our neural engine will synthesize a custom playlist and sync it directly to your YouTube library.
                        </p>
                      </div>

                      <div className="w-full max-w-2xl flex flex-col gap-3 justify-center items-center mx-auto">
                        <textarea
                          placeholder="Describe the vibe... e.g. Night drive with heavy bass, or cozy rain and lo-fi beats"
                          className="w-full h-32 bg-black/20 hover:bg-white/10 border border-white/10 focus:border-white/20 rounded-2xl p-4 text-[18px] font-bold text-white placeholder:text-white/20 focus:outline-none resize-none transition-all backdrop-blur-md text-left"
                          value={prompt}
                          onChange={(e) => setPrompt(e.target.value)}
                        />
                        <m.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={handleGenerate}
                          disabled={!prompt.trim()}
                          className="w-full py-3.5 rounded-2xl font-black text-[16px] tracking-tight hover:brightness-110 transition-all disabled:opacity-20 disabled:pointer-events-none"
                          style={{ backgroundColor: currentAccent, color: '#000' }}
                        >
                          Synthesize Vibe
                        </m.button>
                      </div>
                    </div>
                  </m.div>
                )}

                {step === 'loading' && (
                  <div className="flex flex-col items-center justify-center min-h-[50vh] py-12 space-y-10 relative">
                     {/* Immersive radial glow backing */}
                     <div className="absolute w-[350px] h-[350px] rounded-full blur-[140px] opacity-25 animate-pulse duration-[4s]" style={{ backgroundColor: currentAccent }} />

                     <div className="relative w-36 h-36 flex items-center justify-center">
                        {/* Fluid Blob Layer 1 (Outer Slow Rotate) */}
                        <m.div
                          animate={{
                            rotate: 360,
                            borderRadius: ["42% 58% 70% 30% / 45% 45% 55% 55%", "70% 30% 52% 48% / 60% 40% 60% 40%", "42% 58% 70% 30% / 45% 45% 55% 55%"]
                          }}
                          transition={{
                            rotate: { duration: 12, repeat: Infinity, ease: "linear" },
                            borderRadius: { duration: 6, repeat: Infinity, ease: "easeInOut" }
                          }}
                          className="absolute inset-0 opacity-20 filter blur-[1px] border"
                          style={{
                            borderColor: currentAccent,
                            background: `radial-gradient(circle, ${currentAccent} 10%, transparent 70%)`
                          }}
                        />

                        {/* Fluid Blob Layer 2 (Inner Faster Reverse Rotate) */}
                        <m.div
                          animate={{
                            rotate: -360,
                            borderRadius: ["50% 50% 30% 70% / 50% 60% 40% 50%", "30% 70% 70% 30% / 50% 30% 70% 50%", "50% 50% 30% 70% / 50% 60% 40% 50%"]
                          }}
                          transition={{
                            rotate: { duration: 8, repeat: Infinity, ease: "linear" },
                            borderRadius: { duration: 5, repeat: Infinity, ease: "easeInOut" }
                          }}
                          className="absolute inset-2 opacity-35 filter blur-[2px]"
                          style={{
                            background: `linear-gradient(135deg, ${currentAccent}22, transparent)`
                          }}
                        />

                        {/* Fluid Blob Layer 3 (Core Glass Shell) */}
                        <m.div
                          animate={{
                            borderRadius: ["45% 55% 60% 40% / 40% 50% 50% 60%", "60% 40% 50% 50% / 50% 60% 40% 50%", "45% 55% 60% 40% / 40% 50% 50% 60%"]
                          }}
                          transition={{
                            duration: 4,
                            repeat: Infinity,
                            ease: "easeInOut"
                          }}
                          className="absolute inset-4 bg-black/40 backdrop-blur-xl border shadow-2xl flex items-center justify-center"
                          style={{ borderColor: 'rgba(255,255,255,0.08)' }}
                        >
                           {/* Floating & Breathing Icon */}
                           <m.div
                             animate={{
                               y: [0, -6, 0],
                               scale: [1, 1.08, 1],
                               rotate: [0, 5, -5, 0]
                             }}
                             transition={{
                               duration: 3,
                               repeat: Infinity,
                               ease: "easeInOut"
                             }}
                             className="relative z-10"
                           >
                              <Music2 className="w-10 h-10 filter drop-shadow-[0_0_15px_rgba(255,255,255,0.15)] animate-pulse" style={{ color: currentAccent }} />
                           </m.div>
                        </m.div>

                        {/* Floating Melodic Spark Particles */}
                        {Array.from({ length: 5 }).map((_, i) => (
                          <m.div
                            key={i}
                            className="absolute w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: currentAccent }}
                            animate={{
                              y: [0, -70 - Math.random() * 30],
                              x: [0, (i % 2 === 0 ? 30 : -30) * Math.random()],
                              scale: [0, 1.3, 0],
                              opacity: [0, 0.7, 0],
                            }}
                            transition={{
                              duration: 2.2 + Math.random() * 0.8,
                              repeat: Infinity,
                              delay: i * 0.5,
                              ease: "easeOut",
                            }}
                          />
                        ))}
                     </div>

                     <div className="text-center space-y-3 z-10">
                        <m.p key={loadingStatus} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-black text-white tracking-tighter text-center">
                          {loadingStatus}
                        </m.p>
                        <p className="text-white/20 font-black uppercase tracking-widest text-[11px] text-center">Echo neural engine synthesizing tailor tracks</p>
                     </div>
                  </div>
                )}

                {step === 'results' && (
                  <m.div 
                    initial="initial" 
                    animate="animate" 
                    variants={FADE_IN_VARIANTS}
                    className="space-y-12 animate-gpu flex flex-col items-center"
                  >
                    {/* Center aligned results stacked banner */}
                    <div className="relative flex flex-col group w-full justify-center items-center p-8 md:p-14 gap-8 text-center">
                      <div className="flex flex-col items-center justify-center text-center">
                        <h1 className="text-[36px] sm:text-[52px] lg:text-[64px] font-black tracking-tighter text-white leading-[1.05] drop-shadow-xl text-center">
                          Synthesized <br />
                          <input 
                            type="text" 
                            value={generatedResult.name}
                            onChange={(e) => setGeneratedResult(prev => ({ ...prev, name: e.target.value }))}
                            className="bg-transparent text-white/35 focus:text-white/80 focus:outline-none w-full tracking-tighter font-black block mt-1 text-center"
                          />
                        </h1>
                        <p className="text-white/40 text-[17px] font-medium leading-relaxed italic mt-3 text-center">" {prompt} "</p>
                        
                        <div className="flex gap-3 mt-6 justify-center">
                          <m.button 
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleSaveToYt}
                            disabled={librarySyncStatus === "saving" || librarySyncStatus === "synced"}
                            className="px-6 py-3.5 rounded-2xl font-black text-sm tracking-tight hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
                            style={librarySyncStatus === "synced" ? { backgroundColor: 'rgba(255,255,255,0.08)', color: '#fff' } : { backgroundColor: currentAccent, color: '#000' }}
                          >
                            {librarySyncStatus === "saving" ? "Syncing..." : librarySyncStatus === "synced" ? "Synced to YouTube" : "Sync to Library"}
                            {librarySyncStatus === "idle" && <Plus size={14} />}
                            {librarySyncStatus === "synced" && <Check size={14} />}
                          </m.button>
                          <m.button 
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setStep('input')}
                            className="px-6 py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black text-sm transition-all"
                          >
                            New Prompt
                          </m.button>
                        </div>
                      </div>

                      {/* Top 3 tracks listed below the title section, centered */}
                      <div className="w-full max-w-2xl flex flex-col gap-3 justify-center mx-auto">
                        {generatedResult.songs.slice(0, 3).map((track, i) => (
                          <div
                            key={i}
                            className="group/item flex items-center gap-5 bg-black/20 hover:bg-white/10 backdrop-blur-md border border-white/10 p-3 rounded-2xl cursor-pointer transition-all duration-300 hover:translate-x-2"
                          >
                            <div className="w-[72px] h-[72px] shrink-0 bg-black overflow-hidden rounded-xl relative shadow-lg">
                              <MusicArtwork src={track.artwork} alt={track.title} rounded="none" className="w-full h-full" />
                            </div>
                            <div className="flex-1 min-w-0 pr-2 text-left">
                              <p className="text-white font-black text-[18px] truncate tracking-tight mb-0.5">{track.title}</p>
                              <p className="text-white/50 font-bold text-[14px] truncate tracking-wide uppercase">{track.artist}</p>
                            </div>
                            <button 
                              onClick={() => setGeneratedResult(prev => ({ ...prev, songs: prev.songs.filter(s => s.id !== track.id) }))} 
                              className="p-1.5 hover:text-red-400 text-white/20 transition-all shrink-0"
                            >
                              <Minus size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* shelf list for rest of the songs - matching CenterPanel.tsx shelves */}
                    <div className="mt-12">
                      <h2 className="text-[24px] font-black text-white tracking-tight mb-6 text-left">Generated setlist ({generatedResult.songs.length} tracks)</h2>
                      <div className="flex items-start gap-x-6 overflow-x-auto no-scrollbar scroll-smooth pb-6">
                        {generatedResult.songs.map((song, i) => (
                          <m.div 
                            key={`${song.id}-${i}`} 
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.03, ease: APPLE_EASE }}
                            className="w-[180px] sm:w-[200px] shrink-0 group flex flex-col relative"
                          >
                            <div className="relative aspect-square overflow-hidden rounded-[22px] bg-[#161618] shadow-[0_20px_40px_rgba(0,0,0,0.4)] ring-1 ring-white/5 transition-all duration-500 group-hover:shadow-[0_40px_80px_rgba(0,0,0,0.55)]">
                              <MusicArtwork src={song.artwork} alt={song.title} iconSize={30} variant="track" rounded="2xl" className="transition-transform duration-700 group-hover:scale-110" />
                              <button 
                                onClick={() => setGeneratedResult(prev => ({ ...prev, songs: prev.songs.filter(s => s.id !== song.id) }))}
                                className="absolute top-3 right-3 p-1.5 bg-black/60 backdrop-blur-md rounded-full text-white/40 hover:text-red-400 border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Minus size={12} />
                              </button>
                            </div>
                            <div className="mt-4 px-1 text-left">
                              <h3 className="line-clamp-2 text-[15px] font-bold leading-tight tracking-tight text-white h-[38px]">{song.title}</h3>
                              <p className="mt-1 truncate text-[12px] font-medium text-white/40 uppercase">{song.artist}</p>
                            </div>
                          </m.div>
                        ))}
                      </div>
                    </div>
                  </m.div>
                )}
             </div>
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
