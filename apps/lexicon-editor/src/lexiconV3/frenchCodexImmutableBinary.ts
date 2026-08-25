import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  constants,
  existsSync,
  linkSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync
} from "node:fs";
import { dirname, join, resolve } from "node:path";

import {
  FRENCH_INTERNAL_PINNED_CODEX_SHA256,
  FRENCH_INTERNAL_PINNED_CODEX_VERSION
} from "./frenchCodexExecutionReceipt.js";

export const FRENCH_CODEX_MUTABLE_BUNDLE_BINARY =
  "/Applications/ChatGPT.app/Contents/Resources/codex" as const;
export const FRENCH_CODEX_IMMUTABLE_BINARY_PATH = resolve(
  "outputs/lexicon-v3/fr-internal/codex-runtime",
  `codex-${FRENCH_INTERNAL_PINNED_CODEX_SHA256}`
);

export interface FrenchCodexImmutableBinaryIdentity {
  path: string;
  version: typeof FRENCH_INTERNAL_PINNED_CODEX_VERSION;
  sha256: typeof FRENCH_INTERNAL_PINNED_CODEX_SHA256;
}

export interface ImmutableExecutableSnapshot {
  sourcePath: string;
  executionPath: string;
  sha256: string;
  version: string;
  assertUnchanged(): void;
  dispose(): void;
}

export interface ImmutableExecutableSnapshotOptions {
  sourcePath: string;
  expectedSha256: string;
  expectedVersion: string;
  versionArgs?: readonly string[];
  versionCwd?: string;
  versionEnvironment?: NodeJS.ProcessEnv;
  requireReadOnlySource?: boolean;
  snapshotParentDirectory?: string;
}

/**
 * Stages the signed/pinned app binary once into a content-addressed, read-only
 * path. Full runners execute only this frozen copy; the auto-updated app bundle
 * is never their live executable.
 */
export function ensureFrenchCodexImmutableBinary(input: {
  requestedPath: string;
  sourcePath?: string;
}): FrenchCodexImmutableBinaryIdentity {
  const requestedPath = resolve(input.requestedPath);
  if (!existsSync(requestedPath)) {
    if (requestedPath !== FRENCH_CODEX_IMMUTABLE_BINARY_PATH) {
      throw new Error(`french-codex-immutable-binary-missing:${requestedPath}`);
    }
    stageFrenchCodexImmutableBinary({
      sourcePath: input.sourcePath ?? FRENCH_CODEX_MUTABLE_BUNDLE_BINARY,
      destinationPath: requestedPath
    });
  }
  return assertFrenchCodexImmutableBinary(requestedPath);
}

export function stageFrenchCodexImmutableBinary(input: {
  sourcePath: string;
  destinationPath?: string;
}): FrenchCodexImmutableBinaryIdentity {
  const sourcePath = resolve(input.sourcePath);
  const destinationPath = resolve(
    input.destinationPath ?? FRENCH_CODEX_IMMUTABLE_BINARY_PATH
  );
  if (sourcePath === destinationPath) {
    return assertFrenchCodexImmutableBinary(destinationPath);
  }
  assertRegularNonSymlink(sourcePath, "source");
  const sourceHashBefore = sha256File(sourcePath);
  if (sourceHashBefore !== FRENCH_INTERNAL_PINNED_CODEX_SHA256) {
    throw new Error(`french-codex-stage-source-unpinned:${sourceHashBefore}`);
  }
  assertPinnedVersion(sourcePath);
  if (existsSync(destinationPath)) {
    return assertFrenchCodexImmutableBinary(destinationPath);
  }

  mkdirSync(dirname(destinationPath), { recursive: true, mode: 0o755 });
  const temporaryPath = `${destinationPath}.tmp-${process.pid}-${Date.now()}`;
  try {
    copyFileSync(sourcePath, temporaryPath, constants.COPYFILE_EXCL);
    chmodSync(temporaryPath, 0o555);
    assertRegularNonSymlink(temporaryPath, "staged");
    if (sha256File(temporaryPath) !== sourceHashBefore) {
      throw new Error("french-codex-stage-copy-hash-mismatch");
    }
    assertPinnedVersion(temporaryPath);
    if (sha256File(sourcePath) !== sourceHashBefore) {
      throw new Error("french-codex-stage-source-drift");
    }
    try {
      linkSync(temporaryPath, destinationPath);
    } catch (error) {
      if (
        (error as NodeJS.ErrnoException).code !== "EEXIST" ||
        !existsSync(destinationPath)
      ) {
        throw error;
      }
    }
  } finally {
    rmSync(temporaryPath, { force: true });
  }
  return assertFrenchCodexImmutableBinary(destinationPath);
}

