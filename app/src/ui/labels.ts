import type { ThemeMode } from '../data/settings';

/** Tab titles, by route name. */
export const TAB_TR = {
  index: 'Gardırop',
  outfits: 'Kombinler',
  today: 'Bugün',
  settings: 'Ayarlar',
} as const;

/** The theme modes in the order the Ayarlar picker shows them. */
export const THEME_MODES: readonly ThemeMode[] = ['dark', 'light', 'system'];

/** The name of each theme mode in the Ayarlar picker. */
export const THEME_MODE_TR: Record<ThemeMode, string> = {
  dark: 'Koyu',
  light: 'Açık',
  system: 'Sistem',
};
