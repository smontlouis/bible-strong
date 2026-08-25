import { createHash } from "node:crypto";

import {
  FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE,
  canonicalFrenchInternalJson,
  hashFrenchInternalJson,
  type FrenchInternalAuditChecks
} from "./frenchInternalReview.js";
import type { FrenchInternalWorkStrata } from "./frenchInternalWork.js";

export const FRENCH_PILOT_BLIND_REAUDIT_POLICY_VERSION =
  "lexicon-v3-french-pilot-blind-reaudit-policy@1" as const;
export const FRENCH_PILOT_BLIND_REAUDIT_MANIFEST_SCHEMA_VERSION =
  "lexicon-v3-french-pilot-blind-reaudit-manifest@1" as const;
export const FRENCH_PILOT_BLIND_REAUDIT_RECEIPT_SCHEMA_VERSION =
  "lexicon-v3-french-pilot-blind-reaudit-receipt@1" as const;
export const FRENCH_PILOT_BLIND_REAUDIT_DECISION_SCHEMA_VERSION =
  "lexicon-v3-french-pilot-blind-reaudit-decision@1" as const;
export const FRENCH_PILOT_BLIND_REAUDIT_SUMMARY_SCHEMA_VERSION =
  "lexicon-v3-french-pilot-blind-reaudit-summary@1" as const;
export const FRENCH_PILOT_BLIND_REAUDIT_VIEW_SCHEMA_VERSION =
  "lexicon-v3-french-pilot-blind-reaudit-view@1" as const;
export const FRENCH_PILOT_BLIND_REAUDIT_POPULATION_SIZE = 300 as const;
export const FRENCH_PILOT_BLIND_REAUDIT_SAMPLE_SIZE = 60 as const;
export const FRENCH_PILOT_BLIND_REAUDIT_SELECTION_ALGORITHM =
  "rare-strata-first-language-meaning-size-balanced-sha256@1" as const;
export const FRENCH_PILOT_BLIND_REAUDIT_NAMESPACE =
  "/fr-internal/pilot-blind-reaudit" as const;

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;

export interface FrenchPilotBlindReauditFileArtifact {
  path: string;
  sha256: string;
  bytes: number;
}

export interface FrenchPilotBlindReauditPopulationItem {
  entryKey: string;
  packetHash: string;
  englishHash: string;
  finalReviewArtifactHash: string;
  strata: FrenchInternalWorkStrata;
}

export interface FrenchPilotBlindReauditSelectionItem extends FrenchPilotBlindReauditPopulationItem {
  rankHash: string;
  strataHash: string;
  itemHash: string;
}

export interface FrenchPilotBlindReauditView {
  schemaVersion: typeof FRENCH_PILOT_BLIND_REAUDIT_VIEW_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_PILOT_BLIND_REAUDIT_POLICY_VERSION;
  role: "blindReauditor";
  entryKey: string;
  packetHash: string;
  englishHash: string;
  finalReviewArtifactHash: string;
  /** Only exact identity, source English, and protected literals. */
  source: {
    identity: Record<string, unknown>;
    english: Record<string, unknown>;
    protectedContent: Record<string, unknown>;
  };
  /** Final French display only; no proposal, arbitration, audit, or reason. */
  finalFrench: {
    glossFr: string;
    meaningFr: string;
    meaningHtmlFr: string;
    notesFr: string;
    carrierTermsFr: string[];
  };
  /** Exact final context for every pilot member of the same STEP family. */
  siblingContext: {
    scope: "selected-pilot-family-members";
    familyKey: string;
    members: Array<{
      entryKey: string;
      identity: Record<string, unknown>;
      english: Record<string, unknown>;
      finalFrench: {
        glossFr: string;
        meaningFr: string;
        meaningHtmlFr: string;
        notesFr: string;
        carrierTermsFr: string[];
      };
    }>;
  };
  exposurePolicy: {
    proposerOutputsExposed: false;
    arbiterOutputExposed: false;
    auditorOutputExposed: false;
    priorReasonsExposed: false;
    priorVerdictsExposed: false;
    historicalFrenchExposed: false;
    resourceFrenchExposed: false;
  };
  viewHash: string;
}

