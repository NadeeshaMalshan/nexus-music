import React, { createContext, useContext, useMemo, useState } from 'react';

type JamContextValue = {
  isInJam: boolean;
  setIsInJam: (v: boolean) => void;
};

const JamContext = createContext<JamContextValue | undefined>(undefined);

export function JamProvider({ children }: { children: React.ReactNode }) {
  const [isInJam, setIsInJam] = useState(false);

  const value = useMemo<JamContextValue>(() => ({ isInJam, setIsInJam }), [isInJam]);
  return <JamContext.Provider value={value}>{children}</JamContext.Provider>;
}

export function useJam() {
  const ctx = useContext(JamContext);
  if (!ctx) throw new Error('useJam must be used within JamProvider');
  return ctx;
}

