import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

export class FrenchCodexLockBusyError extends Error {
  constructor(path: string) {
    super(`french-codex-sqlite-lock-busy:${path}`);
    this.name = "FrenchCodexLockBusyError";
  }
}

/**
 * Holds an OS-enforced SQLite EXCLUSIVE transaction for the lifetime of the
 * returned release callback. There is no create/write window and process death
 * releases the lock automatically.
 */
export function acquireFrenchCodexSqliteLock(pathValue: string): () => void {
  const path = resolve(pathValue);
  mkdirSync(dirname(path), { recursive: true });
  const database = new DatabaseSync(path);
  try {
    database.exec("PRAGMA busy_timeout = 0");
    database.exec(
      "CREATE TABLE IF NOT EXISTS lock_owner (singleton INTEGER PRIMARY KEY CHECK (singleton = 1), pid INTEGER NOT NULL, nonce TEXT NOT NULL, acquired_at TEXT NOT NULL)"
    );
    database.exec("BEGIN EXCLUSIVE");
    const nonce = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    database
      .prepare(
        "INSERT INTO lock_owner(singleton, pid, nonce, acquired_at) VALUES (1, ?, ?, ?) ON CONFLICT(singleton) DO UPDATE SET pid = excluded.pid, nonce = excluded.nonce, acquired_at = excluded.acquired_at"
      )
      .run(process.pid, nonce, new Date().toISOString());
  } catch (error) {
    database.close();
    if (isSqliteBusy(error)) throw new FrenchCodexLockBusyError(path);
    throw error;
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    try {
      database.exec("ROLLBACK");
    } finally {
      database.close();
    }
  };
}

export async function acquireFrenchCodexSqliteLockWithTimeout(
  path: string,
  timeoutMs: number
): Promise<() => void> {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    try {
      return acquireFrenchCodexSqliteLock(path);
    } catch (error) {
      if (!(error instanceof FrenchCodexLockBusyError)) throw error;
      if (Date.now() >= deadline) throw error;
      await new Promise<void>((resolveWait) => setTimeout(resolveWait, 250));
    }
  }
}

export function frenchCodexSqliteLockIsActive(path: string): boolean {
  try {
    const release = acquireFrenchCodexSqliteLock(path);
    release();
    return false;
  } catch (error) {
    if (error instanceof FrenchCodexLockBusyError) return true;
    throw error;
  }
}

function isSqliteBusy(error: unknown): boolean {
  const value = error as {
    errcode?: number;
    errstr?: string;
    message?: string;
  };
  return (
    value.errcode === 5 ||
    value.errcode === 6 ||
    /database (?:is )?(?:locked|busy)/iu.test(
      `${value.errstr ?? ""} ${value.message ?? ""}`
    )
  );
}