export interface FrenchPilotBlindReauditBatch {
  batchId: string;
  keys: string[];
  viewHashes: string[];
  input: FrenchPilotBlindReauditFileArtifact;
  outputSchema: FrenchPilotBlindReauditFileArtifact;
  expectedRunPath: string;
  batchHash: string;
}

export interface FrenchPilotBlindReauditManifest {
  schemaVersion: typeof FRENCH_PILOT_BLIND_REAUDIT_MANIFEST_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_PILOT_BLIND_REAUDIT_POLICY_VERSION;
  namespace: typeof FRENCH_PILOT_BLIND_REAUDIT_NAMESPACE;
  lineage: {
    releaseKey: string;
    releaseSnapshotFingerprint: string;
    sourceLogicalDigest: string;
    pilotManifestHash: string;
    pilotSelectionHash: string;
    finalReviewLogicalDigest: string;
    generationConfigHash: string;
  };
  inputPolicy: {
    sourceEnglishAndProtectedOnly: true;
    finalFrenchDisplayOnly: true;
    proposerOutputsForbidden: true;
    arbiterOutputForbidden: true;
    auditorOutputForbidden: true;
    priorReasonsAndVerdictsForbidden: true;
    historicalAndResourceFrenchForbidden: true;
  };
  sourcePaths: {
    pilotManifest: string;
    pilotSelection: string;
    selectedPackets: string;
    configuration: string;
    finalReview: string;
  };
  sourceDigests: Record<
    keyof FrenchPilotBlindReauditManifest["sourcePaths"],
    string
  >;
  selection: {
    algorithm: typeof FRENCH_PILOT_BLIND_REAUDIT_SELECTION_ALGORITHM;
    seedHash: string;
    populationSize: typeof FRENCH_PILOT_BLIND_REAUDIT_POPULATION_SIZE;
    sampleSize: typeof FRENCH_PILOT_BLIND_REAUDIT_SAMPLE_SIZE;
    keys: string[];
    keyOrderHash: string;
    strataCounts: Record<string, Record<string, number>>;
    items: FrenchPilotBlindReauditSelectionItem[];
    selectionHash: string;
  };
  batches: FrenchPilotBlindReauditBatch[];
  manifestHash: string;
}

export interface FrenchPilotBlindReauditReceipt {
  schemaVersion: typeof FRENCH_PILOT_BLIND_REAUDIT_RECEIPT_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_PILOT_BLIND_REAUDIT_POLICY_VERSION;
  role: "blindReauditor";
  namespace: typeof FRENCH_PILOT_BLIND_REAUDIT_NAMESPACE;
  entryKey: string;
  batchId: string;
  manifestHash: string;
  selectionHash: string;
  inputHash: string;
  artifactHash: string;
  agentId: string;
  taskName: string;
  threadId: string;
  model: typeof FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.auditor.model;
  reasoningEffort: typeof FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.auditor.reasoningEffort;
  executorPolicyVersion: typeof FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.executorPolicyVersion;
  executor: {
    path: string;
    version: typeof FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.codexVersion;
    sha256: typeof FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.codexSha256;
  };
  capabilities: {
    localTools: "disabled";
    networkDataTools: "disabled";
    shell: "disabled";
    eventPolicy: "agent-message-only";
    sealedWorkingDirectory: string;
    disabledFeaturesHash: string;
    environmentPolicyHash: string;
  };
  /** Digest of the four prior role thread ids, never exposed in the view. */
  priorRoleThreadsDigest: string;
  /** Digest of the four prior role agent ids, never exposed in the view. */
  priorRoleAgentsDigest: string;
  sourcePaths: {
    manifest: string;
    input: string;
    outputSchema: string;
    pilotManifest: string;
    pilotSelection: string;
    selectedPackets: string;
    configuration: string;
    finalReview: string;
    runPointer: string;
  };
  sourceHashes: Record<
    keyof FrenchPilotBlindReauditReceipt["sourcePaths"],
    string
  >;
  resultPaths: {
    agentEvents: string;
    agentStderr: string;
    structuredResponse: string;
  };
  resultHashes: Record<
    keyof FrenchPilotBlindReauditReceipt["resultPaths"],
    string
  >;
  startedAt: string;
  completedAt: string;
  runHash: string;
  receiptHash: string;
}

