import { inTransaction, type Db } from './db';
import { InvalidSettingError } from './errors';

/** Which look to draw: the phone's own, or always light, or always dark. */
export type ThemeMode = 'system' | 'light' | 'dark';

export interface AppSettings {
  /** Light, dark or the phone's choice. */
  themeMode: ThemeMode;
}

/** A fresh install's settings, and what a missing or corrupt stored value falls back to. Dark by default (spec §11). */
export const DEFAULT_SETTINGS: AppSettings = {
  themeMode: 'dark',
};

/**
 * The database key of each setting. This list is also the backup allowlist (spec §5, §10): a name that is
 * not here is never read, written or exported. Later milestones add their settings here.
 */
export const SETTING_KEYS: { readonly [K in keyof AppSettings]: string } = {
  themeMode: 'theme_mode',
};

/** One parser per setting: stored JSON is untrusted, so each returns a valid value or null. */
const PARSERS: { readonly [K in keyof AppSettings]: (raw: unknown) => AppSettings[K] | null } = {
  themeMode: (raw) => (raw === 'system' || raw === 'light' || raw === 'dark' ? raw : null),
};

/** The setting names, in declaration order. */
const NAMES = Object.keys(SETTING_KEYS) as (keyof AppSettings)[];

function parseStored<K extends keyof AppSettings>(name: K, text: string): AppSettings[K] | null {
  try {
    return PARSERS[name](JSON.parse(text));
  } catch {
    return null;
  }
}

export async function loadSettings(db: Db): Promise<AppSettings> {
  const rows = await db.all<{ key: string; value: string }>('SELECT key, value FROM settings');
  const stored = new Map(rows.map((r) => [r.key, r.value]));
  const settings: AppSettings = { ...DEFAULT_SETTINGS };
  for (const name of NAMES) {
    const text = stored.get(SETTING_KEYS[name]);
    const value = text === undefined ? null : parseStored(name, text);
    if (value !== null) (settings as Record<keyof AppSettings, unknown>)[name] = value;
  }
  return settings;
}

/** Writes every setting of `patch` in one transaction. Names that are not settings are skipped; an invalid value writes nothing. */
export async function saveSettings(db: Db, patch: Partial<AppSettings>): Promise<void> {
  const writes: [string, string][] = [];
  for (const name of NAMES) {
    if (!Object.hasOwn(patch, name)) continue;
    const value = patch[name];
    if (PARSERS[name](value) === null) throw new InvalidSettingError(name);
    writes.push([SETTING_KEYS[name], JSON.stringify(value)]);
  }
  if (writes.length === 0) return;
  await inTransaction(db, async () => {
    for (const [key, value] of writes) {
      await db.run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value]);
    }
  });
}
