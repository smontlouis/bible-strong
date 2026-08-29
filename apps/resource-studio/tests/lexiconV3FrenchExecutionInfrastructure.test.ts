import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import {
  assertFrenchCodexImmutableBinary,
  prepareImmutableExecutableSnapshot
} from "../src/lexiconV3/frenchCodexImmutableBinary.js";
import {
  acquireFrenchCodexSqliteLock,
  FrenchCodexLockBusyError,
  frenchCodexSqliteLockIsActive
} from "../src/lexiconV3/frenchCodexSqliteLock.js";

test("SQLite execution locks are exclusive and release with the owning connection", () => {
  const directory = mkdtempSync(join(tmpdir(), "lexicon-v3-fr-lock-"));
  try {
    const path = join(directory, "role.lock");
    const release = acquireFrenchCodexSqliteLock(path);
    assert.equal(frenchCodexSqliteLockIsActive(path), true);
    assert.throws(
      () => acquireFrenchCodexSqliteLock(path),
      FrenchCodexLockBusyError
    );
    release();
    assert.equal(frenchCodexSqliteLockIsActive(path), false);
    const releaseAgain = acquireFrenchCodexSqliteLock(path);
    releaseAgain();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("immutable Codex validation rejects writable files and symlinks", () => {
  const directory = mkdtempSync(join(tmpdir(), "lexicon-v3-fr-binary-"));
  try {
    const writable = join(directory, "codex-writable");
    writeFileSync(writable, "not-the-pinned-binary", { mode: 0o755 });
    chmodSync(writable, 0o755);
    assert.throws(
      () => assertFrenchCodexImmutableBinary(writable),
      /immutable-binary-writable/u
    );
    const symlink = join(directory, "codex-link");
    symlinkSync(writable, symlink);
    assert.throws(
      () => assertFrenchCodexImmutableBinary(symlink),
      /binary-not-regular/u
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("an immutable execution snapshot defeats source pathname substitution before spawn", () => {
  const directory = mkdtempSync(join(tmpdir(), "lexicon-v3-fr-toctou-"));
  const source = join(directory, "codex");
  const original = join(directory, "codex-original");
  const replacement = join(directory, "codex-replacement");
  const good = `#!/bin/sh
if [ "\${1:-}" = "--version" ]; then
  printf '%s\\n' 'fake-codex 1'
  exit 0
fi
printf '%s\\n' 'sealed-good'
`;
  const bad = `#!/bin/sh
if [ "\${1:-}" = "--version" ]; then
  printf '%s\\n' 'fake-codex evil'
  exit 0
fi
printf '%s\\n' 'substituted-bad'
`;
  writeFileSync(source, good, { mode: 0o500 });
  writeFileSync(replacement, bad, { mode: 0o500 });
  chmodSync(source, 0o500);
  chmodSync(replacement, 0o500);
  const snapshot = prepareImmutableExecutableSnapshot({
    sourcePath: source,
    expectedSha256: createHash("sha256").update(good).digest("hex"),
    expectedVersion: "fake-codex 1"
  });
  const snapshotDirectory = dirname(snapshot.executionPath);
  try {
    // This is the exact old race: the validated source pathname is replaced
    // before spawn. The runner now executes the already-verified private copy.
    renameSync(source, original);
    renameSync(replacement, source);
    const executed = spawnSync(snapshot.executionPath, ["run"], {
      encoding: "utf8"
    });
    assert.equal(executed.status, 0);
    assert.equal(executed.stdout.trim(), "sealed-good");
    snapshot.assertUnchanged();

    const substituted = spawnSync(source, ["run"], { encoding: "utf8" });
    assert.equal(substituted.status, 0);
    assert.equal(substituted.stdout.trim(), "substituted-bad");
  } finally {
    snapshot.dispose();
    assert.equal(existsSync(snapshotDirectory), false);
    rmSync(directory, { recursive: true, force: true });
  }
});
