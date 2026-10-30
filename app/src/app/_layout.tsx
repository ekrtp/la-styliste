import { Stack, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { Recovery } from '../features/recovery/Recovery';
import { AppDataProvider, useAppData } from '../state/AppData';
import { makeNavigationTheme } from '../ui/navigationTheme';
import { ThemeProvider, useTheme } from '../ui/themes';

// The native splash stays up until the database is open or has failed, so a cold start shows no empty frame.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  return (
    <AppDataProvider>
      <Themed />
    </AppDataProvider>
  );
}

function Themed() {
  const { settings } = useAppData();
  return (
    <ThemeProvider mode={settings.themeMode}>
      <Shell />
    </ThemeProvider>
  );
}

/** The navigators once the database is ready; the recovery screen when it failed; the splash until then. */
function Shell() {
  const theme = useTheme();
  const { ready, error, retry } = useAppData();
  const navigationTheme = useMemo(() => makeNavigationTheme(theme), [theme]);
  // The status bar's `style` names the icon colour: light icons on a dark theme.
  const statusBar = <StatusBar style={theme.appearance === 'dark' ? 'light' : 'dark'} />;

  useEffect(() => {
    if (ready || error !== null) SplashScreen.hideAsync().catch(() => {});
  }, [ready, error]);

  if (error !== null) {
    return (
      <>
        {statusBar}
        <Recovery error={error} onRetry={retry} />
      </>
    );
  }
  if (!ready) return null;

  return (
    <NavigationThemeProvider value={navigationTheme}>
      {statusBar}
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="add" options={{ presentation: 'modal' }} />
      </Stack>
    </NavigationThemeProvider>
  );
}
