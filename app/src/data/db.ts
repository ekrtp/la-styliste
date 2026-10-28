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
