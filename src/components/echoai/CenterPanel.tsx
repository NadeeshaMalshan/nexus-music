"use client";

import React, { useEffect, useState, useCallback, Suspense } from "react";
import { Play, Loader2, Music, RefreshCw, ListPlus, PlaySquare, ChevronLeft, ChevronRight } from "lucide-react";
import { m, AnimatePresence } from "motion/react";
import { APPLE_EASE, FADE_IN_VARIANTS, MOTION_CONFIG } from "@/lib/animations";
import { type Song } from "./types";
import { type YouTubePlaylist } from "@/lib/youtubeData";
import { youtubeApiFetchInit } from "@/lib/youtubeClientFetch";
import { readResponseJson } from "@/lib/readResponseJson";
import { useSession, signIn } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useDashboard } from "@/context/DashboardContext";
import { MusicArtwork } from "./MusicArtwork";
import { YouTubeLibrary } from "./YouTubeLibrary";
import { PlaylistDetail } from "./PlaylistDetail";
import { AlbumDetail } from "./AlbumDetail";
import { Settings } from "./Settings";
import { StatsProfile } from "./StatsProfile";
import { PrivacyPolicy } from "./PrivacyPolicy";
import { TermsOfService } from "./TermsOfService";
import { AppBrandMark } from "./AppBrandMark";
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
export function Shelf(props: {
  title: React.ReactNode;
  subtitle?: string;
  onRefresh?: () => void;
  loading?: boolean;
  children: React.ReactNode;
}) {
  const { title, subtitle, onRefresh, loading, children } = props;
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const { isRightSidebarOpen } = useDashboard();

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = dir === "left" ? -800 : 800;
    scrollRef.current.scrollBy({ left: amount, behavior: "smooth" });
  };

  return (
    <section className="relative group/shelf">
      <div className={`mb-6 flex items-center justify-between px-1 transition-[padding-right] duration-[450ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${isRightSidebarOpen ? "lg:pr-[380px]" : "lg:pr-0"
        }`}>
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
          <div className="flex items-center gap-5">
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
      </div>

      <div
        ref={scrollRef}
        className="flex items-start gap-x-8 overflow-x-auto no-scrollbar scroll-smooth px-1 pb-4"
      >
        {children}
        {isRightSidebarOpen && (
          <div className="hidden lg:block w-[380px] shrink-0 pointer-events-none" />
        )}
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
  priority?: boolean;
}) {
  const { track, index, onPlay, isPlaying, accentColor, onAddToQueue, onPlayNext, onNavigateArtist, priority } = props;

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
          priority={priority}
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
      data-song-id={item.videoId || ""}
      data-song-title={item.title || ""}
      data-song-artist={item.author || ""}
      data-song-artwork={item.thumbnail || ""}
      data-song-duration={item.duration || ""}
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
              className={`px-3 py-1 rounded-full text-[11px] font-black tracking-wider border ${badge === "LIVE"
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
  const { currentSong, isRightSidebarOpen } = useDashboard();
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
  const [artistImageBg, setArtistImageBg] = useState<string | null>(null);
  const [friendsActivity, setFriendsActivity] = useState<{ user: { name: string; email: string; image?: string }; isOnline: boolean; status: { song?: { id: string; title: string; artist: string; artwork?: string } } | null; lastSong: { id: string; title: string; artist: string; artwork?: string } | null }[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);

  useEffect(() => {
    if (!currentSong?.artist) {
      setArtistImageBg(null);
      return;
    }
    let active = true;
    fetch(`/api/artist?name=${encodeURIComponent(currentSong.artist)}`)
      .then(res => res.json())
      .then(data => {
        if (active && data.image) {
          setArtistImageBg(data.image);
        }
      })
      .catch(() => { });
    return () => { active = false; };
  }, [currentSong?.artist]);

  const fetchFriendsActivity = useCallback(async () => {
    if (!session?.user) return;
    setFriendsLoading(true);
    try {
      const res = await fetch("/api/user/status");
      if (res.ok) {
        const data = await res.json();
        setFriendsActivity(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Failed to fetch friends activity:", err);
    } finally {
      setFriendsLoading(false);
    }
  }, [session?.user]);

  useEffect(() => {
    void fetchFriendsActivity();
  }, [fetchFriendsActivity]);

  const [videoSeed, setVideoSeed] = useState("Trending Hits");
  const [audioSeed, setAudioSeed] = useState("Lofi Beats");
  const [liveSeed, setLiveSeed] = useState("Synthwave");
  const [playlistSeed, setPlaylistSeed] = useState("Billboard Hot 100");
  const [artistSeed, setArtistSeed] = useState("Pop Music");

  useEffect(() => {
    const videoList = ["Trending Hits", "Pop Music 2025", "Billboard Hot 100", "Viral Hits", "Summer Anthems", "New Releases"];
    const audioList = ["Lofi Beats", "Acoustic Chill", "R&B Hits", "Chill Vibes", "Indie Pop", "Acoustic Guitar", "Jazz Relax"];
    const liveList = ["Electronic Set", "Live Acoustic", "Jazz Session", "Synthwave", "Chillout Live", "Festival Set", "Piano Live"];
    const playlistList = ["Party Mix", "Workout Hits", "Focus Study", "Sleep Ambient", "Dance Hits", "Summer Vibes", "Sad Acoustic"];
    const artistList = ["The Weeknd", "Taylor Swift", "Dua Lipa", "Drake", "Post Malone", "Billie Eilish", "Bruno Mars", "Ed Sheeran"];

    setVideoSeed(videoList[Math.floor(Math.random() * videoList.length)]);
    setAudioSeed(audioList[Math.floor(Math.random() * audioList.length)]);
    setLiveSeed(liveList[Math.floor(Math.random() * liveList.length)]);
    setPlaylistSeed(playlistList[Math.floor(Math.random() * playlistList.length)]);
    setArtistSeed(artistList[Math.floor(Math.random() * artistList.length)]);
  }, []);

  const fetchPlaylists = useCallback(async () => {
    if (!session?.accessToken) return;
    setPlaylistsLoading(true);
    try {
      const response = await fetch("/api/youtube/playlists", youtubeApiFetchInit(session.accessToken));
      if (response.ok) {
        const data = await readResponseJson<YouTubePlaylist[]>(response);
        if (Array.isArray(data)) setPlaylists(data.slice(0, 12));
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
    return uniq.length > 0 ? uniq : ["__FALLBACK_SEED__"];
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
      if (s === "__FALLBACK_SEED__") continue;
      const idx = s.toLowerCase().lastIndexOf(" by ");
      const artist = idx >= 0 ? s.slice(idx + 4).trim() : "";
      if (!artist) continue;
      counts.set(artist, (counts.get(artist) || 0) + 1);
    }
    const ranked = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([artist]) => artist);
    const top = ranked.slice(0, 2);
    return top.length > 0 ? top : ["__FALLBACK_SEED__"];
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

      if (res.ok && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextEncoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += new TextDecoder().decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const cleanLine = line.trim();
            if (cleanLine.startsWith("data: ")) {
              try {
                const payload = JSON.parse(cleanLine.slice(6));
                if (payload.result) {
                  const data = payload.result;
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const resolved = (data.recommendations || []).map((track: any) => ({
                    ...track,
                    id: track.youtubeId,
                    artwork: track.thumbnail,
                  }));
                  setForYouTracks(resolved);
                }
              } catch (e) {
                console.error("Error parsing stream line:", e);
              }
            }
          }
        }
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
      // Taste comes from the signed-in YouTube account; results come from public YT Music songs/Up Next.
      const pr = await fetch(
        `/api/audio/personalized?t=${Date.now()}`,
        youtubeApiFetchInit(session?.accessToken, { cache: "no-store" })
      );
      if (pr.ok) {
        const pdata = await readResponseJson<{ items?: SearchItem[] }>(pr);
        const pitems = (pdata?.items || []).filter((x) => !!x?.videoId);
        if (pitems.length > 0) {
          setAudioPicks(pitems.slice(0, 12));
          return;
        }
      }
      const seeds = seedQueries();
      const queryValue = seeds[0] === "__FALLBACK_SEED__" ? audioSeed : seeds[0];
      const q = `${queryValue} audio`;
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&type=songs`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await readResponseJson<{ items?: SearchItem[] }>(res);
      if (!data) return;
      const items = (data.items || [])
        .filter((x) => !!x?.videoId)
        .slice(0, 12);
      setAudioPicks(items);
    } catch (e) {
      console.error("Audio picks fetch failed:", e);
    } finally {
      setAudioPicksLoading(false);
    }
  }, [seedQueries, session?.accessToken, audioSeed]);

  const fetchLiveNow = useCallback(async () => {
    setLiveNowLoading(true);
    try {
      if (session?.accessToken) {
        const pr = await fetch(
          `/api/live/personalized?t=${Date.now()}`,
          youtubeApiFetchInit(session.accessToken, { cache: "no-store" })
        );
        if (pr.ok) {
          const pdata = await readResponseJson<{ items?: SearchItem[] }>(pr);
          const pitems = (pdata?.items || []).filter((x) => !!x?.videoId);
          if (pitems.length > 0) {
            setLiveNow(pitems.slice(0, 12));
            return;
          }
        }
      }

      const seeds = seedQueries();
      const liveList = ["Electronic Set", "Live Acoustic", "Jazz Session", "Synthwave", "Chillout Live", "Festival Set", "Piano Live"];
      const randomSeed = liveList[Math.floor(Math.random() * liveList.length)];
      const queryValue = seeds[0] === "__FALLBACK_SEED__" ? randomSeed : seeds[0];
      const q = `${queryValue} live`;
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&type=live&t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await readResponseJson<{ items?: SearchItem[] }>(res);
      if (!data) return;
      const items = (data.items || [])
        .filter((x) => !!x?.videoId)
        .slice(0, 12);
      setLiveNow(items);
    } catch (e) {
      console.error("Live now fetch failed:", e);
    } finally {
      setLiveNowLoading(false);
    }
  }, [seedQueries, session?.accessToken]);

  const fetchVideoPicks = useCallback(async () => {
    setVideoPicksLoading(true);
    try {
      // YouTube / YT Music only: history, top artists, related + YT Music search (no generative model).
      if (session?.accessToken) {
        const pr = await fetch(
          `/api/music-videos/personalized?t=${Date.now()}`,
          youtubeApiFetchInit(session.accessToken, { cache: "no-store" })
        );
        if (pr.ok) {
          const pdata = await readResponseJson<{ items?: SearchItem[] }>(pr);
          const pitems = (pdata?.items || []).filter((x) => !!x?.videoId);
          if (pitems.length > 0) {
            setVideoPicks(pitems.slice(0, 12));
            return;
          }
        }
      }
      const seeds = seedQueries();
      const queryValue = seeds[0] === "__FALLBACK_SEED__" ? videoSeed : seeds[0];
      const q = `${queryValue} official music video`;
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&type=videos`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await readResponseJson<{ items?: SearchItem[] }>(res);
      if (!data) return;
      const items = (data.items || []).filter((x) => !!x?.videoId).slice(0, 12);
      setVideoPicks(items);
    } catch (e) {
      console.error("Video picks fetch failed:", e);
    } finally {
      setVideoPicksLoading(false);
    }
  }, [seedQueries, session?.accessToken, videoSeed]);

  const fetchPlaylistRecs = useCallback(async () => {
    setPlaylistRecsLoading(true);
    try {
      if (session?.accessToken) {
        const pr = await fetch(
          `/api/playlists/personalized?t=${Date.now()}`,
          youtubeApiFetchInit(session.accessToken, { cache: "no-store" })
        );
        if (pr.ok) {
          const pdata = await readResponseJson<{ items?: PlaylistSearchItem[] }>(pr);
          const pitems = (pdata?.items || []).filter((x) => x?.type === "PLAYLIST" && x?.id);
          if (pitems.length > 0) {
            setPlaylistRecs(pitems.slice(0, 12));
            return;
          }
        }
      }

      const seeds = seedQueries();
      const playlistList = [
        "Party Mix",
        "Workout Hits",
        "Focus Study",
        "Sleep Ambient",
        "Dance Hits",
        "Summer Vibes",
        "Sad Acoustic",
        "Chill Vibes",
        "Night Drive",
        "Synthwave Sunset",
      ];
      const randomSeed = playlistList[Math.floor(Math.random() * playlistList.length)];
      const queryValue = seeds[0] === "__FALLBACK_SEED__" ? randomSeed : seeds[0];
      const q = `${queryValue} mix playlist`;
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(q)}&type=playlists&t=${Date.now()}`,
        { cache: "no-store" }
      );
      if (!res.ok) return;
      const data = await readResponseJson<{ items?: PlaylistSearchItem[] }>(res);
      if (!data) return;
      const items = (data.items || [])
        .filter((x) => x?.type === "PLAYLIST" && x?.id)
        .slice(0, 12) as PlaylistSearchItem[];
      setPlaylistRecs(items);
    } catch (e) {
      console.error("Playlist recs fetch failed:", e);
    } finally {
      setPlaylistRecsLoading(false);
    }
  }, [seedQueries, session?.accessToken]);

  const fetchArtistRecs = useCallback(async () => {
    setArtistRecsLoading(true);
    try {
      if (session?.accessToken) {
        const pr = await fetch(
          `/api/artists/personalized?t=${Date.now()}`,
          youtubeApiFetchInit(session.accessToken, { cache: "no-store" })
        );
        if (pr.ok) {
          const pdata = await readResponseJson<{ items?: ArtistSearchItem[] }>(pr);
          const pitems = (pdata?.items || []).filter(
            (x) => x?.type === "ARTIST" && (x as ArtistSearchItem).name
          );
          if (pitems.length > 0) {
            setArtistRecs(pitems.slice(0, 12));
            return;
          }
        }
      }

      const seeds = seedQueries();
      const genreList = [
        "Pop Music",
        "R&B Hits",
        "Hip Hop Artists",
        "Indie Pop",
        "Alternative Rock",
        "Electronic Dance",
        "Latin Music",
        "Top Artists",
      ];
      const randomGenre = genreList[Math.floor(Math.random() * genreList.length)];
      const queryValue = seeds[0] === "__FALLBACK_SEED__" ? randomGenre : seeds[0];
      const q = queryValue;
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(q)}&type=artists&t=${Date.now()}`,
        { cache: "no-store" }
      );
      if (!res.ok) return;
      const data = await readResponseJson<{ items?: ArtistSearchItem[] }>(res);
      if (!data) return;
      const items = (data.items || [])
        .filter((x) => x?.type === "ARTIST" && (x as ArtistSearchItem).name)
        .slice(0, 12) as ArtistSearchItem[];
      setArtistRecs(items);
    } catch (e) {
      console.error("Artist recs fetch failed:", e);
    } finally {
      setArtistRecsLoading(false);
    }
  }, [seedQueries, session?.accessToken]);

  const fetchLikedTracks = useCallback(async () => {
    if (!session?.accessToken) return;
    setLikedTracksLoading(true);
    try {
      const res = await fetch(
        "/api/youtube/liked",
        youtubeApiFetchInit(session.accessToken, { cache: "no-store" })
      );
      if (!res.ok) return;
      const data = await readResponseJson<
        { videoId?: string; title?: string; artist?: string; thumbnailUrl?: string; duration?: string }[]
      >(res);
      if (!data) return;
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
      if (!s?.id || seen.has(s.id) || s.id === currentSongId) continue;
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
  }, [playedHistory, currentSongId]);

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
                onSongClick={onSongClick || (() => { })}
                onQueueReplace={onQueueReplace || (() => { })}
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
                onSongClick={onSongClick || (() => { })}
                onQueueReplace={onQueueReplace || (() => { })}
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

          {activeView === "privacy" && (
            <m.div
              key="privacy"
              className="flex-1 h-full min-h-0 flex flex-col overflow-hidden"
              {...FADE_IN_VARIANTS}
            >
              <PrivacyPolicy />
            </m.div>
          )}

          {activeView === "terms" && (
            <m.div
              key="terms"
              className="flex-1 h-full min-h-0 flex flex-col overflow-hidden"
              {...FADE_IN_VARIANTS}
            >
              <TermsOfService />
            </m.div>
          )}

          {activeView === "stats" && (
            <m.div
              key="stats"
              className="flex-1 h-full min-h-0 flex flex-col overflow-hidden"
              {...FADE_IN_VARIANTS}
            >
              <Suspense fallback={
                <div className={`flex-1 h-full flex flex-col items-center justify-center bg-transparent transition-[padding-right] duration-[450ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${isRightSidebarOpen ? "lg:pr-[380px]" : "lg:pr-0"}`}>
                  <Loader2 size={48} className="animate-spin text-white/50 animate-pulse" style={{ color: accentColor }} />
                </div>
              }>
                <StatsProfile accentColor={accentColor} />
              </Suspense>
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
              {!session ? (
                <div className="flex flex-col justify-start items-start py-4 text-left w-full">
                  <m.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    className="flex flex-col items-start"
                  >

                    <h1 className="text-[34px] sm:text-[40px] font-black tracking-tight text-white leading-none mb-3">
                      Nexus Music
                    </h1>
                    <p className="text-[14px] sm:text-[15px] text-white/35 font-medium leading-relaxed max-w-md mb-6">
                      Sign in with Google to synchronize your YouTube library, unlock AI-driven recommendations, and control your playback queue.
                    </p>
                    <button
                      onClick={() => signIn("google")}
                      className="px-8 py-3.5 rounded-full bg-white text-black font-extrabold text-[14px] tracking-tight hover:scale-105 active:scale-95 transition-all shadow-[0_12px_30px_rgba(255,255,255,0.08)] hover:shadow-[0_12px_30px_rgba(255,255,255,0.18)] hover:bg-[#ececf0]"
                    >
                      Connect with Google
                    </button>
                  </m.div>

                  {recentPlaysItems.length > 0 && (
                    <div className="w-full mt-10 pt-6 border-t border-white/5 text-left">
                      <Shelf title="Recent plays" subtitle="Picks from your session in Nexus">
                        {recentPlaysItems.map((item, i) => (
                          <div key={`recent-${item.videoId}-${i}`} className="w-[180px] sm:w-[200px] lg:w-[220px] shrink-0 translate-y-0">
                            <SearchCard item={item} index={i} accentColor={accentColor} onPlay={() => playSearchItem(item, { preferVideo: false })} />
                          </div>
                        ))}
                      </Shelf>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <section className={`relative rounded-[32px] overflow-hidden mb-12 flex flex-col lg:flex-row border border-white/5 shadow-[0_20px_60px_rgba(0,0,0,0.5)] group transition-[margin-right] duration-[450ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${isRightSidebarOpen ? "lg:mr-[380px]" : "lg:mr-0"}`}>
                    <div className="absolute inset-0 z-0">
                      <img
                        src={artistImageBg || currentSong?.artwork || (forYouTracks[0]?.artwork)}
                        alt="Background"
                        className="w-full h-full object-cover opacity-40 mix-blend-screen scale-105 group-hover:scale-100 transition-transform duration-[2s] ease-out"
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-[#0d0d0d]/90 via-[#0d0d0d]/60 to-[#0d0d0d]/90"></div>
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0d0d0d]/50 to-[#0d0d0d]"></div>
                    </div>

                    <div className="relative z-10 w-full flex flex-col lg:flex-row justify-between p-6 sm:p-8 lg:p-14 min-h-[300px]">
                      <div className="flex-1 flex items-center justify-start max-w-2xl lg:pr-8">
                        <h1 className="text-[36px] sm:text-[52px] lg:text-[64px] font-black tracking-tighter text-white leading-[1.05] drop-shadow-xl">
                          {currentSong ? (
                            <>More songs like <br /><span className="text-white/60">{currentSong.title.replace(/\s*[([].*?[)\]]\s*/g, '').trim()}</span></>
                          ) : "Recommended for you"}
                        </h1>
                      </div>

                      <div className="w-full lg:w-[420px] mt-8 lg:mt-0 flex flex-col gap-3 justify-center">
                        {forYouLoading ? (
                          Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="w-full h-24 bg-white/5 animate-pulse" />
                          ))
                        ) : (
                          forYouTracks.slice(0, 3).map((track, i) => (
                            <div
                              key={i}
                              onClick={() => handlePlayForYou(track)}
                              className="group/item flex items-center gap-5 bg-black/20 hover:bg-white/10 backdrop-blur-md border border-white/10 p-3 rounded-2xl cursor-pointer transition-all duration-300 hover:translate-x-2"
                            >
                              <div className="w-[72px] h-[72px] shrink-0 bg-black overflow-hidden rounded-xl relative shadow-lg">
                                <MusicArtwork src={track.artwork} alt={track.title} rounded="none" className="w-full h-full" />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/item:opacity-100 flex items-center justify-center transition-opacity duration-300">
                                  {forYouPlayingId === track.id ? (
                                    <Loader2 size={24} className="animate-spin text-white" />
                                  ) : (
                                    <Play size={24} fill="white" className="text-white ml-1" />
                                  )}
                                </div>
                              </div>
                              <div className="flex-1 min-w-0 pr-2">
                                <p className="text-white font-black text-[18px] truncate tracking-tight mb-0.5">{track.title}</p>
                                <p className="text-white/50 font-bold text-[13px] truncate tracking-wide uppercase">{track.artist}</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </section>

                  {recentPlaysItems.length > 0 && (
                    <Shelf title="Recent plays" subtitle="Picks from your session in Nexus">
                      {recentPlaysItems.map((item, i) => (
                        <div key={`recent-${item.videoId}-${i}`} className="w-[200px] sm:w-[220px] lg:w-[240px] shrink-0 translate-y-0">
                          <SearchCard item={item} index={i} accentColor={accentColor} onPlay={() => playSearchItem(item, { preferVideo: false })} />
                        </div>
                      ))}
                    </Shelf>
                  )}

                  <Shelf
                    title="Music videos"
                    subtitle="The visual half of what's been living rent-free in your head"
                    onRefresh={fetchVideoPicks}
                    loading={videoPicksLoading}
                  >
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

                  {session && friendsActivity.length > 0 && (
                    <Shelf title="Your friends activity" subtitle="See what your friends are listening to" onRefresh={fetchFriendsActivity} loading={friendsLoading}>
                      {friendsActivity.map((friend, i) => {
                        const displaySong = friend.isOnline ? friend.status?.song : friend.lastSong;
                        return (
                          <div key={friend.user.email || i} className="w-[200px] shrink-0 bg-white/5 rounded-3xl p-5 flex flex-col items-center border border-white/5 shadow-md hover:bg-white/10 transition-all duration-300">
                            <div className="relative mb-4 mt-2">
                              {friend.user.image ? (
                                <img src={friend.user.image} alt={friend.user.name} className="w-[72px] h-[72px] rounded-full object-cover bg-white/10 ring-4 ring-white/5" />
                              ) : (
                                <div className="w-[72px] h-[72px] rounded-full bg-white/10 ring-4 ring-white/5 flex items-center justify-center text-white/40 text-2xl font-black">
                                  {friend.user.name?.charAt(0)?.toUpperCase() || "?"}
                                </div>
                              )}
                              <div className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-[#161618] ${friend.isOnline ? 'bg-green-500' : 'bg-zinc-500'}`} />
                            </div>
                            <h3 className="text-white font-bold text-[16px] tracking-tight text-center">{friend.user.name}</h3>
                            {displaySong ? (
                              <div className="mt-3 w-full bg-black/40 rounded-xl p-3 flex flex-col items-center">
                                <p className="text-[10px] text-white/50 font-bold uppercase tracking-wider mb-1">{friend.isOnline ? 'Listening to' : 'Last played'}</p>
                                <p className="text-white text-[13px] font-semibold truncate w-full text-center">{displaySong.title}</p>
                                <p className="text-white/40 text-[11px] truncate w-full text-center">{displaySong.artist}</p>
                              </div>
                            ) : (
                              <div className="mt-3 w-full bg-black/40 rounded-xl p-3 flex flex-col items-center">
                                <p className="text-[10px] text-white/30 font-bold uppercase tracking-wider">No recent activity</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </Shelf>
                  )}

                  {session && (
                    <Shelf title="Your Playlists" onRefresh={fetchPlaylists} loading={playlistsLoading}>
                      {playlists.map((playlist) => (
                        <div
                          key={playlist.id}
                          onClick={() => router.push(`/playlists/${playlist.id}`)}
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
                </>
              )}
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
