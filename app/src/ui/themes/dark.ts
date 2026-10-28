import { SHAPE, TYPE_SCALE } from './base';
import type { Theme } from './types';

/** The default look (spec §11): near-black surfaces for a mostly black wardrobe, an oxblood accent. */
export const dark: Theme = {
  id: 'dark',
  appearance: 'dark',
  colors: {
    bg: '#0E0E10',
    surface: '#17171A',
    surfaceRaised: '#1F1F23',
    outline: '#2E2E34',
    text: '#F2F2F2',
    textDim: '#A6A6AE',
    textFaint: '#6B6B73',
    accent: '#A3333D',
    onAccent: '#FFFFFF',
    dangerText: '#FF7A7A',
  },
  typeScale: TYPE_SCALE,
  shape: SHAPE,
};
