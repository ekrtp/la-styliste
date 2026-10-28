# la-styliste M1a Wardrobe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Items go into the app with a photo and a hand-filled tag form, show up in a filterable grid, and open on their own screen to edit or change status. Before that, the data layer gets the safety M1 needs: one queue for every database call, transactions, a copy before every migration, foreign keys and a clean connection owner.

**Architecture:** Expo Router app in `app/`. SQLite behind the `Db` interface, now one serialized queue in JS for both adapters. Photo files under `<documents>/photos/<id>/`, written to a staging folder and renamed into place before the rows are inserted in one transaction. Pure logic (vocabulary, filters, byte checks, form parsing) lives in files that import nothing from Expo or React Native, so Vitest covers it on Node.

**Tech Stack:** Expo SDK 58 (React Native 0.88, React 19.3), expo-router (`expo-router/js-tabs`), expo-sqlite 58, expo-file-system 58 (`File`, `Directory`, `Paths`), expo-image-picker 58, expo-image-manipulator 58 (contextual API), expo-image 58, expo-splash-screen 58, zod 4.6, TypeScript ~6.0, Vitest 5 on Node 24.

**Spec:** [`docs/superpowers/specs/2026-10-28-la-styliste-design.md`](../specs/2026-10-28-la-styliste-design.md) (§3 M1 row, §5 data model, §6 image pipeline, §10 migrations, §11 screens, §12 gates, §13 device checks). Starts from the handover list at the end of the [M0 plan](2026-10-28-la-styliste-m0-skeleton.md).

## Global Constraints

- Expo SDK 58. Native packages only with `npx expo install <pkg>`; pure-JS packages with `npm install`. Every package this plan needs is already installed (commit `8f64ad1`): do not add others.
- Check every third-party API against the installed `.d.ts` in `node_modules`, not memory.
- English identifiers, comments, commit messages and docs. Turkish only in UI strings.
- Every constant has a comment line directly above it saying what it is and why that value.
- `src/core/**` imports nothing from React, React Native or Expo (zod is fine).
- Tests sit next to their source as `*.test.ts`, run on Node, and never import a file that imports `expo-*`, `react-native` or `@expo/*`: pure logic goes in its own file. No component tests.
- Image test fixtures are built as bytes in code: the commit gate refuses image files outside `app/assets/`.
- Components never import `src/ui/themes/dark.ts`, `light.ts`, `base.ts` or `registry.ts`; they use `useTheme()` or `makeStyles()`.
- Inside `db.transaction(work)`, use only the `tx` that `work` receives. A call on the outer `Db` waits for the transaction to end, so it would never run.
- Never run `npx expo start` in an agent run. Publishing to the phone is the controller's step (Task 8), with the command in the README.
- The repo is public: no company names, usernames, absolute paths, photos, backups or keys in any file.
- Every command runs from `app/` unless a step says otherwise; `git add` paths are relative to `app/`. Commit messages end with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- Gates before every commit: `npm test`, `npm run typecheck`, `npx expo export -p ios --output-dir dist`. The pre-commit hook runs `npm run check:public` on its own.

## Decisions made while writing this plan

| # | Decision | Why |
|---|---|---|
| 1 | M1 is split: **M1a** (this plan: wardrobe) and **M1b** (backup export and staged import, backup nudge, recovery-screen export and restore). M1's "done when" is checked at the end of M1b | Backup is its own subsystem with its own tests; M1a reaches the phone sooner |
| 2 | Transactions run on one JS queue for both adapters (`serialize`), not `withExclusiveTransactionAsync` | The exclusive transaction takes a second connection, and other writes then fail with `database is locked` (expo-sqlite `.d.ts`). One queue gives the phone the same ordering the tests run |
| 3 | The pre-migration copy uses `VACUUM INTO` | Same SQL on both adapters, so a Node test covers it; it includes pages still in the WAL file |
| 4 | A photo whose files are missing shows a placeholder when drawn; rows are not marked | §5 has no column for it; the sweep in §6 only deletes |
| 5 | The native splash covers the start until the database is ready; the navigator mounts then | Removes the empty frame the M0 handover named, with no screen that needs the database mounted early |
| 6 | Restore `.bak` and raw export on the recovery screen move to M1b | They need the zip and share code M1b writes |
| 7 | The launch sweep deletes at most 5 orphan folders | One crash leaves one; more means the database is not the one these photos belong to |
| 8 | Each table arrives with the milestone that writes it: `items` and `photos` now, `tag_jobs` in M2, `outfits`, `outfit_items` and `wear_log` in M3. Manual items are created `active` with `tag_source = 'manual'` | No empty tables to migrate around |
| 9 | Only `slot` is required on the manual form | Five items by hand must stay quick; M2's tagging fills the rest |
| 10 | The tag vocabulary (subcategories, colours, materials, textures, patterns, details) is defined in Task 3 | §5 names the fields, not their values; the values cover what §8's rules read |

---

### Task 1: One queue, transactions, close and foreign keys

Handover items 1, 2 (the `close` half) and 4.

**Files:**
- Modify: `app/src/data/db.ts` (whole file)
- Modify: `app/src/data/testing/nodeDb.ts` (whole file)
- Modify: `app/src/data/expoDb.ts` (whole file)
- Modify: `app/src/data/migrations.ts` (the `migrate` function and imports)
- Modify: `app/src/data/settings.ts` (imports and `saveSettings`)
- Modify: `app/src/state/AppData.tsx` (one line)
- Test: `app/src/data/db.test.ts` (whole file), `app/src/data/migrations.test.ts` (one new test)

**Interfaces:**
- Consumes: the M0 `Db`, `migrate`, `saveSettings`.
- Produces:
  - `interface Db { exec; run; all<T>; first<T>; transaction<T>(work: (tx: DbCalls) => Promise<T>): Promise<T>; close(): Promise<void> }`
  - `type DbCalls = Pick<Db, 'exec' | 'run' | 'all' | 'first'>`
  - `interface RawDb extends DbCalls { close(): Promise<void> }`
  - `serialize(raw: RawDb): Db`
  - `openAppDb(): Promise<AppDb>` with `interface AppDb { db: Db; path: string }`; `DB_NAME` is exported
  - `openFileDb(path: string): Db` (tests only)
  - `inTransaction` is removed.

- [ ] **Step 1: Write the failing tests**

Replace `app/src/data/db.test.ts` with:

```ts
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
```

Add this test inside the `describe('migrate', ...)` block of `app/src/data/migrations.test.ts`:

```ts
  it('runs every step exactly once when two migrations start together', async () => {
    const steps = ['CREATE TABLE a (x INTEGER);', 'CREATE TABLE b (y INTEGER);'];
    const db = openMemoryDb();
    expect(await Promise.all([migrate(db, steps), migrate(db, steps)])).toEqual([2, 2]);
    expect(await version(db)).toBe(2);
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/data/db.test.ts src/data/migrations.test.ts`
Expected: FAIL (`serialize` is not exported, `db.transaction` is not a function; the parallel migration fails with `table a already exists`).

- [ ] **Step 3: Write the queue**

Replace `app/src/data/db.ts` with:

```ts
export type SqlParam = string | number | null;

/** The surface repositories use. Every call waits for the ones before it: one connection, one queue. */
export interface Db {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: SqlParam[]): Promise<{ lastInsertRowId: number; changes: number }>;
  all<T>(sql: string, params?: SqlParam[]): Promise<T[]>;
  first<T>(sql: string, params?: SqlParam[]): Promise<T | null>;
  /**
   * Runs `work` between BEGIN and COMMIT with the connection to itself; any error rolls it back and is rethrown.
   * Inside `work` use only `tx`: a call on the outer `Db` waits for the transaction to end, so it would never run.
   */
  transaction<T>(work: (tx: DbCalls) => Promise<T>): Promise<T>;
  /** Closes the connection once every queued call has finished. */
  close(): Promise<void>;
}

/** The four statement calls: what a transaction's `work` receives and what read-only helpers need. */
export type DbCalls = Pick<Db, 'exec' | 'run' | 'all' | 'first'>;

/** What a runtime adapter provides: the raw statement calls and a way to close. */
export interface RawDb extends DbCalls {
  close(): Promise<void>;
}

/** Puts every call of `raw` on one queue and adds transactions. Both adapters go through here, so tests run the phone's ordering. */
export function serialize(raw: RawDb): Db {
  let tail: Promise<unknown> = Promise.resolve();
  const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
    const result = tail.then(task);
    // A failed call must not block the ones after it.
    tail = result.catch(() => undefined);
    return result;
  };
  return {
    exec: (sql) => enqueue(() => raw.exec(sql)),
    run: (sql, params) => enqueue(() => raw.run(sql, params)),
    all: <T>(sql: string, params?: SqlParam[]) => enqueue(() => raw.all<T>(sql, params)),
    first: <T>(sql: string, params?: SqlParam[]) => enqueue(() => raw.first<T>(sql, params)),
    transaction: <T>(work: (tx: DbCalls) => Promise<T>) =>
      enqueue(async () => {
        await raw.exec('BEGIN');
        try {
          const result = await work(raw);
          await raw.exec('COMMIT');
          return result;
        } catch (e) {
          // SQLite may already have rolled back on its own (disk full, I/O error); a failing ROLLBACK must not hide the real error.
          await raw.exec('ROLLBACK').catch(() => {});
          throw e;
        }
      }),
    close: () => enqueue(() => raw.close()),
  };
}
```

- [ ] **Step 4: Put both adapters on the queue, with foreign keys on**

Replace `app/src/data/testing/nodeDb.ts` with:

```ts
import { DatabaseSync } from 'node:sqlite';
import { serialize, type Db, type SqlParam } from '../db';

function wrap(d: DatabaseSync): Db {
  // SQLite leaves foreign keys off per connection; the phone adapter turns them on too.
  d.exec('PRAGMA foreign_keys = ON');
  return serialize({
    async exec(sql) {
      d.exec(sql);
    },
    async run(sql, params: SqlParam[] = []) {
      const r = d.prepare(sql).run(...params);
      return { lastInsertRowId: Number(r.lastInsertRowid), changes: Number(r.changes) };
    },
    async all<T>(sql: string, params: SqlParam[] = []) {
      return d.prepare(sql).all(...params) as unknown as T[];
    },
    async first<T>(sql: string, params: SqlParam[] = []) {
      return (d.prepare(sql).get(...params) ?? null) as unknown as T | null;
    },
    async close() {
      d.close();
    },
  });
}

/** In-memory SQLite on Node's built-in driver. Tests only. */
export function openMemoryDb(): Db {
  return wrap(new DatabaseSync(':memory:'));
}

/** SQLite in a file, for tests that need a real path (`VACUUM INTO`). Tests only. */
export function openFileDb(path: string): Db {
  return wrap(new DatabaseSync(path));
}

/** A database exactly as an install left it at schema `version`: the first `version` migrations, applied. Tests only. */
export async function dbAtVersion(version: number, migrations: readonly string[]): Promise<Db> {
  const db = openMemoryDb();
  for (const sql of migrations.slice(0, version)) await db.exec(sql);
  await db.exec(`PRAGMA user_version = ${version}`);
  return db;
}
```

Replace `app/src/data/expoDb.ts` with:

```ts
import * as SQLite from 'expo-sqlite';
import { serialize, type Db, type SqlParam } from './db';

/** The database file name. Changing it would orphan every install's data. */
export const DB_NAME = 'la-styliste.db';

/** The app's database and the path of its file (the pre-migration copy is written next to it). */
export interface AppDb {
  db: Db;
  path: string;
}

export async function openAppDb(): Promise<AppDb> {
  const d = await SQLite.openDatabaseAsync(DB_NAME);
  try {
    await d.execAsync('PRAGMA journal_mode = WAL');
    // Off by default and per connection in SQLite; photos.item_id relies on it from schema v2.
    await d.execAsync('PRAGMA foreign_keys = ON');
  } catch (e) {
    await d.closeAsync().catch(() => {});
    throw e;
  }
  const db = serialize({
    exec: (sql) => d.execAsync(sql),
    run: async (sql, params: SqlParam[] = []) => {
      const r = await d.runAsync(sql, params);
      return { lastInsertRowId: r.lastInsertRowId, changes: r.changes };
    },
    all: <T>(sql: string, params: SqlParam[] = []) => d.getAllAsync<T>(sql, params),
    first: <T>(sql: string, params: SqlParam[] = []) => d.getFirstAsync<T>(sql, params),
    close: () => d.closeAsync(),
  });
  return { db, path: d.databasePath };
}
```

- [ ] **Step 5: Move migrations and settings onto `transaction`**

In `app/src/data/migrations.ts`, change the first import line to:

```ts
import type { Db, DbCalls } from './db';
```

and replace the `migrate` function (keep `MIGRATIONS` and its comment unchanged) with:

```ts
/**
 * Brings `db` to the last version of `migrations`, one transaction per step, so a failing step leaves the
 * database at the version before it. Refuses a database that is newer than `migrations`. Returns the version reached.
 */
export async function migrate(db: Db, migrations: readonly string[] = MIGRATIONS): Promise<number> {
  let version = await readVersion(db);
  if (version > migrations.length) throw new SchemaTooNewError(version, migrations.length);
  while (version < migrations.length) {
    version = await db.transaction(async (tx) => {
      // Read again inside the transaction: a migration queued before this one may have moved it on.
      const current = await readVersion(tx);
      if (current > migrations.length) throw new SchemaTooNewError(current, migrations.length);
      if (current === migrations.length) return current;
      await tx.exec(migrations[current]);
      await tx.exec(`PRAGMA user_version = ${current + 1}`);
      return current + 1;
    });
  }
  return version;
}

async function readVersion(db: DbCalls): Promise<number> {
  return (await db.first<{ user_version: number }>('PRAGMA user_version'))?.user_version ?? 0;
}
```

In `app/src/data/settings.ts`, change the first import line to:

```ts
import type { Db } from './db';
```

and replace the last statement of `saveSettings` (the `await inTransaction(...)` block) with:

```ts
  await db.transaction(async (tx) => {
    for (const [key, value] of writes) {
      await tx.run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value]);
    }
  });
```

In `app/src/state/AppData.tsx`, change `const opened = await openAppDb();` to:

```ts
      const { db: opened } = await openAppDb();
```

- [ ] **Step 6: Run the tests**

Run: `npm test`
Expected: PASS, every test (the M0 tests included).

- [ ] **Step 7: Run the gates and commit**

Run: `npm run typecheck` and `npx expo export -p ios --output-dir dist`. Expected: both clean.

