import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  CANONICAL_RESOLUTION_POLICY,
  aggregateResolutionMetrics,
  type CanonicalVerseResolution
} from "../src/strongCanonicalResolution.js";
import { unresolvedEmptyEvidence } from "../src/strongResolution.js";

import type { StrongLedger, StrongLedgerVerse } from "../src/strongLedger.js";
import {
  exportStrongLedgerTsvSqlite,
  readStrongLedgerSqlite,
  readStrongLedgerVersesByRefsSqlite,
  readStrongLedgerVersesSqlite,
  strongLedgerSqlitePath,
  writeStrongLedgerSqlite,
  replaceStrongLedgerSqliteVerses
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

  const exactRefs = readStrongLedgerVersesByRefsSqlite({
    sqlitePath,
    bible: "test",
    refs: ["Lev.1.1", "Gen.1.2", "Lev.1.1", "Missing.1.1"]
  });
  assert.deepEqual(
    exactRefs.map((verse) => verse.ref),
    ["Gen.1.2", "Lev.1.1"]
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

test("persists absence evidence independently from empty anchor evidence", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "strong-empty-evidence-"));
  const input = ledger(dir);
  const emptyEvidence = unresolvedEmptyEvidence(0);
  input.verses[0].annotations.push({
    id: "empty",
    strong: "H0996",
    visibility: "advanced",
    placement: "empty",
    source: "original-complete",
    confidence: 0.35,
    reason: "unresolved source",
    diagnostics: [],
    insertAfterWordIndex: 0,
    emptyEvidence
  });
  const sqlitePath = strongLedgerSqlitePath(dir, "test");
  await writeStrongLedgerSqlite(input, sqlitePath);
  const saved = readStrongLedgerSqlite({ sqlitePath, onlyRef: "Gen.1.1" });
  assert.deepEqual(
    saved.verses[0].annotations.find((a) => a.id === "empty")?.emptyEvidence,
    emptyEvidence
  );
});

test("persists occurrence resolutions and recomputes their totals on scoped replacement", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "canonical-resolution-store-"));
  const input = ledger(dir);
  const resolution: CanonicalVerseResolution = {
    policy: CANONICAL_RESOLUTION_POLICY,
    targetTextSha256: "fixture",
    issues: ["no-source-occurrences-for-native-verse"],
    unownedAnnotationIds: [],
    decisions: [],
    metrics: {
      verses: 1,
      units: 0,
      visible: 0,
      empty: 0,
      unresolved: 0,
      grammaticalEmpties: 0,
      examinedLexicalCandidates: 0,
      fullyAccountedVerses: 0,
      policySupportedVerses: 0,
      sourceIssueVerses: 1
    }
  };
  input.verses[0].resolution = resolution;
  input.resolutionPolicy = CANONICAL_RESOLUTION_POLICY;
  input.resolutionSummary = aggregateResolutionMetrics(input.verses);
  const sqlitePath = strongLedgerSqlitePath(dir, "test");
  await writeStrongLedgerSqlite(input, sqlitePath);
  assert.deepEqual(
    readStrongLedgerSqlite({ sqlitePath, onlyRef: "Gen.1.1" }).verses[0]
      .resolution,
    resolution
  );
  input.verses[1].resolution = structuredClone(resolution);
  await replaceStrongLedgerSqliteVerses({
    sqlitePath,
    bible: "test",
    verses: [input.verses[1]],
    method: "fixture"
  });
  const saved = readStrongLedgerSqlite({ sqlitePath, includeVerses: false });
  assert.equal(saved.resolutionSummary?.verses, 2);
  assert.equal(saved.resolutionSummary?.books.Gen.sourceIssueVerses, 2);
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
