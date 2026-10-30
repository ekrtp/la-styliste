import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Db } from '../data/db';
import { backupBeforeUpgrade, openAppDb } from '../data/expoDb';
import { MIGRATIONS, migrate } from '../data/migrations';
import { DEFAULT_SETTINGS, loadSettings, pickSettings, saveSettings, type AppSettings } from '../data/settings';
import { sweepPhotos } from '../media/photoFiles';

export interface AppData {
  /** The database is open, migrated and read. */
  ready: boolean;
  /** Why opening, migrating or reading failed; the root layout shows the recovery screen while it is set. */
  error: Error | null;
  settings: AppSettings;
  updateSettings(patch: Partial<AppSettings>): Promise<void>;
  /** Opens, migrates and reads the database again. */
  retry(): void;
  /** The open database, null until `ready`. Screens read it with `useDb()`. */
  db: Db | null;
  /** Grows by one after every write a screen reports, so lists know to reload. */
  revision: number;
  /** Screens call this after they write to the database. */
  changed(): void;
}

const AppDataContext = createContext<AppData | null>(null);

function toError(e: unknown): Error {
  return e instanceof Error ? e : new Error(String(e));
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Db | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [error, setError] = useState<Error | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [revision, setRevision] = useState(0);
  // The previous attempt's connection, closing. expo-sqlite shares one native connection per file, so the next attempt waits for it.
  const closing = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let live = true;
    let owned: Db | null = null;
    setError(null);
    const run = (async () => {
      await closing.current;
      const app = await openAppDb();
      owned = app.db;
      await migrate(app.db, MIGRATIONS, { beforeUpgrade: (from) => backupBeforeUpgrade(app.db, app.path, from) });
      const loaded = await loadSettings(app.db);
      await sweepPhotos(app.db);
      if (!live) return;
      setSettings(loaded);
      setDb(app.db);
    })();
    run.catch((e: unknown) => {
      if (live) setError(toError(e));
    });
    return () => {
      live = false;
      // This attempt is over (a retry or an unmount): close its connection once it has finished with it.
      closing.current = run
        .then(
          () => undefined,
          () => undefined,
        )
        .then(() => owned?.close())
        .catch(() => {});
    };
  }, [attempt]);

  const updateSettings = useCallback(
    async (patch: Partial<AppSettings>) => {
      if (db === null) throw new Error('The database is not open yet');
      await saveSettings(db, patch);
      setSettings((current) => ({ ...current, ...pickSettings(patch) }));
    },
    [db],
  );

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const changed = useCallback(() => setRevision((n) => n + 1), []);

  const value = useMemo<AppData>(
    () => ({ ready: db !== null, error, settings, updateSettings, retry, db, revision, changed }),
    [db, error, settings, updateSettings, retry, revision, changed],
  );
  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppData {
  const value = useContext(AppDataContext);
  if (value === null) throw new Error('useAppData needs AppDataProvider above it');
  return value;
}

/** The open database. Only screens under the root layout's ready branch call this, so it is always open there. */
export function useDb(): Db {
  const { db } = useAppData();
  if (db === null) throw new Error('The database is not open yet');
  return db;
}
