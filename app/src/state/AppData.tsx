import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Db } from '../data/db';
import { openAppDb } from '../data/expoDb';
import { migrate } from '../data/migrations';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type AppSettings } from '../data/settings';

export interface AppData {
  /** The database is open, migrated and read. */
  ready: boolean;
  /** Why opening, migrating or reading failed; the root layout shows the recovery screen while it is set. */
  error: string | null;
  settings: AppSettings;
  updateSettings(patch: Partial<AppSettings>): Promise<void>;
  /** Opens, migrates and reads the database again. */
  retry(): void;
}

const AppDataContext = createContext<AppData | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Db | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setError(null);
    (async () => {
      const opened = await openAppDb();
      await migrate(opened);
      const loaded = await loadSettings(opened);
      if (!live) return;
      setSettings(loaded);
      setDb(opened);
    })().catch((e: unknown) => {
      if (live) setError(e instanceof Error ? e.message : String(e));
    });
    return () => {
      live = false;
    };
  }, [attempt]);

  const updateSettings = useCallback(
    async (patch: Partial<AppSettings>) => {
      if (db === null) throw new Error('The database is not open yet');
      await saveSettings(db, patch);
      setSettings((current) => ({ ...current, ...patch }));
    },
    [db],
  );

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const value = useMemo<AppData>(
    () => ({ ready: db !== null, error, settings, updateSettings, retry }),
    [db, error, settings, updateSettings, retry],
  );
  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppData {
  const value = useContext(AppDataContext);
  if (value === null) throw new Error('useAppData needs AppDataProvider above it');
  return value;
}
