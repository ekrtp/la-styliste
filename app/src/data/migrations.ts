import { inTransaction, type Db } from './db';
import { SchemaTooNewError } from './errors';

/** Append only: index i upgrades schema version i to i + 1. Never edit an entry that has reached a phone. */
export const MIGRATIONS: readonly string[] = [
  // M0: key-value settings. Values are JSON text; the key list lives in `settings.ts`.
  `CREATE TABLE settings (
     key TEXT PRIMARY KEY,
     value TEXT NOT NULL
   );`,
];

/**
 * Brings `db` to the last version of `migrations`, one transaction per step, so a failing step leaves the
 * database at the version before it. Refuses a database that is newer than `migrations`. Returns the version reached.
 */
export async function migrate(db: Db, migrations: readonly string[] = MIGRATIONS): Promise<number> {
  const row = await db.first<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  if (version > migrations.length) throw new SchemaTooNewError(version, migrations.length);
  while (version < migrations.length) {
    const next = version + 1;
    const sql = migrations[version];
    await inTransaction(db, async () => {
      await db.exec(sql);
      await db.exec(`PRAGMA user_version = ${next}`);
    });
    version = next;
  }
  return version;
}
