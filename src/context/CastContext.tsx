"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { type Song } from "../components/echoai/types";

interface CastContextType {
  isCastApiAvailable: boolean;
  isCasting: boolean;
  castSession: any;
  remotePlayer: any;
  remotePlayerController: any;
  requestCastSession: () => Promise<void>;
  endCastSession: () => void;
  castMedia: (song: Song, audioUrl: string, currentTime: number, isPlaying: boolean) => void;
  playCast: () => void;
  pauseCast: () => void;
  seekCast: (time: number) => void;
  setCastVolume: (volume: number) => void;
}

const CastContext = createContext<CastContextType | null>(null);

export function CastProvider({ children }: { children: React.ReactNode }) {
  const [isCastApiAvailable, setIsCastApiAvailable] = useState(false);
  const [isCasting, setIsCasting] = useState(false);
  const [castSession, setCastSession] = useState<any>(null);
  const [remotePlayer, setRemotePlayer] = useState<any>(null);
  const [remotePlayerController, setRemotePlayerController] = useState<any>(null);

  const remotePlayerRef = useRef<any>(null);
  const remotePlayerControllerRef = useRef<any>(null);

  // Initialize Google Cast Context
  const initializeCastApi = () => {
    try {
      const castFramework = (window as any).cast?.framework;
      const chromeCast = (window as any).chrome?.cast;
      if (!castFramework || !chromeCast) return;

      const castContext = castFramework.CastContext.getInstance();
      castContext.setOptions({
        receiverApplicationId: chromeCast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
        autoJoinPolicy: chromeCast.AutoJoinPolicy.ORIGIN_SCOPED,
      });

      // Create RemotePlayer and RemotePlayerController
      const player = new castFramework.RemotePlayer();
      const controller = new castFramework.RemotePlayerController(player);

      setRemotePlayer(player);
      setRemotePlayerController(controller);
      remotePlayerRef.current = player;
      remotePlayerControllerRef.current = controller;

      setIsCastApiAvailable(true);

      // Listen for Cast Context session changes
      castContext.addEventListener(
        castFramework.CastContextEventType.SESSION_STATE_CHANGED,
        (event: any) => {
          const sessionState = event.sessionState;
          const currentSession = castContext.getCurrentSession();
          setCastSession(currentSession);

          if (
            sessionState === castFramework.SessionState.SESSION_STARTED ||
            sessionState === castFramework.SessionState.SESSION_RESUMED
          ) {
            setIsCasting(true);
          } else if (sessionState === castFramework.SessionState.SESSION_ENDED) {
            setIsCasting(false);
          }
        }
      );

      // If there is already an active/resumed session on load
      const activeSession = castContext.getCurrentSession();
      if (activeSession) {
        setCastSession(activeSession);
        setIsCasting(true);
      }
    } catch (e) {
      console.error("[CastContext] Failed to initialize Google Cast Context", e);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Hook API availability callback
    (window as any).__onGCastApiAvailable = (isAvailable: boolean) => {
      if (isAvailable) {
        initializeCastApi();
      }
    };

    // If script is already loaded
    if ((window as any).chrome?.cast?.isAvailable) {
      initializeCastApi();
    }
  }, []);

  const requestCastSession = async () => {
    try {
      const castFramework = (window as any).cast?.framework;
      if (!castFramework) return;
      const castContext = castFramework.CastContext.getInstance();
      await castContext.requestSession();
    } catch (e) {
      console.error("[CastContext] Error requesting Cast session:", e);
    }
  };

  const endCastSession = () => {
    try {
      const castFramework = (window as any).cast?.framework;
      if (!castFramework) return;
      const castContext = castFramework.CastContext.getInstance();
      const currentSession = castContext.getCurrentSession();
      if (currentSession) {
        currentSession.endSession(true);
      }
    } catch (e) {
      console.error("[CastContext] Error ending Cast session:", e);
    }
  };

  const castMedia = (song: Song, audioUrl: string, currentTime: number, isPlaying: boolean) => {
    try {
      const castFramework = (window as any).cast?.framework;
      const chromeCast = (window as any).chrome?.cast;
      if (!castFramework || !chromeCast || !castSession) return;

      // Use our proxy endpoint to serve the stream from the server IP (bypassing Google's client-IP locks)
      const proxyUrl = `${window.location.origin}/api/cast-stream?videoId=${song.id}`;

      const mediaInfo = new chromeCast.media.MediaInfo(proxyUrl, "audio/mp3");
      const metadata = new chromeCast.media.MusicTrackMediaMetadata();
      metadata.metadataType = chromeCast.media.MetadataType.MUSIC_TRACK;
      metadata.title = song.title;
      metadata.artist = song.artist;
      metadata.albumName = "Nexus Music";
      if (song.artwork) {
        metadata.images = [{ url: song.artwork }];
      }
      mediaInfo.metadata = metadata;

      const request = new chromeCast.media.LoadRequest(mediaInfo);
      request.currentTime = currentTime;
      request.autoplay = isPlaying;

      castSession.loadMedia(request).then(
        () => {
          console.log("[CastContext] Media load successful");
        },
        (error: any) => {
          console.error("[CastContext] Media load failed:", error);
        }
      );
    } catch (e) {
      console.error("[CastContext] Error loading media:", e);
    }
  };

  const playCast = () => {
    if (remotePlayerControllerRef.current && remotePlayerRef.current?.isPaused) {
      remotePlayerControllerRef.current.playOrPause();
    }
  };

  const pauseCast = () => {
    if (remotePlayerControllerRef.current && !remotePlayerRef.current?.isPaused) {
      remotePlayerControllerRef.current.playOrPause();
    }
  };

  const seekCast = (time: number) => {
    if (remotePlayerRef.current && remotePlayerControllerRef.current) {
      remotePlayerRef.current.currentTime = time;
      remotePlayerControllerRef.current.seek();
    }
  };

  const setCastVolume = (volume: number) => {
    if (remotePlayerRef.current && remotePlayerControllerRef.current) {
      remotePlayerRef.current.volumeLevel = volume / 100;
      remotePlayerControllerRef.current.setVolumeLevel();
    }
  };

  return (
    <CastContext.Provider
      value={{
        isCastApiAvailable,
        isCasting,
        castSession,
        remotePlayer,
        remotePlayerController,
        requestCastSession,
        endCastSession,
        castMedia,
        playCast,
        pauseCast,
        seekCast,
        setCastVolume,
      }}
    >
      {children}
    </CastContext.Provider>
  );
}

export function useCast() {
  const context = useContext(CastContext);
  if (!context) {
    throw new Error("useCast must be used within a CastProvider");
  }
  return context;
}
