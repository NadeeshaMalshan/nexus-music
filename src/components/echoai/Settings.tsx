"use client";

import React from "react";
import { m } from "motion/react";
import { APPLE_EASE } from "@/lib/animations";
import { 
  AudioLines, 
  Video, 
  PlayCircle, 
  Zap, 
  Repeat, 
  MoveHorizontal, 
  RefreshCcw, 
  ChevronRight,
  Settings as SettingsIcon,
  ShieldCheck,
  Music,
  Monitor,
  LogOut,
  LogIn
} from "lucide-react";
import { useSettings } from "@/context/SettingsContext";
import { VideoQuality, AudioQuality, DefaultPlayMode } from "@/types/settings";
import { useSession, signIn, signOut } from "next-auth/react";
import { MusicArtwork } from "./MusicArtwork";
import { useDashboard } from "@/context/DashboardContext";
import { useJam } from "@/context/JamContext";

interface SettingsRowProps {
  icon: React.ReactNode;
  label: string;
  description?: string;
  children: React.ReactNode;
}

function SettingsRow({ icon, label, description, children }: SettingsRowProps) {
  return (
    <div className="flex items-center justify-between py-5 border-b border-white/5 last:border-0 group">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/60 group-hover:bg-white/10 group-hover:text-white transition-all duration-300">
          {icon}
        </div>
        <div>
          <h3 className="text-white font-medium text-[16px] leading-tight">{label}</h3>
          {description && <p className="text-white/40 text-[13px] mt-1 font-medium">{description}</p>}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {children}
      </div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (val: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="relative w-11 h-6 rounded-full transition-colors duration-300 focus:outline-none"
      style={{ backgroundColor: checked ? 'var(--art-accent, #FA243C)' : 'rgba(255,255,255,0.1)' }}
    >
      <m.div
        animate={{ x: checked ? 22 : 2 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="absolute top-1 left-0 w-4 h-4 rounded-full bg-white shadow-sm"
      />
    </button>
  );
}

function Select<T extends string>({ 
  value, 
  options, 
  onChange 
}: { 
  value: T; 
  options: { label: string; value: T }[]; 
  onChange: (val: T) => void 
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="bg-white/5 text-white/80 text-[14px] font-medium py-1.5 px-3 rounded-lg border-0 outline-none hover:bg-white/10 transition-colors cursor-pointer appearance-none min-w-[100px] text-right"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value} className="bg-[#1c1c1e] text-white">
          {opt.label}
        </option>
      ))}
    </select>
  );
}

