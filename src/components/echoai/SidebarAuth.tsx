"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { LogIn, LogOut } from "lucide-react";
import { MusicArtwork } from "./MusicArtwork";
import Link from "next/link";

export function SidebarAuth() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="mt-auto pt-4">
        <button disabled className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-white/5 bg-white/[0.03] animate-pulse">
          <div className="h-5 w-5 bg-white/20 rounded-full" />
          <div className="h-4 w-24 bg-white/20 rounded" />
        </button>
      </div>
    );
  }

  if (session?.user) {
    return (
      <div className="mt-auto pt-6 border-t border-white/5 group">
        <div className="flex items-center gap-3 p-1 transition-all rounded-xl hover:bg-white/5">
          <Link
            href="/stats"
            className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer group/link"
          >
            <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-white/10 group-hover/link:border-white/30 transition-colors">
              <MusicArtwork
                src={session.user.image}
                alt={session.user.name || "User Avatar"}
                iconSize={20}
                variant="artist"
                rounded="full"
                className="h-full w-full"
              />
            </div>
            <div className="flex-1 overflow-hidden min-w-0">
              <p className="text-sm font-medium text-white truncate group-hover/link:text-[var(--art-accent,#FA233B)] transition-colors">
                {session.user.name || "User"}
              </p>
              {(session as any).error === "RefreshAccessTokenError" && (
                <p className="text-[10px] font-bold text-red-400 uppercase tracking-tight">Sync Problem</p>
              )}
            </div>
          </Link>
          <button
            onClick={() => {
              // Detailed reset: Clear everything including music state
              localStorage.removeItem("nexus_current_song");
              localStorage.removeItem("nexus_queue");
              localStorage.removeItem("nexus_history");
              signOut();
            }}
            className={`p-2 rounded-lg transition-colors shrink-0 ${(session as any).error === "RefreshAccessTokenError" ? "text-red-400 bg-red-400/10 hover:bg-red-400/20" : "text-white/50 hover:text-white hover:bg-white/[0.08]"}`}
            title={(session as any).error === "RefreshAccessTokenError" ? "Re-sync account (Auth Expired)" : "Sign out"}
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-auto pt-4">
      <button
        onClick={() => signIn("google")}
        className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 border border-white/5 bg-white/[0.03] hover:bg-blue-500/10 hover:border-blue-500/30 hover:shadow-[0_0_15px_rgba(59,130,246,0.15)] text-white/80 hover:text-blue-400 group"
      >
        <LogIn size={20} className="group-hover:text-blue-400 transition-colors" />
        <span className="text-sm font-medium">Sign in with Google</span>
      </button>
    </div>
  );
}
