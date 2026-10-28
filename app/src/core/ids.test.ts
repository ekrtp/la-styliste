import { describe, expect, it } from 'vitest';
import { ID_PATTERN, newId } from './ids';

describe('newId', () => {
  it('makes ids the photo-folder check accepts, sorted by time', () => {
    const a = newId(1_700_000_000_000, () => 0.5);
    const b = newId(1_700_000_000_001, () => 0.5);
    expect(a).toMatch(ID_PATTERN);
    expect(a < b).toBe(true);
  });

  it('differs between two calls in the same millisecond', () => {
    expect(newId(1_700_000_000_000)).not.toBe(newId(1_700_000_000_000));
  });
});
