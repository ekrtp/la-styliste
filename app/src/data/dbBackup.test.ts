import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { backupName, isBackupOf, vacuumIntoSql } from './dbBackup';
import { openFileDb } from './testing/nodeDb';

let dir: string | null = null;
afterEach(() => {
  if (dir !== null) rmSync(dir, { recursive: true, force: true });
  dir = null;
});

describe('pre-migration copy', () => {
  it('is named after the version it was taken at', () => {
    expect(backupName('la-styliste.db', 1)).toBe('la-styliste.db.bak-v1');
  });

  it('recognises only its own copies', () => {
    expect(isBackupOf('a.db', 'a.db.bak-v1')).toBe(true);
    expect(isBackupOf('a.db', 'a.db.bak-v12')).toBe(true);
    for (const name of ['a.db', 'a.db-wal', 'a.db.bak-v', 'a.db.bak-vx', 'b.db.bak-v1', 'a.db.bak-v1.tmp']) {
      expect(isBackupOf('a.db', name)).toBe(false);
    }
  });

  it('writes a readable copy with VACUUM INTO, a quote in the path included', async () => {
    dir = mkdtempSync(join(tmpdir(), 'la-styliste-'));
    const db = openFileDb(join(dir, 'live.db'));
    await db.exec("PRAGMA journal_mode = WAL; CREATE TABLE t (x TEXT); INSERT INTO t VALUES ('kept');");
    const target = join(dir, "it's.db.bak-v1");
    await db.exec(vacuumIntoSql(target));
    await db.close();
    const copy = new DatabaseSync(target);
    expect(copy.prepare('SELECT x FROM t').all()).toEqual([{ x: 'kept' }]);
    copy.close();
  });
});
