import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  packageMobileStrongBibles,
  type MobileStrongBibleSource
} from "../src/packageMobileStrongBibles.js";

test("packages deterministic ZIP artifacts and a paired publication catalog", async (t) => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "mobile-strong-bible-package-")
  );
  t.after(async () => rm(directory, { recursive: true, force: true }));
  const sourcePath = path.join(directory, "bible.jsonl");
  await writeFile(
    sourcePath,
    `${JSON.stringify({
      ref: "Gen.1.1",
      version: "TEST",
      book: 1,
      bookId: "Gen",
      chapter: 1,
      verse: 1,
      text:
        '<p><w strong="H0430">Dieu</w> créa' +
        '<note n="a">note canonique</note>.</p>'
    })}\n`,
    "utf8"
  );
  const source: MobileStrongBibleSource = {
    applicationVersionId: "LSG",
    datasetId: "TEST",
    sourceVersion: "TEST",
    relativePath: "bible.jsonl"
  };

  const first = await packageMobileStrongBibles({
    root: directory,
    outputDir: "first",
    generatedAt: "2026-07-23T00:00:00.000Z",
    sources: [source]
  });
  const second = await packageMobileStrongBibles({
    root: directory,
    outputDir: "second",
    generatedAt: "2026-07-23T00:00:00.000Z",
    sources: [source]
  });
  const firstCatalog = JSON.parse(await readFile(first.catalogPath, "utf8"));
  const secondCatalog = JSON.parse(await readFile(second.catalogPath, "utf8"));

  assert.equal(firstCatalog.format, "bible-strong-mobile-publications");
  assert.equal(firstCatalog.schemaVersion, 2);
  assert.equal(firstCatalog.bibles.length, 1);
  assert.equal(firstCatalog.bibles[0].applicationVersionId, "LSG");
  assert.equal(firstCatalog.bibles[0].datasetId, "TEST");
  assert.equal(
    firstCatalog.bibles[0].canonical.textRevision,
    firstCatalog.bibles[0].strong.textRevision
  );
  assert.match(firstCatalog.bibles[0].canonical.file, /\.json\.zip$/u);
  assert.match(firstCatalog.bibles[0].strong.file, /\.sqlite\.zip$/u);
  assert.equal(firstCatalog.bibles[0].canonical.schemaVersion, 4);
  assert.equal(firstCatalog.bibles[0].canonical.noteCount, 1);
  assert.equal(firstCatalog.bibles[0].canonical.headingCount, 0);
  assert.equal(firstCatalog.bibles[0].strong.schemaVersion, 2);
  assert.equal(firstCatalog.bibles[0].strong.noteCount, undefined);
  assert.equal(
    firstCatalog.bibles[0].canonical.archiveSha256,
    secondCatalog.bibles[0].canonical.archiveSha256
  );
  assert.equal(
    firstCatalog.bibles[0].strong.archiveSha256,
    secondCatalog.bibles[0].strong.archiveSha256
  );
});
