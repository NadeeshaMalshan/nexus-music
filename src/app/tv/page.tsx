"use client";

import { useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { useDashboard } from "@/context/DashboardContext";
import { useDeviceSync } from "@/context/DeviceSyncContext";
import { DesktopExpandedPlayer } from "@/components/echoai/DesktopExpandedPlayer";
import { Monitor, Tv, Music, LogIn, Disc } from "lucide-react";
import { m, AnimatePresence } from "motion/react";

export default function TVPage() {
  const { data: session, status } = useSession();
  const [paired, setPaired] = useState(false);
  const [pairingName, setPairingName] = useState("Nexus TV");

  // Dashboard context hooks
  const dashboard = useDashboard();
  const deviceSync = useDeviceSync();

  // 1. Initialize custom device metadata in localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Set TV-specific Device ID and Name
    const storedId = window.localStorage.getItem("nexus_device_id");
    const generatedId = storedId || `tv-${Math.random().toString(36).substring(2, 10)}`;
    if (!storedId) {
      window.localStorage.setItem("nexus_device_id", generatedId);
    }
    
    window.localStorage.setItem("nexus_device_name", pairingName);
    setPaired(true);
  }, [pairingName]);

  // 2. Device control event listener (identical to FloatingPlayer but for TV Receiver context)
  useEffect(() => {
    if (typeof window === "undefined" || !deviceSync?.localDeviceId) return;

    const handleDeviceControl = (event: CustomEvent) => {
      const {
        action,
        song,
        seekTime,
        queueSongs: incomingQueue,
        upNextQueue: incomingUpNext,
        previousQueue: incomingPrev,
        targetDeviceId,
      } = event.detail;

      const isTarget = targetDeviceId === deviceSync.localDeviceId || action === "session:sync-all";

      if (!isTarget) return;

      switch (action) {
        case "play":
        case "player:play":
          if (!dashboard.isPlaying) dashboard.onTogglePlay();
          break;
        case "pause":
        case "player:pause":
          if (dashboard.isPlaying) dashboard.onTogglePlay();
          break;
        case "skip":
          dashboard.onNext();
          break;
        case "prev":
          dashboard.onPrev();
          break;
        case "player:seek":
          if (typeof seekTime === "number") {
            dashboard.onSeek(seekTime);
          }
          break;
        case "device:control-target":
        case "device:pull-track":
        case "session:sync-all":
          if (song) {
            dashboard.onSongClick(song, false);
          }
          if (typeof seekTime === "number") {
            dashboard.onSeek(seekTime);
          }
          if (Array.isArray(incomingQueue)) {
            dashboard.setQueueSongs(incomingQueue);
          }
          if (Array.isArray(incomingUpNext)) {
            dashboard.setUpNextQueue(incomingUpNext);
          }
          if (Array.isArray(incomingPrev)) {
            dashboard.setPreviousQueue(incomingPrev);
          }
          break;
      }
    };

    window.addEventListener("nexus-device-control", handleDeviceControl as EventListener);
    return () => {
      window.removeEventListener("nexus-device-control", handleDeviceControl as EventListener);
    };
  }, [dashboard, deviceSync?.localDeviceId]);

  // Handle loading state
  if (status === "loading" || !paired) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#050505] gap-4">
        <Disc size={48} className="animate-spin text-purple-500 opacity-80" />
        <p className="text-sm font-semibold tracking-[0.2em] text-white/40 uppercase">Initializing TV Vibe...</p>
      </div>
    );
  }

  // Handle unauthenticated state with a beautiful screen
  if (status === "unauthenticated") {
    return (
      <div className="relative flex h-screen w-screen flex-col items-center justify-center bg-[#050505] overflow-hidden">
        {/* Glow ambient background */}
        <div className="pointer-events-none absolute -inset-16 scale-110 opacity-30">
          <div className="w-full h-full bg-gradient-to-br from-purple-800/20 via-pink-900/10 to-transparent blur-[120px]" />
        </div>

        <m.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 flex flex-col items-center text-center max-w-xl px-6"
        >
          <div className="mb-8 rounded-3xl bg-white/5 p-6 border border-white/10 shadow-2xl backdrop-blur-md">
            <Tv size={64} className="text-purple-400 animate-pulse" />
          </div>

          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-none mb-4">
            Connect to your TV
          </h1>
          <p className="text-white/60 text-sm sm:text-base font-medium mb-10 max-w-md">
            Stream high-fidelity music, synchronized live lyrics, and dynamic visualizers directly to your display screen.
          </p>

          <button
            onClick={() => signIn()}
            className="flex items-center gap-3 rounded-full bg-white px-8 py-4 text-sm font-bold text-black hover:bg-white/90 active:scale-95 transition-all shadow-lg shadow-white/10"
          >
            <LogIn size={16} />
            <span>Sign In to Connect</span>
          </button>
        </m.div>
      </div>
    );
  }

  // If no song is selected or playing, show a clean pairing instructions dashboard
  if (!dashboard.currentSong) {
    return (
      <div className="relative flex h-screen w-screen flex-col items-center justify-center bg-[#050505] overflow-hidden">
        {/* Glow ambient background */}
        <div className="pointer-events-none absolute -inset-16 scale-110 opacity-30">
          <div className="w-full h-full bg-gradient-to-br from-indigo-800/10 via-purple-900/20 to-transparent blur-[140px]" />
        </div>

        <m.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 flex flex-col items-center text-center max-w-2xl px-6"
        >
          <div className="mb-6 flex gap-4 items-center justify-center">
            <div className="rounded-2xl bg-white/5 p-4 border border-white/5 backdrop-blur-md">
              <Tv size={40} className="text-purple-400" />
            </div>
            <div className="h-2 w-8 bg-white/10 rounded-full animate-pulse" />
            <div className="rounded-2xl bg-white/5 p-4 border border-white/5 backdrop-blur-md">
              <Music size={40} className="text-indigo-400 animate-bounce" />
            </div>
          </div>

          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-2">
            Ready to Cast
          </h2>
          <p className="text-purple-300/80 text-xs font-black uppercase tracking-[0.3em] mb-8">
            Device ID: {deviceSync?.localDeviceId}
          </p>

          <div className="w-full rounded-3xl border border-white/5 bg-white/[0.02] p-8 backdrop-blur-2xl shadow-3xl text-left space-y-6">
            <h3 className="text-lg font-bold text-white/90">How to play music on this TV:</h3>
            <ol className="list-decimal list-inside text-sm text-white/60 space-y-4 font-medium">
              <li>Open <span className="text-purple-400 font-semibold">{window.location.origin}</span> on your phone or computer.</li>
              <li>Log in to the same account (<span className="text-white/80">{session?.user?.email}</span>).</li>
              <li>Start playing any song.</li>
              <li>Click the <span className="text-purple-400 font-semibold">Devices</span> icon in the player controls and select <span className="text-white font-bold">{pairingName}</span>.</li>
            </ol>
          </div>

          <div className="mt-8 flex flex-col items-center gap-2">
            <label className="text-[10px] uppercase tracking-[0.2em] font-black text-white/30">Rename TV Screen</label>
            <input
              type="text"
              value={pairingName}
              onChange={(e) => setPairingName(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-full px-6 py-2 text-center text-sm font-bold text-white focus:outline-none focus:border-purple-500/50 transition-all max-w-[200px]"
            />
          </div>
        </m.div>
      </div>
    );
  }

  // Active TV Cast dashboard rendering DesktopExpandedPlayer in full screen
  return (
    <div className="w-screen h-screen bg-[#050505] overflow-hidden relative">
      {/* Floating Info Overlay showing that the display is casting */}
      <div className="absolute top-6 left-8 z-[100] flex items-center gap-2 rounded-full border border-white/5 bg-black/40 px-4 py-2 backdrop-blur-md shadow-lg pointer-events-none">
        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">Connected to {pairingName}</span>
      </div>

      <DesktopExpandedPlayer
        isOpen={true}
        onClose={() => {}}
        currentSong={dashboard.currentSong}
        onSongClick={dashboard.onSongClick}
        isPlaying={dashboard.isPlaying}
        onTogglePlay={dashboard.onTogglePlay}
        onNext={dashboard.onNext}
        onPrev={dashboard.onPrev}
        upNextQueue={dashboard.upNextQueue}
        onRemoveFromUpNext={dashboard.onRemoveFromUpNext}
        onClearQueue={dashboard.onClearQueue}
        lyricsContent={
          dashboard.lyricsData?.lyrics.content ||
          (dashboard.lyricsLoading ? "Loading lyrics..." : "Lyrics not available for this track.")
        }
        lyricsSource={dashboard.lyricsData?.lyrics.source || null}
        currentTimeSec={dashboard.currentTimeSec}
        durationSec={dashboard.durationSec}
        onSeek={dashboard.onSeek}
        volume={dashboard.volume}
        onVolumeChange={dashboard.setVolume}
        geniusData={dashboard.lyricsData?.geniusData}
        knowFacts={dashboard.knowFacts}
        knowLoading={dashboard.knowLoading}
        onRateSong={dashboard.onRateSong}
        isLiked={false}
        isLoggedIn={status === "authenticated"}
        setCurrentTimeSec={dashboard.setCurrentTimeSec}
        setIsPlaying={dashboard.setIsPlaying}
        viewMode={dashboard.viewMode}
        setViewMode={dashboard.setViewMode}
        playVideo={dashboard.playVideo}
        pauseVideo={dashboard.pauseVideo}
        pauseBackgroundPlayer={dashboard.pauseBackgroundPlayer}
        onArtistClick={() => {}}
      />
    </div>
  );
}
