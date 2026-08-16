import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";

import { buildBibleResourcePublication } from "../src/packageResourcePublication.js";

const execFileAsync = promisify(execFile);

test("publishes one canonical Bible and its matching Offline-copy bundle", async (t) => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "bible-resource-publication-")
  );
  t.after(async () => rm(directory, { recursive: true, force: true }));

  const canonicalPath = path.join(directory, "source", "bible-test.json");
  await mkdir(path.dirname(canonicalPath), { recursive: true });
  await writeFile(
    canonicalPath,
    `${JSON.stringify({
      format: "bible-strong-canonical-bible",
      schemaVersion: 4,
      applicationVersionId: "TEST",
      datasetId: "test-source",
      sourceVersion: "TEST-SOURCE",
      textRevision: "test-0123456789abcdef0123",
      textSha256: "a".repeat(64),
      sourceSha256: "b".repeat(64),
      verseCount: 2,
      noteCount: 1,
      headingCount: 1,
      verses: {
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
      }
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
  assert.equal(manifest.revision, "test-0123456789abcdef0123");
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
});
