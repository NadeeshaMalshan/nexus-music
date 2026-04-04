"use client";

import { m } from "motion/react";
import { type ArtworkPalette } from "@/lib/useArtworkColors";

interface FlowingBackgroundProps {
  palette: ArtworkPalette;
  opacity?: number;
  blur?: string;
}

/**
 * High-fidelity animated background inspired by Apple Music.
 * Uses large, blurry concentric/radial elements that drift across the screen.
 */
export function FlowingBackground({ 
  palette, 
  opacity = 0.6, 
  blur = "120px" 
}: FlowingBackgroundProps) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
      {/* Base Layer */}
      <div 
        className="absolute inset-0 transition-colors duration-1000 ease-in-out" 
        style={{ backgroundColor: palette.primary }} 
      />

      {/* Animated Blobs */}
      <m.div
        animate={{
          x: ["-20%", "30%", "-10%", "20%"],
          y: ["-30%", "10%", "30%", "-20%"],
          scale: [1, 1.4, 0.8, 1.2],
          rotate: [0, 90, 180, 270],
        }}
        transition={{ 
          duration: 35, 
          repeat: Infinity, 
          ease: "linear",
          times: [0, 0.33, 0.66, 1] 
        }}
        className="absolute -top-[10%] -left-[10%] w-[90%] h-[90%] rounded-full opacity-60"
        style={{ 
          backgroundColor: palette.secondary,
          filter: `blur(${blur})`,
        }}
      />

      <m.div
        animate={{
          x: ["40%", "-10%", "20%", "-30%"],
          y: ["10%", "40%", "-30%", "20%"],
          scale: [1.3, 0.9, 1.5, 1.1],
          rotate: [360, 270, 180, 90],
        }}
        transition={{ 
          duration: 45, 
          repeat: Infinity, 
          ease: "linear",
          times: [0, 0.33, 0.66, 1]
        }}
        className="absolute -bottom-[20%] -right-[20%] w-[100%] h-[100%] rounded-full opacity-50"
        style={{ 
          backgroundColor: palette.accent,
          filter: `blur(${blur})`,
        }}
      />

      <m.div
        animate={{
          x: ["10%", "-40%", "30%", "-10%"],
          y: ["-20%", "30%", "10%", "40%"],
          scale: [0.8, 1.2, 0.7, 1.3],
        }}
        transition={{ 
          duration: 25, 
          repeat: Infinity, 
          ease: "linear",
          times: [0, 0.33, 0.66, 1]
        }}
        className="absolute top-[20%] left-[10%] w-[70%] h-[70%] rounded-full opacity-40"
        style={{ 
          backgroundColor: palette.primary,
          filter: `blur(${blur})`,
        }}
      />

      {/* Ambient Overlay for depth */}
      <div 
        className="absolute inset-0 opacity-40 mix-blend-overlay"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 50%, rgba(255,255,255,0.1), transparent 80%)`
        }}
      />
      
      {/* Darkening Overlay for text readability */}
      <div className="absolute inset-0 bg-black/30" />
    </div>
  );
}
