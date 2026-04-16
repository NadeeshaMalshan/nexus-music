"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Play, Loader2, Music, RefreshCw, ListPlus, PlaySquare, ChevronLeft, ChevronRight } from "lucide-react";
import { m, AnimatePresence } from "motion/react";
import { APPLE_EASE, FADE_IN_VARIANTS, MOTION_CONFIG } from "@/lib/animations";
import { type Song } from "./types";
import { type YouTubePlaylist } from "@/lib/youtubeData";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { MusicArtwork } from "./MusicArtwork";
import { YouTubeLibrary } from "./YouTubeLibrary";
import { PlaylistDetail } from "./PlaylistDetail";
import { AlbumDetail } from "./AlbumDetail";
import { Settings } from "./Settings";
import { useRouter } from "next/navigation";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CenterPanelProps {
  activeView: string;
  selectedPlaylist?: YouTubePlaylist | null;
  accentColor: string;
  onSongClick?: (song: Song) => void;
  onPlaylistClick?: (playlist: YouTubePlaylist) => void;
  onQueueReplace?: (songs: Song[]) => void;
  currentSongId?: string;
  seed?: string;
  playedHistory?: Song[]; // Added: real history from session
  onAddToQueue?: (song: Song) => void;
  onPlayNext?: (song: Song) => void;
  onPlayPlaylist?: (songs: Song[], startIndex: number) => void;
  onNavigateArtist?: (name: string) => void;
}

type ForYouTrack = {
  title: string;
  artist: string;
  reason: string;
  id?: string;
  artwork?: string;
  duration?: string;
};

type SearchItem = {
  videoId: string;
  title: string;
  author: string;
  duration: string;
  thumbnail: string;
  isLive?: boolean;
};

type PlaylistSearchItem = {
  type: "PLAYLIST";
  id: string;
  title: string;
  author: string;
  thumbnail: string;
};

type ArtistSearchItem = {
  type: "ARTIST";
  id: string;
  name: string;
  thumbnail: string;
};

// ─── Shelf Component ─────────────────────────────────────────────────────────
function Shelf(props: {
  title: string;
  subtitle?: string;
  onRefresh?: () => void;
  loading?: boolean;
  children: React.ReactNode;
}) {
  const { title, subtitle, onRefresh, loading, children } = props;
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = dir === "left" ? -800 : 800;
    scrollRef.current.scrollBy({ left: amount, behavior: "smooth" });
  };

  return (
    <section className="relative group/shelf">
      <div className="mb-6 flex items-center justify-between px-1">
        <div>
          <h2 className="text-[28px] font-black text-white tracking-tight leading-none">{title}</h2>
          {subtitle && <p className="text-[14px] text-zinc-500 mt-2 font-medium">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-4">
          {onRefresh && (
            <button
               onClick={onRefresh}
               disabled={loading}
               className="text-white/40 hover:text-white transition-colors"
            >
               <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            </button>
          )}
          <div className="hidden items-center gap-2 lg:flex opacity-0 group-hover/shelf:opacity-100">
            <button 
              onClick={() => scroll("left")}
              className="p-2 rounded-full bg-[#1c1c1e] hover:bg-[#2c2c2e] text-white"
            >
              <ChevronLeft size={20} />
            </button>
            <button 
              onClick={() => scroll("right")}
              className="p-2 rounded-full bg-[#1c1c1e] hover:bg-[#2c2c2e] text-white"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>

      <div 
        ref={scrollRef}
        className="flex items-start gap-x-8 overflow-x-auto no-scrollbar scroll-smooth px-1 pb-4"
      >
        {children}
      </div>
    </section>
  );
}

