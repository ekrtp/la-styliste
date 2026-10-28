import { describe, expect, it } from 'vitest';
import { serialize, type RawDb } from './db';
import { openMemoryDb } from './testing/nodeDb';

describe('transaction', () => {
  it('rolls the work back and rethrows the error', async () => {
    const db = openMemoryDb();
    await db.exec('CREATE TABLE t (x INTEGER)');
    await expect(
      db.transaction(async (tx) => {
        await tx.run('INSERT INTO t (x) VALUES (1)');
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await db.first('SELECT COUNT(*) AS n FROM t')).toEqual({ n: 0 });
  });

  it('keeps the original error when ROLLBACK itself fails', async () => {
    const raw = {
      exec: async (sql: string) => {
        if (sql === 'ROLLBACK') throw new Error('no transaction is active');
      },
    } as unknown as RawDb;
    await expect(
      serialize(raw).transaction(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
  });

  it('makes calls from outside wait until it has ended', async () => {
    const db = openMemoryDb();
    await db.exec('CREATE TABLE t (x INTEGER)');
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const order: string[] = [];
    const tx = db.transaction(async (t) => {
      await t.run('INSERT INTO t (x) VALUES (1)');
      await gate;
      order.push('work done');
    });
    const outside = db.first<{ n: number }>('SELECT COUNT(*) AS n FROM t').then((row) => {
      order.push('outside');
      return row;
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(order).toEqual([]);
    release();
    await tx;
    expect(await outside).toEqual({ n: 1 });
    expect(order).toEqual(['work done', 'outside']);
  });
});

describe('serialize', () => {
  it('runs later calls after a failed one', async () => {
    const db = openMemoryDb();
    await expect(db.exec('NOT SQL')).rejects.toThrow();
    expect(await db.first('SELECT 1 AS x')).toEqual({ x: 1 });
  });
});

describe('node adapter', () => {
  it('enforces foreign keys, as the phone adapter does', async () => {
    const db = openMemoryDb();
    await db.exec('CREATE TABLE p (id TEXT PRIMARY KEY); CREATE TABLE c (p_id TEXT REFERENCES p(id));');
    await expect(db.run('INSERT INTO c (p_id) VALUES (?)', ['missing'])).rejects.toThrow(/FOREIGN KEY/);
  });
});