export interface FrenchPilotBlindReauditDecision {
  schemaVersion: typeof FRENCH_PILOT_BLIND_REAUDIT_DECISION_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_PILOT_BLIND_REAUDIT_POLICY_VERSION;
  role: "blindReauditor";
  entryKey: string;
  inputHash: string;
  verdict: "safe" | "hold" | "block";
  reasons: string[];
  confidence: number;
  checks: FrenchInternalAuditChecks;
  agentId: string;
  taskName: string;
  threadId: string;
  completedAt: string;
  receiptHash: string;
  artifactHash: string;
}

export interface FrenchPilotBlindReauditSummary {
  schemaVersion: typeof FRENCH_PILOT_BLIND_REAUDIT_SUMMARY_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_PILOT_BLIND_REAUDIT_POLICY_VERSION;
  namespace: typeof FRENCH_PILOT_BLIND_REAUDIT_NAMESPACE;
  manifestHash: string;
  manifestFileHash: string;
  selectionHash: string;
  generatedAt: string;
  profile: typeof FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.auditor;
  coverage: "exact";
  counts: {
    population: typeof FRENCH_PILOT_BLIND_REAUDIT_POPULATION_SIZE;
    sampled: typeof FRENCH_PILOT_BLIND_REAUDIT_SAMPLE_SIZE;
    batches: number;
    receipts: typeof FRENCH_PILOT_BLIND_REAUDIT_SAMPLE_SIZE;
    decisions: typeof FRENCH_PILOT_BLIND_REAUDIT_SAMPLE_SIZE;
    safe: typeof FRENCH_PILOT_BLIND_REAUDIT_SAMPLE_SIZE;
    hold: 0;
    block: 0;
    violations: 0;
    distinctAgentIds: number;
    distinctAgentThreads: number;
    freshAgainstPriorAgents: typeof FRENCH_PILOT_BLIND_REAUDIT_SAMPLE_SIZE;
    freshAgainstPriorThreads: typeof FRENCH_PILOT_BLIND_REAUDIT_SAMPLE_SIZE;
  };
  runs: Array<{
    batchId: string;
    pointer: FrenchPilotBlindReauditFileArtifact;
    runHash: string;
    resultPaths: {
      agentEvents: string;
      agentStderr: string;
      structuredResponse: string;
    };
    resultHashes: {
      agentEvents: string;
      agentStderr: string;
      structuredResponse: string;
    };
  }>;
  outputs: {
    receipts: FrenchPilotBlindReauditFileArtifact & {
      records: typeof FRENCH_PILOT_BLIND_REAUDIT_SAMPLE_SIZE;
      logicalDigest: string;
    };
    decisions: FrenchPilotBlindReauditFileArtifact & {
      records: typeof FRENCH_PILOT_BLIND_REAUDIT_SAMPLE_SIZE;
      logicalDigest: string;
    };
  };
  runHashesDigest: string;
  freshnessProofDigest: string;
  summaryHash: string;
}

