import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  isLegacySingleModelAutoOverride,
  isUnverifiedSemanticRefillOverride,
  type CuratedStrongOverride
} from "./curatedStrongOverrides.js";
import { type StrongLedgerVerse } from "./strongLedger.js";
import {
  readStrongLedgerVersesSqlite,
  strongLedgerSqlitePath
} from "./strongLedgerStore.js";
import {
  buildSemanticRefillLlmBatch,
  evaluateSemanticRefillLlmDecisions,
  assertSemanticRefillRawDecisionContract,
  assertSemanticRefillRawDecisionSubsetContract,
  SEMANTIC_REFILL_LLM_DECISION_TYPES,
  type SemanticRefillLlmBatch,
  type SemanticRefillLlmCandidatePacket,
  type SemanticRefillLlmDecisionType,
  type SemanticRefillLlmRawDecision
} from "./semanticRefillLlm.js";
import { type SemanticRefillAuditItem } from "./semanticRefill.js";
import { withReviewFileLock } from "./reviewFileLock.js";
import { assertDistinctConsensusReviewModel } from "./semanticRefillConsensusReview.js";
import { POST_CONSENSUS_FILTER_POLICY_VERSION } from "./semanticRefillConsensusFilter.js";
import { DEFAULT_REVIEW_TRANSACTION_MARKER } from "./reviewTransaction.js";
import {
  buildStrongReviewTerminalContext,
  isReusableTerminalStatus,
  strongReviewReusePolicyFingerprint,
  type StrongReviewTerminalContext
} from "./strongReviewDecisionReuse.js";

interface AgentReviewFile {
  bible?: string;
  books?: string[];
  scope?: string;
  sourcePacket?: string;
  decisions?: unknown[];
  parseError?: string;
  contract?: { version?: number };
  model?: string;
  generatedAt?: string;
  postConsensusFilter?: {
    policyVersion?: number;
    sourceConsensusModel?: string;
    sourceReview?: string;
    outcomes?: FilterDecisionOutcome[];
  };
}

interface FilterDecisionOutcome {
  decision: SemanticRefillLlmRawDecision;
  status: "accepted-safe" | "needs-witness-review" | "rejected-risky";
  reasons?: string[];
  exactWitnessFamilies?: string[];
  directDeterministicSupport?: boolean;
}

interface AgentPacketFile {
  bible: string;
  scope: string;
  candidates: SemanticRefillLlmCandidatePacket[];
}

interface AgentReviewResult {
  input: string;
  outputDir: string;
  bible: string;
  books: string[];
  referenceStyleFinalization: boolean;
  rawDecisionCount: number;
  validatedCount: number;
  appliedOverrideCount: number;
  pendingCount: number;
  rejectedCount: number;
}

