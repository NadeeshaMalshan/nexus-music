"use client";

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { useDashboard } from "./DashboardContext";
import { type Song } from "@/components/echoai/types";
import Pusher, { PresenceChannel } from "pusher-js";

type JamState = {
  roomId: string | null;
  participants: number;
  isHost: boolean;
  isJoining: boolean;
};

type JamContextType = {
  jamState: JamState;
  createJam: () => Promise<string>;
  joinJam: (roomId: string) => Promise<void>;
  leaveJam: () => void;
};

const JamContext = createContext<JamContextType | undefined>(undefined);

const PUSHER_KEY = process.env.NEXT_PUBLIC_PUSHER_KEY || "";
const PUSHER_CLUSTER = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "";

export function JamProvider({ children }: { children: React.ReactNode }) {
  const dashboard = useDashboard();
  const [jamState, setJamState] = useState<JamState>({
    roomId: null,
    participants: 0,
    isHost: false,
    isJoining: false,
  });

  const pusherRef = useRef<Pusher | null>(null);
  const channelRef = useRef<any>(null);
  const senderIdRef = useRef<string>(Math.random().toString(36).substring(7));
  const isSyncingRef = useRef(false);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const jamStateRef = useRef(jamState);

  // Keep ref in sync with state
  useEffect(() => {
    jamStateRef.current = jamState;
  }, [jamState]);

  // Broadcast sync events via Direct Client Events (Blazing Fast)
  const broadcast = useCallback(async (type: string, payload: any) => {
    const currentState = jamStateRef.current;
    if (!currentState.roomId || isSyncingRef.current || !channelRef.current) return;
    
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

  // Improved Play/Pause with Retry Logic
  const safePlay = useCallback(async (startTime: number = 0) => {
    const player = dashboard.ytPlayerRef.current;
    if (!player) return;

    const tryPlay = () => {
        if (!dashboard.isPlaying) {
             dashboard.setIsPlaying(true);
        }
        try {
            if (startTime > 0) dashboard.onSeek(startTime);
            dashboard.playVideo();
        } catch (e) {
            console.warn("[Jam] Play failed, retrying...", e);
            setTimeout(tryPlay, 500);
        }
    };
    tryPlay();
  }, [dashboard]);

  const safePause = useCallback(() => {
    if (dashboard.isPlaying) {
        dashboard.setIsPlaying(false);
    }
    try {
        dashboard.pauseVideo();
    } catch (e) {
        console.warn("[Jam] Pause failed", e);
    }
  }, [dashboard]);

  // Connect and Subscribe to Channel
  const connectToJam = useCallback((id: string) => {
    if (!PUSHER_KEY) return;

    if (pusherRef.current) pusherRef.current.disconnect();

    const pusher = new Pusher(PUSHER_KEY, { 
        cluster: PUSHER_CLUSTER,
        channelAuthorization: {
            endpoint: "/api/jam/auth",
            transport: "ajax",
        }
    });

    pusherRef.current = pusher;
    const channel = pusher.subscribe(`presence-jam-${id}`) as PresenceChannel;
    channelRef.current = channel;

    const handleEvent = (data: any) => {
        const { type, payload } = data;
        if (payload?.senderId === senderIdRef.current) return;
        
        const now = Date.now();
        const latency = payload.timestamp ? (now - payload.timestamp) : 0;

        setSyncing(type === "sync-song" ? 2500 : 800); 
        
        switch (type) {
            case "join":
                if (jamStateRef.current.isHost) {
                   broadcast("sync-play", { isPlaying: dashboard.isPlaying, currentTime: dashboard.currentTimeSec });
                   broadcast("sync-song", { song: dashboard.currentSong });
                   broadcast("sync-queue", { queue: dashboard.upNextQueue });
                }
                break;
            case "sync-play":
                if (payload.isPlaying) {
                    const seekTo = payload.currentTime ? (payload.currentTime + (latency / 1000)) : 0;
                    safePlay(seekTo);
                } else {
                    safePause();
                }
                break;
            case "sync-song":
                if (payload.song.id !== dashboard.currentSong?.id) {
                    dashboard.onSongClick(payload.song, false);
                }
                break;
            case "sync-queue":
                if (JSON.stringify(payload.queue) !== JSON.stringify(dashboard.upNextQueue)) {
                   dashboard.setUpNextQueue(payload.queue);
                }
                break;
            case "sync-seek":
                const targetTime = payload.time + (latency / 1000);
                if (Math.abs(targetTime - dashboard.currentTimeSec) > 2) {
                    dashboard.onSeek(targetTime);
                }
                break;
        }
    };

    channel.bind("client-sync-event", handleEvent);
    channel.bind("sync-event", handleEvent);

    channel.bind("pusher:subscription_succeeded", (members: any) => {
        setJamState(prev => ({ ...prev, participants: members.count }));
    });
    channel.bind("pusher:member_added", () => {
        setJamState(prev => ({ ...prev, participants: channel.members?.count || 1 }));
    });
    channel.bind("pusher:member_removed", () => {
        setJamState(prev => ({ ...prev, participants: channel.members?.count || 1 }));
    });

  }, [dashboard, broadcast, safePlay, safePause]);

  // Sync state hooks
  useEffect(() => {
    if (!jamState.roomId || isSyncingRef.current) return;
    broadcast("sync-play", { 
        isPlaying: dashboard.isPlaying, 
        currentTime: dashboard.currentTimeSec 
    });
  }, [dashboard.isPlaying, jamState.roomId, broadcast, dashboard.currentTimeSec]);

  useEffect(() => {
    if (!jamState.roomId || isSyncingRef.current || !dashboard.currentSong) return;
    broadcast("sync-song", { song: dashboard.currentSong });
  }, [dashboard.currentSong?.id, jamState.roomId, broadcast]);

  useEffect(() => {
    if (!jamState.roomId || isSyncingRef.current) return;
    broadcast("sync-queue", { queue: dashboard.upNextQueue });
  }, [dashboard.upNextQueue, jamState.roomId, broadcast]);

  // Drift Correction: Host periodically syncs time to keep everyone together
  useEffect(() => {
    if (!jamState.roomId || !jamState.isHost || !dashboard.isPlaying || isSyncingRef.current) return;
    
    const interval = setInterval(() => {
        broadcast("sync-seek", { time: dashboard.currentTimeSec });
    }, 10000); // Check every 10s

    return () => clearInterval(interval);
  }, [jamState.isHost, jamState.roomId, dashboard.isPlaying, dashboard.currentTimeSec, broadcast]);

  const createJam = async () => {
    const id = Math.random().toString(36).substring(2, 8).toUpperCase();
    setJamState({ roomId: id, participants: 1, isHost: true, isJoining: false });
    connectToJam(id);
    return id;
  };

  const joinJam = async (id: string) => {
    setJamState({ roomId: id, participants: 1, isHost: false, isJoining: true });
    connectToJam(id);
    await broadcast("join", {}); // Alert others
    setJamState(prev => ({ ...prev, isJoining: false }));
  };

  const leaveJam = () => {
    if (pusherRef.current) {
        pusherRef.current.unsubscribe(`jam-${jamState.roomId}`);
        pusherRef.current.disconnect();
    }
    setJamState({ roomId: null, participants: 0, isHost: false, isJoining: false });
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
