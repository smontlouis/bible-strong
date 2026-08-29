import { constants } from "node:fs";
import { createHash } from "node:crypto";
import {
  access,
  copyFile,
  mkdir,
  readFile,
  rename,
  rm
} from "node:fs/promises";
import path from "node:path";

import { writeJsonFileAtomic } from "./atomicFile.js";

export const DEFAULT_REVIEW_TRANSACTION_MARKER = path.join(
  "data",
  ".strong-review-transaction.json"
);

export type ReviewTransactionPhase =
  | "backed-up"
  | "applied"
  | "refreshed"
  | "committed";

export interface ReviewTransactionFileInput {
  role: "curated-overrides" | "decision-ledger";
  filePath: string;
  backupPath: string;
}

export interface ReviewTransactionFile {
  role: ReviewTransactionFileInput["role"];
  filePath: string;
  backupPath: string;
  existed: boolean;
  backupSha256?: string;
  backupSize?: number;
}

export interface ReviewTransactionRecord {
  version: 1;
  bible: string;
  scope: string;
  phase: ReviewTransactionPhase;
  createdAt: string;
  updatedAt: string;
  files: ReviewTransactionFile[];
}

export interface ReviewTransactionRefreshTarget {
  bible: string;
  scope: string;
}

interface ReviewTransactionOptions {
  markerPath?: string;
}

interface BeginReviewTransactionOptions extends ReviewTransactionOptions {
  bible: string;
  scope: string;
  files: ReviewTransactionFileInput[];
}

interface RecoverReviewTransactionOptions extends ReviewTransactionOptions {
  refresh: (target: ReviewTransactionRefreshTarget) => Promise<void>;
  requireMarker?: boolean;
}

export type ReviewTransactionRecovery =
  | "none"
  | "rolled-back"
  | "committed-cleaned";

/**
 * Creates immutable backups before publishing the durable transaction marker.
 * A crash before the marker is published is harmless because no production
 * state has been changed yet.
 */
export async function beginReviewTransaction(
  options: BeginReviewTransactionOptions
): Promise<ReviewTransactionRecord> {
  const markerPath = resolveMarkerPath(options.markerPath);
  if (await fileExists(markerPath)) {
    throw new Error(`review-transaction-already-exists:${markerPath}`);
  }
  if (!options.bible.trim() || !options.scope.trim()) {
    throw new Error("invalid-review-transaction-target");
  }
  if (options.files.length === 0) {
    throw new Error("review-transaction-requires-files");
  }

  const files: ReviewTransactionFile[] = [];
  for (const input of options.files) {
    const filePath = path.resolve(input.filePath);
    const backupPath = path.resolve(input.backupPath);
    const existed = await fileExists(filePath);
    await mkdir(path.dirname(backupPath), { recursive: true });
    if (existed) {
      await copyFile(filePath, backupPath);
    } else {
      // The task-specific backup path may remain from a previous run. It must
      // not be mistaken for evidence that this transaction's file existed.
      await rm(backupPath, { force: true });
    }
    const backup = existed ? await fingerprintFile(backupPath) : undefined;
    files.push({
      role: input.role,
      filePath,
      backupPath,
      existed,
      backupSha256: backup?.sha256,
      backupSize: backup?.size
    });
  }

  const now = new Date().toISOString();
  const transaction: ReviewTransactionRecord = {
    version: 1,
    bible: options.bible,
    scope: options.scope,
    phase: "backed-up",
    createdAt: now,
    updatedAt: now,
    files
  };
  await writeJsonFileAtomic(markerPath, transaction);
  return transaction;
}

export async function markReviewTransactionPhase(
  transaction: ReviewTransactionRecord,
  phase: Exclude<ReviewTransactionPhase, "backed-up" | "committed">,
  options: ReviewTransactionOptions = {}
): Promise<ReviewTransactionRecord> {
  const allowedNextPhase: Partial<
    Record<ReviewTransactionPhase, ReviewTransactionPhase>
  > = {
    "backed-up": "applied",
    applied: "refreshed"
  };
  if (allowedNextPhase[transaction.phase] !== phase) {
    throw new Error(
      `invalid-review-transaction-transition:${transaction.phase}->${phase}`
    );
  }
  return writeReviewTransactionPhase(transaction, phase, options);
}

/**
 * Makes the successful outcome durable before best-effort marker cleanup. If
 * cleanup is interrupted, the next apply sees `committed` and only removes the
 * marker; it never rolls back an already accepted transaction.
 */
export async function commitReviewTransaction(
  transaction: ReviewTransactionRecord,
  options: ReviewTransactionOptions = {}
): Promise<void> {
  if (transaction.phase !== "refreshed") {
    throw new Error(
      `invalid-review-transaction-transition:${transaction.phase}->committed`
    );
  }
  await writeReviewTransactionPhase(transaction, "committed", options);
  try {
    await rm(resolveMarkerPath(options.markerPath));
  } catch {
    // The committed marker is itself a safe durable state. A later invocation
    // will remove it before starting another transaction.
  }
}

/**
 * Recovers an interrupted transaction. Any non-committed phase is restored
 * from its recorded backups and refreshed before the marker can be removed.
 * Missing/corrupt backups and refresh failures leave the marker intact.
 */