async function validateAgentReview(options: {
  inputPath: string;
  outputDir: string;
  bible: string;
  candidatesPath: string;
  ledgerDir: string;
  overridesPath: string;
  decisionLedgerPath: string;
  apply: boolean;
  recordDecisions: boolean;
  lockHeld: boolean;
  referenceStyleFinalization: boolean;
}): Promise<AgentReviewResult> {
  const review = JSON.parse(
    await readFile(options.inputPath, "utf8")
  ) as AgentReviewFile;
  if (review.parseError) {
    throw new Error(`unusable-agent-review:${review.parseError}`);
  }
  const rawDecisions = normalizeRawDecisions(review.decisions ?? []);
  const filterOutcomes = normalizeFilterOutcomes(
    review.postConsensusFilter?.outcomes
  );
  const packet = await readOptionalPacket(review.sourcePacket);
  assertProductionApplyEnvelope({
    apply: options.apply,
    lockHeld: options.lockHeld,
    transactionMarkerExists: existsSync(DEFAULT_REVIEW_TRANSACTION_MARKER),
    cliBible: options.bible,
    reviewBible: review.bible,
    reviewScope: review.scope,
    contractVersion: review.contract?.version,
    packet
  });
  const books = packet
    ? inferBooksFromRefs(packet.candidates.map((candidate) => candidate.ref))
    : inferBooks(review.books, rawDecisions);
  const candidates = packet
    ? []
    : (
        JSON.parse(
          await readFile(options.candidatesPath, "utf8")
        ) as SemanticRefillAuditItem[]
      ).filter((candidate) =>
        books.includes(candidate.ref.split(".")[0] ?? "")
      );
  const verses = await readBookVerses(options.ledgerDir, options.bible, books);
  const batch = packet
    ? packetToBatch(packet)
    : buildSemanticRefillLlmBatch({
        bible: options.bible,
        scope: books.join(","),
        candidates,
        verses
      });
  if (options.referenceStyleFinalization) {
    assertSemanticRefillRawDecisionContract({ batch, rawDecisions });
  } else if (review.contract?.version === 2) {
    assertSemanticRefillRawDecisionSubsetContract({ batch, rawDecisions });
  }
  const evaluated = evaluateSemanticRefillLlmDecisions({
    bible: options.bible,
    verses,
    batch,
    rawDecisions,
    referenceStyleFinalization: options.referenceStyleFinalization
  });
  const productionValidated = options.apply
    ? productionFilteredOverrides({
        referenceStyleFinalization: options.referenceStyleFinalization,
        reviewModel: review.model,
        filterPolicyVersion: review.postConsensusFilter?.policyVersion,
        sourceConsensusModel: review.postConsensusFilter?.sourceConsensusModel,
        rawDecisions,
        filterOutcomes,
        validated: evaluated.validated
      })
    : evaluated.validated;
  const terminalContexts = await readTerminalDecisionContexts({
    bible: options.bible,
    review,
    packet,
    filterOutcomes
  });

  await mkdir(options.outputDir, { recursive: true });
  await Promise.all([
    writeJson(
      path.join(options.outputDir, "accepted.json"),
      evaluated.validated
    ),
    writeJson(path.join(options.outputDir, "pending.json"), evaluated.pending),
    writeJson(path.join(options.outputDir, "rejected.json"), evaluated.rejected)
  ]);

  let appliedOverrideCount = 0;
  if (options.apply || options.recordDecisions) {
    const persist = async (): Promise<void> => {
      if (options.apply && productionValidated.length > 0) {
        appliedOverrideCount = await appendOverrides(
          options.overridesPath,
          productionValidated
        );
      }
      await appendDecisionLedger(options.decisionLedgerPath, {
        bible: options.bible,
        inputPath: options.inputPath,
        sourcePacket: review.sourcePacket,
        model: review.model,
        generatedAt: review.generatedAt,
        rawDecisions,
        filterOutcomes,
        terminalContexts,
        pendingIds: new Set(evaluated.pending.map((decision) => decision.id)),
        rejectedIds: new Set(evaluated.rejected.map((decision) => decision.id))
      });
    };
    if (options.lockHeld) await persist();
    else {
      await withReviewFileLock(persist, {
        timeoutMs: 10 * 60_000,
        staleAfterMs: 60 * 60_000
      });
    }
  }
  if (options.apply) {
    await writeJson(path.join(options.outputDir, "application.json"), {
      validatedCount: evaluated.validated.length,
      appliedOverrideCount
    });
  }

  return {
    input: options.inputPath,
    outputDir: options.outputDir,
    bible: options.bible,
    books,
    referenceStyleFinalization: options.referenceStyleFinalization,
    rawDecisionCount: rawDecisions.length,
    validatedCount: evaluated.validated.length,
    appliedOverrideCount,
    pendingCount: evaluated.pending.length,
    rejectedCount: evaluated.rejected.length
  };
}

export function assertProductionApplyEnvelope(options: {
  apply: boolean;
  lockHeld: boolean;
  transactionMarkerExists: boolean;
  cliBible: string;
  reviewBible?: string;
  reviewScope?: string;
  contractVersion?: number;
  packet?: AgentPacketFile;
}): void {
  if (!options.apply) return;
  if (!options.lockHeld || !options.transactionMarkerExists) {
    throw new Error("apply-requires-batch-transaction");
  }
  if (!options.packet) throw new Error("apply-requires-source-packet");
  if (
    options.reviewBible?.toLowerCase() !== options.cliBible.toLowerCase() ||
    options.packet.bible.toLowerCase() !== options.cliBible.toLowerCase()
  ) {
    throw new Error(
      `apply-bible-mismatch:${options.cliBible}:${options.reviewBible ?? "missing"}:${options.packet.bible}`
    );
  }
  if (!options.reviewScope || options.reviewScope !== options.packet.scope) {
    throw new Error(
      `apply-scope-mismatch:${options.reviewScope ?? "missing"}:${options.packet.scope}`
    );
  }
  if (options.contractVersion !== 2) {
    throw new Error(
      `apply-requires-contract-v2:${options.contractVersion ?? "missing"}`
    );
  }
}