// ─── ForYouCard Component ────────────────────────────────────────────────────
function ForYouCard(props: {
  track: ForYouTrack & { id?: string; artwork?: string };
  index: number;
  onPlay: () => void;
  isPlaying: boolean;
  accentColor: string;
  onAddToQueue?: (song: Song) => void;
  onPlayNext?: (song: Song) => void;
  onNavigateArtist?: (name: string) => void;
}) {
  const { track, index, onPlay, isPlaying, accentColor, onAddToQueue, onPlayNext, onNavigateArtist } = props;

  return (
    <m.div
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      className="group relative flex flex-col w-full min-w-0 cursor-pointer"
      onClick={onPlay}
    >
      <div className="relative w-full aspect-square rounded-[22px] overflow-hidden bg-[#161618] shadow-[0_20px_40px_rgba(0,0,0,0.4)] group-hover:shadow-[0_40px_80px_rgba(0,0,0,0.6)]">
        <MusicArtwork
          src={track.artwork?.replace(/([=|-][swh])\d+/g, "$1800")}
          alt={track.title}
          iconSize={36}
          variant="track"
          rounded="3xl"
          className="transition-transform duration-700 group-hover:scale-110"
        />
        
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-4">
           <div className="flex items-center gap-4">
             <button
               onClick={(e) => {
                 e.stopPropagation();
                 onPlayNext?.({
                   id: track.id!,
                   title: track.title,
                   artist: track.artist,
                   artwork: track.artwork || "",
                   duration: track.duration || "",
                   color: accentColor,
                 });
               }}
               className="p-3 rounded-full bg-[#1c1c1e] hover:bg-white text-black transition-all hover:scale-110"
               style={{ color: 'white' }}
             >
               <PlaySquare size={20} />
             </button>
             <button
               onClick={(e) => {
                 e.stopPropagation();
                 onAddToQueue?.({
                   id: track.id!,
                   title: track.title,
                   artist: track.artist,
                   artwork: track.artwork || "",
                   duration: track.duration || "",
                   color: accentColor,
                 });
               }}
               className="p-3 rounded-full bg-[#1c1c1e] hover:bg-white text-black transition-all hover:scale-110"
               style={{ color: 'white' }}
             >
               <ListPlus size={20} />
             </button>
           </div>
           
           <div 
             onClick={onPlay}
             className="w-16 h-16 rounded-full bg-white flex items-center justify-center text-black shadow-2xl hover:scale-105 transition-transform"
           >
             {isPlaying ? (
               <Loader2 size={32} className="animate-spin" />
             ) : (
               <Play size={32} fill="currentColor" className="ml-1" />
             )}
           </div>
        </div>
      </div>

      <div className="mt-4 text-left px-1">
        <h3 className="font-bold text-white text-[17px] tracking-tight line-clamp-2 leading-tight mb-1 h-[42px]">
          {track.title}
        </h3>
        <p 
          onClick={(e) => {
            e.stopPropagation();
            onNavigateArtist?.(track.artist);
          }}
          className="text-[14px] text-white/40 font-medium truncate hover:text-white cursor-pointer"
        >
          {track.artist}
        </p>
        {!!track.reason && (
          <p className="mt-2 text-[12px] text-white/28 font-medium line-clamp-2 leading-snug">
            {track.reason}
          </p>
        )}
      </div>
    </m.div>
  );
}

function SearchCard(props: {
  item: SearchItem;
  index: number;
  accentColor: string;
  badge?: "LIVE" | "VIDEO";
  mediaAspect?: "square" | "video";
  onPlay: () => void;
}) {
  const { item, index, badge, mediaAspect = "square", onPlay } = props;

  return (
    <m.div
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      className="group relative flex flex-col w-full min-w-0 cursor-pointer"
      onClick={onPlay}
    >
      <div
        className={`relative w-full ${mediaAspect === "video" ? "aspect-video" : "aspect-square"} rounded-[22px] overflow-hidden bg-[#161618] shadow-[0_20px_40px_rgba(0,0,0,0.4)] group-hover:shadow-[0_40px_80px_rgba(0,0,0,0.6)]`}
      >
        <MusicArtwork
          src={item.thumbnail}
          alt={item.title}
          iconSize={36}
          variant="track"
          rounded="3xl"
          className="h-full w-full group-hover:scale-110"
        />

        {badge && (
          <div className="absolute top-4 left-4">
            <span
              className={`px-3 py-1 rounded-full text-[11px] font-black tracking-wider border ${
                badge === "LIVE"
                  ? "bg-red-500/15 border-red-400/30 text-red-200"
                  : "bg-[#1c1c1e] border-white/15 text-white/70"
              }`}
            >
              {badge}
            </span>
          </div>
        )}

        <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center text-black shadow-2xl hover:scale-105">
            <Play size={32} fill="currentColor" className="ml-1" />
          </div>
        </div>
      </div>

      <div className="mt-4 text-left px-1">
        <h3 className="font-bold text-white text-[17px] tracking-tight line-clamp-2 leading-tight mb-1 h-[42px]">
          {item.title}
        </h3>
        <p className="text-[14px] text-white/40 font-medium truncate">
          {item.author}
        </p>
        <p className="mt-2 text-[12px] text-white/28 font-medium">
          {item.duration}
        </p>
      </div>
    </m.div>
  );
}

