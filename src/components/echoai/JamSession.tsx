"use client";

import { useJam } from "@/context/JamContext";
import { Users, LogOut, Plus, Link, Check, Lock as Padlock, Share2, MoreHorizontal } from "lucide-react";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "motion/react";
import { MusicArtwork } from "./MusicArtwork";

const Avatar = ({ src, name }: { src: string | null; name: string }) => (
  <MusicArtwork src={src} alt={name} iconSize={22} variant="artist" rounded="full" className="h-full w-full" />
);

export function JamSession() {
  const { data: session } = useSession();
  const { jamState, createJam, joinJam, leaveJam } = useJam();
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [joinId, setJoinId] = useState("");
  const [userName, setUserName] = useState("");
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      setMounted(true);
    }, 0);
  }, []);

  const handleCopy = () => {
    if (jamState.roomId) {
      const url = `${window.location.origin}${window.location.pathname}?jam=${jamState.roomId}`;
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Listen for the jam param to show the join input
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const jamId = params.get("jam");
    if (jamId && !jamState.roomId) {
      setTimeout(() => {
        setJoinId(jamId.toUpperCase());
        setShowJoinInput(true);
      }, 0);
      const newUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({ path: newUrl }, "", newUrl);
    }
  }, [jamState.roomId]);

  if (!mounted) return null;

  if (jamState.roomId) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full space-y-6"
      >
        {/* Main Control Card */}
        <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] p-5 shadow-lg transition-all hover:bg-white/[0.04]">
          {/* Subtle Ambient Background */}
          <div 
            className="absolute -right-8 -top-8 h-32 w-32 rounded-full blur-[60px] opacity-10"
            style={{ backgroundColor: 'var(--art-accent, #FA243C)' }}
          />

          <div className="relative z-10 space-y-5">
            {/* Header Section */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div 
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/5 shadow-inner"
                  style={{ backgroundColor: 'var(--art-accent, #FA243C)15' }}
                >
                  <Users className="text-white" size={18} style={{ color: 'var(--art-accent, #FA243C)' }} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-[14px] font-bold text-white tracking-tight">
                      {jamState.listeners[0]?.name?.split(' ')[0] || "Anonymous"}&apos;s Jam
                    </h3>
                    <div className="flex items-center gap-1">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
                      </span>
                      <span className="text-[8px] font-black text-green-500 uppercase tracking-wider">LIVE</span>
                    </div>
                  </div>
                  <p className="text-[11px] font-medium text-white/40 mt-0.5">
                    {jamState.participants} {jamState.participants === 1 ? 'Person' : 'People'} Listening
                  </p>
                </div>
              </div>
              
              <button
                onClick={leaveJam}
                className="group flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-white/40 border border-white/5 transition-all hover:bg-red-500/10 hover:text-red-500 active:scale-95"
                title="End or Leave Echo AI"
              >
                <LogOut size={14} />
              </button>
            </div>

            {/* Room ID / Share Section */}
            <div className="space-y-4">
              <div className="flex flex-col gap-1 px-0.5">
                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/20">Session Room Code</span>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-2xl font-bold tracking-[0.15em] text-white/90">
                    {jamState.roomId}
                  </span>
                  <button 
                    onClick={() => {
                      if (jamState.roomId) {
                        navigator.clipboard.writeText(jamState.roomId);
                      }
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-white/20 transition-all hover:bg-white/10 hover:text-white"
                    title="Copy Code Only"
                  >
                    <Link size={13} />
                  </button>
                </div>
              </div>

              <button 
                onClick={handleCopy}
                className="group relative flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] py-3 text-xs font-bold uppercase tracking-wider text-white/70 hover:bg-white/[0.08] active:scale-[0.98] transition-all"
              >
                <div 
                  className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity"
                  style={{ background: 'linear-gradient(90deg, transparent, var(--art-accent, #FA243C), transparent)' }}
                />
                
                <AnimatePresence mode="wait">
                  {copied ? (
                    <motion.div
                      key="copied"
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="flex items-center gap-2 text-green-500"
                    >
                      <Check size={14} strokeWidth={3} />
                      <span className="text-xs font-bold uppercase tracking-wider">Link Copied</span>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="copy"
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="flex items-center gap-2 text-white/70 group-hover:text-white transition-colors"
                    >
                      <Share2 size={14} strokeWidth={2.5} />
                      <span className="text-xs font-bold uppercase tracking-wider">Copy Invite Link</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>
            </div>
          </div>
        </div>

        {/* Listeners List - Elegant Apple Grid */}
        <div className="space-y-3 px-0.5">
          <div className="flex items-center justify-between">
            <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">Listening Now</h4>
            <div className="h-px flex-1 bg-white/5 ml-4" />
          </div>
          
          <div className="grid grid-cols-1 gap-2">
            <AnimatePresence mode="popLayout">
              {jamState.listeners.map((listener, idx) => (
                <motion.div 
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  key={listener.id} 
                  className="group flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-2 hover:bg-white/[0.05] transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/5 shadow-md">
                      <Avatar src={listener.image} name={listener.name} />
                      {/* Subtly indicate host */}
                      {idx === 0 && (
                         <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border border-[#121212] bg-blue-500" title="Host" />
                      )}
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-white/80 group-hover:text-white transition-colors">{listener.name}</p>
                      <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-white/20 mt-0.5">
                        {idx === 0 ? 'Session Host' : 'Guest Listener'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 opacity-0 transition-opacity group-hover:opacity-100">
                    <MoreHorizontal size={12} className="text-white/40" />
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {showJoinInput ? (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4 px-1"
        >
          <div className="space-y-3">
             {!session && (
              <input
                type="text"
                placeholder="YOUR NICKNAME"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full bg-transparent border-b border-white/10 px-1 py-3 text-sm font-bold text-white placeholder:text-white/20 focus:border-white/30 focus:outline-none rounded-none transition-all tracking-wider"
              />
            )}
            <div className="flex gap-3 items-end">
              <input
                autoFocus
                type="text"
                placeholder="ENTER ROOM CODE"
                value={joinId}
                onChange={(e) => setJoinId(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && joinJam(joinId, userName)}
                className="flex-1 bg-transparent border-b border-white/10 px-1 py-3 text-sm font-bold text-white placeholder:text-white/20 focus:border-white/30 focus:outline-none rounded-none transition-all uppercase tracking-[0.15em]"
              />
              <button
                onClick={() => joinJam(joinId, userName)}
                disabled={!joinId || (!session && !userName)}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-black transition-all hover:bg-white/95 active:scale-[0.95] disabled:opacity-20 shadow-lg"
              >
                <Check size={16} strokeWidth={2.5} />
              </button>
            </div>
          </div>
          
          <button
            onClick={() => setShowJoinInput(false)}
            className="w-full py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/20 hover:text-white/40 transition-colors"
          >
            Cancel
          </button>
        </motion.div>
      ) : (
        <div className="flex flex-col gap-3">
          <button
            onClick={() => session ? createJam() : null}
            disabled={!session}
            className={`group relative flex w-full items-center justify-between overflow-hidden rounded-2xl border border-white/5 p-4 transition-all shadow-md ${
                session 
                  ? "bg-white text-black hover:bg-white/95 hover:scale-[1.01] active:scale-[0.99]" 
                  : "bg-white/[0.02] text-white/25 cursor-not-allowed"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-black/5 ${!session && 'bg-white/5 opacity-10'}`}>
                <Plus size={18} strokeWidth={2.5} />
              </div>
              <div className="text-left">
                <p className="text-[14px] font-bold tracking-tight">{session ? 'Start Session' : 'Login to Start'}</p>
                <p className={`text-[10px] font-semibold uppercase tracking-wider ${session ? 'opacity-40' : 'opacity-20'}`}>Shared Listening</p>
              </div>
            </div>
            {!session && <Padlock size={14} className="opacity-25 mr-1" />}
          </button>

          <button
            onClick={() => setShowJoinInput(true)}
            className="group flex w-full items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-4 transition-all hover:bg-white/[0.06] active:scale-[0.99]"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-white/40 group-hover:text-white/60 transition-colors">
              <Link size={16} />
            </div>
            <div className="text-left">
              <p className="text-[14px] font-bold text-white/80 group-hover:text-white transition-colors">Join a Session</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/20">Enter a room code</p>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

