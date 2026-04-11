import FontAwesome from '@expo/vector-icons/FontAwesome';
import {
  DarkTheme as NavigationDarkTheme,
  DefaultTheme as NavigationDefaultTheme,
  ThemeProvider,
  type Theme,
} from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';
import '../global.css';

import { useColorScheme } from '@/components/useColorScheme';
import { darkPalette, lightPalette } from '@/src/theme/palette';
import { AuthProvider } from '@/src/auth/AuthContext';
import { DashboardProvider } from '@/src/context/DashboardContext';
import { JamProvider } from '@/src/context/JamContext';
import { SettingsProvider } from '@/src/context/SettingsContext';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function buildNavigationTheme(scheme: 'light' | 'dark'): Theme {
  const p = scheme === 'dark' ? darkPalette : lightPalette;
  const base = scheme === 'dark' ? NavigationDarkTheme : NavigationDefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: p.tint,
      background: p.background,
      card: p.card,
      text: p.foreground,
      border: p.border,
      notification: p.destructive,
    },
  };
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const navTheme = buildNavigationTheme(colorScheme === 'dark' ? 'dark' : 'light');

  return (
    <AuthProvider>
      <SettingsProvider>
        <DashboardProvider>
          <JamProvider>
            <ThemeProvider value={navTheme}>
              <Stack>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
                <Stack.Screen name="nowplaying" options={{ headerShown: false }} />
                <Stack.Screen name="artist/[name]" options={{ headerShown: false }} />
                <Stack.Screen name="album/[id]" options={{ headerShown: false }} />
                <Stack.Screen name="playlists/[id]" options={{ headerShown: false }} />
              </Stack>
            </ThemeProvider>
          </JamProvider>
        </DashboardProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}
