import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  buildCandidateReview,
  readCandidateReviewChapter
} from "../src/strongCandidateReview.js";
import { compileStrongBibleJsonlToSqlite } from "../src/strongBibleSqlite.js";
import { getJsonlBibleChapter } from "../src/jsonlBibleViewer.js";

test("chapter API exposes unresolved occurrences separately from established empties and rejects a stale review", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "candidate-review-"));
  const folder = path.join(root, "outputs/strong-candidate-viewer/s21");
  await mkdir(folder, { recursive: true });
  const reader = path.join(folder, "bible-s21-strong.jsonl"),
    sqlite = path.join(folder, "bible-s21-reader.sqlite"),
    reviewPath = path.join(folder, "bible-s21-review.sqlite"),
    ledgerPath = path.join(root, "ledger.sqlite");
  await writeFile(
    reader,
    JSON.stringify({
      ref: "Gen.1.1",
      version: "S21-CANDIDATE",
      book: 1,
      bookId: "Gen",
      chapter: 1,
      verse: 1,
      text: '<w strong="H0001">un mot</w>'
    }) + "\n"
  );
  const summary = await compileStrongBibleJsonlToSqlite({
    inputPath: reader,
    outputPath: sqlite,
    datasetId: "S21-CANDIDATE",
    expectedVersion: "S21-CANDIDATE"
  });
  const before = await getJsonlBibleChapter({
    root,
    versions: ["S21-CANDIDATE"],
    bookId: "Gen",
    chapter: 1
  });
  assert.deepEqual(before.versions[0].verses[0].review, { available: false });
  const ledger = new DatabaseSync(ledgerPath);
  ledger.exec(
    "CREATE TABLE verses(bible TEXT,ref TEXT,book_id TEXT,book_order INTEGER,chapter INTEGER,verse INTEGER,resolution_json TEXT)"
  );
  const decision = (
    state: string,
    id: string,
    reason: string,
    reading = false
  ) => ({
    state,
    sourceUnitId: id,
    strong: [id],
    assurance: reason,
    reasons: [reason],
    source: { surface: "original", readingUnresolved: reading }
  });
  ledger.prepare("INSERT INTO verses VALUES(?,?,?,?,?,?,?)").run(
    "s21",
    "Gen.1.1",
    "Gen",
    0,
    1,
    1,
    JSON.stringify({
      issues: [],
      decisions: [
        decision("visible", "H0001", "established"),
        decision("empty", "H0853", "grammar"),
        decision("unresolved", "H0002", "competing-nominal-recovery"),
        decision("unresolved", "H0003", "unresolved-source-reading", true)
      ]
    })
  );
  ledger.close();
  await buildCandidateReview({
    ledgerPath,
    outputPath: reviewPath,
    bible: "s21",
    readerSha256: summary.sourceSha256,
    ledgerSha256: "fixture-ledger",
    expectedVerses: 1
  });
  await writeFile(
    path.join(folder, "manifest.json"),
    JSON.stringify({ review: { ledgerSha256: "fixture-ledger" } })
  );
  const chapter = await getJsonlBibleChapter({
    root,
    versions: ["S21-CANDIDATE"],
    bookId: "Gen",
    chapter: 1
  });
  const review = chapter.versions[0].verses[0].review;
  assert(review?.available);
  assert.equal(review.sourceUnits, 4);
  assert.equal(review.visible, 1);
  assert.equal(review.establishedEmpty, 1);
  assert.equal(review.unresolved, 2);
  assert.deepEqual(
    review.items.map((x) => x.reason),
    ["predicate", "reading"]
  );
  assert.equal(
    review.items.some((x) => x.strong.includes("H0853")),
    false
  );
  assert.equal(
    readCandidateReviewChapter({
      path: reviewPath,
      readerSha256: "different-reader",
      ledgerSha256: "fixture-ledger",
      bookId: "Gen",
      chapter: 1
    }),
    null
  );
  const db = new DatabaseSync(reviewPath);
  assert.equal(
    readCandidateReviewChapter({
      path: reviewPath,
      readerSha256: summary.sourceSha256,
      ledgerSha256: "different-ledger-same-reader",
      bookId: "Gen",
      chapter: 1
    }),
    null
  );
  db.prepare("UPDATE Metadata SET value=? WHERE key='readerSha256'").run(
    "stale"
  );
  db.close();
  const stale = await getJsonlBibleChapter({
    root,
    versions: ["S21-CANDIDATE"],
    bookId: "Gen",
    chapter: 1
  });
  assert.deepEqual(stale.versions[0].verses[0].review, { available: false });
});
test("missing or corrupt review data never claims that a verse is complete", async () => {
  const folder = await mkdtemp(
      path.join(os.tmpdir(), "candidate-review-invalid-")
    ),
    file = path.join(folder, "review.sqlite");
  assert.equal(
    readCandidateReviewChapter({
      path: file,
      readerSha256: "x",
      ledgerSha256: "x",
      bookId: "Gen",
      chapter: 1
    }),
    null
  );
  await writeFile(file, "broken sqlite");
  assert.equal(
    readCandidateReviewChapter({
      path: file,
      readerSha256: "x",
      ledgerSha256: "x",
      bookId: "Gen",
      chapter: 1
    }),
    null
  );
});
