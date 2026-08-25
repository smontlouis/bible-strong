import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  beginReviewTransaction,
  markReviewTransactionPhase,
  recoverReviewTransaction,
  rollbackReviewTransaction
} from "../src/reviewTransaction.js";

test("recovers both review state files and refreshes the recorded target", async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "strong-review-transaction-")
  );
  const markerPath = path.join(directory, "transaction.json");
  const overridesPath = path.join(directory, "curated-overrides.json");
  const decisionsPath = path.join(directory, "decisions.json");
  const overridesBackup = path.join(directory, "backup", "overrides.json");
  const decisionsBackup = path.join(directory, "backup", "decisions.json");
  await writeFile(overridesPath, "original-overrides", "utf8");

  let transaction = await beginReviewTransaction({
    bible: "nbs",
    scope: "Gen.1",
    markerPath,
    files: [
      {
        role: "curated-overrides",
        filePath: overridesPath,
        backupPath: overridesBackup
      },
      {
        role: "decision-ledger",
        filePath: decisionsPath,
        backupPath: decisionsBackup
      }
    ]
  });
  assert.deepEqual(
    transaction.files.map(({ role, existed }) => ({ role, existed })),
    [
      { role: "curated-overrides", existed: true },
      { role: "decision-ledger", existed: false }
    ]
  );

  await writeFile(overridesPath, "partially-applied-overrides", "utf8");
  await writeFile(decisionsPath, "new-decisions", "utf8");
  transaction = await markReviewTransactionPhase(transaction, "applied", {
    markerPath
  });
  assert.equal(transaction.phase, "applied");

  const refreshed: Array<{ bible: string; scope: string }> = [];
  const recovery = await recoverReviewTransaction({
    markerPath,
    refresh: async (target) => {
      refreshed.push(target);
      assert.equal(await readFile(overridesPath, "utf8"), "original-overrides");
      await assert.rejects(access(decisionsPath));
    }
  });

  assert.equal(recovery, "rolled-back");
  assert.deepEqual(refreshed, [{ bible: "nbs", scope: "Gen.1" }]);
  assert.equal(await readFile(overridesPath, "utf8"), "original-overrides");
  await assert.rejects(access(decisionsPath));
  await assert.rejects(access(markerPath));
});

test("keeps the marker when rollback refresh fails so recovery can retry", async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "strong-review-refresh-failure-")
  );
  const markerPath = path.join(directory, "transaction.json");
  const statePath = path.join(directory, "state.json");
  const backupPath = path.join(directory, "state.backup.json");
  await writeFile(statePath, "before", "utf8");
  const transaction = await beginReviewTransaction({
    bible: "nbs",
    scope: "Exod.2",
    markerPath,
    files: [
      {
        role: "curated-overrides",
        filePath: statePath,
        backupPath
      }
    ]
  });
  await writeFile(statePath, "after", "utf8");
  await markReviewTransactionPhase(transaction, "applied", { markerPath });

  await assert.rejects(
    recoverReviewTransaction({
      markerPath,
      refresh: async () => {
        throw new Error("refresh-failed");
      }
    }),
    /refresh-failed/u
  );
  assert.equal(await readFile(statePath, "utf8"), "before");
  await access(markerPath);

  let refreshCount = 0;
  assert.equal(
    await recoverReviewTransaction({
      markerPath,
      refresh: async () => {
        refreshCount += 1;
      }
    }),
    "rolled-back"
  );
  assert.equal(refreshCount, 1);
  await assert.rejects(access(markerPath));
});

test("fails closed and retains the marker when an expected backup is missing", async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "strong-review-missing-backup-")
  );
  const markerPath = path.join(directory, "transaction.json");
  const statePath = path.join(directory, "state.json");
  const backupPath = path.join(directory, "state.backup.json");
  await writeFile(statePath, "before", "utf8");
  const transaction = await beginReviewTransaction({
    bible: "nbs",
    scope: "Matt.1",
    markerPath,
    files: [
      {
        role: "curated-overrides",
        filePath: statePath,
        backupPath
      }
    ]
  });
  await writeFile(statePath, "after", "utf8");
  await markReviewTransactionPhase(transaction, "applied", { markerPath });
  await rm(backupPath);
  let refreshed = false;

  await assert.rejects(
    recoverReviewTransaction({
      markerPath,
      refresh: async () => {
        refreshed = true;
      }
    }),
    /review-transaction-backup-missing/u
  );
  assert.equal(refreshed, false);
  assert.equal(await readFile(statePath, "utf8"), "after");
  await access(markerPath);
});

test("fails closed when a transaction backup was altered", async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "strong-review-corrupt-backup-")
  );
  const markerPath = path.join(directory, "transaction.json");
  const statePath = path.join(directory, "state.json");
  const backupPath = path.join(directory, "state.backup.json");
  await writeFile(statePath, "before", "utf8");
  const transaction = await beginReviewTransaction({
    bible: "nbs",
    scope: "Luke.2",
    markerPath,
    files: [
      {
        role: "curated-overrides",
        filePath: statePath,
        backupPath
      }
    ]
  });
  await writeFile(statePath, "after", "utf8");
  await markReviewTransactionPhase(transaction, "applied", { markerPath });
  await writeFile(backupPath, "tampered", "utf8");

  await assert.rejects(
    recoverReviewTransaction({
      markerPath,
      refresh: async () => undefined
    }),
    /review-transaction-backup-corrupt/u
  );
  assert.equal(await readFile(statePath, "utf8"), "after");
  await access(markerPath);
});

test("a committed crash marker is cleaned without restoring accepted state", async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "strong-review-committed-")
  );
  const markerPath = path.join(directory, "transaction.json");
  const statePath = path.join(directory, "state.json");
  const backupPath = path.join(directory, "state.backup.json");
  await writeFile(statePath, "before", "utf8");
  const transaction = await beginReviewTransaction({
    bible: "nbs",
    scope: "Rom.8",
    markerPath,
    files: [
      {
        role: "curated-overrides",
        filePath: statePath,
        backupPath
      }
    ]
  });
  await writeFile(statePath, "accepted", "utf8");
  const applied = await markReviewTransactionPhase(transaction, "applied", {
    markerPath
  });
  const refreshed = await markReviewTransactionPhase(applied, "refreshed", {
    markerPath
  });
  await writeFile(
    markerPath,
    `${JSON.stringify({ ...refreshed, phase: "committed" }, null, 2)}\n`,
    "utf8"
  );
  let refreshCalled = false;

  assert.equal(
    await recoverReviewTransaction({
      markerPath,
      refresh: async () => {
        refreshCalled = true;
      }
    }),
    "committed-cleaned"
  );
  assert.equal(refreshCalled, false);
  assert.equal(await readFile(statePath, "utf8"), "accepted");
  await assert.rejects(access(markerPath));
});

test("explicit rollback requires its durable marker", async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "strong-review-no-marker-")
  );
  await assert.rejects(
    rollbackReviewTransaction({
      markerPath: path.join(directory, "missing.json"),
      refresh: async () => undefined
    }),
    /review-transaction-marker-missing/u
  );
});
