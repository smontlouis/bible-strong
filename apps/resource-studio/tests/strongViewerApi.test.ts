import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

import type {
  OverrideAuditItem,
  OverrideAuditReport
} from "../src/auditCuratedStrongOverrides.js";
import type {
  StrongLedger,
  StrongLedgerBookMetrics,
  StrongLedgerMetrics,
  StrongLedgerVerse,
  StrongLedgerVerseMetrics
} from "../src/strongLedger.js";
import type { CuratedStrongOverride } from "../src/curatedStrongOverrides.js";
import {
  strongLedgerSqlitePath,
  writeStrongLedgerSqlite
} from "../src/strongLedgerStore.js";
import type { StrongReviewDecisionRecord } from "../src/semanticRefillAgentReview.js";
import {
  getStrongReviewItems,
  getStrongReviewSummary,
  getStrongViewerMetadata,
  getStrongViewerVerses,
  StrongViewerApiError,
  validateBibleId
} from "../src/strongViewerApi.js";

test("reads metadata and one chapter from the canonical SQLite ledger", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "strong-viewer-api-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const outputDir = path.join(root, "outputs", "strong", "nbs");
  const sqlitePath = strongLedgerSqlitePath(outputDir, "nbs");
  await writeStrongLedgerSqlite(viewerLedger(outputDir), sqlitePath);

  // Metadata and a scoped chapter must not deserialize unrelated verse blobs.
  const db = new DatabaseSync(sqlitePath);
  db.prepare("update verses set tokens_json = ? where ref = ?").run(
    "invalid-json",
    "Exod.1.1"
  );
  db.close();

  const metadata = getStrongViewerMetadata({ root, bible: "nbs" });
  assert.equal(metadata.generatedAt, "2026-07-10T12:00:00.000Z");
  assert.equal(metadata.scope, "all");
  assert.equal(metadata.metrics.verseCount, 4);
  assert.deepEqual(
    metadata.books.map((book) => ({
      bookId: book.bookId,
      chapters: book.chapters,
      verseCount: book.verseCount
    })),
    [
      { bookId: "Gen", chapters: [1, 2], verseCount: 3 },
      { bookId: "Exod", chapters: [1], verseCount: 1 }
    ]
  );
  assert.equal(metadata.books[0]?.metrics.readerVisibleStrongCount, 3);

  const chapter = getStrongViewerVerses({
    root,
    bible: "nbs",
    book: "Gen",
    chapter: 1
  });
  assert.deepEqual(
    chapter.verses.map((verse) => verse.ref),
    ["Gen.1.1", "Gen.1.2"]
  );
  assert.equal(chapter.verses[0]?.views.readerHtml, "<w>Au commencement</w>");
});

test("aggregates live audit, latest decisions, and the newest stable plan", async (t) => {
  const root = await reviewFixtureRoot(t);
  const summary = await getStrongReviewSummary({
    root,
    bible: "nbs",
    auditReport: auditFixture()
  });

  assert.deepEqual(summary.production, {
    eligible: 2,
    consensusFiltered: 1
  });
  assert.deepEqual(summary.quarantine, {
    total: 2,
    legacySingleModel: 1,
    unverifiedSemanticRefill: 1
  });
  assert.deepEqual(summary.drift, {
    invalidProduction: 1,
    invalidTotal: 2
  });
  assert.deepEqual(summary.decisions, {
    total: 4,
    uniqueCandidates: 3,
    acceptedSafe: 1,
    needsWitnessReview: 1,
    rejectedRisky: 1
  });
  assert.deepEqual(summary.plan, {
    available: true,
    tasks: 2,
    items: 3,
    models: ["model-a", "model-b"],
    adaptiveSecondModel: true,
    generatedAt: "2026-07-10T12:00:00.000Z"
  });
});

test("prioritizes actionable items and never promotes quarantine into it", async (t) => {
  const root = await reviewFixtureRoot(t);
  const auditReport = auditFixture();
  const actionable = await getStrongReviewItems({
    root,
    bible: "nbs",
    auditReport,
    bucket: "actionable"
  });

  assert.equal(actionable.total, 2);
  assert.deepEqual(
    actionable.items.map((item) => [
      item.ref,
      item.priority.tier,
      item.productionState
    ]),
    [
      ["Gen.1.1", "p0", "drifted-production"],
      ["Gen.1.3", "p1", "pending-review"]
    ]
  );
  assert.ok(
    actionable.items[1]?.evidence?.includes(
      "decision-history-conflict:accepted-safe"
    )
  );
  assert.ok(
    actionable.items.every((item) => item.productionState !== "quarantined")
  );

  const quarantine = await getStrongReviewItems({
    root,
    bible: "nbs",
    auditReport,
    bucket: "quarantined"
  });
  assert.equal(quarantine.total, 2);
  assert.ok(quarantine.items.every((item) => item.priority.tier === "p3"));
  assert.ok(
    quarantine.items.every((item) => item.productionState === "quarantined")
  );

  const accepted = await getStrongReviewItems({
    root,
    bible: "nbs",
    auditReport,
    bucket: "accepted-safe"
  });
  assert.deepEqual(
    accepted.items.map((item) => item.id),
    ["candidate-b"]
  );
});

