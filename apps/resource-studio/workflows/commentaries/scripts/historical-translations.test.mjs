import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { sha256 } from "./firestore.mjs";
import {
  applyHistoricalTranslations,
  loadHistoricalTranslations,
  writeHistoricalTranslationStore
} from "./historical-translations.mjs";

const canonical = (translation = null) => ({
  id: "sdabc:1-1-1:1",
  passage: "1-1-1",
  source: { language: "en", html: "<p>Source</p>", sha256: "source-hash" },
  translation
});

const stored = (overrides = {}) => ({
  id: "sdabc:1-1-1:1",
  passage: "1-1-1",
  sourceSha256: "source-hash",
  historicalId: "3",
  historicalSourceSha256: "old-source-hash",
  translatedHtml: "<p>Traduction</p>",
  translationSha256: sha256("<p>Traduction</p>"),
  ...overrides
});

test("charge un magasin historical-import sans inventer de modèle", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "historical-store-"));
  await writeHistoricalTranslationStore({
    root,
    resourceId: "sdabc",
    snapshotSha256: "snapshot-hash",
    entries: [stored()],
    batchSize: 1
  });
  const loaded = await loadHistoricalTranslations(root, "sdabc");
  assert.equal(loaded.translations.size, 1);
  assert.equal(
    loaded.translations.get("sdabc:1-1-1:1").origin.kind,
    "historical-import"
  );
  assert.equal(
    "model" in loaded.translations.get("sdabc:1-1-1:1").origin,
    false
  );
  assert.ok(loaded.revision);
});

test("réapplique un import historique de façon idempotente", () => {
  const translations = new Map([
    [
      "sdabc:1-1-1:1",
      {
        ...stored(),
        batchId: "sdabc-historical-0001",
        origin: { kind: "historical-import", snapshotSha256: "snapshot-hash" }
      }
    ]
  ]);
  const first = applyHistoricalTranslations(
    "sdabc",
    [canonical()],
    translations
  );
  assert.equal(first.applied, 1);
  assert.equal(first.entries[0].translation.origin.kind, "historical-import");
  const second = applyHistoricalTranslations(
    "sdabc",
    first.entries,
    translations
  );
  assert.equal(second.applied, 0);
  assert.equal(second.unchanged, 1);
  assert.deepEqual(second.entries, first.entries);
});

test("refuse un hash source canonique différent", () => {
  const translations = new Map([
    [
      "sdabc:1-1-1:1",
      {
        ...stored({ sourceSha256: "ancienne-revision" }),
        batchId: "batch",
        origin: { kind: "historical-import", snapshotSha256: "snapshot" }
      }
    ]
  ]);
  assert.throws(
    () => applyHistoricalTranslations("sdabc", [canonical()], translations),
    /source canonique a changé/
  );
});

test("refuse d’écraser une traduction différente", () => {
  const translations = new Map([
    [
      "sdabc:1-1-1:1",
      {
        ...stored(),
        batchId: "batch",
        origin: { kind: "historical-import", snapshotSha256: "snapshot" }
      }
    ]
  ]);
  const existing = {
    language: "fr",
    html: "<p>Autre</p>",
    sha256: sha256("<p>Autre</p>"),
    provenance: "Codex"
  };
  assert.throws(
    () =>
      applyHistoricalTranslations("sdabc", [canonical(existing)], translations),
    /Refus d’écraser/
  );
});

test("l’installation SDABC recharge le magasin versionné sur une reconstruction", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "sdabc-install-"));
  const sdabcRoot = path.join(root, "sdabc-export");
  const egwRoot = path.join(root, "egw-export");
  const libraryRoot = path.join(root, "library");
  const storeRoot = path.join(root, "historical");
  const publishedRoot = path.join(root, "published");
  await Promise.all([
    mkdir(sdabcRoot, { recursive: true }),
    mkdir(egwRoot, { recursive: true }),
    mkdir(libraryRoot, { recursive: true }),
    mkdir(publishedRoot, { recursive: true })
  ]);
  const general = [
    {
      schemaVersion: 1,
      id: "sdabc:1-1-1:1",
      passage: "1-1-1",
      passageEndVerse: 1,
      referenceLabel: "Genesis 1:1",
      verseExpression: "1",
      source: {
        language: "en",
        html: "<p>Source</p>",
        sha256: "source-hash"
      },
      translation: null,
      editorialKind: "general-commentary"
    }
  ];
  const generalRaw = JSON.stringify(general);
  const emptyRaw = "[]";
  await writeFile(path.join(sdabcRoot, "commentary.json"), generalRaw);
  await writeFile(path.join(egwRoot, "commentary.json"), emptyRaw);
  await writeFile(path.join(egwRoot, "scripture-index.json"), emptyRaw);
  await writeFile(
    path.join(sdabcRoot, "manifest.json"),
    JSON.stringify({
      authorization: { status: "confirmed-by-project-owner" },
      counts: { entries: 1 },
      artifacts: {
        commentary: {
          path: "commentary.json",
          sha256: sha256(generalRaw)
        }
      }
    })
  );
  await writeFile(
    path.join(egwRoot, "manifest.json"),
    JSON.stringify({
      authorization: { status: "confirmed-by-project-owner" },
      counts: { commentaryEntries: 0, scriptureIndexEntries: 0 },
      artifacts: {
        commentary: { path: "commentary.json", sha256: sha256(emptyRaw) },
        scriptureIndex: {
          path: "scripture-index.json",
          sha256: sha256(emptyRaw)
        },
        merged: { sha256: "egw-revision" }
      }
    })
  );
  await writeFile(
    path.join(libraryRoot, "index.json"),
    JSON.stringify({
      schemaVersion: 1,
      resources: {},
      sourceRevision: {},
      chapters: [
        {
          book: 1,
          bookName: "Genèse",
          chapter: 1,
          passages: ["1-1-1"],
          resources: {}
        }
      ]
    })
  );
  await writeHistoricalTranslationStore({
    root: storeRoot,
    resourceId: "sdabc",
    snapshotSha256: "snapshot-hash",
    entries: [stored()]
  });
  const installScript = fileURLToPath(
    new URL("./install-sdabc-library.mjs", import.meta.url)
  );
  execFileSync(process.execPath, [
    installScript,
    sdabcRoot,
    egwRoot,
    libraryRoot,
    storeRoot,
    publishedRoot
  ]);
  const index = JSON.parse(
    await readFile(path.join(libraryRoot, "index.json"), "utf8")
  );
  const chunk = JSON.parse(
    await readFile(path.join(libraryRoot, "chunks/1/1/sdabc.json"), "utf8")
  );
  assert.equal(index.resources.sdabc.translatedCount, 1);
  assert.ok(index.sourceRevision.sdabcHistoricalTranslations);
  assert.equal(chunk.entries[0].translation.origin.kind, "historical-import");
});
