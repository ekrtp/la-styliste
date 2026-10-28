import { DarkTheme, DefaultTheme, type Theme as NavigationTheme } from 'expo-router';
import type { Theme } from './themes/types';

/**
 * The navigation theme of `theme`. Without it expo-router uses the light react-navigation theme, whose
 * grey background shows behind every screen and flashes white on a dark app.
 */
export function makeNavigationTheme({ appearance, colors }: Theme): NavigationTheme {
  const base = appearance === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.accent,
      background: colors.bg,
      card: colors.surface,
      text: colors.text,
      border: colors.outline,
    },
  };
}
