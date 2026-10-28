import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import type { ThemeMode } from '../../data/settings';
import { colorSchemeFor, resolveAppearance } from './appearance';
import { dark } from './dark';
import { perTheme } from './perTheme';
import { getTheme } from './registry';
import type { Theme } from './types';

export type { Theme } from './types';

const ThemeContext = createContext<Theme>(dark);

/** Draws `children` in the theme `mode` asks for; `system` follows the phone and changes live when it switches. */
export function ThemeProvider({ mode, children }: { mode: ThemeMode; children: ReactNode }) {
  const system = useColorScheme();
  const theme = getTheme(resolveAppearance(mode, system));
  useEffect(() => {
    Appearance.setColorScheme(colorSchemeFor(mode));
  }, [mode]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

/** The active theme. Every colour, size and spacing value a component draws with comes from here. */
export function useTheme(): Theme {
  return useContext(ThemeContext);
}

/**
 * `const useStyles = makeStyles((t) => StyleSheet.create({ ... }))`, then `const styles = useStyles()`.
 * The factory runs once per theme, however many components use it.
 */
export function makeStyles<T>(factory: (theme: Theme) => T): () => T {
  const stylesFor = perTheme(factory);
  return function useStyles() {
    return stylesFor(useTheme());
  };
}
