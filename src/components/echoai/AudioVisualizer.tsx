"use client";

import { useMemo } from "react";

interface AudioVisualizerProps {
  active: boolean;
  barCount?: number;
  color?: string;
  gap?: number;
  width?: string;
  height?: string;
}

export function AudioVisualizer({ 
  active, 
  barCount = 4, 
  color = "#ef4444", 
  gap = 2,
  width = "16px",
  height = "16px"
}: AudioVisualizerProps) {
  
  // Memoize random durations to prevent re-renders while keeping unique animations
  const barDurations = useMemo(() => 
    new Array(barCount).fill(0).map(() => 0.5 + Math.random() * 0.5), 
  [barCount]);

  return (
    <div 
      className="flex items-end justify-center overflow-hidden animate-gpu" 
      style={{ width, height, gap: `${gap}px` }}
    >
      {[...Array(barCount)].map((_, i) => (
        <div
          key={i}
          className={`rounded-full shadow-[0_0_8px_var(--visualizer-color)] transition-all duration-300 ${active ? "animate-audio-bar" : ""}`}
          style={{
            width: "2.5px",
            height: active ? "100%" : "30%",
            backgroundColor: color,
            animationDuration: `${barDurations[i]}s`,
            animationDelay: `${i * 0.1}s`,
            //@ts-ignore
            "--visualizer-color": active ? `${color}66` : "transparent"
          }}
        />
      ))}
      <style jsx global>{`
        @keyframes audio-bar {
          0%, 100% { height: 30%; }
          50% { height: 100%; }
        }
        .animate-audio-bar {
          animation-name: audio-bar;
          animation-iteration-count: infinite;
          animation-timing-function: ease-in-out;
        }
      `}</style>
    </div>
  );
}
