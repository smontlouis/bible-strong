import { createHash } from "node:crypto";
import { existsSync } from "node:fs";

import { contentFingerprint } from "./contentAddressedCache.js";
import type {
  SemanticRefillLlmCandidatePacket,
  SemanticRefillLlmRawDecision
} from "./semanticRefillLlm.js";

export const STRONG_REVIEW_TERMINAL_CONTEXT_VERSION = 1 as const;

export type ReusableTerminalReviewStatus =
  | "needs-witness-review"
  | "rejected-risky";

/**
 * A content-only proof for a terminal post-consensus decision. Paths and
 * timestamps are deliberately excluded so the proof can survive a new output
 * root. Every semantic input that can affect the result is fingerprinted.
 *
 * This context is not, by itself, permission to skip an LLM call. The filter
 * input fingerprint is only known after consensus has been rebuilt. It does
 * make an identical terminal result safely reusable by a later manual-review
 * stage, and gives a future pre-LLM cache a versioned contract to migrate to.
 */
export interface StrongReviewTerminalContext {
  version: typeof STRONG_REVIEW_TERMINAL_CONTEXT_VERSION;
  candidateId: string;
  candidateFingerprint: string;
  choiceSetFingerprint: string;
  packetFingerprint: string;
  filterInputFingerprint: string;
  policyFingerprint: string;
  modelSetFingerprint: string;
  ledgerStateFingerprint: string;
}

export interface TerminalReviewRecordLike {
  bible: string;
  candidateId: string;
  choiceId: string;
  ref: string;
  decision: string;
  strong: string[];
  stage: string;
  status: string;
  terminalContext?: StrongReviewTerminalContext;
}

export interface TerminalReviewContextInput {
  bible: string;
  scope: string;
  candidate: SemanticRefillLlmCandidatePacket;
  packetCandidates: SemanticRefillLlmCandidatePacket[];
  filterInputModel: string;
  filterInputDecisions: SemanticRefillLlmRawDecision[];
  policyFingerprint?: string;
}

const POLICY_INPUT_PATHS = [
  "data/strongs/Darby.csv",
  "data/strongs/DarbyR.csv",
  "data/strongs/Sg1910.csv",
  "src/contentAddressedCache.ts",
  "src/curatedStrongOverrides.ts",
  "src/frenchLexicalSafety.ts",
  "src/runSemanticRefillGapReviewBatch.ts",
  "src/runSemanticRefillPacketLlm.ts",
  "src/semanticRefill.ts",
  "src/semanticRefillAgentReview.ts",
  "src/semanticRefillConsensusFilter.ts",
  "src/semanticRefillConsensusReview.ts",
  "src/semanticRefillLexicalPacket.ts",
  "src/semanticRefillLlm.ts",
  "src/strongCsv.ts",
  "src/strongLedger.ts",
  "src/strongLedgerStore.ts",
  "src/strongReviewDecisionReuse.ts",
  "src/tokenize.ts"
];

export function strongReviewReusePolicyFingerprint(): string {
  const missing = POLICY_INPUT_PATHS.filter(
    (inputPath) => !existsSync(inputPath)
  );
  if (missing.length > 0) {
    throw new Error(`terminal-policy-input-missing:${missing.join(",")}`);
  }
  return contentFingerprint({
    namespace: `strong-review-terminal-policy-v${STRONG_REVIEW_TERMINAL_CONTEXT_VERSION}`,
    inputPaths: POLICY_INPUT_PATHS,
    values: {
      consensusMinimumConfidence: 0.84,
      reasoningEffort: process.env.AI_GATEWAY_REASONING_EFFORT ?? null,
      reusableStage: "post-consensus-filter",
      reusableStatuses: ["needs-witness-review", "rejected-risky"]
    }
  });
}

