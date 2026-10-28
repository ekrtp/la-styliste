import { describe, expect, it } from 'vitest';
import { colorSchemeFor, resolveAppearance } from './appearance';

describe('resolveAppearance', () => {
  it('lets an explicit mode win over the phone', () => {
    expect(resolveAppearance('light', 'dark')).toBe('light');
    expect(resolveAppearance('dark', 'light')).toBe('dark');
  });

  it('follows the phone in system mode, and means dark when the phone has no preference', () => {
    expect(resolveAppearance('system', 'light')).toBe('light');
    expect(resolveAppearance('system', 'dark')).toBe('dark');
    expect(resolveAppearance('system', 'unspecified')).toBe('dark');
    expect(resolveAppearance('system', null)).toBe('dark');
  });
});

describe('colorSchemeFor', () => {
  it('pins light and dark, and lifts the pin in system mode', () => {
    expect(colorSchemeFor('light')).toBe('light');
    expect(colorSchemeFor('dark')).toBe('dark');
    expect(colorSchemeFor('system')).toBe('unspecified');
  });
});
