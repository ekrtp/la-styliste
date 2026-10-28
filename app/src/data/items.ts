import { newId } from '../core/ids';
import type { NewPhoto } from '../core/photo';
import { ItemTagsSchema, type ChosenStatus, type ItemTags, type Slot, type Status } from '../core/tags';
import type { Db, DbCalls, SqlParam } from './db';

/** An item as the screens read it. Columns the M2 tagging fills (`resale`, `ai_fields`, ...) are not read yet. */
export interface Item extends Omit<ItemTags, 'slot'> {
  id: string;
  status: Status;
  /** Null only while the item is a draft (M2). */
  slot: Slot | null;
  primaryPhotoId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A photo row (spec §5). */
export interface Photo extends NewPhoto {
  itemId: string | null;
  createdAt: string;
}

/** The tag columns, in the order `tagParams` returns their values. */
const TAG_COLUMNS = [
  'slot', 'subcategory', 'colors', 'material', 'texture', 'pattern', 'silhouette', 'formality',
  'warmth', 'seasons', 'details', 'notes', 'brand', 'condition', 'price',
] as const;

/** Every column `toItem` reads. */
const ITEM_SELECT = `SELECT id, status, ${TAG_COLUMNS.join(', ')}, primary_photo_id, created_at, updated_at FROM items`;

interface ItemRow {
  id: string;
  status: Status;
  slot: Slot | null;
  subcategory: ItemTags['subcategory'];
  colors: string;
  material: ItemTags['material'];
  texture: ItemTags['texture'];
  pattern: ItemTags['pattern'];
  silhouette: ItemTags['silhouette'];
  formality: number | null;
  warmth: number | null;
  seasons: string;
  details: string;
  notes: string | null;
  brand: string | null;
  condition: ItemTags['condition'];
  price: number | null;
  primary_photo_id: string | null;
  created_at: string;
  updated_at: string;
}

interface PhotoRow {
  id: string;
  item_id: string | null;
  kind: Photo['kind'];
  original_ext: Photo['originalExt'];
  cutout_state: Photo['cutoutState'];
  face_state: Photo['faceState'];
  created_at: string;
}

function tagParams(t: ItemTags): SqlParam[] {
  return [
    t.slot, t.subcategory, JSON.stringify(t.colors), t.material, t.texture, t.pattern, t.silhouette, t.formality,
    t.warmth, JSON.stringify(t.seasons), JSON.stringify(t.details), t.notes, t.brand, t.condition, t.price,
  ];
}

// Rows come from this app's own writes, checked by the schema's CHECK constraints, so the casts in the row types hold.
function toItem(r: ItemRow): Item {
  return {
    id: r.id,
    status: r.status,
    slot: r.slot,
    subcategory: r.subcategory,
    colors: JSON.parse(r.colors),
    material: r.material,
    texture: r.texture,
    pattern: r.pattern,
    silhouette: r.silhouette,
    formality: r.formality,
    warmth: r.warmth,
    seasons: JSON.parse(r.seasons),
    details: JSON.parse(r.details),
    notes: r.notes,
    brand: r.brand,
    condition: r.condition,
    price: r.price,
    primaryPhotoId: r.primary_photo_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Adds an active item with its primary photo, both rows in one transaction (spec §6: files first, then rows). Returns the item id. */
export async function createItemWithPhoto(db: Db, tags: ItemTags, photo: NewPhoto, now: Date = new Date()): Promise<string> {
  const valid = ItemTagsSchema.parse(tags);
  const id = newId(now.getTime());
  const at = now.toISOString();
  await db.transaction(async (tx) => {
    await tx.run(
      `INSERT INTO items (id, status, ${TAG_COLUMNS.join(', ')}, primary_photo_id, tag_source, created_at, updated_at)
       VALUES (?, 'active', ${TAG_COLUMNS.map(() => '?').join(', ')}, ?, 'manual', ?, ?)`,
      [id, ...tagParams(valid), photo.id, at, at],
    );
    await insertPhoto(tx, photo, id, at);
  });
  return id;
}

async function insertPhoto(tx: DbCalls, photo: NewPhoto, itemId: string, at: string): Promise<void> {
  await tx.run(
    'INSERT INTO photos (id, item_id, kind, original_ext, cutout_state, face_state, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [photo.id, itemId, photo.kind, photo.originalExt, photo.cutoutState, photo.faceState, at],
  );
}

/** Replaces an item's tags. Throws when there is no such item. */
export async function updateItem(db: Db, id: string, tags: ItemTags, now: Date = new Date()): Promise<void> {
  const valid = ItemTagsSchema.parse(tags);
  const { changes } = await db.run(`UPDATE items SET ${TAG_COLUMNS.map((c) => `${c} = ?`).join(', ')}, updated_at = ? WHERE id = ?`, [
    ...tagParams(valid),
    now.toISOString(),
    id,
  ]);
  if (changes === 0) throw new Error(`No item ${id}`);
}

/** Sets a status a person chooses. Throws when there is no such item, or it is still a draft. */
export async function setItemStatus(db: Db, id: string, status: ChosenStatus, now: Date = new Date()): Promise<void> {
  const { changes } = await db.run("UPDATE items SET status = ?, updated_at = ? WHERE id = ? AND status != 'draft'", [status, now.toISOString(), id]);
  if (changes === 0) throw new Error(`No item ${id}`);
}

export async function getItem(db: Db, id: string): Promise<Item | null> {
  const row = await db.first<ItemRow>(`${ITEM_SELECT} WHERE id = ?`, [id]);
  return row === null ? null : toItem(row);
}

/** Every item that is not a draft, newest first. The grid filters in memory: a wardrobe is a few hundred rows. */
export async function listItems(db: Db): Promise<Item[]> {
  const rows = await db.all<ItemRow>(`${ITEM_SELECT} WHERE status != 'draft' ORDER BY created_at DESC, id DESC`);
  return rows.map(toItem);
}

export async function getPhoto(db: Db, id: string): Promise<Photo | null> {
  const r = await db.first<PhotoRow>('SELECT id, item_id, kind, original_ext, cutout_state, face_state, created_at FROM photos WHERE id = ?', [id]);
  if (r === null) return null;
  return {
    id: r.id,
    itemId: r.item_id,
    kind: r.kind,
    originalExt: r.original_ext,
    cutoutState: r.cutout_state,
    faceState: r.face_state,
    createdAt: r.created_at,
  };
}

/** The id of every photo row; the launch sweep keeps exactly these folders. */
export async function allPhotoIds(db: Db): Promise<Set<string>> {
  const rows = await db.all<{ id: string }>('SELECT id FROM photos');
  return new Set(rows.map((r) => r.id));
}