```bash
git add src/data/db.ts src/data/db.test.ts src/data/testing/nodeDb.ts src/data/expoDb.ts src/data/migrations.ts src/data/migrations.test.ts src/data/settings.ts src/state/AppData.tsx
git commit -m "feat(data): one queue for every database call, transactions, close, foreign keys

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: A copy of the database before every migration

Handover item 3; spec §10 "Migrations".

**Files:**
- Create: `app/src/data/dbBackup.ts`
- Test: `app/src/data/dbBackup.test.ts`
- Modify: `app/src/data/migrations.ts` (`migrate` gains `options`)
- Modify: `app/src/data/migrations.test.ts` (three new tests)
- Modify: `app/src/data/expoDb.ts` (add `backupBeforeUpgrade`)
- Modify: `app/src/state/AppData.tsx` (pass the hook)

**Interfaces:**
- Consumes: `Db`, `serialize`, `openFileDb`, `DB_NAME`, `openAppDb` (Task 1).
- Produces:
  - `backupName(dbName: string, version: number): string`
  - `isBackupOf(dbName: string, fileName: string): boolean`
  - `vacuumIntoSql(path: string): string`
  - `interface MigrateOptions { beforeUpgrade?: (fromVersion: number) => Promise<void> }`
  - `migrate(db, migrations = MIGRATIONS, options: MigrateOptions = {}): Promise<number>`
  - `backupBeforeUpgrade(db: Db, dbPath: string, version: number): Promise<void>` (phone only)

- [ ] **Step 1: Write the failing tests**

Create `app/src/data/dbBackup.test.ts`:

```ts
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
```

Add this block at the end of `app/src/data/migrations.test.ts`:

```ts
describe('migrate: copy before an upgrade', () => {
  const steps = ['CREATE TABLE a (x INTEGER);', 'CREATE TABLE b (y INTEGER);'];

  it('calls beforeUpgrade once, with the starting version, when an existing database is upgraded', async () => {
    const db = await dbAtVersion(1, steps);
    const calls: number[] = [];
    await migrate(db, steps, {
      beforeUpgrade: async (from) => {
        calls.push(from);
      },
    });
    expect(calls).toEqual([1]);
  });

  it('does not call it for a fresh database or a current one', async () => {
    const calls: number[] = [];
    const options = {
      beforeUpgrade: async (from: number) => {
        calls.push(from);
      },
    };
    const db = openMemoryDb();
    await migrate(db, steps, options);
    await migrate(db, steps, options);
    expect(calls).toEqual([]);
  });

  it('upgrades nothing when the copy fails', async () => {
    const db = await dbAtVersion(1, steps);
    await expect(
      migrate(db, steps, {
        beforeUpgrade: async () => {
          throw new Error('disk full');
        },
      }),
    ).rejects.toThrow('disk full');
    expect(await version(db)).toBe(1);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/data/dbBackup.test.ts src/data/migrations.test.ts`
Expected: FAIL (`./dbBackup` does not exist; `beforeUpgrade` is never called).

- [ ] **Step 3: Write the pure helpers**

Create `app/src/data/dbBackup.ts`:

```ts
/** What follows the database name in a copy's file name, before the version number (spec §10: `<name>.db.bak-v<old>`). */
const BACKUP_INFIX = '.bak-v';

/** The file name of the copy taken before migrating away from schema `version`. */
export function backupName(dbName: string, version: number): string {
  return `${dbName}${BACKUP_INFIX}${version}`;
}

/** Whether `fileName` is one of `dbName`'s pre-migration copies. */
export function isBackupOf(dbName: string, fileName: string): boolean {
  const prefix = `${dbName}${BACKUP_INFIX}`;
  return fileName.startsWith(prefix) && /^\d+$/.test(fileName.slice(prefix.length));
}

/** `VACUUM INTO` writes a consistent copy of the live database, WAL pages included, which a file copy would miss. */
export function vacuumIntoSql(path: string): string {
  return `VACUUM INTO '${path.replaceAll("'", "''")}'`;
}
```

- [ ] **Step 4: Give `migrate` the hook**

In `app/src/data/migrations.ts`, add above `migrate`:

```ts
export interface MigrateOptions {
  /** Runs once before the first step when an existing database (version 1 or more) is about to be upgraded. An error stops the upgrade. */
  beforeUpgrade?: (fromVersion: number) => Promise<void>;
}
```

change the signature to:

```ts
export async function migrate(db: Db, migrations: readonly string[] = MIGRATIONS, options: MigrateOptions = {}): Promise<number> {
```

and insert, right after the `SchemaTooNewError` line and before the `while` loop:

```ts
  // A fresh database (version 0) has nothing to lose; an existing one is copied before its first step runs.
  if (version > 0 && version < migrations.length) await options.beforeUpgrade?.(version);
```

- [ ] **Step 5: Run the tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Write the phone side and wire it in**

Add to `app/src/data/expoDb.ts`. Imports at the top:

```ts
import { Directory, File, Paths } from 'expo-file-system';
import { backupName, isBackupOf, vacuumIntoSql } from './dbBackup';
```

and at the end of the file:

```ts
/** Where expo-sqlite keeps database files on iOS: `<documents>/SQLite`, its `defaultDatabaseDirectory`. */
function databaseDirectory(): Directory {
  return new Directory(Paths.document, 'SQLite');
}

/**
 * Copies the database before it is migrated away from schema `version`, after deleting older copies: one copy is
 * kept, until the next upgrade (spec §10). Throws when the copy is not where it should be, which stops the upgrade.
 */
export async function backupBeforeUpgrade(db: Db, dbPath: string, version: number): Promise<void> {
  const dir = databaseDirectory();
  for (const entry of dir.list()) {
    if (entry instanceof File && isBackupOf(DB_NAME, entry.name)) entry.delete();
  }
  const name = backupName(DB_NAME, version);
  await db.exec(vacuumIntoSql(`${dbPath.slice(0, dbPath.lastIndexOf('/') + 1)}${name}`));
  if (!new File(dir, name).exists) throw new Error(`The pre-migration copy ${name} was not written`);
}
```

In `app/src/state/AppData.tsx`, change the imports of `expoDb` and `migrations` to:

```ts
import { backupBeforeUpgrade, openAppDb } from '../data/expoDb';
import { MIGRATIONS, migrate } from '../data/migrations';
```

and replace the two lines that open and migrate with:

```ts
      const { db: opened, path } = await openAppDb();
      await migrate(opened, MIGRATIONS, { beforeUpgrade: (from) => backupBeforeUpgrade(opened, path, from) });
```

- [ ] **Step 7: Run the gates and commit**

Run: `npm test`, `npm run typecheck`, `npx expo export -p ios --output-dir dist`. Expected: all clean.

```bash
git add src/data/dbBackup.ts src/data/dbBackup.test.ts src/data/migrations.ts src/data/migrations.test.ts src/data/expoDb.ts src/state/AppData.tsx
git commit -m "feat(data): copy the database with VACUUM INTO before every migration

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Wardrobe schema, tag vocabulary and the items repository

**Files:**
- Create: `app/src/core/tags.ts`, `app/src/core/ids.ts`, `app/src/core/photo.ts`, `app/src/data/items.ts`
- Test: `app/src/core/tags.test.ts`, `app/src/core/ids.test.ts`, `app/src/core/photo.test.ts`, `app/src/data/items.test.ts`
- Modify: `app/src/data/migrations.ts` (append schema v2), `app/src/data/migrations.test.ts` (one new test)
- Modify: `app/src/ui/labels.ts` (Turkish names of the vocabulary)

**Interfaces:**
- Consumes: `Db`, `DbCalls`, `SqlParam`, `migrate`, `openMemoryDb`, `dbAtVersion` (Tasks 1–2).
- Produces:
  - `core/tags.ts`: `SLOTS`, `STATUSES`, `CHOSEN_STATUSES`, `SUBCATEGORIES`, `COLORS`, `MATERIALS`, `TEXTURES`, `PATTERNS`, `SILHOUETTES`, `SEASONS`, `DETAILS`, `CONDITIONS`, `PHOTO_KINDS`, `SCALE`; types `Slot`, `Status`, `ChosenStatus`, `Subcategory`, `Color`, `Material`, `Texture`, `Pattern`, `Silhouette`, `Season`, `Detail`, `Condition`, `PhotoKind`, `ItemPhotoKind`, `Scale`; `ItemTagsSchema`, `type ItemTags`
  - `core/ids.ts`: `ID_PATTERN`, `newId(now?: number, random?: () => number): string`
  - `core/photo.ts`: `CutoutState`, `FaceState`, `interface NewPhoto { id; kind: PhotoKind; originalExt: 'jpg' | 'png'; cutoutState; faceState }`, `initialPhotoStates(kind, hasAlpha)`
  - `data/items.ts`: `interface Item`, `interface Photo`, `createItemWithPhoto(db, tags, photo, now?) → Promise<string>`, `updateItem(db, id, tags, now?)`, `setItemStatus(db, id, status: ChosenStatus, now?)`, `getItem(db, id) → Item | null`, `listItems(db) → Item[]`, `getPhoto(db, id) → Photo | null`, `allPhotoIds(db) → Set<string>`
  - `ui/labels.ts`: `SLOT_TR`, `STATUS_TR`, `SUBCATEGORY_TR`, `COLOR_TR`, `MATERIAL_TR`, `TEXTURE_TR`, `PATTERN_TR`, `SILHOUETTE_TR`, `SEASON_TR`, `DETAIL_TR`, `CONDITION_TR`, `PHOTO_KIND_TR`, `PHOTO_KIND_HINT_TR`, `ITEM_PHOTO_KINDS`, `FORMALITY_TR`, `WARMTH_TR`, `CUTOUT_TR`

- [ ] **Step 1: Write the failing tests**

Create `app/src/core/tags.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ItemTagsSchema, SUBCATEGORIES, type ItemTags } from './tags';

const FULL: ItemTags = {
  slot: 'outer',
  subcategory: 'leather_jacket',
  colors: ['black'],
  material: 'leather',
  texture: 'leather',
  pattern: 'solid',
  silhouette: 'fitted',
  formality: 3,
  warmth: 3,
  seasons: ['autumn', 'spring'],
  details: ['exposed_zip', 'buckle'],
  brand: null,
  condition: 'good',
  price: 4500,
  notes: null,
};

const MINIMAL: ItemTags = {
  slot: 'top',
  subcategory: null,
  colors: [],
  material: null,
  texture: null,
  pattern: null,
  silhouette: null,
  formality: null,
  warmth: null,
  seasons: [],
  details: [],
  brand: null,
  condition: null,
  price: null,
  notes: null,
};

describe('ItemTagsSchema', () => {
  it('accepts a full set of tags and a slot alone', () => {
    expect(ItemTagsSchema.safeParse(FULL).success).toBe(true);
    expect(ItemTagsSchema.safeParse(MINIMAL).success).toBe(true);
  });

  it('refuses a subcategory of another slot', () => {
    expect(ItemTagsSchema.safeParse({ ...FULL, subcategory: 'jeans' }).success).toBe(false);
  });

  it('refuses scales outside 1 to 5, fractions and unknown values', () => {
    expect(ItemTagsSchema.safeParse({ ...FULL, formality: 6 }).success).toBe(false);
    expect(ItemTagsSchema.safeParse({ ...FULL, warmth: 2.5 }).success).toBe(false);
    expect(ItemTagsSchema.safeParse({ ...FULL, colors: ['teal'] }).success).toBe(false);
    expect(ItemTagsSchema.safeParse({ ...FULL, price: -1 }).success).toBe(false);
  });

  it('lists each subcategory under one slot only', () => {
    const all = Object.values(SUBCATEGORIES).flat();
    expect(new Set(all).size).toBe(all.length);
  });
});
```

Create `app/src/core/ids.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ID_PATTERN, newId } from './ids';

describe('newId', () => {
  it('makes ids the photo-folder check accepts, sorted by time', () => {
    const a = newId(1_700_000_000_000, () => 0.5);
    const b = newId(1_700_000_000_001, () => 0.5);
    expect(a).toMatch(ID_PATTERN);
    expect(a < b).toBe(true);
  });

  it('differs between two calls in the same millisecond', () => {
    expect(newId(1_700_000_000_000)).not.toBe(newId(1_700_000_000_000));
  });
});
```

Create `app/src/core/photo.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { initialPhotoStates } from './photo';

describe('initialPhotoStates', () => {
  it('waits for N1 to cut flat and hanger photos, and takes an image with alpha as already cut', () => {
    expect(initialPhotoStates('flat', false)).toEqual({ cutoutState: 'pending', faceState: 'n/a' });
    expect(initialPhotoStates('hanger', true)).toEqual({ cutoutState: 'done', faceState: 'n/a' });
  });

  it('never cuts worn or outfit photos, and only worn photos wait for a face check', () => {
    expect(initialPhotoStates('worn', false)).toEqual({ cutoutState: 'none', faceState: 'pending' });
    expect(initialPhotoStates('outfit', false)).toEqual({ cutoutState: 'none', faceState: 'n/a' });
  });
});
```

Create `app/src/data/items.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import type { NewPhoto } from '../core/photo';
import type { ItemTags } from '../core/tags';
import type { Db } from './db';
import { allPhotoIds, createItemWithPhoto, getItem, getPhoto, listItems, setItemStatus, updateItem } from './items';
import { migrate } from './migrations';
import { openMemoryDb } from './testing/nodeDb';

const TAGS: ItemTags = {
  slot: 'outer',
  subcategory: 'leather_jacket',
  colors: ['black'],
  material: 'leather',
  texture: 'leather',
  pattern: 'solid',
  silhouette: 'fitted',
  formality: 3,
  warmth: 3,
  seasons: ['autumn', 'spring'],
  details: ['exposed_zip', 'buckle'],
  brand: null,
  condition: 'good',
  price: 4500,
  notes: null,
};
const photo = (id: string): NewPhoto => ({ id, kind: 'hanger', originalExt: 'jpg', cutoutState: 'pending', faceState: 'n/a' });
const T0 = new Date('2026-10-28T09:00:00.000Z');
const T1 = new Date('2026-10-28T10:00:00.000Z');

let db: Db;
beforeEach(async () => {
  db = openMemoryDb();
  await migrate(db);
});

describe('items', () => {
  it('stores an item with its photo and reads every tag back', async () => {
    const id = await createItemWithPhoto(db, TAGS, photo('photo0001'), T0);
    expect(await getItem(db, id)).toEqual({
      ...TAGS,
      id,
      status: 'active',
      primaryPhotoId: 'photo0001',
      createdAt: T0.toISOString(),
      updatedAt: T0.toISOString(),
    });
    expect(await getPhoto(db, 'photo0001')).toEqual({ ...photo('photo0001'), itemId: id, createdAt: T0.toISOString() });
  });

  it('refuses a subcategory of another slot and writes nothing', async () => {
    await expect(createItemWithPhoto(db, { ...TAGS, subcategory: 'jeans' }, photo('photo0001'))).rejects.toThrow();
    expect(await db.all('SELECT id FROM items')).toEqual([]);
  });

  it('writes neither row when the photo row fails', async () => {
    await createItemWithPhoto(db, TAGS, photo('photo0001'), T0);
    await expect(createItemWithPhoto(db, TAGS, photo('photo0001'), T1)).rejects.toThrow();
    expect(await listItems(db)).toHaveLength(1);
  });

  it('replaces the tags on edit and keeps the creation time', async () => {
    const id = await createItemWithPhoto(db, TAGS, photo('photo0001'), T0);
    await updateItem(db, id, { ...TAGS, colors: ['charcoal'], brand: "Levi's", price: null }, T1);
    expect(await getItem(db, id)).toMatchObject({
      colors: ['charcoal'],
      brand: "Levi's",
      price: null,
      createdAt: T0.toISOString(),
      updatedAt: T1.toISOString(),
    });
  });

  it('changes the status, and lists newest first without drafts', async () => {
    const first = await createItemWithPhoto(db, TAGS, photo('photo0001'), T0);
    const second = await createItemWithPhoto(db, { ...TAGS, slot: 'shoes', subcategory: 'boots' }, photo('photo0002'), T1);
    await db.run("INSERT INTO items (id, status, created_at, updated_at) VALUES ('draft0001', 'draft', ?, ?)", [T1.toISOString(), T1.toISOString()]);
    await setItemStatus(db, first, 'archived', T1);
    expect((await listItems(db)).map((item) => [item.id, item.status])).toEqual([
      [second, 'active'],
      [first, 'archived'],
    ]);
  });

  it('lists every photo id for the launch sweep', async () => {
    await createItemWithPhoto(db, TAGS, photo('photo0001'));
    expect(await allPhotoIds(db)).toEqual(new Set(['photo0001']));
  });

  it('lets the schema refuse an active item without a slot and a photo of a missing item', async () => {
    await expect(db.run("INSERT INTO items (id, status, created_at, updated_at) VALUES ('item0001', 'active', 'x', 'x')")).rejects.toThrow(/CHECK/);
    await expect(
      db.run(
        "INSERT INTO photos (id, item_id, kind, original_ext, cutout_state, face_state, created_at) VALUES ('photo0009', 'missing1', 'flat', 'jpg', 'none', 'n/a', 'x')",
      ),
    ).rejects.toThrow(/FOREIGN KEY/);
  });
});
```

Add this test inside `describe('migrate', ...)` of `app/src/data/migrations.test.ts`:

```ts
  it('keeps the M0 settings when it adds the wardrobe tables (v1 to v2)', async () => {
    const db = await dbAtVersion(1, MIGRATIONS);
    await db.run('INSERT INTO settings (key, value) VALUES (?, ?)', ['theme_mode', '"light"']);
    await migrate(db);
    expect(await db.all('SELECT key, value FROM settings')).toEqual([{ key: 'theme_mode', value: '"light"' }]);
    expect(await db.all("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('items', 'photos') ORDER BY name")).toEqual([
      { name: 'items' },
      { name: 'photos' },
    ]);
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/core src/data`
Expected: FAIL (the new modules do not exist; there is no `items` table).

- [ ] **Step 3: Write the vocabulary**

Create `app/src/core/tags.ts`:

```ts
import { z } from 'zod';

/** Where an item sits in an outfit. The first six are the recommender's slots; accessory and headwear are kept but not suggested (spec §8, §14). */
export const SLOTS = ['top', 'mid', 'bottom', 'onepiece', 'shoes', 'outer', 'accessory', 'headwear'] as const;
export type Slot = (typeof SLOTS)[number];

/** An item's life: drafts wait for review (M2), laundry and archived stay out of suggestions, wishlist is not owned yet. */
export const STATUSES = ['draft', 'active', 'laundry', 'archived', 'wishlist'] as const;
export type Status = (typeof STATUSES)[number];

/** The statuses a person sets by hand; `draft` belongs to the tagging queue (M2). */
export const CHOSEN_STATUSES = ['active', 'laundry', 'archived', 'wishlist'] as const satisfies readonly Status[];
export type ChosenStatus = (typeof CHOSEN_STATUSES)[number];

/** Subcategories per slot. Short on purpose: the tagging prompt (M2) offers exactly these. */
export const SUBCATEGORIES = {
  top: ['tshirt', 'tank', 'longsleeve', 'shirt', 'polo', 'blouse', 'sweatshirt', 'hoodie', 'sweater', 'turtleneck'],
  mid: ['cardigan', 'zip_hoodie', 'overshirt', 'vest', 'blazer'],
  bottom: ['jeans', 'trousers', 'chinos', 'cargo', 'joggers', 'shorts', 'skirt', 'leggings'],
  onepiece: ['dress', 'jumpsuit', 'overalls'],
  shoes: ['boots', 'chelsea_boots', 'combat_boots', 'sneakers', 'loafers', 'derby', 'sandals', 'heels'],
  outer: ['leather_jacket', 'denim_jacket', 'bomber', 'trench', 'coat', 'parka', 'puffer', 'raincoat'],
  accessory: ['belt', 'bag', 'scarf', 'gloves', 'jewelry', 'watch', 'sunglasses', 'tie'],
  headwear: ['cap', 'beanie', 'hat', 'bandana'],
} as const satisfies Record<Slot, readonly string[]>;
export type Subcategory = (typeof SUBCATEGORIES)[Slot][number];

/** Every subcategory of every slot, for the schema. */
const ALL_SUBCATEGORIES = Object.values(SUBCATEGORIES).flat() as readonly Subcategory[];

/** Named colours. Dark shades are split finely because the wardrobe is mostly dark (spec §1). */
export const COLORS = [
  'black', 'charcoal', 'grey', 'white', 'cream', 'beige', 'brown', 'navy', 'blue', 'green',
  'olive', 'burgundy', 'red', 'pink', 'purple', 'yellow', 'orange', 'silver', 'gold',
] as const;
export type Color = (typeof COLORS)[number];

/** Fibres and hides. Suede, nubuck, canvas and mesh matter for the rain rule (spec §8). */
export const MATERIALS = [
  'cotton', 'denim', 'leather', 'faux_leather', 'suede', 'nubuck', 'wool', 'cashmere', 'linen', 'silk',
  'polyester', 'nylon', 'viscose', 'canvas', 'mesh', 'fleece', 'corduroy', 'velvet', 'rubber',
] as const;
export type Material = (typeof MATERIALS)[number];

/** Texture families: the recommender counts the distinct families in an outfit (spec §8, `texture`). */
export const TEXTURES = ['smooth', 'knit', 'ribbed', 'denim', 'leather', 'suede', 'corduroy', 'fleece', 'quilted', 'satin', 'mesh', 'velvet'] as const;
export type Texture = (typeof TEXTURES)[number];

/** Surface patterns; `graphic` is forbidden at work (spec §8). */
export const PATTERNS = ['solid', 'graphic', 'logo', 'striped', 'checked', 'floral', 'animal', 'camo'] as const;
export type Pattern = (typeof PATTERNS)[number];

/** Fit, tightest first; the recommender pairs fitted with loose (spec §8, `silhouette`). */
export const SILHOUETTES = ['fitted', 'regular', 'relaxed', 'oversized'] as const;
export type Silhouette = (typeof SILHOUETTES)[number];

/** Seasons an item is worn in; none means all of them (spec §8 season filter). */
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export type Season = (typeof SEASONS)[number];

/** Details the rules read: hardware (weights in spec §8), damage (forbidden at work), open toes (rain), hoods. */
export const DETAILS = ['exposed_zip', 'd_ring', 'eyelet', 'buckle', 'grommets', 'chain', 'studs', 'spikes', 'ripped', 'distressed', 'open_toe', 'hood'] as const;
export type Detail = (typeof DETAILS)[number];

/** Visible wear, best first (spec §5). */
export const CONDITIONS = ['new_with_tags', 'like_new', 'good', 'worn', 'poor'] as const;
export type Condition = (typeof CONDITIONS)[number];

/** How a photo was taken: laid flat, on a hanger, worn (a fit photo), or a whole outfit (M3). */
export const PHOTO_KINDS = ['flat', 'hanger', 'worn', 'outfit'] as const;
export type PhotoKind = (typeof PHOTO_KINDS)[number];
/** The kinds a new item's photo can be; outfit photos belong to outfits. */
export type ItemPhotoKind = Exclude<PhotoKind, 'outfit'>;

/** The 1-to-5 scale of formality (beachwear to a suit) and warmth (a tank top to a down coat). */
export const SCALE = [1, 2, 3, 4, 5] as const;
export type Scale = (typeof SCALE)[number];

/** The tags a person (M1) or the tagging call (M2) fills. Only `slot` is required; lists may be empty. */
export const ItemTagsSchema = z
  .object({
    slot: z.enum(SLOTS),
    subcategory: z.enum(ALL_SUBCATEGORIES as readonly [Subcategory, ...Subcategory[]]).nullable(),
    // Four colours describe any garment; more is a pattern.
    colors: z.array(z.enum(COLORS)).max(4),
    material: z.enum(MATERIALS).nullable(),
    texture: z.enum(TEXTURES).nullable(),
    pattern: z.enum(PATTERNS).nullable(),
    silhouette: z.enum(SILHOUETTES).nullable(),
    formality: z.number().int().min(1).max(5).nullable(),
    warmth: z.number().int().min(1).max(5).nullable(),
    seasons: z.array(z.enum(SEASONS)),
    details: z.array(z.enum(DETAILS)),
    // Brand names are short; 60 characters stops a pasted paragraph.
    brand: z.string().trim().min(1).max(60).nullable(),
    condition: z.enum(CONDITIONS).nullable(),
    // TRY; a million is far above any garment and catches a typo with extra zeros.
    price: z.number().nonnegative().max(1_000_000).nullable(),
    // A few sentences at most.
    notes: z.string().max(500).nullable(),
  })
  .refine((t) => t.subcategory === null || (SUBCATEGORIES[t.slot] as readonly string[]).includes(t.subcategory), {
    message: 'subcategory does not belong to slot',
    path: ['subcategory'],
  });
export type ItemTags = z.infer<typeof ItemTagsSchema>;
```

- [ ] **Step 4: Write ids and photo states**

Create `app/src/core/ids.ts`:

```ts
/** Ids of items and photos; also the folder names a backup may contain (spec §5), so never `.` or `/`. */
export const ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

/** Random base-36 characters after the time: enough that two ids made in one millisecond never meet. */
const RANDOM_CHARS = 10;

/**
 * A new id: the time in base 36 first, so ids sort by creation (8 characters until the year 2059), then random
 * characters. Not secret, only unique.
 */
export function newId(now: number = Date.now(), random: () => number = Math.random): string {
  let tail = '';
  while (tail.length < RANDOM_CHARS) tail += Math.floor(random() * 36).toString(36);
  return `${now.toString(36)}${tail}`;
}
```

Create `app/src/core/photo.ts`:

```ts
import type { PhotoKind } from './tags';

/** Background removal: `done` once the stored display image is a cut-out, `pending` until N1 can make one, `none` never, `failed` when Vision found no subject. */
export type CutoutState = 'none' | 'pending' | 'done' | 'failed';

/** Redaction of faces in the image sent for tagging (spec §7); only worn photos need it. */
export type FaceState = 'n/a' | 'pending' | 'filled' | 'none_found' | 'confirmed';

/** A photo whose files are on disk and whose row is about to be written. */
export interface NewPhoto {
  id: string;
  kind: PhotoKind;
  originalExt: 'jpg' | 'png';
  cutoutState: CutoutState;
  faceState: FaceState;
}

/** The states a new photo starts in. An image that already has alpha is a cut-out; worn and outfit photos are never cut (spec §6). */
export function initialPhotoStates(kind: PhotoKind, hasAlpha: boolean): Pick<NewPhoto, 'cutoutState' | 'faceState'> {
  const neverCut = kind === 'worn' || kind === 'outfit';
  return {
    cutoutState: hasAlpha ? 'done' : neverCut ? 'none' : 'pending',
    faceState: kind === 'worn' ? 'pending' : 'n/a',
  };
}
```

- [ ] **Step 5: Add schema v2**

In `app/src/data/migrations.ts`, append a second entry to `MIGRATIONS` (after the settings entry, inside the array):

```ts
  // M1a: wardrobe items and their photos (spec §5). Tables of later milestones arrive with them.
  `CREATE TABLE items (
     id TEXT PRIMARY KEY,
     status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'laundry', 'archived', 'wishlist')),
     slot TEXT CHECK (slot IN ('top', 'mid', 'bottom', 'onepiece', 'shoes', 'outer', 'accessory', 'headwear')),
     subcategory TEXT,
     colors TEXT NOT NULL DEFAULT '[]',
     material TEXT,
     texture TEXT,
     pattern TEXT,
     silhouette TEXT CHECK (silhouette IN ('fitted', 'regular', 'relaxed', 'oversized')),
     formality INTEGER CHECK (formality BETWEEN 1 AND 5),
     warmth INTEGER CHECK (warmth BETWEEN 1 AND 5),
     seasons TEXT NOT NULL DEFAULT '[]',
     details TEXT NOT NULL DEFAULT '[]',
     notes TEXT,
     brand TEXT,
     condition TEXT CHECK (condition IN ('new_with_tags', 'like_new', 'good', 'worn', 'poor')),
     condition_notes TEXT,
     resale TEXT,
     ai_fields TEXT NOT NULL DEFAULT '[]',
     price REAL,
     acquired_at TEXT,
     primary_photo_id TEXT,
     tag_source TEXT CHECK (tag_source IN ('ai', 'manual')),
     tag_model TEXT,
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL,
     CHECK (slot IS NOT NULL OR status = 'draft')
   );
   CREATE TABLE photos (
     id TEXT PRIMARY KEY,
     item_id TEXT REFERENCES items(id) ON DELETE CASCADE,
     outfit_id TEXT,
     kind TEXT NOT NULL CHECK (kind IN ('flat', 'hanger', 'worn', 'outfit')),
     original_ext TEXT NOT NULL CHECK (original_ext IN ('jpg', 'png')),
     cutout_state TEXT NOT NULL CHECK (cutout_state IN ('none', 'pending', 'done', 'failed')),
     face_state TEXT NOT NULL CHECK (face_state IN ('n/a', 'pending', 'filled', 'none_found', 'confirmed')),
     created_at TEXT NOT NULL
   );
   CREATE INDEX photos_item_id ON photos (item_id);`,
```

- [ ] **Step 6: Write the items repository**

Create `app/src/data/items.ts`:

```ts
import { newId } from '../core/ids';
import type { NewPhoto } from '../core/photo';
import { ItemTagsSchema, type ChosenStatus, type ItemTags, type Slot, type Status } from '../core/tags';
import type { Db, DbCalls, SqlParam } from './db';

/** An item as the screens read it. Columns the M2 tagging fills (`resale`, `ai_fields`, ...) are not read yet. */
export interface Item extends Omit<ItemTags, 'slot'> {
  id: string;
  status: Status;
  /** Null only while the item is a draft (M2). */
  slot: Slot | null;
  primaryPhotoId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A photo row (spec §5). */
export interface Photo extends NewPhoto {
  itemId: string | null;
  createdAt: string;
}

/** The tag columns, in the order `tagParams` returns their values. */
const TAG_COLUMNS = [
  'slot', 'subcategory', 'colors', 'material', 'texture', 'pattern', 'silhouette', 'formality',
  'warmth', 'seasons', 'details', 'notes', 'brand', 'condition', 'price',
] as const;

/** Every column `toItem` reads. */
const ITEM_SELECT = `SELECT id, status, ${TAG_COLUMNS.join(', ')}, primary_photo_id, created_at, updated_at FROM items`;

interface ItemRow {
  id: string;
  status: Status;
  slot: Slot | null;
  subcategory: ItemTags['subcategory'];
  colors: string;
  material: ItemTags['material'];
  texture: ItemTags['texture'];
  pattern: ItemTags['pattern'];
  silhouette: ItemTags['silhouette'];
  formality: number | null;
  warmth: number | null;
  seasons: string;
  details: string;
  notes: string | null;
  brand: string | null;
  condition: ItemTags['condition'];
  price: number | null;
  primary_photo_id: string | null;
  created_at: string;
  updated_at: string;
}

interface PhotoRow {
  id: string;
  item_id: string | null;
  kind: Photo['kind'];
  original_ext: Photo['originalExt'];
  cutout_state: Photo['cutoutState'];
  face_state: Photo['faceState'];
  created_at: string;
}

function tagParams(t: ItemTags): SqlParam[] {
  return [
    t.slot, t.subcategory, JSON.stringify(t.colors), t.material, t.texture, t.pattern, t.silhouette, t.formality,
    t.warmth, JSON.stringify(t.seasons), JSON.stringify(t.details), t.notes, t.brand, t.condition, t.price,
  ];
}

// Rows come from this app's own writes, checked by the schema's CHECK constraints, so the casts in the row types hold.
function toItem(r: ItemRow): Item {
  return {
    id: r.id,
    status: r.status,
    slot: r.slot,
    subcategory: r.subcategory,
    colors: JSON.parse(r.colors),
    material: r.material,
    texture: r.texture,
    pattern: r.pattern,
    silhouette: r.silhouette,
    formality: r.formality,
    warmth: r.warmth,
    seasons: JSON.parse(r.seasons),
    details: JSON.parse(r.details),
    notes: r.notes,
    brand: r.brand,
    condition: r.condition,
    price: r.price,
    primaryPhotoId: r.primary_photo_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Adds an active item with its primary photo, both rows in one transaction (spec §6: files first, then rows). Returns the item id. */
export async function createItemWithPhoto(db: Db, tags: ItemTags, photo: NewPhoto, now: Date = new Date()): Promise<string> {
  const valid = ItemTagsSchema.parse(tags);
  const id = newId(now.getTime());
  const at = now.toISOString();
  await db.transaction(async (tx) => {
    await tx.run(
      `INSERT INTO items (id, status, ${TAG_COLUMNS.join(', ')}, primary_photo_id, tag_source, created_at, updated_at)
       VALUES (?, 'active', ${TAG_COLUMNS.map(() => '?').join(', ')}, ?, 'manual', ?, ?)`,
      [id, ...tagParams(valid), photo.id, at, at],
    );
    await insertPhoto(tx, photo, id, at);
  });
  return id;
}

async function insertPhoto(tx: DbCalls, photo: NewPhoto, itemId: string, at: string): Promise<void> {
  await tx.run(
    'INSERT INTO photos (id, item_id, kind, original_ext, cutout_state, face_state, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [photo.id, itemId, photo.kind, photo.originalExt, photo.cutoutState, photo.faceState, at],
  );
}

/** Replaces an item's tags. Throws when there is no such item. */
export async function updateItem(db: Db, id: string, tags: ItemTags, now: Date = new Date()): Promise<void> {
  const valid = ItemTagsSchema.parse(tags);
  const { changes } = await db.run(`UPDATE items SET ${TAG_COLUMNS.map((c) => `${c} = ?`).join(', ')}, updated_at = ? WHERE id = ?`, [
    ...tagParams(valid),
    now.toISOString(),
    id,
  ]);
  if (changes === 0) throw new Error(`No item ${id}`);
}

/** Sets a status a person chooses. Throws when there is no such item, or it is still a draft. */
export async function setItemStatus(db: Db, id: string, status: ChosenStatus, now: Date = new Date()): Promise<void> {
  const { changes } = await db.run("UPDATE items SET status = ?, updated_at = ? WHERE id = ? AND status != 'draft'", [status, now.toISOString(), id]);
  if (changes === 0) throw new Error(`No item ${id}`);
}

export async function getItem(db: Db, id: string): Promise<Item | null> {
  const row = await db.first<ItemRow>(`${ITEM_SELECT} WHERE id = ?`, [id]);
  return row === null ? null : toItem(row);
}

/** Every item that is not a draft, newest first. The grid filters in memory: a wardrobe is a few hundred rows. */
export async function listItems(db: Db): Promise<Item[]> {
  const rows = await db.all<ItemRow>(`${ITEM_SELECT} WHERE status != 'draft' ORDER BY created_at DESC, id DESC`);
  return rows.map(toItem);
}

export async function getPhoto(db: Db, id: string): Promise<Photo | null> {
  const r = await db.first<PhotoRow>('SELECT id, item_id, kind, original_ext, cutout_state, face_state, created_at FROM photos WHERE id = ?', [id]);
  if (r === null) return null;
  return {
    id: r.id,
    itemId: r.item_id,
    kind: r.kind,
    originalExt: r.original_ext,
    cutoutState: r.cutout_state,
    faceState: r.face_state,
    createdAt: r.created_at,
  };
}

/** The id of every photo row; the launch sweep keeps exactly these folders. */
export async function allPhotoIds(db: Db): Promise<Set<string>> {
  const rows = await db.all<{ id: string }>('SELECT id FROM photos');
  return new Set(rows.map((r) => r.id));
}
```

- [ ] **Step 7: Run the tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 8: Name the vocabulary in Turkish**

In `app/src/ui/labels.ts`, add this import below the existing one:

```ts
import type { CutoutState } from '../core/photo';
import type {
  ChosenStatus, Color, Condition, Detail, ItemPhotoKind, Material, Pattern, PhotoKind, Scale, Season,
  Silhouette, Slot, Status, Subcategory, Texture,
} from '../core/tags';
```

and append at the end of the file:

```ts
/** The name of each slot. */
export const SLOT_TR: Record<Slot, string> = {
  top: 'Üst',
  mid: 'Ara katman',
  bottom: 'Alt',
  onepiece: 'Tek parça',
  shoes: 'Ayakkabı',
  outer: 'Dış giyim',
  accessory: 'Aksesuar',
  headwear: 'Başlık',
};

/** The name of each status. */
export const STATUS_TR: Record<Status, string> = {
  draft: 'Taslak',
  active: 'Aktif',
  laundry: 'Çamaşırda',
  archived: 'Arşivde',
  wishlist: 'İstek listesi',
};

/** The name of each subcategory. */
export const SUBCATEGORY_TR: Record<Subcategory, string> = {
  tshirt: 'Tişört',
  tank: 'Atlet',
  longsleeve: 'Uzun kollu',
  shirt: 'Gömlek',
  polo: 'Polo',
  blouse: 'Bluz',
  sweatshirt: 'Sweatshirt',
  hoodie: 'Kapüşonlu',
  sweater: 'Kazak',
  turtleneck: 'Balıkçı yaka',
  cardigan: 'Hırka',
  zip_hoodie: 'Fermuarlı kapüşonlu',
  overshirt: 'Gömlek ceket',
  vest: 'Yelek',
  blazer: 'Blazer',
  jeans: 'Kot pantolon',
  trousers: 'Kumaş pantolon',
  chinos: 'Chino',
  cargo: 'Kargo',
  joggers: 'Eşofman altı',
  shorts: 'Şort',
  skirt: 'Etek',
  leggings: 'Tayt',
  dress: 'Elbise',
  jumpsuit: 'Tulum',
  overalls: 'Salopet',
  boots: 'Bot',
  chelsea_boots: 'Chelsea bot',
  combat_boots: 'Postal',
  sneakers: 'Spor ayakkabı',
  loafers: 'Loafer',
  derby: 'Derby',
  sandals: 'Sandalet',
  heels: 'Topuklu',
  leather_jacket: 'Deri ceket',
  denim_jacket: 'Kot ceket',
  bomber: 'Bomber',
  trench: 'Trençkot',
  coat: 'Kaban',
  parka: 'Parka',
  puffer: 'Şişme mont',
  raincoat: 'Yağmurluk',
  belt: 'Kemer',
  bag: 'Çanta',
  scarf: 'Atkı',
  gloves: 'Eldiven',
  jewelry: 'Takı',
  watch: 'Saat',
  sunglasses: 'Güneş gözlüğü',
  tie: 'Kravat',
  cap: 'Kep',
  beanie: 'Bere',
  hat: 'Şapka',
  bandana: 'Bandana',
};

/** The name of each colour. */
export const COLOR_TR: Record<Color, string> = {
  black: 'Siyah',
  charcoal: 'Antrasit',
  grey: 'Gri',
  white: 'Beyaz',
  cream: 'Krem',
  beige: 'Bej',
  brown: 'Kahverengi',
  navy: 'Lacivert',
  blue: 'Mavi',
  green: 'Yeşil',
  olive: 'Haki',
  burgundy: 'Bordo',
  red: 'Kırmızı',
  pink: 'Pembe',
  purple: 'Mor',
  yellow: 'Sarı',
  orange: 'Turuncu',
  silver: 'Gümüş',
  gold: 'Altın',
};

/** The name of each material. */
export const MATERIAL_TR: Record<Material, string> = {
  cotton: 'Pamuk',
  denim: 'Denim',
  leather: 'Deri',
  faux_leather: 'Suni deri',
  suede: 'Süet',
  nubuck: 'Nubuk',
  wool: 'Yün',
  cashmere: 'Kaşmir',
  linen: 'Keten',
  silk: 'İpek',
  polyester: 'Polyester',
  nylon: 'Naylon',
  viscose: 'Viskon',
  canvas: 'Kanvas',
  mesh: 'File',
  fleece: 'Polar',
  corduroy: 'Fitilli kadife',
  velvet: 'Kadife',
  rubber: 'Kauçuk',
};

/** The name of each texture family. */
export const TEXTURE_TR: Record<Texture, string> = {
  smooth: 'Pürüzsüz',
  knit: 'Örgü',
  ribbed: 'Ribana',
  denim: 'Denim',
  leather: 'Deri',
  suede: 'Süet',
  corduroy: 'Fitilli kadife',
  fleece: 'Polar',
  quilted: 'Kapitone',
  satin: 'Saten',
  mesh: 'File',
  velvet: 'Kadife',
};

/** The name of each pattern. */
export const PATTERN_TR: Record<Pattern, string> = {
  solid: 'Düz',
  graphic: 'Baskılı',
  logo: 'Logolu',
  striped: 'Çizgili',
  checked: 'Kareli',
  floral: 'Çiçekli',
  animal: 'Hayvan deseni',
  camo: 'Kamuflaj',
};

/** The name of each fit. */
export const SILHOUETTE_TR: Record<Silhouette, string> = {
  fitted: 'Dar',
  regular: 'Normal',
  relaxed: 'Rahat',
  oversized: 'Oversize',
};

/** The name of each season. */
export const SEASON_TR: Record<Season, string> = {
  spring: 'İlkbahar',
  summer: 'Yaz',
  autumn: 'Sonbahar',
  winter: 'Kış',
};

/** The name of each detail. */
export const DETAIL_TR: Record<Detail, string> = {
  exposed_zip: 'Açık fermuar',
  d_ring: 'D halka',
  eyelet: 'Kuşgözü',
  buckle: 'Toka',
  grommets: 'Büyük kuşgözü',
  chain: 'Zincir',
  studs: 'Zımba',
  spikes: 'Sivri zımba',
  ripped: 'Yırtık',
  distressed: 'Eskitme',
  open_toe: 'Açık burun',
  hood: 'Kapüşon',
};

/** The name of each condition. */
export const CONDITION_TR: Record<Condition, string> = {
  new_with_tags: 'Etiketli yeni',
  like_new: 'Yeni gibi',
  good: 'İyi',
  worn: 'Yıpranmış',
  poor: 'Kötü',
};

/** The name of each photo kind. */
export const PHOTO_KIND_TR: Record<PhotoKind, string> = {
  flat: 'Zeminde',
  hanger: 'Askıda',
  worn: 'Üstümde',
  outfit: 'Kombin',
};

/** One line under each kind on the add screen. */
export const PHOTO_KIND_HINT_TR: Record<ItemPhotoKind, string> = {
  flat: 'düz bir zemine serili',
  hanger: 'askıda asılı',
  worn: 'üstümde, aynada',
};

/** The kinds the add screen offers, in its order. */
export const ITEM_PHOTO_KINDS: readonly ItemPhotoKind[] = ['flat', 'hanger', 'worn'];

/** Formality, 1 to 5. */
export const FORMALITY_TR: Record<Scale, string> = {
  1: 'Çok rahat',
  2: 'Rahat',
  3: 'Smart casual',
  4: 'Şık',
  5: 'Resmî',
};

/** Warmth, 1 to 5. */
export const WARMTH_TR: Record<Scale, string> = {
  1: 'Çok ince',
  2: 'İnce',
  3: 'Orta',
  4: 'Sıcak',
  5: 'Çok sıcak',
};

/** What happened to a photo's background, for the item screen. */
export const CUTOUT_TR: Record<CutoutState, string> = {
  none: 'Arka plan temizlenmeyecek',
  pending: 'Arka plan sonra temizlenecek',
  done: 'Arka plan şeffaf',
  failed: 'Arka plan temizlenemedi',
};

/** Statuses as the item screen and the filter list them. */
export const CHOSEN_STATUS_TR: Record<ChosenStatus, string> = STATUS_TR;
```

- [ ] **Step 9: Run the gates and commit**

Run: `npm test`, `npm run typecheck`, `npx expo export -p ios --output-dir dist`. Expected: all clean.

```bash
git add src/core src/data/items.ts src/data/items.test.ts src/data/migrations.ts src/data/migrations.test.ts src/ui/labels.ts
git commit -m "feat(data): wardrobe schema v2, tag vocabulary and the items repository

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Photo files: alpha check, crash-safe writing, the launch sweep and the picker

Spec §6 "Input", "Alpha check", "Resize and encode", "Crash safety".

**Files:**
- Create: `app/src/media/images.ts`, `app/src/media/layout.ts` (pure)
- Test: `app/src/media/images.test.ts`, `app/src/media/layout.test.ts`
- Create: `app/src/media/photoFiles.ts`, `app/src/media/pipeline.ts`, `app/src/media/pick.ts` (Expo; no tests)

**Interfaces:**
- Consumes: `ID_PATTERN`, `newId` (`core/ids`), `NewPhoto`, `initialPhotoStates` (`core/photo`), `ItemPhotoKind` (`core/tags`), `allPhotoIds` (`data/items`), `Db`.
- Produces:
  - `images.ts`: `HEAD_BYTES`, `type ImageType = 'png' | 'jpeg' | 'other'`, `sniffImageType(head)`, `pngHasAlpha(head)`
  - `layout.ts`: `STAGING_SUFFIX`, `DISPLAY_FILE`, `THUMB_FILE`, `originalFile(ext)`, `interface SweepPlan { staging: string[]; orphans: string[]; keptOrphans: number }`, `planSweep(folders, photoIds)`
  - `photoFiles.ts`: `photosRoot()`, `photoDir(id)`, `stagingDir(id)`, `displayUri(photoId)`, `thumbUri(photoId)`, `deletePhotoDir(id)`, `sweepPhotos(db): Promise<SweepPlan | null>`
  - `pipeline.ts`: `class LowStorageError`, `preparePhoto(asset: ImagePickerAsset, kind: ItemPhotoKind): Promise<NewPhoto>`
  - `pick.ts`: `type PhotoSource = 'camera' | 'library'`, `class PermissionDeniedError`, `pickPhoto(source): Promise<ImagePickerAsset | null>`

- [ ] **Step 1: Write the failing tests**

Create `app/src/media/images.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { pngHasAlpha, sniffImageType } from './images';

/** A PNG chunk: length, type, data and a zero CRC (the check never reads CRCs). */
function chunk(type: string, data: number[] = []): number[] {
  const n = data.length;
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255, ...Array.from(type, (c) => c.charCodeAt(0)), ...data, 0, 0, 0, 0];
}

/** A 1×1 PNG of `colorType`, with `before` chunks ahead of the image data and `after` chunks behind it. */
function png(colorType: number, before: number[][] = [], after: number[][] = []): Uint8Array {
  const ihdr = [0, 0, 0, 1, 0, 0, 0, 1, 8, colorType, 0, 0, 0];
  return new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...chunk('IHDR', ihdr),
    ...before.flat(),
    ...chunk('IDAT', [0]),
    ...after.flat(),
    ...chunk('IEND'),
  ]);
}

