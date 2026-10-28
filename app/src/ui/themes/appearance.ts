import type { ThemeMode } from '../../data/settings';
import type { Theme } from './types';

/** What `useColorScheme()` reports: the phone's scheme, or `unspecified` or nothing when it has none. */
export type SystemScheme = 'light' | 'dark' | 'unspecified' | null | undefined;

/** Light or dark: an explicit mode wins, `system` follows the phone, and a phone with no preference means dark. */
export function resolveAppearance(mode: ThemeMode, system: SystemScheme): Theme['appearance'] {
  if (mode === 'light' || mode === 'dark') return mode;
  return system === 'light' ? 'light' : 'dark';
}

/**
 * What to hand `Appearance.setColorScheme`, which pins native alerts, sheets and pickers too. In `system`
 * mode the pin is lifted (`unspecified`), or the app would keep echoing the last explicit choice.
 */
export function colorSchemeFor(mode: ThemeMode): 'light' | 'dark' | 'unspecified' {
  return mode === 'system' ? 'unspecified' : mode;
}
