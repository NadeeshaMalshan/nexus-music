"use client";

import React, { useState, useEffect } from "react";
import { Play, Pause, SkipBack, SkipForward, Maximize2, Heart, ListMusic, Volume2, Users, Mic2, ChevronDown } from "lucide-react";
import { type Song } from "./types";
import { youtubeTimestampToSeconds } from "@/lib/duration";
import { m, AnimatePresence } from "motion/react";
import { MusicArtwork } from "./MusicArtwork";
import { APPLE_EASE, SLIDE_UP_VARIANTS } from "@/lib/animations";
import { useDashboard } from "@/context/DashboardContext";
import { useDeviceSync } from "@/context/DeviceSyncContext";
import { MarqueeText } from "./MarqueeText";
import { ArtistLinks } from "./ArtistLinks";

interface FloatingPlayerProps {
  onExpand: () => void;
  currentSong?: Song | null;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  currentTimeSec: number;
  durationSec: number;
  onRateSong: (videoId: string, rating: "like" | "none", meta?: { title: string; artist: string }) => void | Promise<{ pendingSync?: boolean }>;
  isLiked?: boolean;
  isLoggedIn?: boolean;
  onToggleRightSidebar?: () => void;
  isRightSidebarOpen?: boolean;
  rightSidebarMode?: "queue" | "jam" | "lyrics";
  onSetRightSidebarMode?: (mode: "queue" | "jam" | "lyrics") => void;
  volume: number;
  onVolumeChange: (v: number) => void;
  onArtistClick?: (artistName: string) => void;
  onSeek?: (time: number) => void;
}