export function productionFilteredOverrides(options: {
  referenceStyleFinalization: boolean;
  reviewModel?: string;
  filterPolicyVersion?: number;
  sourceConsensusModel?: string;
  rawDecisions: SemanticRefillLlmRawDecision[];
  filterOutcomes?: FilterDecisionOutcome[];
  validated: CuratedStrongOverride[];
}): CuratedStrongOverride[] {
  if (options.referenceStyleFinalization) {
    throw new Error("apply-rejects-reference-style-finalization");
  }
  if (!options.filterOutcomes) {
    throw new Error("apply-requires-post-consensus-filter");
  }
  assertDistinctConsensusReviewModel(options.reviewModel);
  assertDistinctConsensusReviewModel(options.sourceConsensusModel);
  if (options.filterPolicyVersion !== POST_CONSENSUS_FILTER_POLICY_VERSION) {
    throw new Error(
      `apply-requires-current-filter-policy:${POST_CONSENSUS_FILTER_POLICY_VERSION}:${options.filterPolicyVersion ?? "missing"}`
    );
  }

  const acceptedByDecision = new Map(
    options.filterOutcomes
      .filter((outcome) => outcome.status === "accepted-safe")
      .map((outcome) => [rawDecisionIdentity(outcome.decision), outcome])
  );
  for (const decision of options.rawDecisions) {
    if (!acceptedByDecision.has(rawDecisionIdentity(decision))) {
      throw new Error(
        `apply-decision-not-accepted-safe:${decision.id}:${decision.choiceId}`
      );
    }
  }

  return options.validated.map((decision) => {
    const raw = options.rawDecisions.find((candidate) =>
      rawDecisionMatchesOverride(candidate, decision)
    );
    const outcome = raw
      ? acceptedByDecision.get(rawDecisionIdentity(raw))
      : undefined;
    if (!outcome) {
      throw new Error(
        `apply-validated-decision-lacks-filter-proof:${decision.ref}:${decision.strong.join(",")}`
      );
    }
    return {
      ...decision,
      source: "semantic-refill:llm-consensus-filtered",
      reason: [
        decision.reason,
        "post-consensus-filter:accepted-safe",
        ...uniqueFilterEvidence([outcome])
      ]
        .filter(Boolean)
        .join("; ")
    };
  });
}

function rawDecisionIdentity(decision: SemanticRefillLlmRawDecision): string {
  return JSON.stringify(decision);
}

async function readTerminalDecisionContexts(options: {
  bible: string;
  review: AgentReviewFile;
  packet?: AgentPacketFile;
  filterOutcomes?: FilterDecisionOutcome[];
}): Promise<Map<string, StrongReviewTerminalContext>> {
  const output = new Map<string, StrongReviewTerminalContext>();
  const sourceReviewPath = options.review.postConsensusFilter?.sourceReview;
  if (
    !options.packet ||
    !sourceReviewPath ||
    !options.review.model ||
    !options.filterOutcomes?.some((outcome) =>
      isReusableTerminalStatus(outcome.status)
    )
  ) {
    return output;
  }

  try {
    const sourceReview = JSON.parse(
      await readFile(sourceReviewPath, "utf8")
    ) as AgentReviewFile;
    if (
      typeof sourceReview.model !== "string" ||
      options.review.model !== `${sourceReview.model}+post-consensus-filter` ||
      !Array.isArray(sourceReview.decisions)
    ) {
      return output;
    }
    const filterInputDecisions = normalizeRawDecisions(sourceReview.decisions);
    const filterInputIdentities = new Set(
      filterInputDecisions.map(rawDecisionIdentity)
    );
    const candidateById = new Map(
      options.packet.candidates.map((candidate) => [candidate.id, candidate])
    );
    const policyFingerprint = strongReviewReusePolicyFingerprint();
    const duplicates = new Set<string>();

    for (const outcome of options.filterOutcomes) {
      if (
        !isReusableTerminalStatus(outcome.status) ||
        !filterInputIdentities.has(rawDecisionIdentity(outcome.decision))
      ) {
        continue;
      }
      const candidate = candidateById.get(outcome.decision.id);
      if (!candidate) continue;
      const key = terminalDecisionContextKey(outcome.decision);
      if (output.has(key)) {
        duplicates.add(key);
        output.delete(key);
        continue;
      }
      output.set(
        key,
        buildStrongReviewTerminalContext({
          bible: options.bible,
          scope: options.packet.scope,
          candidate,
          packetCandidates: options.packet.candidates,
          filterInputModel: sourceReview.model,
          filterInputDecisions,
          policyFingerprint
        })
      );
    }
    for (const key of duplicates) output.delete(key);
  } catch {
    // Reuse metadata is optional and must fail closed. Validation and durable
    // decision recording continue, but the record cannot be reused later.
    output.clear();
  }
  return output;
}

