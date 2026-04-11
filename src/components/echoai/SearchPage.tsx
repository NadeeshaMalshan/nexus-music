import { useCallback, useEffect, useRef, useState } from "react";
import { Search, Mic, X, Play, Clock, ListPlus, PlaySquare, MoreHorizontal, Sparkles, UserRound } from "lucide-react";
import { m, AnimatePresence } from "motion/react";
import { APPLE_EASE, MOTION_CONFIG } from "@/lib/animations";
import { type Song } from "./types";
import { SwipeableSongRow } from "./SwipeableSongRow";
import { SongMenu } from "./SongMenu";
import { useDashboard } from "@/context/DashboardContext";

interface SearchPageProps {
  onClose: () => void;
  onSongSelect: (song: Song) => void;
  onQueueReplace?: (songs: Song[]) => void;
  onAddToQueue?: (song: Song) => void;
  onPlayNext?: (song: Song) => void;
  onNavigateArtist?: (name: string) => void;
}

type SearchItem = {
  videoId: string;
  title: string;
  author: string;
  duration: string;
  thumbnail: string;
  type?: "ARTIST" | "PLAYLIST" | "SONG";
  id?: string;
  name?: string;
  views?: string;
};

const formatCount = (count: string | number) => {
  const num = typeof count === "string" ? parseInt(count) : count;
  if (!num) return "0";
  if (num >= 1000000000) return (num / 1000000000).toFixed(1) + "B";
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toString();
};

