"use client";

import React, { useEffect, useState, useCallback } from "react";
import { 
  Play, 
  Pause, 
  Clock, 
  Music, 
  Users, 
  UserPlus, 
  UserMinus, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  Heart, 
  Loader2, 
  ArrowLeft,
  X,
  Volume2,
  Calendar,
  Share2
} from "lucide-react";
import { m, AnimatePresence } from "motion/react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDashboard } from "@/context/DashboardContext";
import { MusicArtwork } from "./MusicArtwork";
import { FADE_IN_VARIANTS, MOTION_CONFIG } from "@/lib/animations";

// Format listening time seconds to readable string
const formatListeningTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const hrs = Math.floor(mins / 60);
  
  if (hrs > 0) {
    const remainingMins = mins % 60;
    return `${hrs}h ${remainingMins}m`;
  }
  return `${mins}m`;
};

interface StatsProfileProps {
  accentColor: string;
}

export function StatsProfile({ accentColor }: StatsProfileProps) {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const targetEmail = searchParams.get("user") || "";

  const { 
    currentSong, 
    isPlaying, 
    onSongClick, 
    likedSongs, 
    onRateSong,
    isRightSidebarOpen,
    setIsRightSidebarOpen
  } = useDashboard();

  // State
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [socialModal, setSocialModal] = useState<"followers" | "following" | null>(null);
  const [showWrappedModal, setShowWrappedModal] = useState(false);
  const [wrappedSlideIndex, setWrappedSlideIndex] = useState(0);
  const [artistImages, setArtistImages] = useState<Record<string, string>>({});

  // Fetch target profile details
  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const url = targetEmail 
        ? `/api/user/stats?user=${encodeURIComponent(targetEmail)}`
        : "/api/user/stats";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setProfileData(data);
      }
    } catch (err) {
      console.error("Failed to fetch profile stats:", err);
    } finally {
      setLoading(false);
    }
  }, [targetEmail]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (!profileData) {
      setArtistImages({});
      return;
    }

    const names = new Set<string>();
    for (const artist of profileData.topArtists || []) {
      const name = typeof artist?.name === "string" ? artist.name.trim() : "";
      if (name) names.add(name);
    }
    for (const artist of profileData.wrappedData?.topArtists || []) {
      const name = typeof artist?.name === "string" ? artist.name.trim() : "";
      if (name) names.add(name);
    }

    if (names.size === 0) {
      setArtistImages({});
      return;
    }

    let cancelled = false;

    const loadArtistImages = async () => {
      const entries = await Promise.all(
        Array.from(names).map(async (name) => {
          try {
            const res = await fetch(`/api/search?q=${encodeURIComponent(name)}&type=artists`);
            if (!res.ok) return null;
            const data = await res.json();
            const items = data.items || [];
            const normalized = name.toLowerCase();
            const match =
              items.find((a: { name?: string }) => a.name?.toLowerCase() === normalized) ||
              items.find((a: { name?: string }) => a.name?.toLowerCase().includes(normalized)) ||
              items[0];
            const thumbnail = match?.thumbnail;
            return thumbnail ? ([name, thumbnail] as const) : null;
          } catch {
            return null;
          }
        })
      );

      if (cancelled) return;

      const next: Record<string, string> = {};
      for (const entry of entries) {
        if (entry) next[entry[0]] = entry[1];
      }
      setArtistImages(next);
    };

    void loadArtistImages();
    return () => {
      cancelled = true;
    };
  }, [profileData]);

  // Handle follow / unfollow actions
  const handleFollowAction = async () => {
    if (!profileData || !session?.user || actionLoading) return;
    setActionLoading(true);
    const isCurrentlyFollowing = profileData.isFollowing;
    
    // Optimistic UI update
    setProfileData((prev: any) => {
      if (!prev) return prev;
      return {
        ...prev,
        isFollowing: !isCurrentlyFollowing,
        followersCount: prev.followersCount + (isCurrentlyFollowing ? -1 : 1),
      };
    });

    try {
      const res = await fetch("/api/user/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: isCurrentlyFollowing ? "unfollow" : "follow",
          target: profileData.user.email,
        }),
      });

      if (!res.ok) {
        // Rollback on failure
        setProfileData((prev: any) => {
          if (!prev) return prev;
          return {
            ...prev,
            isFollowing: isCurrentlyFollowing,
            followersCount: prev.followersCount + (isCurrentlyFollowing ? 1 : -1),
          };
        });
      }
    } catch (err) {
      console.error("Failed to follow/unfollow user:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const copyProfileLink = () => {
    if (!profileData?.user?.email) return;
    const url = `${window.location.origin}/stats?user=${encodeURIComponent(profileData.user.email)}`;
    navigator.clipboard.writeText(url).then(() => {
      alert("Profile link copied to clipboard!");
    }).catch(() => {});
  };

  // Horizontal carousel scroll containers
  const recentScrollRef = React.useRef<HTMLDivElement>(null);
  const artistsScrollRef = React.useRef<HTMLDivElement>(null);
  const scrollCarousel = (ref: React.RefObject<HTMLDivElement | null>, dir: "left" | "right") => {
    if (!ref.current) return;
    const amt = dir === "left" ? -500 : 500;
    ref.current.scrollBy({ left: amt, behavior: "smooth" });
  };

  const handleTuneIn = (status: any) => {
    if (!status?.song) return;
    onSongClick({
      id: status.song.id,
      title: status.song.title,
      artist: status.song.artist,
      artwork: status.song.artwork,
      duration: status.song.duration,
      color: accentColor,
      isDirectLink: true
    });
  };

  const uniqueRecentPlays = React.useMemo(() => {
    const seen = new Set<string>();
    return (profileData?.recentPlayed || []).filter((song: { id?: string }) => {
      const id = song?.id;
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [profileData?.recentPlayed]);

  if (loading) {
    return (
      <div className="flex-1 h-full flex flex-col items-center justify-center bg-transparent">
        <Loader2 size={48} className="animate-spin text-white/50" style={{ color: accentColor }} />
        <p className="text-zinc-500 text-[15px] font-semibold mt-4">Loading your music metrics...</p>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="flex-1 h-full flex flex-col items-center justify-center p-6 text-center">
        <p className="text-white/40 text-[16px] font-bold">Failed to load profile. Please try again later.</p>
        <button onClick={fetchProfile} className="mt-4 px-6 py-2.5 rounded-full bg-white/10 text-white font-bold hover:bg-white/20 transition-all">
          Retry
        </button>
      </div>
    );
  }

  const {
    user,
    listeningTime,
    songsDiscovered,
    artistsDiscovered,
    topSongs,
    topArtists,
    followersCount,
    followingCount,
    followingUsers = [],
    followingArtists = [],
    followers = [],
    isFollowing,
    liveStatus,
    wrappedData
  } = profileData;

  const isSelf = !targetEmail || targetEmail.toLowerCase() === session?.user?.email?.toLowerCase();

  return (
    <div className={`flex-1 h-full overflow-y-auto no-scrollbar pt-8 pb-32 px-6 md:px-10 lg:px-16 space-y-12 transition-[margin-right] duration-[450ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
      isRightSidebarOpen ? "lg:mr-[380px]" : "lg:mr-0"
    }`}>
      {/* Top Header */}
      <div className="flex items-center gap-4 z-40 relative">
        {!isSelf && (
          <button 
            onClick={() => router.push("/stats")}
            className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white transition-all active:scale-95 border border-white/5"
          >
            <ArrowLeft size={20} />
          </button>
        )}
        <h1 className="text-[28px] font-black text-white tracking-tight leading-none">
          {isSelf ? "Your Dashboard" : `${user.name}'s Profile`}
        </h1>
      </div>

      {/* Main Profile Info Card */}
      <section 
        className="relative rounded-[32px] overflow-hidden bg-[#121214]/65 backdrop-blur-2xl p-8 sm:p-10"
      >
        <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-8 z-10 relative">
          <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-6">
            {/* Large Avatar container */}
            <div className="relative w-28 h-28 sm:w-32 sm:h-32 shrink-0 rounded-full overflow-hidden border-2 border-white/10 group shadow-2xl">
              <MusicArtwork 
                src={user.image} 
                alt={user.name} 
                variant="artist" 
                rounded="full" 
                className="w-full h-full scale-100 group-hover:scale-105 transition-transform duration-500" 
                iconSize={48} 
              />
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>

            {/* Profile text */}
            <div className="space-y-3 pt-2">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                  <h2 className="text-[32px] sm:text-[40px] font-black tracking-tight text-white leading-none">
                    {user.name}
                  </h2>
                </div>
                <p className="text-[14px] text-white/35 font-medium">{user.email}</p>
              </div>

              {/* Relationship statistics counts */}
              <div className="flex items-center justify-center sm:justify-start gap-6 pt-1">
                <button
                  type="button"
                  onClick={() => setSocialModal("followers")}
                  className="text-left transition-opacity hover:opacity-80"
                >
                  <span className="text-[18px] font-black text-white">{followersCount}</span>
                  <span className="text-[13px] font-bold text-white/30 ml-1.5 tracking-tight">followers</span>
                </button>
                <div className="w-[1px] h-3 bg-white/10" />
                <button
                  type="button"
                  onClick={() => setSocialModal("following")}
                  className="text-left transition-opacity hover:opacity-80"
                >
                  <span className="text-[18px] font-black text-white">{followingCount}</span>
                  <span className="text-[13px] font-bold text-white/30 ml-1.5 tracking-tight">following</span>
                </button>
              </div>
            </div>
          </div>

          {/* Call to action: Follow/Share buttons */}
          <div className="flex items-center gap-3">
            <button 
              onClick={copyProfileLink}
              className="p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 text-white/80 hover:text-white transition-all hover:scale-105 active:scale-95 shadow-md flex items-center justify-center"
              title="Copy Profile Link"
            >
              <Share2 size={20} />
            </button>

            {!isSelf ? (
              <button 
                onClick={handleFollowAction}
                disabled={actionLoading}
                className={`px-8 py-3.5 rounded-2xl font-black text-[14px] tracking-tight hover:scale-105 active:scale-95 transition-all shadow-lg flex items-center gap-2 ${
                  isFollowing 
                    ? "bg-white/10 border border-white/10 text-white hover:bg-white/20" 
                    : "bg-white text-black hover:bg-[#ececf0]"
                }`}
                style={!isFollowing ? { boxShadow: `0 12px 30px ${accentColor}29` } : {}}
              >
                {actionLoading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : isFollowing ? (
                  <>
                    <UserMinus size={18} />
                    Unfollow
                  </>
                ) : (
                  <>
                    <UserPlus size={18} />
                    Follow
                  </>
                )}
              </button>
            ) : null}
          </div>
        </div>

        {/* Live Listening activity of the profile user (only when viewing another user) */}
        {!isSelf && liveStatus && (
          <div className="mt-8 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-5 bg-white/[0.02] border border-white/[0.03] p-5 rounded-2xl shadow-inner z-10 relative">
            <div className="flex items-center gap-4 w-full sm:w-auto">
              <div className="relative w-14 h-14 shrink-0 rounded-xl overflow-hidden shadow-lg border border-white/5">
                <MusicArtwork src={liveStatus.song?.artwork} alt={liveStatus.song?.title} variant="track" rounded="none" className="w-full h-full animate-pulse" iconSize={20} />
                {liveStatus.isPlaying && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <span className="flex gap-0.5 items-end justify-center w-5 h-5">
                      <span className="w-0.5 h-2 bg-white rounded-full animate-[bounce_0.8s_infinite]" />
                      <span className="w-0.5 h-4 bg-white rounded-full animate-[bounce_0.6s_0.15s_infinite]" />
                      <span className="w-0.5 h-3 bg-white rounded-full animate-[bounce_0.7s_0.3s_infinite]" />
                    </span>
                  </div>
                )}
              </div>
              <div className="min-w-0 text-left">
                <p className="text-[12px] font-black text-white/30 uppercase tracking-wider mb-0.5 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  Currently listening to
                </p>
                <h4 className="text-[17px] font-black text-white truncate leading-tight tracking-tight pr-2">
                  {liveStatus.song?.title}
                </h4>
                <p className="text-[13px] text-white/45 font-semibold truncate leading-none mt-1">
                  by {liveStatus.song?.artist}
                </p>
              </div>
            </div>

            <button
              onClick={() => handleTuneIn(liveStatus)}
              disabled={!liveStatus.isPlaying}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-white text-black font-extrabold text-[13px] tracking-tight hover:scale-105 active:scale-95 transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-40 disabled:hover:scale-100"
            >
              <Volume2 size={16} />
              Tune In
            </button>
          </div>
        )}
      </section>

      {/* Cinematic Wrapped Banner if active */}
      {isSelf && wrappedData && (
        <m.section 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative rounded-[32px] overflow-hidden border border-white/10 p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 cursor-pointer hover:border-white/20 transition-all group"
          onClick={() => {
            setWrappedSlideIndex(0);
            setShowWrappedModal(true);
          }}
          style={{
            backgroundImage: `radial-gradient(circle at 100% 0%, ${accentColor}1f 0%, transparent 60%), linear-gradient(135deg, #131317 0%, #0d0d0f 100%)`,
            boxShadow: `0 20px 40px -15px ${accentColor}12`
          }}
        >
          <div className="flex items-center gap-5 text-left w-full sm:w-auto">
            <div 
              className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border transition-transform duration-500 group-hover:rotate-12"
              style={{
                borderColor: `${accentColor}33`,
                backgroundColor: `${accentColor}12`,
                color: accentColor,
                boxShadow: `0 0 30px ${accentColor}15`
              }}
            >
              <Sparkles size={26} className="animate-pulse" />
            </div>
            <div className="min-w-0 pr-2">
              <h3 className="text-[20px] font-black text-white tracking-tight leading-tight flex items-center gap-2">
                Nexus Wrapped {wrappedData.year} is Ready!
              </h3>
              <p className="text-[13px] text-white/40 font-medium leading-normal mt-1">
                Reflect on your musical path, discover your vibes, and share your stats.
              </p>
            </div>
          </div>
          <button 
            className="w-full sm:w-auto px-6 py-3.5 rounded-full font-black text-[13px] uppercase tracking-wider transition-all hover:scale-105 active:scale-95 bg-white text-black hover:bg-[#ececf0] shrink-0"
            style={{ boxShadow: `0 8px 24px ${accentColor}29` }}
          >
            Review Wrapped
          </button>
        </m.section>
      )}

      {/* Main stats cards layout grid */}
      <section className="space-y-4">
        <p className="text-[12px] font-black uppercase tracking-[0.22em] text-white/30">Last 30 days</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {[
          { 
            label: "Listening Time", 
            value: listeningTime > 0 ? formatListeningTime(listeningTime) : "0m", 
            sub: "aggregated seconds",
            icon: Clock 
          },
          { 
            label: "Songs Discovered", 
            value: songsDiscovered.toString(), 
            sub: "unique tracks played",
            icon: Music 
          },
          { 
            label: "Artists Discovered", 
            value: artistsDiscovered.toString(), 
            sub: "unique creators found",
            icon: Users 
          }
        ].map((item, idx) => {
          const Icon = item.icon;
          return (
            <div 
              key={`stats-card-${idx}`}
              className="relative rounded-3xl p-6 sm:p-7 bg-[#161618]/30 text-left"
            >
              <div 
                className="w-11 h-11 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center mb-6"
                style={{ color: accentColor }}
              >
                <Icon size={20} />
              </div>
              <h4 className="text-[14px] text-white/30 font-bold tracking-tight mb-1 uppercase">{item.label}</h4>
              <p className="text-[32px] sm:text-[36px] font-black text-white tracking-tight leading-none mb-1">
                {item.value}
              </p>
              <span className="text-[12px] text-white/20 font-semibold">{item.sub}</span>
            </div>
          );
        })}
        </div>
      </section>

      {/* Top Songs vertical track list */}
      <section className="text-left space-y-6">
        <div>
          <h3 className="text-[24px] font-black text-white tracking-tight">Top Songs</h3>
          <p className="text-[13px] text-zinc-500 font-medium">Your absolute chart-toppers on Nexus</p>
        </div>

        {topSongs.length === 0 ? (
          <div className="rounded-3xl p-12 text-center border border-white/5 bg-[#161618]/15">
            <Music size={32} className="mx-auto text-white/20 mb-3" />
            <p className="text-white/40 text-[15px] font-semibold">No tracks played yet. Start streaming to populate chart.</p>
          </div>
        ) : (
          <div className="space-y-1 border border-white/5 rounded-3xl overflow-hidden bg-[#121214]/30 p-2">
            {topSongs.slice(0, 5).map((track: any, idx: number) => {
              const rank = String(idx + 1).padStart(2, "0");
              const isLiked = likedSongs.has(track.id);
              const isCurrent = currentSong?.id === track.id;

              return (
                <div 
                  key={`top-song-${track.id}-${idx}`}
                  onClick={() => onSongClick({ ...track, color: accentColor })}
                  className={`group/row flex items-center justify-between gap-4 p-3 rounded-2xl hover:bg-white/5 cursor-pointer transition-colors ${
                    isCurrent ? "bg-white/[0.03]" : ""
                  }`}
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <span 
                      className={`text-[15px] font-black tracking-tight shrink-0 w-6 text-center ${
                        idx === 0 ? "text-amber-400" : idx === 1 ? "text-zinc-300" : idx === 2 ? "text-amber-600" : "text-white/25"
                      }`}
                    >
                      {rank}
                    </span>

                    <div className="relative w-11 h-11 shrink-0 rounded-lg overflow-hidden border border-white/5 shadow-sm">
                      <MusicArtwork src={track.artwork} alt={track.title} variant="track" rounded="none" className="w-full h-full" iconSize={18} />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/row:opacity-100 flex items-center justify-center transition-opacity">
                        {isCurrent && isPlaying ? (
                          <Pause size={16} fill="white" className="text-white" />
                        ) : (
                          <Play size={16} fill="white" className="text-white ml-0.5" />
                        )}
                      </div>
                    </div>

                    <div className="min-w-0 pr-2">
                      <h4 className={`text-[15px] font-bold truncate leading-tight tracking-tight ${isCurrent ? "" : "text-white"}`} style={isCurrent ? { color: accentColor } : {}}>
                        {track.title}
                      </h4>
                      <p className="text-[13px] text-white/40 truncate font-semibold leading-none mt-1">
                        {track.artist}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 shrink-0">
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-black tracking-wide border border-white/5 bg-white/5 text-white/40 uppercase">
                      {track.playCount} {track.playCount === 1 ? "play" : "plays"}
                    </span>
                    <span className="text-[13px] font-semibold text-white/30 hidden sm:inline">{track.duration}</span>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onRateSong(track.id, isLiked ? "none" : "like", { title: track.title, artist: track.artist });
                      }}
                      className={`p-2 rounded-lg hover:bg-white/5 transition-colors ${
                        isLiked ? "text-rose-500" : "text-white/20 hover:text-white"
                      }`}
                    >
                      <Heart size={16} fill={isLiked ? "currentColor" : "none"} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Recent Plays carousel shelf */}
      <section className="text-left space-y-6 relative group/shelf">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[24px] font-black text-white tracking-tight">Recent Plays</h3>
            <p className="text-[13px] text-zinc-500 font-medium font-medium">Revisit your recent listening sessions</p>
          </div>
          {uniqueRecentPlays.length > 5 && (
            <div className="flex items-center gap-4">
              <button onClick={() => scrollCarousel(recentScrollRef, "left")} className="text-white/40 hover:text-white transition-all"><ChevronLeft size={22} /></button>
              <button onClick={() => scrollCarousel(recentScrollRef, "right")} className="text-white/40 hover:text-white transition-all"><ChevronRight size={22} /></button>
            </div>
          )}
        </div>

        {uniqueRecentPlays.length === 0 ? (
          <div className="rounded-3xl p-12 text-center border border-white/5 bg-[#161618]/15">
            <Clock size={32} className="mx-auto text-white/20 mb-3" />
            <p className="text-white/40 text-[15px] font-semibold">No recent play logs. Start listening now.</p>
          </div>
        ) : (
          <div 
            ref={recentScrollRef}
            className="flex items-start gap-6 overflow-x-auto no-scrollbar scroll-smooth px-1 py-2"
          >
            {uniqueRecentPlays.map((song: any, idx: number) => (
              <div 
                key={`recent-play-${song.id}-${idx}`}
                onClick={() => onSongClick(song)}
                className="group flex flex-col w-[160px] sm:w-[180px] shrink-0 cursor-pointer text-left"
              >
                <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-[#161618] shadow-md border border-white/5 hover:shadow-xl transition-all">
                  <MusicArtwork src={song.artwork} alt={song.title} variant="track" rounded="none" className="w-full h-full scale-100 group-hover:scale-105 transition-transform duration-500" iconSize={24} />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-black hover:scale-105 transition-transform shadow-lg">
                      <Play size={20} fill="currentColor" className="ml-0.5 text-black" />
                    </div>
                  </div>
                </div>
                <h4 className="mt-3 font-bold text-white text-[15px] tracking-tight truncate pr-1">{song.title}</h4>
                <p className="text-[13px] text-white/40 truncate font-semibold leading-tight mt-0.5">{song.artist}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Top Creators horizontal carousel */}
      <section className="text-left space-y-6 relative group/shelf">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[24px] font-black text-white tracking-tight">Top Creators</h3>
            <p className="text-[13px] text-zinc-500 font-medium">The artists that accompanied you the most</p>
          </div>
          {topArtists.length > 5 && (
            <div className="flex items-center gap-4">
              <button onClick={() => scrollCarousel(artistsScrollRef, "left")} className="text-white/40 hover:text-white transition-all"><ChevronLeft size={22} /></button>
              <button onClick={() => scrollCarousel(artistsScrollRef, "right")} className="text-white/40 hover:text-white transition-all"><ChevronRight size={22} /></button>
            </div>
          )}
        </div>

        {topArtists.length === 0 ? (
          <div className="rounded-3xl p-12 text-center border border-white/5 bg-[#161618]/15">
            <Users size={32} className="mx-auto text-white/20 mb-3" />
            <p className="text-white/40 text-[15px] font-semibold">No artist history available yet.</p>
          </div>
        ) : (
          <div
            ref={artistsScrollRef}
            className="flex items-start gap-6 overflow-x-auto no-scrollbar scroll-smooth px-1 py-2"
          >
            {topArtists.map((artist: any, idx: number) => (
              <div 
                key={`top-artist-${idx}`}
                onClick={() => router.push(`/artist/${encodeURIComponent(artist.name)}`)}
                className="group flex flex-col w-[160px] sm:w-[180px] shrink-0 cursor-pointer text-center"
              >
                <div className="relative aspect-square w-full rounded-full overflow-hidden border border-white/10 shadow-md hover:border-white/30 transition-colors bg-[#121214]">
                  <MusicArtwork
                    src={artistImages[artist.name]}
                    alt={artist.name}
                    variant="artist"
                    rounded="full"
                    className="w-full h-full group-hover:scale-105 transition-transform duration-500"
                    iconSize={32}
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-full">
                    <span className="text-[11px] font-black tracking-wider text-white uppercase bg-black/60 px-2.5 py-1 rounded-full">View</span>
                  </div>
                </div>
                <h4 className="mt-3 font-bold text-white text-[15px] tracking-tight line-clamp-2 px-1 group-hover:text-[var(--art-accent,#FA233B)] transition-colors">{artist.name}</h4>
                <span className="text-[11px] font-black text-white/25 uppercase tracking-tight mt-0.5">{artist.playCount} plays</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Social list modal */}
      <AnimatePresence>
        {socialModal && (
          <>
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-90 bg-black/70"
              onClick={() => setSocialModal(null)}
            />
            <m.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.98 }}
              className="fixed left-1/2 top-1/2 z-100 w-[min(92vw,420px)] max-h-[70vh] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-white/10 bg-[#161618] shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
                <h3 className="text-[18px] font-black text-white tracking-tight capitalize">{socialModal}</h3>
                <button
                  type="button"
                  onClick={() => setSocialModal(null)}
                  className="rounded-full p-2 text-white/40 hover:bg-white/5 hover:text-white transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="max-h-[calc(70vh-64px)] overflow-y-auto no-scrollbar p-3">
                {socialModal === "followers" ? (
                  followers.length === 0 ? (
                    <p className="px-3 py-8 text-center text-[14px] font-semibold text-white/35">No followers yet.</p>
                  ) : (
                    followers.map((person: any) => (
                      <button
                        key={person.email}
                        type="button"
                        onClick={() => {
                          setSocialModal(null);
                          router.push(`/stats?user=${encodeURIComponent(person.email)}`);
                        }}
                        className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-white/5 transition-colors"
                      >
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/10">
                          <MusicArtwork src={person.image} alt={person.name} variant="artist" rounded="full" className="h-full w-full" iconSize={16} />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-bold text-white">{person.name}</p>
                          <p className="truncate text-[12px] text-white/35">{person.email}</p>
                        </div>
                      </button>
                    ))
                  )
                ) : followingUsers.length === 0 && followingArtists.length === 0 ? (
                  <p className="px-3 py-8 text-center text-[14px] font-semibold text-white/35">Not following anyone yet.</p>
                ) : (
                  <div className="space-y-4">
                    {followingUsers.length > 0 && (
                      <div>
                        <p className="px-3 pb-2 text-[11px] font-black uppercase tracking-[0.2em] text-white/30">Users</p>
                        {followingUsers.map((person: any) => (
                          <button
                            key={person.email}
                            type="button"
                            onClick={() => {
                              setSocialModal(null);
                              router.push(`/stats?user=${encodeURIComponent(person.email)}`);
                            }}
                            className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-white/5 transition-colors"
                          >
                            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/10">
                              <MusicArtwork src={person.image} alt={person.name} variant="artist" rounded="full" className="h-full w-full" iconSize={16} />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-[14px] font-bold text-white">{person.name}</p>
                              <p className="truncate text-[12px] text-white/35">{person.email}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {followingArtists.length > 0 && (
                      <div>
                        <p className="px-3 pb-2 text-[11px] font-black uppercase tracking-[0.2em] text-white/30">Artists</p>
                        {followingArtists.map((artist: any) => (
                          <button
                            key={artist.channelId || artist.name}
                            type="button"
                            onClick={() => {
                              setSocialModal(null);
                              router.push(`/artist/${encodeURIComponent(artist.name)}`);
                            }}
                            className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-white/5 transition-colors"
                          >
                            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/10">
                              <MusicArtwork src={artist.thumbnail} alt={artist.name} variant="artist" rounded="full" className="h-full w-full" iconSize={16} />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-[14px] font-bold text-white">{artist.name}</p>
                              <p className="truncate text-[12px] text-white/35">YouTube Artist</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </m.div>
          </>
        )}
      </AnimatePresence>

      {/* Cinematic Wrapped Slideshow Modal */}
      <AnimatePresence>
        {showWrappedModal && wrappedData && (
          <m.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-100 flex items-center justify-center bg-black/95 p-4 sm:p-8"
          >
            {/* Slide Layout container */}
            <div 
              className="relative w-full max-w-lg aspect-[9/16] max-h-[85vh] sm:aspect-square sm:max-w-2xl rounded-3xl overflow-hidden border border-white/10 flex flex-col justify-between p-8 sm:p-12 text-left animate-gpu"
              style={{
                backgroundImage: `radial-gradient(circle at 50% 30%, ${accentColor}33 0%, transparent 60%), linear-gradient(180deg, #0d0d0f 0%, #050507 100%)`,
                boxShadow: `0 30px 100px -10px ${accentColor}29`
              }}
            >
              {/* Close Button */}
              <button 
                onClick={() => setShowWrappedModal(false)}
                className="absolute top-6 right-6 p-2 rounded-full bg-white/5 border border-white/5 hover:bg-white/10 text-white/80 hover:text-white transition-all z-10"
              >
                <X size={20} />
              </button>

              {/* Slider Progress Bar */}
              <div className="absolute top-6 left-6 right-16 flex gap-1.5 h-1 z-10">
                {Array.from({ length: 5 }).map((_, idx) => (
                  <div key={`prog-${idx}`} className="flex-1 bg-white/10 rounded-full overflow-hidden h-full">
                    <div 
                      className="bg-white h-full transition-all duration-300"
                      style={{
                        width: wrappedSlideIndex > idx ? "100%" : wrappedSlideIndex === idx ? "100%" : "0%",
                        opacity: wrappedSlideIndex >= idx ? 1 : 0,
                        transitionDuration: wrappedSlideIndex === idx ? "0ms" : "300ms"
                      }}
                    />
                  </div>
                ))}
              </div>

              {/* Slides Content */}
              <div className="flex-1 flex flex-col justify-center py-8">
                <AnimatePresence mode="wait">
                  {wrappedSlideIndex === 0 && (
                    <m.div
                      key="slide-0"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="space-y-4"
                    >
                      <span 
                        className="px-3.5 py-1.5 rounded-full text-[12px] font-black tracking-widest border uppercase leading-none"
                        style={{ borderColor: `${accentColor}33`, color: accentColor }}
                      >
                        Wrapped {wrappedData.year}
                      </span>
                      <h2 className="text-[44px] sm:text-[56px] font-black text-white tracking-tighter leading-none pt-2">
                        Your Year <br/>in Nexus Music.
                      </h2>
                      <p className="text-[15px] sm:text-[17px] text-white/40 font-semibold leading-relaxed max-w-sm">
                        Let's take a private journey through the tracks and creators that painted your year in sound.
                      </p>
                    </m.div>
                  )}

                  {wrappedSlideIndex === 1 && (
                    <m.div
                      key="slide-1"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="space-y-4 text-center sm:text-left"
                    >
                      <Clock size={48} className="text-white/20 mx-auto sm:mx-0" style={{ color: accentColor }} />
                      <h3 className="text-[15px] font-black uppercase text-white/40 tracking-wider pt-2">Listening Stats</h3>
                      <h2 className="text-[40px] sm:text-[52px] font-black text-white tracking-tighter leading-none">
                        {formatListeningTime(wrappedData.listeningTime)}
                      </h2>
                      <p className="text-[15px] sm:text-[17px] text-white/40 font-semibold leading-relaxed max-w-md">
                        That is a massive {Math.round(wrappedData.listeningTime / 60)} minutes spent with Nexus. You explored vibes, relaxed, and focused on things that truly mattered.
                      </p>
                    </m.div>
                  )}

                  {wrappedSlideIndex === 2 && (
                    <m.div
                      key="slide-2"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="space-y-5"
                    >
                      <h3 className="text-[14px] font-black uppercase text-white/40 tracking-wider">Your Top Songs</h3>
                      {wrappedData.topSongs.length === 0 ? (
                        <p className="text-white/45 text-[15px]">No songs tracked yet for this year.</p>
                      ) : (
                        <div className="space-y-3">
                          {wrappedData.topSongs.slice(0, 5).map((track: any, sIdx: number) => (
                            <div key={`ws-${sIdx}`} className="flex items-center gap-4 bg-white/5 border border-white/5 p-3 rounded-2xl">
                              <span className="text-[15px] font-black text-white/30 shrink-0 w-5 text-center">{sIdx + 1}</span>
                              <div className="w-10 h-10 shrink-0 rounded-lg overflow-hidden border border-white/10">
                                <MusicArtwork src={track.artwork} alt={track.title} variant="track" rounded="none" className="w-full h-full" iconSize={16} />
                              </div>
                              <div className="min-w-0 text-left flex-1">
                                <h4 className="text-[14px] font-bold text-white truncate leading-tight">{track.title}</h4>
                                <p className="text-[12px] text-white/40 truncate font-semibold leading-none mt-1">{track.artist}</p>
                              </div>
                              <span className="text-[11px] font-black text-white/30 uppercase shrink-0 pr-1">{track.playCount} plays</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </m.div>
                  )}

                  {wrappedSlideIndex === 3 && (
                    <m.div
                      key="slide-3"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="space-y-5"
                    >
                      <h3 className="text-[14px] font-black uppercase text-white/40 tracking-wider">Your Top Artists</h3>
                      {wrappedData.topArtists.length === 0 ? (
                        <p className="text-white/45 text-[15px]">No artist data tracked yet for this year.</p>
                      ) : (
                        <div className="space-y-3">
                          {wrappedData.topArtists.slice(0, 5).map((art: any, aIdx: number) => (
                            <div key={`wa-${aIdx}`} className="flex items-center justify-between bg-white/5 border border-white/5 p-3.5 rounded-2xl text-left">
                              <div className="flex items-center gap-4 min-w-0">
                                <span className="text-[15px] font-black text-white/30 shrink-0 w-5 text-center">{aIdx + 1}</span>
                                <div className="w-9 h-9 shrink-0 rounded-full overflow-hidden border border-white/10">
                                  <MusicArtwork
                                    src={artistImages[art.name]}
                                    alt={art.name}
                                    variant="artist"
                                    rounded="full"
                                    className="w-full h-full"
                                    iconSize={14}
                                  />
                                </div>
                                <h4 className="text-[15px] font-bold text-white truncate leading-none">{art.name}</h4>
                              </div>
                              <span className="text-[11px] font-black text-white/30 uppercase shrink-0">{art.playCount} plays</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </m.div>
                  )}

                  {wrappedSlideIndex === 4 && (
                    <m.div
                      key="slide-4"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="space-y-4 text-center sm:text-left"
                    >
                      <div 
                        className="w-16 h-16 rounded-3xl flex items-center justify-center border mx-auto sm:mx-0"
                        style={{ borderColor: `${accentColor}33`, backgroundColor: `${accentColor}12`, color: accentColor }}
                      >
                        <Sparkles size={32} />
                      </div>
                      <h3 className="text-[14px] font-black uppercase text-white/40 tracking-wider pt-2">Your Listening Aura</h3>
                      <h2 className="text-[36px] sm:text-[44px] font-black text-white tracking-tighter leading-none">
                        The Adventurer
                      </h2>
                      <p className="text-[15px] sm:text-[17px] text-white/40 font-semibold leading-relaxed max-w-sm">
                        You don't just stay in one place. Your play counts show a high search and discovery rate of different styles, pushing the boundaries of standard musical genres.
                      </p>
                    </m.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Slider Bottom Navigation */}
              <div className="flex items-center justify-between pt-6 border-t border-white/5">
                <button
                  disabled={wrappedSlideIndex === 0}
                  onClick={() => setWrappedSlideIndex(v => v - 1)}
                  className="px-5 py-2.5 rounded-xl border border-white/5 bg-white/5 text-white/70 hover:text-white transition-all disabled:opacity-30 disabled:hover:text-white/70"
                >
                  Back
                </button>

                {wrappedSlideIndex < 4 ? (
                  <button
                    onClick={() => setWrappedSlideIndex(v => v + 1)}
                    className="px-6 py-2.5 rounded-xl text-black font-extrabold text-[13px] hover:scale-105 active:scale-95 transition-transform bg-white hover:bg-[#ececf0]"
                    style={{ boxShadow: `0 8px 24px ${accentColor}18` }}
                  >
                    Next
                  </button>
                ) : (
                  <button
                    onClick={() => setShowWrappedModal(false)}
                    className="px-6 py-2.5 rounded-xl text-black font-extrabold text-[13px] hover:scale-105 active:scale-95 transition-transform bg-white hover:bg-[#ececf0]"
                    style={{ boxShadow: `0 8px 24px ${accentColor}18` }}
                  >
                    Finish
                  </button>
                )}
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
