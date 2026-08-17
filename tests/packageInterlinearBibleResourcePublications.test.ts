import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";

import {
  buildInterlinearBibleResourcePublication,
  assertSharedInterlinearStructure,
  validateInterlinearBibleResourcePublication
} from "../src/packageInterlinearBibleResourcePublications.js";
import { buildBibleResourcePublication } from "../src/packageResourcePublication.js";

async function makeFixture(root: string) {
  const verse = {
    text: "א",
    startTags: [],
    layout: [],
    notes: [],
    headings: []
  };
  const textSha256 = createHash("sha256")
    .update(`${JSON.stringify([1, 1, 1, verse])}\n`)
    .digest("hex");
  const textRevision = `bhg-${textSha256.slice(0, 20)}`;
  const canonicalPath = path.join(root, "bhg.json");
  await writeFile(
    canonicalPath,
    `${JSON.stringify({
      format: "bible-strong-canonical-bible",
      schemaVersion: 4,
      applicationVersionId: "BHG",
      datasetId: "STEP",
      sourceVersion: "fixture",
      textRevision,
      textSha256,
      sourceSha256: "1".repeat(64),
      verseCount: 1,
      noteCount: 0,
      headingCount: 0,
      verses: { "1": { "1": { "1": verse } } }
    })}\n`
  );
  const bibleBundle = path.join(root, "bible");
  await buildBibleResourcePublication({
    canonicalPath,
    outputDir: bibleBundle,
    identity: { versionId: "BHG", language: "he" },
    rights: {
      holder: "STEPBible",
      termsReference: "CC BY 4.0",
      attribution: "STEP fixture",
      online: true,
      offline: true
    },
    deliveryCapabilities: { onlineAccess: true, offlineDownload: true },
    canon: { id: "fixture", orderedBooks: [1] },
    versification: "fixture",
    generatedAt: "2026-08-17T00:00:00.000Z"
  });

  const sqlitePath = path.join(root, "interlinear.sqlite");
  const database = new DatabaseSync(sqlitePath);
  database.exec(`
    CREATE TABLE ResourceMetadata(key TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID;
    CREATE TABLE Verses(id INTEGER PRIMARY KEY, bookOrder INTEGER, bookId TEXT, chapter INTEGER, verse INTEGER, ref TEXT);
    CREATE TABLE Tokens(id INTEGER PRIMARY KEY, verseId INTEGER, readingOrdinal INTEGER, startOffset INTEGER, length INTEGER);
    CREATE TABLE Transliterations(id INTEGER PRIMARY KEY, value TEXT);
    CREATE TABLE Lemmas(id INTEGER PRIMARY KEY, value TEXT);
    CREATE TABLE Morphologies(id INTEGER PRIMARY KEY, code TEXT);
    CREATE TABLE Glosses(id INTEGER PRIMARY KEY, text TEXT, source TEXT, confidence REAL);
    CREATE TABLE StrongCodes(id INTEGER PRIMARY KEY, code TEXT);
    CREATE TABLE StrongVerseIndex(codeId INTEGER, verseId INTEGER, kindMask INTEGER);
    CREATE TABLE Segments(id INTEGER PRIMARY KEY, tokenId INTEGER, ordinal INTEGER, startOffset INTEGER, length INTEGER, transliterationId INTEGER, lemmaId INTEGER, morphologyId INTEGER, glossId INTEGER, strongCodeId INTEGER, eStrongCodeId INTEGER, dStrongCodeId INTEGER, uStrongCodeId INTEGER);
    INSERT INTO ResourceMetadata VALUES
      ('schemaVersion','5'),('datasetId','STEP'),('locale','fr'),('sourceVersion','TAHOT/TAGNT'),
      ('verseCount','1'),('tokenCount','1'),('segmentCount','1'),('identityCount','1');
    INSERT INTO Verses VALUES (1,1,'Gen',1,1,'Gen.1.1');
    INSERT INTO Tokens VALUES (1,1,0,0,1);
    INSERT INTO Transliterations VALUES (1,'a');
    INSERT INTO Lemmas VALUES (1,'א');
    INSERT INTO Morphologies VALUES (1,'HN');
    INSERT INTO Glosses VALUES (1,'début','fixture',1);
    INSERT INTO StrongCodes VALUES (1,'H0001');
    INSERT INTO Segments VALUES (1,1,0,0,1,1,1,1,1,1,NULL,NULL,NULL);
    INSERT INTO StrongVerseIndex VALUES (1,1,1);
  `);
  database.close();
  return { bibleBundle, sqlitePath, textRevision, textSha256 };
}