export function SearchPage({ onClose, onSongSelect, onQueueReplace, onAddToQueue, onPlayNext, onNavigateArtist }: SearchPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("Top");
  const [isListening, setIsListening] = useState(false);
  const [identifiedSong, setIdentifiedSong] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchItem[]>([]);
  const [songColors, setSongColors] = useState<Record<string, string>>({});
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const { songIsInLikedLibrary, resolveLikedLibraryRateVideoId, onRateSong } = useDashboard();
  const searchTimeoutRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Category list
  const categories = ["Top", "Songs", "Artists", "Albums", "Playlists", "Remixes"];

  // Handle initial query from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const q = urlParams.get("q");
    if (q) {
      setSearchQuery(q);
      void runSearch(q);
    }
  }, []);

  const extractDominantColor = useCallback(async (src: string): Promise<string | null> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.referrerPolicy = "no-referrer";
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const size = 24;
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.drawImage(img, 0, 0, size, size);
          const pixels = ctx.getImageData(0, 0, size, size).data;

          let r = 0;
          let g = 0;
          let b = 0;
          let count = 0;

          for (let i = 0; i < pixels.length; i += 4) {
            const pr = pixels[i];
            const pg = pixels[i + 1];
            const pb = pixels[i + 2];
            const alpha = pixels[i + 3];
            if (alpha < 64) continue;

            const max = Math.max(pr, pg, pb);
            const min = Math.min(pr, pg, pb);
            if (max < 35 || min > 225) continue;

            r += pr;
            g += pg;
            b += pb;
            count += 1;
          }

          if (count === 0) {
            resolve(null);
            return;
          }

          const rr = Math.round(r / count);
          const gg = Math.round(g / count);
          const bb = Math.round(b / count);
          resolve(`#${rr.toString(16).padStart(2, "0")}${gg.toString(16).padStart(2, "0")}${bb.toString(16).padStart(2, "0")}`);
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }, []);

  const handleMusicIdentifier = async () => {
    try {
      if (isListening) return;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        const formData = new FormData();
        formData.append("audio", audioBlob);

        try {
          const response = await fetch("/api/identify", {
            method: "POST",
            body: formData,
          });

          const data = await response.json();
          if (response.ok) {
             setIdentifiedSong(`${data.title} by ${data.artist}`);
             if (data.id) {
                setSearchResults([
                  {
                    videoId: data.id,
                    title: data.title,
                    author: data.artist,
                    duration: data.duration,
                    thumbnail: data.artwork
                  }
                ]);
             }
          } else {
             setIdentifiedSong(data.error || "Could not identify song.");
          }
        } catch (err) {
          console.error("Identification error:", err);
          setIdentifiedSong("Error identifying song.");
        } finally {
          setIsListening(false);
          stream.getTracks().forEach(track => track.stop());
        }
      };

      setIsListening(true);
      setIdentifiedSong("Focusing on the sound...");
      mediaRecorder.start();

      setTimeout(() => {
        if (mediaRecorderRef.current?.state === "recording") {
          mediaRecorderRef.current.stop();
        }
      }, 7000);

    } catch (err) {
      console.error("Microphone access denied:", err);
      setIdentifiedSong("Microphone access is required.");
      setIsListening(false);
    }
  };

  const runSearch = useCallback(async (queryOverride?: string, categoryOverride?: string) => {
    const query = (queryOverride ?? searchQuery).trim();
    const cat = categoryOverride ?? activeCategory;
    if (!query) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    
    // Determine the type for the API
    let type = "songs";
    if (cat === "Artists") type = "artists";
    else if (cat === "Playlists") type = "playlists";
    
    // Remixes as a local modification of songs search
    let finalQuery = query;
    if (cat === "Remixes") finalQuery += " remix";
    
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(finalQuery)}&type=${type}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Search request failed");
      }
      const payload = (await response.json()) as { items: SearchItem[] };
      setSearchResults(payload.items || []);
    } catch (error) {
      console.error("Search failed:", error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [searchQuery, activeCategory]);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      window.clearTimeout(searchTimeoutRef.current);
    }
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    searchTimeoutRef.current = window.setTimeout(() => {
      void runSearch(searchQuery);
    }, 350);

    return () => {
      if (searchTimeoutRef.current) {
        window.clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, runSearch]);

  const mappedSongs: any[] = searchResults.map((item: any, idx) => {
    // Standardize to a common UI item shape
    if (item.type === "ARTIST") {
       return {
         id: item.id || `artist-${idx}`,
         title: item.name,
         artist: "Artist",
         artwork: item.thumbnail,
         duration: "",
         color: "var(--art-accent, #FA243C)",
         type: "ARTIST"
       };
    }
    if (item.type === "PLAYLIST") {
       return {
         id: item.id || `playlist-${idx}`,
         title: item.title,
         artist: `Playlist · ${item.author}`,
         artwork: item.thumbnail,
         duration: "",
         color: "var(--art-accent, #FA243C)",
         type: "PLAYLIST"
       };
    }
    return {
      id: item.videoId || `search-${idx}`,
      title: item.title,
      artist: item.author,
      artwork: item.thumbnail,
      duration: item.duration,
      color: songColors[item.videoId] || "var(--art-accent, #FA243C)",
      type: "SONG",
      views: item.views
    };
  });

  useEffect(() => {
    let isCancelled = false;
    async function hydrateSongColors() {
      const updates: Record<string, string> = {};
      for (const item of searchResults) {
        const id = item.videoId;
        if (!id || songColors[id]) continue;
        const extracted = await extractDominantColor(item.thumbnail);
        if (extracted) {
          updates[id] = extracted;
        }
      }
      if (!isCancelled && Object.keys(updates).length > 0) {
        setSongColors((prev) => ({ ...prev, ...updates }));
      }
    }
    if (searchResults.length > 0) {
      void hydrateSongColors();
    }
    return () => {
      isCancelled = true;
    };
  }, [extractDominantColor, searchResults, songColors]);

  return (
    <m.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }} 
      transition={MOTION_CONFIG.transition}
      className="flex-1 h-full overflow-y-auto bg-transparent relative custom-scrollbar flex flex-col animate-gpu"
    >
      <div className="flex w-full flex-col px-6 py-10 md:px-12 md:py-12 pb-48 text-left">
        <div className="flex items-center justify-between mb-8 md:mb-10">
          <h1 className="text-3xl md:text-5xl lg:text-[56px] font-black text-white tracking-tighter leading-none">Search</h1>
          <button
            onClick={onClose}
            className="md:hidden font-bold text-lg px-4 py-2 bg-white/5 rounded-full"
            style={{ color: 'var(--art-accent, #FA243C)' }}
          >
            Done
          </button>
        </div>

        <m.div 
          initial={{ y: -10, opacity: 0 }} 
          animate={{ y: 0, opacity: 1 }} 
          transition={{ delay: 0.1, ...MOTION_CONFIG.transition }} 
          className="mb-8 w-full max-w-4xl animate-gpu"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void runSearch();
            }}
            className="relative flex items-center w-full rounded-2xl md:rounded-[24px] bg-white/4 border border-white/5 px-4 md:px-6 py-4 md:py-5 transition-all focus-within:bg-white/8 focus-within:ring-2 shadow-2xl"
            style={{ ringColor: 'var(--art-accent, #FA243C)33' } as any}
          >
            <Search className="w-5 h-5 md:w-6 md:h-6 text-white/40 mr-3 md:mr-4" />
            <input
              type="text"
              placeholder="Artists, Songs, Lyrics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-lg md:text-2xl font-black text-white placeholder:text-white/10 focus:outline-none"
              autoFocus
            />
            {searchQuery && (
               <button type="button" onClick={() => setSearchQuery("")} className="text-white/20 hover:text-white transition p-1 mr-2">
                 <X className="w-5 h-5 md:w-6 md:h-6" />
               </button>
            )}
            <button 
              type="button" 
              onClick={handleMusicIdentifier}
              className={`p-2.5 rounded-full transition-all ${isListening ? "text-white animate-pulse" : "bg-white/5 text-white/40 hover:text-white hover:bg-white/10"}`}
              style={{ backgroundColor: isListening ? 'var(--art-accent, #FA243C)' : undefined }}
            >
              <Mic className="w-5 h-5 md:w-6 md:h-6" />
            </button>
          </form>

          {/* Categories */}
          <div className="flex gap-2.5 mt-8 overflow-x-auto no-scrollbar pb-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setActiveCategory(cat);
                  void runSearch(searchQuery, cat);
                }}
                className={`px-6 py-2.5 rounded-full text-[13px] md:text-sm font-black tracking-wide transition-all uppercase whitespace-nowrap border ${
                  activeCategory === cat 
                  ? "bg-white text-black border-white" 
                  : "bg-white/3 text-white/30 border-white/5 hover:bg-white/10 hover:text-white"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </m.div>

        {!searchQuery && !identifiedSong && (
          <m.div 
            initial={{ y: -10, opacity: 0 }} 
            animate={{ y: 0, opacity: 1 }} 
            transition={{ delay: 0.2, ...MOTION_CONFIG.transition }} 
            className="w-full max-w-3xl py-12 md:py-20 space-y-6 md:space-y-8 animate-gpu"
          >
             <div className="w-16 h-16 md:w-20 md:h-20 bg-linear-to-tr from-white/10 to-transparent rounded-2xl md:rounded-3xl flex items-center justify-center opacity-40">
                <Sparkles className="w-8 h-8 md:w-10 md:h-10 text-white" />
             </div>
             <div className="space-y-4">
               <h2 className="text-2xl md:text-4xl font-black text-white tracking-tight">Curation Studio</h2>
               <p className="text-lg md:text-xl font-bold text-white/20 max-w-md">Browse millions of tracks or use Nexus Intelligence to discover the perfect setlist for your vibe.</p>
             </div>
          </m.div>
        )}

        {identifiedSong && !searchQuery && (
           <div className="mb-10 p-6 rounded-3xl bg-white/5 border border-white/5 backdrop-blur-3xl animate-in fade-in slide-in-from-top-4">
              <div className="flex items-center gap-4">
                 <div 
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${isListening ? "animate-pulse" : "text-white"}`}
                  style={{ backgroundColor: isListening ? 'var(--art-accent, #FA243C)33' : 'var(--art-accent, #FA243C)', color: isListening ? 'var(--art-accent, #FA243C)' : 'white' }}
                >
                  <Mic size={24} />
                </div>
                <div>
                   <h3 className="text-lg font-bold text-white leading-tight">{isListening ? "Listening..." : "Identified Song"}</h3>
                   <p className="text-white/60 font-medium">{identifiedSong}</p>
                </div>
              </div>
           </div>
        )}

        {searchQuery && (
          <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={MOTION_CONFIG.transition} className="w-full max-w-5xl animate-gpu">
            <h2 className="text-[24px] font-black text-white mb-6 px-1">
              {searchLoading ? "Finding..." : activeCategory === "Top" ? "Top Results" : activeCategory}
            </h2>
            <div className="flex flex-col gap-1">
              {mappedSongs.map((song, index) => (
                <SwipeableSongRow
                  key={song.id}
                  disableDrag={openMenuId === song.id}
                  className={openMenuId === song.id ? "z-50" : "z-10"}
                  onSwipeLeft={() => {
                    void (async () => {
                      const highResArtwork = song.artwork?.replace(/([=|-][swh])\d+/g, '$11200') || song.artwork;
                      const dynamicColor = songColors[song.id] || (await extractDominantColor(song.artwork)) || song.color;
                      onAddToQueue?.({ ...song, artwork: highResArtwork, color: dynamicColor });
                    })();
                  }}
                  onSwipeRight={() => {
                    void (async () => {
                      const highResArtwork = song.artwork?.replace(/([=|-][swh])\d+/g, '$11200') || song.artwork;
                      const dynamicColor = songColors[song.id] || (await extractDominantColor(song.artwork)) || song.color;
                      onPlayNext?.({ ...song, artwork: highResArtwork, color: dynamicColor });
                    })();
                  }}
                >
                  <m.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03, ...MOTION_CONFIG.transition }}
                    className="group flex cursor-pointer items-center justify-between rounded-2xl p-3 px-4 transition-all hover:bg-white/[0.04] animate-gpu"
                    onClick={() => {
                      // For Artist category → navigate to artist page
                      if (song.type === "ARTIST") {
                        onNavigateArtist?.(song.title);
                        return;
                      }
                      // For Playlist category → navigate to playlist page
                      if (song.type === "PLAYLIST") {
                        window.location.href = `/playlists/${song.id}`;
                        return;
                      }
                      void (async () => {
                        const highResArtwork = song.artwork?.replace(/([=|-][swh])\d+/g, '$11200') || song.artwork;
                        const dynamicColor = songColors[song.id] || (await extractDominantColor(song.artwork)) || song.color;
                        onSongSelect({ ...song, artwork: highResArtwork, color: dynamicColor });
                        onClose();
                      })();
                    }}
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className={`relative h-[64px] w-[64px] shrink-0 overflow-hidden ${song.type === "ARTIST" ? "rounded-full" : "rounded-xl"} border border-white/10 shadow-lg`}>
                        <img src={song.artwork?.replace(/([=|-][swh])\d+/g, '$1600') || song.artwork} alt={song.title} className="h-full w-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                           <Play fill="white" className="text-white w-6 h-6 ml-1" />
                        </div>
                      </div>
                      <div className="flex flex-col flex-1 min-w-0 pr-4">
                        <p className="truncate text-[18px] font-bold text-white leading-tight mb-1">{song.title}</p>
                        <div className="flex items-center gap-2">
                          <p 
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigateArtist?.(song.artist);
                            }}
                            className="truncate text-[15px] font-medium text-white/40 hover:text-white/80 transition-colors cursor-pointer"
                          >
                            {song.artist}
                          </p>
                          {(!song.type || song.type === "SONG") && song.views && (
                            <>
                              <span className="text-white/10 text-[10px]">•</span>
                              <span className="text-[12px] font-bold text-white/20 uppercase tracking-widest leading-none">
                                {formatCount(song.views)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 relative">
                      <div className="hidden items-center gap-2 lg:flex opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void (async () => {
                              const highResArtwork = song.artwork?.replace(/([=|-][swh])\d+/g, '$11200') || song.artwork;
                              const dynamicColor = songColors[song.id] || (await extractDominantColor(song.artwork)) || song.color;
                              onPlayNext?.({ ...song, artwork: highResArtwork, color: dynamicColor });
                            })();
                          }}
                          className="p-2.5 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-all outline-hidden"
                          title="Play Next"
                        >
                          <PlaySquare size={20} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void (async () => {
                              const highResArtwork = song.artwork?.replace(/([=|-][swh])\d+/g, '$11200') || song.artwork;
                              const dynamicColor = songColors[song.id] || (await extractDominantColor(song.artwork)) || song.color;
                              onAddToQueue?.({ ...song, artwork: highResArtwork, color: dynamicColor });
                            })();
                          }}
                          className="p-2.5 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-all outline-hidden"
                          title="Add to Queue"
                        >
                          <ListPlus size={20} />
                        </button>
                      </div>
                      <span className="text-[15px] font-bold text-white/20">{song.duration}</span>
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setOpenMenuId(song.id === openMenuId ? null : song.id); 
                        }} 
                        className={`text-white/20 hover:text-white transition-all p-2 rounded-full ${openMenuId === song.id ? "bg-white/10 text-white" : "hover:bg-white/10"}`}
                      >
                         <MoreHorizontal size={20} />
                      </button>

                      {/* Explicit Menu Portal/Replacement */}
                      <SongMenu
                        song={song}
                        isOpen={openMenuId === song.id}
                        onClose={() => setOpenMenuId(null)}
                        onAddToQueue={() => {
                           const highResArtwork = song.artwork?.replace(/([=|-][swh])\d+/g, '$11200') || song.artwork;
                           onAddToQueue?.({ ...song, artwork: highResArtwork });
                        }}
                        onPlayNext={() => {
                           const highResArtwork = song.artwork?.replace(/([=|-][swh])\d+/g, '$11200') || song.artwork;
                           onPlayNext?.({ ...song, artwork: highResArtwork });
                        }}
                        onLike={() => {
                          const liked = songIsInLikedLibrary(song);
                          if (liked) void onRateSong?.(resolveLikedLibraryRateVideoId(song), "none");
                          else void onRateSong?.(song.id, "like", { title: song.title, artist: song.artist });
                        }}
                        isLiked={songIsInLikedLibrary(song)}
                      />
                    </div>
                  </m.div>
                </SwipeableSongRow>
              ))}
            </div>
            
            {!searchLoading && mappedSongs.length === 0 && (
              <div className="py-24 text-center">
                <p className="text-[20px] font-bold text-white/60">No Results Found</p>
                <p className="text-[17px] text-white/30 mt-2 font-medium">Try spelling it differently or browse categories.</p>
              </div>
            )}
          </m.div>
        )}
      </div>
    </m.div>
  );
}
