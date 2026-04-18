"use client";

import { useEffect, useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { MusicArtwork } from "./MusicArtwork";
import { 
  Play, Loader2, Music2, Heart, Plus, Sparkles, 
  Search, Filter, History, ListPlus, PlaySquare
} from "lucide-react";
import { type YouTubePlaylist } from "@/lib/youtubeData";
import { youtubeApiFetchInit } from "@/lib/youtubeClientFetch";
import { readLibraryCache, writeLibraryCache } from "@/lib/youtubeLibraryCache";
import { type Song } from "./types";
import { CreatePlaylistModal, AiPlaylistModal, LibraryHistoryPane } from "./LibraryModals";
import { m, AnimatePresence } from "motion/react";
import { APPLE_EASE, SLIDE_UP_VARIANTS, MOTION_CONFIG } from "@/lib/animations";

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
  const [activeTab, setActiveTab] = useState<LibraryTab>("playlists");
  const [searchQuery, setSearchQuery] = useState("");
  
  const [playlists, setPlaylists] = useState<YouTubePlaylist[]>([]);
  const [likedSongs, setLikedSongs] = useState<any[]>([]);
  const [ytHistory, setYtHistory] = useState<any[]>([]);
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
        const [pRes, lRes, hRes] = await Promise.all([
          fetch("/api/youtube/playlists", init),
          fetch("/api/youtube/liked", init),
          fetch("/api/youtube/history", init),
        ]);

        let quotaHit = false;
        let showedCache = false;

        if (pRes.ok) {
          const list = await pRes.json();
          const arr = Array.isArray(list) ? list : [];
          setPlaylists(arr);
          writeLibraryCache("playlists", arr);
        } else {
          const errBody = await pRes.json().catch(() => ({}));
          if (pRes.status === 503 && errBody?.error === "quotaExceeded") {
            quotaHit = true;
            const cached = readLibraryCache<YouTubePlaylist[]>("playlists");
            if (cached?.length) {
              setPlaylists(cached);
              showedCache = true;
            } else {
              setPlaylists([]);
            }
          } else {
            setPlaylists([]);
          }
        }

        if (lRes.ok) {
          const tracks = await lRes.json();
          const arr = Array.isArray(tracks) ? tracks : [];
          setLikedSongs(arr);
          writeLibraryCache("liked", arr);
        } else {
          const errBody = await lRes.json().catch(() => ({}));
          if (lRes.status === 503 && errBody?.error === "quotaExceeded") {
            quotaHit = true;
            const cached = readLibraryCache<unknown[]>("liked");
            if (cached?.length) {
              setLikedSongs(cached);
              showedCache = true;
            } else {
              setLikedSongs([]);
            }
          } else {
            setLikedSongs([]);
          }
        }

        if (hRes.ok) {
          const hData = await hRes.json();
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
            const cached = readLibraryCache<{
              tracks?: unknown[];
              source?: string;
              ytmBrowseAvailable?: boolean;
            }>("history");
            if (cached?.tracks && Array.isArray(cached.tracks) && cached.tracks.length) {
              setYtHistory(cached.tracks as any[]);
              setHistoryFeedMeta({
                source: typeof cached.source === "string" ? cached.source : "youtube.activities",
                ytmBrowseAvailable: !!cached.ytmBrowseAvailable,
              });
              showedCache = true;
            } else {
              setYtHistory([]);
              setHistoryFeedMeta(null);
            }
          } else {
            setYtHistory([]);
            setHistoryFeedMeta(null);
          }
        }

        if (quotaHit) {
          setError(
            showedCache
              ? "YouTube Data API quota exceeded for today. Showing the last synced library from this browser until the quota resets."
              : "YouTube Data API quota exceeded for today. Playlists and likes can’t load until the quota resets (usually midnight Pacific Time), or increase quota in Google Cloud Console."
          );
        }
      } catch {
        setError("Failed to sync library data.");
      } finally {
        setLoading(false);
      }
    }
    if (session?.accessToken) loadLibrary();
  }, [session?.accessToken]);

  const filteredPlaylists = useMemo(() => 
    playlists.filter(p => (p.title || "").toLowerCase().includes(searchQuery.toLowerCase())),
    [playlists, searchQuery]
  );

  const filteredLiked = useMemo(() => 
    likedSongs.filter(s => (s.title?.toLowerCase() || "").includes(searchQuery.toLowerCase()) || (s.artist?.toLowerCase() || "").includes(searchQuery.toLowerCase())),
    [likedSongs, searchQuery]
  );

  const historySubtitle = useMemo(() => {
    if (!historyFeedMeta) return null;
    if (historyFeedMeta.source === "youtube.ytm_browse") return "YouTube Music history";
    if (historyFeedMeta.source === "youtube.mixed") return "YouTube Music history · merged with channel activity";
    return "Recent music activity on your channel";
  }, [historyFeedMeta]);

  const unifiedHistory = useMemo(() => {
    const local = playedHistory.map(s => ({ ...s, source: "App" as const }));
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
  }, [playedHistory, ytHistory, searchQuery, accentColor, historyFeedMeta?.source]);

  const headerSurfaceStyle = {
    backgroundColor: `color-mix(in srgb, ${accentColor} 14%, rgb(10, 10, 12))`,
    borderBottomColor: `color-mix(in srgb, ${accentColor} 28%, rgba(255,255,255,0.06))`,
  } as const;

  if (!session?.accessToken) {
    return (
      <div
        className="flex-1 flex flex-col items-center justify-center p-8 text-center min-h-[50vh]"
        style={{
          backgroundColor: `color-mix(in srgb, ${accentColor} 16%, rgb(6, 6, 8))`,
        }}
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
    <div className="flex-1 h-full flex flex-col bg-transparent">
      <header
        className="px-6 pt-8 pb-4 md:px-8 md:pt-10 md:pb-6 lg:px-12 border-b sticky top-0 z-20 backdrop-blur-md backdrop-saturate-150"
        style={headerSurfaceStyle}
      >
        <div className="max-w-[1600px] mx-auto space-y-6 md:space-y-8">
           <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6">
              <div>
                 <h1 className="text-3xl md:text-4xl lg:text-[44px] font-black text-white tracking-tighter leading-none mb-2 md:mb-4">Library</h1>
                 <p className="text-white/30 font-bold uppercase tracking-[0.2em] text-[10px] md:text-[11px]">Personal Music Ecosystem</p>
              </div>

              <div className="flex items-center gap-2 md:gap-3">
                 <button 
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 md:px-6 py-2 md:py-2.5 rounded-xl bg-white/5 border border-white/5 text-white font-bold text-xs md:text-sm hover:bg-white/10 transition-all"
                 >
                    <Plus className="w-4 h-4 md:w-5 md:h-5 shrink-0" strokeWidth={3} />
                    <span className="truncate">New Playlist</span>
                 </button>
                 <button 
                    onClick={() => setIsAiModalOpen(true)}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 md:px-6 py-2 md:py-2.5 rounded-xl font-bold text-xs md:text-sm transition-all shadow-inner border"
                    style={{ 
                      backgroundColor: `${accentColor}15`, 
                      borderColor: `${accentColor}30`,
                      color: accentColor 
                    }}
                 >
                    <Sparkles className="w-4 h-4 md:w-5 md:h-5 shrink-0" />
                    <span className="truncate">AI Build</span>
                 </button>
              </div>
           </div>

           <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 md:gap-6">
              <div
                 className="flex w-full sm:w-auto p-1 rounded-xl md:rounded-2xl border overflow-x-auto no-scrollbar"
                 style={{
                   backgroundColor: `color-mix(in srgb, ${accentColor} 10%, rgba(255,255,255,0.03))`,
                   borderColor: `color-mix(in srgb, ${accentColor} 22%, rgba(255,255,255,0.06))`,
                 }}
              >
                 {(["playlists", "history", "liked"] as LibraryTab[]).map(tab => (
                    <button
                       key={tab}
                       onClick={() => setActiveTab(tab)}
                       className={`flex-1 sm:flex-none px-4 md:px-8 py-2 md:py-2.5 rounded-lg md:rounded-xl text-xs md:text-sm font-bold capitalize transition-all duration-300 ${
                          activeTab === tab
                          ? "bg-white text-black shadow-2xl"
                          : "text-white/40 hover:text-white/60"
                       }`}
                    >
                       {tab}
                    </button>
                 ))}
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                 <div className="relative flex-1 sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 w-4 h-4 md:w-5 md:h-5" />
                    <input 
                       value={searchQuery}
                       onChange={e => setSearchQuery(e.target.value)}
                       placeholder={`Search...`}
                       className="w-full bg-white/3 border border-white/5 rounded-xl py-2 md:py-2.5 pl-9 md:pl-10 pr-4 text-xs md:text-sm text-white placeholder:text-white/20 focus:bg-white/5 focus:border-white/10 outline-none transition-all"
                    />
                 </div>
                 <button className="p-2 md:p-2.5 rounded-xl bg-white/3 border border-white/5 text-white/40 hover:text-white transition-all">
                    <Filter className="w-4 h-4 md:w-5 md:h-5" />
                 </button>
              </div>
           </div>
        </div>
      </header>

      <main className="min-h-0 px-6 py-8 md:px-8 md:py-10 lg:px-12 pb-32 md:pb-40 text-left">
        <div className="max-w-[1600px] mx-auto">
           {error && (
              <div
                className="mb-6 md:mb-8 rounded-2xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 md:px-5 md:py-4 text-left text-sm text-amber-50/95 leading-relaxed"
                role="status"
              >
                {error}
              </div>
           )}
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
                       variants={SLIDE_UP_VARIANTS}
                       initial="initial"
                       animate="animate"
                       exit="exit"
                       className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 md:gap-x-8 gap-y-8 md:gap-y-12 animate-gpu"
                    >
                       <div 
                          onClick={() => setActiveTab("liked")}
                          className="group flex flex-col cursor-pointer"
                       >
                           <div 
                              className="relative aspect-square mb-3 md:mb-4 rounded-3xl md:rounded-[28px] overflow-hidden shadow-2xl flex items-center justify-center ring-1 ring-white/10 transition-transform duration-500 hover:scale-[1.03]"
                              style={{ backgroundColor: `color-mix(in srgb, ${accentColor} 55%, #8E2DE2)` }}
                           >
                              <Heart className="w-8 h-8 md:w-16 md:h-16 text-white drop-shadow-xl" fill="white" />
                           </div>
                          <h3 className="text-base md:text-lg font-bold text-white truncate">Liked Songs</h3>
                          <p className="text-xs md:text-sm text-white/30 font-bold uppercase tracking-wider">{likedSongs.length} Tracks</p>
                       </div>

                       {filteredPlaylists.map(playlist => (
                          <div 
                             key={playlist.id} 
                             onClick={() => onPlaylistClick?.(playlist)}
                             className="group flex flex-col cursor-pointer"
                          >
                             <div className="relative aspect-square mb-3 md:mb-4 rounded-3xl md:rounded-[28px] overflow-hidden bg-zinc-900 border border-white/5 shadow-xl transition-all duration-500 hover:scale-[1.03]">
                                <MusicArtwork
                                  src={playlist.thumbnailUrl?.replace("s90", "s600")}
                                  alt={playlist.title}
                                  iconSize={40}
                                  variant="track"
                                  rounded="3xl"
                                />
                             </div>
                             <h3 
                               className="text-sm md:text-[17px] font-bold text-white truncate leading-tight mb-0.5 md:mb-1"
                               style={{ ['--hover-color' as any]: accentColor }}
                             >
                               {playlist.title}
                               <style jsx>{`
                                 h3:hover { color: var(--hover-color); }
                               `}</style>
                             </h3>
                             <p className="text-xs md:text-[14px] text-white/20 font-bold">{playlist.itemCount} Items</p>
                          </div>
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
                       variants={SLIDE_UP_VARIANTS}
                       initial="initial"
                       animate="animate"
                       exit="exit"
                       className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6 animate-gpu"
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
                            <div 
                               key={`liked-${idx}`}
                               onClick={() => {
                                 if (onPlayPlaylist) {
                                   onPlayPlaylist(likedSongsList, idx);
                                 } else {
                                   onSongClick?.(songObj);
                                 }
                               }}
                               className="group flex flex-col cursor-pointer"
                            >
                               <div className="relative aspect-square mb-3 md:mb-4 rounded-3xl md:rounded-[28px] overflow-hidden bg-zinc-900 border border-white/5 shadow-xl transition-all duration-500 hover:scale-[1.03]">
                                  <MusicArtwork
                                    src={track.thumbnailUrl?.replace("s90", "s600")}
                                    alt={track.title}
                                    iconSize={40}
                                    variant="track"
                                    rounded="3xl"
                                  />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-3">
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
                               <h3 className="font-bold text-white truncate text-base md:text-[17px] mb-0.5 md:mb-1 leading-tight">{track.title}</h3>
                               <p className="text-white/30 text-xs md:text-[14px] font-bold truncate">{track.artist}</p>
                            </div>
                          );
                       })}
                    </m.div>
                 )}
              </AnimatePresence>
           )}
        </div>
      </main>

      <CreatePlaylistModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} accentColor={accentColor} />
      <AiPlaylistModal isOpen={isAiModalOpen} onClose={() => setIsAiModalOpen(false)} accentColor={accentColor} />
    </div>
  );
}
