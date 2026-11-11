"use client";

import { RotateCw, Home } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="dark h-full bg-[#050505]">
      <body className="h-full bg-[#050505] text-white flex items-center justify-center p-6 font-sans">
        <div className="max-w-md text-center space-y-6">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 border border-white/10 shadow-2xl">
            <RotateCw className="h-7 w-7 text-white/70" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Playback Service Recovery
            </h1>
            <p className="text-sm text-white/50 leading-relaxed">
              We encountered an unexpected error. Reloading will restore your session.
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => reset()}
              className="flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90 active:scale-95"
            >
              <RotateCw size={16} />
              <span>Reload App</span>
            </button>
            <button
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.location.href = "/";
                }
              }}
              className="flex items-center gap-2 rounded-full bg-white/10 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15 border border-white/10 active:scale-95"
            >
              <Home size={16} />
              <span>Go Home</span>
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}

