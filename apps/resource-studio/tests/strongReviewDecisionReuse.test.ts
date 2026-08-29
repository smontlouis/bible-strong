import assert from "node:assert/strict";
import test from "node:test";

import { decisionRecord } from "../src/semanticRefillAgentReview.js";
import {
  buildStrongReviewTerminalContext,
  consensusModelIdentities,
  findReusableTerminalDecision,
  terminalRecordMatches,
  type TerminalReviewRecordLike
} from "../src/strongReviewDecisionReuse.js";
import type {
  SemanticRefillLlmCandidatePacket,
  SemanticRefillLlmRawDecision
} from "../src/semanticRefillLlm.js";

const POLICY_FINGERPRINT = "a".repeat(64);

test("terminal reuse requires every versioned context fingerprint", () => {
  const candidate = candidatePacket();
  const filterDecision = rawDecision();
  const context = buildStrongReviewTerminalContext({
    bible: "nbs",
    scope: "Gen.1",
    candidate,
    packetCandidates: [candidate],
    filterInputModel: "consensus(OpenAI/Model-A, DeepSeek/Model-B)",
    filterInputDecisions: [filterDecision],
    policyFingerprint: POLICY_FINGERPRINT
  });
  const record = terminalRecord(context);

  assert.equal(
    terminalRecordMatches({
      record,
      bible: "NBS",
      candidate,
      expectedContext: context
    }),
    true
  );
  assert.equal(
    terminalRecordMatches({
      record: { ...record, terminalContext: undefined },
      bible: "nbs",
      candidate,
      expectedContext: context
    }),
    false,
    "legacy records without a context must never be reused"
  );

  const changedChoiceCandidate = {
    ...candidate,
    choices: candidate.choices.map((choice) =>
      choice.id === "word:2"
        ? { ...choice, description: `${choice.description} changed` }
        : choice
    )
  };
  const changedChoiceContext = buildStrongReviewTerminalContext({
    bible: "nbs",
    scope: "Gen.1",
    candidate: changedChoiceCandidate,
    packetCandidates: [changedChoiceCandidate],
    filterInputModel: "consensus(OpenAI/Model-A, DeepSeek/Model-B)",
    filterInputDecisions: [filterDecision],
    policyFingerprint: POLICY_FINGERPRINT
  });
  assert.notEqual(
    changedChoiceContext.choiceSetFingerprint,
    context.choiceSetFingerprint
  );
  assert.equal(
    terminalRecordMatches({
      record,
      bible: "nbs",
      candidate: changedChoiceCandidate,
      expectedContext: changedChoiceContext
    }),
    false
  );
});

test("terminal context invalidates model, policy, cohort, filter and ledger changes", () => {
  const candidate = candidatePacket();
  const filterDecision = rawDecision();
  const base = contextFor(candidate, [candidate], [filterDecision]);
  const changedModel = buildStrongReviewTerminalContext({
    bible: "nbs",
    scope: "Gen.1",
    candidate,
    packetCandidates: [candidate],
    filterInputModel: "consensus(OpenAI/Model-C, DeepSeek/Model-B)",
    filterInputDecisions: [filterDecision],
    policyFingerprint: POLICY_FINGERPRINT
  });
  const changedPolicy = buildStrongReviewTerminalContext({
    bible: "nbs",
    scope: "Gen.1",
    candidate,
    packetCandidates: [candidate],
    filterInputModel: "consensus(OpenAI/Model-A, DeepSeek/Model-B)",
    filterInputDecisions: [filterDecision],
    policyFingerprint: "b".repeat(64)
  });
  const cohortCandidate = { ...candidatePacket(), id: "candidate-2" };
  const changedCohort = contextFor(
    candidate,
    [candidate, cohortCandidate],
    [filterDecision]
  );
  const changedFilterInput = contextFor(
    candidate,
    [candidate],
    [{ ...filterDecision, confidence: 0.85 }]
  );
  const changedLedgerCandidate = {
    ...candidate,
    existingReaderStrong: [
      ...candidate.existingReaderStrong,
      { placement: "word", strong: "H0002", wordIndex: 3 }
    ]
  };
  const changedLedger = contextFor(
    changedLedgerCandidate,
    [changedLedgerCandidate],
    [filterDecision]
  );

  assert.notEqual(changedModel.modelSetFingerprint, base.modelSetFingerprint);
  assert.notEqual(changedPolicy.policyFingerprint, base.policyFingerprint);
  assert.notEqual(changedCohort.packetFingerprint, base.packetFingerprint);
  assert.notEqual(
    changedFilterInput.filterInputFingerprint,
    base.filterInputFingerprint
  );
  assert.notEqual(
    changedLedger.ledgerStateFingerprint,
    base.ledgerStateFingerprint
  );
});

test("terminal lookup fails closed on conflicting outcomes", () => {
  const candidate = candidatePacket();
  const context = contextFor(candidate, [candidate], [rawDecision()]);
  const record = terminalRecord(context);

  assert.equal(
    findReusableTerminalDecision({
      records: [record, { ...record }],
      bible: "nbs",
      candidate,
      expectedContext: context
    }),
    record
  );
  assert.equal(
    findReusableTerminalDecision({
      records: [record, { ...record, status: "rejected-risky" }],
      bible: "nbs",
      candidate,
      expectedContext: context
    }),
    undefined
  );
  assert.equal(
    findReusableTerminalDecision({
      records: [{ ...record, stage: "model-validation" }],
      bible: "nbs",
      candidate,
      expectedContext: context
    }),
    undefined
  );
});

