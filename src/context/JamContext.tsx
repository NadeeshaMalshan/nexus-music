"use client";

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { useDashboard } from "./DashboardContext";
import { type Song } from "@/components/echoai/types";
import Pusher, { PresenceChannel } from "pusher-js";

type Listener = {
  id: string;
  name: string;
  image: string | null;
};

type JamState = {
  roomId: string | null;
  participants: number;
  listeners: Listener[];
  isHost: boolean;
  isJoining: boolean;
};

type JamContextType = {
  jamState: JamState;
  createJam: () => Promise<string>;
  joinJam: (roomId: string, name?: string) => Promise<void>;
  leaveJam: () => void;
};

const JamContext = createContext<JamContextType | undefined>(undefined);

const PUSHER_KEY = process.env.NEXT_PUBLIC_PUSHER_KEY || "";
const PUSHER_CLUSTER = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "";

export function JamProvider({ children }: { children: React.ReactNode }) {
  const dashboard = useDashboard();
  // Pusher handlers bind once per connection; always read latest player state through this ref.
  const dashboardRef = useRef(dashboard);
  dashboardRef.current = dashboard;

  const [jamState, setJamState] = useState<JamState>({
    roomId: null,
    participants: 0,
    listeners: [],
    isHost: false,
    isJoining: false,
  });

  const pusherRef = useRef<Pusher | null>(null);
  const channelRef = useRef<any>(null);
  const senderIdRef = useRef<string>(Math.random().toString(36).substring(7));
  const isSyncingRef = useRef(false);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const jamStateRef = useRef(jamState);
  const isInitialSyncCompletedRef = useRef(false);
  
  // NTP/RTT logic
  const rttRef = useRef<number>(0);
  const lastPingTimeRef = useRef<number>(0);
  const incomingSyncLockRef = useRef<boolean>(false);
  const localActionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastBroadcastPosRef = useRef<number>(0);
  const lastUpdateRef = useRef<number>(Date.now());

  // Keep ref in sync with state
  useEffect(() => {
    jamStateRef.current = jamState;
  }, [jamState]);

  // Sync Jam active state to Dashboard Context to override crossfade
  useEffect(() => {
    dashboard.setIsJamActive(!!jamState.roomId);
  }, [jamState.roomId, dashboard]);

  // Broadcast sync events via Direct Client Events (Blazing Fast)
  const broadcast = useCallback(async (type: string, payload: any, forced = false) => {
    const currentState = jamStateRef.current;
    
    // Bypass sync lock for utility events (pong, join) or if specifically forced
    const isUtilityEvent = type === "pong" || type === "join" || type === "ping";
    if (!currentState.roomId || (!isUtilityEvent && !forced && isSyncingRef.current) || !channelRef.current) return;
    
    try {
      const eventData = { 
        type, 
        payload: { ...payload, senderId: senderIdRef.current, timestamp: Date.now() } 
      };
      
      const sent = channelRef.current.trigger(`client-sync-event`, eventData);
      
      if (!sent) {
        await fetch("/api/jam/trigger", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId: currentState.roomId, ...eventData }),
        });
      }
    } catch (err) {
      console.warn("[Jam] Broadcast failed fallback:", err);
    }
  }, []);

  const setSyncing = (time = 500) => {
    isSyncingRef.current = true;
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => {
        isSyncingRef.current = false;
    }, time);
  };

  const setIncomingLock = (time = 800) => {
    incomingSyncLockRef.current = true;
    if (localActionTimeoutRef.current) clearTimeout(localActionTimeoutRef.current);
    localActionTimeoutRef.current = setTimeout(() => {
        incomingSyncLockRef.current = false;
    }, time);
  };

  // Atomic Play/Pause/Seek with Ready Check
  const safePlay = useCallback(async (startTime: number = 0) => {
    const d = dashboardRef.current;
    const player = d.ytPlayerRef.current;
    if (!player) return;
    
    setSyncing(1200); // Lock sync for 1.2s on play

    // Aggressive catch-up: If distance is too far, jump!
    const trySeekAndPlay = () => {
        try {
            const playerState = (player as any).getPlayerState();
            if (playerState === -1 || playerState === 3) {
                // If unstarted or buffering, wait 500ms and try again
                setTimeout(trySeekAndPlay, 500);
                return;
            }

            if (startTime > 0) {
               const playerTime = (player as any).getCurrentTime();
               if (Math.abs(startTime - playerTime) > 0.5) {
                   d.onSeek(startTime);
               }
            }
            d.playVideo();
        } catch (e) {
            console.warn("[Jam] Play failed, retrying in 500ms...", e);
            setTimeout(trySeekAndPlay, 500);
        }
    };
    trySeekAndPlay();
  }, []);

  const safePause = useCallback(() => {
    setSyncing(800); // Lock sync for 800ms on pause
    const d = dashboardRef.current;
    if (d.isPlaying) {
        d.setIsPlaying(false);
    }
    try {
        d.pauseVideo();
    } catch (e) {
        console.warn("[Jam] Pause failed", e);
    }
  }, []);

  // Smooth Sync Logic
  const applySmoothSync = useCallback((targetTime: number) => {
    const d = dashboardRef.current;
    const player = d.ytPlayerRef.current as any;
    if (!player) return;

    const diff = targetTime - d.currentTimeSec;
    const absDiff = Math.abs(diff);

    // 1. Threshold Check: If drift is negligible (< 100ms), do nothing
    if (absDiff < 0.1) {
        if (player.getPlaybackRate() !== 1) player.setPlaybackRate(1);
        return;
    }

    // 2. Force Update Threshold: If drift is greater than 500ms (as requested), snap immediately
    if (absDiff > 0.5) {
        d.onSeek(targetTime);
        if (player.getPlaybackRate() !== 1) player.setPlaybackRate(1);
        return;
    }

    // 3. Smooth Sync: If drift is between 100ms and 500ms, use subtle playback rate adjustment
    // This closes a 200ms gap in about 2 seconds with 1.1x speed.
    const adjustment = diff > 0 ? 1.1 : 0.9;
    try {
        if (player.getPlaybackRate() !== adjustment) {
            player.setPlaybackRate(adjustment);
            // Reset to normal after 3 seconds to re-evaluate
            setTimeout(() => {
                try {
                    if (player.getPlaybackRate() !== 1) player.setPlaybackRate(1);
                } catch {}
            }, 3000);
        }
    } catch (e) {
        // Only snap if we absolutely have to or if drift remains high
        if (absDiff > 0.3) d.onSeek(targetTime);
    }
  }, []);

  // Connect and Subscribe to Channel
  const connectToJam = useCallback((id: string, customName?: string, isHost: boolean = false) => {
    if (!PUSHER_KEY) return;
    if (pusherRef.current) pusherRef.current.disconnect();

    const headers: Record<string, string> = {};
    if (customName) headers["X-Jam-Name"] = encodeURIComponent(customName);
    if (isHost) headers["X-Jam-Host"] = "true";

    const pusher = new Pusher(PUSHER_KEY, { 
        cluster: PUSHER_CLUSTER,
        channelAuthorization: {
            endpoint: "/api/jam/auth",
            transport: "ajax",
            headers: Object.keys(headers).length > 0 ? headers : undefined
        }
    });

    pusherRef.current = pusher;
    const channel = pusher.subscribe(`presence-jam-${id}`) as PresenceChannel;
    channelRef.current = channel;

    const handleEvent = (data: any) => {
        const d = dashboardRef.current;
        const { type, payload } = data;
        if (payload?.senderId === senderIdRef.current) return;
        
        // State Locking: Ignore incoming syncs if we just had a local state transition
        if (incomingSyncLockRef.current && (type === "sync-play" || type === "sync-seek")) {
            console.log(`[Jam] Ignoring incoming ${type} due to local lock`);
            return;
        }

        const now = Date.now();
        const currentState = jamStateRef.current;

        // PING/PONG for RTT
        if (type === "ping") {
            // Ponies should always broadcast immediately
            broadcast("pong", { originalTimestamp: payload.timestamp }, true);
            return;
        }
        if (type === "pong") {
            if (payload.originalTimestamp === lastPingTimeRef.current) {
                const rtt = now - payload.originalTimestamp;
                rttRef.current = rtt;
                console.log(`[Jam] RTT Measured: ${rtt}ms`);
            }
            return;
        }

        const latency = payload.timestamp ? (now - payload.timestamp) : 0;
        // Use RTT if available (NTP-like: latency is approx RTT / 2)
        const adjustedLatency = rttRef.current > 0 ? (rttRef.current / 2) : latency;

        setSyncing(type === "sync-song" ? 3000 : (type === "sync-seek" ? 300 : 1000)); 
        
        switch (type) {
            case "join":
                if (currentState.isHost) {
                   // Broadcast the actual current state to the new member
                   broadcast("sync-play", { 
                        isPlaying: d.isPlaying, 
                        currentTime: d.currentTimeSec,
                        song: d.currentSong 
                   });
                   broadcast("sync-queue", { queue: d.upNextQueue });
                }
                break;
            case "sync-play":
                isInitialSyncCompletedRef.current = true;
                const targetSongId = payload.song?.id;
                // If song mismatch, sync song first (must use live state — handler closure is long-lived)
                if (targetSongId && targetSongId !== d.currentSong?.id) {
                    d.onSongClick(payload.song, false);
                } else if (!targetSongId) {
                    d.setCurrentSong(null);
                }
                
                if (payload.isPlaying) {
                    // Latency compensation for start time
                    const seekTo = payload.currentTime ? (payload.currentTime + (adjustedLatency / 1000)) : 0;
                    safePlay(seekTo);
                } else {
                    safePause();
                }
                break;
            case "sync-song":
                if (payload.song.id !== d.currentSong?.id) {
                    d.onSongClick(payload.song, false);
                }
                break;
            case "sync-queue":
                if (JSON.stringify(payload.queue) !== JSON.stringify(d.upNextQueue)) {
                    d.setUpNextQueue(payload.queue);
                }
                break;
            case "sync-seek":
                const targetTime = payload.time + (adjustedLatency / 1000);
                // Use smooth sync for seeking instead of jumping
                applySmoothSync(targetTime);
                break;
        }
    };

    channel.bind("client-sync-event", handleEvent);
    channel.bind("sync-event", handleEvent);

    channel.bind("pusher:subscription_succeeded", (members: any) => {
        const listeners: Listener[] = [];
        members.each((member: any) => {
            listeners.push({ id: member.id, ...member.info });
        });
        
        // Sort so host is always first
        listeners.sort((a, b) => ((b as any).isHost ? 1 : 0) - ((a as any).isHost ? 1 : 0));

        setJamState(prev => ({ ...prev, participants: members.count, listeners }));
        console.log(`[Jam] Connected! Total participants: ${members.count}`);
        
        // Clear local state only if we joined (NOT if we started it as host)
        if (!jamStateRef.current.isHost) {
            const d = dashboardRef.current;
            d.setUpNextQueue([]);
            d.setCurrentSong(null);
            safePause(); // Explicitly call safePause to stop the actual audio/video player hardware
            d.onSeek(0);
            
            console.log(`[Jam] Successfully joined session. Clear local state and stop background playback.`);

            // Request the host's current playback position and queue
            setTimeout(() => {
                broadcast("join", {}, true);
                console.log(`[Jam] Broadcasted "join" sync request to Host.`);
            }, 300);

            // Auto-fallback handshake complete to enable collaborative updates
            setTimeout(() => {
                isInitialSyncCompletedRef.current = true;
                console.log(`[Jam] Initial sync handshake marked complete (fallback).`);
            }, 3000);
        }
    });

    channel.bind("pusher:member_added", (member: any) => {
        const listeners: Listener[] = [];
        channel.members?.each((m: any) => {
            listeners.push({ id: m.id, ...m.info });
        });
        listeners.sort((a, b) => ((b as any).isHost ? 1 : 0) - ((a as any).isHost ? 1 : 0));
        setJamState(prev => ({ ...prev, participants: channel.members?.count || 1, listeners }));
        console.log(`[Jam] User Joined: ${member.info.name}. Total participants: ${channel.members?.count}`);
    });

    channel.bind("pusher:member_removed", (member: any) => {
        const listeners: Listener[] = [];
        channel.members?.each((m: any) => {
            listeners.push({ id: m.id, ...m.info });
        });
        listeners.sort((a, b) => ((b as any).isHost ? 1 : 0) - ((a as any).isHost ? 1 : 0));
        setJamState(prev => ({ ...prev, participants: channel.members?.count || 1, listeners }));
        console.log(`[Jam] User Left. Total participants: ${channel.members?.count}`);
    });

  }, [broadcast, safePlay, safePause, applySmoothSync]);

  // Sync state hooks - Optimized to prevent flooding
  useEffect(() => {
    if (!jamState.roomId || !isInitialSyncCompletedRef.current) return;
    
    // Broadcast major state changes immediately
    if (!isSyncingRef.current) {
        setIncomingLock(1500); 
        broadcast("sync-play", { 
            isPlaying: dashboard.isPlaying, 
            currentTime: dashboard.currentTimeSec,
            song: dashboard.currentSong 
        });
        lastBroadcastPosRef.current = dashboard.currentTimeSec;
    }
  }, [dashboard.isPlaying, dashboard.currentSong?.id, jamState.roomId, broadcast]);

  // Detect manual seeks
  useEffect(() => {
    if (!jamState.roomId || isSyncingRef.current || !isInitialSyncCompletedRef.current) return;
    
    const now = Date.now();
    const elapsedSinceLastUpdate = (now - lastUpdateRef.current) / 1000;
    // Account for normal playback progress
    const expectedPos = lastBroadcastPosRef.current + (dashboard.isPlaying ? elapsedSinceLastUpdate : 0);
    const drift = Math.abs(dashboard.currentTimeSec - expectedPos);

    if (drift > 2) {
        setIncomingLock(1500);
        broadcast("sync-seek", { time: dashboard.currentTimeSec });
        lastBroadcastPosRef.current = dashboard.currentTimeSec;
    } else {
        lastBroadcastPosRef.current = dashboard.currentTimeSec;
    }
    lastUpdateRef.current = now;
  }, [dashboard.currentTimeSec, dashboard.isPlaying, jamState.roomId, broadcast]);

  useEffect(() => {
    if (!jamState.roomId || isSyncingRef.current || !dashboard.currentSong || !isInitialSyncCompletedRef.current) return;
    broadcast("sync-song", { song: dashboard.currentSong });
  }, [dashboard.currentSong?.id, jamState.roomId, broadcast]);

  useEffect(() => {
    if (!jamState.roomId || isSyncingRef.current || !isInitialSyncCompletedRef.current) return;
    broadcast("sync-queue", { queue: dashboard.upNextQueue });
  }, [dashboard.upNextQueue, jamState.roomId, broadcast]);

  // Drift Correction & Periodic Heartbeat & RTT measurement
  useEffect(() => {
    if (!jamState.roomId || !dashboard.isPlaying || isSyncingRef.current) return;
    
    // Periodically measure RTT and broadcast sync
    const interval = setInterval(() => {
        if (jamState.isHost) {
            broadcast("sync-seek", { time: dashboard.currentTimeSec });
        } else if (jamState.roomId) {
            // Non-hosts ping the host/channel to measure RTT
            lastPingTimeRef.current = Date.now();
            broadcast("ping", {});
        }
    }, 10000); // Every 10s

    return () => clearInterval(interval);
  }, [jamState.isHost, jamState.roomId, dashboard.isPlaying, dashboard.currentTimeSec, broadcast]);

  const createJam = async () => {
    const id = Math.random().toString(36).substring(2, 8).toUpperCase();
    isInitialSyncCompletedRef.current = true; // Host is synced from start
    setJamState({ roomId: id, participants: 1, listeners: [], isHost: true, isJoining: false });
    connectToJam(id, undefined, true);
    return id;
  };

  const joinJam = async (id: string, name?: string) => {
    isInitialSyncCompletedRef.current = false; // Reset handshake flag for Guest
    setJamState({ roomId: id, participants: 1, listeners: [], isHost: false, isJoining: true });
    connectToJam(id, name, false);
    // Do NOT broadcast "join" immediately; we will trigger it in subscription_succeeded
    setJamState(prev => ({ ...prev, isJoining: false }));
  };

  const leaveJam = () => {
    const id = jamState.roomId;
    isInitialSyncCompletedRef.current = false;
    if (pusherRef.current && id) {
        pusherRef.current.unsubscribe(`presence-jam-${id}`);
        pusherRef.current.disconnect();
    }
    setJamState({ roomId: null, participants: 0, listeners: [], isHost: false, isJoining: false });
  };

  return (
    <JamContext.Provider value={{ jamState, createJam, joinJam, leaveJam }}>
      {children}
    </JamContext.Provider>
  );
}

export const useJam = () => {
  const context = useContext(JamContext);
  if (!context) throw new Error("useJam must be used within JamProvider");
  return context;
};
