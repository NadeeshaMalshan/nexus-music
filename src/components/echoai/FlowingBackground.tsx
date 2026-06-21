"use client";

import { memo, useMemo } from "react";
import { m } from "motion/react";
import { type ArtworkPalette } from "@/lib/useArtworkColors";

interface FlowingBackgroundProps {
  palette: ArtworkPalette;
  artwork?: string | null;
  opacity?: number;
  blur?: string;
  animate?: boolean;
}

/**
 * Mobile / narrow viewports: one static blurred layer (no motion under a blurred parent).
 * Blur + animated children in the same subtree forces WebKit to re-blur every frame → flicker.
 */
function StaticFlowingBackground({
  palette,
  artwork,
  blur,
}: Pick<FlowingBackgroundProps, "palette" | "artwork" | "blur">) {
  const bgImage = artwork ? `url(${artwork})` : undefined;
  return (
    <>
      <div
        className="absolute inset-0 transition-colors duration-1000 ease-in-out"
        style={{ backgroundColor: palette.primary }}
      />
      <div
        className="absolute inset-0 origin-center scale-[1.15] opacity-[0.75] transform-gpu [backface-visibility:hidden]"
        style={{
          backgroundImage: bgImage,
          backgroundColor: palette.secondary,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: `blur(${blur})`,
        }}
      />
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background: `radial-gradient(circle at 50% 40%, ${palette.accent}, transparent 65%)`,
        }}
      />
      <div
        className="absolute inset-0 opacity-20 mix-blend-screen"
        style={{
          backgroundImage: `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.12), transparent 70%)`,
        }}
      />
      <div className="absolute inset-0 bg-black/35" />
    </>
  );
}

/**
 * High-fidelity animated background inspired by Apple Music.
 * Uses layers of the heavily blurred artwork that drift and pulse.
 */
function FlowingBackgroundInner({
  palette,
  artwork,
  blur = "50px",
}: FlowingBackgroundProps) {
  const bgImage = artwork ? `url(${artwork})` : undefined;

  return (
    <>
      {/* Base Layer - Primary Color to prevent white flashes */}
      <div
        className="absolute inset-0 transition-colors duration-1000 ease-in-out"
        style={{ backgroundColor: palette.primary }}
      />

      {/* 
        PERFORMANCE OPTIMIZATION: 
        Resolution scaling trick: Blur on the container, scale down the contents.
      */}
      <div className="absolute inset-0 origin-center scale-[1.2] opacity-80" style={{ filter: `blur(${blur})` }}>
        <div className="absolute inset-0 scale-[0.6] origin-center transform-gpu">
          {/* Layer 1: Base drifting artwork */}
          <m.div
            animate={{
              x: ["-15%", "15%", "-5%"],
              y: ["-10%", "15%", "0%"],
              scale: [1.5, 1.8, 1.6],
              rotate: [0, 10, -5],
            }}
            transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-[-50%] opacity-90 will-change-transform bg-cover bg-center"
            style={{
              backgroundImage: bgImage,
              backgroundColor: palette.secondary,
              transform: "translateZ(0)",
            }}
          />

          {/* Layer 2: Offset artwork with different motion */}
          <m.div
            animate={{
              x: ["20%", "-15%", "10%"],
              y: ["10%", "20%", "-10%"],
              scale: [1.8, 1.4, 1.7],
              rotate: [180, 195, 165],
            }}
            transition={{ duration: 35, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-[-50%] opacity-50 will-change-transform bg-cover bg-center mix-blend-overlay"
            style={{
              backgroundImage: bgImage,
              backgroundColor: palette.accent,
              transform: "translateZ(0)",
            }}
          />

          {/* Layer 3: Pulse / Highlight layer */}
          <m.div
            className="absolute inset-0 opacity-40 will-change-transform"
            animate={{
              scale: [0.8, 1.3, 0.9],
              opacity: [0.3, 0.6, 0.3],
              x: ["-20%", "20%", "-20%"],
            }}
            transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
            style={{
              background: `radial-gradient(circle at center, ${palette.accent}, transparent 70%)`,
              transform: "translateZ(0)",
            }}
          />
        </div>
      </div>

      {/* Ambient Overlay for texture */}
      <div
        className="absolute inset-0 opacity-25 mix-blend-screen"
        style={{
          backgroundImage: `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.1), transparent 70%)`,
        }}
      />

      {/* Darkening Overlay for text readability */}
      <div className="absolute inset-0 bg-black/35" />
    </>
  );
}

function paletteEqual(a: ArtworkPalette, b: ArtworkPalette) {
  return a.primary === b.primary && a.secondary === b.secondary && a.accent === b.accent;
}

export const FlowingBackground = memo(function FlowingBackground(props: FlowingBackgroundProps) {
  const { palette, artwork, blur = "50px", animate = true } = props;
  const stableArtwork = useMemo(() => artwork ?? null, [artwork]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
      {/* Static path: avoids WebKit blur recomputation every frame on touch devices */}
      <div className="absolute inset-0 lg:hidden">
        <StaticFlowingBackground palette={palette} artwork={stableArtwork} blur={blur} />
      </div>
      <div className="absolute inset-0 hidden lg:block">
        {animate ? (
          <FlowingBackgroundInner {...props} blur={blur} />
        ) : (
          <StaticFlowingBackground palette={palette} artwork={stableArtwork} blur={blur} />
        )}
      </div>
    </div>
  );
}, (prev, next) =>
  paletteEqual(prev.palette, next.palette) &&
  prev.artwork === next.artwork &&
  prev.blur === next.blur &&
  prev.opacity === next.opacity &&
  prev.animate === next.animate);