function terminalDecisionContextKey(
  decision: SemanticRefillLlmRawDecision
): string {
  return `${decision.id}\0${decision.choiceId}`;
}

function rawDecisionMatchesOverride(
  raw: SemanticRefillLlmRawDecision,
  override: CuratedStrongOverride
): boolean {
  const target = override.target ?? "word";
  if (
    raw.ref !== override.ref ||
    raw.decision !== target ||
    raw.strong.length !== override.strong.length ||
    !raw.strong.every(
      (strong, index) =>
        strong.toUpperCase() === override.strong[index]?.toUpperCase()
    )
  ) {
    return false;
  }
  if (target === "phrase") {
    return (
      raw.startWordIndex === override.startWordIndex &&
      raw.endWordIndex === override.endWordIndex
    );
  }
  return raw.wordIndex === override.wordIndex;
}

function uniqueFilterEvidence(outcomes: FilterDecisionOutcome[]): string[] {
  const witnessFamilies = [
    ...new Set(
      outcomes.flatMap((outcome) => outcome.exactWitnessFamilies ?? [])
    )
  ].sort();
  const evidence = witnessFamilies.length
    ? [`exact-witness-families:${witnessFamilies.join(",")}`]
    : [];
  if (outcomes.some((outcome) => outcome.directDeterministicSupport)) {
    evidence.push("direct-deterministic-support:true");
  }
  return evidence;
}

export interface StrongReviewDecisionRecord {
  recordId: string;
  bible: string;
  candidateId: string;
  choiceId: string;
  ref: string;
  decision: string;
  strong: string[];
  rawDecision?: SemanticRefillLlmRawDecision;
  confidence: number;
  stage: "model-validation" | "consensus-validation" | "post-consensus-filter";
  status:
    | "validated"
    | "pending"
    | "rejected"
    | FilterDecisionOutcome["status"];
  reason: string;
  verdictReasons?: string[];
  exactWitnessFamilies?: string[];
  directDeterministicSupport?: boolean;
  terminalContext?: StrongReviewTerminalContext;
  evidence: string[];
  model?: string;
  sourcePacket?: string;
  sourceReview: string;
  createdAt: string;
}

async function appendDecisionLedger(
  ledgerPath: string,
  options: {
    bible: string;
    inputPath: string;
    sourcePacket?: string;
    model?: string;
    generatedAt?: string;
    rawDecisions: SemanticRefillLlmRawDecision[];
    filterOutcomes?: FilterDecisionOutcome[];
    terminalContexts?: Map<string, StrongReviewTerminalContext>;
    pendingIds: Set<string>;
    rejectedIds: Set<string>;
  }
): Promise<void> {
  const current = existsSync(ledgerPath)
    ? (JSON.parse(await readFile(ledgerPath, "utf8")) as unknown)
    : [];
  const records = Array.isArray(current)
    ? (current as StrongReviewDecisionRecord[])
    : [];
  const existing = new Set(records.map((record) => record.recordId));
  const stage: StrongReviewDecisionRecord["stage"] = options.filterOutcomes
    ? "post-consensus-filter"
    : options.model?.startsWith("consensus(")
      ? "consensus-validation"
      : "model-validation";
  const classified: Array<{
    decision: SemanticRefillLlmRawDecision;
    status: StrongReviewDecisionRecord["status"];
    reasons?: string[];
    exactWitnessFamilies?: string[];
    directDeterministicSupport?: boolean;
  }> = options.filterOutcomes?.length
    ? options.filterOutcomes
    : options.rawDecisions.map((decision) => ({
        decision,
        status: options.rejectedIds.has(decision.id)
          ? "rejected"
          : options.pendingIds.has(decision.id)
            ? "pending"
            : "validated"
      }));
  const additions = classified
    .map((outcome) =>
      decisionRecord({
        ...options,
        decision: outcome.decision,
        stage,
        status: outcome.status,
        verdictReasons: outcome.reasons,
        exactWitnessFamilies: outcome.exactWitnessFamilies,
        directDeterministicSupport: outcome.directDeterministicSupport,
        terminalContext: isReusableTerminalStatus(outcome.status)
          ? options.terminalContexts?.get(
              terminalDecisionContextKey(outcome.decision)
            )
          : undefined
      })
    )
    .filter((record) => !existing.has(record.recordId));
  if (additions.length === 0) return;
  await mkdir(path.dirname(ledgerPath), { recursive: true });
  await writeJson(ledgerPath, [...records, ...additions]);
}

