import { describe, expect, it } from 'vitest';
import { SchemaTooNewError } from './errors';
import { MIGRATIONS, migrate } from './migrations';
import { dbAtVersion, openMemoryDb } from './testing/nodeDb';

const version = async (db: Awaited<ReturnType<typeof dbAtVersion>>) =>
  (await db.first<{ user_version: number }>('PRAGMA user_version'))?.user_version;

describe('migrate', () => {
  it('runs every step exactly once when two migrations start together', async () => {
    const steps = ['CREATE TABLE a (x INTEGER);', 'CREATE TABLE b (y INTEGER);'];
    const db = openMemoryDb();
    expect(await Promise.all([migrate(db, steps), migrate(db, steps)])).toEqual([2, 2]);
    expect(await version(db)).toBe(2);
  });

  it('brings a fresh database to the last version and creates the settings table', async () => {
    const db = openMemoryDb();
    expect(await migrate(db)).toBe(MIGRATIONS.length);
    expect(await version(db)).toBe(MIGRATIONS.length);
    await db.run('INSERT INTO settings (key, value) VALUES (?, ?)', ['theme_mode', '"dark"']);
    expect(await db.all('SELECT key, value FROM settings')).toEqual([{ key: 'theme_mode', value: '"dark"' }]);
  });

  it('runs again without touching a database that is already current', async () => {
    const db = openMemoryDb();
    await migrate(db);
    await db.run('INSERT INTO settings (key, value) VALUES (?, ?)', ['theme_mode', '"light"']);
    expect(await migrate(db)).toBe(MIGRATIONS.length);
    expect(await db.all('SELECT key, value FROM settings')).toEqual([{ key: 'theme_mode', value: '"light"' }]);
  });

  it('rolls a failing step back completely and leaves the version where it was', async () => {
    const steps = ['CREATE TABLE a (x INTEGER);', 'CREATE TABLE b (y INTEGER); INSERT INTO missing_table VALUES (1);'];
    const db = await dbAtVersion(1, steps);
    await expect(migrate(db, steps)).rejects.toThrow();
    expect(await version(db)).toBe(1);
    expect(await db.all("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'b'")).toEqual([]);
  });

  it('runs only the steps after the current version', async () => {
    const steps = ['CREATE TABLE a (x INTEGER);', 'CREATE TABLE b (y INTEGER);'];
    const db = await dbAtVersion(1, steps);
    expect(await migrate(db, steps)).toBe(2);
    expect(await version(db)).toBe(2);
    expect(await db.all("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'b'")).toEqual([{ name: 'b' }]);
  });

  it('refuses a database written by a newer build', async () => {
    const db = await dbAtVersion(MIGRATIONS.length, MIGRATIONS);
    await db.exec(`PRAGMA user_version = ${MIGRATIONS.length + 3}`);
    await expect(migrate(db)).rejects.toBeInstanceOf(SchemaTooNewError);
    expect(await version(db)).toBe(MIGRATIONS.length + 3);
  });
});