test("keeps planned pagination stable and applies textual search before slicing", async (t) => {
  const root = await reviewFixtureRoot(t);
  const auditReport = auditFixture();
  const page = await getStrongReviewItems({
    root,
    bible: "nbs",
    auditReport,
    bucket: "planned",
    limit: 1,
    offset: 1
  });
  assert.equal(page.total, 3);
  assert.equal(page.items.length, 1);
  assert.equal(page.items[0]?.ref, "Gen.2.1");
  assert.equal(page.items[0]?.taskId, "task-2");
  assert.equal(page.items[0]?.priority.tier, "p2");

  const searched = await getStrongReviewItems({
    root,
    bible: "nbs",
    auditReport,
    bucket: "planned",
    q: "H0003",
    limit: 10,
    offset: 0
  });
  assert.equal(searched.total, 1);
  assert.equal(searched.items[0]?.strong[0], "H0003");
  assert.equal(searched.items[0]?.models?.length, 2);

  const multiToken = await getStrongReviewItems({
    root,
    bible: "nbs",
    auditReport,
    bucket: "planned",
    q: "Gen.3.1 H0003",
    limit: 10,
    offset: 0
  });
  assert.equal(multiToken.total, 1);
  assert.equal(multiToken.items[0]?.ref, "Gen.3.1");
});

test("distinguishes exact applied overrides from accepted but unapplied records", async (t) => {
  const root = await reviewFixtureRoot(t);
  const exact = filteredOverride();
  const applied = await getStrongReviewItems({
    root,
    bible: "nbs",
    auditReport: auditFixture(),
    curatedOverrides: [exact],
    bucket: "accepted-safe"
  });
  assert.equal(applied.items[0]?.id, "candidate-b");
  assert.equal(applied.items[0]?.productionState, "applied-production");
  assert.ok(
    applied.items[0]?.evidence?.includes(
      "production-join:exact-current-production-override"
    )
  );

  const mismatched = await getStrongReviewItems({
    root,
    bible: "nbs",
    auditReport: auditFixture(),
    curatedOverrides: [{ ...exact, normalized: "different-target" }],
    bucket: "accepted-safe"
  });
  assert.equal(
    mismatched.items[0]?.productionState,
    "accepted-safe-not-applied"
  );
  assert.ok(
    mismatched.items[0]?.evidence?.includes(
      "production-join:exact-production-override-missing"
    )
  );

  const collision = await getStrongReviewItems({
    root,
    bible: "nbs",
    auditReport: auditFixture(),
    curatedOverrides: [exact, { ...exact, reason: "duplicate fixture" }],
    bucket: "accepted-safe"
  });
  assert.equal(
    collision.items[0]?.productionState,
    "accepted-safe-not-applied"
  );
  assert.ok(
    collision.items[0]?.evidence?.includes(
      "production-join:ambiguous-duplicate-production-overrides"
    )
  );

  const first = decision(
    "candidate-b",
    "accepted-safe",
    "2026-07-10T11:00:00.000Z"
  );
  const second = {
    ...first,
    recordId: "candidate-d:accepted-safe",
    candidateId: "candidate-d",
    rawDecision: {
      ...first.rawDecision!,
      id: "candidate-d"
    }
  };
  await writeFile(
    path.join(root, "data", "strong-review-decisions.json"),
    `${JSON.stringify([first, second])}\n`,
    "utf8"
  );
  const competingDecisions = await getStrongReviewItems({
    root,
    bible: "nbs",
    auditReport: auditFixture(),
    curatedOverrides: [exact],
    bucket: "accepted-safe"
  });
  assert.equal(competingDecisions.total, 2);
  assert.ok(
    competingDecisions.items.every(
      (item) => item.productionState === "accepted-safe-not-applied"
    )
  );
  assert.ok(
    competingDecisions.items.every((item) =>
      item.evidence?.includes(
        "production-join:ambiguous-multiple-decisions-for-production-override"
      )
    )
  );
});

test("rejects path traversal and invalid scoped inputs", () => {
  assert.throws(
    () => validateBibleId("../../data"),
    (error) =>
      error instanceof StrongViewerApiError &&
      error.statusCode === 400 &&
      error.code === "invalid-bible"
  );
  assert.throws(
    () =>
      getStrongViewerVerses({
        bible: "nbs",
        book: "../Gen",
        chapter: 1
      }),
    /invalid-book/u
  );
  assert.throws(
    () =>
      getStrongViewerVerses({
        bible: "nbs",
        book: "Gen",
        chapter: 0
      }),
    /invalid-chapter/u
  );
});