export function decisionRecord(options: {
  bible: string;
  inputPath: string;
  sourcePacket?: string;
  model?: string;
  generatedAt?: string;
  decision: SemanticRefillLlmRawDecision;
  stage?: StrongReviewDecisionRecord["stage"];
  status: StrongReviewDecisionRecord["status"];
  verdictReasons?: string[];
  exactWitnessFamilies?: string[];
  directDeterministicSupport?: boolean;
  terminalContext?: StrongReviewTerminalContext;
}): StrongReviewDecisionRecord {
  const identity = JSON.stringify({
    bible: options.bible,
    decision: options.decision,
    model: options.model ?? "unknown",
    stage: options.stage ?? "model-validation",
    status: options.status,
    verdictReasons: options.verdictReasons ?? [],
    exactWitnessFamilies: options.exactWitnessFamilies ?? [],
    directDeterministicSupport: options.directDeterministicSupport ?? false,
    sourcePacket: options.terminalContext ? "" : (options.sourcePacket ?? ""),
    terminalContext: options.terminalContext
  });
  return {
    recordId: createHash("sha256").update(identity).digest("hex"),
    bible: options.bible,
    candidateId: options.decision.id,
    choiceId: options.decision.choiceId,
    ref: options.decision.ref,
    decision: options.decision.decision,
    strong: options.decision.strong,
    rawDecision: options.decision,
    confidence: options.decision.confidence,
    stage: options.stage ?? "model-validation",
    status: options.status,
    reason: options.decision.reason,
    verdictReasons: options.verdictReasons,
    exactWitnessFamilies: options.exactWitnessFamilies,
    directDeterministicSupport: options.directDeterministicSupport,
    terminalContext: options.terminalContext,
    evidence: options.decision.evidence,
    model: options.model,
    sourcePacket: options.sourcePacket,
    sourceReview: options.inputPath,
    createdAt: options.generatedAt ?? new Date().toISOString()
  };
}

async function readOptionalPacket(
  sourcePacket: string | undefined
): Promise<AgentPacketFile | undefined> {
  if (!sourcePacket) return undefined;
  if (!existsSync(sourcePacket)) return undefined;
  return JSON.parse(await readFile(sourcePacket, "utf8")) as AgentPacketFile;
}

function packetToBatch(packet: AgentPacketFile): SemanticRefillLlmBatch {
  return {
    bible: packet.bible,
    scope: packet.scope,
    candidates: packet.candidates
  };
}

function inferBooksFromRefs(refs: string[]): string[] {
  return [
    ...new Set(
      refs
        .map((ref) => ref.split(".")[0])
        .filter((book): book is string => !!book)
    )
  ];
}

function inferBooks(
  rawBooks: unknown,
  decisions: SemanticRefillLlmRawDecision[]
): string[] {
  const explicitBooks = Array.isArray(rawBooks)
    ? rawBooks.filter(
        (book): book is string => typeof book === "string" && book.length > 0
      )
    : [];
  if (explicitBooks.length > 0) return [...new Set(explicitBooks)];

  return [
    ...new Set(
      decisions
        .map((decision) => decision.ref.split(".")[0])
        .filter((book): book is string => !!book)
    )
  ];
}

function normalizeRawDecisions(
  value: unknown[]
): SemanticRefillLlmRawDecision[] {
  return value.map((item, index) => parseRawDecision(item, index));
}

