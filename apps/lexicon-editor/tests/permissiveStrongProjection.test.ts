import assert from "node:assert/strict";
import { test } from "node:test";

import {
  applyPermissivePromotionPlan,
  buildPermissivePromotionPlan,
  promotionMap
} from "../src/permissiveStrongProjection";
import {
  type LexicalCandidate,
  type LexicalCandidateItem,
  type LexicalCandidateReport
} from "../src/lexicalCandidateReport";
import { type StrongLedgerAnnotation } from "../src/strongLedger";

function candidate(
  overrides: Partial<LexicalCandidate> = {}
): LexicalCandidate {
  return {
    target: "word",
    wordIndex: 1,
    text: "Seigneur",
    normalized: "seigneur",
    lemma: "seigneur",
    score: 0.91,
    confidence: "high",
    occupied: false,
    evidence: [
      {
        source: "seed-term",
        provenanceRoot: "strong-dictionary",
        detail: "direct lexical evidence",
        weight: 0.5
      }
    ],
    ...overrides
  };
}

function item(
  overrides: Partial<LexicalCandidateItem> = {}
): LexicalCandidateItem {
  return {
    auditKind: "empty",
    annotationId: "Lev.2.1:24:H3068",
    ref: "Lev.2.1",
    text: "au Seigneur",
    strong: "H3068",
    insertAfterWordIndex: 0,
    stepGlosses: ["YHWH"],
    dictionaryTerms: ["seigneur"],
    inferredTerms: [],
    candidates: [candidate()],
    ...overrides
  };
}

function report(items: LexicalCandidateItem[]): LexicalCandidateReport {
  return {
    bible: "nbs",
    generatedAt: "ignored-by-plan",
    inputPath: "ledger.sqlite",
    scope: "all",
    sources: {
      strongDictionary: true,
      rezoJdmFetch: false
    },
    metrics: {
      verses: 1,
      auditItems: items.length,
      emptyAnnotations: items.length,
      readerEmptyAnnotations: 0,
      advancedEmptyAnnotations: items.length,
      relocationAnnotations: 0,
      itemsWithCandidates: items.filter(
        (candidateItem) => candidateItem.candidates.length > 0
      ).length,
      emptyWithCandidates: items.filter(
        (candidateItem) => candidateItem.candidates.length > 0
      ).length,
      relocationWithCandidates: 0,
      candidateCount: items.reduce(
        (total, candidateItem) => total + candidateItem.candidates.length,
        0
      ),
      highConfidenceCandidates: 1,
      mediumConfidenceCandidates: 0,
      lowConfidenceCandidates: 0,
      occupiedCandidates: 0,
      openCandidates: 1,
      reviewableCandidates: 1,
      autoSafeCandidates: 0,
      autoSafeItems: 0,
      groupAutoSafeItems: 0,
      ambiguousHighItems: 0,
      openHighItems: 1,
      relocationBetterOpenItems: 0,
      evidenceSourceCounts: {}
    },
    items
  };
}

function annotation(): StrongLedgerAnnotation {
  return {
    id: "Lev.2.1:24:H3068",
    strong: "H3068",
    visibility: "advanced",
    placement: "empty",
    source: "original-complete",
    confidence: 0.35,
    reason: "no reader carrier",
    diagnostics: [],
    insertAfterWordIndex: 0,
    originalOccurrenceId: "TAHOT.Lev.2.1.6.L.main:0"
  };
}

test("builds a stable high-recall promotion independent of candidate order", () => {
  const weaker = candidate({
    wordIndex: 0,
    text: "présent",
    normalized: "present",
    lemma: "present",
    score: 0.62,
    confidence: "medium"
  });
  const first = buildPermissivePromotionPlan({
    report: report([item({ candidates: [weaker, candidate()] })]),
    inputFingerprint: "fingerprint"
  });
  const second = buildPermissivePromotionPlan({
    report: report([item({ candidates: [candidate(), weaker] })]),
    inputFingerprint: "fingerprint"
  });

  assert.deepEqual(first, second);
  assert.equal(first.promotions.length, 1);
  assert.equal(first.promotions[0]?.normalized, "seigneur");
  assert.equal(first.metrics.retainedEmptyWithoutCandidateCount, 0);
});

test("keeps an empty Strong when all candidates are low confidence", () => {
  const plan = buildPermissivePromotionPlan({
    report: report([
      item({
        dictionaryTerms: [],
        candidates: [
          candidate({
            score: 0.47,
            confidence: "low"
          })
        ]
      })
    ]),
    inputFingerprint: "fingerprint"
  });

  assert.equal(plan.promotions.length, 0);
  assert.equal(plan.metrics.retainedEmptyWithoutCandidateCount, 1);
});

test("uses an exact Strong dictionary term when proper-name scoring emitted no candidate", () => {
  const plan = buildPermissivePromotionPlan({
    report: report([item({ candidates: [] })]),
    inputFingerprint: "fingerprint"
  });

  assert.equal(plan.promotions.length, 1);
  assert.equal(plan.promotions[0]?.normalized, "seigneur");
  assert.equal(plan.promotions[0]?.wordIndex, 1);
  assert.deepEqual(plan.promotions[0]?.evidenceSources, [
    "permissive-dictionary-exact"
  ]);
});

test("applies a promotion only in the derived projection", () => {
  const source = annotation();
  const plan = buildPermissivePromotionPlan({
    report: report([item()]),
    inputFingerprint: "fingerprint"
  });
  const applied = applyPermissivePromotionPlan({
    ref: "Lev.2.1",
    annotations: [source],
    promotionsByAnnotationId: promotionMap(plan)
  });

  assert.equal(source.placement, "empty");
  assert.equal(source.insertAfterWordIndex, 0);
  assert.equal(applied.annotations[0]?.placement, "word");
  assert.equal(applied.annotations[0]?.wordIndex, 1);
  assert.equal(applied.annotations[0]?.normalizedWord, "seigneur");
  assert.equal(applied.promotedAnnotationCount, 1);
});

test("keeps a promoted occurrence empty instead of repeating the same Strong on one carrier", () => {
  const source = annotation();
  const existing: StrongLedgerAnnotation = {
    ...annotation(),
    id: "Lev.2.1:5:H3068",
    visibility: "reader",
    placement: "word",
    wordIndex: 1,
    normalizedWord: "seigneur"
  };
  const plan = buildPermissivePromotionPlan({
    report: report([item()]),
    inputFingerprint: "fingerprint"
  });
  const applied = applyPermissivePromotionPlan({
    ref: "Lev.2.1",
    annotations: [existing, source],
    promotionsByAnnotationId: promotionMap(plan)
  });

  assert.equal(applied.annotations[1]?.placement, "empty");
  assert.equal(applied.promotedAnnotationCount, 0);
  assert.equal(applied.skippedDuplicateCarrierCount, 1);
});