test("publishes and validates a BHG interlinear bundle bound to the exact Bible revision", async (t) => {
  const root = await mkdtemp(
    path.join(tmpdir(), "interlinear-resource-publication-")
  );
  t.after(async () => rm(root, { recursive: true, force: true }));
  const fixture = await makeFixture(root);
  const outputDir = path.join(root, "publication");
  const result = await buildInterlinearBibleResourcePublication({
    sqlitePath: fixture.sqlitePath,
    bibleBundleDir: fixture.bibleBundle,
    outputDir,
    language: "fr",
    attribution: "STEP fixture",
    rightsReviewedAt: "2026-08-16",
    generatedAt: "2026-08-17T00:00:00.000Z"
  });

  assert.match(result.manifest.revision, /^bhg-interlinear-fr-[a-f0-9]{20}$/u);
  assert.equal(
    result.manifest.dependencies.bible.revision,
    fixture.textRevision
  );
  assert.equal(
    result.manifest.dependencies.bible.textSha256,
    fixture.textSha256
  );
  assert.deepEqual(result.manifest.counts, {
    verses: 1,
    tokens: 1,
    segments: 1,
    identities: 1
  });
  await validateInterlinearBibleResourcePublication(outputDir);
  assert.deepEqual((await readdir(outputDir)).sort(), [
    "canonical",
    "manifest.json",
    "offline"
  ]);

  const manifestPath = path.join(outputDir, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<
    string,
    unknown
  >;
  const canonicalDeclaration = manifest.canonical as Record<string, unknown>;
  canonicalDeclaration.schemaVersion = 2;
  await writeFile(manifestPath, `${JSON.stringify(manifest)}\n`);
  await assert.rejects(
    validateInterlinearBibleResourcePublication(outputDir),
    /interlinear-manifest-invalid/u
  );
  canonicalDeclaration.schemaVersion = 1;

  const dependencies = manifest.dependencies as Record<string, unknown>;
  const strongLexiconModules = dependencies.strongLexiconModules;
  dependencies.strongLexiconModules = [];
  await writeFile(manifestPath, `${JSON.stringify(manifest)}\n`);
  await assert.rejects(
    validateInterlinearBibleResourcePublication(outputDir),
    /interlinear-manifest-invalid/u
  );
  dependencies.strongLexiconModules = strongLexiconModules;

  manifest.revision = "bhg-interlinear-fr-arbitrary";
  await writeFile(manifestPath, `${JSON.stringify(manifest)}\n`);
  await assert.rejects(
    validateInterlinearBibleResourcePublication(outputDir),
    /interlinear-publication-declaration-mismatch/u
  );
});

test("rejects source rows that disappear from the canonical joins", async (t) => {
  const root = await mkdtemp(
    path.join(tmpdir(), "interlinear-resource-invalid-source-")
  );
  t.after(async () => rm(root, { recursive: true, force: true }));
  const fixture = await makeFixture(root);
  const database = new DatabaseSync(fixture.sqlitePath);
  database.exec("UPDATE Segments SET transliterationId=999 WHERE id=1");
  database.close();

  await assert.rejects(
    buildInterlinearBibleResourcePublication({
      sqlitePath: fixture.sqlitePath,
      bibleBundleDir: fixture.bibleBundle,
      outputDir: path.join(root, "publication"),
      language: "fr",
      attribution: "STEP fixture",
      rightsReviewedAt: "2026-08-16",
      generatedAt: "2026-08-17T00:00:00.000Z"
    }),
    /interlinear-source-count-mismatch/u
  );
});

test("requires French and English publications to share the same source structure", () => {
  const canonical = {
    format: "bible-strong-canonical-interlinear-index" as const,
    schemaVersion: 1 as const,
    applicationVersionId: "BHG" as const,
    datasetId: "STEP" as const,
    language: "fr" as const,
    indexRevision: "fr-revision",
    textRevision: "bhg-revision",
    textSha256: "1".repeat(64),
    verses: [{ id: 1, book: 1, chapter: 1, verse: 1 }],
    tokens: [{ id: 1, verseId: 1, ordinal: 0, startOffset: 0, length: 1 }],
    segments: [
      {
        id: 1,
        tokenId: 1,
        ordinal: 0,
        startOffset: 0,
        length: 1,
        transliteration: "a",
        lemma: "א",
        morphology: "HN",
        gloss: "début"
      }
    ],
    segmentIdentities: [
      {
        segmentId: 1,
        identityOrder: 0,
        kind: "strong" as const,
        code: "H0001"
      }
    ]
  };
  const english = {
    ...canonical,
    language: "en" as const,
    indexRevision: "en-revision",
    segments: canonical.segments.map((segment) => ({
      ...segment,
      gloss: "beginning"
    }))
  };
  assert.doesNotThrow(() =>
    assertSharedInterlinearStructure(canonical, english)
  );
  assert.throws(
    () =>
      assertSharedInterlinearStructure(canonical, {
        ...english,
        segments: english.segments.map((segment) => ({
          ...segment,
          morphology: "VN"
        }))
      }),
    /interlinear-publication-locale-structure-mismatch/u
  );
});
