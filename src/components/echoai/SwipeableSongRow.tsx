"use client";

import React, { useRef, useState } from "react";
import { motion, useMotionValue, useTransform, AnimatePresence } from "motion/react";
import { ListPlus, PlaySquare, CheckCircle2 } from "lucide-react";

interface SwipeableSongRowProps {
  children: React.ReactNode;
  onSwipeLeft?: () => void; // Add to Queue
  onSwipeRight?: () => void; // Add to Play Next
  className?: string;
  disableDrag?: boolean;
}

export function SwipeableSongRow({ children, onSwipeLeft, onSwipeRight, className = "", disableDrag = false }: SwipeableSongRowProps) {
  const x = useMotionValue(0);
  
  // Drag distance thresholds
  const threshold = 80;
  
  // Opacity and Scale for icons
  const leftOpacity = useTransform(x, [10, threshold], [0, 1]);
  const leftScale = useTransform(x, [10, threshold], [0.5, 1.2]);
  
  const rightOpacity = useTransform(x, [-threshold, -10], [1, 0]);
  const rightScale = useTransform(x, [-threshold, -10], [1.2, 0.5]);

  // Color background reveal
  const background = useTransform(
    x,
    [-threshold, 0, threshold],
    ["rgba(250, 36, 60, 0.2)", "rgba(255, 255, 255, 0)", "rgba(36, 160, 250, 0.2)"]
  );

  const [triggered, setTriggered] = useState<"left" | "right" | null>(null);

  const handleDragEnd = (_: any, info: any) => {
    if (info.offset.x > threshold) {
      setTriggered("right");
      onSwipeRight?.();
      setTimeout(() => setTriggered(null), 1000);
    } else if (info.offset.x < -threshold) {
      setTriggered("left");
      onSwipeLeft?.();
      setTimeout(() => setTriggered(null), 1000);
    }
  };

  return (
    <div className={`relative group ${className}`}>
      {/* Action Backgrounds */}
      <motion.div 
        style={{ background }}
        className="absolute inset-0 z-0 flex items-center justify-between px-6 pointer-events-none rounded-2xl"
      >
        {/* Play Next (Right Swipe) */}
        <motion.div 
          style={{ opacity: leftOpacity, scale: leftScale }}
          className="flex items-center gap-2 text-blue-400 font-black uppercase text-[10px] tracking-widest"
        >
          <PlaySquare size={20} />
          <span>Play Next</span>
        </motion.div>

        {/* Add to Queue (Left Swipe) */}
        <motion.div 
          style={{ opacity: rightOpacity, scale: rightScale }}
          className="flex items-center gap-2 text-(--art-accent,#FA243C) font-black uppercase text-[10px] tracking-widest"
        >
          <span>Add to Queue</span>
          <ListPlus size={20} />
        </motion.div>
      </motion.div>

      {/* Success Indicator Overlay */}
      <AnimatePresence>
        {triggered && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm pointer-events-none rounded-2xl"
          >
            <div className="flex flex-col items-center gap-2">
              <CheckCircle2 size={32} className={triggered === "right" ? "text-blue-400" : "text-(--art-accent,#FA243C)"} />
              <span className="text-white font-black text-xs uppercase tracking-widest">
                {triggered === "right" ? "Added to Play Next" : "Added to Queue"}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Foreground Song Row */}
      <motion.div
        drag={disableDrag ? false : "x"}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.6}
        style={{ x }}
        onDragEnd={handleDragEnd}
        className={`relative bg-transparent ${disableDrag ? "z-50" : "z-10"}`}
      >
        {children}
      </motion.div>
    </div>
  );
}
