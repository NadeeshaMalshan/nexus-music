"use client";

import { useEffect } from "react";
import { RotateCw, Home } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Nexus ErrorBoundary]:", error);
  }, [error]);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center bg-[#07080a] text-white">
      <div className="max-w-md space-y-6">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 border border-white/10 shadow-2xl">
          <RotateCw className="h-7 w-7 text-white/70" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-white">
            Something went wrong
          </h2>
          <p className="text-sm text-white/50 leading-relaxed">
            Nexus encountered a temporary loading error. You can try refreshing or return home.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => reset()}
            className="flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-black transition hover:bg-white/90 active:scale-95"
          >
            <RotateCw size={16} />
            <span>Try Again</span>
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
    </div>
  );
}

