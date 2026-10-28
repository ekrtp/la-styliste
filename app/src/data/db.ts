export type SqlParam = string | number | null;

/** The only surface repositories use. One adapter per runtime: expo-sqlite on the phone, node:sqlite in tests. */
export interface Db {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: SqlParam[]): Promise<{ lastInsertRowId: number; changes: number }>;
  all<T>(sql: string, params?: SqlParam[]): Promise<T[]>;
  first<T>(sql: string, params?: SqlParam[]): Promise<T | null>;
}

/** Runs `work` between BEGIN and COMMIT; any error rolls the whole step back and is rethrown. */
export async function inTransaction<T>(db: Db, work: () => Promise<T>): Promise<T> {
  await db.exec('BEGIN');
  try {
    const result = await work();
    await db.exec('COMMIT');
    return result;
  } catch (e) {
    await db.exec('ROLLBACK');
    throw e;
  }
}