export function assertFrenchCodexImmutableBinary(
  pathValue: string
): FrenchCodexImmutableBinaryIdentity {
  const path = resolve(pathValue);
  assertRegularNonSymlink(path, "runtime");
  const stat = lstatSync(path);
  if ((stat.mode & 0o222) !== 0) {
    throw new Error(`french-codex-immutable-binary-writable:${path}`);
  }
  const snapshot = prepareImmutableExecutableSnapshot({
    sourcePath: path,
    expectedSha256: FRENCH_INTERNAL_PINNED_CODEX_SHA256,
    expectedVersion: FRENCH_INTERNAL_PINNED_CODEX_VERSION,
    versionArgs: ["--version"],
    versionCwd: dirname(path),
    versionEnvironment: pinnedVersionEnvironment(path),
    requireReadOnlySource: true
  });
  try {
    return {
      path,
      version: FRENCH_INTERNAL_PINNED_CODEX_VERSION,
      sha256: FRENCH_INTERNAL_PINNED_CODEX_SHA256
    };
  } finally {
    snapshot.dispose();
  }
}

/**
 * Darwin cannot execute an already-open descriptor (`/dev/fd/N` is mounted
 * noexec and Node exposes neither fexecve nor execveat). Each model invocation
 * therefore runs a fresh private copy-on-write snapshot, not the mutable
 * content-addressed pathname that was inspected. Replacing that source path
 * after this function returns cannot change the bytes passed to spawn.
 */
export function prepareFrenchCodexImmutableExecution(
  pathValue: string
): ImmutableExecutableSnapshot & {
  identity: FrenchCodexImmutableBinaryIdentity;
} {
  const path = resolve(pathValue);
  const snapshot = prepareImmutableExecutableSnapshot({
    sourcePath: path,
    expectedSha256: FRENCH_INTERNAL_PINNED_CODEX_SHA256,
    expectedVersion: FRENCH_INTERNAL_PINNED_CODEX_VERSION,
    versionArgs: ["--version"],
    versionCwd: dirname(path),
    versionEnvironment: pinnedVersionEnvironment(path),
    requireReadOnlySource: true
  });
  return {
    ...snapshot,
    identity: {
      path,
      version: FRENCH_INTERNAL_PINNED_CODEX_VERSION,
      sha256: FRENCH_INTERNAL_PINNED_CODEX_SHA256
    }
  };
}

/**
 * Generic primitive exported so the pathname-substitution guarantee can be
 * tested with a tiny hermetic executable instead of the real Codex binary.
 */
export function prepareImmutableExecutableSnapshot(
  input: ImmutableExecutableSnapshotOptions
): ImmutableExecutableSnapshot {
  const sourcePath = resolve(input.sourcePath);
  const versionArgs = [...(input.versionArgs ?? ["--version"])];
  const sourceBefore = assertSnapshotSource(
    sourcePath,
    input.requireReadOnlySource ?? true
  );
  const snapshotDirectory = mkdtempSync(
    join(
      resolve(input.snapshotParentDirectory ?? dirname(sourcePath)),
      ".codex-exec-"
    )
  );
  const executionPath = join(snapshotDirectory, "codex");
  let disposed = false;
  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    try {
      chmodSync(snapshotDirectory, 0o700);
    } catch {
      // Cleanup below is best-effort after a fail-closed verification error.
    }
    try {
      chmodSync(executionPath, 0o700);
    } catch {
      // The file may already be absent after a partially completed cleanup.
    }
    rmSync(snapshotDirectory, { recursive: true, force: true });
  };

  try {
    copyFileSync(
      sourcePath,
      executionPath,
      constants.COPYFILE_EXCL | constants.COPYFILE_FICLONE
    );
    chmodSync(executionPath, 0o500);
    assertSnapshotFile(executionPath, input.expectedSha256);
    const version = assertExpectedVersion({
      path: executionPath,
      args: versionArgs,
      expectedVersion: input.expectedVersion,
      cwd: resolve(input.versionCwd ?? snapshotDirectory),
      environment: input.versionEnvironment
    });
    assertSnapshotFile(executionPath, input.expectedSha256);
    const sourceAfter = assertSnapshotSource(
      sourcePath,
      input.requireReadOnlySource ?? true
    );
    if (
      sourceBefore.dev !== sourceAfter.dev ||
      sourceBefore.ino !== sourceAfter.ino ||
      sourceBefore.size !== sourceAfter.size ||
      sha256File(sourcePath) !== input.expectedSha256
    ) {
      throw new Error(`immutable-executable-source-drift:${sourcePath}`);
    }
    chmodSync(snapshotDirectory, 0o500);

    const assertUnchanged = (): void => {
      if (disposed) throw new Error("immutable-executable-snapshot-disposed");
      const directoryStat = lstatSync(snapshotDirectory);
      if (
        !directoryStat.isDirectory() ||
        directoryStat.isSymbolicLink() ||
        (directoryStat.mode & 0o222) !== 0
      ) {
        throw new Error(
          `immutable-executable-snapshot-directory-drift:${snapshotDirectory}`
        );
      }
      assertSnapshotFile(executionPath, input.expectedSha256);
    };

    return {
      sourcePath,
      executionPath,
      sha256: input.expectedSha256,
      version,
      assertUnchanged,
      dispose
    };
  } catch (error) {
    dispose();
    throw error;
  }
}

