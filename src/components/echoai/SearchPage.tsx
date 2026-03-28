import { useCallback, useEffect, useRef, useState } from "react";
import { Search, Mic, X, Play, Clock } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { type Song } from "./types";

interface SearchPageProps {
  onClose: () => void;
  onSongSelect: (song: Song) => void;
  onQueueReplace: (songs: Song[]) => void;
}

type SearchItem = {
  videoId: string;
  title: string;
  author: string;
  duration: string;
  thumbnail: string;
};

export function SearchPage({ onClose, onSongSelect, onQueueReplace }: SearchPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [identifiedSong, setIdentifiedSong] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchItem[]>([]);
  const [songColors, setSongColors] = useState<Record<string, string>>({});
  const searchTimeoutRef = useRef<number | null>(null);

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

  const handleMusicIdentifier = () => {
    setIsListening(true);
    setIdentifiedSong(null);
    setTimeout(() => {
      setIsListening(false);
      setIdentifiedSong("Midnight Dreams by Luna Park");
    }, 3000);
  };

  const runSearch = useCallback(async (queryOverride?: string) => {
    const query = (queryOverride ?? searchQuery).trim();
    if (!query) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
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
  }, [searchQuery]);

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

  const mappedSongs: Song[] = searchResults.map((item, idx) => ({
    id: item.videoId || `search-${idx}`,
    title: item.title,
    artist: item.author,
    artwork: item.thumbnail,
    duration: item.duration,
    color: songColors[item.videoId] || "#FA243C",
  }));

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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 h-full overflow-y-auto bg-[#1C1C1E] relative custom-scrollbar">
      <div className="flex w-full flex-col px-6 py-8 pb-32 text-left lg:px-12 lg:py-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-[34px] font-bold tracking-tight text-white">Search</h1>
          <button
            onClick={onClose}
            className="text-[#FA243C] font-medium text-[17px] hover:opacity-80 transition-opacity"
          >
            Cancel
          </button>
        </div>

        <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="mb-10 w-full max-w-3xl">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void runSearch();
            }}
            className="relative flex items-center w-full rounded-[10px] bg-[#2C2C2E] px-3 py-2.5 transition-colors focus-within:bg-[#3A3A3C]"
          >
            <Search size={20} className="text-[#EBEBF5]/60 mr-2.5" />
            <input
              type="text"
              placeholder="Artists, Songs, Lyrics, and More"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-[17px] text-white placeholder:text-[#EBEBF5]/60 focus:outline-none"
              autoFocus
            />
            {searchQuery && (
               <button type="button" onClick={() => setSearchQuery("")} className="text-[#EBEBF5]/60 hover:text-white transition p-1">
                 <X size={18} />
               </button>
            )}
          </form>
        </motion.div>

        {!searchQuery && (
          <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="w-full max-w-3xl">
            <h2 className="text-[20px] font-bold text-white mb-4">Shazam Music Recognition</h2>
            <button 
              onClick={handleMusicIdentifier} 
              disabled={isListening} 
              className="w-full flex items-center justify-between rounded-xl bg-[#2C2C2E]/60 hover:bg-[#2C2C2E] transition-colors p-4 border border-white/5"
            >
              <div className="flex items-center gap-4">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${isListening ? "bg-[#FA243C]/20 text-[#FA243C] animate-pulse" : "bg-white/10 text-white"}`}>
                  <Mic size={24} />
                </div>
                <div className="text-left overflow-hidden">
                  <h3 className="text-[17px] font-semibold text-white truncate">{isListening ? "Listening..." : "Tap to identify music"}</h3>
                  <p className="text-[14px] text-[#EBEBF5]/60 truncate">{identifiedSong || "Find out what song is playing near you"}</p>
                </div>
              </div>
            </button>
          </motion.div>
        )}

        {searchQuery && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-4xl">
            <h2 className="text-[20px] font-bold text-white mb-2 border-b border-white/10 pb-3">
              {searchLoading ? "Searching..." : "Top Results"}
            </h2>
            <div className="flex flex-col">
              {mappedSongs.map((song, index) => (
                <motion.div
                  key={song.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="group flex cursor-pointer items-center justify-between rounded-xl p-3 px-4 -mx-4 transition-colors hover:bg-white/5 active:bg-white/10"
                  onClick={() => {
                    void (async () => {
                      const dynamicColor = songColors[song.id] || (await extractDominantColor(song.artwork)) || song.color;
                      const normalizedSongs = mappedSongs.map((queuedSong) =>
                        queuedSong.id === song.id ? { ...queuedSong, color: dynamicColor } : queuedSong
                      );
                      onQueueReplace(normalizedSongs);
                      onSongSelect({ ...song, color: dynamicColor });
                      onClose();
                    })();
                  }}
                >
                  <div className="flex items-center gap-3.5 flex-1 min-w-0">
                    <div className="relative h-[48px] w-[48px] shrink-0 overflow-hidden rounded-[6px] border border-white/10 shadow-sm">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={song.artwork} alt={song.title} className="h-full w-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                         <Play fill="white" className="text-white w-5 h-5 ml-0.5" />
                      </div>
                    </div>
                    <div className="flex flex-col flex-1 min-w-0 pr-4">
                      <p className="truncate text-[16px] font-medium text-white">{song.title}</p>
                      <p className="truncate text-[14px] text-[#EBEBF5]/60">Song · {song.artist}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                     <span className="text-[13px] font-medium text-[#EBEBF5]/50 flex items-center gap-1.5"><Clock size={14}/> {song.duration}</span>
                  </div>
                </motion.div>
              ))}
            </div>
            
            {!searchLoading && mappedSongs.length === 0 && (
              <div className="py-20 text-center">
                <p className="text-[17px] font-semibold text-[#EBEBF5]/60">No Results Found</p>
                <p className="text-[14px] text-[#EBEBF5]/40 mt-2">Try spelling it differently or use fewer words.</p>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