export function buildFrenchPilotBlindReauditSelection(input: {
  pilotSelectionHash: string;
  finalReviewLogicalDigest: string;
  population: readonly FrenchPilotBlindReauditPopulationItem[];
}): FrenchPilotBlindReauditManifest["selection"] {
  if (
    !SHA256_PATTERN.test(input.pilotSelectionHash) ||
    !SHA256_PATTERN.test(input.finalReviewLogicalDigest) ||
    input.population.length !== FRENCH_PILOT_BLIND_REAUDIT_POPULATION_SIZE ||
    new Set(input.population.map((item) => item.entryKey)).size !==
      input.population.length
  ) {
    throw new Error("french-pilot-blind-reaudit-population-invalid");
  }
  const seedHash = hashFrenchInternalJson({
    policyVersion: FRENCH_PILOT_BLIND_REAUDIT_POLICY_VERSION,
    pilotSelectionHash: input.pilotSelectionHash,
    finalReviewLogicalDigest: input.finalReviewLogicalDigest
  });
  const ranked = input.population.map((item) => {
    const rankHash = hashFrenchInternalJson({
      seedHash,
      entryKey: item.entryKey
    });
    const strataHash = hashFrenchInternalJson(item.strata);
    const content = { ...item, rankHash, strataHash };
    return { ...content, itemHash: hashFrenchInternalJson(content) };
  });
  const selected = selectStratified(ranked);
  const items = [...selected].sort((left, right) =>
    left.rankHash === right.rankHash
      ? left.entryKey.localeCompare(right.entryKey)
      : left.rankHash.localeCompare(right.rankHash)
  );
  const keys = items.map((item) => item.entryKey);
  const strataCounts = countSelectionStrata(items);
  const content = {
    algorithm: FRENCH_PILOT_BLIND_REAUDIT_SELECTION_ALGORITHM,
    seedHash,
    populationSize: FRENCH_PILOT_BLIND_REAUDIT_POPULATION_SIZE,
    sampleSize: FRENCH_PILOT_BLIND_REAUDIT_SAMPLE_SIZE,
    keys,
    keyOrderHash: hashFrenchInternalJson(keys),
    strataCounts,
    items
  };
  return { ...content, selectionHash: hashFrenchInternalJson(content) };
}

export function frenchPilotBlindReauditReceiptHash(
  receipt:
    | FrenchPilotBlindReauditReceipt
    | Omit<FrenchPilotBlindReauditReceipt, "receiptHash">
): string {
  const { receiptHash: _receiptHash, ...content } =
    receipt as FrenchPilotBlindReauditReceipt;
  void _receiptHash;
  return hashFrenchInternalJson(content);
}

export function frenchPilotBlindReauditDecisionHash(
  decision:
    | FrenchPilotBlindReauditDecision
    | Omit<FrenchPilotBlindReauditDecision, "artifactHash">
): string {
  const { artifactHash: _artifactHash, ...content } =
    decision as FrenchPilotBlindReauditDecision;
  void _artifactHash;
  return hashFrenchInternalJson(content);
}

