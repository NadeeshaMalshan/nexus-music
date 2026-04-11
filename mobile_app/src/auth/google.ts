import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

export type GoogleAuthConfig = {
  clientId: string;
  scopes?: string[];
};

const DEFAULT_SCOPES = [
  'openid',
  'profile',
  'email',
  // YouTube Data API scopes used by the backend
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube',
];

export async function signInWithGoogle(config: GoogleAuthConfig): Promise<string> {
  const clientId = config.clientId?.trim();
  if (!clientId) {
    throw new Error(
      'Missing Google OAuth client ID. Add EXPO_PUBLIC_GOOGLE_CLIENT_ID to mobile_app/.env (see mobile_app/.env.example), then restart Expo with --clear.'
    );
  }

  const discovery = await AuthSession.fetchDiscoveryAsync('https://accounts.google.com');

  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'mobileapp',
    path: 'auth',
  });

  const request = new AuthSession.AuthRequest({
    clientId,
    scopes: config.scopes ?? DEFAULT_SCOPES,
    redirectUri,
    responseType: AuthSession.ResponseType.Token,
    usePKCE: false,
  });

  const result = await request.promptAsync(discovery, { useProxy: true });

  if (result.type !== 'success') {
    throw new Error(result.type === 'error' ? result.params?.error ?? 'Google sign-in failed' : 'Sign-in cancelled');
  }

  const accessToken = (result.params as Record<string, string | undefined>).access_token;
  if (!accessToken) throw new Error('Google sign-in did not return an access token');

  return accessToken;
}

