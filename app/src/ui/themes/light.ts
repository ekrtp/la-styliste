import { SHAPE, TYPE_SCALE } from './base';
import type { Theme } from './types';

/** The light look: warm off-white, the same oxblood accent a step darker so white text keeps its contrast. */
export const light: Theme = {
  id: 'light',
  appearance: 'light',
  colors: {
    bg: '#F5F4F2',
    surface: '#FFFFFF',
    surfaceRaised: '#FFFFFF',
    outline: '#DDDBD7',
    text: '#141414',
    textDim: '#55555C',
    textFaint: '#85858B',
    accent: '#8E2A33',
    onAccent: '#FFFFFF',
    dangerText: '#B42318',
  },
  typeScale: TYPE_SCALE,
  shape: SHAPE,
};