async function reviewFixtureRoot(t: test.TestContext): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "strong-viewer-review-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "data"), { recursive: true });
  await writeFile(
    path.join(root, "data", "strong-review-decisions.json"),
    `${JSON.stringify([
      decision("candidate-a", "accepted-safe", "2026-07-09T10:00:00.000Z"),
      decision(
        "candidate-a",
        "needs-witness-review",
        "2026-07-10T10:00:00.000Z"
      ),
      decision("candidate-b", "accepted-safe", "2026-07-10T11:00:00.000Z"),
      decision("candidate-c", "rejected-risky", "2026-07-10T11:30:00.000Z")
    ])}\n`,
    "utf8"
  );

  const oldPlanDir = path.join(root, "outputs", "gap-review", "nbs", "old");
  const planDir = path.join(root, "outputs", "gap-review", "nbs", "latest");
  await Promise.all([
    mkdir(oldPlanDir, { recursive: true }),
    mkdir(planDir, { recursive: true })
  ]);
  await Promise.all([
    writeFile(
      path.join(oldPlanDir, "plan.json"),
      `${JSON.stringify(plan("2026-07-09T12:00:00.000Z", []))}\n`,
      "utf8"
    ),
    writeFile(
      path.join(planDir, "plan.json"),
      `${JSON.stringify(
        plan("2026-07-10T12:00:00.000Z", [
          {
            id: "task-1",
            itemIds: [
              "Gen.1.2|Gen.1.2:1:H0001|empty|H0001",
              "Gen.3.1|Gen.3.1:1:H0003|relocation|H0003"
            ]
          },
          {
            id: "task-2",
            itemIds: ["Gen.2.1|Gen.2.1:1:H0002|empty|H0002"]
          }
        ])
      )}\n`,
      "utf8"
    )
  ]);
  return root;
}

function plan(
  generatedAt: string,
  tasks: Array<{ id: string; itemIds: string[] }>
): Record<string, unknown> {
  return {
    generatedAt,
    bible: "nbs",
    policy: {
      models: ["model-a", "model-b"],
      adaptiveSecondModel: true
    },
    totals: { tasks: tasks.length },
    tasks
  };
}

function decision(
  candidateId: string,
  status: StrongReviewDecisionRecord["status"],
  createdAt: string
): StrongReviewDecisionRecord {
  const ref =
    candidateId === "candidate-a"
      ? "Gen.1.3"
      : candidateId === "candidate-b"
        ? "Gen.2.1"
        : "Exod.1.1";
  const strong = [candidateId === "candidate-a" ? "H0001" : "H0002"];
  const choiceId = "word:1";
  return {
    recordId: `${candidateId}:${status}:${createdAt}`,
    bible: "nbs",
    candidateId,
    choiceId,
    ref,
    decision: "word",
    strong,
    rawDecision: {
      id: candidateId,
      choiceId,
      ref,
      decision: "word",
      strong,
      confidence: 0.9,
      reason: `${status} fixture`,
      wordIndex: 1,
      normalized: "target",
      startWordIndex: null,
      endWordIndex: null,
      normalizedPhrase: null,
      evidence: ["fixture-evidence"]
    },
    confidence: 0.9,
    stage: "post-consensus-filter",
    status,
    reason: `${status} fixture`,
    exactWitnessFamilies: ["sg1910"],
    directDeterministicSupport: status === "accepted-safe",
    evidence: ["fixture-evidence"],
    model: "consensus(model-a,model-b)",
    sourceReview: "outputs/review.json",
    createdAt
  };
}

function filteredOverride(): CuratedStrongOverride {
  return {
    bible: "nbs",
    ref: "Gen.2.1",
    target: "word",
    wordIndex: 1,
    normalized: "target",
    strong: ["H0002"],
    confidence: 0.9,
    source: "semantic-refill:llm-consensus-filtered",
    reason: "exact fixture"
  };
}

function auditFixture(): OverrideAuditReport {
  const items = [
    auditItem({ ref: "Gen.1.1", targetValid: false }),
    auditItem({
      ref: "Gen.1.2",
      source: "llm-review:single-model-auto",
      legacySingleModelAuto: true
    }),
    auditItem({
      ref: "Exod.1.1",
      source: "semantic-refill:llm",
      targetValid: false,
      unverifiedSemanticRefill: true
    })
  ];
  return {
    generatedAt: "2026-07-10T12:00:00.000Z",
    total: 4,
    productionEligible: 2,
    legacySingleModelAuto: 1,
    unverifiedSemanticRefill: 1,
    legacyUnfilteredConsensus: 1,
    referenceStyleFallback: 0,
    invalidTarget: 2,
    invalidProductionTarget: 1,
    invalidLegacyTarget: 0,
    invalidUnverifiedSemanticRefillTarget: 1,
    semanticRefillWithoutConsensusTrace: 1,
    suspiciousReason: 0,
    replacementCount: 0,
    bySource: { "semantic-refill:llm-consensus-filtered": 1 },
    items
  };
}