export function FloatingPlayer({
  onExpand,
  currentSong,
  isPlaying,
  onTogglePlay,
  onNext,
  onPrev,
  currentTimeSec,
  durationSec,
  onRateSong,
  isLiked = false,
  isLoggedIn,
  onToggleRightSidebar,
  isRightSidebarOpen,
  rightSidebarMode,
  onSetRightSidebarMode,
  volume,
  onVolumeChange,
  onArtistClick,
  onSeek,
}: FloatingPlayerProps) {
  const {
    resolveLikedLibraryRateVideoId,
    liveMetadata,
    onSongClick,
    setQueueSongs,
    setUpNextQueue,
    setPreviousQueue,
    setIsPlaying,
    pauseBackgroundPlayer,
    queueSongs,
    upNextQueue,
    previousQueue,
  } = useDashboard();
  const { crossDeviceState, activeDeviceCount, activeDevices, localDeviceId, triggerDeviceControl } = useDeviceSync();
  const [isDeviceMenuOpen, setIsDeviceMenuOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<string>("Play individually");

  const otherDevices = activeDevices.filter((device) => device.deviceId !== localDeviceId);
  const localDevice = activeDevices.find(d => d.deviceId === localDeviceId);
  const controlledTarget = localDevice?.syncMode === "controller" ? otherDevices.find(d => d.deviceId === localDevice.targetDeviceId) : null;

  const isLinked = localDevice && localDevice.syncMode !== "standalone";
  const activeCrossDeviceState = isLinked ? crossDeviceState : null;
  const isIdle = !currentSong && !activeCrossDeviceState?.song;

  // Handle device control events from WebSocket
  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleDeviceControl = (event: CustomEvent) => {
      const { action, song, seekTime, queueSongs: incomingQueue, upNextQueue: incomingUpNext, previousQueue: incomingPrev, targetDeviceId, controllerDeviceId } = event.detail;
      
      const isTarget = targetDeviceId === localDeviceId || action === "session:sync-all";
      
      switch (action) {
        case "play":
        case "player:play":
          if (isTarget && !isPlaying) onTogglePlay();
          break;
        case "pause":
        case "player:pause":
          if (isTarget && isPlaying) onTogglePlay();
          break;
        case "skip":
          if (isTarget) onNext();
          break;
        case "prev":
          if (isTarget) onPrev();
          break;
        case "player:seek":
          if (isTarget && typeof seekTime === "number" && onSeek) {
            onSeek(seekTime);
          }
          break;
        case "device:control-target":
        case "device:pull-track":
        case "session:sync-all":
          if (isTarget) {
            if (song) {
              onSongClick(song, false);
            }
            if (typeof seekTime === "number" && onSeek) {
              onSeek(seekTime);
            }
            if (Array.isArray(incomingQueue)) {
              setQueueSongs(incomingQueue);
            }
            if (Array.isArray(incomingUpNext)) {
              setUpNextQueue(incomingUpNext);
            }
            if (Array.isArray(incomingPrev)) {
              setPreviousQueue(incomingPrev);
            }
          } else if (controllerDeviceId === localDeviceId) {
            pauseBackgroundPlayer?.();
            setIsPlaying?.(false);
          }
          break;
      }
    };

    window.addEventListener('nexus-device-control', handleDeviceControl as EventListener);
    return () => {
      window.removeEventListener('nexus-device-control', handleDeviceControl as EventListener);
    };
  }, [isPlaying, onTogglePlay, onNext, onPrev, onSeek, onSongClick, setQueueSongs, setUpNextQueue, setPreviousQueue, setIsPlaying, pauseBackgroundPlayer, localDeviceId]);

  const remoteSong = controlledTarget?.currentSong || (localDevice?.syncMode === "controlled" ? activeCrossDeviceState?.song : null);

  const displaySong = {
    id: currentSong?.id || remoteSong?.id || "idle",
    title: liveMetadata?.title || currentSong?.title || remoteSong?.title || "Nexus Music",
    artist: liveMetadata?.artist || currentSong?.artist || remoteSong?.artist || "Ready to stream",
    artwork: liveMetadata?.artwork || currentSong?.artwork || remoteSong?.artwork || null,
    duration: currentSong?.duration || remoteSong?.duration || "0:00",
    color: currentSong?.color || remoteSong?.color || "#FA243C",
  };

  const fallbackDuration = youtubeTimestampToSeconds(displaySong.duration) ?? 0;
  const safeDuration = durationSec > 0 ? durationSec : fallbackDuration;
  const isReallyLive = currentSong?.isLive || displaySong.duration === "LIVE" || !!liveMetadata || safeDuration > 43200 || (!isIdle && (crossDeviceState ? (crossDeviceState.isPlaying ?? isPlaying) : isPlaying) && safeDuration === 0);
  const progress = safeDuration > 0 ? Math.min(100, (Math.max(0, currentTimeSec) / safeDuration) * 100) : 0;

  useEffect(() => {
    if (localDevice) {
      if (localDevice.syncMode === "controller" && localDevice.targetDeviceId) {
        const target = otherDevices.find(d => d.deviceId === localDevice.targetDeviceId);
        if (target) {
          setSelectedAction(`Play on ${target.deviceName}`);
          return;
        }
      }
      if (localDevice.syncMode === "controlled") {
        setSelectedAction("Play on your device");
        return;
      }
      if (localDevice.syncMode === "party") {
        setSelectedAction("Group Play / Party Mode");
        return;
      }
    }

    setSelectedAction("Play individually");
  }, [otherDevices, localDevice]);

  const activeIsPlaying = activeCrossDeviceState ? (activeCrossDeviceState.isPlaying ?? isPlaying) : isPlaying;

  const handlePlayToggle = async () => {
    if (activeCrossDeviceState) {
      await triggerDeviceControl({
        action: activeIsPlaying ? "pause" : "play",
        targetDeviceId: activeCrossDeviceState.deviceId
      });
    } else {
      onTogglePlay();
    }
  };

  const handleNext = async () => {
    if (activeCrossDeviceState) {
      await triggerDeviceControl({
        action: "skip",
        targetDeviceId: activeCrossDeviceState.deviceId
      });
    } else {
      onNext();
    }
  };

  const handlePrev = async () => {
    if (activeCrossDeviceState) {
      await triggerDeviceControl({
        action: "prev",
        targetDeviceId: activeCrossDeviceState.deviceId
      });
    } else {
      onPrev();
    }
  };

  const handleSeek = async (time: number) => {
    if (activeCrossDeviceState) {
      await triggerDeviceControl({
        action: "player:seek",
        targetDeviceId: activeCrossDeviceState.deviceId,
        seekTime: time
      });
    } else if (onSeek) {
      onSeek(time);
    }
  };

  return (
    <div className="relative w-full max-w-[800px] mx-auto mb-24 md:mb-10 lg:mb-12 flex flex-col items-center justify-end pointer-events-none">
      {/* Device Control Popup */}
      <AnimatePresence>
        {isDeviceMenuOpen && (
          <m.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute bottom-[100px] left-4 md:left-6 w-[320px] max-h-[460px] overflow-y-auto bg-[#111111] rounded-3xl shadow-2xl border border-white/10 p-4 pointer-events-auto z-50 flex flex-col gap-4"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-white font-bold text-base">Device Control</div>
                <div className="text-white/50 text-xs">Manage playback across your active ecosystem devices.</div>
              </div>
              <div className="text-white/50 text-xs">{otherDevices.length} devices</div>
            </div>

            {otherDevices.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-white/60 text-sm">
                No other active devices in your ecosystem.
              </div>
            ) : (
              <>
                {/* Songs playing on other devices at the top */}
                <div className="flex flex-col gap-2 max-h-[160px] overflow-y-auto pr-1">
                  {otherDevices.map((device) => {
                    const song = device.currentSong;
                    return (
                      <div key={device.deviceId} className="rounded-2xl border border-white/10 bg-white/5 p-2 flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl overflow-hidden bg-slate-900 shrink-0">
                          <MusicArtwork src={song?.artwork || undefined} alt={song?.title || device.deviceName} iconSize={12} rounded="none" className="w-full h-full" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-white font-semibold text-xs truncate">{song?.title || "No song playing"}</div>
                          <div className="text-white/60 text-[10px] uppercase tracking-wider truncate">{song?.artist || "Waiting for playback"}</div>
                          <div className="text-[9px] text-white/40 mt-0.5 truncate">{device.deviceName} • {device.isPlaying ? "PLAYING" : "IDLE"}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Unified action menu at the bottom */}
                <div className="border-t border-white/10 pt-3 space-y-2">
                  <div className="text-white/40 text-[10px] uppercase tracking-[.2em] font-semibold mb-1 pl-1">Actions</div>
                  {[
                    "Play individually",
                    ...otherDevices.map((d) => `Play on ${d.deviceName}`),
                    "Play on your device",
                    "Group Play / Party Mode"
                  ].map((actionText) => {
                    const isChecked = selectedAction === actionText;
                    return (
                      <label
                        key={actionText}
                        className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#141414] px-3 py-2 cursor-pointer transition hover:border-white/30"
                      >
                        <input
                          type="radio"
                          name="device-ecosystem-action"
                          value={actionText}
                          checked={isChecked}
                          onChange={async () => {
                            setSelectedAction(actionText);
                            if (typeof window !== 'undefined') {
                              window.localStorage.setItem('crossDeviceAction', actionText);
                            }

                            if (actionText === "Play individually") {
                              await triggerDeviceControl({ action: "device:decouple", deviceId: localDeviceId });
                              for (const d of otherDevices) {
                                await triggerDeviceControl({ action: "device:decouple", deviceId: d.deviceId });
                              }
                            } else if (actionText.startsWith("Play on ")) {
                              const deviceNamePart = actionText.replace("Play on ", "");
                              const targetDevice = otherDevices.find((d) => d.deviceName === deviceNamePart);
                              if (targetDevice) {
                                await triggerDeviceControl({
                                  action: "device:control-target",
                                  controllerDeviceId: localDeviceId,
                                  targetDeviceId: targetDevice.deviceId,
                                  song: currentSong,
                                  seekTime: currentTimeSec,
                                  queueSongs,
                                  upNextQueue,
                                  previousQueue
                                });
                              }
                            } else if (actionText === "Play on your device") {
                              const targetDevice = otherDevices.find((d) => d.currentSong) || otherDevices[0];
                              if (targetDevice) {
                                await triggerDeviceControl({
                                  action: "device:pull-track",
                                  controllerDeviceId: localDeviceId,
                                  targetDeviceId: targetDevice.deviceId,
                                  seekTime: currentTimeSec,
                                  queueSongs,
                                  upNextQueue,
                                  previousQueue
                                });
                              }
                            } else if (actionText === "Group Play / Party Mode") {
                              await triggerDeviceControl({
                                action: "session:sync-all",
                                deviceIds: otherDevices.map((d) => d.deviceId),
                                song: currentSong,
                                seekTime: currentTimeSec,
                                queueSongs,
                                upNextQueue,
                                previousQueue
                              });
                            }
                          }}
                          className="accent-[var(--art-accent,#1db954)]"
                        />
                        <span className="text-xs text-white">{actionText}</span>
                      </label>
                    );
                  })}
                </div>
              </>
            )}
          </m.div>
        )}
      </AnimatePresence>

      {/* Cross-Device Playback Indicator */}
      <AnimatePresence>
        {activeCrossDeviceState && (
          <m.div
            onClick={() => setIsDeviceMenuOpen(!isDeviceMenuOpen)}
            initial={{ height: 0, opacity: 0, y: 10 }}
            animate={{ height: 28, opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: 10 }}
            className="w-[98%] max-w-[780px] text-black overflow-hidden rounded-t-xl -mb-2 pb-2 px-6 flex justify-between items-center pointer-events-auto z-0 cursor-pointer hover:brightness-110 transition-all"
            style={{ backgroundColor: 'var(--art-accent, #1db954)' }}
          >
            <span className="text-base font-bold tracking-wide">
              {activeDeviceCount > 2 ? `Active in ${activeDeviceCount - 1} devices` : `Active in ${activeCrossDeviceState.deviceName}`}
            </span>
            {activeDeviceCount <= 2 && (
              <span className="text-base font-semibold opacity-75 max-w-[40%] truncate">
                {activeCrossDeviceState.song?.title}
              </span>
            )}
          </m.div>
        )}
      </AnimatePresence>

      <m.div 
        className="group relative flex h-[76px] w-full items-center justify-between gap-6 border border-white/10 px-6 shadow-[0_30px_60px_rgba(0,0,0,0.8)] rounded-2xl overflow-hidden pointer-events-auto bg-[#0a0a0a]/90 backdrop-blur-2xl z-10"
      >
          
          {/* Left Section: Playback Controls */}
          <div className={`flex items-center gap-3 md:gap-5 shrink-0 ${isIdle ? 'opacity-40 grayscale' : ''}`}>
            <button 
              onClick={handlePrev} 
              disabled={isIdle}
              className="text-white/40 hover:text-white disabled:cursor-not-allowed"
            >
              <SkipBack className="w-5 h-5 md:w-6 md:h-6" fill="currentColor" strokeWidth={0} />
            </button>
            
            <button
              onClick={handlePlayToggle}
              disabled={isIdle}
              className="text-white hover:scale-105 active:scale-95 transition-transform disabled:cursor-not-allowed"
              style={{ color: isIdle ? 'white' : 'var(--art-accent, white)' }}
            >
              {activeIsPlaying ? (
                <Pause className="w-8 h-8" fill="currentColor" strokeWidth={0} />
              ) : (
                <Play className="w-8 h-8" fill="currentColor" strokeWidth={0} />
              )}
            </button>
            
            <button 
              onClick={handleNext} 
              disabled={isIdle}
              className="text-white/40 hover:text-white disabled:cursor-not-allowed"
            >
              <SkipForward className="w-5 h-5 md:w-6 md:h-6" fill="currentColor" strokeWidth={0} />
            </button>
          </div>

          {/* Center Section: Compact Dynamic Track Component */}
          <m.div 
            layout
            className="flex-1 min-w-0 max-w-[400px]"
          >
            <div 
              onClick={!isIdle ? onExpand : undefined}
              className={`relative flex items-center gap-4 bg-white/5 rounded-xl p-1.5 pr-6 border border-transparent overflow-hidden ${
                !isIdle 
                  ? "cursor-pointer group/card hover:bg-white/10 hover:border-white/10 transition-all duration-300" 
                  : "cursor-default opacity-80"
              }`}
            >
              {/* Artwork Wrapper */}
              <div className={`relative h-12 w-12 shrink-0 overflow-hidden rounded-lg shadow-md border border-white/5 ${!isIdle ? 'group-hover/card:scale-[1.02] transition-transform' : ''}`}>
                 <MusicArtwork src={displaySong.artwork} alt={displaySong.title} iconSize={20} rounded="none" className="w-full h-full" />
                 {!isIdle && (
                   <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover/card:opacity-100 transition-opacity">
                      <Maximize2 size={16} className="text-white" />
                   </div>
                 )}
                 {isIdle && (
                   <m.div 
                     animate={{ opacity: [0.1, 0.2, 0.1] }}
                     transition={{ duration: 3, repeat: Infinity, ease: APPLE_EASE }}
                     className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent"
                   />
                 )}
              </div>

              {/* Scrolling Song Info */}
              <div className="min-w-[120px] flex-1 overflow-hidden">
                 <div className="flex flex-col justify-center h-full">
                    <MarqueeText 
                      text={displaySong.title} 
                      className="text-[16px] font-black text-white tracking-tighter leading-none mb-1" 
                    />
                    <div
                      className={`w-full text-left truncate ${
                        !isIdle && onArtistClick
                          ? "cursor-pointer"
                          : "cursor-default"
                      }`}
                    >
                      <ArtistLinks
                        artist={displaySong.artist}
                        onArtistClick={!isIdle ? onArtistClick : undefined}
                        className="text-[11px] font-black uppercase tracking-widest text-white/40 leading-none"
                      />
                    </div>
                 </div>
              </div>

            </div>
          </m.div>

          {/* Right Section: Interactive Controls */}
          <div className="flex items-center gap-3 md:gap-6 shrink-0">
            {isLoggedIn && !isIdle && (
              <button
                onClick={() => {
                  if (isLiked) void onRateSong(resolveLikedLibraryRateVideoId(displaySong as Song), "none");
                  else void onRateSong(displaySong.id, "like", { title: displaySong.title, artist: displaySong.artist });
                }}
                className=""
              >
                <Heart
                  size={20}
                  fill={isLiked ? "var(--art-accent, #FA243C)" : "none"}
                  stroke={isLiked ? "var(--art-accent, #FA243C)" : "currentColor"}
                  className={isLiked ? "" : "text-white/30 hover:text-white"}
                />
              </button>
            )}
            {/* Functional Volume Slider */}
            <div className="hidden items-center gap-2 lg:flex group/vol relative">
              <div className="w-0 overflow-hidden group-hover/vol:w-24 group-hover/vol:mr-3">
                 <input 
                   type="range"
                   min="0"
                   max="100"
                   step="1"
                   value={volume}
                   onChange={(e) => onVolumeChange(parseInt(e.target.value))}
                   className="w-full h-1 appearance-none bg-white/10 rounded-full outline-none cursor-pointer accent-white"
                   style={{ accentColor: 'var(--art-accent, white)' }}
                 />
              </div>
              <Volume2 size={20} className="text-white/30 group-hover/vol:text-white" />

              
            </div>

            <div className="h-6 w-px bg-white/10 mx-1 hidden md:block" />

            <button 
              onClick={() => {
                if (rightSidebarMode === "lyrics" && isRightSidebarOpen) {
                   onToggleRightSidebar?.();
                } else {
                   onSetRightSidebarMode?.("lyrics");
                   if (!isRightSidebarOpen) onToggleRightSidebar?.();
                }
              }}
              className="hidden md:block transition-all transform hover:scale-110 active:scale-90"
              style={{ color: (isRightSidebarOpen && rightSidebarMode === "lyrics") ? 'var(--art-accent, #FA243C)' : undefined }}
            >
               <Mic2 size={20} className={(!isRightSidebarOpen || rightSidebarMode !== "lyrics") ? "text-white/40 hover:text-white" : ""} />
            </button>

            <button 
              onClick={() => {
                if (rightSidebarMode === "jam" && isRightSidebarOpen) {
                   onToggleRightSidebar?.();
                } else {
                   onSetRightSidebarMode?.("jam");
                   if (!isRightSidebarOpen) onToggleRightSidebar?.();
                }
              }}
              className="hidden md:block transition-all transform hover:scale-110 active:scale-90"
              style={{ color: (isRightSidebarOpen && rightSidebarMode === "jam") ? 'var(--art-accent, #FA243C)' : undefined }}
            >
               <Users size={22} strokeWidth={2.5} className={(!isRightSidebarOpen || rightSidebarMode !== "jam") ? "text-white/40 hover:text-white" : ""} />
            </button>

            <button 
              onClick={() => {
                if (rightSidebarMode === "queue" && isRightSidebarOpen) {
                   onToggleRightSidebar?.();
                } else {
                   onSetRightSidebarMode?.("queue");
                   if (!isRightSidebarOpen) onToggleRightSidebar?.();
                }
              }}
              className="hidden md:block transition-all transform hover:scale-110 active:scale-90"
              style={{ color: (isRightSidebarOpen && rightSidebarMode === "queue") ? 'var(--art-accent, #FA243C)' : undefined }}
            >
               <ListMusic size={24} strokeWidth={2.5} className={(!isRightSidebarOpen || rightSidebarMode !== "queue") ? "text-white/40 hover:text-white" : ""} />
            </button>
            
            
            
          </div>

          {/* Interactive Linear Progress Indicator (Outer Bottom Edge) */}
          {!isReallyLive && (
            <div className="absolute bottom-0 left-0 right-0 h-3 group/seek flex items-end z-20">
              <input
                type="range"
                min={0}
                max={safeDuration || 100}
                value={currentTimeSec || 0}
                onChange={(e) => {
                  handleSeek(parseFloat(e.target.value));
                }}
                className="w-full h-[3px] appearance-none bg-white/5 cursor-pointer hover:h-[5px] transition-[height] m-0 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-0 [&::-webkit-slider-thumb]:h-0 [&::-moz-range-thumb]:w-0 [&::-moz-range-thumb]:h-0 [&::-moz-range-thumb]:border-0 group-hover/seek:[&::-webkit-slider-thumb]:w-3 group-hover/seek:[&::-webkit-slider-thumb]:h-3 group-hover/seek:[&::-webkit-slider-thumb]:rounded-full group-hover/seek:[&::-webkit-slider-thumb]:bg-white group-hover/seek:[&::-webkit-slider-thumb]:shadow-md group-hover/seek:[&::-moz-range-thumb]:w-3 group-hover/seek:[&::-moz-range-thumb]:h-3 group-hover/seek:[&::-moz-range-thumb]:rounded-full group-hover/seek:[&::-moz-range-thumb]:bg-white group-hover/seek:[&::-moz-range-thumb]:border-0 group-hover/seek:[&::-moz-range-thumb]:shadow-md"
                style={{
                  background: `linear-gradient(to right, var(--art-accent, #FA243C) ${progress}%, transparent ${progress}%)`,
                }}
              />
            </div>
          )}
      </m.div>
    </div>
  );
}
