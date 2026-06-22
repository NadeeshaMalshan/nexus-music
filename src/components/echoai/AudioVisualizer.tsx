"use client";

import { useDashboard } from "@/context/DashboardContext";

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
  const { isPlaying } = useDashboard();
  const isAnimating = active && isPlaying;

  return (
    <div 
      className="flex items-end justify-center overflow-hidden animate-gpu" 
      style={{ width, height, gap: `${gap}px` }}
    >
      {[...Array(barCount)].map((_, i) => {
        // Assign a distinct keyframe animation name to each bar for variety
        const animationName = `beat-bar-${(i % 4) + 1}`;
        return (
          <div
            key={i}
            className={`rounded-full shadow-[0_0_8px_var(--visualizer-color)] transition-all duration-300`}
            style={{
              width: "2.5px",
              height: isAnimating ? "100%" : "30%",
              backgroundColor: color,
              animationName: isAnimating ? animationName : "none",
              animationDuration: "0.65s", // ~110 BPM rhythmic pulse
              animationIterationCount: "infinite",
              animationTimingFunction: "ease-in-out",
              animationDelay: `${i * 0.08}s`,
              //@ts-ignore
              "--visualizer-color": isAnimating ? `${color}66` : "transparent"
            }}
          />
        );
      })}
      <style jsx global>{`
        @keyframes beat-bar-1 {
          0%, 100% { height: 30%; }
          15% { height: 100%; }
          30% { height: 40%; }
          55% { height: 95%; }
          75% { height: 35%; }
          85% { height: 75%; }
        }
        @keyframes beat-bar-2 {
          0%, 100% { height: 25%; }
          15% { height: 85%; }
          35% { height: 30%; }
          55% { height: 100%; }
          70% { height: 40%; }
          85% { height: 60%; }
        }
        @keyframes beat-bar-3 {
          0%, 100% { height: 35%; }
          20% { height: 90%; }
          40% { height: 45%; }
          60% { height: 80%; }
          75% { height: 35%; }
          90% { height: 100%; }
        }
        @keyframes beat-bar-4 {
          0%, 100% { height: 20%; }
          15% { height: 100%; }
          30% { height: 35%; }
          50% { height: 75%; }
          70% { height: 25%; }
          85% { height: 90%; }
        }
      `}</style>
    </div>
  );
}
