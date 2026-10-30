import type { ChosenStatus, Scale, Season, Slot, Status, Texture } from './tags';

/** The grid's filters. An empty list means "any". */
export interface WardrobeFilter {
  slots: Slot[];
  statuses: ChosenStatus[];
  formality: Scale[];
  seasons: Season[];
  textures: Texture[];
}

/** What the grid starts with: the clothes in use (active and in the laundry). */
export const DEFAULT_FILTER: WardrobeFilter = { slots: [], statuses: ['active', 'laundry'], formality: [], seasons: [], textures: [] };

/** The fields the filter reads. */
export interface FilterableItem {
  status: Status;
  slot: Slot | null;
  formality: number | null;
  seasons: readonly Season[];
  texture: Texture | null;
}

/** Whether `item` passes `f`. Drafts never do. An item without seasons counts as all-season (spec §8 season rule). */
export function matchesFilter(item: FilterableItem, f: WardrobeFilter): boolean {
  if (item.status === 'draft') return false;
  if (f.statuses.length > 0 && !f.statuses.includes(item.status)) return false;
  if (f.slots.length > 0 && (item.slot === null || !f.slots.includes(item.slot))) return false;
  if (f.formality.length > 0 && (item.formality === null || !(f.formality as readonly number[]).includes(item.formality))) return false;
  if (f.seasons.length > 0 && item.seasons.length > 0 && !item.seasons.some((s) => f.seasons.includes(s))) return false;
  if (f.textures.length > 0 && (item.texture === null || !f.textures.includes(item.texture))) return false;
  return true;
}
