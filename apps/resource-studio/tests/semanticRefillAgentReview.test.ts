import assert from "node:assert/strict";
import test from "node:test";

import type { CuratedStrongOverride } from "../src/curatedStrongOverrides.js";
import {
  assertProductionApplyEnvelope,
  decisionRecord,
  productionFilteredOverrides,
  upsertCuratedStrongOverrides
} from "../src/semanticRefillAgentReview.js";
import type { SemanticRefillLlmRawDecision } from "../src/semanticRefillLlm.js";

test("decision ledger deduplicates exact replays but preserves changed output", () => {
  const decision: SemanticRefillLlmRawDecision = {
    id: "candidate-1",
    choiceId: "candidate-1:word:2",
    ref: "Gen.1.1",
    decision: "word",
    strong: ["H7225"],
    confidence: 0.91,
    reason: "Exact lexical carrier.",
    wordIndex: 2,
    normalized: "commencement",
    startWordIndex: null,
    endWordIndex: null,
    normalizedPhrase: null,
    evidence: ["reference-exact"]
  };
  const options = {
    bible: "nbs",
    inputPath: "review.json",
    sourcePacket: "packet.json",
    model: "model-a",
    generatedAt: "2026-07-10T00:00:00.000Z",
    decision,
    status: "validated" as const
  };

  const first = decisionRecord(options);
  const replay = decisionRecord(options);
  const changed = decisionRecord({
    ...options,
    decision: { ...decision, confidence: 0.86 }
  });

  assert.equal(first.recordId, replay.recordId);
  assert.notEqual(first.recordId, changed.recordId);
  assert.equal(first.status, "validated");
  assert.equal(first.stage, "model-validation");
  assert.equal(first.sourceReview, "review.json");

  const filtered = decisionRecord({
    ...options,
    stage: "post-consensus-filter",
    status: "needs-witness-review",
    verdictReasons: ["carrier-needs-exact-witness-or-direct-evidence"]
  });
  assert.equal(filtered.status, "needs-witness-review");
  assert.deepEqual(filtered.verdictReasons, [
    "carrier-needs-exact-witness-or-direct-evidence"
  ]);
  assert.notEqual(filtered.recordId, first.recordId);
});

test("production apply requires explicit accepted-safe filter provenance", () => {
  const filterProvenance = {
    reviewModel: "consensus(model-a,model-b)+post-consensus-filter",
    sourceConsensusModel: "consensus(model-a,model-b)",
    filterPolicyVersion: 2
  };
  const raw: SemanticRefillLlmRawDecision = {
    id: "candidate-1",
    choiceId: "candidate-1:word:2",
    ref: "Gen.1.1",
    decision: "word",
    strong: ["H7225"],
    confidence: 0.91,
    reason: "Exact lexical carrier.",
    wordIndex: 2,
    normalized: "commencement",
    startWordIndex: null,
    endWordIndex: null,
    normalizedPhrase: null,
    evidence: ["reference-exact"]
  };
  const validated = [
    {
      ...override("semantic-refill:llm", "unstructured consensus claim"),
      status: "accept" as const,
      score: 0.91,
      priority: "high" as const,
      evidence: ["reference-exact"]
    }
  ];

  assert.throws(
    () =>
      productionFilteredOverrides({
        ...filterProvenance,
        referenceStyleFinalization: false,
        rawDecisions: [raw],
        validated
      }),
    /apply-requires-post-consensus-filter/u
  );
  assert.throws(
    () =>
      productionFilteredOverrides({
        ...filterProvenance,
        referenceStyleFinalization: true,
        rawDecisions: [raw],
        filterOutcomes: [],
        validated
      }),
    /apply-rejects-reference-style-finalization/u
  );

  const [promoted] = productionFilteredOverrides({
    ...filterProvenance,
    referenceStyleFinalization: false,
    rawDecisions: [raw],
    filterOutcomes: [
      {
        decision: raw,
        status: "accepted-safe",
        exactWitnessFamilies: ["Sg1910"],
        directDeterministicSupport: true
      }
    ],
    validated
  });
  assert.equal(promoted?.source, "semantic-refill:llm-consensus-filtered");
  assert.match(promoted?.reason ?? "", /exact-witness-families:Sg1910/u);
  assert.match(promoted?.reason ?? "", /direct-deterministic-support:true/u);
  assert.throws(
    () =>
      productionFilteredOverrides({
        ...filterProvenance,
        reviewModel: "model-a+post-consensus-filter",
        sourceConsensusModel: "model-a",
        referenceStyleFinalization: false,
        rawDecisions: [raw],
        filterOutcomes: [
          {
            decision: raw,
            status: "accepted-safe"
          }
        ],
        validated
      }),
    /consensus-model-provenance-required/u
  );
});

test("production apply requires the batch transaction and an exact packet envelope", () => {
  const valid = {
    apply: true,
    lockHeld: true,
    transactionMarkerExists: true,
    cliBible: "nbs",
    reviewBible: "nbs",
    reviewScope: "Gen.1",
    contractVersion: 2,
    packet: { bible: "nbs", scope: "Gen.1", candidates: [] }
  };
  assert.doesNotThrow(() => assertProductionApplyEnvelope(valid));
  assert.throws(
    () =>
      assertProductionApplyEnvelope({
        ...valid,
        transactionMarkerExists: false
      }),
    /apply-requires-batch-transaction/u
  );
  assert.throws(
    () =>
      assertProductionApplyEnvelope({
        ...valid,
        reviewBible: "bds"
      }),
    /apply-bible-mismatch/u
  );
  assert.throws(
    () =>
      assertProductionApplyEnvelope({
        ...valid,
        reviewScope: "Gen.2"
      }),
    /apply-scope-mismatch/u
  );
  assert.throws(
    () =>
      assertProductionApplyEnvelope({
        ...valid,
        contractVersion: 1
      }),
    /apply-requires-contract-v2/u
  );
});

function override(source: string, reason: string): CuratedStrongOverride {
  return {
    bible: "nbs",
    ref: "Gen.1.1",
    target: "word",
    wordIndex: 2,
    normalized: "commencement",
    strong: ["H7225"],
    confidence: 0.91,
    source,
    reason
  };
}

test("a validated consensus promotes an identical quarantined override", () => {
  const legacy = override(
    "llm-review:single-model-auto",
    "Legacy automatic review."
  );
  const consensus = override(
    "semantic-refill:llm-consensus-filtered",
    "consensus-visible-high-confidence from two independent models"
  );
  const result = upsertCuratedStrongOverrides([legacy], [consensus]);

  assert.equal(result.appliedOverrideCount, 1);
  assert.equal(result.replacedQuarantinedCount, 1);
  assert.deepEqual(result.overrides, [consensus]);
});

test("a validated consensus preserves an existing production override", () => {
  const human = override("llm-review:human-approved", "Reviewed by a human.");
  const consensus = override(
    "semantic-refill:llm-consensus-filtered",
    "consensus-visible-high-confidence from two independent models"
  );
  const result = upsertCuratedStrongOverrides([human], [consensus]);

  assert.equal(result.appliedOverrideCount, 0);
  assert.equal(result.changed, false);
  assert.deepEqual(result.overrides, [human]);
});