describe('sniffImageType', () => {
  it('tells PNG and JPEG from their first bytes', () => {
    expect(sniffImageType(png(2))).toBe('png');
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpeg');
    expect(sniffImageType(new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70]))).toBe('other');
  });
});

describe('pngHasAlpha', () => {
  it('sees alpha in RGBA and in grey + alpha', () => {
    expect(pngHasAlpha(png(6))).toBe(true);
    expect(pngHasAlpha(png(4))).toBe(true);
  });

  it('sees no alpha in plain grey, RGB or palette images', () => {
    for (const colorType of [0, 2, 3]) expect(pngHasAlpha(png(colorType))).toBe(false);
  });

  it('sees alpha in a tRNS chunk before the image data', () => {
    expect(pngHasAlpha(png(2, [chunk('tRNS', [0, 0, 0, 0, 0, 0])]))).toBe(true);
    expect(pngHasAlpha(png(3, [chunk('PLTE', [0, 0, 0]), chunk('tRNS', [0])]))).toBe(true);
  });

  it('ignores a tRNS chunk after the image data', () => {
    expect(pngHasAlpha(png(2, [], [chunk('tRNS', [0, 0, 0, 0, 0, 0])]))).toBe(false);
  });

  it('answers no for a JPEG and for a head cut short', () => {
    expect(pngHasAlpha(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(false);
    expect(pngHasAlpha(png(6).slice(0, 20))).toBe(false);
  });
});
```

Create `app/src/media/layout.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { planSweep } from './layout';

describe('planSweep', () => {
  it('deletes staging folders and orphans, and keeps folders that have a row', () => {
    expect(planSweep(['keep0001', 'half0001.tmp', 'lost0001'], new Set(['keep0001']))).toEqual({
      staging: ['half0001.tmp'],
      orphans: ['lost0001'],
      keptOrphans: 0,
    });
  });

  it('keeps every orphan when there are more than crashes could leave', () => {
    const folders = ['lost0001', 'lost0002', 'lost0003', 'lost0004', 'lost0005', 'lost0006'];
    expect(planSweep(folders, new Set())).toEqual({ staging: [], orphans: [], keptOrphans: 6 });
  });

  it('never touches a folder whose name is not a photo id', () => {
    expect(planSweep(['.hidden', 'short', 'a b c d e f', 'x/y.tmp'], new Set())).toEqual({ staging: [], orphans: [], keptOrphans: 0 });
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/media`
Expected: FAIL (`./images` and `./layout` do not exist).

- [ ] **Step 3: Write the byte checks**

Create `app/src/media/images.ts`:

```ts
/** The 8-byte PNG signature. */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
/** A JPEG starts with its SOI marker. */
const JPEG_SOI = [0xff, 0xd8] as const;
/** Where the IHDR colour type sits: signature 8 + length 4 + "IHDR" 4 + width 4 + height 4 + bit depth 1. */
const IHDR_COLOR_TYPE_OFFSET = 25;
/** PNG colour types with an alpha channel: grey + alpha (4) and RGBA (6). */
const ALPHA_COLOR_TYPES: ReadonlySet<number> = new Set([4, 6]);
/** Length, type and CRC around each PNG chunk's data. */
const CHUNK_OVERHEAD = 12;

/** How much of a file the alpha check reads. The chunks before the image data are small; 64 KB holds them in practice. */
export const HEAD_BYTES = 64 * 1024;

export type ImageType = 'png' | 'jpeg' | 'other';

/** The format, from the first bytes. HEIC and everything else are `other` (treated as opaque until N1, spec §6). */
export function sniffImageType(head: Uint8Array): ImageType {
  if (startsWith(head, PNG_SIGNATURE)) return 'png';
  if (startsWith(head, JPEG_SOI)) return 'jpeg';
  return 'other';
}

/** Whether a PNG's head says it is transparent: an alpha colour type, or a `tRNS` chunk before the image data. */
export function pngHasAlpha(head: Uint8Array): boolean {
  if (sniffImageType(head) !== 'png' || head.length <= IHDR_COLOR_TYPE_OFFSET) return false;
  if (ALPHA_COLOR_TYPES.has(head[IHDR_COLOR_TYPE_OFFSET])) return true;
  let at = PNG_SIGNATURE.length;
  while (at + 8 <= head.length) {
    const length = ((head[at] << 24) | (head[at + 1] << 16) | (head[at + 2] << 8) | head[at + 3]) >>> 0;
    const type = String.fromCharCode(head[at + 4], head[at + 5], head[at + 6], head[at + 7]);
    if (type === 'tRNS') return true;
    if (type === 'IDAT' || type === 'IEND') return false;
    at += CHUNK_OVERHEAD + length;
  }
  return false;
}

function startsWith(bytes: Uint8Array, prefix: readonly number[]): boolean {
  return bytes.length >= prefix.length && prefix.every((b, i) => bytes[i] === b);
}
```

- [ ] **Step 4: Write the folder layout and the sweep plan**

Create `app/src/media/layout.ts`:

```ts
import { ID_PATTERN } from '../core/ids';

/** Suffix of a photo folder still being written; it is renamed away when the files are complete (spec §6). */
export const STAGING_SUFFIX = '.tmp';
/** The image the item screen shows: 1024 px, a cut-out when there is one. If WEBP loses alpha on the phone (spec §13), this and `THUMB_FILE` become `.png` together with `PREVIEW_FORMAT` in `pipeline.ts`. */
export const DISPLAY_FILE = 'display.webp';
/** The grid image: 300 px. */
export const THUMB_FILE = 'thumb.webp';
/** At most this many orphan folders are deleted per launch. A crash leaves one; more means the database is not the one these photos belong to (a wrong restore), and deleting would lose photos. */
const ORPHAN_DELETE_LIMIT = 5;

/** The kept original's file name: PNG when it carries alpha, else JPEG. */
export function originalFile(ext: 'jpg' | 'png'): string {
  return `original.${ext}`;
}

export interface SweepPlan {
  /** Staging folders a crash left behind. */
  staging: string[];
  /** Complete folders no photo row points at. */
  orphans: string[];
  /** Orphans kept because there were too many to be crash leftovers. */
  keptOrphans: number;
}

/** Which photo folders to delete, from the folder names on disk and the photo ids in the database. Names that are not ids are never touched. */
export function planSweep(folders: readonly string[], photoIds: ReadonlySet<string>): SweepPlan {
  const staging = folders.filter((name) => name.endsWith(STAGING_SUFFIX) && ID_PATTERN.test(name.slice(0, -STAGING_SUFFIX.length)));
  const orphans = folders.filter((name) => ID_PATTERN.test(name) && !photoIds.has(name));
  const tooMany = orphans.length > ORPHAN_DELETE_LIMIT;
  return { staging, orphans: tooMany ? [] : orphans, keptOrphans: tooMany ? orphans.length : 0 };
}
```

- [ ] **Step 5: Run the tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Write the file side**

Create `app/src/media/photoFiles.ts`:

```ts
import { Directory, File, Paths } from 'expo-file-system';
import type { Db } from '../data/db';
import { allPhotoIds } from '../data/items';
import { DISPLAY_FILE, planSweep, STAGING_SUFFIX, THUMB_FILE, type SweepPlan } from './layout';

/** `<documents>/photos`, one folder per photo named by its id (spec §5). Documents survive updates; the cache does not. */
export function photosRoot(): Directory {
  return new Directory(Paths.document, 'photos');
}

export function photoDir(id: string): Directory {
  return new Directory(photosRoot(), id);
}

/** Where a photo's files are written before the folder is renamed to `photoDir(id)`. */
export function stagingDir(id: string): Directory {
  return new Directory(photosRoot(), `${id}${STAGING_SUFFIX}`);
}

export function displayUri(photoId: string): string {
  return new File(photoDir(photoId), DISPLAY_FILE).uri;
}

export function thumbUri(photoId: string): string {
  return new File(photoDir(photoId), THUMB_FILE).uri;
}

/** Deletes a photo's folder if it is there. */
export function deletePhotoDir(id: string): void {
  const dir = photoDir(id);
  if (dir.exists) dir.delete();
}

/** Deletes leftover staging folders and folders no photo row points at (spec §6). Never throws: it only tidies, and a launch must not fail over it. */
export async function sweepPhotos(db: Db): Promise<SweepPlan | null> {
  try {
    const root = photosRoot();
    if (!root.exists) return null;
    const folders = root.list().flatMap((entry) => (entry instanceof Directory ? [entry.name] : []));
    const plan = planSweep(folders, await allPhotoIds(db));
    for (const name of [...plan.staging, ...plan.orphans]) new Directory(root, name).delete();
    return plan;
  } catch {
    return null;
  }
}
```

Create `app/src/media/pipeline.ts`:

```ts
import { File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat, type SaveOptions } from 'expo-image-manipulator';
import type { ImagePickerAsset } from 'expo-image-picker';
import { newId } from '../core/ids';
import { initialPhotoStates, type NewPhoto } from '../core/photo';
import type { ItemPhotoKind } from '../core/tags';
import { HEAD_BYTES, pngHasAlpha } from './images';
import { DISPLAY_FILE, originalFile, THUMB_FILE } from './layout';
import { stagingDir } from './photoFiles';

/** Longest side of the kept original: enough for N1's Vision pass, small enough not to fill the phone (spec §6). */
const ORIGINAL_MAX = 2048;
/** Longest side of the image the item screen shows. */
const DISPLAY_MAX = 1024;
/** Longest side of a grid image: three to a row on a 393 pt screen at 3x is about 360 px; 300 is sharp enough. */
const THUMB_MAX = 300;
/** JPEG quality of the kept original: high, since every later image is made from it. */
const ORIGINAL_QUALITY = 0.9;
/** Display and thumb encoding. WEBP keeps alpha in theory; the M1 device check confirms it (spec §13). */
const PREVIEW_FORMAT: SaveOptions = { format: SaveFormat.WEBP, compress: 0.8 };
/** Below this much free space a save is refused before it starts: a 2048 px original and two previews take a few MB. */
const MIN_FREE_BYTES = 50 * 1024 * 1024;

/** There is not enough free space to save a photo safely. */
export class LowStorageError extends Error {
  constructor() {
    super('Not enough free space to save the photo');
    this.name = 'LowStorageError';
  }
}

/**
 * Writes the original (≤ 2048 px), display and thumb into the photo's staging folder, then renames the folder into
 * place. Returns the row to insert. On any error the staging folder is deleted and the error rethrown (spec §6).
 */
export async function preparePhoto(asset: ImagePickerAsset, kind: ItemPhotoKind): Promise<NewPhoto> {
  if (Paths.availableDiskSpace < MIN_FREE_BYTES) throw new LowStorageError();
  const id = newId();
  const staging = stagingDir(id);
  staging.create({ intermediates: true });
  try {
    const hasAlpha = await readHasAlpha(asset.uri);
    const originalExt = hasAlpha ? 'png' : 'jpg';
    const original = new File(staging, originalFile(originalExt));
    // Always pass the format: the default is JPEG, which drops alpha (spec §6).
    await render(asset.uri, ORIGINAL_MAX, hasAlpha ? { format: SaveFormat.PNG } : { format: SaveFormat.JPEG, compress: ORIGINAL_QUALITY }, original);
    await render(original.uri, DISPLAY_MAX, PREVIEW_FORMAT, new File(staging, DISPLAY_FILE));
    await render(original.uri, THUMB_MAX, PREVIEW_FORMAT, new File(staging, THUMB_FILE));
    staging.rename(id);
    return { id, kind, originalExt, ...initialPhotoStates(kind, hasAlpha) };
  } catch (e) {
    if (staging.exists) staging.delete();
    throw e;
  }
}

/** Decodes `uri` no larger than `max` on either side (aspect kept, EXIF orientation applied), encodes it with `options` and moves it to `target`. */
async function render(uri: string, max: number, options: SaveOptions, target: File): Promise<void> {
  const context = ImageManipulator.manipulate(uri, { maxWidth: max, maxHeight: max });
  const image = await context.renderAsync();
  try {
    const saved = await image.saveAsync(options);
    await new File(saved.uri).move(target);
  } finally {
    // Native image buffers are freed by hand: a bulk session decodes hundreds of photos.
    image.release();
    context.release();
  }
}

async function readHasAlpha(uri: string): Promise<boolean> {
  const file = new File(uri);
  const handle = file.open();
  try {
    return pngHasAlpha(await handle.readBytes(Math.min(HEAD_BYTES, file.size)));
  } finally {
    handle.close();
  }
}
```

Create `app/src/media/pick.ts`:

```ts
import * as ImagePicker from 'expo-image-picker';

/** Only this combination keeps PNG alpha and HEIC bytes (spec §6): no editing, full quality, the current representation. */
const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: 'images',
  allowsEditing: false,
  quality: 1,
  preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
  base64: false,
  exif: false,
};

export type PhotoSource = 'camera' | 'library';

/** The person has not allowed the camera. */
export class PermissionDeniedError extends Error {
  constructor() {
    super('Camera permission denied');
    this.name = 'PermissionDeniedError';
  }
}

/** Opens the camera or the photo library; null when the person cancels. The library needs no permission on iOS 14+. */
export async function pickPhoto(source: PhotoSource): Promise<ImagePicker.ImagePickerAsset | null> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new PermissionDeniedError();
  }
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(PICKER_OPTIONS) : await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS);
  return result.canceled ? null : result.assets[0];
}
```

- [ ] **Step 7: Run the gates and commit**

Run: `npm test`, `npm run typecheck`, `npx expo export -p ios --output-dir dist`. Expected: all clean. If `typecheck` rejects `image.release()` or `context.release()`, check `SharedObject` / `SharedRef` in `node_modules/expo-modules-core` for the release method's name and use that.

```bash
git add src/media
git commit -m "feat(media): alpha check, crash-safe photo writing, launch sweep and picker

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: App data owns the connection; splash; recovery by error kind

Handover items 2 (owner), 5 (the `SchemaTooNewError` branch), 6 and 7.

**Files:**
- Modify: `app/src/data/settings.ts` (add `pickSettings`), `app/src/data/settings.test.ts` (one new test)
- Modify: `app/src/state/AppData.tsx` (whole file)
- Create: `app/src/ui/Button.tsx`
- Modify: `app/src/features/recovery/Recovery.tsx` (whole file)
- Modify: `app/src/app/_layout.tsx` (whole file)
- Modify: `app/app.json` (splash background)

**Interfaces:**
- Consumes: `openAppDb`, `backupBeforeUpgrade`, `migrate`, `MIGRATIONS`, `loadSettings`, `saveSettings`, `sweepPhotos`, `SchemaTooNewError`.
- Produces:
  - `pickSettings(patch: Partial<AppSettings>): Partial<AppSettings>`
  - `interface AppData { ready; error: Error | null; settings; updateSettings; retry; db: Db | null; revision: number; changed(): void }`
  - `useDb(): Db`
  - `Button({ label, onPress, kind?: 'primary' | 'secondary', disabled? })`
  - `Recovery({ error: Error, onRetry })`

- [ ] **Step 1: Write the failing test**

In `app/src/data/settings.test.ts`, add `pickSettings` to the import from `./settings` and add inside the `describe` block:

```ts
  it('picks only setting names out of a patch', () => {
    expect(pickSettings({ themeMode: 'light', apiKey: 'x' } as never)).toEqual({ themeMode: 'light' });
  });
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/data/settings.test.ts`
Expected: FAIL (`pickSettings` is not exported).

- [ ] **Step 3: Write `pickSettings`**

Add to `app/src/data/settings.ts`, after `NAMES`:

```ts
/** The part of `patch` that names real settings: what may enter the settings held in memory. */
export function pickSettings(patch: Partial<AppSettings>): Partial<AppSettings> {
  const picked: Partial<AppSettings> = {};
  for (const name of NAMES) {
    if (Object.hasOwn(patch, name)) (picked as Record<keyof AppSettings, unknown>)[name] = patch[name];
  }
  return picked;
}
```

Run: `npm test`. Expected: PASS.

- [ ] **Step 4: Rewrite the app data provider**

Replace `app/src/state/AppData.tsx` with:

```tsx
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
```

- [ ] **Step 5: Add the shared button**

Create `app/src/ui/Button.tsx`:

```tsx
import { Pressable, StyleSheet } from 'react-native';
import { Body } from './Text';
import { makeStyles } from './themes';

const useStyles = makeStyles(({ colors, shape: { space, radius } }) =>
  StyleSheet.create({
    base: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.button, paddingVertical: space.s, paddingHorizontal: space.m },
    primary: { backgroundColor: colors.accent },
    secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.outline },
    primaryText: { color: colors.onAccent, fontWeight: '600' },
    pressed: { opacity: 0.7 },
    disabled: { opacity: 0.4 },
  }),
);

/** An action. `primary` is the screen's main action; there is at most one per screen. */
export function Button({
  label,
  onPress,
  kind = 'secondary',
  disabled = false,
}: {
  label: string;
  onPress(): void;
  kind?: 'primary' | 'secondary';
  disabled?: boolean;
}) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.base, styles[kind], pressed && styles.pressed, disabled && styles.disabled]}
    >
      <Body style={kind === 'primary' && styles.primaryText}>{label}</Body>
    </Pressable>
  );
}
```

- [ ] **Step 6: Branch the recovery screen on the error**

Replace `app/src/features/recovery/Recovery.tsx` with:

```tsx
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SchemaTooNewError } from '../../data/errors';
import { Button } from '../../ui/Button';
import { Body, Caption, Title } from '../../ui/Text';
import { makeStyles } from '../../ui/themes';

const useStyles = makeStyles(({ colors, shape: { space } }) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    body: { flex: 1, justifyContent: 'center', paddingHorizontal: space.m, gap: space.m },
    error: { color: colors.dangerText },
  }),
);

/**
 * Shown instead of the app when the database cannot be opened, migrated or read. Nothing is deleted here.
 * Data from a newer build cannot be fixed by retrying, so that case has no button. Export and restore arrive in M1b.
 */
export function Recovery({ error, onRetry }: { error: Error; onRetry(): void }) {
  const styles = useStyles();
  const tooNew = error instanceof SchemaTooNewError;
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.body}>
        <Title>{tooNew ? 'Uygulama eski kaldı' : 'Veriler açılamadı'}</Title>
        <Body dim>
          {tooNew
            ? 'Verilerin bu uygulamanın daha yeni bir sürümüyle kaydedilmiş. Uygulamayı kapatıp açınca güncelleme iner. Hiçbir şey silinmedi.'
            : 'Uygulama veritabanını açarken bir hata oldu. Hiçbir şey silinmedi.'}
        </Body>
        <Caption style={styles.error}>{error.message}</Caption>
        {!tooNew && <Button kind="primary" label="Tekrar dene" onPress={onRetry} />}
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 7: Keep the splash up until the data is ready**

Replace `app/src/app/_layout.tsx` with:

```tsx
import { Stack, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { Recovery } from '../features/recovery/Recovery';
import { AppDataProvider, useAppData } from '../state/AppData';
import { makeNavigationTheme } from '../ui/navigationTheme';
import { ThemeProvider, useTheme } from '../ui/themes';

// The native splash stays up until the database is open or has failed, so a cold start shows no empty frame.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  return (
    <AppDataProvider>
      <Themed />
    </AppDataProvider>
  );
}

function Themed() {
  const { settings } = useAppData();
  return (
    <ThemeProvider mode={settings.themeMode}>
      <Shell />
    </ThemeProvider>
  );
}

/** The navigators once the database is ready; the recovery screen when it failed; the splash until then. */
function Shell() {
  const theme = useTheme();
  const { ready, error, retry } = useAppData();
  const navigationTheme = useMemo(() => makeNavigationTheme(theme), [theme]);
  // The status bar's `style` names the icon colour: light icons on a dark theme.
  const statusBar = <StatusBar style={theme.appearance === 'dark' ? 'light' : 'dark'} />;

  useEffect(() => {
    if (ready || error !== null) SplashScreen.hideAsync().catch(() => {});
  }, [ready, error]);

  if (error !== null) {
    return (
      <>
        {statusBar}
        <Recovery error={error} onRetry={retry} />
      </>
    );
  }
  if (!ready) return null;

  return (
    <NavigationThemeProvider value={navigationTheme}>
      {statusBar}
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.bg } }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </NavigationThemeProvider>
  );
}
```

In `app/app.json`, replace the plugin entry `"expo-splash-screen"` with:

```json
      ["expo-splash-screen", { "backgroundColor": "#0E0E10" }]
