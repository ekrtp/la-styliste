import { describe, expect, it } from 'vitest';
import { ItemTagsSchema, SUBCATEGORIES, type ItemTags } from './tags';

const FULL: ItemTags = {
  slot: 'outer',
  subcategory: 'leather_jacket',
  colors: ['black'],
  material: 'leather',
  texture: 'leather',
  pattern: 'solid',
  silhouette: 'fitted',
  formality: 3,
  warmth: 3,
  seasons: ['autumn', 'spring'],
  details: ['exposed_zip', 'buckle'],
  brand: null,
  condition: 'good',
  price: 4500,
  notes: null,
};

const MINIMAL: ItemTags = {
  slot: 'top',
  subcategory: null,
  colors: [],
  material: null,
  texture: null,
  pattern: null,
  silhouette: null,
  formality: null,
  warmth: null,
  seasons: [],
  details: [],
  brand: null,
  condition: null,
  price: null,
  notes: null,
};

describe('ItemTagsSchema', () => {
  it('accepts a full set of tags and a slot alone', () => {
    expect(ItemTagsSchema.safeParse(FULL).success).toBe(true);
    expect(ItemTagsSchema.safeParse(MINIMAL).success).toBe(true);
  });

  it('refuses a subcategory of another slot', () => {
    expect(ItemTagsSchema.safeParse({ ...FULL, subcategory: 'jeans' }).success).toBe(false);
  });

  it('refuses scales outside 1 to 5, fractions and unknown values', () => {
    expect(ItemTagsSchema.safeParse({ ...FULL, formality: 6 }).success).toBe(false);
    expect(ItemTagsSchema.safeParse({ ...FULL, warmth: 2.5 }).success).toBe(false);
    expect(ItemTagsSchema.safeParse({ ...FULL, colors: ['teal'] }).success).toBe(false);
    expect(ItemTagsSchema.safeParse({ ...FULL, price: -1 }).success).toBe(false);
  });

  it('lists each subcategory under one slot only', () => {
    const all = Object.values(SUBCATEGORIES).flat();
    expect(new Set(all).size).toBe(all.length);
  });
});
