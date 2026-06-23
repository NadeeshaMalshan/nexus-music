"use client";

import { useJam } from "@/context/JamContext";
import { LogOut, Link, Check, Share2, QrCode, ArrowRight } from "lucide-react";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "motion/react";
import { MusicArtwork } from "./MusicArtwork";

const Avatar = ({ src, name }: { src: string | null; name: string }) => (
  <MusicArtwork src={src} alt={name} iconSize={22} variant="artist" rounded="full" className="h-full w-full grayscale contrast-125" />
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
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="w-full h-full flex flex-col pt-12 pb-8"
      >
        <div className="flex-1 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-16 px-4">
                <div className="flex flex-col">
                    <div className="flex items-center gap-3">
                        <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
                        <h3 className="text-xs font-medium uppercase tracking-[0.3em] text-white/50">
                            Live Sync
                        </h3>
                    </div>
                    <p className="text-white/30 text-xs font-medium mt-1">
                        Hosted by {jamState.listeners[0]?.name?.split(' ')[0] || "Anonymous"}
                    </p>
                </div>
                
                <button
                    onClick={leaveJam}
                    className="h-10 w-10 flex items-center justify-center rounded-full border border-white/20 text-white/50 hover:bg-white hover:text-black transition-colors"
                >
                    <LogOut size={14} />
                </button>
            </div>

            {/* Listeners List */}
            <div className="flex flex-col gap-4 px-4 mb-16">
                <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-white/30">
                    {jamState.participants} Connected
                </p>
                <div className="flex flex-col gap-6">
                    {jamState.listeners.map((listener, idx) => (
                        <motion.div 
                            key={listener.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className="flex items-center gap-4"
                        >
                            <div className={`h-12 w-12 shrink-0 rounded-full overflow-hidden border border-white/20 bg-[#121212]`}>
                                <Avatar src={listener.image} name={listener.name} />
                            </div>
                            <div className="flex flex-col">
                                <p className="text-base font-bold text-white tracking-tight leading-none">{listener.name}</p>
                                <p className="text-[10px] font-medium uppercase tracking-widest text-white/40 mt-1">
                                    {idx === 0 ? 'Session Host' : 'Guest'}
                                </p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Room Code - Brutalist Typography */}
            <div className="mt-auto flex flex-col gap-6 px-4 border-t border-white/10 pt-8">
                <p className="text-xs font-medium uppercase tracking-widest text-white/40">Access Code</p>
                <div className="flex items-end justify-between">
                    <h1 className="text-5xl sm:text-6xl font-black tracking-tighter text-white leading-none">
                        {jamState.roomId}
                    </h1>
                </div>

                <div className="flex items-center gap-4 mt-4">
                    <button 
                        onClick={handleCopy}
                        className="flex items-center gap-3 px-6 py-3 rounded-full bg-white text-black font-bold uppercase tracking-widest text-[10px] hover:bg-white/80 transition-colors"
                    >
                        {copied ? "Copied" : "Copy Link"}
                    </button>
                    <button 
                        onClick={() => setShowQR(!showQR)}
                        className={`h-11 w-11 flex items-center justify-center rounded-full border transition-colors ${showQR ? 'bg-white text-black border-white' : 'border-white/20 text-white/50 hover:bg-white hover:text-black'}`}
                    >
                        <QrCode size={16} />
                    </button>
                </div>

                <AnimatePresence>
                    {showQR && joinUrl && (
                        <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="mt-8 p-4 bg-white inline-block">
                                <img 
                                    src={`https://quickchart.io/qr?text=${encodeURIComponent(joinUrl)}&dark=000000&light=ffffff&margin=0&size=200`} 
                                    alt="QR Code" 
                                    className="w-48 h-48"
                                />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="w-full flex flex-col px-2 py-6">
      <AnimatePresence mode="wait">
      {showJoinInput ? (
        <motion.div 
          key="join"
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          className="flex flex-col gap-8 w-full max-w-full overflow-hidden"
        >
            <div>
                <h2 className="text-3xl font-black tracking-tighter text-white truncate">Join Session</h2>
                <p className="text-white/40 text-sm mt-1 font-medium truncate">Sync playback with a friend.</p>
            </div>

          <div className="flex flex-col gap-6 w-full">
             {!session && (
                 <div className="w-full">
                    <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/30 mb-2">Nickname</p>
                    <input
                        type="text"
                        placeholder="John Doe"
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                        className="w-full bg-transparent border-b border-white/20 pb-3 text-xl font-medium text-white placeholder:text-white/10 focus:border-white focus:outline-none transition-colors"
                    />
                </div>
            )}
            <div className="w-full">
                <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/30 mb-2">Access Code</p>
                <div className="flex gap-3 items-end w-full">
                    <input
                        autoFocus
                        type="text"
                        placeholder="XXXXXX"
                        value={joinId}
                        onChange={(e) => setJoinId(e.target.value.toUpperCase())}
                        onKeyDown={(e) => e.key === "Enter" && joinJam(joinId, userName)}
                        className="flex-1 w-0 bg-transparent border-b border-white/20 pb-3 text-2xl font-black text-white placeholder:text-white/10 focus:border-white focus:outline-none transition-colors uppercase tracking-widest"
                    />
                    <button
                        onClick={() => joinJam(joinId, userName)}
                        disabled={!joinId || (!session && !userName)}
                        className="h-12 w-12 shrink-0 flex items-center justify-center rounded-full bg-white text-black disabled:opacity-20 disabled:bg-white/10 disabled:text-white/30 transition-colors"
                    >
                        <ArrowRight size={20} />
                    </button>
                </div>
            </div>
          </div>
          
          <button
            onClick={() => setShowJoinInput(false)}
            className="text-[10px] font-medium uppercase tracking-[0.3em] text-white/40 hover:text-white transition-colors self-start mt-8"
          >
            Go Back
          </button>
        </motion.div>
      ) : (
        <motion.div 
            key="start"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex flex-col gap-6"
        >
            <div>
                <h2 className="text-[38px] font-black tracking-tighter text-white leading-tight">Shared<br/>Listening.</h2>
                <p className="text-white/40 text-sm mt-3 font-medium max-w-[220px]">Sync perfectly in real-time across any device.</p>
            </div>

            <div className="flex flex-col gap-4 mt-4">
                <button
                    onClick={() => session ? createJam() : null}
                    disabled={!session}
                    className="flex items-center justify-between px-8 py-5 rounded-full bg-white text-black disabled:bg-white/5 disabled:text-white/20 transition-colors"
                >
                    <span className="text-lg font-black tracking-tighter">{session ? 'Host a Session' : 'Login to Host'}</span>
                    <ArrowRight size={20} />
                </button>

                <button
                    onClick={() => setShowJoinInput(true)}
                    className="flex items-center justify-between px-8 py-5 rounded-full border border-white/20 text-white hover:bg-white hover:text-black transition-colors group"
                >
                    <span className="text-lg font-black tracking-tighter">Join a Session</span>
                    <ArrowRight size={20} className="text-white/20 group-hover:text-black transition-colors" />
                </button>
            </div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}