function auditItem(overrides: Partial<OverrideAuditItem>): OverrideAuditItem {
  return {
    bible: "nbs",
    ref: "Gen.1.1",
    source: "human-approved",
    strong: ["H0001"],
    target: "word:1:terre",
    targetValid: true,
    legacySingleModelAuto: false,
    unverifiedSemanticRefill: false,
    legacyUnfilteredConsensus: false,
    referenceStyleFallback: false,
    consensusTrace: false,
    suspiciousReason: false,
    reason: "fixture override",
    ...overrides
  };
}

function viewerLedger(outputDir: string): StrongLedger {
  const verses = [
    viewerVerse("Gen.1.1", "Gen", 1, 1, "Au commencement", "H0001"),
    viewerVerse("Gen.1.2", "Gen", 1, 2, "La terre", "H0002"),
    viewerVerse("Gen.2.1", "Gen", 2, 1, "Ainsi furent achevés", "H0003"),
    viewerVerse("Exod.1.1", "Exod", 1, 1, "Voici les noms", "H0004")
  ];
  const gen = bookMetrics("Gen", 3);
  const exod = bookMetrics("Exod", 1);
  const metrics: StrongLedgerMetrics = {
    bible: "nbs",
    generatedAt: "2026-07-10T12:00:00.000Z",
    scope: "all",
    ...metricCounts(4),
    books: { Gen: gen, Exod: exod }
  };
  return {
    bible: "nbs",
    generatedAt: metrics.generatedAt,
    inputPath: "data/bibles/bible-nbs.json",
    scope: "all",
    method: "test",
    translationProfile: {} as StrongLedger["translationProfile"],
    references: [],
    originalSources: [],
    outputPaths: {
      canonical: "",
      sqlite: strongLedgerSqlitePath(outputDir, "nbs"),
      readerTsv: "",
      advancedTsv: "",
      debugJson: "",
      metrics: "",
      ledgerManifest: "",
      verseDir: ""
    },
    metrics,
    verses
  };
}

function bookMetrics(
  bookId: string,
  verseCount: number
): StrongLedgerBookMetrics {
  return { bookId, ...metricCounts(verseCount) };
}

function metricCounts(
  verseCount: number
): Omit<StrongLedgerBookMetrics, "bookId"> {
  return {
    verseCount,
    wordCount: verseCount,
    readerVisibleStrongCount: verseCount,
    advancedStrongCount: verseCount,
    emptyStrongCount: 0,
    phraseStrongCount: 0,
    technicalStrongCount: 0,
    pendingHumanCount: 0,
    rejectedCount: 0,
    referenceStrongOccurrenceCount: verseCount,
    referenceStrongRepresentedCount: verseCount,
    referenceStrongCoverage: 1,
    referenceStrongCarrierCount: verseCount,
    referenceStrongCarrierCoverage: 1,
    originalStrongOccurrenceCount: verseCount,
    originalRepresentedStrongOccurrenceCount: verseCount,
    originalRepresentationRate: 1,
    originalStrongCarrierCount: verseCount,
    originalStrongCarrierRate: 1,
    semanticMissingCount: 0,
    readerMultiStrongWordCount: 0,
    readerOverBudgetStrongCount: 0,
    placementRiskCount: 0,
    placementQuality: 1,
    readerTaggedTokenCount: verseCount,
    advancedTaggedTokenCount: verseCount,
    readerTokenCoverage: 1,
    advancedTokenCoverage: 1
  };
}

function viewerVerse(
  ref: string,
  bookId: string,
  chapter: number,
  verse: number,
  text: string,
  strong: string
): StrongLedgerVerse {
  const metrics: StrongLedgerVerseMetrics = {
    ...metricCounts(1)
  };
  return {
    ref,
    bookId,
    chapter,
    verse,
    text,
    tokens: [{ wordIndex: 0, text, normalized: text.toLowerCase() }],
    annotations: [],
    views: {
      readerHtml: `<w>${text}</w>`,
      advancedHtml: `<w>${text}</w>`,
      debugHtml: `<w>${text}</w>`
    },
    inventories: {
      references: { Sg1910: [strong], Darby: [], DarbyR: [] },
      original: [strong],
      reader: [strong],
      advanced: [strong]
    },
    metrics
  };
}
