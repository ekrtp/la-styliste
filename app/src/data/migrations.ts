import type { Db, DbCalls } from './db';
import { SchemaTooNewError } from './errors';

/** Append only: index i upgrades schema version i to i + 1. Never edit an entry that has reached a phone. */
export const MIGRATIONS: readonly string[] = [
  // M0: key-value settings. Values are JSON text; the key list lives in `settings.ts`.
  `CREATE TABLE settings (
     key TEXT PRIMARY KEY,
     value TEXT NOT NULL
   );`,
  // M1a: wardrobe items and their photos (spec §5). Tables of later milestones arrive with them.
  `CREATE TABLE items (
     id TEXT PRIMARY KEY,
     status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'laundry', 'archived', 'wishlist')),
     slot TEXT CHECK (slot IN ('top', 'mid', 'bottom', 'onepiece', 'shoes', 'outer', 'accessory', 'headwear')),
     subcategory TEXT,
     colors TEXT NOT NULL DEFAULT '[]',
     material TEXT,
     texture TEXT,
     pattern TEXT,
     silhouette TEXT CHECK (silhouette IN ('fitted', 'regular', 'relaxed', 'oversized')),
     formality INTEGER CHECK (formality BETWEEN 1 AND 5),
     warmth INTEGER CHECK (warmth BETWEEN 1 AND 5),
     seasons TEXT NOT NULL DEFAULT '[]',
     details TEXT NOT NULL DEFAULT '[]',
     notes TEXT,
     brand TEXT,
     condition TEXT CHECK (condition IN ('new_with_tags', 'like_new', 'good', 'worn', 'poor')),
     condition_notes TEXT,
     resale TEXT,
     ai_fields TEXT NOT NULL DEFAULT '[]',
     price REAL,
     acquired_at TEXT,
     primary_photo_id TEXT,
     tag_source TEXT CHECK (tag_source IN ('ai', 'manual')),
     tag_model TEXT,
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL,
     CHECK (slot IS NOT NULL OR status = 'draft')
   );
   CREATE TABLE photos (
     id TEXT PRIMARY KEY,
     item_id TEXT REFERENCES items(id) ON DELETE CASCADE,
     outfit_id TEXT,
     kind TEXT NOT NULL CHECK (kind IN ('flat', 'hanger', 'worn', 'outfit')),
     original_ext TEXT NOT NULL CHECK (original_ext IN ('jpg', 'png')),
     cutout_state TEXT NOT NULL CHECK (cutout_state IN ('none', 'pending', 'done', 'failed')),
     face_state TEXT NOT NULL CHECK (face_state IN ('n/a', 'pending', 'filled', 'none_found', 'confirmed')),
     created_at TEXT NOT NULL
   );
   CREATE INDEX photos_item_id ON photos (item_id);`,
];

export interface MigrateOptions {
  /** Runs once before the first step when an existing database (version 1 or more) is about to be upgraded. An error stops the upgrade. */
  beforeUpgrade?: (fromVersion: number) => Promise<void>;
}

/**
 * Brings `db` to the last version of `migrations`, one transaction per step, so a failing step leaves the
 * database at the version before it. Refuses a database that is newer than `migrations`. Returns the version reached.
 */
export async function migrate(db: Db, migrations: readonly string[] = MIGRATIONS, options: MigrateOptions = {}): Promise<number> {
  let version = await readVersion(db);
  if (version > migrations.length) throw new SchemaTooNewError(version, migrations.length);
  // A fresh database (version 0) has nothing to lose; an existing one is copied before its first step runs.
  if (version > 0 && version < migrations.length) await options.beforeUpgrade?.(version);
  while (version < migrations.length) {
    version = await db.transaction(async (tx) => {
      // Read again inside the transaction: a migration queued before this one may have moved it on.
      const current = await readVersion(tx);
      if (current > migrations.length) throw new SchemaTooNewError(current, migrations.length);
      if (current === migrations.length) return current;
      await tx.exec(migrations[current]);
      await tx.exec(`PRAGMA user_version = ${current + 1}`);
      return current + 1;
    });
  }
  return version;
}

async function readVersion(db: DbCalls): Promise<number> {
  return (await db.first<{ user_version: number }>('PRAGMA user_version'))?.user_version ?? 0;
}
