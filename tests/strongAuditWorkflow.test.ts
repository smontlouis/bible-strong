import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  eligibleBooksForAudit,
  residualReportFromManifest,
  residualReportMarkdown,
  selectAuditBooks,
  snapshotFromManifest,
  type StrongAuditManifest
} from "../src/strongAuditWorkflow.js";

const DEFAULT_SEED = "nbs-strong-audit-2026-06-25";

test("selects a stable random 10-book audit sample", async () => {
  const eligibleBooks = await eligibleBooksForAudit("nbs", 5);
  const selectedBooks = selectAuditBooks(eligibleBooks, {
    seed: DEFAULT_SEED,
    bookCount: 10
  });

  assert.equal(eligibleBooks.length, 47);
  assert.deepEqual(selectedBooks, [
    "Rev",
    "Prov",
    "Dan",
    "2Sam",
    "Amos",
    "1Sam",
    "1Tim",
    "Heb",
    "Ezek",
    "John"
  ]);
});

test("audit snapshots omit generated output paths", () => {
  const snapshot = snapshotFromManifest(minimalManifest());

  assert.deepEqual(Object.keys(snapshot.scopes[0] ?? {}).sort(), [
    "bookId",
    "lexicalMetrics",
    "metrics",
    "scope",
    "signatures",
    "verseCount"
  ]);
  assert.equal(snapshot.scopes[0]?.bookId, "Gen");
  assert.equal(snapshot.scopes[0]?.signatures.annotations, "abc123");
});

test("committed 10x5 audit baseline uses the stable sample", () => {
  const baseline = JSON.parse(
    readFileSync("tests/fixtures/strong-audit/nbs-10x5-snapshot.json", "utf8")
  ) as {
    selectedBooks: string[];
    scopes: Array<{ scope: string }>;
    totals: { lexicalAutoSafeItems: number; emptyStrongCount: number };
  };

  assert.equal(baseline.scopes.length, 10);
  assert.deepEqual(baseline.selectedBooks, [
    "Rev",
    "Prov",
    "Dan",
    "2Sam",
    "Amos",
    "1Sam",
    "1Tim",
    "Heb",
    "Ezek",
    "John"
  ]);
  assert.equal(baseline.totals.lexicalAutoSafeItems, 0);
  assert.equal(baseline.totals.emptyStrongCount, 3115);
});

test("builds an audit residual report from lexical candidate files", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "strong-audit-residuals-"));
  const lexicalReportPath = path.join(dir, "lexical.json");
  const manifest = minimalManifest();
  manifest.scopes[0]!.lexicalReportPath = lexicalReportPath;

  writeFileSync(
    lexicalReportPath,
    JSON.stringify({
      items: [
        lexicalItem({
          groupAutoSafe: {
            groupId: "Gen.1.1:H0001",
            assignedWordIndex: 1,
            assignedText: "créa",
            sourceRank: 1,
            groupSize: 1,
            targetCount: 1,
            capacityPerTarget: 1,
            reason: "test group"
          }
        }),
        lexicalItem({
          annotationId: "Gen.1.1:1:H0002",
          strong: "H0002",
          candidates: [
            candidate({ text: "Dieu", wordIndex: 2 }),
            candidate({
              text: "créa",
              wordIndex: 1,
              confidence: "medium",
              score: 0.92
            })
          ]
        }),
        lexicalItem({
          annotationId: "Gen.1.1:2:H0003",
          strong: "H0003",
          auditKind: "relocation",
          currentTarget: {
            wordIndex: 4,
            text: "terre",
            normalized: "terre",
            otherStrong: ["H0776"]
          },
          candidates: [
            candidate({ text: "ciel", wordIndex: 3 }),
            candidate({ text: "terre", wordIndex: 4 })
          ]
        }),
        lexicalItem({
          annotationId: "Gen.1.1:3:H0004",
          strong: "H0004",
          stepGlosses: ["Lo-", "Ruhamah"],
          candidates: [
            candidate({
              text: "Lo-Rouhama",
              normalized: "lo-rouhama",
              wordIndex: 5,
              score: 0.74,
              evidence: [
                {
                  source: "proper-name-step",
                  detail: "compound proper name",
                  weight: 0.4
                }
              ]
            })
          ]
        }),
        lexicalItem({
          annotationId: "Gen.1.1:3b:H0004",
          strong: "H0004",
          stepGlosses: ["Lo-", "Ruhamah"],
          candidates: [
            candidate({
              text: "Lo-Rouhama",
              normalized: "lo-rouhama",
              wordIndex: 5,
              score: 0.74,
              evidence: [
                {
                  source: "proper-name-step",
                  detail: "compound proper name",
                  weight: 0.4
                }
              ]
            })
          ]
        }),
        lexicalItem({
          annotationId: "Gen.1.1:4:H0005",
          strong: "H0005",
          candidates: [
            candidate({ text: "ciel", wordIndex: 3 }),
            candidate({ text: "terre", wordIndex: 4, occupied: true })
          ]
        }),
        lexicalItem({
          annotationId: "Gen.1.1:5:H0006",
          strong: "H0006",
          dictionaryTerms: ["captivite"],
          inferredTerms: ["exil"],
          candidates: [
            candidate({
              text: "exil",
              normalized: "exil",
              lemma: "exil",
              wordIndex: 6,
              evidence: [
                {
                  source: "seed-term",
                  detail: "exil matches Strong lexical hint",
                  weight: 0.42
                }
              ]
            })
          ]
        })
      ]
    })
  );

  const report = residualReportFromManifest(manifest, 5);
  const markdown = residualReportMarkdown(report);

  assert.equal(report.totals.sampledItems, 7);
  assert.equal(report.totals.groupAutoSafeLeftovers, 1);
  assert.equal(report.totals.compoundProperNameItems, 2);
  assert.equal(report.totals.inferredSeedHighItems, 1);
  assert.equal(report.totals.cleanSingleOpenHighItems, 2);
  assert.equal(report.totals.mediumBlockedSingleOpenHighItems, 1);
  assert.equal(report.totals.highBlockedSingleOpenHighItems, 1);
  assert.equal(report.totals.blockedSingleOpenHighItems, 2);
  assert.equal(report.totals.singleOpenHighItems, 4);
  assert.equal(report.totals.highScoringMediumOpenItems, 1);
  assert.equal(report.totals.ambiguousHighItems, 1);
  assert.equal(report.totals.relocationBetterOpenItems, 1);
  assert.match(markdown, /Group auto-safe leftovers/);
  assert.match(markdown, /Compound STEP proper-name candidates/);
  assert.match(markdown, /High candidates using inferred seed evidence/);
  assert.match(markdown, /Clean single open high candidates/);
  assert.match(markdown, /blocked by medium synonym candidates/);
  assert.match(markdown, /blocked by other high candidates/);
  assert.match(markdown, /High-scoring medium open candidates/);
  assert.match(markdown, /Gen\.1\.1 H0003/);
  assert.match(markdown, /occurrences: 2/);
  assert.match(markdown, /seed-term: exil matches Strong lexical hint/);
});

