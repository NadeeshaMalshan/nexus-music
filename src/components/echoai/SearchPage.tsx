import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Mic, X, Play, Clock, ListPlus, PlaySquare, MoreHorizontal, Sparkles, UserRound, Video, ChevronLeft, ChevronRight, Users, ArrowLeft } from "lucide-react";
import { m, AnimatePresence } from "motion/react";
import { APPLE_EASE, MOTION_CONFIG } from "@/lib/animations";
import { type Song } from "./types";
import { SwipeableSongRow } from "./SwipeableSongRow";
import { SongMenu } from "./SongMenu";
import { useDashboard } from "@/context/DashboardContext";
import { parseYouTubeWatchUrl, songFromYouTubeVideoId } from "@/lib/parseYouTubeUrl";
import { MusicArtwork } from "./MusicArtwork";
import { JamSession } from "./JamSession";
import { useSearchSuggestions } from "@/lib/useSearchSuggestions";

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
  type?: "ARTIST" | "PLAYLIST" | "SONG" | "ALBUM";
  id?: string;
  name?: string;
  views?: string;
  /** Mixed into Top results: play as music video in expanded player */
  fromVideosShelf?: boolean;
  isLive?: boolean;
  fromLiveShelf?: boolean;
};

type UserSearchItem = {
  name?: string;
  email?: string;
  avatarUrl?: string;
  image?: string;
  thumbnail?: string;
};

type SearchResultItem = SearchItem | (UserSearchItem & {
  type: "USER";
  id: string;
  title: string;
  author: string;
  thumbnail: string;
  user: UserSearchItem;
});

function looksLikePersonQuery(query: string): boolean {
  return false;
}
const formatCount = (count: string | number) => {
  const num = typeof count === "string" ? parseInt(count) : count;
  if (!num) return "0";
  if (num >= 1000000000) return (num / 1000000000).toFixed(1) + "B";
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toString();
};

