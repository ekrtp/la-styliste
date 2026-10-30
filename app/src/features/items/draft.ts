import {
  ItemTagsSchema,
  SUBCATEGORIES,
  type Color,
  type Condition,
  type Detail,
  type ItemTags,
  type Material,
  type Pattern,
  type Scale,
  type Season,
  type Silhouette,
  type Slot,
  type Subcategory,
  type Texture,
} from '../../core/tags';

/** What the item form edits: the tags, with brand, price and notes as the text the person typed. */
export interface TagDraft {
  slot: Slot | null;
  subcategory: Subcategory | null;
  colors: Color[];
  material: Material | null;
  texture: Texture | null;
  pattern: Pattern | null;
  silhouette: Silhouette | null;
  formality: Scale | null;
  warmth: Scale | null;
  seasons: Season[];
  details: Detail[];
  condition: Condition | null;
  brand: string;
  price: string;
  notes: string;
}

/** An empty form. */
export const EMPTY_DRAFT: TagDraft = {
  slot: null,
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
  condition: null,
  brand: '',
  price: '',
  notes: '',
};

/** The form showing an item's tags. */
export function draftFromTags(t: Omit<ItemTags, 'slot'> & { slot: Slot | null }): TagDraft {
  return {
    slot: t.slot,
    subcategory: t.subcategory,
    colors: [...t.colors],
    material: t.material,
    texture: t.texture,
    pattern: t.pattern,
    silhouette: t.silhouette,
    // The schema keeps both within 1–5 integers.
    formality: t.formality as Scale | null,
    warmth: t.warmth as Scale | null,
    seasons: [...t.seasons],
    details: [...t.details],
    condition: t.condition,
    brand: t.brand ?? '',
    price: t.price === null ? '' : String(t.price).replace('.', ','),
    notes: t.notes ?? '',
  };
}

/** The draft with `slot` chosen; a subcategory of the old slot is cleared. */
export function withSlot(d: TagDraft, slot: Slot | null): TagDraft {
  const fits = slot !== null && d.subcategory !== null && (SUBCATEGORIES[slot] as readonly string[]).includes(d.subcategory);
  return { ...d, slot, subcategory: fits ? d.subcategory : null };
}

/** Blank → null; Turkish digits ("1.250,50") or plain ("1250") → the number; anything else → undefined. */
export function parsePrice(text: string): number | null | undefined {
  const t = text.replace(/\s/g, '');
  if (t === '') return null;
  // In Turkish "." groups thousands and "," marks decimals; the iPhone's Turkish decimal pad types ",".
  const normal = t.replace(/\./g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normal)) return undefined;
  return Number(normal);
}

export type DraftResult = { ok: true; tags: ItemTags } | { ok: false; message: string };

/** Checks the form. The message is Turkish and says what to fix. */
export function tagsFromDraft(d: TagDraft): DraftResult {
  if (d.slot === null) return { ok: false, message: 'Önce parçanın türünü seç.' };
  const price = parsePrice(d.price);
  if (price === undefined) return { ok: false, message: 'Fiyatı rakamla yaz, örneğin 1250 ya da 1.250,50.' };
  const brand = d.brand.trim();
  const notes = d.notes.trim();
  const parsed = ItemTagsSchema.safeParse({
    slot: d.slot,
    subcategory: d.subcategory,
    colors: d.colors,
    material: d.material,
    texture: d.texture,
    pattern: d.pattern,
    silhouette: d.silhouette,
    formality: d.formality,
    warmth: d.warmth,
    seasons: d.seasons,
    details: d.details,
    condition: d.condition,
    brand: brand === '' ? null : brand,
    price,
    notes: notes === '' ? null : notes,
  });
  return parsed.success
    ? { ok: true, tags: parsed.data }
    : { ok: false, message: 'Bazı alanlar geçersiz: en fazla 4 renk, marka en fazla 60, not en fazla 500 karakter.' };
}
