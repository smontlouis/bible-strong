import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";

import {
  buildStrongBibleResourcePublication,
  validateStrongBibleResourcePublication
} from "../src/packageStrongBibleResourcePublications.js";
import { buildBibleResourcePublication } from "../src/packageResourcePublication.js";

const execFileAsync = promisify(execFile);
const bibleVerse = {
  text: "Dieu",
  startTags: [],
  layout: [],
  notes: [],
  headings: []
};
const textSha256 = createHash("sha256")
  .update(`${JSON.stringify([1, 1, 1, bibleVerse])}\n`)
  .digest("hex");
const sourceSha256 = "2".repeat(64);
const textRevision = `lsg-${textSha256.slice(0, 20)}`;
const strongRevision = createHash("sha256")
  .update(`strong-bible-mobile-publication@2\0${sourceSha256}\0${textSha256}`)
  .digest("hex");

async function makeFixture(root: string, revision = strongRevision) {
  const sourceDir = path.join(root, "source");
  const sqlitePath = path.join(sourceDir, "bible-lsg-strong.sqlite");
  const archivePath = path.join(root, "bible-lsg-strong.sqlite.zip");
  await mkdir(sourceDir, { recursive: true });
  const metadata = {
    applicationVersionId: "LSG",
    datasetId: "LSG",
    sourceVersion: "SG1910",
    builderVersion: "strong-bible-mobile-publication@2",
    sourceSha256,
    textRevision,
    textSha256,
    strongRevision: revision,
    verseCount: "1",
    occurrenceCount: "1",
    unalignedOccurrenceCount: "0",
    identityCount: "1",
    lexemeAssignmentCount: "1",
    lexemeCount: "1"
  };
  const inserts = Object.entries(metadata)
    .map(
      ([key, value]) =>
        `INSERT INTO ResourceMetadata VALUES ('${key}', '${value}');`
    )
    .join("\n");
  await execFileAsync("sqlite3", [
    sqlitePath,
    `
    CREATE TABLE ResourceMetadata(key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE Verses(id INTEGER PRIMARY KEY, bookOrder INTEGER, chapter INTEGER, verse INTEGER);
    CREATE TABLE FrenchLexemes(id INTEGER PRIMARY KEY, lemma TEXT, partOfSpeech TEXT);
    CREATE TABLE StrongCodes(id INTEGER PRIMARY KEY, kind INTEGER, code TEXT);
    CREATE TABLE WordSpans(verseId INTEGER, ordinal INTEGER, startOffset INTEGER, length INTEGER, isAligned INTEGER, openOrder INTEGER, closeOrder INTEGER, lexemeId INTEGER, stepTokenId INTEGER);
    CREATE TABLE WordStrongCodes(verseId INTEGER, ordinal INTEGER, identityOrder INTEGER, codeId INTEGER);
    CREATE TABLE WordStepTokenExtras(verseId INTEGER, targetOrdinal INTEGER, sourceOrder INTEGER, stepTokenId INTEGER);
    ${inserts}
    INSERT INTO Verses VALUES (1, 1, 1, 1);
    INSERT INTO FrenchLexemes VALUES (1, 'Dieu', 'N');
    INSERT INTO StrongCodes VALUES (1, 0, 'H0430');
    INSERT INTO WordSpans VALUES (1, 0, 0, 4, 1, 0, 1, 1, 7);
    INSERT INTO WordStrongCodes VALUES (1, 0, 0, 1);
    INSERT INTO WordStepTokenExtras VALUES (1, 0, 1, 8);
  `
  ]);
  await execFileAsync("zip", ["-q", "-j", archivePath, sqlitePath]);
  const bibleSource = path.join(root, "bible-source.json");
  await writeFile(
    bibleSource,
    `${JSON.stringify({
      format: "bible-strong-canonical-bible",
      schemaVersion: 4,
      applicationVersionId: "LSG",
      datasetId: "LSG",
      sourceVersion: "SG1910",
      textRevision,
      textSha256,
      sourceSha256,
      verseCount: 1,
      noteCount: 0,
      headingCount: 0,
      verses: { "1": { "1": { "1": bibleVerse } } }
    })}\n`
  );
  const bibleDir = path.join(root, "bible");
  await buildBibleResourcePublication({
    canonicalPath: bibleSource,
    outputDir: bibleDir,
    identity: { versionId: "LSG", language: "fr" },
    rights: {
      holder: "Public domain",
      termsReference: "fixture",
      attribution: "LSG fixture",
      online: true,
      offline: true
    },
    deliveryCapabilities: { onlineAccess: true, offlineDownload: true },
    canon: { id: "protestant-66", orderedBooks: [1] },
    versification: "fixture",
    generatedAt: "2026-08-16T00:00:00.000Z"
  });
  return { archivePath, bibleDir };
}