export async function recoverReviewTransaction(
  options: RecoverReviewTransactionOptions
): Promise<ReviewTransactionRecovery> {
  const markerPath = resolveMarkerPath(options.markerPath);
  const transaction = await readReviewTransaction(markerPath);
  if (!transaction) {
    if (options.requireMarker) {
      throw new Error(`review-transaction-marker-missing:${markerPath}`);
    }
    return "none";
  }

  if (transaction.phase === "committed") {
    await rm(markerPath);
    return "committed-cleaned";
  }

  await assertBackupsAreRestorable(transaction);
  for (const file of transaction.files) {
    if (file.existed) {
      await restoreFileAtomically(file.backupPath, file.filePath);
    } else {
      await rm(file.filePath, { force: true });
    }
  }
  await options.refresh({
    bible: transaction.bible,
    scope: transaction.scope
  });
  await rm(markerPath);
  return "rolled-back";
}

export async function rollbackReviewTransaction(
  options: RecoverReviewTransactionOptions
): Promise<void> {
  const recovery = await recoverReviewTransaction({
    ...options,
    requireMarker: true
  });
  if (recovery !== "rolled-back") {
    throw new Error(`review-transaction-not-rolled-back:${recovery}`);
  }
}

async function writeReviewTransactionPhase(
  transaction: ReviewTransactionRecord,
  phase: ReviewTransactionPhase,
  options: ReviewTransactionOptions
): Promise<ReviewTransactionRecord> {
  const updated: ReviewTransactionRecord = {
    ...transaction,
    phase,
    updatedAt: new Date().toISOString()
  };
  await writeJsonFileAtomic(resolveMarkerPath(options.markerPath), updated);
  return updated;
}

async function readReviewTransaction(
  markerPath: string
): Promise<ReviewTransactionRecord | undefined> {
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(markerPath, "utf8"));
  } catch (error) {
    if (isNotFound(error)) return undefined;
    throw new Error(
      `invalid-review-transaction-marker:${markerPath}:${errorMessage(error)}`
    );
  }
  if (!isReviewTransactionRecord(raw)) {
    throw new Error(`invalid-review-transaction-marker:${markerPath}`);
  }
  return raw;
}

function isReviewTransactionRecord(
  value: unknown
): value is ReviewTransactionRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<ReviewTransactionRecord>;
  if (
    record.version !== 1 ||
    typeof record.bible !== "string" ||
    record.bible.length === 0 ||
    typeof record.scope !== "string" ||
    record.scope.length === 0 ||
    !isReviewTransactionPhase(record.phase) ||
    typeof record.createdAt !== "string" ||
    typeof record.updatedAt !== "string" ||
    !Array.isArray(record.files) ||
    record.files.length === 0
  ) {
    return false;
  }
  return record.files.every((file) => {
    if (!file || typeof file !== "object") return false;
    const candidate = file as Partial<ReviewTransactionFile>;
    return (
      (candidate.role === "curated-overrides" ||
        candidate.role === "decision-ledger") &&
      typeof candidate.filePath === "string" &&
      path.isAbsolute(candidate.filePath) &&
      typeof candidate.backupPath === "string" &&
      path.isAbsolute(candidate.backupPath) &&
      typeof candidate.existed === "boolean" &&
      (!candidate.existed ||
        (typeof candidate.backupSha256 === "string" &&
          /^[0-9a-f]{64}$/u.test(candidate.backupSha256) &&
          typeof candidate.backupSize === "number" &&
          Number.isInteger(candidate.backupSize) &&
          candidate.backupSize >= 0))
    );
  });
}

function isReviewTransactionPhase(
  value: unknown
): value is ReviewTransactionPhase {
  return (
    value === "backed-up" ||
    value === "applied" ||
    value === "refreshed" ||
    value === "committed"
  );
}

async function assertBackupsAreRestorable(
  transaction: ReviewTransactionRecord
): Promise<void> {
  for (const file of transaction.files) {
    if (!file.existed) continue;
    if (!(await fileExists(file.backupPath))) {
      throw new Error(
        `review-transaction-backup-missing:${file.role}:${file.backupPath}`
      );
    }
    const actual = await fingerprintFile(file.backupPath);
    if (
      actual.sha256 !== file.backupSha256 ||
      actual.size !== file.backupSize
    ) {
      throw new Error(
        `review-transaction-backup-corrupt:${file.role}:${file.backupPath}`
      );
    }
  }
}

async function fingerprintFile(
  filePath: string
): Promise<{ sha256: string; size: number }> {
  const content = await readFile(filePath);
  return {
    sha256: createHash("sha256").update(content).digest("hex"),
    size: content.byteLength
  };
}

async function restoreFileAtomically(
  backupPath: string,
  filePath: string
): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.restore-${process.pid}-${Date.now()}`;
  try {
    await copyFile(backupPath, temporaryPath);
    await rename(temporaryPath, filePath);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch (error) {
    if (isNotFound(error)) return false;
    throw error;
  }
}

function resolveMarkerPath(markerPath?: string): string {
  return path.resolve(markerPath ?? DEFAULT_REVIEW_TRANSACTION_MARKER);
}

function isNotFound(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
