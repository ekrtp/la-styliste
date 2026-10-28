import type { Theme } from './types';

/** Runs `factory` once per theme object and returns the same result on every later call with it. */
export function perTheme<T>(factory: (theme: Theme) => T): (theme: Theme) => T {
  const results = new WeakMap<Theme, { value: T }>();
  return (theme) => {
    let hit = results.get(theme);
    if (!hit) {
      hit = { value: factory(theme) };
      results.set(theme, hit);
    }
    return hit.value;
  };
}
