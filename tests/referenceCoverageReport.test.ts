import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { buildReferenceCoverageReport } from "../src/referenceCoverageReport.js";
import { type StrongLedger } from "../src/strongLedger.js";

test("reports per-reference reader and advanced coverage from a ledger", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "reference-coverage-test-"));
  const ledger = minimalLedger(dir);
  await writeFile(
    path.join(dir, "bible-test-reference-strong-ledger.json"),
    `${JSON.stringify(ledger, null, 2)}\n`,
    "utf8"
  );

  const report = await buildReferenceCoverageReport({
    bible: "test-reference",
    inputDir: dir,
    outputDir: dir,
    includeVerses: true,
    limitMissing: 10
  });

  assert.equal(report.totals.byReference.Sg1910.expected, 3);
  assert.equal(report.totals.byReference.Sg1910.readerPlaced, 2);
  assert.equal(report.totals.byReference.Sg1910.advancedPlaced, 3);
  assert.equal(report.totals.byReference.Darby.expected, 2);
  assert.equal(report.totals.byReference.Darby.readerPlaced, 2);
  assert.equal(report.totals.byReference.Darby.advancedPlaced, 2);
  assert.equal(report.totals.byReference.DarbyR.expected, 2);
  assert.equal(report.totals.byReference.DarbyR.readerPlaced, 1);
  assert.equal(report.totals.byReference.DarbyR.advancedPlaced, 1);
  assert.equal(report.totals.consensus.threeOfThree.expected, 1);
  assert.equal(report.totals.consensus.threeOfThree.readerPlaced, 1);
  assert.equal(report.totals.consensus.twoOfThree.expected, 1);
  assert.equal(report.totals.consensus.twoOfThree.advancedPlaced, 1);
  assert.equal(report.totals.consensus.oneOfThree.expected, 2);
  assert.deepEqual(report.topMissing[0], {
    reference: "DarbyR",
    strong: "H9999",
    expected: 1,
    readerPlaced: 0,
    advancedPlaced: 0,
    readerMissing: 1,
    advancedMissing: 1,
    refs: ["Gen.1.1"],
    verses: 1
  });
});

function minimalLedger(inputPath: string): StrongLedger {
  return {
    bible: "test-reference",
    generatedAt: "2026-06-23T00:00:00.000Z",
    inputPath,
    scope: "Gen.1",
    method: "test",
    translationProfile: {} as StrongLedger["translationProfile"],
    references: [],
    originalSources: [],
    outputPaths: {
      canonical: "",
      readerTsv: "",
      advancedTsv: "",
      debugJson: "",
      metrics: "",
      ledgerManifest: "",
      verseDir: ""
    },
    metrics: {} as StrongLedger["metrics"],
    verses: [
      {
        ref: "Gen.1.1",
        bookId: "Gen",
        chapter: 1,
        verse: 1,
        text: "test",
        tokens: [],
        annotations: [
          annotation("H0001", "reader"),
          annotation("H0002", "reader"),
          annotation("H0003", "advanced")
        ],
        views: { readerHtml: "", advancedHtml: "", debugHtml: "" },
        inventories: {
          references: {
            Sg1910: ["H0001", "H0002", "H0003"],
            Darby: ["H0001", "H0002"],
            DarbyR: ["H0001", "H9999"]
          },
          original: [],
          reader: ["H0001", "H0002"],
          advanced: ["H0001", "H0002", "H0003"]
        },
        metrics: {} as StrongLedger["verses"][number]["metrics"]
      }
    ]
  };
}

function annotation(
  strong: string,
  visibility: "reader" | "advanced"
): StrongLedger["verses"][number]["annotations"][number] {
  return {
    id: strong,
    strong,
    visibility,
    placement: "word",
    source: "reference-transfer",
    confidence: 1,
    reason: "test",
    diagnostics: []
  };
}
