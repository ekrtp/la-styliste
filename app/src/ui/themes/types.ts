/** Colours of one theme, all `#RRGGBB` so `contrast.test.ts` can measure them. */
export interface ThemeColors {
  bg: string;
  surface: string;
  surfaceRaised: string;
  /** Borders of cards, chips and the tab bar. */
  outline: string;
  text: string;
  /** Secondary text: 4.5:1 on every surface. */
  textDim: string;
  /** Decoration and large text only: 3:1 on `bg`. */
  textFaint: string;
  /** Fill of a primary action and of a selected option. */
  accent: string;
  /** Text on `accent`: 4.5:1. */
  onAccent: string;
  /** An error line on `bg`: 4.5:1. */
  dangerText: string;
}

export interface TextSize {
  fontSize: number;
  lineHeight: number;
  letterSpacing?: number;
}

/**
 * One look of the app. Components never import a theme's values: they read it with `useTheme()` or build
 * styles with `makeStyles()`. The system font is used throughout; no custom fonts in M0.
 */
export interface Theme {
  id: string;
  appearance: 'dark' | 'light';
  colors: ThemeColors;
  typeScale: { title: TextSize; body: TextSize; caption: TextSize; label: TextSize };
  shape: {
    radius: { card: number; button: number; chip: number };
    space: { xs: number; s: number; m: number; l: number; xl: number };
  };
}
