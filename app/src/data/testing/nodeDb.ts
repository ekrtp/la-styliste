import { DatabaseSync } from 'node:sqlite';
import type { Db, SqlParam } from '../db';

function wrap(d: DatabaseSync): Db {
  return {
    async exec(sql: string) {
      d.exec(sql);
    },
    async run(sql: string, params: SqlParam[] = []) {
      const r = d.prepare(sql).run(...params);
      return { lastInsertRowId: Number(r.lastInsertRowid), changes: Number(r.changes) };
    },
    async all<T>(sql: string, params: SqlParam[] = []) {
      return d.prepare(sql).all(...params) as unknown as T[];
    },
    async first<T>(sql: string, params: SqlParam[] = []) {
      return (d.prepare(sql).get(...params) ?? null) as unknown as T | null;
    },
  };
}

/** In-memory SQLite on Node's built-in driver. Tests only. */
export function openMemoryDb(): Db {
  return wrap(new DatabaseSync(':memory:'));
}

/** A database exactly as an install left it at schema `version`: the first `version` migrations, applied. Tests only. */
export async function dbAtVersion(version: number, migrations: readonly string[]): Promise<Db> {
  const db = openMemoryDb();
  for (const sql of migrations.slice(0, version)) await db.exec(sql);
  await db.exec(`PRAGMA user_version = ${version}`);
  return db;
}
