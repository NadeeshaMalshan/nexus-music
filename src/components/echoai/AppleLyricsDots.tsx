"use client";

import React, { useMemo } from "react";

export interface AppleLyricsDotsProps {
  isActive: boolean;
  startTime: number;
  endTime: number;
  currentTimeSec: number;
  isPlaying?: boolean;
  sizeVariant?: "desktop" | "mobile" | "sidebar";
  className?: string;
}

/**
 * Authentic Apple Music 3-dot instrumental lyrics animation.
 * Features:
 * 1. Gentle rhythmic breathing wave during longer instrumental sections (remaining > 3s).
 * 2. Signature 3-beat countdown bloom (3 -> 2 -> 1 -> vocal entrance) with white luminescence.
 * 3. Responsive scaling for desktop, mobile, and sidebar lyric views.
 */
export function AppleLyricsDots({
  isActive,
  startTime,
  endTime,
  currentTimeSec,
  isPlaying = true,
  sizeVariant = "desktop",
  className = "",
}: AppleLyricsDotsProps) {
  const dotSizeClass =
    sizeVariant === "desktop"
      ? "w-3.5 h-3.5"
      : sizeVariant === "mobile"
      ? "w-3 h-3"
      : "w-2.5 h-2.5";

  const gapClass =
    sizeVariant === "desktop"
      ? "gap-4"
      : sizeVariant === "mobile"
      ? "gap-3"
      : "gap-2.5";

  const containerHeightClass =
    sizeVariant === "desktop"
      ? "h-[64px]"
      : sizeVariant === "mobile"
      ? "h-[48px]"
      : "h-[36px]";

  // Calculate timing parameters
  const { dot1, dot2, dot3 } = useMemo(() => {
    if (!isActive) {
      return {
        dot1: { opacity: 0.22, scale: 1.0, glow: "none" },
        dot2: { opacity: 0.22, scale: 1.0, glow: "none" },
        dot3: { opacity: 0.22, scale: 1.0, glow: "none" },
      };
    }

    const duration = Math.max(0.2, endTime - startTime);
    const elapsed = Math.max(0, currentTimeSec - startTime);
    const remaining = Math.max(0, endTime - currentTimeSec);

    // If instrumental break is longer and we are still before the final 3-beat countdown
    if (duration >= 3.5 && remaining > 3.0) {
      // Gentle cyclic ambient wave traversing the 3 dots (2.4s cycle)
      const waveCycle = (elapsed % 2.4) / 2.4;
      const getWaveDot = (offset: number) => {
        const d = (waveCycle - offset + 1) % 1;
        // Bell curve intensity peaking at 0
        const intensity = Math.max(0, Math.sin(d * Math.PI) ** 3);
        const opacity = 0.28 + 0.38 * intensity;
        const scale = 1.0 + 0.12 * intensity;
        const glow =
          intensity > 0.3
            ? `0 0 ${Math.round(12 * intensity)}px rgba(255,255,255,${(0.6 * intensity).toFixed(2)})`
            : "none";
        return { opacity, scale, glow };
      };

      return {
        dot1: getWaveDot(0.0),
        dot2: getWaveDot(0.33),
        dot3: getWaveDot(0.66),
      };
    }

    // Final 3-beat countdown to vocal line entrance (or short transition)
    const beatDuration = duration >= 3.0 ? 1.0 : duration / 3;
    const threshold1 = 3 * beatDuration;
    const threshold2 = 2 * beatDuration;
    const threshold3 = 1 * beatDuration;

    // Dot 1 (Lights up at 3 beats remaining)
    let d1Op = 0.25;
    let d1Scale = 1.0;
    let d1Glow = "none";
    if (remaining <= threshold1) {
      d1Op = 1.0;
      const timeSinceHit = threshold1 - remaining;
      const burst = Math.max(0, 1 - timeSinceHit / 0.3);
      d1Scale = 1.08 + 0.22 * burst;
      d1Glow = "0 0 16px rgba(255,255,255,0.95), 0 0 32px rgba(255,255,255,0.45)";
    }

    // Dot 2 (Lights up at 2 beats remaining)
    let d2Op = 0.25;
    let d2Scale = 1.0;
    let d2Glow = "none";
    if (remaining <= threshold2) {
      d2Op = 1.0;
      const timeSinceHit = threshold2 - remaining;
      const burst = Math.max(0, 1 - timeSinceHit / 0.3);
      d2Scale = 1.08 + 0.22 * burst;
      d2Glow = "0 0 16px rgba(255,255,255,0.95), 0 0 32px rgba(255,255,255,0.45)";
    }

    // Dot 3 (Lights up at 1 beat remaining)
    let d3Op = 0.25;
    let d3Scale = 1.0;
    let d3Glow = "none";
    if (remaining <= threshold3) {
      d3Op = 1.0;
      const timeSinceHit = threshold3 - remaining;
      const burst = Math.max(0, 1 - timeSinceHit / 0.3);
      d3Scale = 1.08 + 0.22 * burst;
      d3Glow = "0 0 16px rgba(255,255,255,0.95), 0 0 32px rgba(255,255,255,0.45)";
    }

    // Micro-shimmer on last fraction of second right before vocal drops in
    if (remaining <= 0.15) {
      d1Scale *= 1.08;
      d2Scale *= 1.08;
      d3Scale *= 1.08;
    }

    return {
      dot1: { opacity: d1Op, scale: d1Scale, glow: d1Glow },
      dot2: { opacity: d2Op, scale: d2Scale, glow: d2Glow },
      dot3: { opacity: d3Op, scale: d3Scale, glow: d3Glow },
    };
  }, [isActive, startTime, endTime, currentTimeSec]);

  return (
    <div
      className={`flex items-center ${gapClass} ${containerHeightClass} transition-opacity duration-500 select-none ${
        isActive ? "opacity-100" : "opacity-35"
      } ${className}`}
      aria-label="Instrumental countdown"
    >
      <div
        className={`${dotSizeClass} rounded-full bg-white transition-all duration-200 ease-out transform-gpu`}
        style={{
          opacity: dot1.opacity,
          transform: `scale(${dot1.scale})`,
          boxShadow: dot1.glow,
        }}
      />
      <div
        className={`${dotSizeClass} rounded-full bg-white transition-all duration-200 ease-out transform-gpu`}
        style={{
          opacity: dot2.opacity,
          transform: `scale(${dot2.scale})`,
          boxShadow: dot2.glow,
        }}
      />
      <div
        className={`${dotSizeClass} rounded-full bg-white transition-all duration-200 ease-out transform-gpu`}
        style={{
          opacity: dot3.opacity,
          transform: `scale(${dot3.scale})`,
          boxShadow: dot3.glow,
        }}
      />
    </div>
  );
}