function normalizeFilterOutcomes(
  value: unknown
): FilterDecisionOutcome[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new Error("invalid-post-consensus-filter-outcomes:not-array");
  }
  return value.map((raw, index) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error(`invalid-post-consensus-filter-outcome:${index}`);
    }
    const item = raw as Record<string, unknown>;
    if (
      item.status !== "accepted-safe" &&
      item.status !== "needs-witness-review" &&
      item.status !== "rejected-risky"
    ) {
      throw new Error(`invalid-post-consensus-filter-status:${index}`);
    }
    if (
      item.reasons !== undefined &&
      (!Array.isArray(item.reasons) ||
        !item.reasons.every((reason) => typeof reason === "string"))
    ) {
      throw new Error(`invalid-post-consensus-filter-reasons:${index}`);
    }
    return {
      decision: parseRawDecision(item.decision, index),
      status: item.status,
      reasons: item.reasons as string[] | undefined,
      exactWitnessFamilies: parseOptionalStringArray(
        item.exactWitnessFamilies,
        `invalid-post-consensus-filter-witness-families:${index}`
      ),
      directDeterministicSupport: parseOptionalBoolean(
        item.directDeterministicSupport,
        `invalid-post-consensus-filter-direct-support:${index}`
      )
    };
  });
}

function parseOptionalStringArray(
  value: unknown,
  error: string
): string[] | undefined {
  if (value === undefined) return undefined;
  if (
    !Array.isArray(value) ||
    !value.every((item) => typeof item === "string")
  ) {
    throw new Error(error);
  }
  return value;
}

function parseOptionalBoolean(
  value: unknown,
  error: string
): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") throw new Error(error);
  return value;
}

function parseRawDecision(
  value: unknown,
  index: number
): SemanticRefillLlmRawDecision {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`invalid-agent-review-decision:${index}:not-object`);
  }
  const item = value as Record<string, unknown>;
  const decision = item.decision;
  if (
    !SEMANTIC_REFILL_LLM_DECISION_TYPES.includes(
      decision as SemanticRefillLlmDecisionType
    )
  ) {
    throw new Error(`invalid-agent-review-decision:${index}:decision`);
  }
  if (
    typeof item.id !== "string" ||
    typeof item.choiceId !== "string" ||
    typeof item.ref !== "string" ||
    !Array.isArray(item.strong) ||
    !item.strong.every((strong) => typeof strong === "string") ||
    typeof item.confidence !== "number" ||
    !Number.isFinite(item.confidence) ||
    typeof item.reason !== "string" ||
    !isNullableInteger(item.wordIndex) ||
    !isNullableString(item.normalized) ||
    !isNullableInteger(item.startWordIndex) ||
    !isNullableInteger(item.endWordIndex) ||
    !isNullableStringArray(item.normalizedPhrase) ||
    !Array.isArray(item.evidence) ||
    !item.evidence.every((entry) => typeof entry === "string")
  ) {
    throw new Error(`invalid-agent-review-decision:${index}:shape`);
  }
  return {
    id: item.id,
    choiceId: item.choiceId,
    ref: item.ref,
    decision: decision as SemanticRefillLlmDecisionType,
    strong: item.strong as string[],
    confidence: item.confidence,
    reason: item.reason,
    wordIndex: item.wordIndex as number | null,
    normalized: item.normalized as string | null,
    startWordIndex: item.startWordIndex as number | null,
    endWordIndex: item.endWordIndex as number | null,
    normalizedPhrase: item.normalizedPhrase as string[] | null,
    evidence: item.evidence as string[]
  };
}

