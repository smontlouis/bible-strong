import assert from "node:assert/strict";
import {
  cpSync,
  existsSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { validateStrongLexiconResourcePublication } from "../src/packageStrongLexiconResourcePublications.js";

const root = process.env.STRONG_LEXICON_BUNDLES_ROOT;
if (!root || !existsSync(root)) {
  throw new Error("STRONG_LEXICON_BUNDLES_ROOT is required");
}

const workspace = await mkdtemp(path.join(tmpdir(), "strong-lexicon-smoke-"));
const moduleIds = ["core", "resources", "entities"] as const;
const currentArchiveName = (moduleId: (typeof moduleIds)[number]): string =>
  moduleId === "core"
    ? "strong_lexicon.core.sqlite.zip"
    : moduleId === "resources"
      ? "strong_lexicon.resources.sqlite.zip"
      : "bible_entities.production.sqlite.zip";

const expectRejected = async (
  bundleDir: string,
  mutate: (manifest: any) => void,
  mutateFiles?: (bundleDir: string) => void
) => {
  const manifestPath = path.join(bundleDir, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as any;
  mutate(manifest);
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  mutateFiles?.(bundleDir);
  await assert.rejects(validateStrongLexiconResourcePublication(bundleDir));
};

try {
  for (const moduleId of moduleIds) {
    const source = path.join(root, moduleId);
    const validCopy = path.join(workspace, `${moduleId}-valid`);
    cpSync(source, validCopy, { recursive: true });
    const manifest = await validateStrongLexiconResourcePublication(validCopy);
    assert.equal(manifest.identity.moduleId, moduleId);

    const wrongEntryCopy = path.join(workspace, `${moduleId}-entry`);
    cpSync(source, wrongEntryCopy, { recursive: true });
    await expectRejected(wrongEntryCopy, (current) => {
      current.offlineArtifact.entry = "unexpected.sqlite";
    });

    const canonicalCopy = path.join(workspace, `${moduleId}-canonical`);
    cpSync(source, canonicalCopy, { recursive: true });
    await expectRejected(canonicalCopy, (current) => {
      current.canonical.bytes += 1;
    });

    const checksumCopy = path.join(workspace, `${moduleId}-checksum`);
    cpSync(source, checksumCopy, { recursive: true });
    await expectRejected(checksumCopy, (current) => {
      current.offlineArtifact.sha256 = "0".repeat(64);
    });

    const rightsCopy = path.join(workspace, `${moduleId}-rights`);
    cpSync(source, rightsCopy, { recursive: true });
    await expectRejected(rightsCopy, (current) => {
      current.rights.holder = "   ";
    });

    const schemaCopy = path.join(workspace, `${moduleId}-schema`);
    cpSync(source, schemaCopy, { recursive: true });
    await expectRejected(schemaCopy, (current) => {
      current.canonical.schemaVersion = 999;
    });

    const archiveCopy = path.join(workspace, `${moduleId}-archive`);
    cpSync(source, archiveCopy, { recursive: true });
    await expectRejected(
      archiveCopy,
      (current) => {
        current.offlineArtifact.bytes += 1;
      },
      (bundleDir) => {
        const archivePath = path.join(
          bundleDir,
          "offline",
          currentArchiveName(moduleId)
        );
        const archive = readFileSync(archivePath);
        archive[0] = archive[0]! ^ 0xff;
        writeFileSync(archivePath, archive);
      }
    );

    if (moduleId !== "core") {
      const dependencyCopy = path.join(workspace, `${moduleId}-dependency`);
      cpSync(source, dependencyCopy, { recursive: true });
      await expectRejected(dependencyCopy, (current) => {
        current.dependencies[0].revision = "strong-lexicon-core-invalid";
      });
    }
  }
  console.log("strong lexicon publication smoke ok", {
    modules: moduleIds.length
  });
} finally {
  rmSync(workspace, { recursive: true, force: true });
}
