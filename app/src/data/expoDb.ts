import * as SQLite from 'expo-sqlite';
import type { Db, SqlParam } from './db';

/** The database file name. Changing it would orphan every install's data. */
const DB_NAME = 'la-styliste.db';

export async function openAppDb(): Promise<Db> {
  const d = await SQLite.openDatabaseAsync(DB_NAME);
  await d.execAsync('PRAGMA journal_mode = WAL');
  return {
    exec: (sql: string) => d.execAsync(sql),
    run: async (sql: string, params: SqlParam[] = []) => {
      const r = await d.runAsync(sql, params);
      return { lastInsertRowId: r.lastInsertRowId, changes: r.changes };
    },
    all: <T,>(sql: string, params: SqlParam[] = []) => d.getAllAsync<T>(sql, params),
    first: <T,>(sql: string, params: SqlParam[] = []) => d.getFirstAsync<T>(sql, params),
  };
}
