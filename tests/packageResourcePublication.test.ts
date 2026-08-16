import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";

import {
  buildBibleResourcePublication,
  validateBibleResourcePublication
} from "../src/packageResourcePublication.js";

const execFileAsync = promisify(execFile);

test("publishes one canonical Bible and its matching Offline-copy bundle", async (t) => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "bible-resource-publication-")
  );
  t.after(async () => rm(directory, { recursive: true, force: true }));

  const canonicalPath = path.join(directory, "source", "bible-test.json");
  await mkdir(path.dirname(canonicalPath), { recursive: true });
  const verses = {
    "1": {
      "1": {
        "1": {
          text: "Au commencement",
          startTags: [],
          layout: [],
          notes: [
            { offset: 2, order: 0, kind: "note", markup: "<note>n</note>" }
          ],
          headings: []
        },
        "2": {
          text: "La terre",
          startTags: [],
          layout: [],
          notes: [],
          headings: [
            {
              offset: 0,
              order: 0,
              kind: "heading",
              type: "s1",
              text: "Création",
              markup: "<s1>Création</s1>"
            }
          ]
        }
      }
    }
  };
  const textSha256 = createHash("sha256")
    .update(`${JSON.stringify([1, 1, 1, verses["1"]["1"]["1"]])}\n`)
    .update(`${JSON.stringify([1, 1, 2, verses["1"]["1"]["2"]])}\n`)
    .digest("hex");
  const textRevision = `test-${textSha256.slice(0, 20)}`;
  await writeFile(
    canonicalPath,
    `${JSON.stringify({
      format: "bible-strong-canonical-bible",
      schemaVersion: 4,
      applicationVersionId: "TEST",
      datasetId: "test-source",
      sourceVersion: "TEST-SOURCE",
      textRevision,
      textSha256,
      sourceSha256: "b".repeat(64),
      verseCount: 2,
      noteCount: 1,
      headingCount: 1,
      verses
    })}\n`,
    { encoding: "utf8", flag: "wx" }
  );

  const outputDir = path.join(directory, "publication");
  const result = await buildBibleResourcePublication({
    canonicalPath,
    outputDir,
    identity: { versionId: "TEST", language: "fr" },
    rights: {
      holder: "Test holder",
      termsReference: "https://example.test/terms",
      attribution: "Test Bible",
      online: false,
      offline: true
    },
    deliveryCapabilities: { onlineAccess: false, offlineDownload: true },
    canon: { id: "test-canon", orderedBooks: [1] },
    versification: "test",
    generatedAt: "2026-08-16T00:00:00.000Z"
  });

  const manifest = JSON.parse(await readFile(result.manifestPath, "utf8"));
  assert.equal(manifest.format, "bible-strong-resource-publication");
  assert.equal(manifest.identity.versionId, "TEST");
  assert.equal(manifest.revision, textRevision);
  assert.deepEqual(manifest.deliveryCapabilities, {
    onlineAccess: false,
    offlineDownload: true
  });
  assert.deepEqual(manifest.coverage, {
    chaptersByBook: { "1": [1] },
    verseCountByBookChapter: { "1-1": 2 }
  });
  assert.deepEqual(manifest.counts, {
    books: 1,
    chapters: 1,
    verses: 2,
    notes: 1,
    headings: 1
  });

  const archivedCanonical = await execFileAsync("unzip", [
    "-p",
    result.offlineArtifactPath,
    "bible-test.json"
  ]);
  assert.equal(archivedCanonical.stdout, await readFile(canonicalPath, "utf8"));
  assert.equal(
    manifest.offlineArtifact.contentSha256,
    manifest.canonical.sha256
  );

  await assert.doesNotReject(validateBibleResourcePublication(outputDir));
  manifest.schemaVersion = 2;
  await writeFile(
    result.manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );
  await assert.rejects(
    validateBibleResourcePublication(outputDir),
    /resource-publication-manifest-version-unsupported:2/
  );

  manifest.schemaVersion = 1;
  delete manifest.deliveryCapabilities.onlineAccess;
  await writeFile(
    result.manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );
  await assert.rejects(
    validateBibleResourcePublication(outputDir),
    /resource-publication-manifest-invalid/
  );
});

test("rejects malformed canonical verse identities", async (t) => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "bible-resource-publication-identity-")
  );
  t.after(async () => rm(directory, { recursive: true, force: true }));
  const canonicalPath = path.join(directory, "bible-test.json");
  const verse = {
    text: "Texte",
    startTags: [],
    layout: [],
    notes: [],
    headings: []
  };
  const textSha256 = createHash("sha256")
    .update(`${JSON.stringify([1, 1, 0, verse])}\n`)
    .digest("hex");
  await writeFile(
    canonicalPath,
    `${JSON.stringify({
      format: "bible-strong-canonical-bible",
      schemaVersion: 4,
      applicationVersionId: "TEST",
      datasetId: "test-source",
      sourceVersion: "TEST-SOURCE",
      textRevision: `test-${textSha256.slice(0, 20)}`,
      textSha256,
      sourceSha256: "b".repeat(64),
      verseCount: 1,
      noteCount: 0,
      headingCount: 0,
      verses: { "1": { "1": { "0": verse } } }
    })}\n`,
    "utf8"
  );
  await assert.rejects(
    buildBibleResourcePublication({
      canonicalPath,
      outputDir: path.join(directory, "publication"),
      identity: { versionId: "TEST", language: "fr" },
      rights: {
        holder: "Test holder",
        termsReference: "terms",
        attribution: "Test Bible",
        online: true,
        offline: true
      },
      deliveryCapabilities: { onlineAccess: true, offlineDownload: true },
      canon: { id: "test-canon", orderedBooks: [1] },
      versification: "test"
    }),
    /strong-bible-mobile-invalid-verse-identity:1:1:0/
  );
});

test("rejects a canonical Bible whose declared revision is not content-derived", async (t) => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "bible-resource-publication-revision-")
  );
  t.after(async () => rm(directory, { recursive: true, force: true }));
  const canonicalPath = path.join(directory, "bible-test.json");
  const verse = {
    text: "Texte",
    startTags: [],
    layout: [],
    notes: [],
    headings: []
  };
  const textSha256 = createHash("sha256")
    .update(`${JSON.stringify([1, 1, 1, verse])}\n`)
    .digest("hex");
  await writeFile(
    canonicalPath,
    `${JSON.stringify({
      format: "bible-strong-canonical-bible",
      schemaVersion: 4,
      applicationVersionId: "TEST",
      datasetId: "test-source",
      sourceVersion: "TEST-SOURCE",
      textRevision: "declared-but-not-derived",
      textSha256,
      sourceSha256: "b".repeat(64),
      verseCount: 1,
      noteCount: 0,
      headingCount: 0,
      verses: { "1": { "1": { "1": verse } } }
    })}\n`,
    "utf8"
  );
  await assert.rejects(
    buildBibleResourcePublication({
      canonicalPath,
      outputDir: path.join(directory, "publication"),
      identity: { versionId: "TEST", language: "fr" },
      rights: {
        holder: "Test holder",
        termsReference: "terms",
        attribution: "Test Bible",
        online: false,
        offline: false
      },
      deliveryCapabilities: { onlineAccess: false, offlineDownload: false },
      canon: { id: "test-canon", orderedBooks: [1] },
      versification: "test"
    }),
    /strong-bible-mobile-text-revision-mismatch/
  );
});