function assertRegularNonSymlink(path: string, label: string): void {
  let stat;
  try {
    stat = lstatSync(path);
  } catch {
    throw new Error(`french-codex-${label}-binary-missing:${path}`);
  }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) {
    throw new Error(`french-codex-${label}-binary-not-regular:${path}`);
  }
}

function assertPinnedVersion(
  path: string
): typeof FRENCH_INTERNAL_PINNED_CODEX_VERSION {
  const snapshot = prepareImmutableExecutableSnapshot({
    sourcePath: path,
    expectedSha256: FRENCH_INTERNAL_PINNED_CODEX_SHA256,
    expectedVersion: FRENCH_INTERNAL_PINNED_CODEX_VERSION,
    versionArgs: ["--version"],
    versionCwd: dirname(path),
    versionEnvironment: pinnedVersionEnvironment(path),
    requireReadOnlySource: false,
    snapshotParentDirectory: process.env.TMPDIR?.trim() || "/tmp"
  });
  try {
    return FRENCH_INTERNAL_PINNED_CODEX_VERSION;
  } finally {
    snapshot.dispose();
  }
}

function assertSnapshotSource(path: string, requireReadOnly: boolean) {
  assertRegularNonSymlink(path, "snapshot-source");
  const stat = lstatSync(path);
  if (requireReadOnly && (stat.mode & 0o222) !== 0) {
    throw new Error(`immutable-executable-source-writable:${path}`);
  }
  return stat;
}

function assertSnapshotFile(path: string, expectedSha256: string): void {
  assertRegularNonSymlink(path, "execution-snapshot");
  const stat = lstatSync(path);
  if ((stat.mode & 0o222) !== 0) {
    throw new Error(`immutable-executable-snapshot-writable:${path}`);
  }
  const sha256 = sha256File(path);
  if (sha256 !== expectedSha256) {
    throw new Error(`immutable-executable-snapshot-unpinned:${sha256}`);
  }
}

function assertExpectedVersion(input: {
  path: string;
  args: readonly string[];
  expectedVersion: string;
  cwd: string;
  environment?: NodeJS.ProcessEnv;
}): string {
  const result = spawnSync(input.path, input.args, {
    cwd: input.cwd,
    env: input.environment,
    encoding: "utf8",
    timeout: 30_000
  });
  const version = typeof result.stdout === "string" ? result.stdout.trim() : "";
  if (result.status !== 0 || version !== input.expectedVersion) {
    throw new Error(`immutable-executable-version:${version}`);
  }
  return version;
}

function pinnedVersionEnvironment(path: string): NodeJS.ProcessEnv {
  return {
    HOME: dirname(path),
    CODEX_HOME: dirname(path),
    USER: "codex-agent",
    LOGNAME: "codex-agent",
    SHELL: "/bin/zsh",
    PATH: "/usr/bin:/bin:/usr/sbin:/sbin",
    LANG: "C.UTF-8",
    LC_ALL: "C.UTF-8",
    TMPDIR: process.env.TMPDIR?.trim() || "/tmp",
    TERM: "dumb",
    NO_COLOR: "1"
  };
}

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}
