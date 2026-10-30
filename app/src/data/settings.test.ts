import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from './db';
import { InvalidSettingError } from './errors';
import { migrate } from './migrations';
import { DEFAULT_SETTINGS, loadSettings, pickSettings, saveSettings, type ThemeMode } from './settings';
import { openMemoryDb } from './testing/nodeDb';

let db: Db;
beforeEach(async () => {
  db = openMemoryDb();
  await migrate(db);
});

describe('settings', () => {
  it('reads the defaults on a fresh install, dark included', async () => {
    expect(await loadSettings(db)).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS.themeMode).toBe('dark');
  });

  it('reads back what was saved, under its snake_case key', async () => {
    await saveSettings(db, { themeMode: 'light' });
    expect(await loadSettings(db)).toEqual({ ...DEFAULT_SETTINGS, themeMode: 'light' });
    expect(await db.all('SELECT key, value FROM settings')).toEqual([{ key: 'theme_mode', value: '"light"' }]);
  });

  it('falls back to the default for corrupt JSON and for an unknown value', async () => {
    await db.run('INSERT INTO settings (key, value) VALUES (?, ?)', ['theme_mode', '{not json']);
    expect((await loadSettings(db)).themeMode).toBe('dark');
    await db.run('UPDATE settings SET value = ? WHERE key = ?', ['"blue"', 'theme_mode']);
    expect((await loadSettings(db)).themeMode).toBe('dark');
  });

  it('ignores rows whose key is not in the list', async () => {
    await db.run('INSERT INTO settings (key, value) VALUES (?, ?)', ['api_key', '"secret"']);
    expect(await loadSettings(db)).toEqual(DEFAULT_SETTINGS);
  });

  it('refuses an invalid value and writes nothing', async () => {
    await expect(saveSettings(db, { themeMode: 'blue' as ThemeMode })).rejects.toBeInstanceOf(InvalidSettingError);
    expect(await db.all('SELECT * FROM settings')).toEqual([]);
  });

  it('never writes a name that is not a setting, even from untyped code', async () => {
    await saveSettings(db, { apiKey: 'x' } as never);
    expect(await db.all('SELECT * FROM settings')).toEqual([]);
  });

  it('picks only setting names out of a patch', () => {
    expect(pickSettings({ themeMode: 'light', apiKey: 'x' } as never)).toEqual({ themeMode: 'light' });
  });
});
