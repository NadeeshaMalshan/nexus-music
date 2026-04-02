"use client";

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { useDashboard } from "./DashboardContext";
import { type Song } from "@/components/echoai/types";

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

const WS_URL = process.env.NEXT_PUBLIC_JAM_WS_URL || "ws://127.0.0.1:3005";

export function JamProvider({ children }: { children: React.ReactNode }) {
  const dashboard = useDashboard();
  const [jamState, setJamState] = useState<JamState>({
    roomId: null,
    participants: 0,
    isHost: false,
    isJoining: false,
  });

  const socketRef = useRef<WebSocket | null>(null);
  const isSyncingRef = useRef(false);

  // Sync internal state with Jam events
  const broadcast = useCallback((type: string, payload: any) => {
    if (socketRef.current?.readyState === WebSocket.OPEN && jamState.roomId) {
      socketRef.current.send(JSON.stringify({ type, roomId: jamState.roomId, payload }));
    }
  }, [jamState.roomId]);

  // Handle incoming messages
  useEffect(() => {
    if (!socketRef.current) return;

    socketRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.roomId !== jamState.roomId) return;

      isSyncingRef.current = true; // Prevents broadcast loops
      
      switch (data.type) {
        case "sync-play":
          if (data.payload.isPlaying !== dashboard.isPlaying) {
            dashboard.setIsPlaying(data.payload.isPlaying);
          }
          break;
        case "sync-song":
          if (data.payload.song.id !== dashboard.currentSong?.id) {
            dashboard.onSongClick(data.payload.song, false);
          }
          break;
        case "sync-seek":
          if (Math.abs(data.payload.time - dashboard.currentTimeSec) > 2) {
            dashboard.onSeek(data.payload.time);
          }
          break;
        case "participants-update":
          setJamState(prev => ({ ...prev, participants: data.payload.count }));
          break;
      }

      setTimeout(() => {
        isSyncingRef.current = false;
      }, 100);
    };
  }, [jamState.roomId, dashboard]);

  // Broadcast local changes: Playing state
  useEffect(() => {
    if (!jamState.roomId || isSyncingRef.current) return;
    broadcast("sync-play", { isPlaying: dashboard.isPlaying });
  }, [dashboard.isPlaying, jamState.roomId, broadcast]);

  // Broadcast local changes: Song change
  useEffect(() => {
    if (!jamState.roomId || isSyncingRef.current || !dashboard.currentSong) return;
    broadcast("sync-song", { song: dashboard.currentSong });
  }, [dashboard.currentSong?.id, jamState.roomId, broadcast]);

  // Sync manual seeks (>5s jump)
  const lastTimeRef = useRef(dashboard.currentTimeSec);
  useEffect(() => {
    if (!jamState.roomId || isSyncingRef.current) {
        lastTimeRef.current = dashboard.currentTimeSec;
        return;
    }
    
    const diff = Math.abs(dashboard.currentTimeSec - lastTimeRef.current);
    if (diff > 5) {
      console.log(`[Jam] Manual seek detected (${diff}s), broadcasting...`);
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
  };

  const connectToJam = (id: string) => {
    if (socketRef.current) socketRef.current.close();
    
    const socket = new WebSocket(`${WS_URL}?roomId=${id}`);
    socketRef.current = socket;

    socket.onopen = () => {
      setJamState(prev => ({ ...prev, isJoining: false }));
      console.log(`[Jam] Connected successfully to Room: ${id}`);
    };

    socket.onerror = (err) => {
      console.error("[Jam] WebSocket Connection Error:", err);
    };

    socket.onclose = (event) => {
      console.warn(`[Jam] Connection closed. Code: ${event.code}, Reason: ${event.reason}`);
      if (socketRef.current === socket) {
        setJamState({ roomId: null, participants: 0, isHost: false, isJoining: false });
      }
    };
  };

  const leaveJam = () => {
    socketRef.current?.close();
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
