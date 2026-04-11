/* eslint-disable @typescript-eslint/no-require-imports */
const appJson = require('./app.json');

/**
 * Production / Vercel: the same Next.js deployment serves `/api/*`. Prefer
 * `EXPO_PUBLIC_API_BASE_URL=https://your-app.vercel.app`, or HTTPS `NEXTAUTH_URL`
 * from the repo `.env` as a fallback so mobile can call Vercel without duplicating the URL.
 */
function resolveApiBaseUrl() {
  const explicit = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (explicit) return explicit;

  const nextAuth = process.env.NEXTAUTH_URL?.trim();
  if (nextAuth && /^https:\/\//i.test(nextAuth)) {
    return nextAuth.replace(/\/+$/, '');
  }

  return undefined;
}

/**
 * Loads `.env` / `EXPO_PUBLIC_*` into `extra` so values are available via
 * `expo-constants` when Metro inlines differ from expectations.
 */
module.exports = {
  expo: {
    ...appJson.expo,
    android: {
      ...appJson.expo.android,
      // Allow http:// to dev machine (10.0.2.2 / LAN IP); required for API calls off HTTPS.
      usesCleartextTraffic: true,
    },
    extra: {
      ...(appJson.expo.extra || {}),
      EXPO_PUBLIC_API_BASE_URL: resolveApiBaseUrl(),
      EXPO_PUBLIC_GOOGLE_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
    },
  },
};
