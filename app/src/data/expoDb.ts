import * as SQLite from 'expo-sqlite';
import { serialize, type Db, type SqlParam } from './db';

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
