import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { apiSettingsGet, apiSettingsSave } from '@/src/api/endpoints';
import { useAuth } from '@/src/auth/AuthContext';
import { DEFAULT_SETTINGS, type UserSettings } from '@/src/types/settings';

/** Same key as web `localStorage` for parity. */
const STORAGE_KEY = 'nexus_settings';

type SettingsContextValue = {
  settings: UserSettings;
  updateSetting: <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => void;
  /** True while auth/session is restoring. Settings API sync does not block this. */
  isLoading: boolean;
};

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

function mergeFromApi(raw: unknown): UserSettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SETTINGS };
  return { ...DEFAULT_SETTINGS, ...(raw as Partial<UserSettings>) };
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { googleAccessToken, isLoading: authLoading } = useAuth();
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1) Hydrate from AsyncStorage immediately
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw || !mounted) return;
        setSettings(mergeFromApi(JSON.parse(raw)));
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // 2) Sync from API in the background once auth is ready. Do not block UI on this — a hung
  //    or slow Next.js host would otherwise leave `isLoading` true forever (AsyncStorage above
  //    already provides defaults / cached values).
  useEffect(() => {
    if (authLoading) return;

    let cancelled = false;
    (async () => {
      try {
        const apiSettings = await apiSettingsGet();
        if (cancelled) return;
        const merged = mergeFromApi(apiSettings);
        setSettings(merged);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      } catch (e) {
        const aborted =
          (e instanceof Error && e.name === 'AbortError') ||
          (typeof e === 'object' &&
            e !== null &&
            'name' in e &&
            (e as { name: string }).name === 'AbortError');
        if (aborted) {
          console.warn(
            '[Settings] GET /api/settings timed out or was unreachable — ensure Next.js is running (port 3000). On a real device set EXPO_PUBLIC_API_BASE_URL to your PC LAN IP.'
          );
        } else {
          console.warn('[Settings] GET /api/settings failed', e);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, googleAccessToken]);

  const updateSetting = useCallback(
    <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: value };
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});

        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

        if (googleAccessToken) {
          saveTimerRef.current = setTimeout(() => {
            apiSettingsSave(next).catch((e) => console.warn('[Settings] POST /api/settings failed', e));
          }, 1000);
        }

        return next;
      });
    },
    [googleAccessToken]
  );

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!googleAccessToken && saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  }, [googleAccessToken]);

  const value = useMemo<SettingsContextValue>(
    () => ({ settings, updateSetting, isLoading: authLoading }),
    [settings, updateSetting, authLoading]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
