"use client";

import { Music } from "lucide-react";
import { motion } from "motion/react";
import { useState, useEffect } from "react";

interface MusicArtworkProps {
  src?: string | null;
  alt?: string;
  className?: string;
  iconSize?: number;
}

export function MusicArtwork({ src, alt = "", className = "", iconSize = 24 }: MusicArtworkProps) {
  const [hasError, setHasError] = useState(false);

  // Reset error state if src changes
  useEffect(() => {
    setHasError(false);
  }, [src]);

  if (src && !hasError) {
    return (
      <img
        src={src}
        alt={alt}
        onError={() => setHasError(true)}
        className={`h-full w-full object-cover transition-transform duration-500 ${className}`}
      />
    );
  }

  return (
    <div className={`relative flex h-full w-full items-center justify-center overflow-hidden bg-linear-to-br from-[#1E1335] via-[#2A1B4D] to-[#452773] ${className}`}>
      {/* Animated Background Shimmer */}
      <motion.div
        animate={{
          x: ["-100%", "100%"],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "linear",
        }}
        className="absolute inset-0 z-0 bg-linear-to-r from-transparent via-white/5 to-transparent skew-x-12"
      />

      {/* Glossy Overlay */}
      <div className="absolute inset-0 z-10 bg-linear-to-tr from-white/5 to-white/10 opacity-30" />

      {/* Music Icon with subtle shadow */}
      <div className="relative z-20 flex items-center justify-center drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
        <Music 
          size={iconSize} 
          className="text-white opacity-20" 
          strokeWidth={2.5} 
        />
      </div>

      {/* Subtle border to catch light */}
      <div className="absolute inset-x-0 top-0 h-px bg-white/10 z-20" />
      <div className="absolute inset-y-0 left-0 w-px bg-white/5 z-20" />
    </div>
  );
}
