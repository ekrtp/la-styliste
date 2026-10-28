import type { Theme } from './types';

/** Text sizes shared by both themes: iOS body is 17 pt, so body sits there and the rest steps around it. */
export const TYPE_SCALE: Theme['typeScale'] = {
  title: { fontSize: 28, lineHeight: 34 },
  body: { fontSize: 17, lineHeight: 24 },
  caption: { fontSize: 13, lineHeight: 18 },
  label: { fontSize: 12, lineHeight: 16, letterSpacing: 1.2 },
};

/** Corners and spacing shared by both themes: a 4 pt grid, with the 16 pt side gutter iOS uses. */
export const SHAPE: Theme['shape'] = {
  radius: { card: 16, button: 12, chip: 999 },
  space: { xs: 4, s: 8, m: 16, l: 24, xl: 32 },
};
