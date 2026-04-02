"use client";

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { useDashboard } from "./DashboardContext";
import { type Song } from "@/components/echoai/types";
import Pusher from "pusher-js";

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
  const isSyncingRef = useRef(false);

  // Broadcast sync events via Next.js API Trigger
  const broadcast = useCallback(async (type: string, payload: any) => {
    if (!jamState.roomId || isSyncingRef.current) return;
    
    try {
      await fetch("/api/jam/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: jamState.roomId, type, payload }),
      });
    } catch (err) {
      console.error("[Jam] Failed to broadcast event:", err);
    }
  }, [jamState.roomId]);

  // Connect and Subscribe to Channel
  const connectToJam = useCallback((id: string) => {
    if (!PUSHER_KEY) {
        console.warn("[Jam] Pusher keys missing in .env.local. Jam will not work.");
        return;
    }

    if (pusherRef.current) pusherRef.current.disconnect();

    const pusher = new Pusher(PUSHER_KEY, { cluster: PUSHER_CLUSTER });
    pusherRef.current = pusher;

    const channel = pusher.subscribe(`jam-${id}`);
    channelRef.current = channel;

    channel.bind("sync-event", (data: any) => {
        isSyncingRef.current = true;
        
        const { type, payload } = data;
        switch (type) {
            case "sync-play":
                if (payload.isPlaying !== dashboard.isPlaying) {
                    dashboard.setIsPlaying(payload.isPlaying);
                }
                break;
            case "sync-song":
                if (payload.song.id !== dashboard.currentSong?.id) {
                    dashboard.onSongClick(payload.song, false);
                }
                break;
            case "sync-seek":
                if (Math.abs(payload.time - dashboard.currentTimeSec) > 2) {
                    dashboard.onSeek(payload.time);
                }
                break;
        }

        setTimeout(() => {
            isSyncingRef.current = false;
        }, 300);
    });

    console.log(`[Jam] Subscribed to Pusher channel: jam-${id}`);
  }, [dashboard]);

  // Sync state hooks
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
    setJamState({ roomId: id, participants: 0, isHost: false, isJoining: true });
    connectToJam(id);
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
