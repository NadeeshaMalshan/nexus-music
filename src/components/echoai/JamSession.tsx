"use client";

import { useJam } from "@/context/JamContext";
import { Users, LogOut, Plus, Link, Check, Lock as Padlock, Share2, MoreHorizontal, QrCode } from "lucide-react";
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
  const [joinUrl, setJoinUrl] = useState("");
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      setMounted(true);
    }, 0);
  }, []);

  useEffect(() => {
    if (jamState.roomId) {
      setJoinUrl(`${window.location.origin}${window.location.pathname}?jam=${jamState.roomId}`);
    }
  }, [jamState.roomId]);

  const handleCopy = () => {
    if (jamState.roomId && joinUrl) {
      navigator.clipboard.writeText(joinUrl);
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
        initial={{ opacity: 0, y: 10, filter: "blur(10px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        className="w-full space-y-6"
      >
        {/* Main Control Card - Awwwards Style */}
        <div className="relative overflow-hidden rounded-[32px] bg-black/40 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] border border-white/10 p-1">
          {/* Animated Gradient Border Inner Container */}
          <div className="relative rounded-[28px] overflow-hidden bg-gradient-to-b from-white/[0.05] to-transparent p-6 sm:p-8">
              
            {/* Dynamic Ambient Background Glow */}
            <motion.div 
              animate={{ 
                  scale: [1, 1.2, 1],
                  opacity: [0.1, 0.2, 0.1],
                  rotate: [0, 90, 0]
              }}
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
              className="absolute -right-20 -top-20 h-64 w-64 rounded-full blur-[80px]"
              style={{ backgroundColor: 'var(--art-accent, #FA243C)' }}
            />
            <div className="absolute inset-0 bg-noise opacity-20 mix-blend-overlay pointer-events-none" />

            <div className="relative z-10 flex flex-col gap-8">
              {/* Header Section */}
              <div className="flex items-start justify-between">
                <div className="flex gap-4 items-center">
                  <div 
                    className="flex h-12 w-12 items-center justify-center rounded-[16px] border border-white/20 shadow-[0_0_20px_rgba(250,36,60,0.3)] backdrop-blur-md"
                    style={{ backgroundColor: 'var(--art-accent, #FA243C)20' }}
                  >
                    <Users className="text-white" size={22} style={{ color: 'var(--art-accent, #FA243C)' }} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-[18px] font-black text-white tracking-tighter leading-none">
                        {jamState.listeners[0]?.name?.split(' ')[0] || "Anonymous"}&apos;s Jam
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex items-center gap-1.5 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
                            <span className="relative flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
                            </span>
                            <span className="text-[9px] font-black text-green-500 uppercase tracking-[0.2em]">Live</span>
                        </div>
                        <span className="text-white/30 text-[11px] font-bold">
                            {jamState.participants} {jamState.participants === 1 ? 'Listener' : 'Listeners'}
                        </span>
                    </div>
                  </div>
                </div>
                
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={leaveJam}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-white/40 border border-white/10 hover:bg-red-500/20 hover:text-red-500 hover:border-red-500/30 transition-colors shadow-lg backdrop-blur-md"
                  title="End or Leave Echo AI"
                >
                  <LogOut size={16} />
                </motion.button>
              </div>

              {/* Room ID / Share Section */}
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">Session Code</span>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-4xl sm:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-white/90 to-white/50 drop-shadow-[0_2px_10px_rgba(255,255,255,0.2)]">
                      {jamState.roomId}
                    </span>
                    <motion.button 
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setShowQR(!showQR)}
                      className={`flex h-12 w-12 items-center justify-center rounded-full transition-all backdrop-blur-md border ${showQR ? 'bg-white text-black border-white' : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/20 hover:text-white'}`}
                      title="Show QR Code"
                    >
                      <QrCode size={20} />
                    </motion.button>
                  </div>
                </div>

                <AnimatePresence>
                    {showQR && joinUrl && (
                        <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="flex justify-center py-6 border-y border-white/5 my-2">
                                <div className="p-3 bg-white rounded-2xl shadow-[0_0_40px_rgba(255,255,255,0.1)]">
                                    <img 
                                        src={`https://quickchart.io/qr?text=${encodeURIComponent(joinUrl)}&dark=000000&light=ffffff&margin=1&size=160`} 
                                        alt="Join QR Code" 
                                        className="w-32 h-32 sm:w-40 sm:h-40 rounded-xl"
                                    />
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleCopy}
                  className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-white/10 py-4 font-black uppercase tracking-[0.2em] text-white transition-all hover:bg-white/20 shadow-[0_4px_20px_rgba(0,0,0,0.3)] border border-white/10"
                >
                  <div 
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)' }}
                  />
                  
                  <AnimatePresence mode="wait">
                    {copied ? (
                      <motion.div
                        key="copied"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="flex items-center gap-2 text-green-400"
                      >
                        <Check size={18} strokeWidth={3} />
                        <span className="text-sm">Link Copied</span>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="copy"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="flex items-center gap-2 text-white"
                      >
                        <Share2 size={18} strokeWidth={2.5} />
                        <span className="text-sm">Copy Invite Link</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>
              </div>
            </div>
          </div>
        </div>

        {/* Listeners List - Floating Awwwards Style */}
        <div className="space-y-4 px-2">
          <div className="flex items-center gap-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">Listening Now</h4>
            <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
          </div>
          
          <div className="flex flex-col gap-3">
            <AnimatePresence mode="popLayout">
              {jamState.listeners.map((listener, idx) => (
                <motion.div 
                  layout
                  initial={{ opacity: 0, x: -20, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  transition={{ delay: idx * 0.05, type: "spring", stiffness: 300, damping: 25 }}
                  key={listener.id} 
                  className="group relative flex items-center justify-between rounded-full bg-white/[0.03] pr-4 pl-1.5 py-1.5 hover:bg-white/[0.08] transition-colors border border-white/5 backdrop-blur-md"
                >
                  <div className="flex items-center gap-4">
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-white/10 bg-black/50 shadow-lg">
                      <Avatar src={listener.image} name={listener.name} />
                      {/* Premium Host Indicator */}
                      {idx === 0 && (
                         <div className="absolute inset-0 rounded-full border-2 border-blue-500/50 shadow-[0_0_10px_rgba(59,130,246,0.5)]" title="Host" />
                      )}
                    </div>
                    <div className="flex flex-col justify-center">
                      <p className="text-[14px] font-black tracking-tight text-white/90 group-hover:text-white transition-colors">{listener.name}</p>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 mt-0.5">
                        {idx === 0 ? 'Session Host' : 'Guest'}
                      </p>
                    </div>
                  </div>
                  
                  <motion.div 
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 opacity-0 transition-opacity group-hover:opacity-100 cursor-pointer"
                  >
                    <MoreHorizontal size={14} className="text-white/60" />
                  </motion.div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {showJoinInput ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          className="space-y-6 px-1"
        >
          <div className="space-y-4">
             {!session && (
              <input
                type="text"
                placeholder="YOUR NICKNAME"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full bg-transparent border-b-2 border-white/10 px-2 py-4 text-lg font-black text-white placeholder:text-white/20 focus:border-white focus:outline-none rounded-none transition-all tracking-wider"
              />
            )}
            <div className="flex gap-4 items-end">
              <input
                autoFocus
                type="text"
                placeholder="ROOM CODE"
                value={joinId}
                onChange={(e) => setJoinId(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && joinJam(joinId, userName)}
                className="flex-1 bg-transparent border-b-2 border-white/10 px-2 py-4 text-2xl font-black text-white placeholder:text-white/20 focus:border-white focus:outline-none rounded-none transition-all uppercase tracking-[0.2em]"
              />
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => joinJam(joinId, userName)}
                disabled={!joinId || (!session && !userName)}
                className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-black transition-all disabled:opacity-20 shadow-[0_0_30px_rgba(255,255,255,0.3)]"
              >
                <Check size={24} strokeWidth={3} />
              </motion.button>
            </div>
          </div>
          
          <button
            onClick={() => setShowJoinInput(false)}
            className="w-full py-4 text-[11px] font-black uppercase tracking-[0.3em] text-white/30 hover:text-white/60 transition-colors"
          >
            Cancel Join
          </button>
        </motion.div>
      ) : (
        <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-4"
        >
          <motion.button
            whileHover={session ? { scale: 1.02 } : {}}
            whileTap={session ? { scale: 0.98 } : {}}
            onClick={() => session ? createJam() : null}
            disabled={!session}
            className={`group relative flex w-full items-center justify-between overflow-hidden rounded-[24px] p-5 transition-all shadow-xl backdrop-blur-md ${
                session 
                  ? "bg-gradient-to-br from-white to-white/80 text-black border border-white/20" 
                  : "bg-white/5 text-white/30 border border-white/5 cursor-not-allowed"
            }`}
          >
            <div className="flex items-center gap-4">
              <div className={`flex h-12 w-12 items-center justify-center rounded-full bg-black/10 ${!session && 'bg-white/5'}`}>
                <Plus size={20} strokeWidth={3} />
              </div>
              <div className="text-left">
                <p className="text-[18px] font-black tracking-tight leading-none">{session ? 'Start Session' : 'Login to Start'}</p>
                <p className={`text-[10px] font-bold uppercase tracking-[0.2em] mt-1.5 ${session ? 'opacity-50' : 'opacity-30'}`}>Shared Listening</p>
              </div>
            </div>
            {!session && <Padlock size={16} className="opacity-30 mr-2" />}
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowJoinInput(true)}
            className="group flex w-full items-center gap-4 rounded-[24px] border border-white/10 bg-white/5 p-5 transition-all hover:bg-white/10 backdrop-blur-md shadow-lg"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white/60 group-hover:text-white transition-colors">
              <Link size={20} strokeWidth={2.5} />
            </div>
            <div className="text-left">
              <p className="text-[18px] font-black tracking-tight text-white/90 group-hover:text-white transition-colors leading-none">Join Session</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mt-1.5">Enter Room Code</p>
            </div>
          </motion.button>
        </motion.div>
      )}
    </div>
  );
}
