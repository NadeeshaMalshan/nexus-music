import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { NativeModules, Platform } from 'react-native';

import { getApiBaseUrlFromConfig } from '@/src/config/env';

function normalizeBaseUrl(input: string): string {
  return input.replace(/\/+$/, '');
}

/** Host part of Metro / dev URIs like `192.168.1.5:8081` or `http://192.168.1.5:8081/...`. */
function parseHostFromDevUri(uri: string | undefined | null): string | undefined {
  if (!uri || typeof uri !== 'string') return undefined;
  const noProto = uri.replace(/^https?:\/\//i, '').trim();
  const host = noProto.split(':')[0]?.split('/')[0];
  if (!host || host === 'localhost' || host === '127.0.0.1') return undefined;
  return host;
}

/**
 * When the app is loaded from Metro on your LAN, the JS bundle URL contains your PC’s IP.
 * Reuse that host for Next.js on :3000 so physical devices work without hand-editing .env.
 */
export function inferDevPcLanHost(): string | undefined {
  try {
    const sc = (NativeModules as { SourceCode?: { scriptURL?: string } }).SourceCode;
    const fromScript = parseHostFromDevUri(sc?.scriptURL);
    if (fromScript) return fromScript;
  } catch {
    // ignore
  }

  const raw = Constants as {
    manifest?: { debuggerHost?: string };
    expoConfig?: { hostUri?: string };
  };
  const fromManifest = parseHostFromDevUri(raw.manifest?.debuggerHost);
  if (fromManifest) return fromManifest;
  const fromExpoConfig = parseHostFromDevUri(raw.expoConfig?.hostUri);
  if (fromExpoConfig) return fromExpoConfig;

  try {
    const dl = (NativeModules as { EXDevLauncher?: { manifestString?: string } }).EXDevLauncher;
    if (dl?.manifestString) {
      const m = JSON.parse(dl.manifestString) as { debuggerHost?: string };
      return parseHostFromDevUri(m.debuggerHost);
    }
  } catch {
    // ignore
  }

  return undefined;
}

/** Android emulator: map localhost → 10.0.2.2. Physical device: map localhost → inferred LAN IP when possible. */
function mapAndroidLoopbackForDevice(base: string): string {
  if (Platform.OS !== 'android') return base;
  try {
    const u = new URL(base);
    if (u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') return base;

    if (!Device.isDevice) {
      u.hostname = '10.0.2.2';
      return normalizeBaseUrl(u.toString());
    }

    const lan = inferDevPcLanHost();
    if (lan) {
      u.hostname = lan;
      return normalizeBaseUrl(u.toString());
    }

    return base;
  } catch {
    return base;
  }
}

/**
 * Base URL for the Next.js backend (`/api/*`).
 *
 * **Vercel / production:** set `EXPO_PUBLIC_API_BASE_URL=https://your-app.vercel.app` (no trailing slash),
 * or rely on HTTPS `NEXTAUTH_URL` in `.env` (see `app.config.js` `resolveApiBaseUrl`).
 *
 * **Local dev — physical Android:** Metro bundle host on port **3000**, or `EXPO_PUBLIC_API_BASE_URL`.
 *
 * **Android emulator:** defaults to `http://10.0.2.2:3000` when no production URL is configured.
 */
export function getApiBaseUrl(): string {
  const fromConfig = getApiBaseUrlFromConfig();
  if (fromConfig) {
    return mapAndroidLoopbackForDevice(normalizeBaseUrl(fromConfig));
  }

  if (Platform.OS === 'android') {
    if (!Device.isDevice) {
      return 'http://10.0.2.2:3000';
    }

    const host = inferDevPcLanHost();
    if (host) {
      return `http://${host}:3000`;
    }

    if (__DEV__) {
      console.warn(
        '[API] Set EXPO_PUBLIC_API_BASE_URL=http://YOUR_PC_LAN_IP:3000 in .env (same Wi‑Fi as your phone), then rebuild. Next.js must listen on 0.0.0.0:3000 or your LAN IP.'
      );
    }

    return 'http://10.0.2.2:3000';
  }

  return 'http://localhost:3000';
}
