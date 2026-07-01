"use client";

import { useEffect, useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { MusicArtwork } from "./MusicArtwork";
import { 
  Play, Loader2, Music2, Heart, Plus, Sparkles, 
  Search, Filter, History, ListPlus, PlaySquare, Check, X
} from "lucide-react";
import { type YouTubePlaylist } from "@/lib/youtubeData";
import { youtubeApiFetchInit } from "@/lib/youtubeClientFetch";
import { readLibraryCache, writeLibraryCache } from "@/lib/youtubeLibraryCache";
import { type Song } from "./types";
import { CreatePlaylistModal, AiPlaylistModal, LibraryHistoryPane } from "./LibraryModals";
import { m, AnimatePresence } from "motion/react";
import { APPLE_EASE, SLIDE_UP_VARIANTS, MOTION_CONFIG } from "@/lib/animations";
import { useDashboard } from "@/context/DashboardContext";

const CONTAINER_STAGGER = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.03
    }
  }
};

const CARD_VARIANTS = {
  initial: { opacity: 0, y: 16 },
  animate: { 
    opacity: 1, 
    y: 0, 
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const } 
  }
};

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
  const router = useRouter();
  const { isRightSidebarOpen } = useDashboard();
  const [activeTab, setActiveTab] = useState<LibraryTab>("playlists");
  const [searchQuery, setSearchQuery] = useState("");
  
  type SortOrder = "alphabetical" | "newest" | "oldest";
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  
  const [playlists, setPlaylists] = useState<YouTubePlaylist[]>([]);
  const [likedSongs, setLikedSongs] = useState<any[]>([]);
  const [ytHistory, setYtHistory] = useState<any[]>([]);
  const [dbPlayHistory, setDbPlayHistory] = useState<any[]>([]);
  const [historyFeedMeta, setHistoryFeedMeta] = useState<{
    source: string;
    ytmBrowseAvailable: boolean;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  useEffect(() => {
    async function loadLibrary() {
      if (!session?.accessToken) return;
      setLoading(true);
      setError(null);
      try {
        const init = youtubeApiFetchInit(session.accessToken);
        
        // Sync any pending offline actions first
        await fetch("/api/user/sync-pending", { ...init, method: "POST" }).catch(() => {});

        const dbRes = await fetch("/api/user/library", init);
        if (dbRes.ok) {
          const dbData = await dbRes.json();
          if (Array.isArray(dbData.playlists) && dbData.playlists.length) {
            setPlaylists(dbData.playlists);
          }
          if (Array.isArray(dbData.liked) && dbData.liked.length) {
            setLikedSongs(dbData.liked);
          }
          if (dbData.history) {
            const parsedHist = typeof dbData.history === "string" ? JSON.parse(dbData.history) : dbData.history;
            if (Array.isArray(parsedHist.tracks)) {
              setYtHistory(parsedHist.tracks);
            }
            if (parsedHist.source) {
              setHistoryFeedMeta({
                source: parsedHist.source,
                ytmBrowseAvailable: !!parsedHist.ytmBrowseAvailable,
              });
            }
          }
        }

        const statsRes = await fetch("/api/user/stats", init);
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          if (statsData?.recentPlayed && Array.isArray(statsData.recentPlayed)) {
            setDbPlayHistory(statsData.recentPlayed);
          }
        }

        const [pRes, lRes, hRes] = await Promise.all([
          fetch("/api/youtube/playlists", init),
          fetch("/api/youtube/liked", init),
          fetch("/api/youtube/history", init),
        ]);

        let quotaHit = false;
        let showedCache = false;
        const playlistRows = pRes.ok ? await pRes.json() : [];
        const likedRows = lRes.ok ? await lRes.json() : [];
        let hData: any = null;

        if (pRes.ok) {
          const arr = Array.isArray(playlistRows) ? playlistRows : [];
          setPlaylists(arr);
          writeLibraryCache("playlists", arr);
        } else {
          const errBody = await pRes.json().catch(() => ({}));
          if (pRes.status === 503 && errBody?.error === "quotaExceeded") {
            quotaHit = true;
          }
          setPlaylists(prev => {
            if (prev.length > 0) return prev; // Keep DB playlists!
            const cached = readLibraryCache<YouTubePlaylist[]>("playlists");
            if (cached?.length) {
              showedCache = true;
              return cached;
            }
            return [];
          });
        }

        if (lRes.ok) {
          const arr = Array.isArray(likedRows) ? likedRows : [];
          setLikedSongs(arr);
          writeLibraryCache("liked", arr);
        } else {
          const errBody = await lRes.json().catch(() => ({}));
          if (lRes.status === 503 && errBody?.error === "quotaExceeded") {
            quotaHit = true;
          }
          setLikedSongs(prev => {
            if (prev.length > 0) return prev; // Keep DB liked songs!
            const cached = readLibraryCache<unknown[]>("liked");
            if (cached?.length) {
              showedCache = true;
              return cached;
            }
            return [];
          });
        }

        if (hRes.ok) {
          hData = await hRes.json();
          setYtHistory(Array.isArray(hData.tracks) ? hData.tracks : []);
          setHistoryFeedMeta({
            source: typeof hData.source === "string" ? hData.source : "youtube.activities",
            ytmBrowseAvailable: !!hData.ytmBrowseAvailable,
          });
          writeLibraryCache("history", hData);
        } else {
          const errBody = await hRes.json().catch(() => ({}));
          if (hRes.status === 503 && errBody?.error === "quotaExceeded") {
            quotaHit = true;
          }
          setYtHistory(prev => {
            if (prev.length > 0) return prev; // Keep DB history!
            const cached = readLibraryCache<{
              tracks?: unknown[];
              source?: string;
              ytmBrowseAvailable?: boolean;
            }>("history");
            if (cached?.tracks && Array.isArray(cached.tracks) && cached.tracks.length) {
              setHistoryFeedMeta({
                source: typeof cached.source === "string" ? cached.source : "youtube.activities",
                ytmBrowseAvailable: !!cached.ytmBrowseAvailable,
              });
              showedCache = true;
              return cached.tracks as any[];
            }
            return [];
          });
        }

        if (pRes.ok || lRes.ok || hRes.ok) {
          await fetch("/api/user/library", {
            ...init,
            method: "POST",
            headers: {
              ...(init.headers || {}),
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              playlists: Array.isArray(playlistRows) ? playlistRows : [],
              liked: Array.isArray(likedRows) ? likedRows : [],
              history: hRes.ok ? hData : null,
            }),
          });
        }
      } finally {
        setLoading(false);
      }
    }
    if (session?.accessToken) loadLibrary();
  }, [session?.accessToken]);

  const filteredPlaylists = useMemo(() => {
    const list = playlists.filter(p => (p.title || "").toLowerCase().includes(searchQuery.toLowerCase()));
    if (sortOrder === "alphabetical") {
      return [...list].sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    }
    if (sortOrder === "oldest") {
      return [...list].reverse();
    }
    return list;
  }, [playlists, searchQuery, sortOrder]);

  const filteredLiked = useMemo(() => {
    const list = likedSongs.filter(s => (s.title?.toLowerCase() || "").includes(searchQuery.toLowerCase()) || (s.artist?.toLowerCase() || "").includes(searchQuery.toLowerCase()));
    if (sortOrder === "alphabetical") {
      return [...list].sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    }
    if (sortOrder === "oldest") {
      return [...list].reverse();
    }
    return list;
  }, [likedSongs, searchQuery, sortOrder]);

  const historySubtitle = useMemo(() => {
    if (!historyFeedMeta) return null;
    if (historyFeedMeta.source === "youtube.ytm_browse") return "YouTube Music history";
    if (historyFeedMeta.source === "youtube.mixed") return "YouTube Music history - merged with channel activity";
    return "Recent music activity on your channel";
  }, [historyFeedMeta]);

  const unifiedHistory = useMemo(() => {
    const local = dbPlayHistory.map(s => ({ ...s, source: "App" as const }));
    const remoteLabel =
      historyFeedMeta?.source === "youtube.ytm_browse"
        ? ("YT Music" as const)
        : historyFeedMeta?.source === "youtube.mixed"
          ? ("YT Music+" as const)
          : ("YouTube" as const);
    const remote = ytHistory.map((t) => ({
      id: t.videoId,
      title: t.title,
      artist: t.artist,
      artwork: t.thumbnailUrl,
      duration: t.duration || "0:00",
      source: remoteLabel,
      color: accentColor,
    }));

    const seenIds = new Set(local.map(s => s.id));
    const uniqueRemote = remote.filter(s => !seenIds.has(s.id));

    return [...local, ...uniqueRemote].filter(s => 
      (s.title?.toLowerCase() || "").includes(searchQuery.toLowerCase()) || 
      (s.artist?.toLowerCase() || "").includes(searchQuery.toLowerCase())
    );
  }, [dbPlayHistory, ytHistory, searchQuery, accentColor, historyFeedMeta?.source]);

  const firstArtwork = likedSongs.length > 0 ? likedSongs[0].thumbnailUrl : (playlists.length > 0 ? playlists[0].thumbnailUrl : null);

  if (!session?.accessToken) {
    return (
      <div
        className={`flex-1 flex flex-col items-center justify-center p-8 text-center min-h-[60vh] bg-transparent transition-[padding-right] duration-[450ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isRightSidebarOpen ? "lg:pr-[380px]" : "lg:pr-0"
        }`}
      >
        <div 
          className="w-20 h-20 md:w-24 md:h-24 rounded-[32px] flex items-center justify-center mb-10 shadow-2xl"
          style={{ backgroundColor: `color-mix(in srgb, ${accentColor} 75%, #FF5E3A)` }}
        >
          <Music2 className="w-10 h-10 md:w-12 md:h-12 text-white" />
        </div>
        <h2 className="text-3xl md:text-4xl font-black text-white mb-4">Your Music Library</h2>
        <p className="text-white/40 mb-10 max-w-sm text-sm">Connect your Google account to access your playlists and history.</p>
        <button 
          onClick={() => window.location.href = "/api/auth/signin"}
          className="px-10 py-4 bg-white text-black font-bold rounded-full hover:bg-zinc-200 shadow-xl"
        >
          Sign in with Google
        </button>
      </div>
    );
  }

  return (
    <div className={`flex-1 h-full flex flex-col bg-transparent transition-[padding-right] duration-[450ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
      isRightSidebarOpen ? "lg:pr-[380px]" : "lg:pr-0"
    }`}>
      
      <main className="min-h-0 px-6 py-8 md:px-8 md:py-10 lg:px-12 pb-32 md:pb-40 text-left">
        <div className="max-w-[1600px] mx-auto space-y-10">
          
          {/* Awwwards Standard Library Hero Section */}
          <section className="relative rounded-[32px] overflow-hidden flex flex-col lg:flex-row border border-white/5 shadow-[0_20px_60px_rgba(0,0,0,0.5)] group transition-all duration-[450ms]">
            <div className="absolute inset-0 z-0 pointer-events-none">
              <div className="absolute inset-0 bg-gradient-to-tr from-[#0b0b0c] via-[#0d0d0f] to-[#101012]" />
              <div 
                className="absolute inset-0 opacity-10 filter blur-[80px] transition-all duration-[1s]"
                style={{
                  background: `radial-gradient(circle at 70% 30%, ${accentColor}, transparent 70%)`
                }}
              />
            </div>

            <div className="relative z-10 w-full flex flex-col md:flex-row md:items-center justify-between p-6 sm:p-8 lg:p-14 min-h-[260px] gap-6">
              <div className="flex-1 flex flex-col justify-center max-w-2xl">
                <h1 className="text-[44px] sm:text-[60px] lg:text-[72px] font-black tracking-tighter text-white leading-[1.02] drop-shadow-xl">
                  Your Library
                </h1>
                <p className="text-white/40 text-sm font-bold uppercase tracking-widest mt-2">
                  {playlists.length} Playlists • {likedSongs.length} Liked Tracks
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button 
                  onClick={() => setIsCreateModalOpen(true)}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-white text-black hover:bg-white/90 hover:scale-105 active:scale-95 transition-all font-black text-xs uppercase tracking-wider shadow-lg shrink-0"
                >
                  <Plus className="w-4 h-4 shrink-0" strokeWidth={3} />
                  <span>New Playlist</span>
                </button>
                <button 
                  onClick={() => setIsAiModalOpen(true)}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-full hover:scale-105 active:scale-95 transition-all font-black text-xs uppercase tracking-wider shadow-lg shrink-0"
                  style={{ backgroundColor: accentColor, color: '#000' }}
                >
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span>AI Build</span>
                </button>
              </div>
            </div>
          </section>

          {/* Sub-Header segment containing capsule tabs and capsule search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-white/[0.04] pb-6">
            
            {/* Apple/Awwwards segmented control capsule */}
            <div className="flex items-center gap-1.5 p-1.5 bg-black/40 border border-white/5 backdrop-blur-md rounded-2xl w-fit">
              {(["playlists", "liked", "history"] as LibraryTab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`relative px-5 py-2.5 text-xs md:text-sm font-black uppercase tracking-wider transition-colors duration-300 focus:outline-none rounded-xl z-10 ${
                    activeTab === tab
                    ? "text-black"
                    : "text-white/40 hover:text-white/80"
                  }`}
                >
                  <span className="relative z-10">{tab}</span>
                  {activeTab === tab && (
                    <m.div 
                      layoutId="library-active-tab-pill"
                      className="absolute inset-0 rounded-xl"
                      style={{ backgroundColor: accentColor }}
                      transition={{ type: "spring", stiffness: 350, damping: 28 }}
                    />
                  )}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-4 w-full sm:w-auto relative">
              <div className="relative flex-1 sm:w-72 group/search">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within/search:text-white/50 transition-colors w-4 h-4" />
                <input 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={`Search ${activeTab}...`}
                  className="w-full bg-black/20 border border-white/5 focus:border-white/20 rounded-2xl py-3 pl-11 pr-4 text-xs md:text-sm text-white placeholder:text-white/20 outline-none transition-all backdrop-blur-sm"
                />
              </div>
              
              <div className="relative">
                <button 
                  onClick={() => setIsSortMenuOpen(!isSortMenuOpen)}
                  className="p-3 rounded-2xl bg-white/[0.02] border border-white/10 text-white/40 hover:text-white hover:bg-white/[0.06] transition-all flex items-center gap-2"
                  title="Sort order"
                >
                  <Filter className="w-5 h-5" />
                  <span className="hidden md:inline text-xs font-black uppercase tracking-wider text-white/60">
                    {sortOrder === "alphabetical" ? "A-Z" : sortOrder === "newest" ? "Newest" : "Oldest"}
                  </span>
                </button>
                
                {isSortMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsSortMenuOpen(false)} />
                    <div className="absolute right-0 mt-2 w-48 rounded-2xl bg-zinc-950/95 border border-white/10 backdrop-blur-xl shadow-2xl p-2 z-50 flex flex-col gap-1">
                      {(["newest", "oldest", "alphabetical"] as const).map((order) => (
                        <button
                          key={order}
                          onClick={() => {
                            setSortOrder(order);
                            setIsSortMenuOpen(false);
                          }}
                          className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                            sortOrder === order
                              ? "text-black"
                              : "text-white/60 hover:text-white hover:bg-white/[0.04]"
                          }`}
                          style={sortOrder === order ? { backgroundColor: accentColor } : {}}
                        >
                          {order === "newest" ? "Date Added: Newest" : order === "oldest" ? "Date Added: Oldest" : "Alphabetical"}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>



          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 md:py-40 gap-4">
              <Loader2 className="w-8 h-8 md:w-10 md:h-10 animate-spin" style={{ color: accentColor }} />
              <p className="text-white/20 font-bold uppercase tracking-widest text-[9px] md:text-[10px]">Syncing Database...</p>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {activeTab === "playlists" && (
                <m.div 
                  key="playlists-pane"
                  variants={CONTAINER_STAGGER}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-6 gap-y-10 animate-gpu"
                >


                  {filteredPlaylists.map(playlist => (
                    <m.div 
                      variants={CARD_VARIANTS}
                      key={playlist.id} 
                      onClick={() => onPlaylistClick?.(playlist)}
                      className="group flex flex-col cursor-pointer"
                    >
                      <div className="relative aspect-square mb-4 rounded-3xl overflow-hidden bg-zinc-900 border border-white/5 shadow-xl transition-all duration-500">
                        <div className="w-full h-full transition-transform duration-700 ease-out group-hover:scale-[1.06]">
                          <MusicArtwork
                            src={playlist.thumbnailUrl?.replace("s90", "s600")}
                            alt={playlist.title}
                            iconSize={40}
                            variant="track"
                            rounded="none"
                            className="h-full w-full object-cover"
                          />
                        </div>
                      </div>
                      <h3 
                        className="text-base md:text-[17px] font-black text-white truncate tracking-tight mb-0.5 group-hover:text-(--art-accent,#FA243C) transition-colors duration-300"
                        style={{ ['--art-accent' as any]: accentColor }}
                      >
                        {playlist.title}
                      </h3>
                      <p className="text-xs md:text-[14px] text-white/20 font-bold uppercase tracking-wider">{playlist.itemCount} Items</p>
                    </m.div>
                  ))}
                </m.div>
              )}

              {activeTab === "history" && (
                <LibraryHistoryPane
                  key="history-pane"
                  tracks={unifiedHistory}
                  accentColor={accentColor}
                  subtitle={historySubtitle}
                  onPlayPlaylist={onPlayPlaylist}
                  onSongClick={onSongClick}
                  onPlayNext={onPlayNext}
                  onAddToQueue={onAddToQueue}
                />
              )}

              {activeTab === "liked" && (
                <m.div 
                  key="liked-pane"
                  variants={CONTAINER_STAGGER}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 animate-gpu"
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
                       <m.div 
                         variants={CARD_VARIANTS}
                         key={`liked-${idx}`}
                         onClick={() => {
                           if (onPlayPlaylist) {
                             onPlayPlaylist(likedSongsList, idx);
                           } else {
                             onSongClick?.(songObj);
                           }
                         }}
                         data-song-id={songObj.id}
                         data-song-title={songObj.title}
                         data-song-artist={songObj.artist}
                         data-song-artwork={songObj.artwork || ""}
                         data-song-duration={songObj.duration || ""}
                         className="group flex flex-col cursor-pointer"
                       >
                        <div className="relative aspect-square mb-4 rounded-3xl overflow-hidden bg-zinc-900 border border-white/5 shadow-xl transition-all duration-500">
                          <div className="w-full h-full transition-transform duration-700 ease-out group-hover:scale-[1.06]">
                            <MusicArtwork
                              src={track.thumbnailUrl?.replace("s90", "s600")}
                              alt={track.title}
                              iconSize={40}
                              variant="track"
                              rounded="none"
                              className="h-full w-full object-cover"
                            />
                          </div>
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
                        <h3 
                          className="font-black text-white truncate text-base md:text-[17px] mb-0.5 tracking-tight leading-tight group-hover:text-(--art-accent,#FA243C) transition-colors duration-300"
                          style={{ ['--art-accent' as any]: accentColor }}
                        >
                          {track.title}
                        </h3>
                        <p className="text-white/40 text-xs md:text-[14px] font-bold uppercase tracking-wide truncate">{track.artist}</p>
                      </m.div>
                    );
                  })}
                </m.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </main>

      <CreatePlaylistModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} accentColor={accentColor} />
      <m.div key="ai-modal-wrapper" className="relative z-[250]">
        <AiPlaylistModal isOpen={isAiModalOpen} onClose={() => setIsAiModalOpen(false)} accentColor={accentColor} />
      </m.div>
    </div>
  );
}