function minimalManifest(): StrongAuditManifest {
  return {
    version: 1,
    bible: "nbs",
    seed: DEFAULT_SEED,
    bookCount: 1,
    chaptersPerBook: 5,
    generatedAt: "2026-06-25T00:00:00.000Z",
    selectedBooks: ["Gen"],
    totals: {
      verseCount: 1,
      readerVisibleStrongCount: 1,
      advancedStrongCount: 1,
      emptyStrongCount: 0,
      referenceStrongCoverage: 1,
      referenceStrongCarrierCoverage: 1,
      originalRepresentationRate: 1,
      originalStrongOccurrenceCount: 1,
      originalRepresentedStrongOccurrenceCount: 1,
      originalStrongCarrierRate: 1,
      semanticMissingCount: 0,
      readerMultiStrongWordCount: 0,
      placementRiskCount: 0,
      placementQuality: 1,
      readerTokenCoverage: 1,
      advancedTokenCoverage: 1,
      lexicalAuditItems: 0,
      lexicalEmptyAnnotations: 0,
      lexicalAutoSafeItems: 0,
      lexicalHighConfidenceCandidates: 0
    },
    scopes: [
      {
        bookId: "Gen",
        scope: "Gen.1-Gen.5",
        verseCount: 1,
        outputDir: "outputs/strong-audit/nbs/scopes/Gen",
        ledgerPath:
          "outputs/strong-audit/nbs/scopes/Gen/bible-nbs-strong-ledger.json",
        viewerUrl:
          "/viewer/?file=/outputs/strong-audit/nbs/scopes/Gen/bible-nbs-strong-ledger.json",
        lexicalReportPath:
          "outputs/lexical-candidates/nbs/bible-nbs-lexical-candidates-Gen.1-Gen.5.json",
        metrics: {
          verseCount: 1,
          wordCount: 1,
          readerVisibleStrongCount: 1,
          advancedStrongCount: 1,
          emptyStrongCount: 0,
          phraseStrongCount: 0,
          technicalStrongCount: 0,
          referenceStrongCoverage: 1,
          referenceStrongCarrierCoverage: 1,
          originalRepresentationRate: 1,
          originalStrongOccurrenceCount: 1,
          originalRepresentedStrongOccurrenceCount: 1,
          originalStrongCarrierRate: 1,
          semanticMissingCount: 0,
          readerMultiStrongWordCount: 0,
          placementRiskCount: 0,
          placementQuality: 1,
          readerTokenCoverage: 1,
          readerTaggedTokenCount: 1,
          advancedTokenCoverage: 1,
          advancedTaggedTokenCount: 1
        },
        signatures: {
          annotations: "abc123",
          readerHtml: "def456",
          advancedHtml: "ghi789",
          lexicalResidual: "jkl012"
        },
        lexicalMetrics: {
          auditItems: 0,
          emptyAnnotations: 0,
          readerEmptyAnnotations: 0,
          advancedEmptyAnnotations: 0,
          relocationAnnotations: 0,
          itemsWithCandidates: 0,
          emptyWithCandidates: 0,
          relocationWithCandidates: 0,
          candidateCount: 0,
          highConfidenceCandidates: 0,
          mediumConfidenceCandidates: 0,
          lowConfidenceCandidates: 0,
          openCandidates: 0,
          occupiedCandidates: 0,
          autoSafeItems: 0,
          groupAutoSafeItems: 0,
          ambiguousHighItems: 0,
          openHighItems: 0,
          relocationBetterOpenItems: 0
        }
      }
    ]
  };
}

function lexicalItem(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    auditKind: "empty",
    annotationId: "Gen.1.1:0:H0001",
    ref: "Gen.1.1",
    text: "Au commencement Dieu créa.",
    strong: "H0001",
    insertAfterWordIndex: 0,
    stepGlosses: ["test"],
    dictionaryTerms: ["creer"],
    inferredTerms: [],
    candidates: [candidate({ text: "créa", wordIndex: 1 })],
    ...overrides
  };
}

function candidate(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    target: "word",
    wordIndex: 1,
    text: "créa",
    normalized: "crea",
    lemma: "creer",
    score: 1,
    confidence: "high",
    occupied: false,
    evidence: [{ source: "seed-term", detail: "test", weight: 0.4 }],
    ...overrides
  };
}
