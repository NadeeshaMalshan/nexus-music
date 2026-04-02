"use client";

import { useJam } from "@/context/JamContext";
import { Users, LogOut, Plus, Link, Check, Radio } from "lucide-react";
import { useState } from "react";

export function JamSession() {
  const { jamState, createJam, joinJam, leaveJam } = useJam();
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [joinId, setJoinId] = useState("");
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
      <div className="mb-8 rounded-3xl bg-white/5 border border-white/10 p-5 overflow-hidden relative">
        <div className="absolute top-0 right-0 p-4 opacity-10">
            <Radio size={48} className="animate-pulse" />
        </div>
        <div className="flex items-center justify-between mb-4 relative z-10">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-white/10 flex items-center justify-center text-white">
              <Users size={20} />
            </div>
            <div>
              <h3 className="text-[15px] font-black text-white">Nexus Jam</h3>
              <p className="text-[12px] font-bold text-white/40">
                {jamState.participants} listening together
              </p>
            </div>
          </div>
          <button
            onClick={leaveJam}
            className="p-2 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all"
            title="End Session"
          >
            <LogOut size={16} />
          </button>
        </div>

        <div className="flex items-center gap-2 relative z-10">
          <div 
            onClick={handleCopy}
            className="flex-1 flex items-center justify-between bg-black/40 border border-white/5 rounded-xl px-4 py-3 cursor-pointer hover:bg-black/60 transition-all"
          >
            <span className="text-[14px] font-mono font-bold tracking-widest text-white/80">{jamState.roomId}</span>
            {copied ? <Check size={14} className="text-green-500" /> : <Link size={14} className="text-white/20" />}
          </div>
          <div className="px-3 py-1 rounded-lg bg-green-500/20 text-green-500 text-[10px] font-black uppercase tracking-tighter self-center animate-pulse">
            LIVE
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8 space-y-3">
      {showJoinInput ? (
        <div className="flex gap-2">
          <input
            autoFocus
            type="text"
            placeholder="ENTER ROOM ID"
            value={joinId}
            onChange={(e) => setJoinId(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && joinJam(joinId)}
            className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-[14px] font-bold focus:outline-none focus:border-white/20 uppercase tracking-widest"
          />
          <button
            onClick={() => joinJam(joinId)}
            disabled={!joinId}
            className="px-6 rounded-2xl bg-white text-black font-black text-[13px] disabled:opacity-50"
          >
            JOIN
          </button>
          <button
            onClick={() => setShowJoinInput(false)}
            className="p-3 rounded-2xl bg-white/5 text-white/40 hover:text-white transition-all"
          >
            <X size={18} />
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={createJam}
            className="flex-1 flex items-center justify-center gap-2 bg-white text-black py-3 rounded-2xl font-black text-[13px] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg"
          >
            <Plus size={16} strokeWidth={3} />
            START JAM
          </button>
          <button
            onClick={() => setShowJoinInput(true)}
            className="px-5 flex items-center justify-center bg-white/5 border border-white/5 text-white/60 py-3 rounded-2xl font-bold text-[13px] hover:bg-white/10 transition-all"
          >
            JOIN
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
