import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import {
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  utimes,
  writeFile
} from "node:fs/promises";
import { hostname } from "node:os";
import path from "node:path";

export const DEFAULT_REVIEW_FILE_LOCK = path.join(
  "data",
  ".strong-review-write.lock"
);

interface ReviewFileLockOptions {
  lockPath?: string;
  timeoutMs?: number;
  staleAfterMs?: number;
  retryMs?: number;
}

interface ReviewFileLockOwner {
  pid: number;
  hostname: string;
  token: string;
  acquiredAt: string;
}

/**
 * Serializes read-modify-write operations on curated overrides and the durable
 * decision ledger across independent CLI processes.
 */
export async function withReviewFileLock<T>(
  operation: () => Promise<T>,
  options: ReviewFileLockOptions = {}
): Promise<T> {
  const lockPath = options.lockPath ?? DEFAULT_REVIEW_FILE_LOCK;
  const timeoutMs = options.timeoutMs ?? 30_000;
  const staleAfterMs = options.staleAfterMs ?? 30 * 60_000;
  const retryMs = options.retryMs ?? 100;
  const startedAt = Date.now();
  const recoveryPath = `${lockPath}.recovery`;
  const recoveryStaleAfterMs = Math.min(staleAfterMs, 30_000);

  await mkdir(path.dirname(lockPath), { recursive: true });
  while (true) {
    if (existsSync(recoveryPath)) {
      await recoverAbandonedRecoveryMutex(recoveryPath, recoveryStaleAfterMs);
      assertLockWaitWithinTimeout(lockPath, startedAt, timeoutMs);
      await sleep(retryMs);
      continue;
    }
    try {
      await mkdir(lockPath);
      break;
    } catch (error) {
      if (!isAlreadyExists(error)) throw error;
      if (await lockIsStale(lockPath, staleAfterMs)) {
        await recoverStaleLock(lockPath, recoveryPath, staleAfterMs);
        continue;
      }
      assertLockWaitWithinTimeout(lockPath, startedAt, timeoutMs);
      await sleep(retryMs);
    }
  }

  const owner: ReviewFileLockOwner = {
    pid: process.pid,
    hostname: hostname(),
    token: randomUUID(),
    acquiredAt: new Date().toISOString()
  };
  let heartbeat: NodeJS.Timeout | undefined;
  try {
    await writeFile(
      path.join(lockPath, "owner.json"),
      `${JSON.stringify(owner, null, 2)}\n`,
      "utf8"
    );
    heartbeat = setInterval(
      () => void touchOwnedLock(lockPath, owner.token),
      Math.max(5, Math.min(60_000, Math.floor(staleAfterMs / 3)))
    );
    heartbeat.unref();
    return await operation();
  } finally {
    if (heartbeat) clearInterval(heartbeat);
    await releaseOwnedLock(lockPath, owner.token);
  }
}

async function recoverStaleLock(
  lockPath: string,
  recoveryPath: string,
  staleAfterMs: number
): Promise<void> {
  try {
    await mkdir(recoveryPath);
  } catch (error) {
    if (isAlreadyExists(error)) return;
    throw error;
  }

  const tombstone = `${lockPath}.stale-${process.pid}-${randomUUID()}`;
  try {
    await writeFile(
      path.join(recoveryPath, "owner.json"),
      `${JSON.stringify(
        {
          pid: process.pid,
          hostname: hostname(),
          token: randomUUID(),
          acquiredAt: new Date().toISOString()
        } satisfies ReviewFileLockOwner,
        null,
        2
      )}\n`,
      "utf8"
    );
    if (!(await lockIsStale(lockPath, staleAfterMs))) return;
    try {
      // Rename removes exactly the stale directory we inspected. A contender
      // may create a fresh lock at lockPath afterwards, but cleanup only ever
      // touches this unique tombstone.
      await rename(lockPath, tombstone);
    } catch (error) {
      if (isNotFound(error)) return;
      throw error;
    }
    await rm(tombstone, { recursive: true, force: true });
  } finally {
    await rm(recoveryPath, { recursive: true, force: true });
  }
}

async function recoverAbandonedRecoveryMutex(
  recoveryPath: string,
  staleAfterMs: number
): Promise<void> {
  try {
    const info = await stat(recoveryPath);
    if (Date.now() - info.mtimeMs <= staleAfterMs) return;
    const owner = await readOwner(recoveryPath);
    if (
      owner?.hostname === hostname() &&
      Number.isInteger(owner.pid) &&
      processIsAlive(owner.pid)
    ) {
      return;
    }

    const tombstone = `${recoveryPath}.abandoned-${process.pid}-${randomUUID()}`;
    try {
      await rename(recoveryPath, tombstone);
    } catch (error) {
      if (isNotFound(error)) return;
      throw error;
    }
    await rm(tombstone, { recursive: true, force: true });
  } catch (error) {
    if (isNotFound(error)) return;
    throw error;
  }
}

async function lockIsStale(
  lockPath: string,
  staleAfterMs: number
): Promise<boolean> {
  try {
    const info = await stat(lockPath);
    if (Date.now() - info.mtimeMs <= staleAfterMs) return false;
    const owner = await readOwner(lockPath);
    if (
      owner?.hostname === hostname() &&
      Number.isInteger(owner.pid) &&
      processIsAlive(owner.pid)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function touchOwnedLock(lockPath: string, token: string): Promise<void> {
  const owner = await readOwner(lockPath);
  if (owner?.token !== token) return;
  const now = new Date();
  await utimes(lockPath, now, now).catch(() => undefined);
}

async function releaseOwnedLock(
  lockPath: string,
  token: string
): Promise<void> {
  const owner = await readOwner(lockPath);
  if (owner?.token !== token) return;
  await rm(lockPath, { recursive: true, force: true });
}

async function readOwner(
  lockPath: string
): Promise<ReviewFileLockOwner | undefined> {
  try {
    const value = JSON.parse(
      await readFile(path.join(lockPath, "owner.json"), "utf8")
    ) as Partial<ReviewFileLockOwner>;
    if (
      typeof value.pid !== "number" ||
      typeof value.hostname !== "string" ||
      typeof value.token !== "string" ||
      typeof value.acquiredAt !== "string"
    ) {
      return undefined;
    }
    return value as ReviewFileLockOwner;
  } catch {
    return undefined;
  }
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return !(
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ESRCH"
    );
  }
}

function assertLockWaitWithinTimeout(
  lockPath: string,
  startedAt: number,
  timeoutMs: number
): void {
  if (Date.now() - startedAt < timeoutMs) return;
  throw new Error(`strong-review-lock-timeout:${lockPath}`);
}

function isAlreadyExists(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "EEXIST"
  );
}

function isNotFound(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
