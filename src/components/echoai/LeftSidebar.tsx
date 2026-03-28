import { Home, Compass, BarChart3, Settings, Music } from "lucide-react";
import { SidebarAuth } from "./SidebarAuth";

interface LeftSidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
  accentColor: string;
}

export function LeftSidebar({ activeView, onViewChange, accentColor }: LeftSidebarProps) {
  const navItems = [
    { id: "home", icon: Home, label: "Home" },
    { id: "explorer", icon: Compass, label: "Explorer" },
    { id: "stats", icon: BarChart3, label: "Stats" },
    { id: "settings", icon: Settings, label: "Settings" },
  ];

  return (
    <div className="w-[280px] h-full flex flex-col p-6 backdrop-blur-3xl bg-white/[0.03] border-r border-white/[0.08]">
      <div className="mb-12">
        <h1
          className="text-2xl font-bold bg-clip-text text-transparent"
          style={{ backgroundImage: `linear-gradient(to right, #ffffff, ${accentColor}, #ffffff)` }}
        >
          EchoAI
        </h1>
        <p className="text-xs text-white/40 mt-1">Powered by Intelligence</p>
      </div>

      <nav className="space-y-2 mb-12">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-300 ${
                isActive
                  ? "bg-white/[0.08] text-white border"
                  : "text-white/60 hover:text-white hover:bg-white/[0.04]"
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
        <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-4">Your Playlists</h3>
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
  );
}
