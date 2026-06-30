import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import type { StrongLedger, StrongLedgerVerse } from "../src/strongLedger.js";
import {
  exportStrongLedgerTsvSqlite,
  readStrongLedgerSqlite,
  readStrongLedgerVersesSqlite,
  strongLedgerSqlitePath,
  writeStrongLedgerSqlite
} from "../src/strongLedgerStore.js";

test("stores and reads Strong ledger verses by SQLite scope", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "strong-ledger-store-"));
  const sqlitePath = strongLedgerSqlitePath(dir, "test");
  await writeStrongLedgerSqlite(ledger(dir), sqlitePath);

  const lev = readStrongLedgerSqlite({ sqlitePath, onlyRef: "Lev" });
  assert.deepEqual(
    lev.verses.map((verse) => verse.ref),
    ["Lev.1.1"]
  );

  const genOne = readStrongLedgerVersesSqlite({
    sqlitePath,
    bible: "test",
    onlyRef: "Gen.1"
  });
  assert.deepEqual(
    genOne.map((verse) => verse.ref),
    ["Gen.1.1", "Gen.1.2"]
  );

  const readerTsv = path.join(dir, "reader.tsv");
  await exportStrongLedgerTsvSqlite({
    sqlitePath,
    bible: "test",
    outputPath: readerTsv,
    mode: "reader"
  });
  const exported = await readFile(readerTsv, "utf8");
  assert.match(exported, /Gen\t1\t1\t<w strong="H0001">Dieu<\/w>/);
  assert.match(exported, /Lev\t1\t1\t<w strong="H0003">Il<\/w>/);
});

function ledger(inputPath: string): StrongLedger {
  const verses = [
    verse("Gen.1.1", "Gen", 1, 1, "Dieu", "H0001"),
    verse("Gen.1.2", "Gen", 1, 2, "Terre", "H0002"),
    verse("Lev.1.1", "Lev", 1, 1, "Il", "H0003")
  ];
  return {
    bible: "test",
    generatedAt: "2026-06-30T00:00:00.000Z",
    inputPath,
    scope: "all",
    method: "test",
    translationProfile: {} as StrongLedger["translationProfile"],
    references: [],
    originalSources: [],
    outputPaths: {
      canonical: "",
      sqlite: "",
      readerTsv: "",
      advancedTsv: "",
      debugJson: "",
      metrics: "",
      ledgerManifest: "",
      verseDir: ""
    },
    metrics: { books: {} } as StrongLedger["metrics"],
    verses
  };
}

function verse(
  ref: string,
  bookId: string,
  chapter: number,
  verseNumber: number,
  text: string,
  strong: string
): StrongLedgerVerse {
  return {
    ref,
    bookId,
    chapter,
    verse: verseNumber,
    text,
    tokens: [{ wordIndex: 0, text, normalized: text.toLowerCase() }],
    annotations: [
      {
        id: `${ref}:0:${strong}`,
        strong,
        visibility: "reader",
        placement: "word",
        source: "reference-transfer",
        confidence: 1,
        reason: "test",
        diagnostics: [],
        wordIndex: 0,
        normalizedWord: text.toLowerCase()
      }
    ],
    views: {
      readerHtml: `<w strong="${strong}">${text}</w>`,
      advancedHtml: `<w strong="${strong}">${text}</w>`,
      debugHtml: `<w strong="${strong}">${text}</w>`
    },
    inventories: {
      references: { Sg1910: [strong], Darby: [], DarbyR: [] },
      original: [],
      reader: [strong],
      advanced: [strong]
    },
    metrics: {
      wordCount: 1,
      readerVisibleStrongCount: 1,
      advancedStrongCount: 1,
      emptyStrongCount: 0,
      phraseStrongCount: 0,
      technicalStrongCount: 0,
      pendingHumanCount: 0,
      rejectedCount: 0,
      referenceStrongOccurrenceCount: 1,
      referenceStrongRepresentedCount: 1,
      referenceStrongCoverage: 1,
      referenceStrongCarrierCount: 1,
      referenceStrongCarrierCoverage: 1,
      originalStrongOccurrenceCount: 0,
      originalRepresentedStrongOccurrenceCount: 0,
      originalRepresentationRate: 0,
      originalStrongCarrierCount: 0,
      originalStrongCarrierRate: 0,
      semanticMissingCount: 0,
      readerMultiStrongWordCount: 0,
      readerOverBudgetStrongCount: 0,
      placementRiskCount: 0,
      placementQuality: 1,
      readerTaggedTokenCount: 1,
      advancedTaggedTokenCount: 1,
      readerTokenCoverage: 1,
      advancedTokenCoverage: 1
    }
  };
}