test("publishes and validates a Strong Bible canonical plus matching SQLite archive", async (t) => {
  const root = await mkdtemp(
    path.join(tmpdir(), "strong-resource-publication-")
  );
  t.after(async () => rm(root, { recursive: true, force: true }));
  const fixture = await makeFixture(root);
  const result = await buildStrongBibleResourcePublication({
    sourceArchivePath: fixture.archivePath,
    sourceUrl: "https://assets.invalid/bible-lsg-strong.sqlite.zip",
    sourceEntry: "bible-lsg-strong.sqlite",
    bibleBundleDir: fixture.bibleDir,
    outputDir: path.join(root, "publication"),
    versionId: "LSG",
    datasetId: "LSG",
    language: "fr",
    attribution: "1910 — Public Domain",
    rightsReviewedAt: "2026-08-16",
    generatedAt: "2026-08-16T00:00:00.000Z"
  });

  assert.match(result.manifest.revision, /^lsg-strong-[a-f0-9]{20}$/u);
  assert.deepEqual(result.manifest.counts, {
    verses: 1,
    occurrences: 1,
    unalignedOccurrences: 0,
    identities: 1,
    lexemeAssignments: 1,
    lexemes: 1
  });
  assert.equal(result.manifest.dependencies.bible.revision, textRevision);
  const canonical = JSON.parse(
    await readFile(
      path.join(result.outputDir, result.manifest.canonical.path),
      "utf8"
    )
  );
  assert.deepEqual(canonical.spans[0].stepTokenIds, [7, 8]);
  await assert.doesNotReject(
    validateStrongBibleResourcePublication(result.outputDir)
  );
});

test("rejects a Strong revision that is not derived from its declared source and text", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "strong-resource-revision-"));
  t.after(async () => rm(root, { recursive: true, force: true }));
  const fixture = await makeFixture(root, "f".repeat(64));
  await assert.rejects(
    buildStrongBibleResourcePublication({
      sourceArchivePath: fixture.archivePath,
      sourceUrl: "https://assets.invalid/bible-lsg-strong.sqlite.zip",
      sourceEntry: "bible-lsg-strong.sqlite",
      bibleBundleDir: fixture.bibleDir,
      outputDir: path.join(root, "publication"),
      versionId: "LSG",
      datasetId: "LSG",
      language: "fr",
      attribution: "Public Domain",
      rightsReviewedAt: "2026-08-16",
      generatedAt: "2026-08-16T00:00:00.000Z"
    }),
    /strong-publication-revision-invalid/
  );
});

test("rejects an ordinary Bible dependency with a different text identity", async (t) => {
  const root = await mkdtemp(
    path.join(tmpdir(), "strong-resource-dependency-")
  );
  t.after(async () => rm(root, { recursive: true, force: true }));
  const fixture = await makeFixture(root);
  const bibleManifest = JSON.parse(
    await readFile(path.join(fixture.bibleDir, "manifest.json"), "utf8")
  );
  const bibleCanonical = path.join(
    fixture.bibleDir,
    bibleManifest.canonical.path
  );
  const canonical = JSON.parse(await readFile(bibleCanonical, "utf8"));
  canonical.textSha256 = "9".repeat(64);
  await writeFile(bibleCanonical, `${JSON.stringify(canonical)}\n`);
  await assert.rejects(
    buildStrongBibleResourcePublication({
      sourceArchivePath: fixture.archivePath,
      sourceUrl: "https://assets.invalid/bible-lsg-strong.sqlite.zip",
      sourceEntry: "bible-lsg-strong.sqlite",
      bibleBundleDir: fixture.bibleDir,
      outputDir: path.join(root, "publication"),
      versionId: "LSG",
      datasetId: "LSG",
      language: "fr",
      attribution: "Public Domain",
      rightsReviewedAt: "2026-08-16",
      generatedAt: "2026-08-16T00:00:00.000Z"
    }),
    /resource-publication-canonical-integrity-mismatch/
  );
});
