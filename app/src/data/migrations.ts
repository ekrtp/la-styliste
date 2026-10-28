import type { Db, DbCalls } from './db';
import { SchemaTooNewError } from './errors';

/** Append only: index i upgrades schema version i to i + 1. Never edit an entry that has reached a phone. */
export const MIGRATIONS: readonly string[] = [
  // M0: key-value settings. Values are JSON text; the key list lives in `settings.ts`.
  `CREATE TABLE settings (
     key TEXT PRIMARY KEY,
     value TEXT NOT NULL
   );`,
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
