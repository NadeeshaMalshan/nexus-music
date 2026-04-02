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
    
    // First try the ultra-fast Client Event (Direct Device-to-Device)
    try {
      const sent = channelRef.current.trigger(`client-sync-event`, { 
        type, 
        payload: { ...payload, senderId: senderIdRef.current } 
      });
      
      // If client event fails (e.g. not authorized yet), fallback to API trigger
      if (!sent) {
        await fetch("/api/jam/trigger", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            roomId: currentState.roomId, 
            type, 
            payload: { ...payload, senderId: senderIdRef.current } 
          }),
        });
      }
    } catch (err) {
      console.warn("[Jam] Client event failed, falling back to API:", err);
    }
  }, []);

  const setSyncing = (time = 500) => {
    isSyncingRef.current = true;
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => {
        isSyncingRef.current = false;
    }, time);
  };

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

    const channel = pusher.subscribe(`presence-jam-${id}`);
    channelRef.current = channel;

    // Listen for events from other devices
    const handleEvent = (data: any) => {
        const { type, payload } = data;
        if (payload?.senderId === senderIdRef.current) return;

        setSyncing(type === "sync-song" ? 2000 : 300); 
        
        switch (type) {
            case "join":
                if (jamStateRef.current.isHost) {
                   broadcast("sync-play", { isPlaying: dashboard.isPlaying });
                   broadcast("sync-song", { song: dashboard.currentSong });
                   broadcast("sync-queue", { queue: dashboard.upNextQueue });
                }
                setJamState(prev => ({ ...prev, participants: prev.participants + 1 }));
                break;
            case "sync-play":
                if (payload.isPlaying !== dashboard.isPlaying) {
                    if (payload.isPlaying) dashboard.playVideo();
                    else dashboard.pauseVideo();
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
                if (Math.abs(payload.time - dashboard.currentTimeSec) > 1.5) {
                    dashboard.onSeek(payload.time);
                }
                break;
        }
    };

    channel.bind("client-sync-event", handleEvent);
    channel.bind("sync-event", handleEvent); // Legacy fallback from API Trigger

    // Presence events for participant count
    channel.bind("pusher:subscription_succeeded", (members: any) => {
        setJamState(prev => ({ ...prev, participants: members.count }));
    });
    channel.bind("pusher:member_added", () => {
        setJamState(prev => ({ ...prev, participants: ((channel as PresenceChannel).members?.count || 1) }));
    });
    channel.bind("pusher:member_removed", () => {
        setJamState(prev => ({ ...prev, participants: ((channel as PresenceChannel).members?.count || 1) }));
    });

    console.log(`[Jam] Ultra-low latency Presence Channel: presence-jam-${id}`);
  }, [dashboard, broadcast]);

  // Sync state hooks: Playlist/Queue changes
  useEffect(() => {
    if (!jamState.roomId || isSyncingRef.current) return;
    broadcast("sync-queue", { queue: dashboard.upNextQueue });
  }, [dashboard.upNextQueue, jamState.roomId, broadcast]);

  useEffect(() => {
    if (!jamState.roomId || isSyncingRef.current) return;
    broadcast("sync-play", { isPlaying: dashboard.isPlaying });
  }, [dashboard.isPlaying, jamState.roomId, broadcast]);

  useEffect(() => {
    if (!jamState.roomId || isSyncingRef.current || !dashboard.currentSong) return;
    broadcast("sync-song", { song: dashboard.currentSong });
  }, [dashboard.currentSong?.id, jamState.roomId, broadcast]);

  const lastTimeRef = useRef(dashboard.currentTimeSec);
  useEffect(() => {
    if (!jamState.roomId || isSyncingRef.current) {
        lastTimeRef.current = dashboard.currentTimeSec;
        return;
    }
    const diff = Math.abs(dashboard.currentTimeSec - lastTimeRef.current);
    if (diff > 5) {
      broadcast("sync-seek", { time: dashboard.currentTimeSec });
    }
    lastTimeRef.current = dashboard.currentTimeSec;
  }, [dashboard.currentTimeSec, jamState.roomId, broadcast]);

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