function selectStratified(
  ranked: readonly FrenchPilotBlindReauditSelectionItem[]
): FrenchPilotBlindReauditSelectionItem[] {
  const tokensByEntry = new Map(
    ranked.map((item) => [item.entryKey, stratumTokens(item.strata)])
  );
  const tokenFrequency = new Map<string, number>();
  for (const tokens of tokensByEntry.values()) {
    for (const token of tokens) {
      tokenFrequency.set(token, (tokenFrequency.get(token) ?? 0) + 1);
    }
  }
  const uncovered = new Set(tokenFrequency.keys());
  const selected = new Map<string, FrenchPilotBlindReauditSelectionItem>();
  while (uncovered.size > 0) {
    const candidate = ranked
      .filter((item) => !selected.has(item.entryKey))
      .map((item) => ({
        item,
        score: [...tokensByEntry.get(item.entryKey)!]
          .filter((token) => uncovered.has(token))
          .reduce((sum, token) => sum + 1 / (tokenFrequency.get(token) ?? 1), 0)
      }))
      .filter(({ score }) => score > 0)
      .sort(
        (left, right) =>
          right.score - left.score ||
          left.item.rankHash.localeCompare(right.item.rankHash) ||
          left.item.entryKey.localeCompare(right.item.entryKey)
      )[0];
    if (!candidate) break;
    selected.set(candidate.item.entryKey, candidate.item);
    for (const token of tokensByEntry.get(candidate.item.entryKey)!) {
      uncovered.delete(token);
    }
  }
  if (
    uncovered.size > 0 ||
    selected.size > FRENCH_PILOT_BLIND_REAUDIT_SAMPLE_SIZE
  ) {
    throw new Error("french-pilot-blind-reaudit-strata-uncoverable");
  }
  const bucketPopulation = countPrimaryBuckets(ranked);
  while (selected.size < FRENCH_PILOT_BLIND_REAUDIT_SAMPLE_SIZE) {
    const selectedBuckets = countPrimaryBuckets([...selected.values()]);
    const candidate = ranked
      .filter((item) => !selected.has(item.entryKey))
      .sort((left, right) => {
        const leftBucket = primaryBucket(left.strata);
        const rightBucket = primaryBucket(right.strata);
        const leftRatio =
          (selectedBuckets.get(leftBucket) ?? 0) /
          (bucketPopulation.get(leftBucket) ?? 1);
        const rightRatio =
          (selectedBuckets.get(rightBucket) ?? 0) /
          (bucketPopulation.get(rightBucket) ?? 1);
        return (
          leftRatio - rightRatio ||
          left.rankHash.localeCompare(right.rankHash) ||
          left.entryKey.localeCompare(right.entryKey)
        );
      })[0];
    if (!candidate) {
      throw new Error("french-pilot-blind-reaudit-sample-underflow");
    }
    selected.set(candidate.entryKey, candidate);
  }
  return [...selected.values()];
}

function stratumTokens(strata: FrenchInternalWorkStrata): Set<string> {
  return new Set([
    `language:${strata.language}`,
    `meaningCohort:${strata.meaningCohort}`,
    `position:${strata.pos}`,
    `properName:${String(strata.properName)}`,
    `theological:${String(strata.theological)}`,
    `legacyHtmlCategory:${strata.legacyHtmlCategory}`,
    `meaningSize:${strata.meaningSize}`,
    ...(strata.riskCategories.length > 0
      ? strata.riskCategories.map((risk) => `riskCategory:${risk}`)
      : ["riskCategory:none"])
  ]);
}

function primaryBucket(strata: FrenchInternalWorkStrata): string {
  return `${strata.language}:${strata.meaningSize}`;
}

function countPrimaryBuckets(
  items: readonly FrenchPilotBlindReauditSelectionItem[]
): Map<string, number> {
  const output = new Map<string, number>();
  for (const item of items) {
    const bucket = primaryBucket(item.strata);
    output.set(bucket, (output.get(bucket) ?? 0) + 1);
  }
  return output;
}

function countSelectionStrata(
  items: readonly FrenchPilotBlindReauditSelectionItem[]
): Record<string, Record<string, number>> {
  const output = new Map<string, Map<string, number>>();
  for (const item of items) {
    for (const token of stratumTokens(item.strata)) {
      const separator = token.indexOf(":");
      const dimension = token.slice(0, separator);
      const value = token.slice(separator + 1);
      const values = output.get(dimension) ?? new Map<string, number>();
      values.set(value, (values.get(value) ?? 0) + 1);
      output.set(dimension, values);
    }
  }
  return Object.fromEntries(
    [...output.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([dimension, values]) => [
        dimension,
        Object.fromEntries(
          [...values.entries()].sort(([left], [right]) =>
            left.localeCompare(right)
          )
        )
      ])
  );
}

export function canonicalFrenchPilotBlindReauditJson(value: unknown): string {
  return canonicalFrenchInternalJson(value);
}

export function hashFrenchPilotBlindReauditBytes(
  value: string | Buffer
): string {
  return createHash("sha256").update(value).digest("hex");
}
