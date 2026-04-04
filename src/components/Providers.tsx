"use client";

import { SessionProvider } from "next-auth/react";
import { LazyMotion, domAnimation } from "motion/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus={false}>
      <LazyMotion features={domAnimation}>
        {children}
      </LazyMotion>
    </SessionProvider>
  );
}