```

(`#0E0E10` is the dark theme's `bg`, so the splash and the first screen match.)

- [ ] **Step 8: Run the gates and commit**

Run: `npm test`, `npm run typecheck`, `npx expo export -p ios --output-dir dist`. Expected: all clean.

```bash
git add src/data/settings.ts src/data/settings.test.ts src/state/AppData.tsx src/ui/Button.tsx src/features/recovery/Recovery.tsx src/app/_layout.tsx app.json
git commit -m "feat(app): connection owner, splash until ready, recovery by error kind, launch sweep

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: The add screen: photo kind, camera or library, the tag form

Spec §11 "Ekle" (manual form only; "AI'a bırak" and bulk mode are M2).

**Files:**
- Create: `app/src/features/items/draft.ts` (pure), `app/src/features/items/draft.test.ts`
- Create: `app/src/ui/Chips.tsx`, `app/src/features/items/ItemForm.tsx`, `app/src/features/items/addItem.ts`, `app/src/app/add.tsx`
- Modify: `app/src/app/_layout.tsx` (one screen line)

**Interfaces:**
- Consumes: `ItemTagsSchema`, the vocabulary and labels (Task 3), `createItemWithPhoto` (Task 3), `preparePhoto`, `LowStorageError`, `deletePhotoDir`, `pickPhoto`, `PermissionDeniedError` (Task 4), `Button`, `useDb`, `useAppData` (Task 5).
- Produces:
  - `draft.ts`: `interface TagDraft`, `EMPTY_DRAFT`, `draftFromTags(tags)`, `withSlot(draft, slot)`, `parsePrice(text): number | null | undefined`, `type DraftResult`, `tagsFromDraft(draft): DraftResult`
  - `Chips.tsx`: `SingleChips<T>({ options, labels, value: T | null, onChange })`, `MultiChips<T>({ options, labels, value: readonly T[], onChange })`
  - `ItemForm({ draft, onChange })`
  - `addItem(db, asset, kind, tags): Promise<string>`
  - route `/add` (modal)

- [ ] **Step 1: Write the failing tests**

Create `app/src/features/items/draft.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { ItemTags } from '../../core/tags';
import { draftFromTags, EMPTY_DRAFT, parsePrice, tagsFromDraft, withSlot } from './draft';

