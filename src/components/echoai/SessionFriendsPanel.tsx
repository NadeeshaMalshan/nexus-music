"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2, Play, Volume2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { useDashboard } from "@/context/DashboardContext";
import { MusicArtwork } from "./MusicArtwork";
import { JamSession } from "./JamSession";

type FriendActivity = {
  user: { name: string; email: string; image?: string };
  isOnline: boolean;
  status: { song?: { id: string; title: string; artist: string; artwork?: string; duration?: string }; isPlaying?: boolean } | null;
  lastSong: { id: string; title: string; artist: string; artwork?: string; duration?: string } | null;
  lastOnline: number | null;
  lastOnlineLabel: string | null;
};

interface SessionFriendsPanelProps {
  accentColor?: string;
  className?: string;
}

export function SessionFriendsPanel({ accentColor, className = "" }: SessionFriendsPanelProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const { onSongClick, palette } = useDashboard();
  const resolvedAccent = accentColor || palette.accent;

  const [view, setView] = useState<"friends" | "jam">("friends");
  const [friends, setFriends] = useState<FriendActivity[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFriends = useCallback(async () => {
    if (!session?.user) {
      setFriends([]);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/user/status");
      if (res.ok) {
        const data = await res.json();
        setFriends(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Failed to fetch friend activity:", err);
    } finally {
      setLoading(false);
    }
  }, [session?.user]);

  useEffect(() => {
    void fetchFriends();
    const interval = window.setInterval(() => {
      void fetchFriends();
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [fetchFriends]);

  const handleTuneIn = (friend: FriendActivity) => {
    const song = friend.status?.song || friend.lastSong;
    if (!song?.id) return;
    onSongClick({
      id: song.id,
      title: song.title,
      artist: song.artist,
      artwork: song.artwork || "",
      duration: song.duration || "0:00",
      color: resolvedAccent,
      isDirectLink: true,
    });
  };

  if (view === "jam") {
    return (
      <div className={`flex h-full flex-col ${className}`}>
        <button
          type="button"
          onClick={() => setView("friends")}
          className="mb-4 flex items-center gap-2 self-start text-[11px] font-black uppercase tracking-[0.2em] text-white/40 hover:text-white transition-colors"
        >
          <ArrowLeft size={14} />
          Back to Friends
        </button>
        <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
          <JamSession />
        </div>
      </div>
    );
  }

  return (
    <div className={`flex h-full flex-col ${className}`}>
      <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
        {!session?.user ? (
          <div className="py-12 text-center text-[13px] font-semibold text-white/35">
            Sign in to see friends activity.
          </div>
        ) : loading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={24} className="animate-spin text-white/40" style={{ color: resolvedAccent }} />
          </div>
        ) : friends.length === 0 ? (
          <div className="py-12 text-center text-[13px] font-semibold text-white/35 leading-relaxed px-2">
            Follow friends from their profiles to see what they are listening to here.
          </div>
        ) : (
          <div className="flex flex-col gap-3 pb-4">
            {friends.map((friend) => {
              const displaySong = friend.isOnline ? friend.status?.song : friend.lastSong;
              return (
                <div
                  key={friend.user.email}
                  className={`rounded-2xl border p-3.5 transition-colors ${
                    friend.isOnline
                      ? "border-emerald-500/20 bg-emerald-500/[0.04]"
                      : "border-white/[0.05] bg-white/[0.02]"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => router.push(`/stats?user=${encodeURIComponent(friend.user.email.split("@")[0])}`)}
                      className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border border-white/10"
                    >
                      <MusicArtwork
                        src={friend.user.image}
                        alt={friend.user.name}
                        variant="artist"
                        rounded="full"
                        className="h-full w-full"
                        iconSize={18}
                      />
                      <span
                        className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#121214] ${
                          friend.isOnline ? "bg-emerald-500" : "bg-zinc-500"
                        }`}
                      />
                    </button>

                    <div className="min-w-0 flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => router.push(`/stats?user=${encodeURIComponent(friend.user.email.split("@")[0])}`)}
                          className="truncate text-[14px] font-bold text-white hover:text-[var(--art-accent,#FA233B)] transition-colors"
                        >
                          {friend.user.name}
                        </button>
                        <span
                          className={`shrink-0 text-[10px] font-black uppercase tracking-wider ${
                            friend.isOnline ? "text-emerald-400" : "text-white/30"
                          }`}
                        >
                          {friend.isOnline ? "Online" : "Offline"}
                        </span>
                      </div>

                      {displaySong ? (
                        <div className="mt-2 flex items-center gap-2.5">
                          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-white/5">
                            <MusicArtwork
                              src={displaySong.artwork}
                              alt={displaySong.title}
                              variant="track"
                              rounded="md"
                              className="h-full w-full"
                              iconSize={14}
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-[12px] font-bold text-white leading-tight">
                              {friend.isOnline ? displaySong.title : `Last: ${displaySong.title}`}
                            </p>
                            <p className="truncate text-[11px] font-semibold text-white/35">
                              {displaySong.artist}
                            </p>
                            {!friend.isOnline && friend.lastOnlineLabel && (
                              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-white/25">
                                Last online {friend.lastOnlineLabel}
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <p className="mt-1 text-[11px] font-semibold text-white/30">
                          {friend.isOnline ? "Online" : friend.lastOnlineLabel ? `Last online ${friend.lastOnlineLabel}` : "No recent activity"}
                        </p>
                      )}
                    </div>
                  </div>

                  {displaySong?.id && friend.isOnline && friend.status?.isPlaying && (
                    <button
                      type="button"
                      onClick={() => handleTuneIn(friend)}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-[12px] font-black text-black transition-transform hover:scale-[1.02] active:scale-95"
                    >
                      <Volume2 size={14} />
                      Tune In
                    </button>
                  )}

                  {displaySong?.id && !friend.isOnline && (
                    <button
                      type="button"
                      onClick={() => handleTuneIn(friend)}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-2.5 text-[12px] font-black text-white/80 transition-colors hover:bg-white/10"
                    >
                      <Play size={14} fill="currentColor" />
                      Play Last Track
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-white/10 pt-4 mt-2">
        <button
          type="button"
          onClick={() => setView("jam")}
          className="flex w-full items-center justify-between rounded-2xl bg-white px-5 py-4 text-black transition-transform hover:scale-[1.01] active:scale-[0.99]"
        >
          <div className="text-left">
            <p className="text-[15px] font-black tracking-tight">Shared Listening</p>
            <p className="text-[11px] font-semibold text-black/45">Host or join a synced session</p>
          </div>
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}
