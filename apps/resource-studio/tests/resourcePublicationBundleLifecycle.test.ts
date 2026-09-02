import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  discardPreparedResourcePublicationBundle,
  prepareResourcePublicationBundle
} from "../src/resourcePublicationBundleLifecycle.js";
import {
  commitResourcePublicationBundle,
  commitResourcePublicationTransaction
} from "../src/resourcePublicationCommit.js";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true }))
  );
});

const temporaryRoot = async () => {
  const root = await mkdtemp(
    path.join(os.tmpdir(), "resource-publication-lifecycle-")
  );
  temporaryRoots.push(root);
  return root;
};

describe("Resource publication bundle lifecycle", () => {
  it("keeps a validated bundle invisible until the commit module publishes it", async () => {
    const root = await temporaryRoot();
    const outputDir = path.join(root, "published", "bible-lsg");

    const prepared = await prepareResourcePublicationBundle({
      outputDir,
      build: async (bundleDir) => {
        await writeFile(path.join(bundleDir, "work"), "implementation-only\n");
        await writeFile(path.join(bundleDir, "manifest.json"), "validated\n");
        return { revision: "lsg-1" };
      },
      validate: async (bundleDir) => {
        assert.equal(existsSync(path.join(bundleDir, "work")), false);
        assert.equal(
          await readFile(path.join(bundleDir, "manifest.json"), "utf8"),
          "validated\n"
        );
      }
    });

    assert.equal(existsSync(outputDir), false);
    assert.equal(existsSync(prepared.bundleDir), true);
    assert.deepEqual(prepared.result, { revision: "lsg-1" });

    await discardPreparedResourcePublicationBundle(prepared);
    assert.equal(existsSync(prepared.bundleDir), false);
  });

  it("removes the invisible bundle when family validation fails", async () => {
    const root = await temporaryRoot();
    const outputDir = path.join(root, "published", "invalid");
    let bundleDir = "";

    await assert.rejects(
      prepareResourcePublicationBundle({
        outputDir,
        build: async (candidateDir) => {
          bundleDir = candidateDir;
          await writeFile(
            path.join(candidateDir, "manifest.json"),
            "invalid\n"
          );
          return undefined;
        },
        validate: async () => {
          throw new Error("publication-parity-invalid");
        }
      }),
      /publication-parity-invalid/
    );

    assert.equal(existsSync(outputDir), false);
    assert.equal(existsSync(bundleDir), false);
  });

  it("publishes only after validation and removes staging state", async () => {
    const root = await temporaryRoot();
    const outputDir = path.join(root, "published", "nave-fr");
    const calls: string[] = [];

    const result = await commitResourcePublicationBundle({
      outputDir,
      build: async (bundleDir) => {
        calls.push("build");
        await writeFile(path.join(bundleDir, "manifest.json"), "ready\n");
        return { revision: "nave-1" };
      },
      validate: async (bundleDir) => {
        calls.push("validate");
        assert.equal(existsSync(outputDir), false);
        assert.equal(existsSync(bundleDir), true);
      }
    });

    assert.deepEqual(calls, ["build", "validate"]);
    assert.deepEqual(result, { revision: "nave-1" });
    assert.equal(
      await readFile(path.join(outputDir, "manifest.json"), "utf8"),
      "ready\n"
    );
    assert.deepEqual(await readdir(path.dirname(outputDir)), ["nave-fr"]);
  });

  it("does not replace an existing published bundle", async () => {
    const root = await temporaryRoot();
    const outputDir = path.join(root, "published");
    await writeFile(outputDir, "existing\n");

    await assert.rejects(
      commitResourcePublicationBundle({
        outputDir,
        build: async (bundleDir) => {
          await writeFile(path.join(bundleDir, "manifest.json"), "candidate\n");
          return undefined;
        },
        validate: async () => undefined
      })
    );

    assert.equal(await readFile(outputDir, "utf8"), "existing\n");
  });

  it("restores every bundle and catalog projection when a commit fails", async () => {
    const root = await temporaryRoot();
    const preparedBundle = path.join(root, "prepared-bundle");
    const preparedCatalog = path.join(root, "prepared-catalog.json");
    const publishedBundle = path.join(root, "published-bundle");
    const publishedCatalog = path.join(root, "catalog.json");
    await Promise.all([
      mkdir(preparedBundle),
      mkdir(publishedBundle),
      writeFile(preparedCatalog, "new catalog\n"),
      writeFile(publishedCatalog, "old catalog\n")
    ]);
    await Promise.all([
      writeFile(path.join(preparedBundle, "manifest.json"), "new bundle\n"),
      writeFile(path.join(publishedBundle, "manifest.json"), "old bundle\n")
    ]);
    let renameCount = 0;

    await assert.rejects(
      commitResourcePublicationTransaction({
        replacements: [
          {
            preparedPath: preparedBundle,
            targetPath: publishedBundle,
            replaceExisting: true
          },
          {
            preparedPath: preparedCatalog,
            targetPath: publishedCatalog,
            replaceExisting: true
          }
        ],
        fileSystem: {
          lstat,
          mkdir,
          rm,
          rename: async (from, to) => {
            renameCount += 1;
            if (renameCount === 4) throw new Error("simulated-commit-failure");
            await rename(from, to);
          }
        }
      }),
      /simulated-commit-failure/
    );

    assert.equal(
      await readFile(path.join(publishedBundle, "manifest.json"), "utf8"),
      "old bundle\n"
    );
    assert.equal(await readFile(publishedCatalog, "utf8"), "old catalog\n");
    assert.equal(
      await readFile(path.join(preparedBundle, "manifest.json"), "utf8"),
      "new bundle\n"
    );
  });
});
