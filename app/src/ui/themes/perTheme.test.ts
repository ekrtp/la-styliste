import { describe, expect, it, vi } from 'vitest';
import { dark } from './dark';
import { light } from './light';
import { perTheme } from './perTheme';

describe('perTheme', () => {
  it('runs the factory once per theme object and returns the same result after that', () => {
    const factory = vi.fn((t: typeof dark) => ({ id: t.id }));
    const get = perTheme(factory);
    const first = get(dark);
    expect(get(dark)).toBe(first);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(get(light)).toEqual({ id: 'light' });
    expect(factory).toHaveBeenCalledTimes(2);
  });
});