test("two-model consensus identities are normalized and validated", () => {
  assert.deepEqual(
    consensusModelIdentities(
      "consensus(OpenAI/Model-A, DeepSeek/Model-B)+post-consensus-filter"
    ),
    ["deepseek/model-b", "openai/model-a"]
  );
  assert.equal(consensusModelIdentities("openai/model-a"), undefined);
  assert.equal(
    consensusModelIdentities("consensus(model-a, MODEL-A)"),
    undefined
  );
});

test("terminal context rejects a filter decision outside the exact candidate contract", () => {
  const candidate = candidatePacket();
  assert.throws(
    () =>
      contextFor(
        candidate,
        [candidate],
        [{ ...rawDecision(), choiceId: "reject" }]
      ),
    /terminal-context-filter-decision-mismatch/u
  );
  assert.throws(
    () =>
      buildStrongReviewTerminalContext({
        bible: "other-bible",
        scope: "Gen.1",
        candidate,
        packetCandidates: [candidate],
        filterInputModel: "consensus(model-a,model-b)",
        filterInputDecisions: [rawDecision()],
        policyFingerprint: POLICY_FINGERPRINT
      }),
    /terminal-context-bible-mismatch/u
  );
});

test("terminal decision records keep the proof and deduplicate across output roots", () => {
  const candidate = candidatePacket();
  const decision = rawDecision();
  const terminalContext = contextFor(candidate, [candidate], [decision]);
  const common = {
    bible: "nbs",
    model: "consensus(openai/model-a,deepseek/model-b)+post-consensus-filter",
    decision,
    stage: "post-consensus-filter" as const,
    status: "needs-witness-review" as const,
    terminalContext
  };
  const first = decisionRecord({
    ...common,
    inputPath: "outputs/first/review.json",
    sourcePacket: "outputs/first/packet.json"
  });
  const replay = decisionRecord({
    ...common,
    inputPath: "outputs/second/review.json",
    sourcePacket: "outputs/second/packet.json"
  });

  assert.equal(first.recordId, replay.recordId);
  assert.deepEqual(first.terminalContext, terminalContext);
  assert.deepEqual(first.rawDecision, decision);
  assert.notEqual(first.sourcePacket, replay.sourcePacket);
});

function contextFor(
  candidate: SemanticRefillLlmCandidatePacket,
  packetCandidates: SemanticRefillLlmCandidatePacket[],
  filterInputDecisions: SemanticRefillLlmRawDecision[]
) {
  return buildStrongReviewTerminalContext({
    bible: "nbs",
    scope: "Gen.1",
    candidate,
    packetCandidates,
    filterInputModel: "consensus(OpenAI/Model-A, DeepSeek/Model-B)",
    filterInputDecisions,
    policyFingerprint: POLICY_FINGERPRINT
  });
}

function terminalRecord(
  terminalContext: ReturnType<typeof buildStrongReviewTerminalContext>
): TerminalReviewRecordLike {
  return {
    bible: "nbs",
    candidateId: "candidate-1",
    choiceId: "word:2",
    ref: "Gen.1.1",
    decision: "word",
    strong: ["H7225"],
    stage: "post-consensus-filter",
    status: "needs-witness-review",
    terminalContext
  };
}

function candidatePacket(): SemanticRefillLlmCandidatePacket {
  return {
    id: "candidate-1",
    bible: "nbs",
    ref: "Gen.1.1",
    text: "Au commencement Dieu créa.",
    auditKind: "missing",
    priority: "semantic-high",
    strong: "H7225",
    currentPlacement: "empty",
    sourcePlacement: { placement: "empty", insertAfterWordIndex: -1 },
    reason: "lexical-candidate",
    eligible: true,
    tokens: [
      { wordIndex: 0, text: "Au", normalized: "au" },
      { wordIndex: 1, text: "commencement", normalized: "commencement" }
    ],
    originalInventory: ["H7225"],
    referenceInventory: { Sg1910: ["H7225"] },
    existingReaderStrong: [],
    occupiedTargets: [],
    availableTargets: [
      {
        wordIndex: 1,
        text: "commencement",
        normalized: "commencement",
        weak: false,
        occupiedStrong: []
      }
    ],
    blockedTargets: [],
    openContentTargets: [
      { wordIndex: 1, text: "commencement", normalized: "commencement" }
    ],
    nearbyOpenTargets: [
      {
        wordIndex: 1,
        text: "commencement",
        normalized: "commencement",
        distanceFromSource: 2
      }
    ],
    placementWarnings: [],
    deterministicCandidates: [
      {
        target: "word",
        strong: "H7225",
        score: 0.95,
        wordIndex: 1,
        normalizedWord: "commencement",
        evidence: ["reference-exact"]
      }
    ],
    choices: [
      {
        id: "word:2",
        decision: "word",
        description: "Attach to commencement.",
        wordIndex: 1,
        normalized: "commencement",
        startWordIndex: null,
        endWordIndex: null,
        normalizedPhrase: null
      },
      {
        id: "reject",
        decision: "reject",
        description: "Reject candidate.",
        wordIndex: null,
        normalized: null,
        startWordIndex: null,
        endWordIndex: null,
        normalizedPhrase: null
      }
    ]
  };
}

function rawDecision(): SemanticRefillLlmRawDecision {
  return {
    id: "candidate-1",
    choiceId: "word:2",
    ref: "Gen.1.1",
    decision: "word",
    strong: ["H7225"],
    confidence: 0.91,
    reason: "Exact lexical carrier.",
    wordIndex: 1,
    normalized: "commencement",
    startWordIndex: null,
    endWordIndex: null,
    normalizedPhrase: null,
    evidence: ["reference-exact"]
  };
}
