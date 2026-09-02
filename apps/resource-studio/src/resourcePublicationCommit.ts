import { randomUUID } from "node:crypto";
import { lstat, mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";

import {
  discardPreparedResourcePublicationBundle,
  prepareResourcePublicationBundle,
  type PrepareResourcePublicationBundleOptions
} from "./resourcePublicationBundleLifecycle.js";

export async function commitResourcePublicationBundle<Result>(
  options: PrepareResourcePublicationBundleOptions<Result>
): Promise<Result> {
  const prepared = await prepareResourcePublicationBundle(options);
  try {
    await commitResourcePublicationTransaction({
      replacements: [
        {
          preparedPath: prepared.bundleDir,
          targetPath: prepared.outputDir,
          replaceExisting: false
        }
      ]
    });
    return prepared.result;
  } finally {
    await discardPreparedResourcePublicationBundle(prepared);
  }
}

export interface ResourcePublicationReplacement {
  readonly preparedPath: string;
  readonly targetPath: string;
  readonly replaceExisting?: boolean;
}

export interface ResourcePublicationCommitFileSystem {
  lstat(path: string): Promise<unknown>;
  mkdir(path: string, options: { recursive: true }): Promise<unknown>;
  rename(from: string, to: string): Promise<unknown>;
  rm(path: string, options: { recursive: true; force: true }): Promise<unknown>;
}

const defaultFileSystem: ResourcePublicationCommitFileSystem = {
  lstat,
  mkdir,
  rename,
  rm
};

const pathExists = async (
  fileSystem: ResourcePublicationCommitFileSystem,
  candidate: string
): Promise<boolean> => {
  try {
    await fileSystem.lstat(candidate);
    return true;
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return false;
    }
    throw error;
  }
};

export async function commitResourcePublicationTransaction(options: {
  replacements: readonly ResourcePublicationReplacement[];
  fileSystem?: ResourcePublicationCommitFileSystem;
}): Promise<void> {
  const fileSystem = options.fileSystem ?? defaultFileSystem;
  const replacements = options.replacements.map((replacement) => ({
    ...replacement,
    preparedPath: path.resolve(replacement.preparedPath),
    targetPath: path.resolve(replacement.targetPath)
  }));
  const targets = new Set(replacements.map((item) => item.targetPath));
  if (targets.size !== replacements.length) {
    throw new Error("resource-publication-commit-target-duplicate");
  }
  await Promise.all(
    replacements.map(async (replacement) => {
      if (!(await pathExists(fileSystem, replacement.preparedPath))) {
        throw new Error(
          `resource-publication-commit-prepared-missing:${replacement.preparedPath}`
        );
      }
      if (
        !replacement.replaceExisting &&
        (await pathExists(fileSystem, replacement.targetPath))
      ) {
        throw new Error(
          `resource-publication-commit-target-exists:${replacement.targetPath}`
        );
      }
      await fileSystem.mkdir(path.dirname(replacement.targetPath), {
        recursive: true
      });
    })
  );

  const transactionId = randomUUID();
  const backups = new Map<string, string>();
  const published: ResourcePublicationReplacement[] = [];
  try {
    for (const [index, replacement] of replacements.entries()) {
      if (await pathExists(fileSystem, replacement.targetPath)) {
        const backupPath = `${replacement.targetPath}.backup-${transactionId}-${index}`;
        await fileSystem.rename(replacement.targetPath, backupPath);
        backups.set(replacement.targetPath, backupPath);
      }
    }
    for (const replacement of replacements) {
      await fileSystem.rename(replacement.preparedPath, replacement.targetPath);
      published.push(replacement);
    }
  } catch (error) {
    for (const replacement of [...published].reverse()) {
      await fileSystem.rename(replacement.targetPath, replacement.preparedPath);
    }
    for (const replacement of [...replacements].reverse()) {
      const backupPath = backups.get(replacement.targetPath);
      if (backupPath && (await pathExists(fileSystem, backupPath))) {
        await fileSystem.rename(backupPath, replacement.targetPath);
      }
    }
    throw error;
  }
  await Promise.all(
    [...backups.values()].map((backupPath) =>
      fileSystem.rm(backupPath, { recursive: true, force: true })
    )
  );
}
