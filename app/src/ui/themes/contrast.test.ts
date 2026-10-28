import { describe, expect, it } from 'vitest';
import { ALL_THEMES } from './registry';

/** WCAG 2.x relative luminance of a `#RRGGBB` colour. */
function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** WCAG contrast ratio between two `#RRGGBB` colours. */
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe.each(ALL_THEMES.map((t) => [t.id, t] as const))('theme %s', (_id, { colors }) => {
  it('uses #RRGGBB everywhere', () => {
    for (const value of Object.values(colors)) expect(value).toMatch(/^#[0-9A-F]{6}$/i);
  });

  it('keeps body and secondary text at 4.5:1 on every surface', () => {
    for (const surface of [colors.bg, colors.surface, colors.surfaceRaised]) {
      expect(contrast(colors.text, surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(colors.textDim, surface)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps faint text at 3:1 on the background, and accent and error text readable', () => {
    expect(contrast(colors.textFaint, colors.bg)).toBeGreaterThanOrEqual(3);
    expect(contrast(colors.onAccent, colors.accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.dangerText, colors.bg)).toBeGreaterThanOrEqual(4.5);
  });
});
