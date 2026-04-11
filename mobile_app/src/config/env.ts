import Constants from 'expo-constants';

function fromExtra(key: string): string | undefined {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const v = extra?.[key];
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

export function getGoogleClientId(): string {
  const env = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
  if (typeof env === 'string' && env.trim()) return env.trim();
  return fromExtra('EXPO_PUBLIC_GOOGLE_CLIENT_ID') ?? fromExtra('googleClientId') ?? '';
}

export function getApiBaseUrlFromConfig(): string | undefined {
  const env = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (typeof env === 'string' && env.trim()) return env.trim().replace(/\/+$/, '');
  const extra = fromExtra('EXPO_PUBLIC_API_BASE_URL');
  return extra ? extra.replace(/\/+$/, '') : undefined;
}
