"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CenterPanel } from "./CenterPanel";
import { LeftSidebar } from "./LeftSidebar";
import { FloatingPlayer } from "./FloatingPlayer";
import { RightSidebar } from "./RightSidebar";
import { ExpandedPlayer } from "./ExpandedPlayer";
import { SearchPage } from "./SearchPage";
import { YouTubeLibrary } from "./YouTubeLibrary";
import { type Song } from "./types";
import { youtubeTimestampToSeconds } from "@/lib/duration";

type AudioPayload = {
  audioUrl: string;
  trackName: string;
  artist: string;
  coverArt: string;
  videoId: string;
};

type LyricsPayload = {
  success: boolean;
  lyrics: {
    isSynced: boolean;
    content: string | null;
    source: "LRCLIB" | "Lyrics.ovh" | null;
  };
  geniusData: {
    found: boolean;
    songId: number | null;
    url: string | null;
    thumbnail: string | null;
  };
};

type EchoAIDashboardProps = {
  initialView?: "home" | "explorer" | "stats" | "settings" | "library";
};

export function EchoAIDashboard({ initialView = "home" }: EchoAIDashboardProps) {
  const router = useRouter();
  const ytPlayerRef = useRef<{
    playVideo: () => void;
    pauseVideo: () => void;
    loadVideoById: (videoId: string) => void;
    getCurrentTime: () => number;
    getDuration: () => number;
    seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
    setVolume: (volume: number) => void;
  } | null>(null);
  const playerReadyRef = useRef(false);
  const progressIntervalRef = useRef<number | null>(null);
  const lastTimeBucketRef = useRef(-1);
  const playerElementId = "echoai-youtube-player";
  const [activeView, setActiveView] = useState(initialView);
  const [audioData, setAudioData] = useState<AudioPayload | null>(null);
  const [queueSongs, setQueueSongs] = useState<Song[]>([]);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [isExpandedPlayerOpen, setIsExpandedPlayerOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [volume, setVolume] = useState(70);
  const [lyricsData, setLyricsData] = useState<LyricsPayload | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const themeColor = currentSong?.color ?? "#a855f7";

  const audioQuery = useMemo(() => {
    if (!currentSong) return "";
    return `${currentSong.artist} ${currentSong.title}`.trim();
  }, [currentSong]);

  const videoId = useMemo(() => {
    if (audioData?.videoId) {
      return audioData.videoId;
    }
    return "";
  }, [audioData?.videoId]);

  useEffect(() => {
    if (!audioQuery) {
      setAudioData(null);
      return;
    }
    const controller = new AbortController();

    async function loadAudioMeta() {
      setAudioData(null);
      try {
        const response = await fetch(`/api/audio?query=${encodeURIComponent(audioQuery)}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error("Failed to fetch audio metadata");
        }

        const payload = (await response.json()) as AudioPayload;
        setAudioData(payload);
        if (ytPlayerRef.current && playerReadyRef.current) {
          ytPlayerRef.current.loadVideoById(payload.videoId);
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error("Failed to load unified audio payload:", error);
          setAudioData(null);
        }
      }
    }

    loadAudioMeta();
    return () => controller.abort();
  }, [audioQuery]);

  useEffect(() => {
    if (!currentSong) {
      setLyricsData(null);
      return;
    }
    const track = currentSong.title?.trim();
    const artist = currentSong.artist?.trim();
    if (!track || !artist) {
      setLyricsData(null);
      return;
    }
    const duration = youtubeTimestampToSeconds(currentSong.duration);
    const durationQuery =
      duration != null ? `&duration=${encodeURIComponent(String(Math.round(duration)))}` : "";

    const controller = new AbortController();
    async function loadLyrics() {
      setLyricsLoading(true);
      try {
        const response = await fetch(
          `/api/lyrics?track=${encodeURIComponent(track)}&artist=${encodeURIComponent(artist)}${durationQuery}`,
          { signal: controller.signal, cache: "no-store" }
        );
        if (!response.ok) {
          throw new Error("Failed to fetch lyrics");
        }
        const payload = (await response.json()) as LyricsPayload;
        setLyricsData(payload);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error("Failed to load lyrics payload:", error);
          setLyricsData(null);
        }
      } finally {
        setLyricsLoading(false);
      }
    }
    void loadLyrics();
    return () => controller.abort();
  }, [currentSong]);

  useEffect(() => {
    if (!currentSong) {
      setDurationSec(0);
      return;
    }
    setDurationSec(youtubeTimestampToSeconds(currentSong.duration) ?? 0);
  }, [currentSong]);

  useEffect(() => {
    const w = window as Window & {
      YT?: {
        Player: new (
          elementId: string,
          config: {
            height: string;
            width: string;
            videoId: string;
            playerVars?: Record<string, number>;
            events?: {
              onReady?: (event: { target: typeof ytPlayerRef.current }) => void;
              onStateChange?: (event: { data: number }) => void;
            };
          }
        ) => typeof ytPlayerRef.current;
      };
      onYouTubeIframeAPIReady?: () => void;
    };

    function initPlayer() {
      if (!w.YT?.Player) {
        return;
      }
      ytPlayerRef.current = new w.YT.Player(playerElementId, {
        height: "0",
        width: "0",
        videoId,
        playerVars: {
          controls: 0,
          modestbranding: 1,
          rel: 0,
        },
        events: {
          onReady: () => {
            playerReadyRef.current = true;
            if (progressIntervalRef.current) {
              window.clearInterval(progressIntervalRef.current);
            }
            progressIntervalRef.current = window.setInterval(() => {
              const player = ytPlayerRef.current;
              if (!player || !playerReadyRef.current) return;
              const current = player.getCurrentTime();
              const duration = player.getDuration();
              if (Number.isFinite(current)) {
                // Reduce re-render pressure: update only when time bucket changes.
                const bucket = Math.floor(current * 5); // 200ms buckets
                if (bucket !== lastTimeBucketRef.current) {
                  lastTimeBucketRef.current = bucket;
                  setCurrentTimeSec(current);
                }
              }
              if (Number.isFinite(duration) && duration > 0) {
                setDurationSec(duration);
              }
            }, 250);
            ytPlayerRef.current?.setVolume(volume);
          },
          onStateChange: (event) => {
            if (event.data === 1) {
              setIsPlaying(true);
            } else if (event.data === 2) {
              setIsPlaying(false);
            } else if (event.data === 0) {
              setIsPlaying(false);
              onNext();
            }
          },
        },
      });
    }

    if (w.YT?.Player) {
      initPlayer();
    } else {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      document.body.appendChild(script);
      w.onYouTubeIframeAPIReady = initPlayer;
    }

    return () => {
      if (progressIntervalRef.current) {
        window.clearInterval(progressIntervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onTogglePlay() {
    const player = ytPlayerRef.current;
    if (!player || !playerReadyRef.current) {
      return;
    }
    if (!isPlaying) {
      player.playVideo();
      setIsPlaying(true);
    } else {
      player.pauseVideo();
      setIsPlaying(false);
    }
  }

  function onNext() {
    if (!currentSong || queueSongs.length === 0) return;
    const idx = queueSongs.findIndex((s) => s.id === currentSong.id);
    const next = queueSongs[(idx + 1) % queueSongs.length];
    setCurrentSong(next);
    setCurrentTimeSec(0);
  }

  function onPrev() {
    if (!currentSong || queueSongs.length === 0) return;
    const idx = queueSongs.findIndex((s) => s.id === currentSong.id);
    const prev = queueSongs[(idx - 1 + queueSongs.length) % queueSongs.length];
    setCurrentSong(prev);
    setCurrentTimeSec(0);
  }

  function onViewChange(view: string) {
    setActiveView(view as typeof initialView);
    if (view === "search") {
      setIsSearchOpen(true);
      return;
    } else {
      setIsSearchOpen(false);
    }
    if (view === "home") router.push("/");
    if (view === "explorer") router.push("/explorer");
    if (view === "stats") router.push("/stats");
    if (view === "settings") router.push("/settings");
    if (view === "library") router.push("/library");
  }

  function onSongClick(song: Song) {
    setCurrentSong(song);
    setCurrentTimeSec(0);
    if (!queueSongs.some((q) => q.id === song.id)) {
      setQueueSongs((prev) => [song, ...prev]);
    }
  }

  function onSeek(nextTimeSec: number) {
    const player = ytPlayerRef.current;
    if (!player || !playerReadyRef.current || !Number.isFinite(nextTimeSec)) {
      return;
    }
    const safeDuration = durationSec > 0 ? durationSec : youtubeTimestampToSeconds(currentSong?.duration ?? "") ?? 0;
    const clamped = Math.max(0, Math.min(nextTimeSec, safeDuration || nextTimeSec));
    player.seekTo(clamped, true);
    setCurrentTimeSec(clamped);
  }

  function onVolumeChange(nextVolume: number) {
    const player = ytPlayerRef.current;
    const clamped = Math.max(0, Math.min(100, Math.round(nextVolume)));
    setVolume(clamped);
    if (!player || !playerReadyRef.current) {
      return;
    }
    player.setVolume(clamped);
  }

  return (
    <div className="relative h-screen overflow-hidden bg-[#06060a] text-zinc-100">
      <div
        className="pointer-events-none absolute inset-0 opacity-35"
        style={{
          background: `radial-gradient(circle at 18% 20%, ${themeColor}1f, transparent 45%), radial-gradient(circle at 82% 80%, ${themeColor}1a, transparent 45%)`,
        }}
      />
      <main className="relative z-10 flex h-full w-full">
        <LeftSidebar activeView={activeView} onViewChange={onViewChange} accentColor={themeColor} />
        {isSearchOpen ? (
          <SearchPage
            onClose={() => {
              setIsSearchOpen(false);
              setActiveView("home" as typeof initialView);
            }}
            onSongSelect={onSongClick}
            onQueueReplace={(songs) => {
              setQueueSongs(songs);
              if (!currentSong && songs.length > 0) {
                setCurrentSong(songs[0]);
              }
            }}
          />
        ) : activeView === "library" ? (
          <YouTubeLibrary onPlaylistClick={(playlist) => {
            console.log("Clicked playlist:", playlist);
            // Handle playlist click - maybe fetch tracks and update queue
          }} />
        ) : (
          <CenterPanel 
            accentColor={themeColor} 
            onSongClick={onSongClick} 
            seed={currentSong ? `${currentSong.artist} - ${currentSong.title}` : undefined}
          />
        )}
        <RightSidebar
          isOpen={isRightSidebarOpen}
          onClose={() => setIsRightSidebarOpen(false)}
          onSongClick={onSongClick}
          queueSongs={queueSongs}
          lyricsContent={
            lyricsData?.lyrics.content ||
            (lyricsLoading ? "Loading lyrics..." : "Lyrics not available for this track yet.")
          }
          currentTimeSec={currentTimeSec}
          currentArtist={audioData?.artist || currentSong?.artist || "Unknown"}
          lyricsSource={lyricsData?.lyrics.source || null}
          aiInsights={lyricsData?.geniusData.found ? "Genius metadata found for this song." : "AI insights are not available yet."}
          accentColor={themeColor}
          onSeek={onSeek}
        />
      </main>

      <div id={playerElementId} className="sr-only" />
      {currentSong && (
        <FloatingPlayer
          onExpand={() => setIsExpandedPlayerOpen(true)}
          onSearchClick={() => {
            setIsSearchOpen(true);
            setActiveView("search" as typeof initialView);
          }}
          currentSong={{
            ...currentSong,
            title: audioData?.trackName || currentSong.title,
            artist: audioData?.artist || currentSong.artist,
            artwork: audioData?.coverArt || currentSong.artwork,
          }}
          isPlaying={isPlaying}
          onTogglePlay={onTogglePlay}
          onNext={onNext}
          onPrev={onPrev}
          currentTimeSec={currentTimeSec}
          durationSec={durationSec}
        />
      )}

      {isExpandedPlayerOpen && currentSong && (
        <ExpandedPlayer
          onClose={() => setIsExpandedPlayerOpen(false)}
          currentSong={{
            ...currentSong,
            title: audioData?.trackName || currentSong.title,
            artist: audioData?.artist || currentSong.artist,
            artwork: audioData?.coverArt || currentSong.artwork,
          }}
          onSongClick={onSongClick}
          isPlaying={isPlaying}
          onTogglePlay={onTogglePlay}
          onNext={onNext}
          onPrev={onPrev}
          queueSongs={queueSongs}
          lyricsContent={
            lyricsData?.lyrics.content ||
            (lyricsLoading ? "Loading lyrics..." : "Lyrics not available for this track yet.")
          }
          lyricsSource={lyricsData?.lyrics.source || null}
          currentTimeSec={currentTimeSec}
          durationSec={durationSec}
          onSeek={onSeek}
          volume={volume}
          onVolumeChange={onVolumeChange}
          aiInsights={lyricsData?.geniusData.found ? "Genius metadata found for this song." : "AI insights are not available yet."}
        />
      )}

    </div>
  );
}