export function buildStrongReviewTerminalContext(
  input: TerminalReviewContextInput
): StrongReviewTerminalContext {
  if (input.candidate.id.length === 0) {
    throw new Error("terminal-context-requires-candidate-id");
  }
  if (normalizeBible(input.candidate.bible) !== normalizeBible(input.bible)) {
    throw new Error(
      `terminal-context-bible-mismatch:${input.bible}:${input.candidate.bible}`
    );
  }
  if (
    input.packetCandidates.filter((item) => item.id === input.candidate.id)
      .length !== 1
  ) {
    throw new Error(
      `terminal-context-requires-unique-packet-candidate:${input.candidate.id}`
    );
  }
  if (
    new Set(input.packetCandidates.map((candidate) => candidate.id)).size !==
    input.packetCandidates.length
  ) {
    throw new Error("terminal-context-requires-unique-packet-candidate-ids");
  }
  if (
    new Set(input.filterInputDecisions.map((decision) => decision.id)).size !==
      input.filterInputDecisions.length ||
    input.filterInputDecisions.filter(
      (decision) => decision.id === input.candidate.id
    ).length !== 1
  ) {
    throw new Error(
      `terminal-context-requires-unique-filter-decision:${input.candidate.id}`
    );
  }
  const candidateDecision = input.filterInputDecisions.find(
    (decision) => decision.id === input.candidate.id
  )!;
  if (
    candidateDecision.ref !== input.candidate.ref ||
    !sameStrongInventory(candidateDecision.strong, [input.candidate.strong]) ||
    !input.candidate.choices.some(
      (choice) =>
        choice.id === candidateDecision.choiceId &&
        choice.decision === candidateDecision.decision
    )
  ) {
    throw new Error(
      `terminal-context-filter-decision-mismatch:${input.candidate.id}`
    );
  }
  const models = consensusModelIdentities(input.filterInputModel);
  if (!models) {
    throw new Error(
      `terminal-context-requires-two-model-consensus:${input.filterInputModel}`
    );
  }

  const policyFingerprint =
    input.policyFingerprint ?? strongReviewReusePolicyFingerprint();
  if (!/^[0-9a-f]{64}$/u.test(policyFingerprint)) {
    throw new Error("terminal-context-invalid-policy-fingerprint");
  }

  return {
    version: STRONG_REVIEW_TERMINAL_CONTEXT_VERSION,
    candidateId: input.candidate.id,
    candidateFingerprint: fingerprint(
      "strong-review-candidate-v1",
      input.candidate
    ),
    choiceSetFingerprint: fingerprint(
      "strong-review-choice-set-v1",
      [...input.candidate.choices].sort((left, right) =>
        left.id.localeCompare(right.id)
      )
    ),
    packetFingerprint: fingerprint("strong-review-packet-v1", {
      bible: normalizeBible(input.bible),
      scope: input.scope,
      candidates: input.packetCandidates
    }),
    filterInputFingerprint: fingerprint("strong-review-filter-input-v1", {
      model: normalizeModelIdentity(input.filterInputModel),
      decisions: input.filterInputDecisions
    }),
    policyFingerprint,
    modelSetFingerprint: fingerprint("strong-review-model-set-v1", models),
    ledgerStateFingerprint: fingerprint(
      "strong-review-relevant-ledger-state-v1",
      relevantLedgerState(input.candidate)
    )
  };
}

/**
 * Returns a terminal record only when every durable proof matches exactly.
 * Legacy records, malformed contexts, non-filter stages and conflicting
 * duplicate outcomes all fail closed.
 */
export function findReusableTerminalDecision(options: {
  records: TerminalReviewRecordLike[];
  bible: string;
  candidate: SemanticRefillLlmCandidatePacket;
  expectedContext: StrongReviewTerminalContext;
}): TerminalReviewRecordLike | undefined {
  const matching = options.records.filter((record) =>
    terminalRecordMatches({
      record,
      bible: options.bible,
      candidate: options.candidate,
      expectedContext: options.expectedContext
    })
  );
  if (matching.length === 0) return undefined;

  const outcomes = new Set(
    matching.map((record) =>
      canonicalJson({
        choiceId: record.choiceId,
        decision: record.decision,
        status: record.status,
        strong: record.strong
      })
    )
  );
  return outcomes.size === 1 ? matching[0] : undefined;
}

