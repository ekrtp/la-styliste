import { describe, expect, it } from 'vitest';
import type { ItemTags } from '../../core/tags';
import { draftFromTags, EMPTY_DRAFT, parsePrice, tagsFromDraft, withSlot } from './draft';

const TAGS: ItemTags = {
  slot: 'outer',
  subcategory: 'leather_jacket',
  colors: ['black'],
  material: 'leather',
  texture: 'leather',
  pattern: 'solid',
  silhouette: 'fitted',
  formality: 3,
  warmth: 3,
  seasons: ['autumn'],
  details: ['buckle'],
  brand: "Levi's",
  condition: 'good',
  price: 1250.5,
  notes: 'Omuzlar biraz geniş',
};

describe('parsePrice', () => {
  it.each([
    ['', null],
    ['   ', null],
    ['1250', 1250],
    ['1.250', 1250],
    ['1.250,50', 1250.5],
    ['12,5', 12.5],
    ['abc', undefined],
    ['-5', undefined],
    ['1,234,5', undefined],
  ] as const)('reads %j as %j', (text, expected) => {
    expect(parsePrice(text)).toBe(expected);
  });
});

describe('tagsFromDraft', () => {
  it('asks for the slot first', () => {
    expect(tagsFromDraft(EMPTY_DRAFT)).toEqual({ ok: false, message: 'Önce parçanın türünü seç.' });
  });

  it('says how to write a price it cannot read', () => {
    const result = tagsFromDraft({ ...EMPTY_DRAFT, slot: 'top', price: '12 TL' });
    expect(result.ok).toBe(false);
  });

  it('turns a slot alone into tags with empty fields, and blank text into null', () => {
    expect(tagsFromDraft({ ...EMPTY_DRAFT, slot: 'top', brand: '   ', notes: '' })).toEqual({
      ok: true,
      tags: { ...EMPTY_DRAFT, slot: 'top', brand: null, price: null, notes: null },
    });
  });

  it('gives back the same tags it was filled from', () => {
    expect(tagsFromDraft(draftFromTags(TAGS))).toEqual({ ok: true, tags: TAGS });
  });
});

describe('withSlot', () => {
  it('keeps a subcategory that fits the new slot and clears one that does not', () => {
    const jacket = draftFromTags(TAGS);
    expect(withSlot(jacket, 'outer').subcategory).toBe('leather_jacket');
    expect(withSlot(jacket, 'shoes')).toMatchObject({ slot: 'shoes', subcategory: null });
    expect(withSlot(jacket, null)).toMatchObject({ slot: null, subcategory: null });
  });
});