function CategoryShelf({ shelf, isRightSidebarOpen }: { shelf: any, isRightSidebarOpen: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { setSelectedPlaylist } = useDashboard();

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = dir === "left" ? -800 : 800;
    scrollRef.current.scrollBy({ left: amount, behavior: "smooth" });
  };

  return (
    <div className="w-full relative group/shelf">
      <div className={`mb-6 flex items-center justify-between px-1 transition-[padding-right] duration-[450ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
        isRightSidebarOpen ? "lg:pr-[380px]" : "lg:pr-0"
      }`}>
        <h3 className="text-[20px] md:text-[24px] font-bold text-white tracking-tight">{shelf.title}</h3>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => scroll("left")}
            className="text-white/40 hover:text-white transition-all hover:scale-110 active:scale-90"
            aria-label="Scroll left"
          >
            <ChevronLeft size={24} strokeWidth={2.5} />
          </button>
          <button 
            onClick={() => scroll("right")}
            className="text-white/40 hover:text-white transition-all hover:scale-110 active:scale-90"
            aria-label="Scroll right"
          >
            <ChevronRight size={24} strokeWidth={2.5} />
          </button>
        </div>
      </div>
      <div 
        ref={scrollRef}
        className="flex items-start gap-4 overflow-x-auto no-scrollbar scroll-smooth px-1 pb-4"
      >
        {shelf.items.map((item: any, j: number) => (
          <div key={j} className="w-[160px] md:w-[200px] shrink-0 group cursor-pointer" onClick={() => {
            if (item.playlistId) {
              if (item.subtitle.toLowerCase().includes("album")) {
                router.push(`/album/${item.playlistId}`);
              } else {
                setSelectedPlaylist({
                  id: item.playlistId,
                  title: item.title,
                  description: item.subtitle || "",
                  thumbnailUrl: item.thumbnail || "",
                  itemCount: 0
                });
                router.push(`/playlists/${item.playlistId}`);
              }
            }
          }}>
            <div className="relative w-full aspect-square rounded-xl overflow-hidden mb-3 shadow-lg">
              {item.thumbnail ? (
                <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
              ) : (
                <div className="w-full h-full bg-white/5 flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-white/20" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                 <div className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center shadow-2xl scale-75 group-hover:scale-100 transition-transform">
                   <Play size={20} className="ml-1" fill="currentColor" />
                 </div>
              </div>
            </div>
            <h4 className="text-[14px] md:text-[15px] font-bold text-white truncate">{item.title}</h4>
            <p className="text-[12px] md:text-[13px] text-white/50 truncate mt-1">{item.subtitle}</p>
          </div>
        ))}
        {isRightSidebarOpen && (
          <div className="hidden lg:block w-[380px] shrink-0 pointer-events-none" />
        )}
      </div>
    </div>
  );
}

function isActuallyLiveStream(item: any): boolean {
  if (item.isLive) return true;
  if (item.fromLiveShelf) return true;
  if (!item.duration) return false;
  if (item.duration === "LIVE" || item.duration === "0:00") return true;
  return false;
}

export function SearchPage({ onClose, onSongSelect, onQueueReplace, onAddToQueue, onPlayNext, onNavigateArtist }: SearchPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("Top");
  const [isListening, setIsListening] = useState(false);
  const [identifiedSong, setIdentifiedSong] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showJamView, setShowJamView] = useState(false);
  const [exploreSections, setExploreSections] = useState<any[]>([]);
  const [exploreLoading, setExploreLoading] = useState(true);
  const [selectedCategoryTitle, setSelectedCategoryTitle] = useState<string | null>(null);
  const [selectedCategoryData, setSelectedCategoryData] = useState<any[]>([]);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [userResults, setUserResults] = useState<UserSearchItem[]>([]);
  const [resultsByCategory, setResultsByCategory] = useState<Record<string, SearchItem[]>>({});
  const [songColors, setSongColors] = useState<Record<string, string>>({});
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [infoSong, setInfoSong] = useState<Song | null>(null);
  const { songIsInLikedLibrary, resolveLikedLibraryRateVideoId, onRateSong, isRightSidebarOpen, setIsRightSidebarOpen, setRightSidebarMode } = useDashboard();
  const router = useRouter();
  const searchTimeoutRef = useRef<number | null>(null);
  const searchRunIdRef = useRef(0);
  const searchQueryRef = useRef(searchQuery);
  const lastSearchedQueryRef = useRef("");
  const activeCategoryRef = useRef(activeCategory);
  const onCloseRef = useRef(onClose);
  const onSongSelectRef = useRef(onSongSelect);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const [isInputFocused, setIsInputFocused] = useState(false);
  const { textSuggestions, richResults, setOpen: setSuggestionsOpen } = useSearchSuggestions(searchQuery);

  useEffect(() => {
    setSuggestionsOpen(isInputFocused);
  }, [isInputFocused, setSuggestionsOpen]);

  searchQueryRef.current = searchQuery;
  activeCategoryRef.current = activeCategory;
  onCloseRef.current = onClose;
  onSongSelectRef.current = onSongSelect;

  // Category list
const categories = ["Top", "Songs", "Videos", "Live", "Artists", "Albums", "Playlists", "Users", "Remixes"];

  const searchAccentColor = "var(--art-accent, #FA243C)";

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

  useEffect(() => {
    fetch("/api/explore")
      .then(res => res.json())
      .then(data => {
        if (data.sections) {
          setExploreSections(data.sections);
        }
      })
      .catch(err => console.error("Failed to load explore data", err))
      .finally(() => setExploreLoading(false));
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

  const playFromWatchUrl = useCallback(
    async (trimmed: string): Promise<boolean> => {
      const parsed = parseYouTubeWatchUrl(trimmed);
      if (!parsed) return false;
      
      const { videoId, isMusic, isLive } = parsed;
      const shouldPreferVideo = !isMusic;

      const song = await songFromYouTubeVideoId(videoId, searchAccentColor, shouldPreferVideo, isLive);
      onSongSelectRef.current(song);
      onCloseRef.current();
      setSearchResults([]);
      setResultsByCategory({});
      setSearchLoading(false);
      return true;
    },
    []
  );


  const runSearch = useCallback(async (queryOverride?: string, categoryOverride?: string) => {
    const query = (queryOverride ?? searchQueryRef.current).trim();
    const cat = categoryOverride ?? activeCategoryRef.current;
    if (!query) {
      setSearchResults([]);
      setResultsByCategory({});
      return;
    }

    if (await playFromWatchUrl(query)) {
      return;
    }

    setSearchLoading(true);
    
    // Remixes as a local modification of songs search
    let finalQuery = query;
    if (cat === "Remixes") finalQuery += " remix";
    
    try {
      const runId = ++searchRunIdRef.current;

      const fetchType = async (type: string): Promise<SearchItem[]> => {
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(finalQuery)}&type=${type}`, { cache: "no-store" });
          if (!res.ok) return [];
          const payload = (await res.json()) as { items: SearchItem[] };
          return payload.items || [];
        } catch (e) {
          return [];
        }
      };

      if (cat === "Top") {
        const [songs, videos, artists, albums, playlists, live, users] = await Promise.all([
          fetchType("songs"),
          fetchType("videos"),
          fetchType("artists"),
          fetchType("albums"),
          fetchType("playlists"),
          fetchType("live"),
          fetch(`/api/user/search?q=${encodeURIComponent(finalQuery)}`, { cache: "no-store" })
            .then((r) => (r.ok ? r.json() : []))
            .catch(() => []),
        ]);

        const userItems = (users || []).map((user: any, idx: number) => ({
          type: "USER",
          id: user.email || user.name || `user-${idx}`,
          name: user.name || user.email || "",
          title: user.name || user.email || "",
          author: user.email || "",
          thumbnail: user.avatarUrl || user.image || user.thumbnail || "",
          user,
        }));

        const byCat: Record<string, any[]> = {
          Songs: songs,
          Videos: videos,
          Live: live,
          Artists: artists,
          Albums: albums,
          Playlists: playlists,
          Users: userItems,
        };
        setResultsByCategory(byCat);

        const queryLower = finalQuery.toLowerCase();
        let prioritizedResults: SearchItem[] = [];
        
        // Keep only actual live streams
        const actualLiveOnly = (live || []).filter(isActuallyLiveStream);

        setUserResults(users.slice(0, 5));

        if (queryLower.includes("playlist") || queryLower.includes("mix")) {
          prioritizedResults = [
            ...(playlists || []).slice(0, 5),
            ...(songs || []).slice(0, 3),
            ...(artists || []).slice(0, 1),
            ...(albums || []).slice(0, 1),
            ...(actualLiveOnly).slice(0, 1).map((l) => ({ ...l, fromLiveShelf: true })),
            ...(videos || []).slice(0, 1).map((v) => ({ ...v, fromVideosShelf: true })),
          ];
        } else if (queryLower.includes("album")) {
          prioritizedResults = [
            ...(albums || []).slice(0, 5),
            ...(songs || []).slice(0, 3),
            ...(artists || []).slice(0, 1),
            ...(playlists || []).slice(0, 1),
            ...(actualLiveOnly).slice(0, 1).map((l) => ({ ...l, fromLiveShelf: true })),
            ...(videos || []).slice(0, 1).map((v) => ({ ...v, fromVideosShelf: true })),
          ];
        } else if (queryLower.includes("video") || queryLower.includes("music video") || queryLower.includes("mv")) {
          prioritizedResults = [
            ...(videos || []).slice(0, 5).map((v) => ({ ...v, fromVideosShelf: true })),
            ...(actualLiveOnly).slice(0, 2).map((l) => ({ ...l, fromLiveShelf: true })),
            ...(songs || []).slice(0, 3),
            ...(artists || []).slice(0, 1),
            ...(albums || []).slice(0, 1),
            ...(playlists || []).slice(0, 1),
          ];
        } else if (queryLower.includes("live") || queryLower.includes("concert")) {
          prioritizedResults = [
            ...(actualLiveOnly).slice(0, 5).map((l) => ({ ...l, fromLiveShelf: true })),
            ...(videos || []).slice(0, 2).map((v) => ({ ...v, fromVideosShelf: true })),
            ...(songs || []).slice(0, 3),
            ...(artists || []).slice(0, 1),
            ...(albums || []).slice(0, 1),
            ...(playlists || []).slice(0, 1),
          ];
        } else if (queryLower.includes("artist") || queryLower.includes("singer") || queryLower.includes("band")) {
          prioritizedResults = [
            ...(artists || []).slice(0, 4),
            ...(songs || []).slice(0, 4),
            ...(albums || []).slice(0, 1),
            ...(playlists || []).slice(0, 1),
            ...(actualLiveOnly).slice(0, 1).map((l) => ({ ...l, fromLiveShelf: true })),
            ...(videos || []).slice(0, 1).map((v) => ({ ...v, fromVideosShelf: true })),
          ];
        } else if (queryLower.includes("song") || queryLower.includes("track")) {
          prioritizedResults = [
            ...(songs || []).slice(0, 8),
            ...(artists || []).slice(0, 1),
            ...(albums || []).slice(0, 1),
            ...(playlists || []).slice(0, 1),
            ...(actualLiveOnly).slice(0, 1).map((l) => ({ ...l, fromLiveShelf: true })),
            ...(videos || []).slice(0, 1).map((v) => ({ ...v, fromVideosShelf: true })),
          ];
        } else {
          // Default: Interleave everything including albums, playlists, and users
          prioritizedResults = [
            ...(artists || []).slice(0, 2),
            ...(songs || []).slice(0, 5),
            ...userItems.slice(0, 2),
            ...(albums || []).slice(0, 2),
            ...(playlists || []).slice(0, 2),
            ...(actualLiveOnly).slice(0, 2).map((l) => ({ ...l, fromLiveShelf: true })),
            ...(videos || []).slice(0, 2).map((v) => ({ ...v, fromVideosShelf: true })),
          ];
        }

        setSearchResults(prioritizedResults);
      } else {
        const typeMap: Record<string, string> = {
          Songs: "songs",
          Videos: "videos",
          Live: "live",
          Artists: "artists",
          Albums: "albums",
          Playlists: "playlists",
          Users: "users",
          Remixes: "songs",
        };
        if (cat === "Users") {
          const userRes = await fetch(`/api/user/search?q=${encodeURIComponent(finalQuery)}`, { cache: "no-store" });
          if (runId !== searchRunIdRef.current) return;
          const users = userRes.ok ? (await userRes.json()) as UserSearchItem[] : [];
          setResultsByCategory(prev => ({ ...prev, [cat]: users as any[] }));
          setSearchResults(users.map((user, idx) => ({
            type: "USER",
            id: user.email || user.name || `user-${idx}`,
            name: user.name || user.email || "",
            title: user.name || user.email || "",
            author: user.email || "",
            thumbnail: user.avatarUrl || user.image || user.thumbnail || "",
            user,
          })));
          setSearchLoading(false);
          return;
        }

        const results = await fetchType(typeMap[cat] || "songs");
        if (runId !== searchRunIdRef.current) return;

        let finalResults = results;
        const preferUsers = looksLikePersonQuery(finalQuery);
        if (preferUsers) {
          finalResults = [];
        }
        // Live results are already filtered by the API query type
        if (cat === "Live") {
          finalResults = results;
        }

        setResultsByCategory(prev => ({ ...prev, [cat]: results }));
        setSearchResults(finalResults);
        const userRes = await fetch(`/api/user/search?q=${encodeURIComponent(finalQuery)}`, { cache: "no-store" });
        if (userRes.ok) {
          const users = (await userRes.json()) as UserSearchItem[];
          if (runId !== searchRunIdRef.current) return;
          setUserResults(users.slice(0, 5));
        } else {
          setUserResults([]);
        }
      }
      lastSearchedQueryRef.current = query;
    } catch (error) {
      console.error("Search failed:", error);
      setSearchResults([]);
      setResultsByCategory({});
    } finally {
      setSearchLoading(false);
    }
  }, []);

  // Handle query from URL (?q=) — watch URLs play via playFromWatchUrl inside runSearch
  const searchParams = useSearchParams();
  useEffect(() => {
    const q = searchParams.get("q");
    if (!q) return;
    setSearchQuery(q);
    setActiveCategory("Top");
    setSelectedCategoryTitle(null);
    setSelectedCategoryData([]);
    void runSearch(q, "Top");
  }, [searchParams, runSearch]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setUserResults([]);
      setResultsByCategory({});
    }
  }, [searchQuery]);

  const mappedSongs: any[] = searchResults.map((item: SearchResultItem, idx) => {
    // Standardize to a common UI item shape
    if (item.type === "USER") {
      return {
        id: item.id || `user-${idx}`,
        title: item.title || item.name || "User",
        artist: item.author || "User",
        artwork: item.thumbnail,
        duration: "",
        color: "var(--art-accent, #FA243C)",
        type: "USER",
        user: item.user,
      };
    }
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
    if (item.type === "ALBUM") {
      return {
        id: item.id || `album-${idx}`,
        title: item.title,
        artist: `Album · ${item.author || "Unknown Artist"}`,
        artwork: item.thumbnail,
        duration: "",
        color: "var(--art-accent, #FA243C)",
        type: "ALBUM"
      };
    }
    return {
      id: item.videoId || `search-${idx}`,
      title: item.title,
      artist: item.author,
      artwork: item.thumbnail,
      duration: item.duration,
      color: songColors[item.videoId] || "var(--art-accent, #FA243C)",
      type: activeCategory === "Videos" ? "VIDEO" : (activeCategory === "Live" || item.isLive || item.fromLiveShelf ? "VIDEO" : "SONG"),
      views: item.views,
      isLive: isActuallyLiveStream(item),
      isDirectLink: true,
      preferVideoPlayback: activeCategory === "Videos" || activeCategory === "Live" || (activeCategory === "Top" && (!!item.fromVideosShelf || !!item.fromLiveShelf)) || item.isLive || (item.duration === "LIVE"),
    };
  });

  useEffect(() => {
    let isCancelled = false;
    async function hydrateSongColors() {
      const updates: Record<string, string> = {};
      for (const item of searchResults) {
        const id = "videoId" in item ? item.videoId : item.id;
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
      {isInputFocused && (
        <div 
          className="fixed inset-0 z-40 bg-transparent" 
          onClick={() => setIsInputFocused(false)} 
        />
      )}
      <div className="flex w-full flex-col px-6 py-10 md:px-12 md:py-12 pb-48 text-left">
        {showJamView ? (
          <div className="flex flex-col h-full min-h-[60vh]">
            <button
              type="button"
              onClick={() => setShowJamView(false)}
              className="mb-6 flex items-center gap-2 self-start text-[11px] font-black uppercase tracking-[0.2em] text-white/40 hover:text-white transition-colors"
            >
              <ArrowLeft size={14} />
              Back to Explore
            </button>
            <JamSession />
          </div>
        ) : (
        <>
        {!selectedCategoryTitle && (
          <div className={`transition-[padding-right] duration-[450ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isRightSidebarOpen ? "lg:pr-[380px]" : "lg:pr-0"
          }`}>
          <div className="flex items-center justify-between mb-8 md:mb-12">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tighter leading-none drop-shadow-2xl">Explore</h1>
            <button
              onClick={onClose}
              className="md:hidden font-bold text-lg px-4 py-2 bg-white/5 rounded-full"
              style={{ color: 'var(--art-accent, #FA243C)' }}
            >
              Done
            </button>
          </div>

          <m.div 
            initial={false}
            animate={{ y: 0, opacity: 1 }} 
            className="mb-8 w-full animate-gpu relative z-50"
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setActiveCategory("Top");
                void runSearch(searchQuery, "Top");
                setIsInputFocused(false);
              }}
              className="relative flex items-center w-full rounded-2xl bg-black/20 hover:bg-white/5 border border-white/10 px-4 md:px-8 py-5 md:py-7 focus-within:bg-black/40 focus-within:border-white/30 shadow-2xl backdrop-blur-md transition-colors duration-300"
            >
              <Search className="w-6 h-6 md:w-8 md:h-8 text-white/40 mr-4 md:mr-6" />
              <input
                type="text"
                placeholder="Artists, Songs, Lyrics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsInputFocused(true)}
                className="flex-1 bg-transparent text-xl md:text-3xl font-black text-white placeholder:text-white/20 focus:outline-none tracking-tight"
                autoFocus
              />
              {searchQuery && (
                 <button type="button" onClick={() => setSearchQuery("")} className="text-white/20 hover:text-white p-1 mr-2">
                   <X className="w-5 h-5 md:w-6 md:h-6" />
                 </button>
              )}
              <button 
                type="button" 
                onClick={handleMusicIdentifier}
                className={`p-2.5 rounded-full ${isListening ? "text-white animate-pulse" : "bg-white/5 text-white/40 hover:text-white hover:bg-white/10"}`}
                style={{ backgroundColor: isListening ? 'var(--art-accent, #FA243C)' : undefined }}
              >
                <Mic className="w-5 h-5 md:w-6 md:h-6" />
              </button>
            </form>

            {/* Search Suggestions Dropdown */}
            <AnimatePresence>
              {isInputFocused && searchQuery.trim() && (textSuggestions.length > 0 || richResults.length > 0) && (
                <m.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={MOTION_CONFIG.transition}
                  className="absolute left-0 right-0 mt-3 bg-[#1C1C1E] rounded-3xl overflow-hidden shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)] border border-white/10 z-50 py-4 max-h-[60vh] overflow-y-auto no-scrollbar animate-gpu"
                >
                  {/* Autocomplete suggestions */}
                  {textSuggestions.map((suggestion, idx) => (
                    <button
                      key={`suggest-${idx}`}
                      type="button"
                      onClick={() => {
                        setSearchQuery(suggestion);
                        setActiveCategory("Top");
                        void runSearch(suggestion, "Top");
                        setIsInputFocused(false);
                      }}
                      className="w-full flex items-center gap-4 px-6 py-3 hover:bg-white/5 text-white transition-colors text-left"
                    >
                      <Search size={18} className="text-white/40 shrink-0" />
                      <span className="text-[17px] font-bold truncate">{suggestion}</span>
                    </button>
                  ))}

                  {/* Rich results (Songs / Videos / Artists / Albums / Playlists / Users) */}
                  {richResults.length > 0 && (
                    <div className="border-t border-white/5 mt-3 pt-3">
                      <div className="px-6 text-[11px] font-black uppercase tracking-wider text-white/20 mb-2">Top Suggestions</div>
                      {richResults.map((item, idx) => (
                        <div
                          key={`rich-suggest-${item.youtubeId}-${idx}`}
                          onClick={() => {
                            if (item.type === "artist") {
                              if (onNavigateArtist) {
                                onNavigateArtist(item.title);
                              } else {
                                router.push(`/artist/${encodeURIComponent(item.title)}`);
                              }
                              setIsInputFocused(false);
                              return;
                            }
                            if (item.type === "album") {
                              router.push(`/album/${item.youtubeId}`);
                              setIsInputFocused(false);
                              return;
                            }
                            if (item.type === "playlist") {
                              router.push(`/playlists/${item.youtubeId}`);
                              setIsInputFocused(false);
                              return;
                            }
                            if (item.type === "user") {
                              router.push(`/stats?user=${encodeURIComponent((item.user?.email || item.user?.name || "").split("@")[0])}`);
                              setIsInputFocused(false);
                              return;
                            }
                            onSongSelect({
                              id: item.youtubeId,
                              title: item.title,
                              artist: item.artists.join(", "),
                              artwork: item.thumbnailUrl,
                              duration: "0:00",
                              color: searchAccentColor,
                              preferVideoPlayback: item.type === "video",
                            });
                            setIsInputFocused(false);
                          }}
                          className="px-2"
                        >
                          <div className="flex items-center gap-4 px-4 py-2.5 rounded-2xl hover:bg-white/5 transition-all cursor-pointer group">
                            <div className={`relative w-12 h-12 ${(item.type === "artist" || item.type === "user") ? "rounded-full" : "rounded-lg"} overflow-hidden shrink-0 shadow-lg`}>
                              <MusicArtwork
                                src={item.thumbnailUrl}
                                alt={item.title}
                                iconSize={20}
                                variant={(item.type === "artist" || item.type === "user") ? "artist" : "track"}
                                rounded={(item.type === "artist" || item.type === "user") ? "full" : "md"}
                                className="h-full w-full"
                              />
                            </div>
                            <div className="flex-1 min-w-0 pr-2">
                              <h4 className="text-[16px] font-bold text-white truncate leading-tight mb-0.5">{item.title}</h4>
                              <p className="text-[12px] text-white/40 font-medium truncate capitalize">
                                {item.type === "artist" ? "Artist" : item.type === "album" ? "Album" : item.type === "playlist" ? "Playlist" : item.type === "user" ? "User" : item.artists.join(", ")}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </m.div>
              )}
            </AnimatePresence>

            {/* Best Result Card */}
            {activeCategory === "Top" && mappedSongs.length > 0 && !searchLoading && (
              <div className="w-full mb-6 mt-6">
                <div 
                  onClick={() => {
                    const song = mappedSongs[0];
                    if (song.type === "ARTIST") {
                      onNavigateArtist?.(song.title);
                      return;
                    }
                    if (song.type === "PLAYLIST") {
                      router.push(`/playlists/${song.id}`);
                      return;
                    }
                    if (song.type === "ALBUM") {
                      router.push(`/album/${song.id}`);
                      return;
                    }
                    if (song.type === "USER") {
                      router.push(`/stats?user=${encodeURIComponent((song.user?.email || song.user?.name || "").split("@")[0])}`);
                      return;
                    }
                    // Play song
                    void (async () => {
                      const highResArtwork = song.artwork?.replace(/([=|-][swh])\d+/g, '$11200') || song.artwork;
                      const dynamicColor = songColors[song.id] || (await extractDominantColor(song.artwork)) || song.color;
                      onSongSelect({ ...song, artwork: highResArtwork, color: dynamicColor });
                    })();
                  }}
                  className="group flex items-center justify-between p-6 rounded-3xl bg-black/20 hover:bg-white/5 border border-white/10 hover:border-white/20 transition-all duration-300 cursor-pointer shadow-2xl relative overflow-hidden backdrop-blur-md"
                >
                  <div className="flex items-center gap-6 flex-1 min-w-0">
                    <div className={`relative h-24 w-24 md:h-32 md:w-32 shrink-0 overflow-hidden ${mappedSongs[0].type === "ARTIST" || mappedSongs[0].type === "USER" ? "rounded-full" : "rounded-2xl"} shadow-xl border border-white/10`}>
                      <MusicArtwork
                        src={mappedSongs[0].artwork?.replace(/([=|-][swh])\d+/g, "$1600") || mappedSongs[0].artwork}
                        alt={mappedSongs[0].title}
                        iconSize={36}
                        variant={mappedSongs[0].type === "ARTIST" || mappedSongs[0].type === "USER" ? "artist" : "track"}
                        rounded={mappedSongs[0].type === "ARTIST" || mappedSongs[0].type === "USER" ? "full" : "2xl"}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="flex flex-col min-w-0 pr-4">
                      <h3 className="text-2xl md:text-4xl font-black text-white leading-tight tracking-tight mb-2 group-hover:text-white transition-colors">{mappedSongs[0].title}</h3>
                      <p className="text-[14px] md:text-[16px] font-black uppercase tracking-widest text-white/40">
                        {mappedSongs[0].type === "ARTIST" ? "Artist" : mappedSongs[0].type === "USER" ? "User" : mappedSongs[0].type === "ALBUM" ? "Album" : mappedSongs[0].type === "PLAYLIST" ? "Playlist" : mappedSongs[0].artist}
                      </p>
                    </div>
                  </div>
                  {(mappedSongs[0].type === "SONG" || mappedSongs[0].type === "VIDEO") && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        const song = mappedSongs[0];
                        void (async () => {
                          const highResArtwork = song.artwork?.replace(/([=|-][swh])\d+/g, '$11200') || song.artwork;
                          const dynamicColor = songColors[song.id] || (await extractDominantColor(song.artwork)) || song.color;
                          onSongSelect({ ...song, artwork: highResArtwork, color: dynamicColor });
                        })();
                      }}
                      className="h-14 w-14 rounded-full bg-white text-black flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-transform shrink-0"
                    >
                      <Play size={24} className="ml-1" fill="currentColor" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Categories */}
            {searchQuery.trim() && (
              <div className="flex gap-2.5 mt-8 overflow-x-auto no-scrollbar pb-2">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => {
                      setActiveCategory(cat);
                      const q = searchQuery.trim();
                      if (!q) return;

                      // Instantly show cached results from the last dynamic run if same query
                      const isSameQuery = q === lastSearchedQueryRef.current;
                      if (isSameQuery) {
                        if (cat === "Top") {
                          if (resultsByCategory.Songs || resultsByCategory.Videos || resultsByCategory.Artists) {
                            setSearchResults([
                              ...(resultsByCategory.Artists || []).slice(0, 2),
                              ...(resultsByCategory.Songs || []).slice(0, 6),
                              ...(resultsByCategory.Videos || []).slice(0, 4).map((v) => ({ ...v, fromVideosShelf: true })),
                            ]);
                            return;
                          }
                        } else if (cat === "Users") {
                          const rawUsers = (resultsByCategory.Users || []) as any[];
                          setSearchResults(rawUsers);
                          return;
                        } else if (resultsByCategory[cat]) {
                          setSearchResults(resultsByCategory[cat]);
                          return;
                        }
                      }

                      void runSearch(q, cat);
                    }}
                    className={`px-6 py-3 rounded-full border text-[13px] font-bold tracking-wide capitalize transition-all backdrop-blur-md ${
                      activeCategory === cat 
                      ? "bg-white/10 text-white border-white/30 shadow-lg" 
                      : "bg-transparent text-white/50 border-white/10 hover:border-white/30 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </m.div>
          </div>
        )}

        {selectedCategoryTitle && !searchQuery && !identifiedSong ? (
          <div className="w-full py-8 animate-gpu flex flex-col gap-12">
            <div className={`flex items-center gap-4 mb-4 transition-[padding-right] duration-[450ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isRightSidebarOpen ? "lg:pr-[380px]" : "lg:pr-0"
            }`}>
               <button onClick={() => { setSelectedCategoryTitle(null); setSelectedCategoryData([]); }} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors"><ChevronLeft size={24} /></button>
               <h2 className="text-[32px] md:text-[40px] font-black text-white tracking-tighter leading-none">{selectedCategoryTitle}</h2>
            </div>
            
            {categoryLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                 <div key={i} className="w-full">
                   <div className="w-48 h-8 bg-white/10 rounded-lg animate-pulse mb-6"></div>
                   <div className="flex gap-4 overflow-hidden">
                     {Array.from({ length: 5 }).map((_, j) => (
                       <div key={j} className="w-[160px] md:w-[200px] shrink-0">
                         <div className="w-full aspect-square bg-white/5 rounded-xl animate-pulse mb-3"></div>
                         <div className="w-3/4 h-4 bg-white/5 rounded mt-2"></div>
                         <div className="w-1/2 h-3 bg-white/5 rounded mt-2"></div>
                       </div>
                     ))}
                   </div>
                 </div>
              ))
            ) : (
              selectedCategoryData.map((shelf, i) => (
                <CategoryShelf key={i} shelf={shelf} isRightSidebarOpen={isRightSidebarOpen} />
              ))
            )}
          </div>
        ) : !searchQuery && !identifiedSong ? (
          <m.div 
            initial={false}
            animate={{ y: 0, opacity: 1 }} 
            className={`w-full py-8 animate-gpu flex flex-col gap-12 transition-[padding-right] duration-[450ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isRightSidebarOpen ? "lg:pr-[380px]" : "lg:pr-0"
            }`}
          >
             {exploreLoading ? (
               // Loading Skeletons
               Array.from({ length: 2 }).map((_, i) => (
                 <div key={i} className="w-full">
                   <div className="w-48 h-8 bg-white/10 rounded-lg animate-pulse mb-6"></div>
                   <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
                     {Array.from({ length: 6 }).map((_, j) => (
                       <div key={j} className="aspect-[2/1] md:aspect-[5/3] w-full bg-white/5 rounded-xl animate-pulse"></div>
                     ))}
                   </div>
                 </div>
               ))
             ) : (
               <>
                 <div className="w-full mb-8">
                   <button
                     onClick={() => {
                       if (window.innerWidth >= 1024) {
                         setRightSidebarMode("jam");
                         setIsRightSidebarOpen(true);
                         onClose();
                       } else {
                         setShowJamView(true);
                       }
                     }}
                     className="w-full flex items-center p-6 aspect-[2.5/1] md:aspect-[5/1] rounded-2xl relative shadow-[0_4px_20px_rgba(0,0,0,0.5)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 overflow-hidden bg-white group"
                   >
                     <div className="absolute inset-0 bg-gradient-to-br from-white via-[#f0f0f0] to-[#e0e0e0] z-0" />
                     <div className="relative z-10 text-left flex flex-row items-center w-full justify-between">
                       <div className="flex-1">
                         <h3 className="text-[24px] md:text-[28px] font-black tracking-tighter text-black leading-tight mb-1">Create a Jam</h3>
                         <p className="text-[13px] md:text-[15px] font-bold text-black/60">Host or join a synced session</p>
                       </div>
                       <div className="w-12 h-12 rounded-full bg-black flex items-center justify-center shadow-xl shrink-0 group-hover:scale-110 transition-transform">
                         <Users size={20} className="text-white" />
                       </div>
                     </div>
                   </button>
                 </div>
                 {exploreSections.map((section) => (
                 <div key={section.title} className="w-full">
                   <h2 className="text-[24px] md:text-[32px] font-black text-white tracking-tighter leading-none mb-6">{section.title}</h2>
                   <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
                     {section.items.map((item: any) => (
                       <button
                         key={item.name}
                         onClick={() => {
                           if (item.browseId) {
                             setSelectedCategoryTitle(item.name);
                             setCategoryLoading(true);
                             setSearchQuery("");
                             fetch(`/api/explore/category?browseId=${item.browseId}&params=${item.params || ''}`)
                               .then(res => res.json())
                               .then(data => {
                                 if (data.shelves) setSelectedCategoryData(data.shelves);
                               })
                               .catch(err => console.error(err))
                               .finally(() => setCategoryLoading(false));
                           } else {
                             setSearchQuery(item.name);
                             void runSearch(item.name);
                           }
                         }}
                         className="relative flex aspect-[2/1] md:aspect-[5/3] w-full overflow-hidden rounded-xl p-4 md:p-5 transition-transform hover:scale-[1.02] active:scale-95 shadow-lg group"
                         style={{ backgroundColor: item.color }}
                       >
                         <span className="text-xl md:text-2xl font-black text-white text-left break-words max-w-[80%] leading-tight drop-shadow-md z-10">
                           {item.name}
                         </span>
                         <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-black/30 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
                       </button>
                     ))}
                   </div>
                 </div>
               ))}
               </>
             )}
          </m.div>
        ) : null}

        {identifiedSong && !searchQuery && (
           <div className={`transition-[padding-right] duration-[450ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
             isRightSidebarOpen ? "lg:pr-[380px]" : "lg:pr-0"
           }`}>
             <div className="mb-10 p-6 rounded-3xl bg-white/5 border border-white/5 animate-in fade-in slide-in-from-top-4">
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
           </div>
        )}

        {searchQuery && (
          <m.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            transition={MOTION_CONFIG.transition} 
            className={`w-full max-w-5xl animate-gpu transition-[padding-right] duration-[450ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isRightSidebarOpen ? "lg:pr-[380px]" : "lg:pr-0"
            }`}
          >
            <h2 className="text-[32px] md:text-[40px] font-black text-white tracking-tighter mb-8 px-1 drop-shadow-xl">
              {searchLoading ? "Finding..." : activeCategory === "Top" ? "Top Results" : activeCategory}
            </h2>
            <div className="flex flex-col gap-2">
              {(activeCategory === "Top" ? mappedSongs.slice(1) : mappedSongs).map((song, index) => (
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
                    initial={false}
                    animate={{ opacity: 1, x: 0 }}
                    onContextMenu={(e) => {
                      if (song.type === "ARTIST" || song.type === "USER") return;
                      e.preventDefault();
                      setOpenMenuId(song.id);
                    }}
                    data-song-id={song.id}
                    data-song-title={song.title}
                    data-song-artist={song.artist}
                    data-song-artwork={song.artwork || ""}
                    data-song-duration={song.duration || ""}
                    className="group flex cursor-pointer items-center justify-between p-3 px-4 rounded-2xl bg-black/20 hover:bg-white/10 backdrop-blur-md border border-white/10 hover:translate-x-2 transition-all duration-300 animate-gpu shadow-lg"
                    onClick={() => {
                      if (song.type === "ARTIST") {
                        onNavigateArtist?.(song.title);
                        return;
                      }
                      if (song.type === "PLAYLIST") {
                        window.location.href = `/playlists/${song.id}`;
                        return;
                      }
                      if (song.type === "ALBUM") {
                        window.location.href = `/album/${song.id}`;
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
                        <MusicArtwork
                          src={song.artwork?.replace(/([=|-][swh])\d+/g, "$1600") || song.artwork}
                          alt={song.title}
                          iconSize={28}
                          variant={song.type === "ARTIST" ? "artist" : "track"}
                          rounded={song.type === "ARTIST" ? "full" : "xl"}
                          className="h-full w-full"
                        />
                      </div>
                      <div className="flex flex-col flex-1 min-w-0 pr-4">
                        <p className="truncate text-[20px] font-black text-white leading-none mb-2 tracking-tight">{song.title}</p>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {song.isLive || song.duration === "LIVE" ? (
                              <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider leading-none px-1.5 py-0.5 rounded-md border" style={{ color: '#ffffff', borderColor: '#ff000066', background: '#ff0000cc' }}>
                                LIVE
                              </span>
                            ) : song.preferVideoPlayback && (
                              <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider leading-none px-1.5 py-0.5 rounded-md border" style={{ color: 'var(--art-accent,#FA243C)', borderColor: 'var(--art-accent,#FA243C)44', background: 'var(--art-accent,#FA243C)18' }}>
                                <Video size={9} />MV
                              </span>
                            )}
                            <p onClick={(e) => { e.stopPropagation(); onNavigateArtist?.(song.artist); }} className="truncate text-[12px] font-black uppercase tracking-widest text-white/40 hover:text-white cursor-pointer transition-colors">
                              {song.artist}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 3-dot Menu Button */}
                    {song.type !== "ARTIST" && song.type !== "USER" && song.type !== "ALBUM" && song.type !== "PLAYLIST" && (
                      <div className="relative shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(openMenuId === song.id ? null : song.id);
                          }}
                          className="p-2 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                        >
                          <MoreHorizontal size={20} />
                        </button>
                        
                        {openMenuId === song.id && (
                          <SongMenu
                            song={song}
                            isOpen={openMenuId === song.id}
                            onClose={() => setOpenMenuId(null)}
                            onAddToQueue={() => {
                              onAddToQueue?.(song);
                              setOpenMenuId(null);
                            }}
                            onPlayNext={() => {
                              onPlayNext?.(song);
                              setOpenMenuId(null);
                            }}
                            onLike={() => {
                              onRateSong?.(song.id, songIsInLikedLibrary(song.id) ? "none" : "like");
                              setOpenMenuId(null);
                            }}
                            isLiked={songIsInLikedLibrary(song.id)}
                            onViewInfo={() => {
                              setInfoSong(song);
                              setOpenMenuId(null);
                            }}
                          />
                        )}
                      </div>
                    )}
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
        </>
        )}
      {/* View Song Info Modal */}
      <AnimatePresence>
        {infoSong && (
          <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
            {/* Backdrop */}
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setInfoSong(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            {/* Content Card */}
            <m.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#1C1C1E] p-6 shadow-2xl text-left z-10"
            >
              <h3 className="text-2xl font-black text-white mb-6">Song Information</h3>
              <div className="flex items-center gap-4 mb-6">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-white/10 shadow-lg">
                  <MusicArtwork src={infoSong.artwork} alt={infoSong.title} iconSize={24} variant="track" rounded="xl" className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-lg font-black text-white truncate">{infoSong.title}</h4>
                  <p className="text-sm font-bold text-white/50 truncate mt-0.5">{infoSong.artist}</p>
                </div>
              </div>
              <div className="space-y-3.5 text-sm font-bold border-t border-white/5 pt-4">
                <div className="flex justify-between">
                  <span className="text-white/40">Video ID</span>
                  <span className="font-mono text-white/80 select-all">{infoSong.id}</span>
                </div>
                {infoSong.duration && (
                  <div className="flex justify-between">
                    <span className="text-white/40">Duration</span>
                    <span className="text-white/80">{infoSong.duration}</span>
                  </div>
                )}
                {(infoSong as any).views && (
                  <div className="flex justify-between">
                    <span className="text-white/40">Views</span>
                    <span className="text-white/80">{formatCount((infoSong as any).views)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-white/40">Play Mode</span>
                  <span className="text-white/80">{infoSong.preferVideoPlayback ? "Video Mode (MV)" : "Audio Mode"}</span>
                </div>
              </div>
              <button
                onClick={() => setInfoSong(null)}
                className="mt-8 w-full py-3.5 rounded-2xl bg-white text-black font-black hover:scale-[1.02] active:scale-95 transition-transform"
              >
                Close
              </button>
            </m.div>
          </div>
        )}
      </AnimatePresence>
      </div>
    </m.div>
  );
}







