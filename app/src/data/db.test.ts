import { describe, expect, it } from 'vitest';
import { inTransaction, type Db } from './db';
import { openMemoryDb } from './testing/nodeDb';

describe('inTransaction', () => {
  it('rolls the work back and rethrows the error', async () => {
    const db = openMemoryDb();
    await db.exec('CREATE TABLE t (x INTEGER)');
    await expect(
      inTransaction(db, async () => {
        await db.run('INSERT INTO t (x) VALUES (1)');
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await db.first('SELECT COUNT(*) AS n FROM t')).toEqual({ n: 0 });
  });

  it('keeps the original error when ROLLBACK itself fails', async () => {
    const db = {
      exec: async (sql: string) => {
        if (sql === 'ROLLBACK') throw new Error('no transaction is active');
      },
    } as unknown as Db;
    await expect(
      inTransaction(db, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
  });
});
