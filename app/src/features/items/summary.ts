import type { Scale } from '../../core/tags';
import type { Item } from '../../data/items';
import {
  COLOR_TR, CONDITION_TR, DETAIL_TR, FORMALITY_TR, MATERIAL_TR, PATTERN_TR, SEASON_TR, SILHOUETTE_TR, SLOT_TR,
  SUBCATEGORY_TR, TEXTURE_TR, WARMTH_TR,
} from '../../ui/labels';

/** "Dış giyim · Deri ceket": the item's name in headers and screen-reader labels. */
export function itemTitle(item: Pick<Item, 'slot' | 'subcategory'>): string {
  if (item.slot === null) return 'Taslak';
  return item.subcategory === null ? SLOT_TR[item.slot] : `${SLOT_TR[item.slot]} · ${SUBCATEGORY_TR[item.subcategory]}`;
}

/** The filled tags as label and value lines for the item screen; empty tags are left out. */
export function tagRows(item: Item): { label: string; value: string }[] {
  const join = (values: readonly string[]) => (values.length === 0 ? null : values.join(', '));
  const rows: [string, string | null][] = [
    ['Renk', join(item.colors.map((c) => COLOR_TR[c]))],
    ['Malzeme', item.material === null ? null : MATERIAL_TR[item.material]],
    ['Doku', item.texture === null ? null : TEXTURE_TR[item.texture]],
    ['Desen', item.pattern === null ? null : PATTERN_TR[item.pattern]],
    ['Kesim', item.silhouette === null ? null : SILHOUETTE_TR[item.silhouette]],
    ['Resmiyet', item.formality === null ? null : FORMALITY_TR[item.formality as Scale]],
    ['Sıcaklık', item.warmth === null ? null : WARMTH_TR[item.warmth as Scale]],
    ['Mevsim', join(item.seasons.map((s) => SEASON_TR[s])) ?? 'Her mevsim'],
    ['Detaylar', join(item.details.map((d) => DETAIL_TR[d]))],
    ['Kondisyon', item.condition === null ? null : CONDITION_TR[item.condition]],
    ['Marka', item.brand],
    ['Fiyat', item.price === null ? null : `${item.price.toLocaleString('tr-TR')} TL`],
    ['Not', item.notes],
  ];
  return rows.flatMap(([label, value]) => (value === null ? [] : [{ label, value }]));
}
