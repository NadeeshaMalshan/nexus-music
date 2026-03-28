import { Home, Compass, BarChart3, Settings, Music, Search, ListMusic } from "lucide-react";
import { SidebarAuth } from "./SidebarAuth";

interface LeftSidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
  accentColor: string;
}

export function LeftSidebar({ activeView, onViewChange, accentColor }: LeftSidebarProps) {
  const navItems = [
    { id: "home", icon: Home, label: "Home" },
    { id: "search", icon: Search, label: "Search" },
    { id: "library", icon: ListMusic, label: "Library" },
    { id: "explorer", icon: Compass, label: "Explorer" },
    { id: "stats", icon: BarChart3, label: "Stats" },
    { id: "settings", icon: Settings, label: "Settings" },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden h-full w-[280px] shrink-0 flex-col border-r border-white/8 bg-white/[0.03] p-6 backdrop-blur-3xl lg:flex">
        <div className="mb-12">
          <h1
            className="bg-clip-text text-2xl font-bold text-transparent"
            style={{ backgroundImage: `linear-gradient(to right, #ffffff, ${accentColor}, #ffffff)` }}
          >
            EchoAI
          </h1>
          <p className="mt-1 text-xs text-white/40">Powered by Intelligence</p>
        </div>

        <nav className="mb-12 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={`flex w-full items-center gap-4 rounded-xl px-4 py-3 transition-all duration-300 ${
                  isActive
                    ? "border bg-white/[0.08] text-white"
                    : "text-white/60 hover:bg-white/[0.04] hover:text-white"
                }`}
                style={isActive ? { borderColor: `${accentColor}66`, boxShadow: `0 0 20px ${accentColor}4d` } : {}}
              >
                <Icon size={20} style={isActive ? { color: accentColor } : {}} />
                <span className="text-sm font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="flex-1 overflow-hidden">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-white/40">Your Playlists</h3>
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 text-sm text-white/50">
            <div className="mb-2 flex items-center gap-2 text-white/70">
              <Music size={16} />
              No playlists available
            </div>
            Add songs via Search to start listening.
          </div>
        </div>
        
        <SidebarAuth />
      </div>

      {/* Mobile Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-white/8 bg-[#06060a]/90 px-2 pb-safe pt-2 backdrop-blur-xl lg:hidden">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`flex flex-col items-center gap-1 rounded-lg p-3 transition-colors ${
                isActive ? "text-white" : "text-white/50 hover:text-white"
              }`}
            >
              <Icon size={22} style={isActive ? { color: accentColor } : {}} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
