import React, { useEffect, useState, useCallback } from "react";
import { Sparkles, Play, Loader2, Music } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { type Song } from "./types";

interface CenterPanelProps {
  accentColor: string;
  onSongClick?: (song: Song) => void;
  seed?: string;
}

type Recommendation = {
  title: string;
  artist: string;
};

export function CenterPanel({ accentColor, onSongClick, seed }: CenterPanelProps) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const fetchRecommendations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/recommendations?seed=${encodeURIComponent(seed || "trending hits")}`);
      const data = await res.json();
      setRecommendations(data.recommendations || []);
    } catch (err) {
      console.error("Failed to fetch recommendations:", err);
    } finally {
      setLoading(false);
    }
  }, [seed]);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  const handlePlayRecommendation = async (rec: Recommendation) => {
    if (!onSongClick) return;
    const query = `${rec.title} ${rec.artist}`;
    setPlayingId(query);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.items && data.items.length > 0) {
        const item = data.items[0];
        onSongClick({
          id: item.videoId,
          title: item.title,
          artist: item.author,
          artwork: item.thumbnail,
          duration: item.duration,
          color: accentColor,
        });
      }
    } catch (err) {
      console.error("Failed to play recommendation:", err);
    } finally {
      setPlayingId(null);
    }
  };

  return (
    <div className="flex-1 h-full overflow-y-auto bg-[#06060a] px-6 py-8 pb-32 lg:px-12 lg:py-10 custom-scrollbar">
      <div className="mb-10 text-left">
        <h1 className="text-[34px] font-bold tracking-tight text-white flex items-center gap-3">
          Listen Now <Sparkles className="text-purple-400" size={28} />
        </h1>
        <div className="mt-4 h-[1px] w-full bg-white/10" />
      </div>

      <div className="grid grid-cols-1 gap-8">
        <section>
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              AI Recommendations 
              {seed && <span className="text-sm font-normal text-zinc-500">based on your taste</span>}
            </h2>
            <button 
              onClick={fetchRecommendations}
              className="text-sm text-zinc-400 hover:text-white transition-colors flex items-center gap-1"
              disabled={loading}
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : "Refresh"}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence mode="popLayout">
              {loading && recommendations.length === 0 ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-24 rounded-xl bg-white/5 animate-pulse" />
                ))
              ) : (
                recommendations.map((rec, i) => (
                  <motion.div
                    key={`${rec.title}-${rec.artist}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="group relative flex items-center gap-4 rounded-xl bg-white/5 p-4 transition-all hover:bg-white/10 border border-white/5"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-purple-600/20 to-pink-600/20 text-purple-400 border border-purple-500/10">
                      <Music size={24} />
                    </div>
                    <div className="flex-1 min-w-0 pr-10">
                      <h3 className="truncate font-semibold text-white text-[15px]">{rec.title}</h3>
                      <p className="truncate text-[13px] text-zinc-400">{rec.artist}</p>
                    </div>
                    <button
                      onClick={() => handlePlayRecommendation(rec)}
                      className="absolute right-4 flex h-8 w-8 items-center justify-center rounded-full bg-white text-black opacity-0 transition-all group-hover:opacity-100 hover:scale-110 active:scale-95 shadow-lg"
                      disabled={playingId === `${rec.title} ${rec.artist}`}
                    >
                      {playingId === `${rec.title} ${rec.artist}` ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Play size={16} fill="black" className="ml-0.5" />
                      )}
                    </button>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="mb-4 text-xl font-bold text-white">Your Radio</h2>
          <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-white/5 bg-white/2 p-8 text-center backdrop-blur-sm">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5 text-white/20">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
            </div>
            <h3 className="mb-2 text-xl font-bold text-white">Personal Station</h3>
            <p className="max-w-xs text-[14px] font-medium text-zinc-500">
              Listen to the songs you love and discover new ones picked just for you.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
