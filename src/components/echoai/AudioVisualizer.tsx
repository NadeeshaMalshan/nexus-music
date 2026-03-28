"use client";

import { useEffect, useState, useRef } from "react";

interface AudioVisualizerProps {
  active: boolean;
  barCount?: number;
  color?: string;
  gap?: number;
  width?: string;
}

export function AudioVisualizer({ 
  active, 
  barCount = 4, 
  color = "#ef4444", 
  gap = 2,
  width = "16px"
}: AudioVisualizerProps) {
  const [heights, setHeights] = useState<number[]>(new Array(barCount).fill(30));
  const requestRef = useRef<number | null>(null);

  const animate = () => {
    if (!active) {
      setHeights(new Array(barCount).fill(30));
      return;
    }

    setHeights(prev => prev.map(() => {
      // Create a more "jumpy" beat-like movement
      const target = Math.random() > 0.8 ? Math.random() * 80 + 20 : Math.random() * 40 + 20;
      return target;
    }));

    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    if (active) {
      requestRef.current = requestAnimationFrame(animate);
    } else {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      setHeights(new Array(barCount).fill(30));
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return (
    <div 
      className="flex items-end justify-center overflow-hidden" 
      style={{ width, height: "16px", gap: `${gap}px` }}
    >
      {heights.map((height, i) => (
        <div
          key={i}
          className="rounded-full transition-all duration-150 ease-out"
          style={{
            width: "2.5px",
            height: `${height}%`,
            backgroundColor: color,
            // Add a slight glow effect
            boxShadow: active ? `0 0 8px ${color}66` : "none"
          }}
        />
      ))}
    </div>
  );
}
