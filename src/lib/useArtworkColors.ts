"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export interface ArtworkPalette {
  /** 60% – dominant background color (darkened for UI use) */
  primary: string;
  /** 30% – secondary/mid color */
  secondary: string;
  /** 10% – vibrant accent used for highlights / buttons */
  accent: string;
}

const DEFAULT_PALETTE: ArtworkPalette = {
  primary: "#0d0b14",
  secondary: "#1a1528",
  accent: "#a855f7",
};

function hexToRgb(hex: string): [number, number, number] | null {
  const h = hex.replace(/^#/, "").trim();
  if (h.length !== 6 || !/^[a-f\d]+$/i.test(h)) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** When no artwork image, derive FlowingBackground tones from the app accent (replaces fixed purple DEFAULT_PALETTE). */
export function paletteFromAccent(accentHex: string): ArtworkPalette {
  const rgb = hexToRgb(accentHex.trim() || "#FA233B");
  if (!rgb) return DEFAULT_PALETTE;
  const [h, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2]);
  const [ph, ps, pl] = darkenHsl(h, s, l, 58);
  const [sh, ss, sl] = darkenHsl(h, Math.min(s, 34), l, 42);
  const [ah, as2, al] = vibrifyHsl(h, s, l);
  return {
    primary: hslToHex(ph, ps, pl),
    secondary: hslToHex(sh, ss, sl),
    accent: hslToHex(ah, as2, al),
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [h * 360, s * 100, l * 100];
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, "0");
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

/** Darken a color for readability as a background */
function darkenHsl(h: number, s: number, l: number, amount = 60): [number, number, number] {
  return [h, Math.min(s, 30), Math.max(4, l - amount)];
}

/** Boost saturation + lightness so the accent pops */
function vibrifyHsl(h: number, s: number, l: number): [number, number, number] {
  return [h, Math.min(100, s + 40), Math.min(70, Math.max(50, l + 20))];
}

/** Simple squared Euclidean distance in RGB space */
function colorDistance(a: [number, number, number], b: [number, number, number]) {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

/** K-means colour clustering */
function kmeans(
  pixels: [number, number, number][],
  k: number,
  iterations = 8,
): [number, number, number][] {
  if (pixels.length === 0) return Array(k).fill([128, 128, 128]);
  // Seed centroids by spreading across the pixel array
  const step = Math.floor(pixels.length / k);
  let centroids: [number, number, number][] = Array.from({ length: k }, (_, i) => [
    ...pixels[Math.min(i * step, pixels.length - 1)],
  ] as [number, number, number]);

  for (let iter = 0; iter < iterations; iter++) {
    const clusters: [number, number, number][][] = Array.from({ length: k }, () => []);
    for (const px of pixels) {
      let best = 0, bestDist = Infinity;
      for (let c = 0; c < k; c++) {
        const d = colorDistance(px, centroids[c]);
        if (d < bestDist) { bestDist = d; best = c; }
      }
      clusters[best].push(px);
    }
    for (let c = 0; c < k; c++) {
      if (clusters[c].length === 0) continue;
      const avg = clusters[c].reduce(
        (acc, px) => [acc[0] + px[0], acc[1] + px[1], acc[2] + px[2]],
        [0, 0, 0],
      ).map(v => v / clusters[c].length) as [number, number, number];
      centroids[c] = avg;
    }
  }
  return centroids;
}

/** Sample N random pixels from ImageData */
function samplePixels(data: Uint8ClampedArray, count = 800): [number, number, number][] {
  const total = data.length / 4;
  const stride = Math.max(1, Math.floor(total / count));
  const out: [number, number, number][] = [];
  for (let i = 0; i < total; i += stride) {
    const idx = i * 4;
    const a = data[idx + 3];
    if (a < 128) continue; // skip transparent pixels
    out.push([data[idx], data[idx + 1], data[idx + 2]]);
  }
  return out;
}

// ── Core extraction ───────────────────────────────────────────────────────────

async function extractPalette(
  imageUrl: string,
  fallbackOnError: ArtworkPalette = DEFAULT_PALETTE,
): Promise<ArtworkPalette> {
  const tryExtract = (url: string, useProxy = false): Promise<ArtworkPalette | null> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      
      const finalUrl = useProxy 
        ? `https://images.weserv.nl/?url=${encodeURIComponent(url.replace(/^https?:\/\//, ""))}&w=200&h=200&fit=cover`
        : url;

      img.onload = () => {
        try {
          const SIZE = 80;
          const canvas = document.createElement("canvas");
          canvas.width = SIZE; canvas.height = SIZE;
          const ctx = canvas.getContext("2d");
          if (!ctx) { resolve(null); return; }
          ctx.drawImage(img, 0, 0, SIZE, SIZE);
          const { data } = ctx.getImageData(0, 0, SIZE, SIZE);

          const pixels = samplePixels(data, 600).filter(([r, g, b]) => {
            const [, s, l] = rgbToHsl(r, g, b);
            return l > 5 && l < 95 && s > 8;
          });

          if (pixels.length < 10) { resolve(null); return; }
          const centers = kmeans(pixels, 6);
          const hslCenters = centers.map(([r, g, b]) => {
            const [h, s, l] = rgbToHsl(r, g, b);
            return { h, s, l, score: s * (l > 20 && l < 80 ? 1 : 0.3) };
          });
          hslCenters.sort((a, b) => b.score - a.score);

          const p = hslCenters[0] ?? { h: 270, s: 20, l: 10 };
          const [ph, ps, pl] = darkenHsl(p.h, p.s, p.l, 55);
          const s2 = hslCenters[1] ?? hslCenters[0];
          const [sh, ss, sl] = darkenHsl(s2.h, s2.s, s2.l, 40);
          const ac = hslCenters[0] ?? hslCenters[0];
          const [ah, as2, al] = vibrifyHsl(ac.h, ac.s, ac.l);

          resolve({
            primary: hslToHex(ph, ps, pl),
            secondary: hslToHex(sh, ss, sl),
            accent: hslToHex(ah, as2, al),
          });
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = finalUrl;
    });
  };

  // Try direct first, then fallback to proxy for CORS issues
  const direct = await tryExtract(imageUrl, false);
  if (direct) return direct;
  
  return (await tryExtract(imageUrl, true)) || fallbackOnError;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useArtworkColors(
  artworkUrl: string | null | undefined,
  accentColor?: string,
): ArtworkPalette {
  const accentFallback = useMemo(
    () => paletteFromAccent(accentColor?.trim() || "#FA233B"),
    [accentColor],
  );

  const [palette, setPalette] = useState<ArtworkPalette>(accentFallback);
  const lastUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!artworkUrl || artworkUrl === lastUrlRef.current) return;
    lastUrlRef.current = artworkUrl;

    let cancelled = false;
    extractPalette(artworkUrl, accentFallback).then((p) => {
      if (!cancelled) setPalette(p);
    });
    return () => {
      cancelled = true;
    };
  }, [artworkUrl, accentFallback]);

  useEffect(() => {
    if (!artworkUrl) {
      setPalette(accentFallback);
      lastUrlRef.current = null;
    }
  }, [artworkUrl, accentFallback]);

  return palette;
}
