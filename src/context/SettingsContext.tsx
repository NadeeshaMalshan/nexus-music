"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { UserSettings, DEFAULT_SETTINGS } from "@/types/settings";
import { useSession } from "next-auth/react";
import { MotionConfig } from "motion/react";
import { readResponseJson } from "@/lib/readResponseJson";

interface SettingsContextType {
  settings: UserSettings;
  updateSetting: <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => void;
  isLoading: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Initial Load: Try LocalStorage first (instant), then API (better)
  useEffect(() => {
    const local = localStorage.getItem("nexus_settings");
    if (local) {
      try {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(local) });
      } catch (e) {
        console.error("Local storage settings parse error", e);
      }
    }

    const fetchSettings = async () => {
      try {
        const res = await fetch("/api/settings");
        if (res.ok) {
          const apiSettings = await readResponseJson<UserSettings>(res);
          if (apiSettings) {
            setSettings(apiSettings);
            localStorage.setItem("nexus_settings", JSON.stringify(apiSettings));
          }
        }
      } catch (e) {
        console.error("Fetch settings error", e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, []);

  // 2. Persist to API when settings change (debounced)
  const [updateTimer, setUpdateTimer] = useState<NodeJS.Timeout | null>(null);

  const updateSetting = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    
    // Save to local storage immediately
    localStorage.setItem("nexus_settings", JSON.stringify(newSettings));

    // Debounce API update
    if (updateTimer) clearTimeout(updateTimer);
    
    if (session) {
      const timer = setTimeout(async () => {
        try {
          await fetch("/api/settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newSettings),
          });
        } catch (e) {
          console.error("Save settings error", e);
        }
      }, 1000); // 1s debounce
      setUpdateTimer(timer);
    }
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSetting, isLoading }}>
      <MotionConfig reducedMotion={settings.reduceAnimations ? "always" : "user"}>
        {children}
      </MotionConfig>
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