function ArtistRecCard(props: {
  artist: ArtistSearchItem;
  index: number;
  onOpen: () => void;
}) {
  const { artist, index, onOpen } = props;
  return (
    <m.button
      type="button"
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      onClick={onOpen}
      className="group flex w-[160px] sm:w-[180px] shrink-0 flex-col items-center text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 rounded-3xl"
    >
      <div className="relative h-[160px] w-[160px] sm:h-[180px] sm:w-[180px] overflow-hidden rounded-full bg-[#161618] shadow-[0_20px_40px_rgba(0,0,0,0.35)] ring-1 ring-white/10 group-hover:ring-white/25 group-hover:shadow-[0_28px_60px_rgba(0,0,0,0.5)]">
        <MusicArtwork
          src={artist.thumbnail}
          alt={artist.name}
          iconSize={52}
          variant="artist"
          rounded="full"
          className="group-hover:scale-105"
        />
      </div>
      <h3 className="mt-4 line-clamp-2 min-h-[44px] max-w-full px-1 text-[15px] font-bold leading-tight tracking-tight text-white">
        {artist.name}
      </h3>
      <p className="mt-1 text-[12px] font-semibold uppercase tracking-wider text-white/35">Artist</p>
    </m.button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CenterPanel
// ─────────────────────────────────────────────────────────────────────────────
export function CenterPanel(props: CenterPanelProps) {
  const {
    activeView,
    selectedPlaylist,
    accentColor,
    onSongClick,
    onPlaylistClick,
    onQueueReplace,
    currentSongId,
    playedHistory = [],
    onAddToQueue,
    onPlayNext,
    onPlayPlaylist,
    onNavigateArtist,
  } = props;
  
  const pathname = usePathname();
  const router = useRouter();
  const segments = pathname.split("/").filter(Boolean);
  const { data: session } = useSession();
  const [playlists, setPlaylists] = useState<YouTubePlaylist[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(false);
  const [forYouTracks, setForYouTracks] = useState<(ForYouTrack & { id?: string; artwork?: string })[]>([]);
  const [forYouLoading, setForYouLoading] = useState(false);
  const [forYouPlayingId, setForYouPlayingId] = useState<string | null>(null);
  const [audioPicks, setAudioPicks] = useState<SearchItem[]>([]);
  const [audioPicksLoading, setAudioPicksLoading] = useState(false);
  const [liveNow, setLiveNow] = useState<SearchItem[]>([]);
  const [liveNowLoading, setLiveNowLoading] = useState(false);
  const [videoPicks, setVideoPicks] = useState<SearchItem[]>([]);
  const [videoPicksLoading, setVideoPicksLoading] = useState(false);
  const [playlistRecs, setPlaylistRecs] = useState<PlaylistSearchItem[]>([]);
  const [playlistRecsLoading, setPlaylistRecsLoading] = useState(false);
  const [artistRecs, setArtistRecs] = useState<ArtistSearchItem[]>([]);
  const [artistRecsLoading, setArtistRecsLoading] = useState(false);
  const [likedTracks, setLikedTracks] = useState<SearchItem[]>([]);
  const [likedTracksLoading, setLikedTracksLoading] = useState(false);

  const fetchPlaylists = useCallback(async () => {
    if (!session?.accessToken) return;
    setPlaylistsLoading(true);
    try {
      const response = await fetch("/api/youtube/playlists");
      if (response.ok) {
        const data = await response.json();
        setPlaylists(data.slice(0, 12));
      }
    } catch (err) {
      console.error("Failed to fetch playlists:", err);
    } finally {
      setPlaylistsLoading(false);
    }
  }, [session]);

  const profileHistoryStrings = React.useMemo((): string[] => {
    const out: string[] = [];
    const push = (title?: string | null, artist?: string | null) => {
      const t = (title || "").trim();
      const a = (artist || "").trim();
      if (!t || !a) return;
      out.push(`${t} by ${a}`);
    };

    // Overall profile signals (NOT tied to currently playing song)
    for (const t of likedTracks) push(t.title, t.author);
    // NOTE: do NOT include playedHistory here. playedHistory updates on every play and would
    // re-seed shelves to the current song.

    // De-dupe while preserving order
    const seen = new Set<string>();
    const uniq: string[] = [];
    for (const x of out) {
      const k = x.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      uniq.push(x);
      if (uniq.length >= 40) break;
    }
    return uniq.length > 0 ? uniq : ["Top Hits 2024"];
  }, [likedTracks]);

  const sessionHistoryStrings = React.useMemo((): string[] => {
    const out: string[] = [];
    const push = (title?: string | null, artist?: string | null) => {
      const t = (title || "").trim();
      const a = (artist || "").trim();
      if (!t || !a) return;
      out.push(`${t} by ${a}`);
    };
    for (const s of playedHistory || []) push(s.title, s.artist);
    return out;
  }, [playedHistory]);

  const seedQueries = useCallback((): string[] => {
    // Extract most frequent artists from the profile history strings.
    const counts = new Map<string, number>();
    for (const s of profileHistoryStrings) {
      const idx = s.toLowerCase().lastIndexOf(" by ");
      const artist = idx >= 0 ? s.slice(idx + 4).trim() : "";
      if (!artist) continue;
      counts.set(artist, (counts.get(artist) || 0) + 1);
    }
    const ranked = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([artist]) => artist);
    const top = ranked.slice(0, 2);
    return top.length > 0 ? top : ["Top Hits 2024"];
  }, [profileHistoryStrings]);

  const fetchForYou = useCallback(async () => {
    setForYouLoading(true);
    try {
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          // This row should feel like a radio: re-seed per song
          recentTrackId: currentSongId || (playedHistory && playedHistory.length > 0 ? playedHistory[0].id : null),
          userHistory: sessionHistoryStrings.slice(0, 15)
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const resolved = (data.recommendations || []).map((track: any) => ({
          ...track,
          id: track.youtubeId,
          artwork: track.thumbnail,
        }));
        setForYouTracks(resolved);
      }
    } catch (err) {
      console.error("For You fetch failed:", err);
    } finally {
      setForYouLoading(false);
    }
  }, [currentSongId, playedHistory, sessionHistoryStrings]);

  const fetchAudioPicks = useCallback(async () => {
    setAudioPicksLoading(true);
    try {
      const seeds = seedQueries();
      // Use YT Music song search (music.youtube.com) for audio-first picks.
      const q = `${seeds[0]} audio`;
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&type=songs`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { items?: SearchItem[] };
      const items = (data.items || [])
        .filter((x) => !!x?.videoId)
        .slice(0, 12);
      setAudioPicks(items);
    } catch (e) {
      console.error("Audio picks fetch failed:", e);
    } finally {
      setAudioPicksLoading(false);
    }
  }, [seedQueries]);

  const fetchLiveNow = useCallback(async () => {
    setLiveNowLoading(true);
    try {
      const seeds = seedQueries();
      const q = `${seeds[0]} live`;
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&type=live`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { items?: SearchItem[] };
      const items = (data.items || [])
        .map((x) => ({ ...x, isLive: true }))
        .filter((x) => !!x?.videoId)
        .slice(0, 12);
      setLiveNow(items);
    } catch (e) {
      console.error("Live now fetch failed:", e);
    } finally {
      setLiveNowLoading(false);
    }
  }, [seedQueries]);

  const fetchVideoPicks = useCallback(async () => {
    setVideoPicksLoading(true);
    try {
      const seeds = seedQueries();
      const q = `${seeds[0]} official music video`;
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&type=videos`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { items?: SearchItem[] };
      const items = (data.items || []).filter((x) => !!x?.videoId).slice(0, 12);
      setVideoPicks(items);
    } catch (e) {
      console.error("Video picks fetch failed:", e);
    } finally {
      setVideoPicksLoading(false);
    }
  }, [seedQueries]);

  const fetchPlaylistRecs = useCallback(async () => {
    setPlaylistRecsLoading(true);
    try {
      const seeds = seedQueries();
      const q = `${seeds[0]} mix playlist`;
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&type=playlists`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { items?: PlaylistSearchItem[] };
      const items = (data.items || [])
        .filter((x) => x?.type === "PLAYLIST" && x?.id)
        .slice(0, 12) as PlaylistSearchItem[];
      setPlaylistRecs(items);
    } catch (e) {
      console.error("Playlist recs fetch failed:", e);
    } finally {
      setPlaylistRecsLoading(false);
    }
  }, [seedQueries]);

  const fetchArtistRecs = useCallback(async () => {
    setArtistRecsLoading(true);
    try {
      const seeds = seedQueries();
      const q = seeds[0];
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&type=artists`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { items?: ArtistSearchItem[] };
      const items = (data.items || [])
        .filter((x) => x?.type === "ARTIST" && (x as ArtistSearchItem).name)
        .slice(0, 12) as ArtistSearchItem[];
      setArtistRecs(items);
    } catch (e) {
      console.error("Artist recs fetch failed:", e);
    } finally {
      setArtistRecsLoading(false);
    }
  }, [seedQueries]);

  const fetchLikedTracks = useCallback(async () => {
    if (!session?.accessToken) return;
    setLikedTracksLoading(true);
    try {
      const res = await fetch("/api/youtube/liked", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { videoId?: string; title?: string; artist?: string; thumbnailUrl?: string; duration?: string }[];
      const rows: SearchItem[] = (data || [])
        .filter((t) => !!t?.videoId)
        .slice(0, 20)
        .map((t) => ({
          videoId: t.videoId as string,
          title: (t.title || "Unknown").toString(),
          author: (t.artist || "Unknown Artist").toString(),
          duration: (t.duration || "0:00").toString(),
          thumbnail: (t.thumbnailUrl || "").toString(),
        }));
      setLikedTracks(rows);
    } catch (e) {
      console.error("Liked tracks fetch failed:", e);
    } finally {
      setLikedTracksLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    fetchForYou();
    if (session) fetchPlaylists();
  }, [fetchForYou, fetchPlaylists, session]);

  useEffect(() => {
    // Reset "Recommended Songs" whenever the playing song changes.
    if (!currentSongId) return;
    void fetchForYou();
  }, [currentSongId, fetchForYou]);

  useEffect(() => {
    void fetchAudioPicks();
    void fetchLiveNow();
    void fetchVideoPicks();
    void fetchPlaylistRecs();
    void fetchArtistRecs();
  }, [fetchAudioPicks, fetchLiveNow, fetchVideoPicks, fetchPlaylistRecs, fetchArtistRecs]);

  useEffect(() => {
    void fetchLikedTracks();
  }, [fetchLikedTracks]);

  const handlePlayForYou = async (track: ForYouTrack & { id?: string; artwork?: string }) => {
    if (!track.id || !onSongClick) return;
    setForYouPlayingId(track.id);
    onSongClick({
      id: track.id,
      title: track.title,
      artist: track.artist,
      artwork: track.artwork || "",
      duration: track.duration || "",
      color: accentColor,
      isDirectLink: true,
    });
    setForYouPlayingId(null);
  };

  const playSearchItem = useCallback((item: SearchItem, opts?: { preferVideo?: boolean; isLive?: boolean }) => {
    if (!onSongClick) return;
    const isLive = !!(opts?.isLive || item.isLive || item.duration === "LIVE");
    const preferVideo = !!(opts?.preferVideo || isLive);
    onSongClick({
      id: item.videoId,
      title: item.title,
      artist: item.author,
      artwork: item.thumbnail || "",
      duration: item.duration || (isLive ? "LIVE" : "0:00"),
      color: accentColor,
      isLive,
      preferVideoPlayback: preferVideo,
      isDirectLink: true,
    });
  }, [accentColor, onSongClick]);

  const recentPlaysItems = React.useMemo((): SearchItem[] => {
    const seen = new Set<string>();
    const out: SearchItem[] = [];
    for (const s of playedHistory || []) {
      if (!s?.id || seen.has(s.id)) continue;
      seen.add(s.id);
      out.push({
        videoId: s.id,
        title: s.title,
        author: s.artist,
        duration: s.duration || "0:00",
        thumbnail: s.artwork || "",
      });
      if (out.length >= 14) break;
    }
    return out;
  }, [playedHistory]);

  const openPlaylistRec = useCallback(
    (p: PlaylistSearchItem) => {
      onPlaylistClick?.({
        id: p.id,
        title: p.title,
        description: p.author || "",
        thumbnailUrl: p.thumbnail || "",
        itemCount: 0,
      });
    },
    [onPlaylistClick],
  );

  return (
    <div className="flex-1 h-full flex flex-col overflow-hidden relative">
      <div className="flex-1 h-full min-h-0 flex flex-col">
        <AnimatePresence mode="wait">
          {activeView === "playlist-detail" && (
            <m.div 
              key="playlist-detail" 
              className="flex-1 h-full min-h-0 flex flex-col overflow-hidden"
              {...FADE_IN_VARIANTS}
            >
                <PlaylistDetail
                  playlist={selectedPlaylist || { id: segments[1], title: "Loading...", itemCount: 0, thumbnailUrl: "", description: "" }}
                  accentColor={accentColor}
                  onSongClick={onSongClick || (() => {})}
                  onQueueReplace={onQueueReplace || (() => {})}
                  onAddToQueue={onAddToQueue}
                  onPlayNext={onPlayNext}
                  onPlayPlaylist={onPlayPlaylist}
                  currentSongId={currentSongId}
                  onNavigateArtist={onNavigateArtist}
                  onBack={() => router.back()}
                />
            </m.div>
          )}

          {activeView === "album" && (
            <m.div 
              key="album-detail" 
              className="flex-1 h-full min-h-0 flex flex-col overflow-hidden"
              {...FADE_IN_VARIANTS}
            >
                <AlbumDetail
                  albumId={segments[1]}
                  onBack={() => router.back()}
                  accentColor={accentColor}
                  onSongClick={onSongClick || (() => {})}
                  onQueueReplace={onQueueReplace || (() => {})}
                  onAddToQueue={onAddToQueue}
                  onPlayNext={onPlayNext}
                  onPlayPlaylist={onPlayPlaylist}
                  currentSongId={currentSongId}
                  onNavigateArtist={onNavigateArtist}
                />
            </m.div>
          )}

          {activeView === "library" && (
            <m.div 
               key="library" 
               className="flex-1 h-full min-h-0 flex flex-col overflow-y-auto custom-scrollbar"
               initial={false}
               animate={{ opacity: 1, y: 0 }}
            >
              <YouTubeLibrary
                onPlaylistClick={onPlaylistClick}
                onAddToQueue={onAddToQueue}
                onPlayNext={onPlayNext}
                onPlayPlaylist={onPlayPlaylist}
                onSongClick={onSongClick}
                playedHistory={playedHistory}
                accentColor={accentColor}
              />
            </m.div>
          )}

          {activeView === "settings" && (
            <m.div 
              key="settings" 
              className="flex-1 h-full min-h-0 flex flex-col overflow-hidden"
              {...FADE_IN_VARIANTS}
            >
              <Settings />
            </m.div>
          )}

          {activeView === "home" && (
            <m.div
              key="home"
              initial="initial"
              animate="animate"
              exit="exit"
              variants={FADE_IN_VARIANTS}
              className="flex-1 h-full min-h-0 overflow-y-auto custom-scrollbar px-6 md:px-10 lg:px-16 pt-12 pb-40 space-y-20"
            >
              <header className="mb-12">
                <h1 className="text-[48px] font-black tracking-tighter text-white leading-none mb-3">Listen Now</h1>
                <p className="text-[20px] font-medium text-white/40">
                  Personalized for you
                </p>
              </header>

              <Shelf title="Recommended Songs" subtitle="AI picks based on your recent plays" onRefresh={fetchForYou} loading={forYouLoading}>
                {forYouLoading ? (
                   Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="w-[240px] shrink-0 aspect-square rounded-[24px] bg-[#161618] animate-pulse" />
                   ))
                ) : (
                  forYouTracks.map((track, i) => (
                    <div key={`${track.id || track.title}-${i}`} className="w-[200px] sm:w-[220px] lg:w-[240px] shrink-0 translate-y-0">
                      <ForYouCard
                        track={track}
                        index={i}
                        accentColor={accentColor}
                        isPlaying={forYouPlayingId === track.id}
                        onPlay={() => handlePlayForYou(track)}
                        onAddToQueue={onAddToQueue}
                        onPlayNext={onPlayNext}
                        onNavigateArtist={props.onNavigateArtist}
                      />
                    </div>
                  ))
                )}
              </Shelf>

              {recentPlaysItems.length > 0 && (
                <Shelf title="Recent plays" subtitle="Picks from your session in Nexus">
                  {recentPlaysItems.map((item, i) => (
                    <div key={`recent-${item.videoId}-${i}`} className="w-[200px] sm:w-[220px] lg:w-[240px] shrink-0 translate-y-0">
                      <SearchCard item={item} index={i} accentColor={accentColor} onPlay={() => playSearchItem(item, { preferVideo: false })} />
                    </div>
                  ))}
                </Shelf>
              )}

              <Shelf title="Music videos" subtitle="Watch the official visuals" onRefresh={fetchVideoPicks} loading={videoPicksLoading}>
                {videoPicksLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="w-[240px] shrink-0 aspect-square rounded-[24px] bg-[#161618] animate-pulse" />
                  ))
                ) : videoPicks.length === 0 ? (
                  <div className="text-white/40 font-medium px-1">No videos surfaced yet. Play something to tune this row.</div>
                ) : (
                  videoPicks.map((item, i) => (
                    <div key={`mv-${item.videoId}-${i}`} className="w-[200px] sm:w-[220px] lg:w-[240px] shrink-0 translate-y-0 hover:-translate-y-1 transition-all duration-300">
                      <SearchCard
                        item={item}
                        index={i}
                        accentColor={accentColor}
                        mediaAspect="video"
                        onPlay={() => playSearchItem(item, { preferVideo: true })}
                      />
                    </div>
                  ))
                )}
              </Shelf>

              <Shelf title="Audio Picks" subtitle="Clean audio-first versions for focus listening" onRefresh={fetchAudioPicks} loading={audioPicksLoading}>
                {audioPicksLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="w-[240px] shrink-0 aspect-square rounded-[24px] bg-[#161618] animate-pulse" />
                  ))
                ) : audioPicks.length === 0 ? (
                  <div className="text-white/40 font-medium px-1">No audio picks yet. Play a song to personalize.</div>
                ) : (
                  audioPicks.map((item, i) => (
                    <div key={`${item.videoId}-${i}`} className="w-[200px] sm:w-[220px] lg:w-[240px] shrink-0 translate-y-0 hover:-translate-y-1 transition-all duration-300">
                      <SearchCard
                        item={item}
                        index={i}
                        accentColor={accentColor}
                        badge={undefined}
                        onPlay={() => playSearchItem(item, { preferVideo: false })}
                      />
                    </div>
                  ))
                )}
              </Shelf>

              <Shelf title="Live Now" subtitle="Streams and sets happening right now" onRefresh={fetchLiveNow} loading={liveNowLoading}>
                {liveNowLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="w-[240px] shrink-0 aspect-square rounded-[24px] bg-[#161618] animate-pulse" />
                  ))
                ) : liveNow.length === 0 ? (
                  <div className="text-white/40 font-medium px-1">No live matches right now. Try again in a bit.</div>
                ) : (
                  liveNow.map((item, i) => (
                    <div key={`${item.videoId}-${i}`} className="w-[200px] sm:w-[220px] lg:w-[240px] shrink-0 translate-y-0 hover:-translate-y-1 transition-all duration-300">
                      <SearchCard
                        item={item}
                        index={i}
                        accentColor={accentColor}
                        onPlay={() => playSearchItem({ ...item, duration: "LIVE", isLive: true }, { preferVideo: true, isLive: true })}
                      />
                    </div>
                  ))
                )}
              </Shelf>

              <Shelf
                title="Recommended playlists"
                subtitle="Mixes and stations tuned to your taste"
                onRefresh={fetchPlaylistRecs}
                loading={playlistRecsLoading}
              >
                {playlistRecsLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="w-[240px] shrink-0 aspect-square rounded-[24px] bg-[#161618] animate-pulse" />
                  ))
                ) : playlistRecs.length === 0 ? (
                  <div className="text-white/40 font-medium px-1">No playlist suggestions right now.</div>
                ) : (
                  playlistRecs.map((p, i) => (
                    <div
                      key={`pl-${p.id}-${i}`}
                      onClick={() => openPlaylistRec(p)}
                      className="w-[200px] sm:w-[220px] lg:w-[240px] shrink-0 translate-y-0 cursor-pointer transition-all duration-300 hover:-translate-y-1"
                    >
                      <m.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04, ease: APPLE_EASE }}
                        className="group flex flex-col"
                      >
                        <div className="relative aspect-square overflow-hidden rounded-[22px] bg-[#161618] shadow-[0_20px_40px_rgba(0,0,0,0.4)] ring-1 ring-white/5 transition-all duration-500 group-hover:shadow-[0_40px_80px_rgba(0,0,0,0.55)]">
                          <MusicArtwork
                            src={p.thumbnail}
                            alt={p.title}
                            iconSize={34}
                            variant="track"
                            rounded="3xl"
                            className="transition-transform duration-700 group-hover:scale-110"
                          />
                        </div>
                        <div className="mt-4 px-1 text-left">
                          <h3 className="line-clamp-2 h-[42px] text-[17px] font-bold leading-tight tracking-tight text-white">{p.title}</h3>
                          <p className="mt-1 truncate text-[14px] font-medium text-white/40">{p.author}</p>
                          <p className="mt-2 text-[12px] font-semibold uppercase tracking-wider text-white/28">Playlist</p>
                        </div>
                      </m.div>
                    </div>
                  ))
                )}
              </Shelf>

              <Shelf title="Artists for you" subtitle="Based on what you’ve been playing" onRefresh={fetchArtistRecs} loading={artistRecsLoading}>
                {artistRecsLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-[220px] w-[180px] shrink-0 rounded-3xl bg-[#161618] animate-pulse" />
                  ))
                ) : artistRecs.length === 0 ? (
                  <div className="text-white/40 font-medium px-1">No artist matches yet.</div>
                ) : (
                  artistRecs.map((a, i) => (
                    <ArtistRecCard key={`${a.id}-${i}`} artist={a} index={i} onOpen={() => onNavigateArtist?.(a.name)} />
                  ))
                )}
              </Shelf>

              {session && (
                <Shelf title="Your Playlists" onRefresh={fetchPlaylists} loading={playlistsLoading}>
                  {playlists.map((playlist) => (
                    <div
                      key={playlist.id}
                      onClick={() => onPlaylistClick?.(playlist)}
                      className="w-[200px] shrink-0 cursor-pointer group flex flex-col"
                    >
                      <div className="relative aspect-square rounded-[20px] overflow-hidden bg-[#161618] shadow-2xl transition-all duration-500 group-hover:shadow-[0_20px_50px_rgba(0,0,0,0.4)]">
                        <MusicArtwork
                          src={playlist.thumbnailUrl?.replace(/([=|-][swh])\d+/g, "$1800") || playlist.thumbnailUrl}
                          alt={playlist.title}
                          iconSize={34}
                          variant="track"
                          rounded="2xl"
                          className="transition-transform duration-700 group-hover:scale-110"
                        />
                      </div>
                      <div className="mt-4">
                        <h3 className="font-bold text-white text-[16px] tracking-tight truncate leading-tight mb-1">{playlist.title}</h3>
                        <p className="text-[13px] text-white/40 font-medium truncate">YouTube Library</p>
                      </div>
                    </div>
                  ))}
                </Shelf>
              )}
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