export function terminalRecordMatches(options: {
  record: TerminalReviewRecordLike;
  bible: string;
  candidate: SemanticRefillLlmCandidatePacket;
  expectedContext: StrongReviewTerminalContext;
}): boolean {
  const { record, candidate, expectedContext } = options;
  if (
    record.stage !== "post-consensus-filter" ||
    !isReusableTerminalStatus(record.status) ||
    normalizeBible(record.bible) !== normalizeBible(options.bible) ||
    record.candidateId !== candidate.id ||
    record.ref !== candidate.ref ||
    !sameStrongInventory(record.strong, [candidate.strong]) ||
    !candidate.choices.some(
      (choice) =>
        choice.id === record.choiceId && choice.decision === record.decision
    ) ||
    !validTerminalContext(record.terminalContext) ||
    !validTerminalContext(expectedContext) ||
    record.terminalContext.candidateId !== candidate.id ||
    expectedContext.candidateId !== candidate.id
  ) {
    return false;
  }
  return (
    canonicalJson(record.terminalContext) === canonicalJson(expectedContext)
  );
}

export function isReusableTerminalStatus(
  status: string
): status is ReusableTerminalReviewStatus {
  return status === "needs-witness-review" || status === "rejected-risky";
}

export function consensusModelIdentities(model: string): string[] | undefined {
  const normalized = model.trim();
  const withoutFilter = normalized.endsWith("+post-consensus-filter")
    ? normalized.slice(0, -"+post-consensus-filter".length)
    : normalized;
  const match = /^consensus\((?<models>.*)\)$/u.exec(withoutFilter);
  if (!match?.groups?.models) return undefined;
  const models = match.groups.models
    .split(",")
    .map(normalizeModelIdentity)
    .filter(Boolean);
  if (models.length !== 2 || new Set(models).size !== 2) return undefined;
  return models.sort();
}

function validTerminalContext(
  context: StrongReviewTerminalContext | undefined
): context is StrongReviewTerminalContext {
  return (
    context?.version === STRONG_REVIEW_TERMINAL_CONTEXT_VERSION &&
    typeof context.candidateId === "string" &&
    context.candidateId.length > 0 &&
    [
      context.candidateFingerprint,
      context.choiceSetFingerprint,
      context.packetFingerprint,
      context.filterInputFingerprint,
      context.policyFingerprint,
      context.modelSetFingerprint,
      context.ledgerStateFingerprint
    ].every((value) => /^[0-9a-f]{64}$/u.test(value))
  );
}

function relevantLedgerState(
  candidate: SemanticRefillLlmCandidatePacket
): unknown {
  return {
    bible: candidate.bible,
    ref: candidate.ref,
    text: candidate.text,
    auditKind: candidate.auditKind,
    strong: candidate.strong,
    currentPlacement: candidate.currentPlacement,
    currentTarget: candidate.currentTarget,
    sourcePlacement: candidate.sourcePlacement,
    tokens: candidate.tokens,
    originalInventory: candidate.originalInventory,
    referenceInventory: candidate.referenceInventory,
    existingReaderStrong: candidate.existingReaderStrong,
    occupiedTargets: candidate.occupiedTargets,
    availableTargets: candidate.availableTargets,
    blockedTargets: candidate.blockedTargets,
    openContentTargets: candidate.openContentTargets,
    nearbyOpenTargets: candidate.nearbyOpenTargets
  };
}

function sameStrongInventory(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every(
      (strong, index) => strong.toUpperCase() === right[index]?.toUpperCase()
    )
  );
}

function fingerprint(namespace: string, value: unknown): string {
  return createHash("sha256")
    .update(namespace)
    .update("\0")
    .update(canonicalJson(value))
    .digest("hex");
}

function normalizeBible(bible: string): string {
  return bible.trim().toLowerCase();
}

function normalizeModelIdentity(model: string): string {
  return model.trim().toLowerCase();
}

function canonicalJson(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "undefined";
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
    .join(",")}}`;
}