function isNullableInteger(value: unknown): value is number | null {
  return value === null || Number.isInteger(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isNullableStringArray(value: unknown): value is string[] | null {
  return (
    value === null ||
    (Array.isArray(value) && value.every((entry) => typeof entry === "string"))
  );
}

async function readBookVerses(
  ledgerDir: string,
  bible: string,
  books: string[]
): Promise<StrongLedgerVerse[]> {
  return readStrongLedgerVersesSqlite({
    sqlitePath: strongLedgerSqlitePath(ledgerDir, bible),
    bible,
    books
  });
}

async function appendOverrides(
  overridesPath: string,
  decisions: CuratedStrongOverride[]
): Promise<number> {
  const current = existsSync(overridesPath)
    ? (JSON.parse(await readFile(overridesPath, "utf8")) as unknown)
    : [];
  const result = upsertCuratedStrongOverrides(
    Array.isArray(current) ? current : [],
    decisions
  );
  if (!result.changed) return 0;
  await mkdir(path.dirname(overridesPath), { recursive: true });
  await writeJson(overridesPath, result.overrides);
  return result.appliedOverrideCount;
}

export function upsertCuratedStrongOverrides(
  current: unknown[],
  decisions: CuratedStrongOverride[]
): {
  overrides: unknown[];
  appliedOverrideCount: number;
  replacedQuarantinedCount: number;
  changed: boolean;
} {
  const overrides = [...current];
  let appliedOverrideCount = 0;
  let replacedQuarantinedCount = 0;

  for (const rawDecision of decisions) {
    const decision = stripDecisionFields(rawDecision);
    const key = overrideKey(decision);
    const matchingIndexes = overrides.flatMap((override, index) =>
      overrideKey(override) === key ? [index] : []
    );
    if (
      matchingIndexes.some((index) => !isQuarantinedOverride(overrides[index]))
    ) {
      continue;
    }

    const quarantinedIndexes = matchingIndexes.filter((index) =>
      isQuarantinedOverride(overrides[index])
    );
    if (quarantinedIndexes.length > 0) {
      const replacementIndex = quarantinedIndexes[0]!;
      overrides[replacementIndex] = decision;
      for (const duplicateIndex of quarantinedIndexes.slice(1).reverse()) {
        overrides.splice(duplicateIndex, 1);
      }
      appliedOverrideCount += 1;
      replacedQuarantinedCount += 1;
      continue;
    }

    overrides.push(decision);
    appliedOverrideCount += 1;
  }

  return {
    overrides,
    appliedOverrideCount,
    replacedQuarantinedCount,
    changed: appliedOverrideCount > 0
  };
}

function isQuarantinedOverride(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<CuratedStrongOverride>;
  if (
    typeof candidate.source !== "string" ||
    typeof candidate.reason !== "string"
  ) {
    return false;
  }
  return (
    isLegacySingleModelAutoOverride(candidate as CuratedStrongOverride) ||
    isUnverifiedSemanticRefillOverride(candidate as CuratedStrongOverride)
  );
}

function stripDecisionFields(
  value: CuratedStrongOverride
): CuratedStrongOverride {
  const clone = { ...value } as CuratedStrongOverride & Record<string, unknown>;
  delete clone.status;
  delete clone.score;
  delete clone.priority;
  delete clone.evidence;
  return clone;
}

function overrideKey(value: unknown): string {
  const item = value as Partial<CuratedStrongOverride>;
  return [
    item.bible?.toLowerCase(),
    item.ref,
    item.target ?? "word",
    item.wordIndex,
    item.startWordIndex ?? "",
    item.endWordIndex ?? "",
    item.normalized,
    [...(item.strong ?? [])]
      .map((strong) => strong.toUpperCase())
      .sort()
      .join(",")
  ].join("|");
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  try {
    await writeFile(
      temporaryPath,
      `${JSON.stringify(value, null, 2)}\n`,
      "utf8"
    );
    await rename(temporaryPath, filePath);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
}

function parseArgs(argv: string[]): Map<string, string | boolean> {
  const args = new Map<string, string | boolean>();
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args.set(key, true);
      continue;
    }
    args.set(key, next);
    index += 1;
  }
  return args;
}

function readStringArg(
  args: Map<string, string | boolean>,
  name: string,
  fallback: string
): string {
  const value = args.get(name);
  return typeof value === "string" ? value : fallback;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const bible = readStringArg(args, "bible", "nbs").toLowerCase();
  const inputPath = readStringArg(
    args,
    "input",
    path.join(
      "outputs",
      "gap-review",
      bible,
      "agent-review",
      "agent-review.json"
    )
  );
  const outputDir = readStringArg(
    args,
    "output-dir",
    path.join(path.dirname(inputPath), "validated")
  );
  const result = await validateAgentReview({
    inputPath,
    outputDir,
    bible,
    candidatesPath: readStringArg(
      args,
      "candidates",
      path.join(
        "outputs",
        "gap-review",
        bible,
        "post-lexicon-v2-final",
        "gap-review-candidates.json"
      )
    ),
    ledgerDir: readStringArg(
      args,
      "ledger-dir",
      path.join("outputs", "strong", bible)
    ),
    overridesPath: readStringArg(
      args,
      "overrides",
      "data/curated-strong-overrides.json"
    ),
    decisionLedgerPath: readStringArg(
      args,
      "decision-ledger",
      "data/strong-review-decisions.json"
    ),
    apply: args.get("apply") === true,
    recordDecisions: args.get("record-decisions") === true,
    lockHeld: args.get("lock-held") === true,
    referenceStyleFinalization:
      args.get("reference-style") === true ||
      args.get("finalize-reference-style") === true
  });
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1]?.endsWith("semanticRefillAgentReview.ts")) {
  await main();
}
