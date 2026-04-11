import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Alert, Platform } from 'react-native';

import { setAuthTokenProvider } from '@/src/api/http';
import { signInWithGoogle, type GoogleAuthConfig } from '@/src/auth/google';
import { getGoogleClientId } from '@/src/config/env';

type AuthState = {
  googleAccessToken: string | null;
  isLoading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

const ACCESS_TOKEN_KEY = 'nexus_google_access_token';

async function readStoredAccessToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return AsyncStorage.getItem(ACCESS_TOKEN_KEY);
  }
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

async function writeStoredAccessToken(token: string) {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(ACCESS_TOKEN_KEY, token);
  } else {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
  }
}

async function clearStoredAccessToken() {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(ACCESS_TOKEN_KEY);
  } else {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  }
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setAuthTokenProvider(() => googleAccessToken);
    return () => setAuthTokenProvider(null);
  }, [googleAccessToken]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const stored = await readStoredAccessToken();
        if (!mounted) return;
        setGoogleAccessToken(stored || null);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const signOut = useCallback(async () => {
    setGoogleAccessToken(null);
    await clearStoredAccessToken();
  }, []);

  const signIn = useCallback(async () => {
    const clientId = getGoogleClientId();
    const config: GoogleAuthConfig = { clientId };

    try {
      const token = await signInWithGoogle(config);
      setGoogleAccessToken(token);
      await writeStoredAccessToken(token);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Sign-in failed';
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(message);
      } else {
        Alert.alert('Sign in', message);
      }
    }
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      googleAccessToken,
      isLoading,
      signIn,
      signOut,
    }),
    [googleAccessToken, isLoading, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

