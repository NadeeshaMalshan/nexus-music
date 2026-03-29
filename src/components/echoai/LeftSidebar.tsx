"use client";

import { Home, Compass, Settings, Music2, Search, ListMusic, Loader2, PlayCircle, Clock, Mic2, Album, UserCircle, LayoutGrid, Plus, ChevronDown, MoreHorizontal, Mic, X, ArrowUpRight, Play, Sparkles, User, LogIn } from "lucide-react";
import { SidebarAuth } from "./SidebarAuth";
import { useSession, signIn, signOut } from "next-auth/react";
import { useEffect, useState, useCallback, useRef } from "react";
import { type YouTubePlaylist } from "@/lib/youtubeData";
import Link from "next/link";
import { useDashboard } from "@/context/DashboardContext";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { CreatePlaylistModal, AiPlaylistModal } from "./LibraryModals";

interface LeftSidebarProps {
  activeView: string;
  onViewChange: (view: string, data?: any) => void;
  accentColor: string;
}

export function LeftSidebar({ activeView: propActiveView, onViewChange, accentColor }: LeftSidebarProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const activeView = pathname === "/" ? "home" : pathname.split("/")[1] || "home";

  const { setSelectedPlaylist, onSongClick } = useDashboard();
  const [playlists, setPlaylists] = useState<YouTubePlaylist[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimeoutRef = useRef<number | null>(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  useEffect(() => {
    async function loadPlaylists() {
      if (!session?.accessToken) return;
      setLoading(true);
      try {
        const response = await fetch("/api/youtube/playlists");
        if (response.ok) {
          const data = await response.json();
          setPlaylists(data);
        }
      } catch (err) {
        console.error("Sidebar playlist fetch error:", err);
      } finally {
        setLoading(false);
      }
    }
    if (session) loadPlaylists();
  }, [session]);

  const performSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.items.slice(0, 8));
      }
    } catch (err) {
      console.error("Sidebar search error:", err);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    if (searchTimeoutRef.current) window.clearTimeout(searchTimeoutRef.current);
    if (!searchQuery) {
      setSearchResults([]);
      return;
    }
    searchTimeoutRef.current = window.setTimeout(() => {
      performSearch(searchQuery);
    }, 400);
    return () => {
      if (searchTimeoutRef.current) window.clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery, performSearch]);

  const navigationItems = [
    { id: "home", icon: Home, label: "Home", href: "/" },
    { id: "library", icon: ListMusic, label: "Library", href: "/library" },
    { id: "settings", icon: Settings, label: "Settings", href: "/settings" },
  ];

  const renderNavItem = (item: any) => {
    const Icon = item.icon;
    const isActive = activeView === item.id;
    
    return (
      <Link
        key={item.id}
        href={item.href}
        className={`flex w-full items-center gap-4 rounded-2xl px-4 py-3.5 transition-all duration-300 group ${
          isActive
            ? "bg-white/10 text-white shadow-[0_8px_32px_rgba(255,255,255,0.05)]"
            : "text-white/40 hover:bg-white/5 hover:text-white"
        }`}
      >
        <Icon 
          size={22} 
          className="transition-colors" 
          style={{ color: isActive ? accentColor : undefined }}
        />
        <span className={`text-[19px] font-black tracking-tight ${isActive ? "text-white" : "text-white/40 group-hover:text-white"}`}>
          {item.label}
        </span>
      </Link>
    );
  };

  return (
    <>
      <div className="hidden h-full w-[360px] shrink-0 flex-col bg-transparent px-6 py-10 overflow-hidden lg:flex relative border-r border-white/5 backdrop-blur-3xl">
        {/* Search Bar */}
        <div className="mb-12 relative z-50">
          <div className={`relative flex items-center overflow-hidden rounded-2xl transition-all duration-300 ${isSearchFocused ? "bg-white/15 ring-2 ring-[#FA243C]/20 shadow-2xl" : "bg-white/5"}`}>
            <div className="pl-4 pr-2 text-white/20">
              <Search size={20} />
            </div>
            <input 
              type="text"
              placeholder="Search music, artists..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              className="w-full bg-transparent py-3.5 pr-2 text-white text-[17px] font-medium placeholder-white/20 focus:outline-hidden"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="p-2 mr-1 text-white/40 hover:text-white transition-colors">
                <X size={18} />
              </button>
            )}
          </div>

          {/* Search Dropdown */}
          <AnimatePresence>
            {(isSearchFocused && (searchQuery || searchResults.length > 0)) && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-full left-0 right-0 mt-3 bg-[#1C1C1E]/95 backdrop-blur-3xl rounded-3xl overflow-hidden shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)] border border-white/10 z-60 py-4"
              >
                <div className="max-h-[70vh] overflow-y-auto no-scrollbar">
                  {searchQuery && (
                    <div className="px-2 mb-4">
                      <button 
                        onClick={() => { router.push(`/search?q=${encodeURIComponent(searchQuery)}`); setIsSearchFocused(false); }}
                        className="w-full flex items-center justify-between px-4 py-3 rounded-2xl hover:bg-white/5 text-white transition-colors group"
                      >
                        <div className="flex items-center gap-4">
                          <Search size={18} className="text-white/40" />
                          <span className="text-[17px] font-bold truncate">Search for {searchQuery}</span>
                        </div>
                        <ArrowUpRight size={18} className="text-white/20 group-hover:text-white/60" />
                      </button>
                    </div>
                  )}

                  {searchResults.map((song) => (
                    <div 
                      key={song.videoId}
                      onClick={() => {
                        onSongClick({
                          id: song.videoId,
                          title: song.title,
                          artist: song.author,
                          artwork: song.thumbnail,
                          duration: song.duration,
                          color: accentColor
                        });
                        setIsSearchFocused(false);
                      }}
                      className="px-2"
                    >
                      <div className="flex items-center gap-3.5 px-3 py-2.5 rounded-2xl hover:bg-white/5 transition-all cursor-pointer group">
                        <div className="relative w-11 h-11 rounded-lg overflow-hidden shrink-0 shadow-lg">
                          <Image src={song.thumbnail} alt="" fill className="object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Play size={16} fill="white" className="text-white ml-0.5" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0 pr-4">
                          <h4 className="text-[15px] font-bold text-white truncate leading-tight mb-0.5">{song.title}</h4>
                          <p className="text-[12px] text-white/40 font-medium truncate">{song.author}</p>
                        </div>
                      </div>
                    </div>
                  ))}

                  {searchLoading && (
                    <div className="flex justify-center py-6">
                      <Loader2 size={24} className="animate-spin" style={{ color: accentColor }} />
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {isSearchFocused && <div className="fixed inset-0 z-40" onClick={() => setIsSearchFocused(false)} />}
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar space-y-12">
          {/* Main Navigation - "Nexus" */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-4 mb-6">
              <h2 className="text-[38px] font-black text-white tracking-tighter leading-none hover:text-[#FA243C] transition-colors cursor-default">Nexus</h2>
              <button className="p-2.5 rounded-full bg-white/5 text-white/40 hover:bg-white/10 hover:text-white transition-all">
                <MoreHorizontal size={22} />
              </button>
            </div>
            
            <nav className="space-y-1">
              {navigationItems.map(renderNavItem)}
            </nav>
          </div>

          {/* Library Sub-Items - "Playlists" */}
          <div className="space-y-4">
             <div className="flex items-center justify-between px-4">
                <h3 className="text-[22px] font-black text-white/20 tracking-tight uppercase">Playlists</h3>
                <ChevronDown size={20} className="text-white/10" />
             </div>
             <nav className="space-y-1">
                {/* 1st Display: Create Playlist Button */}
                <button 
                  onClick={() => setIsCreateModalOpen(true)}
                  className="flex items-center gap-4 px-4 py-3 text-white/40 hover:text-white transition-colors group w-full text-left"
                >
                   <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-[#FA233B] group-hover:text-white transition-all duration-300">
                      <Plus size={18} />
                   </div>
                   <span className="text-[16px] font-bold">Create Checklist</span>
                </button>

                {/* 2nd Display: Generate AI Playlist Button */}
                <button 
                  onClick={() => setIsAiModalOpen(true)}
                  className="flex items-center gap-4 px-4 py-3 text-white/40 hover:text-white transition-colors group w-full text-left"
                >
                   <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-[#FA233B] group-hover:text-white transition-all duration-300">
                      <Sparkles size={16} />
                   </div>
                   <span className="text-[16px] font-bold">Generate a Playlist</span>
                </button>

                <div className="h-4" /> {/* Spacer */}

                {playlists.slice(0, 10).map((pl) => (
                  <Link
                    key={pl.id}
                    href={`/playlists/${pl.id}`}
                    onClick={() => setSelectedPlaylist(pl)}
                    className={`flex items-center gap-4 rounded-2xl px-4 py-2.5 transition-all hover:bg-white/5 group ${pathname.includes(pl.id) ? "text-white" : "text-white/40"}`}
                  >
                    <div className="relative w-8 h-8 rounded-lg overflow-hidden shrink-0 border border-white/5 opacity-60 group-hover:opacity-100 transition-opacity shadow-sm">
                      {pl.thumbnailUrl ? (
                         <Image src={pl.thumbnailUrl} alt="" fill className="object-cover" />
                      ) : (
                         <div className="absolute inset-0 bg-white/5 flex items-center justify-center"><Music2 size={12} /></div>
                      )}
                    </div>
                    <span className="truncate text-[16px] font-bold tracking-tight">{pl.title}</span>
                  </Link>
                ))}
             </nav>
          </div>
        </div>
        
        <div className="mt-auto pt-6 border-t border-white/5">
          <SidebarAuth />
        </div>
      </div>

      <CreatePlaylistModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
      <AiPlaylistModal isOpen={isAiModalOpen} onClose={() => setIsAiModalOpen(false)} />

      {/* Mobile Optimized Nav */}
      <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-white/5 bg-black/40 backdrop-blur-3xl lg:hidden pb-safe-offset-2 pt-2 px-6">
        {[
          { id: "home", icon: Home, label: "Home", href: "/" },
          { id: "search", icon: Search, label: "Search", href: "/search" },
          { id: "library", icon: ListMusic, label: "Library", href: "/library" },
          { 
            id: "auth", 
            icon: status === "authenticated" ? User : LogIn, 
            label: status === "authenticated" ? "Account" : "Login",
            onClick: () => {
              console.log("Auth trigger fired, current status:", status);
              if (status === "loading") return;
              if (status === "authenticated") void signOut();
              else void signIn("google");
            },
            isButton: true,
            isLoading: status === "loading"
          },
        ].map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          
          if (item.isButton) {
            return (
              <button
                key={item.id}
                type="button"
                onClick={item.onClick}
                disabled={item.isLoading}
                className={`flex flex-col items-center gap-1.5 p-3 px-6 transition-all ${item.isLoading ? "opacity-20 cursor-wait" : "text-zinc-500 hover:text-zinc-100"}`}
              >
                <Icon size={26} strokeWidth={2} className={item.isLoading ? "animate-pulse" : ""} />
                <span className="text-[11px] font-black uppercase tracking-widest">
                   {item.label}
                </span>
              </button>
            );
          }

          return (
            <Link
              key={item.id}
              href={item.href || "#"}
              className={`flex flex-col items-center gap-1.5 p-3 px-6 transition-all ${
                isActive ? "text-[#FA243C]" : "text-zinc-500 hover:text-zinc-100"
              }`}
            >
              <Icon size={26} strokeWidth={isActive ? 2.5 : 2} />
              <span className={`text-[11px] font-black uppercase tracking-widest ${isActive ? "opacity-100" : "opacity-40"}`}>
                 {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
