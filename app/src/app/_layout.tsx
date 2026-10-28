import { Stack, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { View } from 'react-native';
import { Recovery } from '../features/recovery/Recovery';
import { AppDataProvider, useAppData } from '../state/AppData';
import { makeNavigationTheme } from '../ui/navigationTheme';
import { ThemeProvider, useTheme } from '../ui/themes';

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

/** The navigators, once the database is ready; the recovery screen when it failed; a plain background while it opens. */
function Shell() {
  const theme = useTheme();
  const { ready, error, retry } = useAppData();
  const navigationTheme = useMemo(() => makeNavigationTheme(theme), [theme]);
  // The status bar's `style` names the icon colour: light icons on a dark theme.
  const statusBar = <StatusBar style={theme.appearance === 'dark' ? 'light' : 'dark'} />;

  if (error !== null) {
    return (
      <>
        {statusBar}
        <Recovery error={error} onRetry={retry} />
      </>
    );
  }
  if (!ready) return <View style={{ flex: 1, backgroundColor: theme.colors.bg }} />;

  return (
    <NavigationThemeProvider value={navigationTheme}>
      {statusBar}
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.bg } }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </NavigationThemeProvider>
  );
}
