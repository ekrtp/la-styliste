import { describe, expect, it } from 'vitest';
import { DEFAULT_FILTER, matchesFilter, type FilterableItem } from './wardrobeFilter';

const knit: FilterableItem = { status: 'active', slot: 'top', formality: 2, seasons: [], texture: 'knit' };

describe('matchesFilter', () => {
  it('shows the clothes in use by default, never drafts', () => {
    expect(matchesFilter(knit, DEFAULT_FILTER)).toBe(true);
    expect(matchesFilter({ ...knit, status: 'laundry' }, DEFAULT_FILTER)).toBe(true);
    for (const status of ['archived', 'wishlist', 'draft'] as const) {
      expect(matchesFilter({ ...knit, status }, DEFAULT_FILTER)).toBe(false);
    }
    expect(matchesFilter({ ...knit, status: 'draft' }, { ...DEFAULT_FILTER, statuses: [] })).toBe(false);
  });

  it('takes an empty list as "any"', () => {
    expect(matchesFilter({ ...knit, status: 'archived' }, { ...DEFAULT_FILTER, statuses: [] })).toBe(true);
  });

  it('matches slot, formality and texture, and drops items without the tag', () => {
    expect(matchesFilter(knit, { ...DEFAULT_FILTER, slots: ['top', 'mid'] })).toBe(true);
    expect(matchesFilter(knit, { ...DEFAULT_FILTER, slots: ['shoes'] })).toBe(false);
    expect(matchesFilter(knit, { ...DEFAULT_FILTER, formality: [2] })).toBe(true);
    expect(matchesFilter({ ...knit, formality: null }, { ...DEFAULT_FILTER, formality: [2] })).toBe(false);
    expect(matchesFilter({ ...knit, texture: null }, { ...DEFAULT_FILTER, textures: ['knit'] })).toBe(false);
  });

  it('counts an item without seasons as an all-season item', () => {
    expect(matchesFilter(knit, { ...DEFAULT_FILTER, seasons: ['winter'] })).toBe(true);
    expect(matchesFilter({ ...knit, seasons: ['summer'] }, { ...DEFAULT_FILTER, seasons: ['winter'] })).toBe(false);
    expect(matchesFilter({ ...knit, seasons: ['autumn', 'winter'] }, { ...DEFAULT_FILTER, seasons: ['winter'] })).toBe(true);
  });
});