const TAGS: ItemTags = {
  slot: 'outer',
  subcategory: 'leather_jacket',
  colors: ['black'],
  material: 'leather',
  texture: 'leather',
  pattern: 'solid',
  silhouette: 'fitted',
  formality: 3,
  warmth: 3,
  seasons: ['autumn'],
  details: ['buckle'],
  brand: "Levi's",
  condition: 'good',
  price: 1250.5,
  notes: 'Omuzlar biraz geniş',
};

describe('parsePrice', () => {
  it.each([
    ['', null],
    ['   ', null],
    ['1250', 1250],
    ['1.250', 1250],
    ['1.250,50', 1250.5],
    ['12,5', 12.5],
    ['abc', undefined],
    ['-5', undefined],
    ['1,234,5', undefined],
  ] as const)('reads %j as %j', (text, expected) => {
    expect(parsePrice(text)).toBe(expected);
  });
});

describe('tagsFromDraft', () => {
  it('asks for the slot first', () => {
    expect(tagsFromDraft(EMPTY_DRAFT)).toEqual({ ok: false, message: 'Önce parçanın türünü seç.' });
  });

  it('says how to write a price it cannot read', () => {
    const result = tagsFromDraft({ ...EMPTY_DRAFT, slot: 'top', price: '12 TL' });
    expect(result.ok).toBe(false);
  });

  it('turns a slot alone into tags with empty fields, and blank text into null', () => {
    expect(tagsFromDraft({ ...EMPTY_DRAFT, slot: 'top', brand: '   ', notes: '' })).toEqual({
      ok: true,
      tags: { ...EMPTY_DRAFT, slot: 'top', brand: null, price: null, notes: null },
    });
  });

  it('gives back the same tags it was filled from', () => {
    expect(tagsFromDraft(draftFromTags(TAGS))).toEqual({ ok: true, tags: TAGS });
  });
});

