"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Hls from "hls.js";
import { MusicArtwork } from "./MusicArtwork";

type CanvasResult = {
  hasCanvas: boolean;
  animatedCover: { url: string; format?: "hls" | "mp4" | "unknown" } | null;
};

interface AnimatedCanvasArtworkProps {
  title: string;
  artist: string;
  album?: string;
  src?: string | null;
  alt?: string;
  className?: string;
  iconSize?: number;
  enabled?: boolean;
}

/** Fetches a motion cover when available and gracefully falls back to the regular artwork. */
export function AnimatedCanvasArtwork({
  title,
  artist,
  album,
  src,
  alt,
  className = "",
  iconSize = 24,
  enabled = true,
}: AnimatedCanvasArtworkProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [canvasUrl, setCanvasUrl] = useState<string | null>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const query = useMemo(() => {
    const params = new URLSearchParams({ title, artist });
    if (album) params.set("album", album);
    return params.toString();
  }, [title, artist, album]);

  useEffect(() => {
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    if (!enabled || !title.trim() || !artist.trim()) {
      setCanvasUrl(null);
      return;
    }
    const controller = new AbortController();
    setCanvasUrl(null);
    setVideoFailed(false);
    setVideoReady(false);
    fetch(`/api/canvas?${query}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<CanvasResult> : null)
      .then((data) => setCanvasUrl(data?.hasCanvas ? data.animatedCover?.url ?? null : null))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setCanvasUrl(null);
      });
    return () => controller.abort();
  }, [enabled, query, title, artist]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !canvasUrl || reducedMotion || videoFailed) return;
    video.muted = true;
    let hls: Hls | null = null;
    if (/\.m3u8(?:\?|$)/i.test(canvasUrl)) {
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = canvasUrl;
      } else if (Hls.isSupported()) {
        hls = new Hls({ enableWorker: true, lowLatencyMode: false, maxBufferLength: 12 });
        hls.loadSource(canvasUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => undefined);
        });
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) setVideoFailed(true);
        });
      } else {
        setVideoFailed(true);
      }
    } else {
      video.src = canvasUrl;
    }
    if (!/\.m3u8(?:\?|$)/i.test(canvasUrl) || video.canPlayType("application/vnd.apple.mpegurl")) {
      video.play().catch(() => undefined);
    }
    return () => {
      hls?.destroy();
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [canvasUrl, reducedMotion, videoFailed]);

  const showVideo = Boolean(canvasUrl && videoReady && !reducedMotion && !videoFailed);
  return (
    <div className={`relative h-full w-full overflow-hidden rounded-[inherit] ${className}`}>
      <div className={`absolute inset-0 rounded-[inherit] transition-opacity duration-500 ${showVideo ? "opacity-0" : "opacity-100"}`}>
        <MusicArtwork src={src} alt={alt ?? title} iconSize={iconSize} className="rounded-[inherit]" />
      </div>
      {canvasUrl && !reducedMotion && (
        <video
          ref={videoRef}
          muted
          playsInline
          autoPlay
          loop
          preload="auto"
          aria-label={`${alt ?? title} animated album artwork`}
          onCanPlay={() => setVideoReady(true)}
          onLoadedData={() => setVideoReady(true)}
          onPlaying={() => setVideoReady(true)}
          onError={() => { setVideoFailed(true); setVideoReady(false); }}
          className={`absolute inset-0 h-full w-full object-cover rounded-[inherit] transition-opacity duration-500 ${showVideo ? "opacity-100" : "opacity-0"}`}
        />
      )}
    </div>
  );
}