export function Settings() {
  const { settings, updateSetting } = useSettings();
  const { data: session, status } = useSession();
  const { isRightSidebarOpen } = useDashboard();
  const { jamState } = useJam();
  const isJamActive = !!jamState?.roomId;

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const, staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className={`flex-1 h-full overflow-y-auto bg-transparent px-4 py-8 md:px-10 md:py-12 lg:px-16 pb-40 custom-scrollbar transition-[padding-right] duration-[450ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
      isRightSidebarOpen ? "lg:pr-[380px]" : "lg:pr-0"
    }`}>
      <m.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-4xl mr-auto animate-gpu"
      >
  
        {/* ── Header ────────────────────────────────────────────────────────── */}
        <header className="mb-14">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white leading-none mb-4">
            Settings
          </h1>
          <p className="text-[20px] font-medium text-white/40">Manage your music experience.</p>
        </header>

              {/* ── Account Section ────────────────────────────────────────────────── */}
        <m.div variants={itemVariants} className="mb-12">
          {status === "authenticated" ? (
            <div className="bg-white/2 border border-white/5 rounded-[28px] p-6 flex items-center justify-between group hover:bg-white/5 transition-all duration-500">
              <div className="flex items-center gap-5">
                <div className="relative w-16 h-16 rounded-2xl overflow-hidden ring-4 ring-white/5 shadow-2xl">
                  <MusicArtwork
                    src={session.user?.image}
                    alt={session.user?.name || "Account"}
                    iconSize={32}
                    variant="artist"
                    rounded="2xl"
                    className="h-full w-full"
                  />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">{session.user?.name}</h2>
                  <p className="text-white/40 text-[14px] font-medium">{session.user?.email}</p>
                </div>
              </div>
              <button 
                onClick={() => signOut()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 text-white/60 hover:bg-red-500/10 hover:text-red-500 transition-all font-bold text-[14px]"
              >
                <LogOut size={18} />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <div className="bg-linear-to-br from-(--art-accent,#FA243C) to-red-600 rounded-[28px] p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-[0_20px_50px_rgba(250,36,60,0.3)]">
              <div className="text-center md:text-left">
                <h2 className="text-2xl font-black text-white tracking-tight leading-none mb-2">Sync your Music</h2>
                <p className="text-white/80 font-medium text-[16px]">Sign in to access your library, playlists, and AI history across any device.</p>
              </div>
              <button 
                onClick={() => signIn("google")}
                className="whitespace-nowrap px-8 py-4 bg-white text-black rounded-2xl font-black text-[16px] flex items-center gap-3 hover:scale-105 active:scale-95 transition-all shadow-xl"
              >
                <LogIn size={20} />
                Sign in with Google
              </button>
            </div>
          )}
        </m.div>


        {/* ── Playback Section ──────────────────────────────────────────────── */}
        <m.section variants={itemVariants} className="mb-12">
          <div className="flex items-center gap-2 mb-6 text-white/30 uppercase tracking-widest text-[11px] font-bold">
            <Music size={14} />
            <span>Playback Experience</span>
          </div>
          
          <div className="bg-white/2 border border-white/5 rounded-[28px] px-8 py-2 overflow-hidden">
            <SettingsRow 
              icon={<Repeat size={20} />} 
              label="Gapless Playback" 
              description="Eliminate time gaps between consecutive audio tracks."
            >
              <Toggle 
                checked={settings.gaplessPlayback} 
                onChange={(val) => updateSetting("gaplessPlayback", val)} 
              />
            </SettingsRow>

            <SettingsRow 
              icon={<MoveHorizontal size={20} />} 
              label="Crossfade Songs" 
              description={isJamActive ? "Disabled during Jam sessions" : `${settings.crossfade} seconds`}
            >
              <input 
                type="range" 
                min="0" 
                max="12" 
                step="1"
                value={isJamActive ? 0 : settings.crossfade}
                disabled={isJamActive}
                onChange={(e) => updateSetting("crossfade", parseInt(e.target.value))}
                className={`w-32 h-1 bg-white/10 rounded-full accent-[var(--art-accent,#FA243C)] ${isJamActive ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              />
            </SettingsRow>

            <SettingsRow 
              icon={<RefreshCcw size={20} />} 
              label="Autoplay" 
              description="Keep playing similar music when your queue ends."
            >
              <Toggle 
                checked={settings.autoplay} 
                onChange={(val) => updateSetting("autoplay", val)} 
              />
            </SettingsRow>
          </div>
        </m.section>

        {/* ── Quality Section ────────────────────────────────────────────────── */}
        <m.section variants={itemVariants} className="mb-12">
          <div className="flex items-center gap-2 mb-6 text-white/30 uppercase tracking-widest text-[11px] font-bold">
            <ShieldCheck size={14} />
            <span>Audio & Video Quality</span>
          </div>
          
          <div className="bg-white/2 border border-white/5 rounded-[28px] px-8 py-2 overflow-hidden">
            <SettingsRow 
              icon={<AudioLines size={20} />} 
              label="Audio Quality" 
              description="Higher quality uses more data."
            >
              <Select<AudioQuality>
                value={settings.audioQuality}
                options={[
                  { label: "High", value: "high" },
                  { label: "Normal", value: "normal" },
                  { label: "Low", value: "low" },
                ]}
                onChange={(val) => updateSetting("audioQuality", val)}
              />
            </SettingsRow>

            <SettingsRow 
              icon={<Video size={20} />} 
              label="Video Quality" 
              description="Preferred resolution for video playback."
            >
              <Select<VideoQuality>
                value={settings.videoQuality}
                options={[
                  { label: "Auto", value: "auto" },
                  { label: "1080p", value: "1080p" },
                  { label: "720p", value: "720p" },
                  { label: "480p", value: "480p" },
                  { label: "360p", value: "360p" },
                ]}
                onChange={(val) => updateSetting("videoQuality", val)}
              />
            </SettingsRow>

            <SettingsRow 
              icon={<PlayCircle size={20} />} 
              label="Default Play Mode" 
              description="Prefer audio only or the music video when available."
            >
              <Select<DefaultPlayMode>
                value={settings.defaultPlayMode}
                options={[
                  { label: "Audio Only", value: "audio" },
                  { label: "Music Video", value: "video" },
                ]}
                onChange={(val) => updateSetting("defaultPlayMode", val)}
              />
            </SettingsRow>
          </div>
        </m.section>

        {/* ── Performance Section ────────────────────────────────────────────── */}
        <m.section variants={itemVariants} className="mb-12">
          <div className="flex items-center gap-2 mb-6 text-white/30 uppercase tracking-widest text-[11px] font-bold">
            <Monitor size={14} />
            <span>Accessibility & Interface</span>
          </div>
          
          <div className="bg-white/2 border border-white/5 rounded-[28px] px-8 py-2 overflow-hidden">
            <SettingsRow 
              icon={<Zap size={20} />} 
              label="Reduce Animations" 
              description="Minimize motion effects for a smoother UI."
            >
              <Toggle 
                checked={settings.reduceAnimations} 
                onChange={(val) => updateSetting("reduceAnimations", val)} 
              />
            </SettingsRow>
          </div>
        </m.section>

        {/* ── Footer Info ───────────────────────────────────────────────────── */}
        <footer className="mt-20 text-center pb-12">
          <div className="flex items-center justify-center gap-2 text-white/20 font-bold tracking-tight mb-2">
            <div className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center">
              <span className="text-[14px]">N</span>
            </div>
            <span>NEXUS MUSIC</span>
          </div>
          <p className="text-white/10 text-[12px] font-medium">Version 2.4.0 (2024.04)</p>
        </footer>
      </m.div>
    </div>
  );
}