describe('withSlot', () => {
  it('keeps a subcategory that fits the new slot and clears one that does not', () => {
    const jacket = draftFromTags(TAGS);
    expect(withSlot(jacket, 'outer').subcategory).toBe('leather_jacket');
    expect(withSlot(jacket, 'shoes')).toMatchObject({ slot: 'shoes', subcategory: null });
    expect(withSlot(jacket, null)).toMatchObject({ slot: null, subcategory: null });
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/features`
Expected: FAIL (`./draft` does not exist).

- [ ] **Step 3: Write the form logic**

Create `app/src/features/items/draft.ts`:

```ts
import {
  ItemTagsSchema,
  SUBCATEGORIES,
  type Color,
  type Condition,
  type Detail,
  type ItemTags,
  type Material,
  type Pattern,
  type Scale,
  type Season,
  type Silhouette,
  type Slot,
  type Subcategory,
  type Texture,
} from '../../core/tags';

/** What the item form edits: the tags, with brand, price and notes as the text the person typed. */
export interface TagDraft {
  slot: Slot | null;
  subcategory: Subcategory | null;
  colors: Color[];
  material: Material | null;
  texture: Texture | null;
  pattern: Pattern | null;
  silhouette: Silhouette | null;
  formality: Scale | null;
  warmth: Scale | null;
  seasons: Season[];
  details: Detail[];
  condition: Condition | null;
  brand: string;
  price: string;
  notes: string;
}

/** An empty form. */
export const EMPTY_DRAFT: TagDraft = {
  slot: null,
  subcategory: null,
  colors: [],
  material: null,
  texture: null,
  pattern: null,
  silhouette: null,
  formality: null,
  warmth: null,
  seasons: [],
  details: [],
  condition: null,
  brand: '',
  price: '',
  notes: '',
};

/** The form showing an item's tags. */
export function draftFromTags(t: Omit<ItemTags, 'slot'> & { slot: Slot | null }): TagDraft {
  return {
    slot: t.slot,
    subcategory: t.subcategory,
    colors: [...t.colors],
    material: t.material,
    texture: t.texture,
    pattern: t.pattern,
    silhouette: t.silhouette,
    // The schema keeps both within 1–5 integers.
    formality: t.formality as Scale | null,
    warmth: t.warmth as Scale | null,
    seasons: [...t.seasons],
    details: [...t.details],
    condition: t.condition,
    brand: t.brand ?? '',
    price: t.price === null ? '' : String(t.price).replace('.', ','),
    notes: t.notes ?? '',
  };
}

/** The draft with `slot` chosen; a subcategory of the old slot is cleared. */
export function withSlot(d: TagDraft, slot: Slot | null): TagDraft {
  const fits = slot !== null && d.subcategory !== null && (SUBCATEGORIES[slot] as readonly string[]).includes(d.subcategory);
  return { ...d, slot, subcategory: fits ? d.subcategory : null };
}

/** Blank → null; Turkish digits ("1.250,50") or plain ("1250") → the number; anything else → undefined. */
export function parsePrice(text: string): number | null | undefined {
  const t = text.replace(/\s/g, '');
  if (t === '') return null;
  // In Turkish "." groups thousands and "," marks decimals; the iPhone's Turkish decimal pad types ",".
  const normal = t.replace(/\./g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normal)) return undefined;
  return Number(normal);
}

export type DraftResult = { ok: true; tags: ItemTags } | { ok: false; message: string };

/** Checks the form. The message is Turkish and says what to fix. */
export function tagsFromDraft(d: TagDraft): DraftResult {
  if (d.slot === null) return { ok: false, message: 'Önce parçanın türünü seç.' };
  const price = parsePrice(d.price);
  if (price === undefined) return { ok: false, message: 'Fiyatı rakamla yaz, örneğin 1250 ya da 1.250,50.' };
  const brand = d.brand.trim();
  const notes = d.notes.trim();
  const parsed = ItemTagsSchema.safeParse({
    slot: d.slot,
    subcategory: d.subcategory,
    colors: d.colors,
    material: d.material,
    texture: d.texture,
    pattern: d.pattern,
    silhouette: d.silhouette,
    formality: d.formality,
    warmth: d.warmth,
    seasons: d.seasons,
    details: d.details,
    condition: d.condition,
    brand: brand === '' ? null : brand,
    price,
    notes: notes === '' ? null : notes,
  });
  return parsed.success
    ? { ok: true, tags: parsed.data }
    : { ok: false, message: 'Bazı alanlar geçersiz: en fazla 4 renk, marka en fazla 60, not en fazla 500 karakter.' };
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Write the chips and the form**

Create `app/src/ui/Chips.tsx`:

```tsx
import { Pressable, StyleSheet, View } from 'react-native';
import { Caption } from './Text';
import { makeStyles } from './themes';

type Option = string | number;

const useStyles = makeStyles(({ colors, shape: { space, radius } }) =>
  StyleSheet.create({
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s },
    chip: {
      borderRadius: radius.chip,
      borderWidth: 1,
      borderColor: colors.outline,
      backgroundColor: colors.surface,
      paddingVertical: space.s,
      paddingHorizontal: space.m,
    },
    selected: { backgroundColor: colors.accent, borderColor: colors.accent },
    selectedText: { color: colors.onAccent },
  }),
);

interface ChipsProps<T extends Option> {
  options: readonly T[];
  labels: Readonly<Record<T, string>>;
}

/** One choice or none: tapping the selected chip clears it. */
export function SingleChips<T extends Option>({ options, labels, value, onChange }: ChipsProps<T> & { value: T | null; onChange(value: T | null): void }) {
  return <ChipRow options={options} labels={labels} isSelected={(o) => o === value} onToggle={(o) => onChange(o === value ? null : o)} />;
}

/** Any number of choices. */
export function MultiChips<T extends Option>({ options, labels, value, onChange }: ChipsProps<T> & { value: readonly T[]; onChange(value: T[]): void }) {
  return (
    <ChipRow
      options={options}
      labels={labels}
      isSelected={(o) => value.includes(o)}
      onToggle={(o) => onChange(value.includes(o) ? value.filter((v) => v !== o) : [...value, o])}
    />
  );
}

function ChipRow<T extends Option>({ options, labels, isSelected, onToggle }: ChipsProps<T> & { isSelected(o: T): boolean; onToggle(o: T): void }) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      {options.map((option) => {
        const selected = isSelected(option);
        return (
          <Pressable
            key={String(option)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onToggle(option)}
            style={[styles.chip, selected && styles.selected]}
          >
            <Caption style={selected && styles.selectedText}>{labels[option]}</Caption>
          </Pressable>
        );
      })}
    </View>
  );
}
```

Create `app/src/features/items/ItemForm.tsx`:

```tsx
import type { ReactNode } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import {
  COLORS, CONDITIONS, DETAILS, MATERIALS, PATTERNS, SCALE, SEASONS, SILHOUETTES, SLOTS, SUBCATEGORIES, TEXTURES,
  type Subcategory,
} from '../../core/tags';
import { MultiChips, SingleChips } from '../../ui/Chips';
import {
  COLOR_TR, CONDITION_TR, DETAIL_TR, FORMALITY_TR, MATERIAL_TR, PATTERN_TR, SEASON_TR, SILHOUETTE_TR, SLOT_TR,
  SUBCATEGORY_TR, TEXTURE_TR, WARMTH_TR,
} from '../../ui/labels';
import { Label } from '../../ui/Text';
import { makeStyles, useTheme } from '../../ui/themes';
import { withSlot, type TagDraft } from './draft';

const useStyles = makeStyles(({ colors, typeScale, shape: { space, radius } }) =>
  StyleSheet.create({
    form: { gap: space.l },
    field: { gap: space.s },
    input: {
      ...typeScale.body,
      color: colors.text,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.outline,
      borderRadius: radius.button,
      paddingHorizontal: space.m,
      paddingVertical: space.s,
    },
    // Three lines of body text and the padding around them.
    notes: { minHeight: typeScale.body.lineHeight * 3 + space.m, textAlignVertical: 'top' },
  }),
);

function Field({ label, children }: { label: string; children: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.field}>
      <Label dim>{label}</Label>
      {children}
    </View>
  );
}

/** The manual tag form: every tag as chips, brand, price and notes as text. The caller owns the draft. */
export function ItemForm({ draft, onChange }: { draft: TagDraft; onChange(draft: TagDraft): void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const set =
    <K extends keyof TagDraft>(key: K) =>
    (value: TagDraft[K]) =>
      onChange({ ...draft, [key]: value });
  const subcategories: readonly Subcategory[] = draft.slot === null ? [] : SUBCATEGORIES[draft.slot];

  return (
    <View style={styles.form}>
      <Field label="Tür">
        <SingleChips options={SLOTS} labels={SLOT_TR} value={draft.slot} onChange={(slot) => onChange(withSlot(draft, slot))} />
      </Field>
      {subcategories.length > 0 && (
        <Field label="Alt tür">
          <SingleChips options={subcategories} labels={SUBCATEGORY_TR} value={draft.subcategory} onChange={set('subcategory')} />
        </Field>
      )}
      <Field label="Renk">
        <MultiChips options={COLORS} labels={COLOR_TR} value={draft.colors} onChange={set('colors')} />
      </Field>
      <Field label="Malzeme">
        <SingleChips options={MATERIALS} labels={MATERIAL_TR} value={draft.material} onChange={set('material')} />
      </Field>
      <Field label="Doku">
        <SingleChips options={TEXTURES} labels={TEXTURE_TR} value={draft.texture} onChange={set('texture')} />
      </Field>
      <Field label="Desen">
        <SingleChips options={PATTERNS} labels={PATTERN_TR} value={draft.pattern} onChange={set('pattern')} />
      </Field>
      <Field label="Kesim">
        <SingleChips options={SILHOUETTES} labels={SILHOUETTE_TR} value={draft.silhouette} onChange={set('silhouette')} />
      </Field>
      <Field label="Resmiyet">
        <SingleChips options={SCALE} labels={FORMALITY_TR} value={draft.formality} onChange={set('formality')} />
      </Field>
      <Field label="Sıcaklık">
        <SingleChips options={SCALE} labels={WARMTH_TR} value={draft.warmth} onChange={set('warmth')} />
      </Field>
      <Field label="Mevsim (boşsa her mevsim)">
        <MultiChips options={SEASONS} labels={SEASON_TR} value={draft.seasons} onChange={set('seasons')} />
      </Field>
      <Field label="Detaylar">
        <MultiChips options={DETAILS} labels={DETAIL_TR} value={draft.details} onChange={set('details')} />
      </Field>
      <Field label="Kondisyon">
        <SingleChips options={CONDITIONS} labels={CONDITION_TR} value={draft.condition} onChange={set('condition')} />
      </Field>
      <Field label="Marka">
        <TextInput
          value={draft.brand}
          onChangeText={set('brand')}
          placeholder="Bilmiyorsan boş bırak"
          placeholderTextColor={colors.textFaint}
          autoCorrect={false}
          style={styles.input}
        />
      </Field>
      <Field label="Fiyat (TL)">
        <TextInput
          value={draft.price}
          onChangeText={set('price')}
          keyboardType="decimal-pad"
          placeholder="Örn. 1250"
          placeholderTextColor={colors.textFaint}
          style={styles.input}
        />
      </Field>
      <Field label="Not">
        <TextInput value={draft.notes} onChangeText={set('notes')} multiline style={[styles.input, styles.notes]} />
      </Field>
    </View>
  );
}
```

- [ ] **Step 6: Write the save and the screen**

Create `app/src/features/items/addItem.ts`:

```ts
import type { ImagePickerAsset } from 'expo-image-picker';
import type { ItemPhotoKind, ItemTags } from '../../core/tags';
import type { Db } from '../../data/db';
import { createItemWithPhoto } from '../../data/items';
import { deletePhotoDir } from '../../media/photoFiles';
import { preparePhoto } from '../../media/pipeline';

/** Saves a new item: photo files first, then both rows in one transaction; if the rows fail, the files go too (spec §6). */
export async function addItem(db: Db, asset: ImagePickerAsset, kind: ItemPhotoKind, tags: ItemTags): Promise<string> {
  const photo = await preparePhoto(asset, kind);
  try {
    return await createItemWithPhoto(db, tags, photo);
  } catch (e) {
    deletePhotoDir(photo.id);
    throw e;
  }
}
```

Create `app/src/app/add.tsx`:

```tsx
import { Image } from 'expo-image';
import type { ImagePickerAsset } from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ItemPhotoKind } from '../core/tags';
import { addItem } from '../features/items/addItem';
import { EMPTY_DRAFT, tagsFromDraft } from '../features/items/draft';
import { ItemForm } from '../features/items/ItemForm';
import { PermissionDeniedError, pickPhoto, type PhotoSource } from '../media/pick';
import { LowStorageError } from '../media/pipeline';
import { useAppData, useDb } from '../state/AppData';
import { Button } from '../ui/Button';
import { ITEM_PHOTO_KINDS, PHOTO_KIND_HINT_TR, PHOTO_KIND_TR } from '../ui/labels';
import { Body, Caption, Title } from '../ui/Text';
import { makeStyles, useTheme } from '../ui/themes';

const useStyles = makeStyles(({ colors, shape: { space, radius } }) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    fill: { flex: 1 },
    scroll: { padding: space.m, gap: space.m, paddingBottom: space.xl * 2 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    preview: { width: '100%', aspectRatio: 1, borderRadius: radius.card, backgroundColor: colors.surface },
    choices: { gap: space.s },
    error: { color: colors.dangerText },
  }),
);

/** Add an item by hand: the photo kind, then the camera or the library, then the tag form (spec §11 "Ekle"). */
export default function AddScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const db = useDb();
  const { changed } = useAppData();
  const [kind, setKind] = useState<ItemPhotoKind | null>(null);
  const [asset, setAsset] = useState<ImagePickerAsset | null>(null);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const pick = async (source: PhotoSource) => {
    setMessage(null);
    try {
      const picked = await pickPhoto(source);
      if (picked !== null) setAsset(picked);
    } catch (e) {
      setMessage(e instanceof PermissionDeniedError ? "Kamera izni kapalı. iPhone Ayarlar'ından izin verebilirsin." : 'Fotoğraf açılamadı, tekrar dene.');
    }
  };

  const save = async () => {
    if (kind === null || asset === null) return;
    const result = tagsFromDraft(draft);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await addItem(db, asset, kind, result.tags);
      changed();
      router.back();
    } catch (e) {
      setMessage(e instanceof LowStorageError ? 'Telefonda yer kalmadı. Biraz yer açıp tekrar dene.' : 'Kaydedilemedi, tekrar dene.');
      setSaving(false);
    }
  };

  const messageLine = message !== null && <Caption style={styles.error}>{message}</Caption>;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior="padding" style={styles.fill}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Title>Parça ekle</Title>
            <Button label="Kapat" onPress={() => router.back()} />
          </View>
          {kind === null ? (
            <View style={styles.choices}>
              <Body dim>Fotoğraf nasıl çekildi?</Body>
              {ITEM_PHOTO_KINDS.map((k) => (
                <Button key={k} label={`${PHOTO_KIND_TR[k]}: ${PHOTO_KIND_HINT_TR[k]}`} onPress={() => setKind(k)} />
              ))}
            </View>
          ) : asset === null ? (
            <View style={styles.choices}>
              <Body dim>{PHOTO_KIND_TR[kind]}</Body>
              <Button kind="primary" label="Fotoğraf çek" onPress={() => pick('camera')} />
              <Button label="Galeriden seç" onPress={() => pick('library')} />
              <Button label="Geri" onPress={() => setKind(null)} />
              {messageLine}
            </View>
          ) : (
            <>
              <Image source={{ uri: asset.uri }} style={styles.preview} contentFit="contain" />
              <Button label="Başka fotoğraf seç" onPress={() => setAsset(null)} />
              <ItemForm draft={draft} onChange={setDraft} />
              {messageLine}
              {saving ? <ActivityIndicator color={colors.text} /> : <Button kind="primary" label="Kaydet" onPress={save} />}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
```

In `app/src/app/_layout.tsx`, add below `<Stack.Screen name="(tabs)" />`:

```tsx
        <Stack.Screen name="add" options={{ presentation: 'modal' }} />
```

- [ ] **Step 7: Run the gates and commit**

Run: `npm test`, `npm run typecheck`, `npx expo export -p ios --output-dir dist`. Expected: all clean.

```bash
git add src/features/items src/ui/Chips.tsx src/app/add.tsx src/app/_layout.tsx
git commit -m "feat(items): add screen with photo kind, camera or library, and the tag form

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: The wardrobe grid with filters, and the item screen

Spec §11 "Gardırop" (grid, filter chips, "+"; the value line, queue badge and backup banner come with M2 and M1b) and "Parça" (photo, tags, status, edit).

**Files:**
- Create: `app/src/core/wardrobeFilter.ts`, `app/src/core/wardrobeFilter.test.ts`
- Create: `app/src/features/items/summary.ts`, `app/src/features/items/summary.test.ts`
- Create: `app/src/features/items/PhotoImage.tsx`, `app/src/app/item/[id].tsx`
- Modify: `app/src/app/(tabs)/index.tsx` (whole file), `app/src/app/_layout.tsx` (one screen line)

**Interfaces:**
- Consumes: vocabulary and labels (Task 3), `listItems`, `getItem`, `getPhoto`, `updateItem`, `setItemStatus` (Task 3), `displayUri`, `thumbUri` (Task 4), `Button`, `useDb`, `useAppData` (Task 5), `SingleChips`, `MultiChips`, `ItemForm`, `draftFromTags`, `tagsFromDraft` (Task 6).
- Produces:
  - `wardrobeFilter.ts`: `interface WardrobeFilter { slots: Slot[]; statuses: ChosenStatus[]; formality: Scale[]; seasons: Season[]; textures: Texture[] }`, `DEFAULT_FILTER`, `type FilterableItem`, `matchesFilter(item, filter)`
  - `summary.ts`: `itemTitle(item)`, `tagRows(item): { label: string; value: string }[]`
  - `PhotoImage({ photoId, size: 'thumb' | 'display' })`
  - route `/item/[id]`

- [ ] **Step 1: Write the failing tests**

Create `app/src/core/wardrobeFilter.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_FILTER, matchesFilter, type FilterableItem } from './wardrobeFilter';

const knit: FilterableItem = { status: 'active', slot: 'top', formality: 2, seasons: [], texture: 'knit' };

describe('matchesFilter', () => {
  it('shows the clothes in use by default, never drafts', () => {
    expect(matchesFilter(knit, DEFAULT_FILTER)).toBe(true);
    expect(matchesFilter({ ...knit, status: 'laundry' }, DEFAULT_FILTER)).toBe(true);
    for (const status of ['archived', 'wishlist', 'draft'] as const) {
      expect(matchesFilter({ ...knit, status }, DEFAULT_FILTER)).toBe(false);
    }
    expect(matchesFilter({ ...knit, status: 'draft' }, { ...DEFAULT_FILTER, statuses: [] })).toBe(false);
  });

  it('takes an empty list as "any"', () => {
    expect(matchesFilter({ ...knit, status: 'archived' }, { ...DEFAULT_FILTER, statuses: [] })).toBe(true);
  });

  it('matches slot, formality and texture, and drops items without the tag', () => {
    expect(matchesFilter(knit, { ...DEFAULT_FILTER, slots: ['top', 'mid'] })).toBe(true);
    expect(matchesFilter(knit, { ...DEFAULT_FILTER, slots: ['shoes'] })).toBe(false);
    expect(matchesFilter(knit, { ...DEFAULT_FILTER, formality: [2] })).toBe(true);
    expect(matchesFilter({ ...knit, formality: null }, { ...DEFAULT_FILTER, formality: [2] })).toBe(false);
    expect(matchesFilter({ ...knit, texture: null }, { ...DEFAULT_FILTER, textures: ['knit'] })).toBe(false);
  });

  it('counts an item without seasons as an all-season item', () => {
    expect(matchesFilter(knit, { ...DEFAULT_FILTER, seasons: ['winter'] })).toBe(true);
    expect(matchesFilter({ ...knit, seasons: ['summer'] }, { ...DEFAULT_FILTER, seasons: ['winter'] })).toBe(false);
    expect(matchesFilter({ ...knit, seasons: ['autumn', 'winter'] }, { ...DEFAULT_FILTER, seasons: ['winter'] })).toBe(true);
  });
});
```

Create `app/src/features/items/summary.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Item } from '../../data/items';
import { itemTitle, tagRows } from './summary';

const item: Item = {
  id: 'item0001',
  status: 'active',
  slot: 'outer',
  subcategory: 'leather_jacket',
  colors: ['black', 'silver'],
  material: 'leather',
  texture: null,
  pattern: null,
  silhouette: null,
  formality: 3,
  warmth: null,
  seasons: [],
  details: [],
  notes: null,
  brand: null,
  condition: null,
  price: 1250.5,
  primaryPhotoId: null,
  createdAt: 'x',
  updatedAt: 'x',
};

describe('summary', () => {
  it('names an item by slot and subcategory', () => {
    expect(itemTitle(item)).toBe('Dış giyim · Deri ceket');
    expect(itemTitle({ slot: 'top', subcategory: null })).toBe('Üst');
  });

  it('lists the filled tags only, with all seasons spelled out', () => {
    expect(tagRows(item)).toEqual([
      { label: 'Renk', value: 'Siyah, Gümüş' },
      { label: 'Malzeme', value: 'Deri' },
      { label: 'Resmiyet', value: 'Smart casual' },
      { label: 'Mevsim', value: 'Her mevsim' },
      { label: 'Fiyat', value: '1.250,5 TL' },
    ]);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/core/wardrobeFilter.test.ts src/features/items/summary.test.ts`
Expected: FAIL (the modules do not exist).

- [ ] **Step 3: Write the filter and the summary**

Create `app/src/core/wardrobeFilter.ts`:

```ts
import type { ChosenStatus, Scale, Season, Slot, Status, Texture } from './tags';

/** The grid's filters. An empty list means "any". */
export interface WardrobeFilter {
  slots: Slot[];
  statuses: ChosenStatus[];
  formality: Scale[];
  seasons: Season[];
  textures: Texture[];
}

/** What the grid starts with: the clothes in use (active and in the laundry). */
export const DEFAULT_FILTER: WardrobeFilter = { slots: [], statuses: ['active', 'laundry'], formality: [], seasons: [], textures: [] };

/** The fields the filter reads. */
export interface FilterableItem {
  status: Status;
  slot: Slot | null;
  formality: number | null;
  seasons: readonly Season[];
  texture: Texture | null;
}

/** Whether `item` passes `f`. Drafts never do. An item without seasons counts as all-season (spec §8 season rule). */
export function matchesFilter(item: FilterableItem, f: WardrobeFilter): boolean {
  if (item.status === 'draft') return false;
  if (f.statuses.length > 0 && !f.statuses.includes(item.status)) return false;
  if (f.slots.length > 0 && (item.slot === null || !f.slots.includes(item.slot))) return false;
  if (f.formality.length > 0 && (item.formality === null || !(f.formality as readonly number[]).includes(item.formality))) return false;
  if (f.seasons.length > 0 && item.seasons.length > 0 && !item.seasons.some((s) => f.seasons.includes(s))) return false;
  if (f.textures.length > 0 && (item.texture === null || !f.textures.includes(item.texture))) return false;
  return true;
}
```

Create `app/src/features/items/summary.ts`:

```ts
import type { Scale } from '../../core/tags';
import type { Item } from '../../data/items';
import {
  COLOR_TR, CONDITION_TR, DETAIL_TR, FORMALITY_TR, MATERIAL_TR, PATTERN_TR, SEASON_TR, SILHOUETTE_TR, SLOT_TR,
  SUBCATEGORY_TR, TEXTURE_TR, WARMTH_TR,
} from '../../ui/labels';

/** "Dış giyim · Deri ceket": the item's name in headers and screen-reader labels. */
export function itemTitle(item: Pick<Item, 'slot' | 'subcategory'>): string {
  if (item.slot === null) return 'Taslak';
  return item.subcategory === null ? SLOT_TR[item.slot] : `${SLOT_TR[item.slot]} · ${SUBCATEGORY_TR[item.subcategory]}`;
}

/** The filled tags as label and value lines for the item screen; empty tags are left out. */
export function tagRows(item: Item): { label: string; value: string }[] {
  const join = (values: readonly string[]) => (values.length === 0 ? null : values.join(', '));
  const rows: [string, string | null][] = [
    ['Renk', join(item.colors.map((c) => COLOR_TR[c]))],
    ['Malzeme', item.material === null ? null : MATERIAL_TR[item.material]],
    ['Doku', item.texture === null ? null : TEXTURE_TR[item.texture]],
    ['Desen', item.pattern === null ? null : PATTERN_TR[item.pattern]],
    ['Kesim', item.silhouette === null ? null : SILHOUETTE_TR[item.silhouette]],
    ['Resmiyet', item.formality === null ? null : FORMALITY_TR[item.formality as Scale]],
    ['Sıcaklık', item.warmth === null ? null : WARMTH_TR[item.warmth as Scale]],
    ['Mevsim', join(item.seasons.map((s) => SEASON_TR[s])) ?? 'Her mevsim'],
    ['Detaylar', join(item.details.map((d) => DETAIL_TR[d]))],
    ['Kondisyon', item.condition === null ? null : CONDITION_TR[item.condition]],
    ['Marka', item.brand],
    ['Fiyat', item.price === null ? null : `${item.price.toLocaleString('tr-TR')} TL`],
    ['Not', item.notes],
  ];
  return rows.flatMap(([label, value]) => (value === null ? [] : [{ label, value }]));
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: PASS. If `1.250,5 TL` comes out as `1250.5 TL`, Node lacks Turkish locale data (full ICU is the Node 24 default, so this should not happen); report it rather than changing the expectation.

- [ ] **Step 5: Write the photo view, the grid and the item screen**

Create `app/src/features/items/PhotoImage.tsx`:

```tsx
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { displayUri, thumbUri } from '../../media/photoFiles';
import { makeStyles, useTheme } from '../../ui/themes';

/** Size of the placeholder glyph. */
const PLACEHOLDER_ICON = 32;

const useStyles = makeStyles(({ colors }) =>
  StyleSheet.create({
    fill: { flex: 1, backgroundColor: colors.surface },
    placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  }),
);

/** An item's photo filling its parent, or a placeholder when it has none or its file is missing (M1a decision 4). */
export function PhotoImage({ photoId, size }: { photoId: string | null; size: 'thumb' | 'display' }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  if (photoId === null || failed) {
    return (
      <View style={styles.placeholder}>
        <Ionicons name="shirt-outline" size={PLACEHOLDER_ICON} color={colors.textFaint} />
      </View>
    );
  }
  return (
    <Image
      source={{ uri: size === 'thumb' ? thumbUri(photoId) : displayUri(photoId) }}
      style={styles.fill}
      contentFit="contain"
      recyclingKey={photoId}
      cachePolicy="memory"
      onError={() => setFailed(true)}
    />
  );
}
```

Replace `app/src/app/(tabs)/index.tsx` with:

```tsx
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CHOSEN_STATUSES, SCALE, SEASONS, SLOTS, TEXTURES } from '../../core/tags';
import { DEFAULT_FILTER, matchesFilter, type WardrobeFilter } from '../../core/wardrobeFilter';
import { listItems, type Item } from '../../data/items';
import { PhotoImage } from '../../features/items/PhotoImage';
import { itemTitle } from '../../features/items/summary';
import { useAppData, useDb } from '../../state/AppData';
import { Button } from '../../ui/Button';
import { MultiChips } from '../../ui/Chips';
import { CHOSEN_STATUS_TR, FORMALITY_TR, SEASON_TR, SLOT_TR, TAB_TR, TEXTURE_TR } from '../../ui/labels';
import { Body, Caption, Label, Title } from '../../ui/Text';
import { makeStyles } from '../../ui/themes';

/** Thumbnails per row: three on an iPhone 15 is about 120 pt each. */
const COLUMNS = 3;
/** One cell's width: a third of the row (`COLUMNS`). */
const CELL_WIDTH = '33.333%';

const useStyles = makeStyles(({ colors, shape: { space, radius } }) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.m, paddingTop: space.m },
    filters: { paddingVertical: space.s, gap: space.s },
    grid: { paddingHorizontal: space.m - space.xs, paddingBottom: space.xl },
    cell: { width: CELL_WIDTH, aspectRatio: 1, padding: space.xs },
    cellInner: { flex: 1, borderRadius: radius.button, overflow: 'hidden' },
    note: { paddingVertical: space.m },
    error: { color: colors.dangerText },
  }),
);

/** The wardrobe: filters on top, a grid of thumbnails, "+ Ekle" (spec §11 "Gardırop"). */
export default function WardrobeScreen() {
  const styles = useStyles();
  const db = useDb();
  const { revision } = useAppData();
  const [items, setItems] = useState<Item[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<WardrobeFilter>(DEFAULT_FILTER);
  const [moreFilters, setMoreFilters] = useState(false);

  useEffect(() => {
    let live = true;
    listItems(db).then(
      (list) => {
        if (!live) return;
        setItems(list);
        setFailed(false);
      },
      () => {
        if (live) setFailed(true);
      },
    );
    return () => {
      live = false;
    };
  }, [db, revision]);

  const visible = useMemo(() => (items ?? []).filter((item) => matchesFilter(item, filter)), [items, filter]);
  const set =
    <K extends keyof WardrobeFilter>(key: K) =>
    (value: WardrobeFilter[K]) =>
      setFilter((current) => ({ ...current, [key]: value }));

  const filters = (
    <View style={styles.filters}>
      <MultiChips options={SLOTS} labels={SLOT_TR} value={filter.slots} onChange={set('slots')} />
      <Button label={moreFilters ? 'Filtreleri gizle' : 'Diğer filtreler'} onPress={() => setMoreFilters((open) => !open)} />
      {moreFilters && (
        <>
          <Label dim>Durum</Label>
          <MultiChips options={CHOSEN_STATUSES} labels={CHOSEN_STATUS_TR} value={filter.statuses} onChange={set('statuses')} />
          <Label dim>Resmiyet</Label>
          <MultiChips options={SCALE} labels={FORMALITY_TR} value={filter.formality} onChange={set('formality')} />
          <Label dim>Mevsim</Label>
          <MultiChips options={SEASONS} labels={SEASON_TR} value={filter.seasons} onChange={set('seasons')} />
          <Label dim>Doku</Label>
          <MultiChips options={TEXTURES} labels={TEXTURE_TR} value={filter.textures} onChange={set('textures')} />
        </>
      )}
      {failed && <Caption style={styles.error}>Parçalar okunamadı. Uygulamayı kapatıp aç.</Caption>}
    </View>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Title>{TAB_TR.index}</Title>
        <Button kind="primary" label="+ Ekle" onPress={() => router.push('/add')} />
      </View>
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        numColumns={COLUMNS}
        contentContainerStyle={styles.grid}
        ListHeaderComponent={filters}
        renderItem={({ item }) => (
          <Pressable accessibilityRole="button" accessibilityLabel={itemTitle(item)} onPress={() => router.push(`/item/${item.id}`)} style={styles.cell}>
            <View style={styles.cellInner}>
              <PhotoImage photoId={item.primaryPhotoId} size="thumb" />
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          items === null ? null : (
            <Body dim style={styles.note}>
              {items.length === 0 ? 'Henüz parça yok. "+ Ekle" ile ilkini ekle.' : 'Bu filtrelere uyan parça yok.'}
            </Body>
          )
        }
      />
    </SafeAreaView>
  );
}
```

Create `app/src/app/item/[id].tsx`:

```tsx
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { CHOSEN_STATUSES, type ChosenStatus } from '../../core/tags';
import { getItem, getPhoto, setItemStatus, updateItem, type Item, type Photo } from '../../data/items';
import { draftFromTags, tagsFromDraft, type TagDraft } from '../../features/items/draft';
import { ItemForm } from '../../features/items/ItemForm';
import { PhotoImage } from '../../features/items/PhotoImage';
import { itemTitle, tagRows } from '../../features/items/summary';
import { useAppData, useDb } from '../../state/AppData';
import { Button } from '../../ui/Button';
import { SingleChips } from '../../ui/Chips';
import { CHOSEN_STATUS_TR, CUTOUT_TR, PHOTO_KIND_TR } from '../../ui/labels';
import { Body, Caption, Label } from '../../ui/Text';
import { makeStyles } from '../../ui/themes';

const useStyles = makeStyles(({ colors, shape: { space, radius } }) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: space.m, gap: space.m, paddingBottom: space.xl * 2 },
    photo: { width: '100%', aspectRatio: 1, borderRadius: radius.card, overflow: 'hidden' },
    row: { gap: space.xs },
    error: { color: colors.dangerText },
  }),
);

/** One item: its photo, tags and status, and the same form as the add screen to edit them (spec §11 "Parça"). */
export default function ItemScreen() {
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDb();
  const { revision, changed } = useAppData();
  const [item, setItem] = useState<Item | null | undefined>(undefined);
  const [photo, setPhoto] = useState<Photo | null>(null);
  // Set while editing.
  const [draft, setDraft] = useState<TagDraft | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const found = await getItem(db, id);
      const primary = found?.primaryPhotoId ? await getPhoto(db, found.primaryPhotoId) : null;
      if (!live) return;
      setItem(found);
      setPhoto(primary);
    })().catch(() => {
      if (live) setMessage('Parça okunamadı.');
    });
    return () => {
      live = false;
    };
  }, [db, id, revision]);

  if (item === undefined) return <View style={styles.root}>{message !== null && <Caption style={styles.error}>{message}</Caption>}</View>;
  if (item === null) {
    return (
      <View style={styles.root}>
        <Body dim>Bu parça bulunamadı.</Body>
      </View>
    );
  }

  const chooseStatus = async (status: ChosenStatus | null) => {
    if (status === null || status === item.status) return;
    setMessage(null);
    try {
      await setItemStatus(db, item.id, status);
      changed();
    } catch {
      setMessage('Durum kaydedilemedi, tekrar dene.');
    }
  };

  const saveEdit = async () => {
    if (draft === null) return;
    const result = tagsFromDraft(draft);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    try {
      await updateItem(db, item.id, result.tags);
      setDraft(null);
      setMessage(null);
      changed();
    } catch {
      setMessage('Kaydedilemedi, tekrar dene.');
    }
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.root}>
      <Stack.Screen options={{ title: itemTitle(item) }} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.photo}>
          <PhotoImage photoId={item.primaryPhotoId} size="display" />
        </View>
        {photo !== null && (
          <Caption dim>
            {PHOTO_KIND_TR[photo.kind]} · {CUTOUT_TR[photo.cutoutState]}
          </Caption>
        )}
        <Label dim>Durum</Label>
        <SingleChips options={CHOSEN_STATUSES} labels={CHOSEN_STATUS_TR} value={item.status === 'draft' ? null : item.status} onChange={chooseStatus} />
        {draft === null ? (
          <>
            {tagRows(item).map((row) => (
              <View key={row.label} style={styles.row}>
                <Caption dim>{row.label}</Caption>
                <Body>{row.value}</Body>
              </View>
            ))}
            {message !== null && <Caption style={styles.error}>{message}</Caption>}
            <Button
              label="Düzenle"
              onPress={() => {
                setMessage(null);
                setDraft(draftFromTags(item));
              }}
            />
          </>
        ) : (
          <>
            <ItemForm draft={draft} onChange={setDraft} />
            {message !== null && <Caption style={styles.error}>{message}</Caption>}
            <Button kind="primary" label="Kaydet" onPress={saveEdit} />
            <Button
              label="Vazgeç"
              onPress={() => {
                setMessage(null);
                setDraft(null);
              }}
            />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
```

In `app/src/app/_layout.tsx`, add below the `add` screen line:

```tsx
        <Stack.Screen name="item/[id]" options={{ headerShown: true, title: '', headerBackTitle: TAB_TR.index }} />
```

and add the import:

```tsx
import { TAB_TR } from '../ui/labels';
```

- [ ] **Step 6: Run the gates and commit**

Run: `npm test`, `npm run typecheck`, `npx expo export -p ios --output-dir dist`. Expected: all clean.

```bash
git add src/core/wardrobeFilter.ts src/core/wardrobeFilter.test.ts src/features/items src/app
git commit -m "feat(wardrobe): grid with filters and the item screen with edit and status

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: README, publish and the device check

**Files:**
- Modify: `README.md` (status line)
- Modify: this plan (device-check results)

- [ ] **Step 1: Update the README status line**

In `README.md` (repo root), replace the line starting with `Status:` with:

```markdown
Status: **M1a wardrobe**: add items with a photo and a tag form, a filtered grid, an item screen with edit and
status. Backup arrives with M1b. See the release plan in the spec (§3).
```

Commit (from the repo root):

```bash
git add README.md
git commit -m "docs: README status for M1a

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 2: Publish (the controller)**

From `app/`: `npx eas-cli@latest update --branch preview --platform ios --environment preview --message "M1a: wardrobe" --non-interactive`. Give the author the printed EAS Dashboard link (→ Preview → QR).

- [ ] **Step 3: Device check (the author, not an agent)**

Open the update in Expo Go and check:

1. The app opens on the theme chosen in M0 (the v1 → v2 migration kept the settings).
2. Add five items by hand: at least one each of Zeminde, Askıda and Üstümde, at least one from the camera and one from the library. Each appears in the grid at once.
3. One transparent image: in Photos, touch and hold a garment until it lifts, choose Share → Save Image, then add that image from the library. The item screen says "Arka plan şeffaf" (the picker kept alpha, spec §13 row 2) and the grid cell shows the garment on the cell colour, with no white or black box (WEBP kept alpha, spec §13 row 3).
4. Close Expo Go completely and reopen the project: the five items are still there.
5. The slot chips filter the grid; "Diğer filtreler" opens status, formality, season and texture.
6. Edit an item's colour and price, save: the item screen shows the change. Set one item to "Arşivde": it leaves the default grid and appears with the Arşivde filter.

Record the result under this step (pass, or what failed). For check 3, also record which of the two §13 rows failed, if one did: "Arka plan şeffaf" missing means the picker lost alpha; a box in the grid means WEBP did.

---

## Handover to M1b

M1b starts with: backup export (spec §10 steps 1–5, fflate streaming, `expo-sharing`), staged import (§10 steps 1–7 with the safety copy and the `photos.incoming` swap), the backup nudge and the `last_export_at` / `changes_since_export` settings, then the recovery screen's raw export and `.bak` restore (M1a decision 6), and the handover-6 test of a mixed valid and invalid settings patch once those settings exist. Packages to install then: `fflate`, `expo-sharing`, `expo-document-picker`.

Later: camera and photo-library permission strings in `app.json` (`expo-image-picker` plugin) before the N1 build; the remaining M0 "Later" list.
