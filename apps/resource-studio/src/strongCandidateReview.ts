import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { CanonicalVerseResolution } from "./strongCanonicalResolution.js";
import type {
  CandidateReviewReason,
  CandidateVerseReview
} from "./strongCandidateReviewTypes.js";

function reasonFor(
  decision: CanonicalVerseResolution["decisions"][number]
): CandidateReviewReason {
  const evidence = [decision.assurance, ...decision.reasons].join(" ");
  if (/predicate|nominal-recovery/u.test(evidence)) return "predicate";
  if (decision.source.readingUnresolved || /source-reading/u.test(evidence))
    return "reading";
  if (/correspondence|verse|mapping/u.test(evidence)) return "correspondence";
  if (/group|measurement|competing/u.test(evidence)) return "group";
  return "alignment";
}
export async function buildCandidateReview(options: {
  ledgerPath: string;
  outputPath: string;
  bible: string;
  readerSha256: string;
  ledgerSha256: string;
  expectedVerses: number;
}) {
  await mkdir(path.dirname(options.outputPath), { recursive: true });
  const temporary = options.outputPath + `.tmp-${process.pid}`;
  await rm(temporary, { force: true });
  const source = new DatabaseSync(options.ledgerPath, { readOnly: true });
  const output = new DatabaseSync(temporary);
  let verses = 0,
    unresolved = 0;
  try {
    output.exec(
      "CREATE TABLE Metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL); CREATE TABLE ReviewVerses(ref TEXT PRIMARY KEY,bookId TEXT NOT NULL,chapter INTEGER NOT NULL,reviewJson TEXT NOT NULL); CREATE INDEX review_chapter ON ReviewVerses(bookId,chapter); BEGIN IMMEDIATE"
    );
    const insert = output.prepare("INSERT INTO ReviewVerses VALUES(?,?,?,?)");
    const rows = source.prepare(
      "SELECT ref,book_id,chapter,resolution_json FROM verses WHERE bible=? ORDER BY book_order,chapter,verse"
    );
    for (const row of rows.iterate(options.bible)) {
      assert(typeof row.resolution_json === "string");
      const resolution: CanonicalVerseResolution = JSON.parse(
        row.resolution_json
      );
      const items = resolution.decisions
        .filter((d) => d.state === "unresolved")
        .map((d) => ({
          sourceUnitId: d.sourceUnitId,
          strong: d.strong,
          source: d.source.surface,
          reason: reasonFor(d)
        }));
      const review: CandidateVerseReview = {
        available: true,
        sourceUnits: resolution.decisions.length,
        visible: resolution.decisions.filter((d) => d.state === "visible")
          .length,
        establishedEmpty: resolution.decisions.filter(
          (d) => d.state === "empty"
        ).length,
        unresolved: items.length,
        issues: resolution.issues.length,
        items
      };
      assert.equal(
        review.visible + review.establishedEmpty + review.unresolved,
        review.sourceUnits
      );
      insert.run(row.ref, row.book_id, row.chapter, JSON.stringify(review));
      verses++;
      unresolved += items.length;
    }
    rows.get(options.bible); // Keep the source statement alive throughout iteration on Node 23.
    assert.equal(verses, options.expectedVerses, "review-verse-count-mismatch");
    const metadata = output.prepare("INSERT INTO Metadata VALUES(?,?)");
    for (const [key, value] of Object.entries({
      format: "candidate-review-v1",
      bible: options.bible,
      readerSha256: options.readerSha256,
      ledgerSha256: options.ledgerSha256
    }))
      metadata.run(key, value);
    output.exec("COMMIT; ANALYZE");
  } finally {
    source.close();
    output.close();
  }
  await rename(temporary, options.outputPath);
  return {
    verses,
    unresolved,
    readerSha256: options.readerSha256,
    ledgerSha256: options.ledgerSha256
  };
}

export function readCandidateReviewChapter(options: {
  path: string;
  readerSha256: string;
  ledgerSha256?: string;
  bookId: string;
  chapter: number;
}): Map<string, CandidateVerseReview> | null {
  if (!existsSync(options.path) || !options.ledgerSha256) return null;
  let database: DatabaseSync | undefined;
  try {
    database = new DatabaseSync(options.path, { readOnly: true });
    const metadata = database.prepare("SELECT value FROM Metadata WHERE key=?");
    if (
      metadata.get("format")?.value !== "candidate-review-v1" ||
      metadata.get("readerSha256")?.value !== options.readerSha256 ||
      metadata.get("ledgerSha256")?.value !== options.ledgerSha256
    )
      return null;
    const rows = database
      .prepare(
        "SELECT ref,reviewJson FROM ReviewVerses WHERE bookId=? AND chapter=?"
      )
      .all(options.bookId, options.chapter);
    const result = new Map<string, CandidateVerseReview>();
    for (const row of rows) {
      const review = JSON.parse(String(row.reviewJson)) as CandidateVerseReview;
      if (!review.available) return null;
      if (
        ![
          review.sourceUnits,
          review.visible,
          review.establishedEmpty,
          review.unresolved,
          review.issues
        ].every((value) => Number.isSafeInteger(value) && value >= 0) ||
        review.visible + review.establishedEmpty + review.unresolved !==
          review.sourceUnits ||
        !Array.isArray(review.items) ||
        review.items.length !== review.unresolved ||
        !review.items.every(
          (item) =>
            typeof item.sourceUnitId === "string" &&
            typeof item.source === "string" &&
            Array.isArray(item.strong) &&
            item.strong.every((code) => typeof code === "string") &&
            [
              "predicate",
              "reading",
              "correspondence",
              "group",
              "alignment"
            ].includes(item.reason)
        )
      )
        return null;
      result.set(String(row.ref), review);
    }
    return result;
  } catch {
    return null;
  } finally {
    database?.close();
  }
}
