import { Directory, File, Paths } from 'expo-file-system';
import * as SQLite from 'expo-sqlite';
import { serialize, type Db, type SqlParam } from './db';
import { backupName, isBackupOf, vacuumIntoSql } from './dbBackup';

/** The database file name. Changing it would orphan every install's data. */
export const DB_NAME = 'la-styliste.db';

/** The app's database and the path of its file (the pre-migration copy is written next to it). */
export interface AppDb {
  db: Db;
  path: string;
}

export async function openAppDb(): Promise<AppDb> {
  const d = await SQLite.openDatabaseAsync(DB_NAME);
  try {
    await d.execAsync('PRAGMA journal_mode = WAL');
    // Off by default and per connection in SQLite; photos.item_id relies on it from schema v2.
    await d.execAsync('PRAGMA foreign_keys = ON');
  } catch (e) {
    await d.closeAsync().catch(() => {});
    throw e;
  }
  const db = serialize({
    exec: (sql) => d.execAsync(sql),
    run: async (sql, params: SqlParam[] = []) => {
      const r = await d.runAsync(sql, params);
      return { lastInsertRowId: r.lastInsertRowId, changes: r.changes };
    },
    all: <T>(sql: string, params: SqlParam[] = []) => d.getAllAsync<T>(sql, params),
    first: <T>(sql: string, params: SqlParam[] = []) => d.getFirstAsync<T>(sql, params),
    close: () => d.closeAsync(),
  });
  return { db, path: d.databasePath };
}

/** Where expo-sqlite keeps database files on iOS: `<documents>/SQLite`, its `defaultDatabaseDirectory`. */
function databaseDirectory(): Directory {
  return new Directory(Paths.document, 'SQLite');
}

/**
 * Copies the database before it is migrated away from schema `version`, after deleting older copies: one copy is
 * kept, until the next upgrade (spec §10). Throws when the copy is not where it should be, which stops the upgrade.
 */
export async function backupBeforeUpgrade(db: Db, dbPath: string, version: number): Promise<void> {
  const dir = databaseDirectory();
  for (const entry of dir.list()) {
    if (entry instanceof File && isBackupOf(DB_NAME, entry.name)) entry.delete();
  }
  const name = backupName(DB_NAME, version);
  await db.exec(vacuumIntoSql(`${dbPath.slice(0, dbPath.lastIndexOf('/') + 1)}${name}`));
  if (!new File(dir, name).exists) throw new Error(`The pre-migration copy ${name} was not written`);
}
