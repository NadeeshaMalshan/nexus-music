"use client";

import React, { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ListPlus, PlaySquare, Heart, Share2, MoreHorizontal } from "lucide-react";
import { type Song } from "./types";
import { MusicArtwork } from "./MusicArtwork";

interface SongMenuProps {
  song: Song;
  isOpen: boolean;
  onClose: () => void;
  onAddToQueue: () => void;
  onPlayNext: () => void;
  onLike: () => void;
  isLiked?: boolean;
}

export function SongMenu({ 
  song, 
  isOpen, 
  onClose, 
  onAddToQueue, 
  onPlayNext, 
  onLike,
  isLiked = false
}: SongMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  const menuItems = [
    { label: "Play Next", icon: PlaySquare, onClick: onPlayNext },
    { label: "Add to Queue", icon: ListPlus, onClick: onAddToQueue },
    { label: isLiked ? "Unlike" : "Love", icon: Heart, onClick: onLike, active: isLiked, activeColor: "var(--art-accent, #FA243C)" },
    { label: "Share", icon: Share2, onClick: () => {
         navigator.clipboard.writeText(`https://music.youtube.com/watch?v=${song.id}`);
         onClose();
      } 
    },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
           ref={menuRef}
           initial={{ opacity: 0, scale: 0.95, y: -10 }}
           animate={{ opacity: 1, scale: 1, y: 0 }}
           exit={{ opacity: 0, scale: 0.95, y: -10 }}
           className="absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-2xl border border-white/10 bg-[#1c1c1e] p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.6)]"
           onClick={(e) => e.stopPropagation()}
        >
           <div className="flex items-center gap-3 border-b border-white/5 p-3 mb-1">
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg">
                 <MusicArtwork src={song.artwork} alt={song.title} iconSize={18} variant="track" rounded="md" className="h-full w-full" />
              </div>
              <div className="min-w-0">
                 <p className="truncate text-xs font-black text-white">{song.title}</p>
                 <p className="truncate text-[10px] font-bold text-white/40">{song.artist}</p>
              </div>
           </div>
           
           {menuItems.map((item, idx) => {
             const Icon = item.icon;
             return (
               <button
                 key={idx}
                 onClick={(e) => {
                   e.stopPropagation();
                   item.onClick();
                   onClose();
                 }}
                 className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-all hover:bg-white/10 group"
               >
                 <Icon 
                    size={18} 
                    className={item.active ? "" : "text-white/40 group-hover:text-white"} 
                    style={{ color: item.active ? item.activeColor : undefined, fill: item.active ? item.activeColor : "none" }}
                 />
                 <span className={item.active ? "text-white" : "text-white/80 group-hover:text-white"}>{item.label}</span>
               </button>
             );
           })}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
