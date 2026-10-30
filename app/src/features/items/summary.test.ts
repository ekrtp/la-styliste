import { describe, expect, it } from 'vitest';
import type { Item } from '../../data/items';
import { itemTitle, tagRows } from './summary';

const item: Item = {
  id: 'item0001',
  status: 'active',
  slot: 'outer',
  subcategory: 'leather_jacket',
  colors: ['black', 'silver'],
  material: 'leather',
  texture: null,
  pattern: null,
  silhouette: null,
  formality: 3,
  warmth: null,
  seasons: [],
  details: [],
  notes: null,
  brand: null,
  condition: null,
  price: 1250.5,
  primaryPhotoId: null,
  createdAt: 'x',
  updatedAt: 'x',
};

describe('summary', () => {
  it('names an item by slot and subcategory', () => {
    expect(itemTitle(item)).toBe('Dış giyim · Deri ceket');
    expect(itemTitle({ slot: 'top', subcategory: null })).toBe('Üst');
  });

  it('lists the filled tags only, with all seasons spelled out', () => {
    expect(tagRows(item)).toEqual([
      { label: 'Renk', value: 'Siyah, Gümüş' },
      { label: 'Malzeme', value: 'Deri' },
      { label: 'Resmiyet', value: 'Smart casual' },
      { label: 'Mevsim', value: 'Her mevsim' },
      { label: 'Fiyat', value: '1.250,5 TL' },
    ]);
  });
});
