import { dark } from './dark';
import { light } from './light';
import type { Theme } from './types';

/** Every theme, for the tests that check them all. */
export const ALL_THEMES: readonly Theme[] = [dark, light];

/** The theme of an appearance: always the same object, so the style sheets `makeStyles` caches per theme are reused. */
export function getTheme(appearance: Theme['appearance']): Theme {
  return appearance === 'light' ? light : dark;
}
