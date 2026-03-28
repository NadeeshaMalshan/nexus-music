import { Home, Compass, BarChart3, Settings, Music, Search, ListMusic, Loader2, PlayCircle } from "lucide-react";
import { SidebarAuth } from "./SidebarAuth";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { type YouTubePlaylist } from "@/lib/youtubeData";
import Link from "next/link";
import { useDashboard } from "@/context/DashboardContext";

interface LeftSidebarProps {
  activeView: string;
  onViewChange: (view: string, data?: any) => void;
  accentColor: string;
}

export function LeftSidebar({ activeView, accentColor }: LeftSidebarProps) {
  const { data: session } = useSession();
  const { setSelectedPlaylist } = useDashboard();
  const [playlists, setPlaylists] = useState<YouTubePlaylist[]>([]);
  const [loading, setLoading] = useState(false);

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

  const navItems = [
    { id: "home", icon: Home, label: "Home", href: "/" },
    { id: "search", icon: Search, label: "Search", href: "/search" },
    { id: "library", icon: ListMusic, label: "Library", href: "/library" },
    { id: "nowplaying", icon: PlayCircle, label: "Now Playing", href: "/nowplaying" },
    { id: "explorer", icon: Compass, label: "Explorer", href: "/explorer" },
    { id: "stats", icon: BarChart3, label: "Stats", href: "/stats" },
    { id: "settings", icon: Settings, label: "Settings", href: "/settings" },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden h-full w-[280px] shrink-0 flex-col border-r border-white/8 bg-white/[0.03] p-6 backdrop-blur-3xl lg:flex">
        <div className="mb-12">
          <Link href="/">
            <h1
              className="bg-clip-text text-2xl font-bold text-transparent"
              style={{ backgroundImage: `linear-gradient(to right, #ffffff, var(--art-accent, #a855f7), #ffffff)` }}
            >
              EchoAI
            </h1>
          </Link>
          <p className="mt-1 text-xs text-white/40">Powered by Intelligence</p>
        </div>

        <nav className="mb-12 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id || (item.id === "home" && activeView === "");
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`flex w-full items-center gap-4 rounded-xl px-4 py-3 transition-all duration-300 ${
                  isActive
                    ? "border bg-white/[0.08] text-white"
                    : "text-white/60 hover:bg-white/[0.04] hover:text-white"
                }`}
                style={isActive ? { borderColor: `color-mix(in srgb, var(--art-accent, #a855f7) 40%, transparent)`, boxShadow: `0 0 20px color-mix(in srgb, var(--art-accent, #a855f7) 30%, transparent)` } : {}}
              >
                <Icon size={20} style={isActive ? { color: "var(--art-accent, #a855f7)" } : {}} />
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40">Your Playlists</h3>
            <Link href="/playlists" className="text-[10px] text-white/40 hover:text-white transition-colors">View All</Link>
          </div>
          <div className="space-y-1">
            {loading ? (
              <div className="flex items-center gap-2 p-3 text-white/20">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-sm">Fetching...</span>
              </div>
            ) : playlists.length > 0 ? (
              playlists.slice(0, 10).map((pl) => (
                <Link
                  key={pl.id}
                  href={`/playlists/${pl.id}`}
                  onClick={() => setSelectedPlaylist(pl)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/60 transition-colors hover:bg-white/[0.04] hover:text-white"
                >
                  <Music size={16} className="shrink-0" />
                  <span className="truncate text-left">{pl.title}</span>
                </Link>
              ))
            ) : (
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 text-sm text-white/50">
                <div className="mb-2 flex items-center gap-2 text-white/70">
                  <Music size={16} />
                  No playlists available
                </div>
                {session ? "You don't have any playlists yet." : "Sign in to see your playlists."}
              </div>
            )}
          </div>
        </div>
        
        <SidebarAuth />
      </div>

      {/* Mobile Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-white/8 bg-[#06060a]/90 px-2 pb-safe pt-2 backdrop-blur-xl lg:hidden">
        {navItems.slice(0, 4).map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id || (item.id === "home" && activeView === "");
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`flex flex-col items-center gap-1 rounded-lg p-3 transition-colors ${
                isActive ? "text-white" : "text-white/50 hover:text-white"
              }`}
            >
              <Icon size={22} style={isActive ? { color: "var(--art-accent, #a855f7)" } : {}} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
