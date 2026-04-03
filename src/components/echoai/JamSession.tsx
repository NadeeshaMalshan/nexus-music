"use client";

import { useJam } from "@/context/JamContext";
import { Users, LogOut, Plus, Link, Check, Radio, Lock as Padlock, Share2, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "motion/react";

export function JamSession() {
  const { data: session } = useSession();
  const { jamState, createJam, joinJam, leaveJam } = useJam();
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [joinId, setJoinId] = useState("");
  const [userName, setUserName] = useState("");
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (jamState.roomId) {
      navigator.clipboard.writeText(jamState.roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (jamState.roomId) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full space-y-6"
      >
        {/* Main Control Card */}
        <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/3 p-6 shadow-2xl backdrop-blur-2xl transition-all hover:bg-white/5">
          {/* Subtle Ambient Background */}
          <div 
            className="absolute -right-8 -top-8 h-32 w-32 rounded-full blur-[60px] opacity-20"
            style={{ backgroundColor: 'var(--art-accent, #FA243C)' }}
          />

          <div className="relative z-10 space-y-6">
            {/* Header Section */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div 
                  className="flex h-12 w-12 items-center justify-center rounded-2xl shadow-inner border border-white/5"
                  style={{ backgroundColor: 'var(--art-accent, #FA243C)22' }}
                >
                  <Users className="text-white" size={24} style={{ color: 'var(--art-accent, #FA243C)' }} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-[17px] font-black text-white tracking-tight">Active Echo AI</h3>
                    <div className="flex items-center gap-1 overflow-hidden">
                       <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                      </span>
                      <span className="text-[10px] font-black text-green-500 uppercase tracking-tighter">LIVE</span>
                    </div>
                  </div>
                  <p className="text-[13px] font-medium text-white/40">
                    {jamState.participants} {jamState.participants === 1 ? 'Person' : 'People'} Listening
                  </p>
                </div>
              </div>
              
              <button
                onClick={leaveJam}
                className="group relative flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-white/40 border border-white/5 transition-all hover:bg-red-500 hover:text-white"
                title="End or Leave Echo AI"
              >
                <LogOut size={18} />
              </button>
            </div>

            {/* Room ID / Share Section */}
            <div className="space-y-2">
              <span className="px-1 text-[11px] font-black uppercase tracking-[0.2em] text-white/20">Session Link</span>
              <div className="flex items-center gap-2">
                <div 
                  onClick={handleCopy}
                  className="group flex flex-1 items-center justify-between rounded-2xl border border-white/5 bg-black/40 px-5 py-4 transition-all hover:bg-black/60 cursor-pointer overflow-hidden relative"
                >
                  <div className="flex items-center gap-3">
                    <Share2 size={14} className="text-white/30 group-hover:text-white/60 transition-colors" />
                    <span className="font-mono text-[16px] font-black tracking-[0.3em] text-white/90">
                      {jamState.roomId}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AnimatePresence mode="wait">
                      {copied ? (
                        <motion.div
                          key="check"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                        >
                          <Check size={16} className="text-green-500" />
                        </motion.div>
                      ) : (
                        <motion.div
                          key="link"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                        >
                          <Link size={16} className="text-white/20 group-hover:text-white/40" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Listeners List - Elegant Apple Grid */}
        <div className="space-y-4 px-1">
          <div className="flex items-center justify-between">
            <h4 className="text-[12px] font-black uppercase tracking-[0.22em] text-white/25">Listening Now</h4>
            <div className="h-px flex-1 bg-white/3 ml-4" />
          </div>
          
          <div className="grid grid-cols-1 gap-2.5">
            <AnimatePresence mode="popLayout">
              {jamState.listeners.map((listener, idx) => (
                <motion.div 
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  key={listener.id} 
                  className="group flex items-center justify-between rounded-2xl border border-white/5 bg-white/2 p-3 transition-all hover:bg-white/6"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/5 shadow-lg">
                      {listener.image ? (
                        <img src={listener.image} alt={listener.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-white/10 to-white/5 text-[14px] font-black text-white/40">
                          {listener.name.charAt(0)}
                        </div>
                      )}
                      {/* Subtly indicate host */}
                      {idx === 0 && (
                         <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#121212] bg-blue-500" title="Host" />
                      )}
                    </div>
                    <div>
                      <p className="text-[14px] font-bold text-white/80 group-hover:text-white transition-colors">{listener.name}</p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/20">
                        {idx === 0 ? 'Session Host' : 'Guest Listener'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 opacity-0 transition-opacity group-hover:opacity-100">
                    <MoreHorizontal size={14} className="text-white/40" />
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
          className="space-y-3"
        >
          <div className="space-y-2">
             {!session && (
              <input
                type="text"
                placeholder="YOUR NICKNAME"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/3 px-5 py-4 text-[15px] font-bold text-white placeholder:text-white/20 focus:border-white/20 focus:bg-white/6 focus:outline-none transition-all tracking-wide"
              />
            )}
            <div className="flex gap-2">
              <input
                autoFocus
                type="text"
                placeholder="ENTER CODE"
                value={joinId}
                onChange={(e) => setJoinId(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && joinJam(joinId, userName)}
                className="flex-1 rounded-2xl border border-white/10 bg-white/3 px-5 py-4 text-[15px] font-bold text-white placeholder:text-white/20 focus:border-white/20 focus:bg-white/6 focus:outline-none transition-all uppercase tracking-[0.4em]"
              />
              <button
                onClick={() => joinJam(joinId, userName)}
                disabled={!joinId || (!session && !userName)}
                className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-black transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:hover:scale-100 shadow-xl"
              >
                <Check size={24} strokeWidth={3} />
              </button>
            </div>
          </div>
          
          <button
            onClick={() => setShowJoinInput(false)}
            className="w-full py-3 text-[12px] font-black uppercase tracking-[0.2em] text-white/20 hover:text-white/40 transition-colors"
          >
            Cancel
          </button>
        </motion.div>
      ) : (
        <div className="flex flex-col gap-3">
          <button
            onClick={() => session ? createJam() : null}
            disabled={!session}
            className={`group relative flex w-full items-center justify-between overflow-hidden rounded-[24px] border border-white/10 p-5 transition-all shadow-xl ${
                session 
                  ? "bg-white text-black hover:scale-[1.01] active:scale-[0.99]" 
                  : "bg-white/5 text-white/10 cursor-not-allowed opacity-50"
            }`}
          >
            <div className="flex items-center gap-4">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-black/5 ${!session && 'bg-white/5 opacity-20'}`}>
                <Plus size={20} strokeWidth={3} />
              </div>
              <div className="text-left">
                <p className="text-[15px] font-black tracking-tight">{session ? 'Start Echo AI' : 'Login to Echo AI'}</p>
                <p className={`text-[11px] font-bold uppercase tracking-wider ${session ? 'opacity-40' : 'opacity-20'}`}>Shared Listening Session</p>
              </div>
            </div>
            {!session && <Padlock size={16} className="opacity-20 mr-2" />}
          </button>

          <button
            onClick={() => setShowJoinInput(true)}
            className="group flex w-full items-center gap-4 rounded-[24px] border border-white/5 bg-white/3 p-5 transition-all hover:bg-white/8"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-white/40 group-hover:text-white/60 transition-colors">
              <Link size={18} />
            </div>
            <div className="text-left">
              <p className="text-[15px] font-bold text-white/80 group-hover:text-white transition-colors">Join a Session</p>
              <p className="text-[11px] font-black uppercase tracking-wider text-white/20">Enter a room code</p>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

const X = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);
