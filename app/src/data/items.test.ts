import { beforeEach, describe, expect, it } from 'vitest';
import type { NewPhoto } from '../core/photo';
import type { ItemTags } from '../core/tags';
import type { Db } from './db';
import { allPhotoIds, createItemWithPhoto, getItem, getPhoto, listItems, setItemStatus, updateItem } from './items';
import { migrate } from './migrations';
import { openMemoryDb } from './testing/nodeDb';

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
  seasons: ['autumn', 'spring'],
  details: ['exposed_zip', 'buckle'],
  brand: null,
  condition: 'good',
  price: 4500,
  notes: null,
};
const photo = (id: string): NewPhoto => ({ id, kind: 'hanger', originalExt: 'jpg', cutoutState: 'pending', faceState: 'n/a' });
const T0 = new Date('2026-10-28T09:00:00.000Z');
const T1 = new Date('2026-10-28T10:00:00.000Z');

let db: Db;
beforeEach(async () => {
  db = openMemoryDb();
  await migrate(db);
});

describe('items', () => {
  it('stores an item with its photo and reads every tag back', async () => {
    const id = await createItemWithPhoto(db, TAGS, photo('photo0001'), T0);
    expect(await getItem(db, id)).toEqual({
      ...TAGS,
      id,
      status: 'active',
      primaryPhotoId: 'photo0001',
      createdAt: T0.toISOString(),
      updatedAt: T0.toISOString(),
    });
    expect(await getPhoto(db, 'photo0001')).toEqual({ ...photo('photo0001'), itemId: id, createdAt: T0.toISOString() });
  });

  it('refuses a subcategory of another slot and writes nothing', async () => {
    await expect(createItemWithPhoto(db, { ...TAGS, subcategory: 'jeans' }, photo('photo0001'))).rejects.toThrow();
    expect(await db.all('SELECT id FROM items')).toEqual([]);
  });

  it('writes neither row when the photo row fails', async () => {
    await createItemWithPhoto(db, TAGS, photo('photo0001'), T0);
    await expect(createItemWithPhoto(db, TAGS, photo('photo0001'), T1)).rejects.toThrow();
    expect(await listItems(db)).toHaveLength(1);
  });

  it('replaces the tags on edit and keeps the creation time', async () => {
    const id = await createItemWithPhoto(db, TAGS, photo('photo0001'), T0);
    await updateItem(db, id, { ...TAGS, colors: ['charcoal'], brand: "Levi's", price: null }, T1);
    expect(await getItem(db, id)).toMatchObject({
      colors: ['charcoal'],
      brand: "Levi's",
      price: null,
      createdAt: T0.toISOString(),
      updatedAt: T1.toISOString(),
    });
  });

  it('changes the status, and lists newest first without drafts', async () => {
    const first = await createItemWithPhoto(db, TAGS, photo('photo0001'), T0);
    const second = await createItemWithPhoto(db, { ...TAGS, slot: 'shoes', subcategory: 'boots' }, photo('photo0002'), T1);
    await db.run("INSERT INTO items (id, status, created_at, updated_at) VALUES ('draft0001', 'draft', ?, ?)", [T1.toISOString(), T1.toISOString()]);
    await setItemStatus(db, first, 'archived', T1);
    expect((await listItems(db)).map((item) => [item.id, item.status])).toEqual([
      [second, 'active'],
      [first, 'archived'],
    ]);
  });

  it('lists every photo id for the launch sweep', async () => {
    await createItemWithPhoto(db, TAGS, photo('photo0001'));
    expect(await allPhotoIds(db)).toEqual(new Set(['photo0001']));
  });

  it('lets the schema refuse an active item without a slot and a photo of a missing item', async () => {
    await expect(db.run("INSERT INTO items (id, status, created_at, updated_at) VALUES ('item0001', 'active', 'x', 'x')")).rejects.toThrow(/CHECK/);
    await expect(
      db.run(
        "INSERT INTO photos (id, item_id, kind, original_ext, cutout_state, face_state, created_at) VALUES ('photo0009', 'missing1', 'flat', 'jpg', 'none', 'n/a', 'x')",
      ),
    ).rejects.toThrow(/FOREIGN KEY/);
  });
});
