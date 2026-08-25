import { createHash } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  assertFrenchCodexAnyBatchManifest,
  type FrenchCodexAnyBatchManifest
} from "./buildLexiconV3FrenchCodexBatches.js";
import {
  FRENCH_CODEX_PILOT_BATCH_MANIFEST_SCHEMA_VERSION,
  frenchCodexSelectedPacketsLogicalDigest,
  type FrenchCodexPilotBatchManifest
} from "./buildLexiconV3FrenchCodexPilotBatches.js";
import {
  FRENCH_CODEX_PILOT_PROPOSER_SUMMARY_SCHEMA_VERSION,
  type FrenchCodexProposerSummary
} from "./runLexiconV3FrenchCodexPilotProposers.js";
import {
  FRENCH_CODEX_EXECUTOR_POLICY_VERSION,
  FRENCH_CODEX_PROPOSER_RUN_SCHEMA_VERSION,
  buildFrenchCodexProposerPrompt,
  frenchCodexDisabledFeaturesHash,
  frenchCodexEnvironmentPolicyHash,
  parseFrenchCodexAgentEvents,
  parseFrenchCodexProposerResponse,
  type FrenchCodexProposerRun
} from "./runLexiconV3FrenchCodexProposerBatch.js";
import {
  FRENCH_BLIND_REAUDIT_RUNTIME_POLICY_VERSION,
  buildFrenchBlindReauditPrompt,
  frenchBlindReauditDecisionEnvelope,
  parseFrenchBlindReauditAgentResponse,
  type FrenchBlindReauditAgentDecision
} from "../src/lexiconV3/frenchBlindReauditRuntime.js";
import { assertFrenchCodexExecutionReceipt } from "../src/lexiconV3/frenchCodexExecutionReceipt.js";
import {
  FRENCH_CODEX_IMMUTABLE_BINARY_PATH,
  assertFrenchCodexImmutableBinary
} from "../src/lexiconV3/frenchCodexImmutableBinary.js";
import { frenchInternalPromptHash } from "../src/lexiconV3/frenchAgentPrompts.js";
import {
  FRENCH_CODEX_ADJUDICATION_EXECUTOR_POLICY_VERSION,
  FRENCH_CODEX_ADJUDICATION_RUN_SCHEMA_VERSION,
  FRENCH_CODEX_EXECUTION_RECEIPTS_SUMMARY_SCHEMA_VERSION,
  FRENCH_CODEX_PILOT_ADJUDICATION_SUMMARY_SCHEMA_VERSION,
  buildFrenchCodexAdjudicationPrompt,
  parseFrenchCodexAdjudicationResponse,
  type FrenchCodexAdjudicationRun,
  type FrenchCodexExecutionReceiptsSummary
} from "./runLexiconV3FrenchCodexPilotAdjudication.js";
import {
  FRENCH_INTERNAL_ASSEMBLY_CONFIG_SCHEMA_VERSION,
  FRENCH_INTERNAL_ASSEMBLY_SUMMARY_SCHEMA_VERSION,
  readFrenchInternalArbiterArtifacts,
  readFrenchInternalAuditorArtifacts,
  readFrenchInternalProposerArtifacts,
  validateFrenchInternalAssemblyConfiguration,
  type FrenchInternalArbiterArtifact,
  type FrenchInternalAssemblyConfigurationFile,
  type FrenchInternalAssemblySummary,
  type FrenchInternalAuditorArtifact,
  type FrenchInternalProposerArtifact
} from "./assembleLexiconV3FrenchInternalReview.js";
import {
  assertFrenchCodexAdjudicationBatchManifest,
  type FrenchCodexAdjudicationBatchManifest,
  type FrenchCodexAdjudicationView
} from "./buildLexiconV3FrenchCodexAdjudicationBatches.js";
import { frenchInternalAdjudicationViewHash } from "./lexiconV3FrenchInternalAdjudication.js";
import {
  FRENCH_INTERNAL_REMEDIATION_RUN_SCHEMA_VERSION,
  type FrenchInternalRemediationRunSummary
} from "./runLexiconV3FrenchInternalRemediation.js";
import {
  FRENCH_PILOT_QUALITY_GATE_EXPECTED_ENTRIES,
  FRENCH_PILOT_QUALITY_GATE_POLICY_VERSION,
  FRENCH_PILOT_QUALITY_GATE_SCHEMA_VERSION,
  assertFrenchPilotQualityGate,
  finalizeFrenchPilotQualityGate,
  frenchPilotQualityGateFilename,
  type FrenchPilotQualityGate,
  type FrenchPilotQualityGateContent,
  type FrenchPilotQualityGateSourceArtifact,
  type FrenchPilotQualityGateStratumMetric
} from "../src/lexiconV3/frenchPilotQualityGate.js";
import {
  FRENCH_PILOT_BLIND_REAUDIT_DECISION_SCHEMA_VERSION,
  FRENCH_PILOT_BLIND_REAUDIT_MANIFEST_SCHEMA_VERSION,
  FRENCH_PILOT_BLIND_REAUDIT_NAMESPACE,
  FRENCH_PILOT_BLIND_REAUDIT_POLICY_VERSION,
  FRENCH_PILOT_BLIND_REAUDIT_RECEIPT_SCHEMA_VERSION,
  FRENCH_PILOT_BLIND_REAUDIT_SAMPLE_SIZE,
  FRENCH_PILOT_BLIND_REAUDIT_SUMMARY_SCHEMA_VERSION,
  FRENCH_PILOT_BLIND_REAUDIT_VIEW_SCHEMA_VERSION,
  buildFrenchPilotBlindReauditSelection,
  frenchPilotBlindReauditDecisionHash,
  frenchPilotBlindReauditReceiptHash,
  type FrenchPilotBlindReauditDecision,
  type FrenchPilotBlindReauditManifest,
  type FrenchPilotBlindReauditReceipt,
  type FrenchPilotBlindReauditSummary,
  type FrenchPilotBlindReauditView
} from "../src/lexiconV3/frenchPilotBlindReaudit.js";
import {
  FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE,
  FRENCH_INTERNAL_EXECUTION_RECEIPT_SCHEMA_VERSION,
  canonicalFrenchInternalJson,
  evaluateFrenchInternalReview,
  frenchInternalExecutionReceiptHash,
  frenchInternalGenerationConfigHash,
  frenchInternalSiblingFamilyKey,
  hashFrenchInternalJson,
  type FrenchInternalExecutionReceipt,
  type FrenchInternalReviewRecord,
  type FrenchInternalReviewStatus
} from "../src/lexiconV3/frenchInternalReview.js";
import {
  type FrenchCanonicalEntityRecord,
  type FrenchCanonicalEntryNamePolicy,
  type FrenchEntityCanonicalizationGateResult
} from "../src/lexiconV3/frenchEntityCanonicalization.js";
import type { FrenchEntityMentionsArtifact } from "../src/lexiconV3/frenchEntityMentions.js";
import {
  assertFrenchEntityPipelineArtifacts,
  frenchEntityQuarantinedEntryKeysFromMerge
} from "../src/lexiconV3/frenchEntityPipeline.js";
import { assertFrenchEntityMergeAttestationAtPath } from "../src/lexiconV3/frenchEntityMergeAttestation.js";
import {
  FRENCH_INTERNAL_PILOT_SCHEMA_VERSION,
  FRENCH_INTERNAL_WORK_POLICY_VERSION,
  hashFrenchInternalWorkJson,
  type FrenchInternalPilotPlan,
  type FrenchInternalWorkStrata
} from "../src/lexiconV3/frenchInternalWork.js";
import {
  FRENCH_INTERNAL_REMEDIATION_POLICY_VERSION,
  frenchInternalRemediationReviewLogicalDigest
} from "../src/lexiconV3/frenchInternalRemediation.js";
import {
  FRENCH_PACKET_SCHEMA_VERSION,
  validateFrenchPacket,
  type LexiconV3FrenchPacket
} from "../src/lexiconV3/frenchPackets.js";
import type { FrenchEntityMentionResolutionAttestation } from "../src/lexiconV3/frenchEntityMentionResolution.js";

const ROOT = "outputs/lexicon-v3/fr-internal";
const DEFAULT_PILOT_RUNTIME = `${ROOT}/pilot`;
const DEFAULT_ENTITY_ROOT = "outputs/lexicon-v3/french-entities";
const DEFAULT_ENTITY_RESOLVED = `${DEFAULT_ENTITY_ROOT}/resolved`;
const DEFAULT_CANONICAL_ENTITIES = `${DEFAULT_ENTITY_RESOLVED}/canonical-entities.jsonl`;
const DEFAULT_CANONICAL_ENTRY_POLICIES = `${DEFAULT_ENTITY_RESOLVED}/canonical-entry-name-policies.jsonl`;
const DEFAULT_ENTITY_MERGE_ATTESTATION = `${DEFAULT_ENTITY_RESOLVED}/entity-merge-attestation.json`;
const DEFAULT_ENTITY_GATE = `${DEFAULT_ENTITY_RESOLVED}/entity-gate.json`;
const DEFAULT_ENTITY_MENTIONS = `${DEFAULT_ENTITY_RESOLVED}/required-entity-mentions.json`;
const DEFAULT_ENTITY_MENTION_RESOLUTION_ATTESTATION = `${DEFAULT_ENTITY_RESOLVED}/entity-mention-resolution-attestation.json`;
const DEFAULT_ENTITY_PACKETS = `${ROOT}/french-packets.jsonl`;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const ROLES = ["proposerA", "proposerB", "arbiter", "auditor"] as const;
const VERIFIED_EXECUTION_BINARIES = new Map<string, string>();

export interface BuildFrenchPilotQualityGateOptions {
  pilotManifestPath: string;
  pilotSelectionPath: string;
  selectedPacketsPath: string;
  configurationPath: string;
  canonicalEntitiesPath: string;
  canonicalEntryPoliciesPath: string;
  entityMergeAttestationPath: string;
  entityGatePath: string;
  entityMentionsPath: string;
  entityMentionResolutionAttestationPath: string;
  entityPacketsPath: string;
  proposerSummaryPath: string;
  adjudicationSummaryPath: string;
  executionReceiptsPath: string;
  executionReceiptsSummaryPath: string;
  assembledReviewPath: string;
  assemblySummaryPath: string;
  remediationSummaryPath: string;
  finalReviewPath: string;
  blindReauditManifestPath: string;
  blindReauditSummaryPath: string;
  blindReauditReceiptsPath: string;
  blindReauditDecisionsPath: string;
  outputDir: string;
  generatedAt?: string;
}

export interface FrenchPilotQualityGateBuildResult {
  gate: FrenchPilotQualityGate;
  outputPath: string;
}

interface SourceArtifactWithBuffer extends FrenchPilotQualityGateSourceArtifact {
  buffer: Buffer;
}

interface ExecutionRunClosure {
  namespace: string;
  releaseKey: string;
  releaseSnapshotFingerprint: string;
  selectionHash: string;
  keyOrderHash: string;
  proposerManifestHash: string;
  proposerSummaryHash: string;
  arbiterManifestHash: string;
  arbiterSummaryHash: string;
  auditorManifestHash: string;
  auditorSummaryHash: string;
  executionReceiptsDigest: string;
  adjudicationSummaryHash: string;
  receipts: Map<string, FrenchInternalExecutionReceipt>;
}

interface AdjudicationRunSummary {
  schemaVersion: string;
  generatedAt: string;
  namespace: string;
  phase: string;
  expectedEntries: number;
  profiles: Record<
    "arbiter" | "auditor",
    { model: string; reasoningEffort: string }
  >;
  proposerProof: { summaryHash: string };
  outputs: {
    arbiter?: { summaryHash: string; output: FileOutput };
    auditor?: { summaryHash: string; output: FileOutput };
    executionReceipts?: { summaryHash: string; output: ReceiptOutput };
  };
  summaryHash: string;
}

interface FileOutput {
  path: string;
  sha256: string;
  bytes: number;
  logicalDigest: string;
}

interface ReceiptOutput extends FileOutput {
  records: number;
}

interface QualityAccumulator {
  selected: number;
  autoValidated: number;
  validatorClean: number;
  auditorSafe: number;
  siblingConsistent: number;
}

interface ExecutionAttestationLink {
  entryKey: string;
  role: (typeof ROLES)[number];
  batchId: string;
  inputHash: string;
  artifactHash: string;
  agentId: string;
  taskName: string;
  completedAt: string;
  threadId: string;
  runHash: string;
}

interface RawExecutionRunEnvelope {
  role: string;
  batchId: string;
  taskName: string;
  agentId: string;
  threadId: string;
  model: string;
  reasoningEffort: string;
  executorPolicyVersion: string;
  executor: FrenchInternalExecutionReceipt["executor"];
  capabilities: FrenchInternalExecutionReceipt["capabilities"];
  startedAt: string;
  completedAt: string;
  sourceHashes: Record<string, string>;
  resultHashes: Record<string, string>;
  runHash: string;
}

type FrenchRoleArtifact =
  | FrenchInternalProposerArtifact
  | FrenchInternalArbiterArtifact
  | FrenchInternalAuditorArtifact;

interface BlindReauditRunPointer {
  schemaVersion: "lexicon-v3-french-pilot-blind-reaudit-run@1";
  runtimePolicyVersion: typeof FRENCH_BLIND_REAUDIT_RUNTIME_POLICY_VERSION;
  namespace: string;
  batchId: string;
  manifestHash: string;
  selectionHash: string;
  batchHash: string;
  taskName: string;
  agentId: string;
  threadId: string;
  model: string;
  reasoningEffort: string;
  executorPolicyVersion: string;
  executor: FrenchPilotBlindReauditReceipt["executor"];
  capabilities: FrenchPilotBlindReauditReceipt["capabilities"];
  startedAt: string;
  completedAt: string;
  promptHash: string;
  sourceHashes: Record<string, string>;
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
  counts: { expected: number; decisions: number };
  usage: unknown;
  runHash: string;
}

interface VerifiedBlindReaudit {
  content: FrenchPilotQualityGateContent["blindReaudit"];
  generatedAt: string;
}

export interface FrenchPilotQualityGateGeneratedAtProof {
  blindReauditSummaryGeneratedAt: string;
  blindReceiptCompletedAts: readonly string[];
}

/**
 * Bind the gate timestamp to the latest sealed blind-reaudit receipt. An
 * explicit timestamp is only a reproducibility assertion, never an override.
 */
export function resolveFrenchPilotQualityGateGeneratedAt(
  proof: FrenchPilotQualityGateGeneratedAtProof,
  requestedGeneratedAt?: string
): string {
  if (
    proof.blindReceiptCompletedAts.length === 0 ||
    proof.blindReceiptCompletedAts.some(
      (completedAt) => !isCanonicalIsoTimestamp(completedAt)
    )
  ) {
    throw new Error("french-pilot-quality-gate-generated-at-proof-invalid");
  }
  const latestReceiptCompletedAt = [...proof.blindReceiptCompletedAts]
    .sort(
      (left, right) =>
        Date.parse(left) - Date.parse(right) || left.localeCompare(right)
    )
    .at(-1)!;
  if (
    !isCanonicalIsoTimestamp(proof.blindReauditSummaryGeneratedAt) ||
    proof.blindReauditSummaryGeneratedAt !== latestReceiptCompletedAt
  ) {
    throw new Error("french-pilot-quality-gate-generated-at-proof-incoherent");
  }
  if (requestedGeneratedAt === undefined) {
    return latestReceiptCompletedAt;
  }
  if (!isCanonicalIsoTimestamp(requestedGeneratedAt)) {
    throw new Error("french-pilot-quality-gate-generated-at-invalid");
  }
  if (requestedGeneratedAt !== latestReceiptCompletedAt) {
    throw new Error("french-pilot-quality-gate-generated-at-incoherent");
  }
  return latestReceiptCompletedAt;
}

export function buildLexiconV3FrenchPilotQualityGate(
  options: BuildFrenchPilotQualityGateOptions
): FrenchPilotQualityGateBuildResult {
  assertDistinctPaths(options);

  const sourceArtifacts = {
    pilotManifest: artifact(options.pilotManifestPath),
    pilotSelection: artifact(options.pilotSelectionPath),
    selectedPackets: artifact(options.selectedPacketsPath),
    configuration: artifact(options.configurationPath),
    proposerSummary: artifact(options.proposerSummaryPath),
    adjudicationSummary: artifact(options.adjudicationSummaryPath),
    executionReceipts: artifact(options.executionReceiptsPath),
    executionReceiptsSummary: artifact(options.executionReceiptsSummaryPath),
    assembledReview: artifact(options.assembledReviewPath),
    assemblySummary: artifact(options.assemblySummaryPath),
    remediationSummary: artifact(options.remediationSummaryPath),
    finalReview: artifact(options.finalReviewPath),
    blindReauditManifest: artifact(options.blindReauditManifestPath),
    blindReauditSummary: artifact(options.blindReauditSummaryPath),
    blindReauditReceipts: artifact(options.blindReauditReceiptsPath),
    blindReauditDecisions: artifact(options.blindReauditDecisionsPath)
  } as const;

  const manifest = parseJson<FrenchCodexAnyBatchManifest>(
    sourceArtifacts.pilotManifest,
    "pilot-manifest"
  );
  const manifestContext = assertFrenchCodexAnyBatchManifest(manifest, {
    verifyFiles: true,
    expectedEntries: FRENCH_PILOT_QUALITY_GATE_EXPECTED_ENTRIES
  });
  if (
    manifest.schemaVersion !==
      FRENCH_CODEX_PILOT_BATCH_MANIFEST_SCHEMA_VERSION ||
    manifestContext.runKind !== "pilot" ||
    manifestContext.namespace !== "/fr-internal/pilot"
  ) {
    throw new Error("french-pilot-quality-gate-not-pilot-manifest");
  }
  const pilotManifest = manifest as FrenchCodexPilotBatchManifest;
  if (
    resolve(pilotManifest.sourcePaths.pilot) !==
      resolve(options.pilotSelectionPath) ||
    resolve(pilotManifest.selectedPackets.path) !==
      resolve(options.selectedPacketsPath)
  ) {
    throw new Error("french-pilot-quality-gate-pilot-path-lineage");
  }

  const pilot = parseJson<FrenchInternalPilotPlan>(
    sourceArtifacts.pilotSelection,
    "pilot-selection"
  );
  assertPilot(pilot, pilotManifest);
  const packets = parseJsonl<LexiconV3FrenchPacket>(
    sourceArtifacts.selectedPackets,
    "selected-packets"
  );
  assertPackets(packets, pilot, pilotManifest);
  const packetByKey = new Map(
    packets.map((packet) => [packet.entryKey, packet])
  );

  const configuration = parseJson<FrenchInternalAssemblyConfigurationFile>(
    sourceArtifacts.configuration,
    "configuration"
  );
  assertConfiguration(configuration);

  const entityArtifacts = {
    canonicalEntities: artifact(options.canonicalEntitiesPath),
    canonicalEntryPolicies: artifact(options.canonicalEntryPoliciesPath),
    entityMergeAttestation: artifact(options.entityMergeAttestationPath),
    entityGate: artifact(options.entityGatePath),
    entityMentions: artifact(options.entityMentionsPath),
    entityMentionResolutionAttestation: artifact(
      options.entityMentionResolutionAttestationPath
    ),
    entityPackets: artifact(options.entityPacketsPath)
  } as const;
  assertPilotEntityArtifacts({
    configuration,
    artifacts: entityArtifacts,
    selectedPackets: packets
  });

  const proposerSummary = parseJson<FrenchCodexProposerSummary>(
    sourceArtifacts.proposerSummary,
    "proposer-summary"
  );
  assertProposerSummary(proposerSummary, pilotManifest, manifestContext);

  const transitive = new Map<string, FrenchPilotQualityGateSourceArtifact>();
  for (const [label, value] of Object.entries(entityArtifacts)) {
    const { buffer: _buffer, ...artifactValue } = value;
    void _buffer;
    transitive.set(`entity:${label}`, artifactValue);
  }
  const initialExecution = readExecutionClosure({
    labelPrefix: "pilot",
    adjudicationSummaryArtifact: sourceArtifacts.adjudicationSummary,
    executionReceiptsArtifact: sourceArtifacts.executionReceipts,
    executionReceiptsSummaryArtifact: sourceArtifacts.executionReceiptsSummary,
    expectedProposerSummaryHash: proposerSummary.summaryHash,
    expectedManifestHash: pilotManifest.manifestHash,
    expectedSelectionHash: manifestContext.selectionHash,
    expectedKeyOrderHash: manifestContext.keyOrderHash,
    expectedReleaseKey: manifestContext.lineage.releaseKey,
    expectedReleaseSnapshotFingerprint:
      manifestContext.lineage.releaseSnapshotFingerprint,
    expectedEntries: FRENCH_PILOT_QUALITY_GATE_EXPECTED_ENTRIES,
    transitive
  });

  const assembledReviews = parseJsonl<FrenchInternalReviewRecord>(
    sourceArtifacts.assembledReview,
    "assembled-review"
  );
  const assemblySummary = parseJson<FrenchInternalAssemblySummary>(
    sourceArtifacts.assemblySummary,
    "assembly-summary"
  );
  assertAssemblySummary(
    assemblySummary,
    sourceArtifacts.assemblySummary,
    sourceArtifacts.assembledReview,
    assembledReviews,
    configuration.generationConfigHash,
    FRENCH_PILOT_QUALITY_GATE_EXPECTED_ENTRIES
  );
  assertReviewCoverage(
    assembledReviews,
    packetByKey,
    configuration.generationConfigHash,
    false,
    "assembled"
  );

  const remediation = parseJson<FrenchInternalRemediationRunSummary>(
    sourceArtifacts.remediationSummary,
    "remediation-summary"
  );
  const finalReviews = parseJsonl<FrenchInternalReviewRecord>(
    sourceArtifacts.finalReview,
    "final-review"
  );
  const remediationExecutions = assertRemediation({
    remediation,
    remediationSummaryArtifact: sourceArtifacts.remediationSummary,
    assembledReviewArtifact: sourceArtifacts.assembledReview,
    finalReviewArtifact: sourceArtifacts.finalReview,
    assembledReviews,
    finalReviews,
    releaseKey: manifestContext.lineage.releaseKey,
    releaseSnapshotFingerprint:
      manifestContext.lineage.releaseSnapshotFingerprint,
    transitive
  });
  const executionClosures = [initialExecution, ...remediationExecutions];
  const receipts = mergeExecutionReceipts(executionClosures);
  const finalQuality = assertFinalReviews({
    reviews: finalReviews,
    packetByKey,
    pilot,
    generationConfigHash: configuration.generationConfigHash,
    executionClosures,
    receipts
  });
  const blindReaudit = assertBlindReaudit({
    manifestArtifact: sourceArtifacts.blindReauditManifest,
    summaryArtifact: sourceArtifacts.blindReauditSummary,
    receiptsArtifact: sourceArtifacts.blindReauditReceipts,
    decisionsArtifact: sourceArtifacts.blindReauditDecisions,
    pilotManifestArtifact: sourceArtifacts.pilotManifest,
    pilotSelectionArtifact: sourceArtifacts.pilotSelection,
    selectedPacketsArtifact: sourceArtifacts.selectedPackets,
    configurationArtifact: sourceArtifacts.configuration,
    finalReviewArtifact: sourceArtifacts.finalReview,
    pilotManifest,
    pilot,
    packets,
    finalReviews,
    generationConfigHash: configuration.generationConfigHash,
    finalReviewLogicalDigest: remediation.finalReviews.logicalDigest,
    requestedGeneratedAt: options.generatedAt,
    transitive
  });

  const statusCounts = countStatuses(finalReviews);
  const content: FrenchPilotQualityGateContent = {
    schemaVersion: FRENCH_PILOT_QUALITY_GATE_SCHEMA_VERSION,
    policyVersion: FRENCH_PILOT_QUALITY_GATE_POLICY_VERSION,
    status: "pass",
    generatedAt: blindReaudit.generatedAt,
    lineage: {
      releaseKey: manifestContext.lineage.releaseKey,
      releaseSnapshotFingerprint:
        manifestContext.lineage.releaseSnapshotFingerprint,
      sourceLogicalDigest: manifestContext.lineage.sourceLogicalDigest,
      packetSchemaVersion: FRENCH_PACKET_SCHEMA_VERSION,
      pilotManifestHash: pilotManifest.manifestHash,
      pilotSelectionHash: pilot.contentHash,
      pilotKeyOrderHash: manifestContext.keyOrderHash,
      selectedPacketsLogicalDigest:
        frenchCodexSelectedPacketsLogicalDigest(packets),
      generationConfigHash: configuration.generationConfigHash,
      approvedExecutionProfileHash: hashFrenchInternalJson(
        FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE
      )
    },
    sourceArtifacts: stripBuffers(sourceArtifacts),
    transitiveArtifacts: [...transitive.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([label, value]) => ({ label, ...value })),
    coverage: {
      expectedEntries: FRENCH_PILOT_QUALITY_GATE_EXPECTED_ENTRIES,
      selectedEntries: pilot.keys.length,
      packetEntries: packets.length,
      proposerAEntries: proposerSummary.counts.proposerA,
      proposerBEntries: proposerSummary.counts.proposerB,
      arbiterEntries: initialExecution.receipts.size / ROLES.length,
      auditorEntries: initialExecution.receipts.size / ROLES.length,
      assembledReviewEntries: assembledReviews.length,
      finalReviewEntries: finalReviews.length,
      executionReceipts: finalReviews.length * ROLES.length,
      expectedExecutionReceipts:
        FRENCH_PILOT_QUALITY_GATE_EXPECTED_ENTRIES * ROLES.length,
      exactSelection: true,
      exactPackets: true,
      exactRoleProofs: true,
      exactFinalReviews: true
    },
    roles: {
      approvedExecutionProfile: FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE,
      receiptsPerEntry: 4,
      fourDistinctRolesPerEntry: true,
      fourDistinctAgentsPerEntry: true,
      fourDistinctThreadsPerEntry: true,
      allReceiptsContentAddressed: true
    },
    quality: {
      statusCounts,
      violationCounts: {
        identity: 0,
        protectedContent: 0,
        source: 0,
        html: 0,
        structural: 0,
        validator: 0,
        audit: 0,
        sibling: 0
      },
      strata: finalQuality.strata,
      allRequiredStrataRepresented: true
    },
    remediation: {
      status: "complete",
      maxRounds: remediation.maxRounds,
      roundsUsed: remediation.rounds.length,
      residualEntries: 0,
      initialReviewLogicalDigest: remediation.initialReviews.logicalDigest,
      finalReviewLogicalDigest: remediation.finalReviews.logicalDigest,
      runHash: remediation.runHash
    },
    blindReaudit: blindReaudit.content
  };
  const gate = finalizeFrenchPilotQualityGate(content);
  assertFrenchPilotQualityGate(gate, { verifySourceFiles: true });
  const outputPath = resolve(
    options.outputDir,
    frenchPilotQualityGateFilename(gate.gateHash)
  );
  installContentAddressed(outputPath, `${JSON.stringify(gate, null, 2)}\n`);
  assertFrenchPilotQualityGate(gate, {
    verifySourceFiles: true,
    requireContentAddressedPath: outputPath
  });
  return { gate, outputPath };
}

function readExecutionClosure(input: {
  labelPrefix: string;
  adjudicationSummaryArtifact: SourceArtifactWithBuffer;
  executionReceiptsArtifact?: SourceArtifactWithBuffer;
  executionReceiptsSummaryArtifact?: SourceArtifactWithBuffer;
  expectedProposerSummaryHash: string;
  expectedManifestHash?: string;
  expectedSelectionHash?: string;
  expectedKeyOrderHash?: string;
  expectedReleaseKey: string;
  expectedReleaseSnapshotFingerprint: string;
  expectedEntries: number;
  transitive: Map<string, FrenchPilotQualityGateSourceArtifact>;
}): ExecutionRunClosure {
  const adjudication = parseJson<AdjudicationRunSummary>(
    input.adjudicationSummaryArtifact,
    `${input.labelPrefix}-adjudication-summary`
  );
  const { summaryHash, ...adjudicationContent } = adjudication;
  if (
    adjudication.schemaVersion !==
      FRENCH_CODEX_PILOT_ADJUDICATION_SUMMARY_SCHEMA_VERSION ||
    adjudication.phase !== "all" ||
    adjudication.expectedEntries !== input.expectedEntries ||
    adjudication.proposerProof.summaryHash !==
      input.expectedProposerSummaryHash ||
    summaryHash !== hashFrenchInternalJson(adjudicationContent) ||
    canonicalFrenchInternalJson(adjudication.profiles) !==
      canonicalFrenchInternalJson({
        arbiter: FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.arbiter,
        auditor: FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.auditor
      }) ||
    !adjudication.outputs.arbiter ||
    !adjudication.outputs.auditor ||
    !adjudication.outputs.executionReceipts
  ) {
    throw new Error(
      `french-pilot-quality-gate-adjudication-summary-invalid:${input.labelPrefix}`
    );
  }
  const receiptSummaryArtifact =
    input.executionReceiptsSummaryArtifact ??
    artifact(
      resolve(
        dirname(adjudication.outputs.executionReceipts.output.path),
        "execution-receipts.summary.json"
      )
    );
  const receiptArtifact =
    input.executionReceiptsArtifact ??
    artifact(adjudication.outputs.executionReceipts.output.path);
  const receiptSummary = parseJson<FrenchCodexExecutionReceiptsSummary>(
    receiptSummaryArtifact,
    `${input.labelPrefix}-execution-receipts-summary`
  );
  const { summaryHash: receiptSummaryHash, ...receiptSummaryContent } =
    receiptSummary;
  if (
    receiptSummary.schemaVersion !==
      FRENCH_CODEX_EXECUTION_RECEIPTS_SUMMARY_SCHEMA_VERSION ||
    receiptSummaryHash !== hashFrenchInternalJson(receiptSummaryContent) ||
    adjudication.outputs.executionReceipts.summaryHash !== receiptSummaryHash ||
    receiptSummary.namespace !== adjudication.namespace ||
    receiptSummary.releaseKey !== input.expectedReleaseKey ||
    receiptSummary.releaseSnapshotFingerprint !==
      input.expectedReleaseSnapshotFingerprint ||
    receiptSummary.coverage !== "exact" ||
    receiptSummary.counts.entries !== input.expectedEntries ||
    receiptSummary.counts.receipts !== input.expectedEntries * ROLES.length ||
    canonicalFrenchInternalJson(receiptSummary.profiles) !==
      canonicalFrenchInternalJson(FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE) ||
    (input.expectedSelectionHash !== undefined &&
      receiptSummary.selectionHash !== input.expectedSelectionHash) ||
    (input.expectedKeyOrderHash !== undefined &&
      receiptSummary.keyOrderHash !== input.expectedKeyOrderHash) ||
    resolve(receiptSummary.output.path) !== resolve(receiptArtifact.path) ||
    receiptSummary.output.sha256 !== receiptArtifact.sha256 ||
    receiptSummary.output.bytes !== receiptArtifact.bytes ||
    receiptSummary.output.records !== input.expectedEntries * ROLES.length
  ) {
    throw new Error(
      `french-pilot-quality-gate-execution-summary-invalid:${input.labelPrefix}`
    );
  }
  for (const [label, path] of Object.entries(
    receiptSummary.sourcePaths
  ) as Array<[keyof typeof receiptSummary.sourcePaths, string]>) {
    const source = artifact(path);
    if (receiptSummary.sourceDigests[label] !== source.sha256) {
      throw new Error(
        `french-pilot-quality-gate-execution-source-stale:${input.labelPrefix}:${label}`
      );
    }
    addTransitive(input.transitive, `${input.labelPrefix}:${label}`, source);
  }
  addTransitive(
    input.transitive,
    `${input.labelPrefix}:executionReceiptsSummary`,
    receiptSummaryArtifact
  );
  addTransitive(
    input.transitive,
    `${input.labelPrefix}:executionReceipts`,
    receiptArtifact
  );

  const proposerManifest = readSelfHashedJson(
    receiptSummary.sourcePaths.proposerManifest,
    "manifestHash",
    `${input.labelPrefix}:proposerManifest`
  );
  const proposerManifestValue =
    proposerManifest.value as unknown as FrenchCodexAnyBatchManifest;
  const proposerContext = assertFrenchCodexAnyBatchManifest(
    proposerManifestValue,
    {
      verifyFiles: true,
      expectedEntries: input.expectedEntries
    }
  );
  const proposerSummary = readSelfHashedJson(
    receiptSummary.sourcePaths.proposerSummary,
    "summaryHash",
    `${input.labelPrefix}:proposerSummary`
  );
  const arbiterManifest = readSelfHashedJson(
    receiptSummary.sourcePaths.arbiterManifest,
    "manifestHash",
    `${input.labelPrefix}:arbiterManifest`
  );
  const arbiterSummary = readSelfHashedJson(
    receiptSummary.sourcePaths.arbiterSummary,
    "summaryHash",
    `${input.labelPrefix}:arbiterSummary`
  );
  const auditorManifest = readSelfHashedJson(
    receiptSummary.sourcePaths.auditorManifest,
    "manifestHash",
    `${input.labelPrefix}:auditorManifest`
  );
  const auditorSummary = readSelfHashedJson(
    receiptSummary.sourcePaths.auditorSummary,
    "summaryHash",
    `${input.labelPrefix}:auditorSummary`
  );
  if (
    proposerSummary.hash !== input.expectedProposerSummaryHash ||
    proposerManifest.hash !== proposerManifestValue.manifestHash ||
    receiptSummary.namespace !== proposerContext.namespace ||
    receiptSummary.selectionHash !== proposerContext.selectionHash ||
    receiptSummary.keyOrderHash !== proposerContext.keyOrderHash ||
    receiptSummary.releaseKey !== proposerContext.lineage.releaseKey ||
    receiptSummary.releaseSnapshotFingerprint !==
      proposerContext.lineage.releaseSnapshotFingerprint ||
    (input.expectedManifestHash !== undefined &&
      proposerManifest.hash !== input.expectedManifestHash) ||
    arbiterSummary.hash !== adjudication.outputs.arbiter.summaryHash ||
    auditorSummary.hash !== adjudication.outputs.auditor.summaryHash
  ) {
    throw new Error(
      `french-pilot-quality-gate-execution-summary-lineage:${input.labelPrefix}`
    );
  }
  const receipts = parseJsonl<FrenchInternalExecutionReceipt>(
    receiptArtifact,
    `${input.labelPrefix}-execution-receipts`
  );
  const receiptMap = assertExecutionReceipts(
    receipts,
    receiptSummary,
    input.expectedEntries
  );
  const logicalDigest = hashFrenchInternalJson(
    receipts.map((receipt) => ({
      entryKey: receipt.entryKey,
      role: receipt.role,
      receiptHash: receipt.receiptHash
    }))
  );
  if (logicalDigest !== receiptSummary.output.logicalDigest) {
    throw new Error(
      `french-pilot-quality-gate-execution-receipts-digest:${input.labelPrefix}`
    );
  }
  replayExecutionRuns({
    labelPrefix: input.labelPrefix,
    receipts,
    aggregatePaths: {
      proposerA: nestedString(
        proposerSummary.value,
        ["outputs", "proposerA", "path"],
        `${input.labelPrefix}:proposerA-output`
      ),
      proposerB: nestedString(
        proposerSummary.value,
        ["outputs", "proposerB", "path"],
        `${input.labelPrefix}:proposerB-output`
      ),
      arbiter: nestedString(
        arbiterSummary.value,
        ["output", "path"],
        `${input.labelPrefix}:arbiter-output`
      ),
      auditor: nestedString(
        auditorSummary.value,
        ["output", "path"],
        `${input.labelPrefix}:auditor-output`
      )
    },
    linkPaths: {
      proposerA: receiptSummary.sourcePaths.proposerAttestationLinks,
      proposerB: receiptSummary.sourcePaths.proposerAttestationLinks,
      arbiter: receiptSummary.sourcePaths.arbiterAttestationLinks,
      auditor: receiptSummary.sourcePaths.auditorAttestationLinks
    },
    transitive: input.transitive
  });
  return {
    namespace: receiptSummary.namespace,
    releaseKey: receiptSummary.releaseKey,
    releaseSnapshotFingerprint: receiptSummary.releaseSnapshotFingerprint,
    selectionHash: receiptSummary.selectionHash,
    keyOrderHash: receiptSummary.keyOrderHash,
    proposerManifestHash: proposerManifest.hash,
    proposerSummaryHash: proposerSummary.hash,
    arbiterManifestHash: arbiterManifest.hash,
    arbiterSummaryHash: arbiterSummary.hash,
    auditorManifestHash: auditorManifest.hash,
    auditorSummaryHash: auditorSummary.hash,
    executionReceiptsDigest: receiptSummary.output.logicalDigest,
    adjudicationSummaryHash: adjudication.summaryHash,
    receipts: receiptMap
  };
}

function replayExecutionRuns(input: {
  labelPrefix: string;
  receipts: readonly FrenchInternalExecutionReceipt[];
  aggregatePaths: Record<(typeof ROLES)[number], string>;
  linkPaths: Record<(typeof ROLES)[number], string>;
  transitive: Map<string, FrenchPilotQualityGateSourceArtifact>;
}): void {
  const aggregateArtifacts = {
    proposerA: readFrenchInternalProposerArtifacts(
      input.aggregatePaths.proposerA,
      "proposerA"
    ).records,
    proposerB: readFrenchInternalProposerArtifacts(
      input.aggregatePaths.proposerB,
      "proposerB"
    ).records,
    arbiter: readFrenchInternalArbiterArtifacts(input.aggregatePaths.arbiter)
      .records,
    auditor: readFrenchInternalAuditorArtifacts(input.aggregatePaths.auditor)
      .records
  };
  const aggregateByRole = Object.fromEntries(
    ROLES.map((role) => [
      role,
      new Map(
        aggregateArtifacts[role].map((record) => [record.entryKey, record])
      )
    ])
  ) as Record<(typeof ROLES)[number], Map<string, FrenchRoleArtifact>>;
  for (const role of ROLES) {
    const source = artifact(input.aggregatePaths[role]);
    addTransitive(
      input.transitive,
      `${input.labelPrefix}:aggregate:${role}`,
      source
    );
  }

  const proposerLinks = readExecutionLinks(
    input.linkPaths.proposerA,
    ["proposerA", "proposerB"],
    `${input.labelPrefix}:proposer-links`
  );
  const arbiterLinks = readExecutionLinks(
    input.linkPaths.arbiter,
    ["arbiter"],
    `${input.labelPrefix}:arbiter-links`
  );
  const auditorLinks = readExecutionLinks(
    input.linkPaths.auditor,
    ["auditor"],
    `${input.labelPrefix}:auditor-links`
  );
  const links = new Map([...proposerLinks, ...arbiterLinks, ...auditorLinks]);
  if (links.size !== input.receipts.length) {
    throw new Error(
      `french-pilot-quality-gate-raw-link-coverage:${input.labelPrefix}`
    );
  }

  const runGroups = new Map<string, FrenchInternalExecutionReceipt[]>();
  for (const receipt of input.receipts) {
    const artifactRecord = aggregateByRole[receipt.role].get(receipt.entryKey);
    const link = links.get(`${receipt.entryKey}:${receipt.role}`);
    assertFrenchPilotExecutionArtifactLinkBinding({
      receipt,
      artifact: artifactRecord,
      link,
      label: input.labelPrefix
    });
    const runPointer = receipt.sourcePaths.runPointer;
    const group = runGroups.get(runPointer) ?? [];
    group.push(receipt);
    runGroups.set(runPointer, group);
  }
  const threadIds = new Set<string>();
  const agentIds = new Set<string>();
  for (const receipts of runGroups.values()) {
    const replay = replayExecutionRun({
      labelPrefix: input.labelPrefix,
      receipts,
      aggregateByRole,
      transitive: input.transitive
    });
    if (threadIds.has(replay.threadId) || agentIds.has(replay.agentId)) {
      throw new Error(
        `french-pilot-quality-gate-raw-run-identity-reused:${input.labelPrefix}`
      );
    }
    threadIds.add(replay.threadId);
    agentIds.add(replay.agentId);
  }
}

export function assertFrenchPilotExecutionArtifactLinkBinding(input: {
  receipt: FrenchInternalExecutionReceipt;
  artifact: FrenchRoleArtifact | undefined;
  link: ExecutionAttestationLink | undefined;
  label?: string;
}): void {
  const expectedLink: ExecutionAttestationLink = {
    entryKey: input.receipt.entryKey,
    role: input.receipt.role,
    batchId: input.receipt.batchId,
    inputHash: input.receipt.inputHash,
    artifactHash: input.receipt.artifactHash,
    agentId: input.receipt.agentId,
    taskName: input.receipt.taskName,
    completedAt: input.receipt.completedAt,
    threadId: input.receipt.threadId,
    runHash: input.receipt.runHash
  };
  if (
    !input.artifact ||
    input.artifact.artifactHash !== input.receipt.artifactHash ||
    input.artifact.inputHash !== input.receipt.inputHash ||
    input.artifact.agentId !== input.receipt.agentId ||
    input.artifact.taskName !== input.receipt.taskName ||
    input.artifact.completedAt !== input.receipt.completedAt ||
    !input.link ||
    canonicalFrenchInternalJson(input.link) !==
      canonicalFrenchInternalJson(expectedLink)
  ) {
    throw new Error(
      `french-pilot-quality-gate-raw-artifact-link:${input.label ?? "standalone"}:${input.receipt.entryKey}:${input.receipt.role}`
    );
  }
}

function replayExecutionRun(input: {
  labelPrefix: string;
  receipts: readonly FrenchInternalExecutionReceipt[];
  aggregateByRole: Record<
    (typeof ROLES)[number],
    ReadonlyMap<string, FrenchRoleArtifact>
  >;
  transitive: Map<string, FrenchPilotQualityGateSourceArtifact>;
}): { threadId: string; agentId: string } {
  const first = input.receipts[0];
  if (!first) {
    throw new Error(
      `french-pilot-quality-gate-raw-run-empty:${input.labelPrefix}`
    );
  }
  const role = first.role;
  assertPinnedExecutionBinary(
    first.executor,
    input.transitive,
    `${input.labelPrefix}:executor`
  );
  if (
    input.receipts.some(
      (receipt) =>
        receipt.role !== role ||
        receipt.batchId !== first.batchId ||
        receipt.namespace !== first.namespace ||
        receipt.runHash !== first.runHash ||
        receipt.threadId !== first.threadId ||
        receipt.agentId !== first.agentId ||
        receipt.taskName !== first.taskName ||
        canonicalFrenchInternalJson(receipt.sourcePaths) !==
          canonicalFrenchInternalJson(first.sourcePaths) ||
        canonicalFrenchInternalJson(receipt.sourceHashes) !==
          canonicalFrenchInternalJson(first.sourceHashes) ||
        canonicalFrenchInternalJson(receipt.resultPaths) !==
          canonicalFrenchInternalJson(first.resultPaths) ||
        canonicalFrenchInternalJson(receipt.resultHashes) !==
          canonicalFrenchInternalJson(first.resultHashes)
    )
  ) {
    throw new Error(
      `french-pilot-quality-gate-raw-run-split:${input.labelPrefix}:${first.batchId}:${role}`
    );
  }
  const expectedSourceKeys =
    role === "proposerA" || role === "proposerB"
      ? [
          "manifest",
          "input",
          "schema",
          "packets",
          "configuration",
          "runPointer"
        ]
      : [
          "manifestFile",
          "input",
          "outputSchema",
          "selection",
          "packets",
          "proposerA",
          "proposerB",
          "configuration",
          ...(role === "auditor" ? ["arbiterViews", "arbiters"] : []),
          "runPointer"
        ];
  const expectedResultKeys = [
    "agentEvents",
    "agentStderr",
    "structuredResponse",
    "drafts",
    "artifacts",
    "artifactSummary"
  ];
  if (
    !exactKeys(first.sourcePaths, expectedSourceKeys) ||
    !exactKeys(first.resultPaths, expectedResultKeys)
  ) {
    throw new Error(
      `french-pilot-quality-gate-raw-path-set:${input.labelPrefix}:${first.batchId}:${role}`
    );
  }
  const envelope = replayRawExecutionEnvelope({
    receipt: first,
    labelPrefix: `${input.labelPrefix}:raw:${role}:${first.batchId}`,
    transitive: input.transitive
  });
  if (role === "proposerA" || role === "proposerB") {
    replayProposerRun({
      labelPrefix: input.labelPrefix,
      receipts: input.receipts,
      runArtifact: envelope.runArtifact,
      resultArtifacts: envelope.resultArtifacts,
      aggregate: input.aggregateByRole[role]
    });
  } else {
    replayAdjudicationRun({
      labelPrefix: input.labelPrefix,
      receipts: input.receipts,
      runArtifact: envelope.runArtifact,
      resultArtifacts: envelope.resultArtifacts,
      aggregate: input.aggregateByRole[role]
    });
  }
  return { threadId: first.threadId, agentId: first.agentId };
}

export function assertFrenchPilotRawExecutionEnvelope(
  receipt: FrenchInternalExecutionReceipt
): void {
  replayRawExecutionEnvelope({
    receipt,
    labelPrefix: `standalone:${receipt.role}:${receipt.batchId}`,
    transitive: new Map()
  });
}

function replayRawExecutionEnvelope(input: {
  receipt: FrenchInternalExecutionReceipt;
  labelPrefix: string;
  transitive: Map<string, FrenchPilotQualityGateSourceArtifact>;
}): {
  runArtifact: SourceArtifactWithBuffer;
  resultArtifacts: Record<string, SourceArtifactWithBuffer>;
} {
  try {
    assertFrenchCodexExecutionReceipt(input.receipt);
  } catch (error) {
    throw new Error(
      `french-pilot-quality-gate-raw-receipt:${input.labelPrefix}:${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
  const sourceArtifacts = replayReceiptPaths({
    labelPrefix: `${input.labelPrefix}:source`,
    paths: input.receipt.sourcePaths,
    hashes: input.receipt.sourceHashes,
    transitive: input.transitive
  });
  const resultArtifacts = replayReceiptPaths({
    labelPrefix: `${input.labelPrefix}:result`,
    paths: input.receipt.resultPaths,
    hashes: input.receipt.resultHashes,
    transitive: input.transitive
  });
  const runArtifact = sourceArtifacts.runPointer;
  const eventsArtifact = resultArtifacts.agentEvents;
  const responseArtifact = resultArtifacts.structuredResponse;
  if (!runArtifact || !eventsArtifact || !responseArtifact) {
    throw new Error(
      `french-pilot-quality-gate-raw-envelope-paths:${input.labelPrefix}`
    );
  }
  const run = parseJson<RawExecutionRunEnvelope>(
    runArtifact,
    `${input.labelPrefix}:run`
  );
  const { runHash, ...runContent } = run;
  if (
    run.role !== input.receipt.role ||
    run.batchId !== input.receipt.batchId ||
    run.taskName !== input.receipt.taskName ||
    run.agentId !== input.receipt.agentId ||
    run.agentId !== `codex-agent:${run.threadId}` ||
    run.threadId !== input.receipt.threadId ||
    run.model !== input.receipt.model ||
    run.reasoningEffort !== input.receipt.reasoningEffort ||
    run.executorPolicyVersion !== input.receipt.executorPolicyVersion ||
    run.executorPolicyVersion !==
      FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.executorPolicyVersion ||
    canonicalFrenchInternalJson(run.executor) !==
      canonicalFrenchInternalJson(input.receipt.executor) ||
    canonicalFrenchInternalJson(run.capabilities) !==
      canonicalFrenchInternalJson(input.receipt.capabilities) ||
    run.startedAt !== input.receipt.startedAt ||
    run.completedAt !== input.receipt.completedAt ||
    canonicalFrenchInternalJson(run.sourceHashes) !==
      canonicalFrenchInternalJson(
        withoutKey(input.receipt.sourceHashes, "runPointer")
      ) ||
    canonicalFrenchInternalJson(run.resultHashes) !==
      canonicalFrenchInternalJson(input.receipt.resultHashes) ||
    runHash !== input.receipt.runHash ||
    runHash !== hashFrenchInternalJson(runContent)
  ) {
    throw new Error(
      `french-pilot-quality-gate-raw-envelope-run:${input.labelPrefix}`
    );
  }
  const events = parseFrenchCodexAgentEvents(
    eventsArtifact.buffer.toString("utf8"),
    responseArtifact.buffer.toString("utf8")
  );
  if (events.threadId !== run.threadId) {
    throw new Error(
      `french-pilot-quality-gate-raw-envelope-thread:${input.labelPrefix}`
    );
  }
  return { runArtifact, resultArtifacts };
}

function replayProposerRun(input: {
  labelPrefix: string;
  receipts: readonly FrenchInternalExecutionReceipt[];
  runArtifact: SourceArtifactWithBuffer;
  resultArtifacts: Record<string, SourceArtifactWithBuffer>;
  aggregate: ReadonlyMap<string, FrenchRoleArtifact>;
}): void {
  const first = input.receipts[0]!;
  const role = first.role as "proposerA" | "proposerB";
  const run = parseJson<FrenchCodexProposerRun>(
    input.runArtifact,
    `${input.labelPrefix}-raw-${role}-${first.batchId}-run`
  );
  const { runHash, ...runContent } = run;
  const manifestArtifact = artifact(first.sourcePaths.manifest!);
  const manifest = parseJson<FrenchCodexAnyBatchManifest>(
    manifestArtifact,
    `${input.labelPrefix}-raw-${role}-manifest`
  );
  const context = assertFrenchCodexAnyBatchManifest(manifest, {
    verifyFiles: true
  });
  const batch = manifest.batches.find(
    (candidate) => candidate.batchId === first.batchId
  );
  if (!batch) {
    throw new Error(
      `french-pilot-quality-gate-raw-proposer-batch:${input.labelPrefix}:${first.batchId}:${role}`
    );
  }
  const expectedInput =
    role === "proposerA"
      ? batch.inputs.proposerA.path
      : batch.inputs.proposerB.path;
  const expectedSchema =
    role === "proposerA"
      ? batch.schemas.proposerA.path
      : batch.schemas.proposerB.path;
  const expectedProfile = FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE[role];
  const expectedTaskName = `${context.namespace}/${role}/${batch.batchId}`;
  const expectedRunSources = withoutKey(first.sourceHashes, "runPointer");
  const prefix = role === "proposerA" ? "proposer-a" : "proposer-b";
  const runDirectory = dirname(expectedInput);
  const expectedSourcePaths = {
    manifest: resolve(first.sourcePaths.manifest!),
    input: resolve(expectedInput),
    schema: resolve(expectedSchema),
    packets: resolve(batch.inputs.packets.path),
    configuration: resolve(first.sourcePaths.configuration!),
    runPointer: resolve(runDirectory, `${prefix}-agent-run.json`)
  };
  const expectedResultPaths = {
    agentEvents: resolve(runDirectory, `${prefix}-agent-events.jsonl`),
    agentStderr: resolve(runDirectory, `${prefix}-agent-stderr.log`),
    structuredResponse: resolve(
      runDirectory,
      `${prefix}-structured-response.json`
    ),
    drafts: resolve(runDirectory, `${prefix}-drafts.jsonl`),
    artifacts: resolve(runDirectory, `${prefix}-artifacts.jsonl`),
    artifactSummary: resolve(runDirectory, `${prefix}-artifacts.summary.json`)
  };
  if (
    !exactKeys(run, [
      "schemaVersion",
      "executorPolicyVersion",
      "batchId",
      "role",
      "taskName",
      "agentId",
      "threadId",
      "model",
      "reasoningEffort",
      "executor",
      "sandbox",
      "capabilities",
      "startedAt",
      "completedAt",
      "promptHash",
      "rolePromptHash",
      "sourceHashes",
      "resultHashes",
      "counts",
      "usage",
      "runHash"
    ]) ||
    !exactKeys(run.sourceHashes, [
      "manifest",
      "batch",
      "input",
      "schema",
      "packets",
      "configuration"
    ]) ||
    !exactKeys(run.resultHashes, [
      "agentEvents",
      "agentStderr",
      "structuredResponse",
      "drafts",
      "artifacts",
      "artifactSummary"
    ]) ||
    run.schemaVersion !== FRENCH_CODEX_PROPOSER_RUN_SCHEMA_VERSION ||
    run.executorPolicyVersion !== FRENCH_CODEX_EXECUTOR_POLICY_VERSION ||
    run.role !== role ||
    run.batchId !== batch.batchId ||
    run.taskName !== expectedTaskName ||
    run.agentId !== `codex-agent:${run.threadId}` ||
    run.threadId !== first.threadId ||
    run.model !== expectedProfile.model ||
    run.reasoningEffort !== expectedProfile.reasoningEffort ||
    run.sandbox !== "read-only" ||
    run.rolePromptHash !== frenchInternalPromptHash(role) ||
    run.promptHash !==
      sha256(
        buildFrenchCodexProposerPrompt(role, batch, first.sourcePaths.input!)
      ) ||
    canonicalFrenchInternalJson(first.sourcePaths) !==
      canonicalFrenchInternalJson(expectedSourcePaths) ||
    canonicalFrenchInternalJson(first.resultPaths) !==
      canonicalFrenchInternalJson(expectedResultPaths) ||
    first.manifestHash !== manifest.manifestHash ||
    first.selectionHash !== context.selectionHash ||
    run.sourceHashes.batch !== batch.batchHash ||
    canonicalFrenchInternalJson(run.sourceHashes) !==
      canonicalFrenchInternalJson(expectedRunSources) ||
    canonicalFrenchInternalJson(run.resultHashes) !==
      canonicalFrenchInternalJson(first.resultHashes) ||
    canonicalFrenchInternalJson(run.executor) !==
      canonicalFrenchInternalJson(first.executor) ||
    canonicalFrenchInternalJson(run.capabilities) !==
      canonicalFrenchInternalJson(first.capabilities) ||
    run.startedAt !== first.startedAt ||
    run.completedAt !== first.completedAt ||
    run.counts.expected !== batch.keys.length ||
    run.counts.drafts !== batch.keys.length ||
    run.counts.artifacts !== batch.keys.length ||
    runHash !== first.runHash ||
    runHash !== hashFrenchInternalJson(runContent) ||
    first.taskName !== run.taskName ||
    first.agentId !== run.agentId
  ) {
    throw new Error(
      `french-pilot-quality-gate-raw-proposer-run:${input.labelPrefix}:${first.batchId}:${role}`
    );
  }
  const drafts = parseFrenchCodexProposerResponse({
    text: input.resultArtifacts.structuredResponse!.buffer.toString("utf8"),
    role,
    batch,
    viewsPath: first.sourcePaths.input!,
    packetsPath: first.sourcePaths.packets!
  });
  assertExactDraftFile(
    drafts,
    input.resultArtifacts.drafts!,
    `${input.labelPrefix}:${first.batchId}:${role}`
  );
  const artifacts = readFrenchInternalProposerArtifacts(
    first.resultPaths.artifacts!,
    role
  ).records;
  if (
    artifacts.length !== batch.keys.length ||
    input.receipts.length !== batch.keys.length
  ) {
    throw new Error(
      `french-pilot-quality-gate-raw-proposer-coverage:${input.labelPrefix}:${first.batchId}:${role}`
    );
  }
  const draftByKey = new Map(drafts.map((draft) => [draft.entryKey, draft]));
  const receiptByKey = new Map(
    input.receipts.map((receipt) => [receipt.entryKey, receipt])
  );
  for (const artifactRecord of artifacts) {
    const draft = draftByKey.get(artifactRecord.entryKey);
    const receipt = receiptByKey.get(artifactRecord.entryKey);
    const aggregate = input.aggregate.get(artifactRecord.entryKey);
    if (
      !draft ||
      !receipt ||
      !aggregate ||
      canonicalFrenchInternalJson(aggregate) !==
        canonicalFrenchInternalJson(artifactRecord) ||
      artifactRecord.artifactHash !== receipt.artifactHash ||
      artifactRecord.inputHash !== draft.inputHash ||
      artifactRecord.glossFr !== draft.glossFr.trim() ||
      canonicalFrenchInternalJson(artifactRecord.meaningSegmentsFr) !==
        canonicalFrenchInternalJson(
          draft.meaningSegmentsFr.map((segment) => ({
            id: segment.id,
            text: segment.text
          }))
        ) ||
      artifactRecord.notesFr !== draft.notesFr.trim() ||
      canonicalFrenchInternalJson(artifactRecord.carrierTermsFr) !==
        canonicalFrenchInternalJson(
          draft.carrierTermsFr.map((term) => term.trim())
        ) ||
      artifactRecord.confidence !== draft.confidence
    ) {
      throw new Error(
        `french-pilot-quality-gate-raw-proposer-draft-artifact:${input.labelPrefix}:${artifactRecord.entryKey}:${role}`
      );
    }
  }
  assertRawArtifactSummary(
    input.resultArtifacts.artifactSummary!,
    run,
    first.resultPaths,
    artifacts.length,
    `${input.labelPrefix}:${first.batchId}:${role}`
  );
}

function replayAdjudicationRun(input: {
  labelPrefix: string;
  receipts: readonly FrenchInternalExecutionReceipt[];
  runArtifact: SourceArtifactWithBuffer;
  resultArtifacts: Record<string, SourceArtifactWithBuffer>;
  aggregate: ReadonlyMap<string, FrenchRoleArtifact>;
}): void {
  const first = input.receipts[0]!;
  const role = first.role as "arbiter" | "auditor";
  const run = parseJson<FrenchCodexAdjudicationRun>(
    input.runArtifact,
    `${input.labelPrefix}-raw-${role}-${first.batchId}-run`
  );
  const { runHash, ...runContent } = run;
  const manifestArtifact = artifact(first.sourcePaths.manifestFile!);
  const manifest = parseJson<FrenchCodexAdjudicationBatchManifest>(
    manifestArtifact,
    `${input.labelPrefix}-raw-${role}-manifest`
  );
  assertFrenchCodexAdjudicationBatchManifest(manifest);
  const batch = manifest.batches.find(
    (candidate) => candidate.batchId === first.batchId
  );
  if (
    !batch ||
    manifest.role !== role ||
    manifest.namespace !== first.namespace
  ) {
    throw new Error(
      `french-pilot-quality-gate-raw-adjudication-batch:${input.labelPrefix}:${first.batchId}:${role}`
    );
  }
  const expectedProfile = FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE[role];
  const expectedTaskName = `${manifest.namespace}/${role}/${batch.batchId}`;
  const expectedRunSources = withoutKey(first.sourceHashes, "runPointer");
  const expectedSourcePaths = {
    manifestFile: resolve(first.sourcePaths.manifestFile!),
    input: resolve(batch.input.path),
    outputSchema: resolve(batch.outputSchema.path),
    selection: resolve(batch.selection.path),
    packets: resolve(batch.context.packets.path),
    proposerA: resolve(batch.context.proposerA.path),
    proposerB: resolve(batch.context.proposerB.path),
    configuration: resolve(first.sourcePaths.configuration!),
    ...(role === "auditor"
      ? {
          arbiterViews: resolve(batch.context.arbiterViews!.path),
          arbiters: resolve(batch.context.arbiters!.path)
        }
      : {}),
    runPointer: resolve(batch.expected.runPath)
  };
  const expectedResultPaths = {
    agentEvents: resolve(batch.expected.eventsPath),
    agentStderr: resolve(batch.expected.stderrPath),
    structuredResponse: resolve(batch.expected.responsePath),
    drafts: resolve(batch.expected.draftsPath),
    artifacts: resolve(batch.expected.artifactsPath),
    artifactSummary: resolve(batch.expected.artifactSummaryPath)
  };
  const expectedRunSourceKeys = [
    "manifestFile",
    "manifest",
    "batch",
    "input",
    "outputSchema",
    "selection",
    "packets",
    "proposerA",
    "proposerB",
    "configuration",
    ...(role === "auditor" ? ["arbiterViews", "arbiters"] : [])
  ];
  if (
    !exactKeys(run, [
      "schemaVersion",
      "executorPolicyVersion",
      "batchId",
      "role",
      "taskName",
      "agentId",
      "threadId",
      "model",
      "reasoningEffort",
      "sandbox",
      "externalTools",
      "executor",
      "capabilities",
      "startedAt",
      "completedAt",
      "promptHash",
      "rolePromptHash",
      "sourceHashes",
      "resultHashes",
      "counts",
      "usage",
      "runHash"
    ]) ||
    !exactKeys(run.sourceHashes, expectedRunSourceKeys) ||
    !exactKeys(run.resultHashes, [
      "agentEvents",
      "agentStderr",
      "structuredResponse",
      "drafts",
      "artifacts",
      "artifactSummary"
    ]) ||
    run.schemaVersion !== FRENCH_CODEX_ADJUDICATION_RUN_SCHEMA_VERSION ||
    run.executorPolicyVersion !==
      FRENCH_CODEX_ADJUDICATION_EXECUTOR_POLICY_VERSION ||
    run.role !== role ||
    run.batchId !== batch.batchId ||
    run.taskName !== expectedTaskName ||
    run.agentId !== `codex-agent:${run.threadId}` ||
    run.threadId !== first.threadId ||
    run.model !== expectedProfile.model ||
    run.reasoningEffort !== expectedProfile.reasoningEffort ||
    run.sandbox !== "read-only" ||
    run.externalTools !== "disabled" ||
    run.rolePromptHash !== frenchInternalPromptHash(role) ||
    run.promptHash !==
      sha256(
        buildFrenchCodexAdjudicationPrompt(
          role,
          batch,
          readFileSync(batch.input.path, "utf8")
        )
      ) ||
    canonicalFrenchInternalJson(first.sourcePaths) !==
      canonicalFrenchInternalJson(expectedSourcePaths) ||
    canonicalFrenchInternalJson(first.resultPaths) !==
      canonicalFrenchInternalJson(expectedResultPaths) ||
    first.manifestHash !== manifest.manifestHash ||
    run.sourceHashes.batch !== batch.batchHash ||
    run.sourceHashes.manifest !== manifest.manifestHash ||
    canonicalFrenchInternalJson(run.sourceHashes) !==
      canonicalFrenchInternalJson(expectedRunSources) ||
    canonicalFrenchInternalJson(run.resultHashes) !==
      canonicalFrenchInternalJson(first.resultHashes) ||
    canonicalFrenchInternalJson(run.executor) !==
      canonicalFrenchInternalJson(first.executor) ||
    canonicalFrenchInternalJson(run.capabilities) !==
      canonicalFrenchInternalJson(first.capabilities) ||
    run.startedAt !== first.startedAt ||
    run.completedAt !== first.completedAt ||
    run.counts.expected !== batch.keys.length ||
    run.counts.drafts !== batch.keys.length ||
    run.counts.artifacts !== batch.keys.length ||
    runHash !== first.runHash ||
    runHash !== hashFrenchInternalJson(runContent) ||
    first.taskName !== run.taskName ||
    first.agentId !== run.agentId
  ) {
    throw new Error(
      `french-pilot-quality-gate-raw-adjudication-run:${input.labelPrefix}:${first.batchId}:${role}`
    );
  }
  const views = readAdjudicationViews(batch.input.path, role);
  const drafts = parseFrenchCodexAdjudicationResponse(
    input.resultArtifacts.structuredResponse!.buffer.toString("utf8"),
    role,
    batch,
    views
  );
  assertExactDraftFile(
    drafts,
    input.resultArtifacts.drafts!,
    `${input.labelPrefix}:${first.batchId}:${role}`
  );
  const artifacts =
    role === "arbiter"
      ? readFrenchInternalArbiterArtifacts(first.resultPaths.artifacts!).records
      : readFrenchInternalAuditorArtifacts(first.resultPaths.artifacts!)
          .records;
  if (
    artifacts.length !== batch.keys.length ||
    input.receipts.length !== batch.keys.length
  ) {
    throw new Error(
      `french-pilot-quality-gate-raw-adjudication-coverage:${input.labelPrefix}:${first.batchId}:${role}`
    );
  }
  const draftByKey = new Map(drafts.map((draft) => [draft.entryKey, draft]));
  const receiptByKey = new Map(
    input.receipts.map((receipt) => [receipt.entryKey, receipt])
  );
  for (const artifactRecord of artifacts) {
    const draft = draftByKey.get(artifactRecord.entryKey);
    const receipt = receiptByKey.get(artifactRecord.entryKey);
    const aggregate = input.aggregate.get(artifactRecord.entryKey);
    const shared =
      !!draft &&
      artifactRecord.inputHash === draft.inputHash &&
      artifactRecord.artifactHash === receipt?.artifactHash &&
      canonicalFrenchInternalJson(aggregate) ===
        canonicalFrenchInternalJson(artifactRecord) &&
      artifactRecord.verdict === draft.verdict &&
      canonicalFrenchInternalJson(artifactRecord.reasons) ===
        canonicalFrenchInternalJson(draft.reasons);
    const roleSpecific =
      role === "arbiter"
        ? artifactRecord.role === "arbiter" &&
          draft?.role === "arbiter" &&
          artifactRecord.selectedProposal === draft.selectedProposal
        : artifactRecord.role === "auditor" &&
          draft?.role === "auditor" &&
          artifactRecord.confidence === draft.confidence &&
          canonicalFrenchInternalJson(artifactRecord.checks) ===
            canonicalFrenchInternalJson(draft.checks);
    if (!draft || !receipt || !aggregate || !shared || !roleSpecific) {
      throw new Error(
        `french-pilot-quality-gate-raw-adjudication-draft-artifact:${input.labelPrefix}:${artifactRecord.entryKey}:${role}`
      );
    }
  }
  assertRawArtifactSummary(
    input.resultArtifacts.artifactSummary!,
    run,
    first.resultPaths,
    artifacts.length,
    `${input.labelPrefix}:${first.batchId}:${role}`
  );
}

function replayReceiptPaths(input: {
  labelPrefix: string;
  paths: Record<string, string>;
  hashes: Record<string, string>;
  transitive: Map<string, FrenchPilotQualityGateSourceArtifact>;
}): Record<string, SourceArtifactWithBuffer> {
  const output: Record<string, SourceArtifactWithBuffer> = {};
  for (const [label, path] of Object.entries(input.paths)) {
    const source = artifact(path);
    if (source.sha256 !== input.hashes[label]) {
      throw new Error(
        `french-pilot-quality-gate-raw-path-stale:${input.labelPrefix}:${label}`
      );
    }
    addTransitive(input.transitive, `${input.labelPrefix}:${label}`, source);
    output[label] = source;
  }
  return output;
}

function readExecutionLinks(
  path: string,
  expectedRoles: readonly (typeof ROLES)[number][],
  label: string
): Map<string, ExecutionAttestationLink> {
  const records = parseJsonl<ExecutionAttestationLink>(artifact(path), label);
  const output = new Map<string, ExecutionAttestationLink>();
  for (const record of records) {
    const key = `${record.entryKey}:${record.role}`;
    if (
      !exactKeys(record, [
        "entryKey",
        "role",
        "batchId",
        "inputHash",
        "artifactHash",
        "agentId",
        "taskName",
        "completedAt",
        "threadId",
        "runHash"
      ]) ||
      !expectedRoles.includes(record.role) ||
      output.has(key)
    ) {
      throw new Error(`french-pilot-quality-gate-raw-link-invalid:${label}`);
    }
    output.set(key, record);
  }
  return output;
}

function readAdjudicationViews(
  path: string,
  role: "arbiter" | "auditor"
): Map<string, FrenchCodexAdjudicationView> {
  const values = parseJsonl<FrenchCodexAdjudicationView>(
    artifact(path),
    `raw-${role}-views`
  );
  const output = new Map<string, FrenchCodexAdjudicationView>();
  for (const view of values) {
    if (
      view.role !== role ||
      frenchInternalAdjudicationViewHash(view) !== view.viewHash ||
      output.has(view.entryKey)
    ) {
      throw new Error(`french-pilot-quality-gate-raw-view-invalid:${role}`);
    }
    output.set(view.entryKey, view);
  }
  return output;
}

function assertExactDraftFile(
  drafts: readonly unknown[],
  artifactValue: SourceArtifactWithBuffer,
  label: string
): void {
  const published = parseJsonl<unknown>(artifactValue, `${label}:drafts`);
  if (
    canonicalFrenchInternalJson(published) !==
    canonicalFrenchInternalJson(drafts)
  ) {
    throw new Error(`french-pilot-quality-gate-raw-drafts:${label}`);
  }
}

export function assertFrenchPilotRawDraftPublication(
  drafts: readonly unknown[],
  path: string
): void {
  assertExactDraftFile(drafts, artifact(path), "standalone");
}

function assertRawArtifactSummary(
  summaryArtifact: SourceArtifactWithBuffer,
  run: FrenchCodexProposerRun | FrenchCodexAdjudicationRun,
  resultPaths: Record<string, string>,
  expectedRecords: number,
  label: string
): void {
  const summary = parseJson<Record<string, unknown>>(
    summaryArtifact,
    `${label}:artifact-summary`
  );
  const summaryDigest = summary.summaryDigest;
  const content = { ...summary };
  delete content.summaryDigest;
  const counts = summary.counts;
  const proposer = run.role === "proposerA" || run.role === "proposerB";
  const roleSpecificValid = proposer
    ? summary.agentId === run.agentId &&
      summary.taskName === run.taskName &&
      summary.completedAt === run.completedAt &&
      !!counts &&
      typeof counts === "object" &&
      (counts as Record<string, unknown>).artifacts === expectedRecords
    : summary.operation === `finalize-${run.role}` &&
      !!counts &&
      typeof counts === "object" &&
      (counts as Record<string, unknown>).records === expectedRecords &&
      resolve(
        String((summary.sourcePaths as Record<string, unknown>)?.drafts ?? "")
      ) === resolve(resultPaths.drafts!) &&
      resolve(
        String((summary.sourcePaths as Record<string, unknown>)?.output ?? "")
      ) === resolve(resultPaths.artifacts!) &&
      summary.outputDigest === run.resultHashes.artifacts;
  if (
    typeof summaryDigest !== "string" ||
    summaryDigest !== hashFrenchInternalJson(content) ||
    !roleSpecificValid
  ) {
    throw new Error(`french-pilot-quality-gate-raw-artifact-summary:${label}`);
  }
}

function nestedString(
  value: Record<string, unknown>,
  keys: readonly string[],
  label: string
): string {
  let current: unknown = value;
  for (const key of keys) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      throw new Error(`french-pilot-quality-gate-missing-path:${label}`);
    }
    current = (current as Record<string, unknown>)[key];
  }
  if (typeof current !== "string" || !current.trim()) {
    throw new Error(`french-pilot-quality-gate-missing-path:${label}`);
  }
  return current;
}

function withoutKey(
  value: Record<string, string>,
  key: string
): Record<string, string> {
  const output = { ...value };
  delete output[key];
  return output;
}

function assertRemediation(input: {
  remediation: FrenchInternalRemediationRunSummary;
  remediationSummaryArtifact: SourceArtifactWithBuffer;
  assembledReviewArtifact: SourceArtifactWithBuffer;
  finalReviewArtifact: SourceArtifactWithBuffer;
  assembledReviews: readonly FrenchInternalReviewRecord[];
  finalReviews: readonly FrenchInternalReviewRecord[];
  releaseKey: string;
  releaseSnapshotFingerprint: string;
  transitive: Map<string, FrenchPilotQualityGateSourceArtifact>;
}): ExecutionRunClosure[] {
  const { remediation } = input;
  const { runHash, ...content } = remediation;
  if (
    remediation.schemaVersion !==
      FRENCH_INTERNAL_REMEDIATION_RUN_SCHEMA_VERSION ||
    remediation.policyVersion !== FRENCH_INTERNAL_REMEDIATION_POLICY_VERSION ||
    remediation.status !== "complete" ||
    runHash !== hashFrenchInternalJson(content) ||
    !Number.isInteger(remediation.maxRounds) ||
    remediation.maxRounds < 1 ||
    remediation.rounds.length > remediation.maxRounds ||
    remediation.residuals.length !== 0 ||
    resolve(remediation.initialReviews.path) !==
      resolve(input.assembledReviewArtifact.path) ||
    remediation.initialReviews.sha256 !==
      input.assembledReviewArtifact.sha256 ||
    remediation.initialReviews.records !==
      FRENCH_PILOT_QUALITY_GATE_EXPECTED_ENTRIES ||
    remediation.initialReviews.logicalDigest !==
      frenchInternalRemediationReviewLogicalDigest(input.assembledReviews) ||
    resolve(remediation.finalReviews.path) !==
      resolve(input.finalReviewArtifact.path) ||
    remediation.finalReviews.sha256 !== input.finalReviewArtifact.sha256 ||
    remediation.finalReviews.records !==
      FRENCH_PILOT_QUALITY_GATE_EXPECTED_ENTRIES ||
    remediation.finalReviews.logicalDigest !==
      frenchInternalRemediationReviewLogicalDigest(input.finalReviews)
  ) {
    throw new Error("french-pilot-quality-gate-remediation-invalid");
  }
  const closures: ExecutionRunClosure[] = [];
  let previousRound = 0;
  for (const round of remediation.rounds) {
    const { roundHash, ...roundContent } = round;
    if (
      round.round !== previousRound + 1 ||
      round.round > remediation.maxRounds ||
      roundHash !== hashFrenchInternalJson(roundContent) ||
      round.selected < 1 ||
      round.replaced < 0 ||
      round.replaced > round.selected ||
      round.residual < 0
    ) {
      throw new Error(
        `french-pilot-quality-gate-remediation-round-invalid:${round.round}`
      );
    }
    previousRound = round.round;
    const paths = [
      ["plan", round.planPath],
      ["batchManifest", round.batchManifestPath],
      ["proposerSummary", round.proposerSummaryPath],
      ["adjudicationSummary", round.adjudicationSummaryPath],
      ["attemptedReview", round.attemptedReviewPath],
      ["mergedReview", round.mergedReviewPath],
      ["mergeSummary", round.mergeSummaryPath]
    ] as const;
    for (const [label, path] of paths) {
      addTransitive(
        input.transitive,
        `remediation-${round.round}:${label}`,
        artifact(path)
      );
    }
    if (
      artifact(round.adjudicationSummaryPath).sha256 !==
        round.adjudicationSummarySha256 ||
      artifact(round.attemptedReviewPath).sha256 !== round.attemptedReviewSha256
    ) {
      throw new Error(
        `french-pilot-quality-gate-remediation-source-stale:${round.round}`
      );
    }
    const plan = readSelfHashedJson(
      round.planPath,
      "planHash",
      `remediation-${round.round}:plan`
    );
    const batchManifest = readSelfHashedJson(
      round.batchManifestPath,
      "manifestHash",
      `remediation-${round.round}:batchManifest`
    );
    const proposerSummary = readSelfHashedJson(
      round.proposerSummaryPath,
      "summaryHash",
      `remediation-${round.round}:proposerSummary`
    );
    const merge = readSelfHashedJson(
      round.mergeSummaryPath,
      "mergeHash",
      `remediation-${round.round}:mergeSummary`
    );
    if (
      plan.hash !== round.planHash ||
      batchManifest.hash !== round.batchManifestHash ||
      proposerSummary.hash !== round.proposerSummaryHash ||
      merge.hash !== round.mergeHash
    ) {
      throw new Error(
        `french-pilot-quality-gate-remediation-lineage:${round.round}`
      );
    }
    closures.push(
      readExecutionClosure({
        labelPrefix: `remediation-${round.round}`,
        adjudicationSummaryArtifact: artifact(round.adjudicationSummaryPath),
        expectedProposerSummaryHash: round.proposerSummaryHash,
        expectedManifestHash: round.batchManifestHash,
        expectedReleaseKey: input.releaseKey,
        expectedReleaseSnapshotFingerprint: input.releaseSnapshotFingerprint,
        expectedEntries: round.selected,
        transitive: input.transitive
      })
    );
  }
  return closures;
}

function assertBlindReaudit(input: {
  manifestArtifact: SourceArtifactWithBuffer;
  summaryArtifact: SourceArtifactWithBuffer;
  receiptsArtifact: SourceArtifactWithBuffer;
  decisionsArtifact: SourceArtifactWithBuffer;
  pilotManifestArtifact: SourceArtifactWithBuffer;
  pilotSelectionArtifact: SourceArtifactWithBuffer;
  selectedPacketsArtifact: SourceArtifactWithBuffer;
  configurationArtifact: SourceArtifactWithBuffer;
  finalReviewArtifact: SourceArtifactWithBuffer;
  pilotManifest: FrenchCodexPilotBatchManifest;
  pilot: FrenchInternalPilotPlan;
  packets: readonly LexiconV3FrenchPacket[];
  finalReviews: readonly FrenchInternalReviewRecord[];
  generationConfigHash: string;
  finalReviewLogicalDigest: string;
  requestedGeneratedAt?: string;
  transitive: Map<string, FrenchPilotQualityGateSourceArtifact>;
}): VerifiedBlindReaudit {
  const manifest = parseJson<FrenchPilotBlindReauditManifest>(
    input.manifestArtifact,
    "blind-reaudit-manifest"
  );
  const { manifestHash, ...manifestContent } = manifest;
  const expectedSourcePaths = {
    pilotManifest: input.pilotManifestArtifact.path,
    pilotSelection: input.pilotSelectionArtifact.path,
    selectedPackets: input.selectedPacketsArtifact.path,
    configuration: input.configurationArtifact.path,
    finalReview: input.finalReviewArtifact.path
  };
  const expectedSourceDigests = {
    pilotManifest: input.pilotManifestArtifact.sha256,
    pilotSelection: input.pilotSelectionArtifact.sha256,
    selectedPackets: input.selectedPacketsArtifact.sha256,
    configuration: input.configurationArtifact.sha256,
    finalReview: input.finalReviewArtifact.sha256
  };
  if (
    manifest.schemaVersion !==
      FRENCH_PILOT_BLIND_REAUDIT_MANIFEST_SCHEMA_VERSION ||
    manifest.policyVersion !== FRENCH_PILOT_BLIND_REAUDIT_POLICY_VERSION ||
    manifest.namespace !== FRENCH_PILOT_BLIND_REAUDIT_NAMESPACE ||
    manifestHash !== hashFrenchInternalJson(manifestContent) ||
    manifest.lineage.releaseKey !== input.pilot.releaseKey ||
    manifest.lineage.releaseSnapshotFingerprint !==
      input.pilot.releaseSnapshotFingerprint ||
    manifest.lineage.sourceLogicalDigest !== input.pilot.sourceLogicalDigest ||
    manifest.lineage.pilotManifestHash !== input.pilotManifest.manifestHash ||
    manifest.lineage.pilotSelectionHash !== input.pilot.contentHash ||
    manifest.lineage.finalReviewLogicalDigest !==
      input.finalReviewLogicalDigest ||
    manifest.lineage.generationConfigHash !== input.generationConfigHash ||
    canonicalFrenchInternalJson(manifest.inputPolicy) !==
      canonicalFrenchInternalJson({
        sourceEnglishAndProtectedOnly: true,
        finalFrenchDisplayOnly: true,
        proposerOutputsForbidden: true,
        arbiterOutputForbidden: true,
        auditorOutputForbidden: true,
        priorReasonsAndVerdictsForbidden: true,
        historicalAndResourceFrenchForbidden: true
      }) ||
    canonicalFrenchInternalJson(manifest.sourcePaths) !==
      canonicalFrenchInternalJson(expectedSourcePaths) ||
    canonicalFrenchInternalJson(manifest.sourceDigests) !==
      canonicalFrenchInternalJson(expectedSourceDigests)
  ) {
    throw new Error("french-pilot-quality-gate-blind-manifest-invalid");
  }
  const packetByKey = new Map(
    input.packets.map((packet) => [packet.entryKey, packet])
  );
  const reviewByKey = new Map(
    input.finalReviews.map((review) => [review.entryKey, review])
  );
  const selectionByKey = new Map(
    input.pilot.selections.map((selection) => [selection.entryKey, selection])
  );
  const expectedSelection = buildFrenchPilotBlindReauditSelection({
    pilotSelectionHash: input.pilot.contentHash,
    finalReviewLogicalDigest: input.finalReviewLogicalDigest,
    population: input.pilot.keys.map((entryKey) => {
      const packet = packetByKey.get(entryKey)!;
      const review = reviewByKey.get(entryKey)!;
      return {
        entryKey,
        packetHash: packet.packetHash,
        englishHash: packet.english.contentHash,
        finalReviewArtifactHash: review.artifactHash,
        strata: selectionByKey.get(entryKey)!.strata
      };
    })
  });
  if (
    canonicalFrenchInternalJson(manifest.selection) !==
      canonicalFrenchInternalJson(expectedSelection) ||
    manifest.batches.length !== FRENCH_PILOT_BLIND_REAUDIT_SAMPLE_SIZE / 4 ||
    manifest.batches.flatMap((batch) => batch.keys).length !==
      FRENCH_PILOT_BLIND_REAUDIT_SAMPLE_SIZE ||
    canonicalFrenchInternalJson(
      manifest.batches.flatMap((batch) => batch.keys)
    ) !== canonicalFrenchInternalJson(manifest.selection.keys)
  ) {
    throw new Error("french-pilot-quality-gate-blind-selection-invalid");
  }
  const viewByKey = new Map<string, FrenchPilotBlindReauditView>();
  const batches = new Set<string>();
  for (const [batchIndex, batch] of manifest.batches.entries()) {
    const { batchHash, ...batchContent } = batch;
    const expectedBatchId = `blind-reaudit-${String(batchIndex + 1).padStart(
      3,
      "0"
    )}`;
    if (
      batch.batchId !== expectedBatchId ||
      batches.has(batch.batchId) ||
      batchHash !== hashFrenchInternalJson(batchContent) ||
      batch.keys.length !== 4 ||
      batch.keys.length !== batch.viewHashes.length ||
      new Set(batch.keys).size !== batch.keys.length ||
      resolve(batch.expectedRunPath) !==
        resolve(dirname(batch.input.path), "agent-run.json")
    ) {
      throw new Error(
        `french-pilot-quality-gate-blind-batch-invalid:${batch.batchId}`
      );
    }
    batches.add(batch.batchId);
    const batchInput = artifact(batch.input.path);
    const outputSchema = artifact(batch.outputSchema.path);
    if (
      batch.input.sha256 !== batchInput.sha256 ||
      batch.input.bytes !== batchInput.bytes ||
      batch.outputSchema.sha256 !== outputSchema.sha256 ||
      batch.outputSchema.bytes !== outputSchema.bytes
    ) {
      throw new Error(
        `french-pilot-quality-gate-blind-batch-source-stale:${batch.batchId}`
      );
    }
    addTransitive(
      input.transitive,
      `blind-reaudit:${batch.batchId}:input`,
      batchInput
    );
    addTransitive(
      input.transitive,
      `blind-reaudit:${batch.batchId}:schema`,
      outputSchema
    );
    const views = parseJsonl<FrenchPilotBlindReauditView>(
      batchInput,
      `blind-reaudit-${batch.batchId}-views`
    );
    if (views.length !== batch.keys.length) {
      throw new Error(
        `french-pilot-quality-gate-blind-view-coverage:${batch.batchId}`
      );
    }
    for (const [index, view] of views.entries()) {
      const entryKey = batch.keys[index]!;
      const packet = packetByKey.get(entryKey)!;
      const review = reviewByKey.get(entryKey)!;
      assertBlindView(view, packet, review, packetByKey, reviewByKey);
      if (
        view.entryKey !== entryKey ||
        view.viewHash !== batch.viewHashes[index] ||
        viewByKey.has(entryKey)
      ) {
        throw new Error(
          `french-pilot-quality-gate-blind-view-lineage:${entryKey}`
        );
      }
      viewByKey.set(entryKey, view);
    }
  }
  if (viewByKey.size !== FRENCH_PILOT_BLIND_REAUDIT_SAMPLE_SIZE) {
    throw new Error("french-pilot-quality-gate-blind-view-coverage");
  }

  const summary = parseJson<FrenchPilotBlindReauditSummary>(
    input.summaryArtifact,
    "blind-reaudit-summary"
  );
  const { summaryHash, ...summaryContent } = summary;
  const receipts = parseJsonl<FrenchPilotBlindReauditReceipt>(
    input.receiptsArtifact,
    "blind-reaudit-receipts"
  );
  const decisions = parseJsonl<FrenchPilotBlindReauditDecision>(
    input.decisionsArtifact,
    "blind-reaudit-decisions"
  );
  const receiptByEntry = new Map<string, FrenchPilotBlindReauditReceipt>();
  const decisionByEntry = new Map<string, FrenchPilotBlindReauditDecision>();
  const batchByKey = new Map(
    manifest.batches.flatMap((batch) =>
      batch.keys.map((entryKey) => [entryKey, batch] as const)
    )
  );
  for (const receipt of receipts) {
    const batch = batchByKey.get(receipt.entryKey);
    const view = viewByKey.get(receipt.entryKey);
    const review = reviewByKey.get(receipt.entryKey);
    const priorThreads = ROLES.map((role) => ({
      role,
      threadId: review?.executionAttestation?.roleReceipts[role].threadId ?? ""
    }));
    const priorAgents = ROLES.map((role) => ({
      role,
      agentId: review?.executionAttestation?.roleReceipts[role].agentId ?? ""
    }));
    const expectedTaskName = `${FRENCH_PILOT_BLIND_REAUDIT_NAMESPACE}/blindReauditor/${batch?.batchId ?? ""}`;
    if (
      !batch ||
      !view ||
      !review ||
      receipt.schemaVersion !==
        FRENCH_PILOT_BLIND_REAUDIT_RECEIPT_SCHEMA_VERSION ||
      receipt.policyVersion !== FRENCH_PILOT_BLIND_REAUDIT_POLICY_VERSION ||
      receipt.role !== "blindReauditor" ||
      receipt.namespace !== FRENCH_PILOT_BLIND_REAUDIT_NAMESPACE ||
      receipt.agentId !== `codex-agent:${receipt.threadId}` ||
      receipt.taskName !== expectedTaskName ||
      receipt.batchId !== batch.batchId ||
      receipt.manifestHash !== manifest.manifestHash ||
      receipt.selectionHash !== manifest.selection.selectionHash ||
      receipt.inputHash !== view.viewHash ||
      receipt.model !==
        FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.auditor.model ||
      receipt.reasoningEffort !==
        FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.auditor.reasoningEffort ||
      receipt.executorPolicyVersion !==
        FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.executorPolicyVersion ||
      receipt.executor.version !==
        FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.codexVersion ||
      receipt.executor.sha256 !==
        FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.codexSha256 ||
      receipt.capabilities.localTools !== "disabled" ||
      receipt.capabilities.networkDataTools !== "disabled" ||
      receipt.capabilities.shell !== "disabled" ||
      receipt.capabilities.eventPolicy !== "agent-message-only" ||
      receipt.capabilities.disabledFeaturesHash !==
        frenchCodexDisabledFeaturesHash() ||
      receipt.capabilities.environmentPolicyHash !==
        frenchCodexEnvironmentPolicyHash() ||
      resolve(receipt.capabilities.sealedWorkingDirectory) !==
        resolve(dirname(receipt.resultPaths.structuredResponse)) ||
      receipt.priorRoleThreadsDigest !== hashFrenchInternalJson(priorThreads) ||
      receipt.priorRoleAgentsDigest !== hashFrenchInternalJson(priorAgents) ||
      priorThreads.some(({ threadId }) => threadId === receipt.threadId) ||
      priorAgents.some(({ agentId }) => agentId === receipt.agentId) ||
      receipt.resultHashes.structuredResponse !== receipt.artifactHash ||
      receipt.receiptHash !== frenchPilotBlindReauditReceiptHash(receipt) ||
      receiptByEntry.has(receipt.entryKey)
    ) {
      throw new Error(
        `french-pilot-quality-gate-blind-receipt-invalid:${receipt.entryKey}`
      );
    }
    assertPinnedExecutionBinary(
      receipt.executor,
      input.transitive,
      "blind-reaudit:executor"
    );
    receiptByEntry.set(receipt.entryKey, receipt);
  }
  for (const decision of decisions) {
    const receipt = receiptByEntry.get(decision.entryKey);
    const view = viewByKey.get(decision.entryKey);
    if (
      !receipt ||
      !view ||
      decision.schemaVersion !==
        FRENCH_PILOT_BLIND_REAUDIT_DECISION_SCHEMA_VERSION ||
      decision.policyVersion !== FRENCH_PILOT_BLIND_REAUDIT_POLICY_VERSION ||
      decision.role !== "blindReauditor" ||
      decision.inputHash !== view.viewHash ||
      decision.verdict !== "safe" ||
      decision.reasons.length !== 0 ||
      decision.confidence < 0.9 ||
      !exactKeys(decision.checks, [
        "identityExact",
        "semanticCoverage",
        "noSemanticAddition",
        "noSemanticOmission",
        "polarityModalityUncertaintyPreserved",
        "glossMorphologyConform",
        "properNamesAndTermsConform",
        "protectedContentPreserved",
        "htmlStructurePreserved",
        "naturalFrench",
        "siblingStepConsistency"
      ]) ||
      Object.values(decision.checks).some((check) => check !== "pass") ||
      decision.agentId !== receipt.agentId ||
      decision.taskName !== receipt.taskName ||
      decision.threadId !== receipt.threadId ||
      decision.completedAt !== receipt.completedAt ||
      decision.receiptHash !== receipt.receiptHash ||
      decision.artifactHash !== frenchPilotBlindReauditDecisionHash(decision) ||
      decisionByEntry.has(decision.entryKey)
    ) {
      throw new Error(
        `french-pilot-quality-gate-blind-decision-invalid:${decision.entryKey}`
      );
    }
    decisionByEntry.set(decision.entryKey, decision);
  }
  assertBlindRunProofs({
    runs: summary.runs,
    manifest,
    viewByKey,
    receiptByEntry,
    decisionByEntry,
    sourceHashes: {
      manifest: input.manifestArtifact.sha256,
      pilotManifest: input.pilotManifestArtifact.sha256,
      pilotSelection: input.pilotSelectionArtifact.sha256,
      selectedPackets: input.selectedPacketsArtifact.sha256,
      configuration: input.configurationArtifact.sha256,
      finalReview: input.finalReviewArtifact.sha256
    },
    sourcePaths: {
      manifest: input.manifestArtifact.path,
      pilotManifest: input.pilotManifestArtifact.path,
      pilotSelection: input.pilotSelectionArtifact.path,
      selectedPackets: input.selectedPacketsArtifact.path,
      configuration: input.configurationArtifact.path,
      finalReview: input.finalReviewArtifact.path
    },
    transitive: input.transitive
  });
  if (
    canonicalFrenchInternalJson([...receiptByEntry.keys()]) !==
      canonicalFrenchInternalJson(manifest.selection.keys) ||
    canonicalFrenchInternalJson([...decisionByEntry.keys()]) !==
      canonicalFrenchInternalJson(manifest.selection.keys)
  ) {
    throw new Error("french-pilot-quality-gate-blind-output-order-invalid");
  }
  const receiptsLogicalDigest = hashFrenchInternalJson(
    manifest.selection.keys.map((entryKey) => ({
      entryKey,
      receiptHash: receiptByEntry.get(entryKey)!.receiptHash
    }))
  );
  const decisionsLogicalDigest = hashFrenchInternalJson(
    manifest.selection.keys.map((entryKey) => ({
      entryKey,
      verdict: decisionByEntry.get(entryKey)!.verdict,
      artifactHash: decisionByEntry.get(entryKey)!.artifactHash
    }))
  );
  const runHashesDigest = hashFrenchInternalJson(
    manifest.batches.map((batch) => {
      const receipt = receiptByEntry.get(batch.keys[0]!)!;
      if (
        batch.keys.some((entryKey) => {
          const candidate = receiptByEntry.get(entryKey)!;
          return (
            candidate.threadId !== receipt.threadId ||
            candidate.runHash !== receipt.runHash
          );
        })
      ) {
        throw new Error(
          `french-pilot-quality-gate-blind-batch-run-split:${batch.batchId}`
        );
      }
      return {
        batchId: batch.batchId,
        threadId: receipt.threadId,
        runHash: receipt.runHash
      };
    })
  );
  const freshnessProofDigest = hashFrenchInternalJson(
    manifest.selection.keys.map((entryKey) => {
      const receipt = receiptByEntry.get(entryKey)!;
      return {
        entryKey,
        priorRoleAgentsDigest: receipt.priorRoleAgentsDigest,
        priorRoleThreadsDigest: receipt.priorRoleThreadsDigest,
        agentId: receipt.agentId,
        threadId: receipt.threadId
      };
    })
  );
  const distinctThreads = new Set(receipts.map((receipt) => receipt.threadId))
    .size;
  const distinctAgents = new Set(receipts.map((receipt) => receipt.agentId))
    .size;
  if (
    summary.schemaVersion !==
      FRENCH_PILOT_BLIND_REAUDIT_SUMMARY_SCHEMA_VERSION ||
    summary.policyVersion !== FRENCH_PILOT_BLIND_REAUDIT_POLICY_VERSION ||
    summary.namespace !== FRENCH_PILOT_BLIND_REAUDIT_NAMESPACE ||
    summaryHash !== hashFrenchInternalJson(summaryContent) ||
    summary.manifestHash !== manifest.manifestHash ||
    summary.manifestFileHash !== input.manifestArtifact.sha256 ||
    summary.selectionHash !== manifest.selection.selectionHash ||
    canonicalFrenchInternalJson(summary.profile) !==
      canonicalFrenchInternalJson(
        FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.auditor
      ) ||
    summary.coverage !== "exact" ||
    summary.counts.population !== 300 ||
    summary.counts.sampled !== FRENCH_PILOT_BLIND_REAUDIT_SAMPLE_SIZE ||
    summary.counts.batches !== manifest.batches.length ||
    summary.counts.receipts !== FRENCH_PILOT_BLIND_REAUDIT_SAMPLE_SIZE ||
    summary.counts.decisions !== FRENCH_PILOT_BLIND_REAUDIT_SAMPLE_SIZE ||
    summary.counts.safe !== FRENCH_PILOT_BLIND_REAUDIT_SAMPLE_SIZE ||
    summary.counts.hold !== 0 ||
    summary.counts.block !== 0 ||
    summary.counts.violations !== 0 ||
    summary.counts.distinctAgentIds !== distinctAgents ||
    distinctAgents !== manifest.batches.length ||
    summary.counts.distinctAgentThreads !== distinctThreads ||
    distinctThreads !== manifest.batches.length ||
    summary.counts.freshAgainstPriorAgents !==
      FRENCH_PILOT_BLIND_REAUDIT_SAMPLE_SIZE ||
    summary.counts.freshAgainstPriorThreads !==
      FRENCH_PILOT_BLIND_REAUDIT_SAMPLE_SIZE ||
    !outputMatches(
      summary.outputs.receipts,
      input.receiptsArtifact,
      FRENCH_PILOT_BLIND_REAUDIT_SAMPLE_SIZE,
      receiptsLogicalDigest
    ) ||
    !outputMatches(
      summary.outputs.decisions,
      input.decisionsArtifact,
      FRENCH_PILOT_BLIND_REAUDIT_SAMPLE_SIZE,
      decisionsLogicalDigest
    ) ||
    summary.runHashesDigest !== runHashesDigest ||
    summary.freshnessProofDigest !== freshnessProofDigest
  ) {
    throw new Error("french-pilot-quality-gate-blind-summary-invalid");
  }
  const generatedAt = resolveFrenchPilotQualityGateGeneratedAt(
    {
      blindReauditSummaryGeneratedAt: summary.generatedAt,
      blindReceiptCompletedAts: receipts.map((receipt) => receipt.completedAt)
    },
    input.requestedGeneratedAt
  );
  return {
    generatedAt,
    content: {
      status: "passed",
      sampleSize: FRENCH_PILOT_BLIND_REAUDIT_SAMPLE_SIZE,
      safe: FRENCH_PILOT_BLIND_REAUDIT_SAMPLE_SIZE,
      hold: 0,
      block: 0,
      violations: 0,
      freshAgainstPriorAgents: FRENCH_PILOT_BLIND_REAUDIT_SAMPLE_SIZE,
      freshAgainstPriorThreads: FRENCH_PILOT_BLIND_REAUDIT_SAMPLE_SIZE,
      manifestHash: manifest.manifestHash,
      selectionHash: manifest.selection.selectionHash,
      summaryHash: summary.summaryHash,
      receiptsLogicalDigest,
      decisionsLogicalDigest,
      strata: manifest.selection.strataCounts
    }
  };
}

function assertBlindRunProofs(input: {
  runs: FrenchPilotBlindReauditSummary["runs"];
  manifest: FrenchPilotBlindReauditManifest;
  viewByKey: ReadonlyMap<string, FrenchPilotBlindReauditView>;
  receiptByEntry: ReadonlyMap<string, FrenchPilotBlindReauditReceipt>;
  decisionByEntry: ReadonlyMap<string, FrenchPilotBlindReauditDecision>;
  sourceHashes: {
    manifest: string;
    pilotManifest: string;
    pilotSelection: string;
    selectedPackets: string;
    configuration: string;
    finalReview: string;
  };
  sourcePaths: {
    manifest: string;
    pilotManifest: string;
    pilotSelection: string;
    selectedPackets: string;
    configuration: string;
    finalReview: string;
  };
  transitive: Map<string, FrenchPilotQualityGateSourceArtifact>;
}): void {
  if (
    !Array.isArray(input.runs) ||
    input.runs.length !== input.manifest.batches.length ||
    input.runs.some(
      (run, index) => run.batchId !== input.manifest.batches[index]?.batchId
    )
  ) {
    throw new Error("french-pilot-quality-gate-blind-runs-coverage");
  }
  for (const [index, proof] of input.runs.entries()) {
    const batch = input.manifest.batches[index]!;
    if (
      !exactKeys(proof, [
        "batchId",
        "pointer",
        "runHash",
        "resultPaths",
        "resultHashes"
      ]) ||
      !exactKeys(proof.pointer, ["path", "sha256", "bytes"]) ||
      !exactKeys(proof.resultPaths, [
        "agentEvents",
        "agentStderr",
        "structuredResponse"
      ]) ||
      !exactKeys(proof.resultHashes, [
        "agentEvents",
        "agentStderr",
        "structuredResponse"
      ]) ||
      resolve(proof.pointer.path) !== resolve(batch.expectedRunPath)
    ) {
      throw new Error(
        `french-pilot-quality-gate-blind-run-proof-invalid:${batch.batchId}`
      );
    }
    const pointer = artifact(proof.pointer.path);
    if (
      pointer.sha256 !== proof.pointer.sha256 ||
      pointer.bytes !== proof.pointer.bytes
    ) {
      throw new Error(
        `french-pilot-quality-gate-blind-run-pointer-stale:${batch.batchId}`
      );
    }
    addTransitive(
      input.transitive,
      `blind-reaudit:${batch.batchId}:runPointer`,
      pointer
    );
    const run = parseJson<BlindReauditRunPointer>(
      pointer,
      `blind-reaudit-${batch.batchId}-run`
    );
    const { runHash, ...runContent } = run;
    const receipts = batch.keys.map((entryKey) => {
      const receipt = input.receiptByEntry.get(entryKey);
      if (!receipt) {
        throw new Error(
          `french-pilot-quality-gate-blind-run-receipt-missing:${entryKey}`
        );
      }
      return receipt;
    });
    const firstReceipt = receipts[0]!;
    const views = batch.keys.map((entryKey) => input.viewByKey.get(entryKey)!);
    const expectedSourceHashes = {
      manifest: input.sourceHashes.manifest,
      batch: batch.batchHash,
      input: batch.input.sha256,
      outputSchema: batch.outputSchema.sha256,
      pilotManifest: input.sourceHashes.pilotManifest,
      pilotSelection: input.sourceHashes.pilotSelection,
      selectedPackets: input.sourceHashes.selectedPackets,
      configuration: input.sourceHashes.configuration,
      finalReview: input.sourceHashes.finalReview
    };
    const expectedSourcePaths = {
      manifest: resolve(input.sourcePaths.manifest),
      input: resolve(batch.input.path),
      outputSchema: resolve(batch.outputSchema.path),
      pilotManifest: resolve(input.sourcePaths.pilotManifest),
      pilotSelection: resolve(input.sourcePaths.pilotSelection),
      selectedPackets: resolve(input.sourcePaths.selectedPackets),
      configuration: resolve(input.sourcePaths.configuration),
      finalReview: resolve(input.sourcePaths.finalReview),
      runPointer: resolve(proof.pointer.path)
    };
    const expectedReceiptSourceHashes = {
      manifest: expectedSourceHashes.manifest,
      input: expectedSourceHashes.input,
      outputSchema: expectedSourceHashes.outputSchema,
      pilotManifest: expectedSourceHashes.pilotManifest,
      pilotSelection: expectedSourceHashes.pilotSelection,
      selectedPackets: expectedSourceHashes.selectedPackets,
      configuration: expectedSourceHashes.configuration,
      finalReview: expectedSourceHashes.finalReview,
      runPointer: pointer.sha256
    };
    const expectedTaskName = `${input.manifest.namespace}/blindReauditor/${batch.batchId}`;
    if (
      !exactKeys(run, [
        "schemaVersion",
        "runtimePolicyVersion",
        "namespace",
        "batchId",
        "manifestHash",
        "selectionHash",
        "batchHash",
        "taskName",
        "agentId",
        "threadId",
        "model",
        "reasoningEffort",
        "executorPolicyVersion",
        "executor",
        "capabilities",
        "startedAt",
        "completedAt",
        "promptHash",
        "sourceHashes",
        "resultPaths",
        "resultHashes",
        "counts",
        "usage",
        "runHash"
      ]) ||
      run.schemaVersion !== "lexicon-v3-french-pilot-blind-reaudit-run@1" ||
      run.runtimePolicyVersion !==
        FRENCH_BLIND_REAUDIT_RUNTIME_POLICY_VERSION ||
      run.namespace !== input.manifest.namespace ||
      run.batchId !== batch.batchId ||
      run.manifestHash !== input.manifest.manifestHash ||
      run.selectionHash !== input.manifest.selection.selectionHash ||
      run.batchHash !== batch.batchHash ||
      run.taskName !== expectedTaskName ||
      run.agentId !== `codex-agent:${run.threadId}` ||
      run.model !== FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.auditor.model ||
      run.reasoningEffort !==
        FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.auditor.reasoningEffort ||
      run.executorPolicyVersion !==
        FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.executorPolicyVersion ||
      canonicalFrenchInternalJson(run.executor) !==
        canonicalFrenchInternalJson(firstReceipt.executor) ||
      canonicalFrenchInternalJson(run.capabilities) !==
        canonicalFrenchInternalJson(firstReceipt.capabilities) ||
      !Number.isFinite(Date.parse(run.startedAt)) ||
      !Number.isFinite(Date.parse(run.completedAt)) ||
      Date.parse(run.startedAt) > Date.parse(run.completedAt) ||
      run.promptHash !==
        sha256(
          buildFrenchBlindReauditPrompt({
            namespace: input.manifest.namespace,
            batchId: batch.batchId,
            views
          })
        ) ||
      canonicalFrenchInternalJson(run.sourceHashes) !==
        canonicalFrenchInternalJson(expectedSourceHashes) ||
      canonicalFrenchInternalJson(run.resultPaths) !==
        canonicalFrenchInternalJson(proof.resultPaths) ||
      canonicalFrenchInternalJson(run.resultHashes) !==
        canonicalFrenchInternalJson(proof.resultHashes) ||
      run.counts.expected !== batch.keys.length ||
      run.counts.decisions !== batch.keys.length ||
      runHash !== proof.runHash ||
      runHash !== hashFrenchInternalJson(runContent) ||
      receipts.some(
        (receipt) =>
          receipt.threadId !== run.threadId ||
          receipt.agentId !== run.agentId ||
          receipt.taskName !== run.taskName ||
          receipt.startedAt !== run.startedAt ||
          receipt.completedAt !== run.completedAt ||
          receipt.runHash !== run.runHash ||
          canonicalFrenchInternalJson(receipt.sourcePaths) !==
            canonicalFrenchInternalJson(expectedSourcePaths) ||
          canonicalFrenchInternalJson(receipt.sourceHashes) !==
            canonicalFrenchInternalJson(expectedReceiptSourceHashes) ||
          canonicalFrenchInternalJson(receipt.resultPaths) !==
            canonicalFrenchInternalJson(run.resultPaths) ||
          canonicalFrenchInternalJson(receipt.executor) !==
            canonicalFrenchInternalJson(run.executor) ||
          canonicalFrenchInternalJson(receipt.capabilities) !==
            canonicalFrenchInternalJson(run.capabilities) ||
          canonicalFrenchInternalJson(receipt.resultHashes) !==
            canonicalFrenchInternalJson(run.resultHashes)
      )
    ) {
      throw new Error(
        `french-pilot-quality-gate-blind-run-invalid:${batch.batchId}`
      );
    }
    const resultArtifacts = Object.fromEntries(
      (["agentEvents", "agentStderr", "structuredResponse"] as const).map(
        (label) => {
          const result = artifact(run.resultPaths[label]);
          if (result.sha256 !== run.resultHashes[label]) {
            throw new Error(
              `french-pilot-quality-gate-blind-result-stale:${batch.batchId}:${label}`
            );
          }
          addTransitive(
            input.transitive,
            `blind-reaudit:${batch.batchId}:${label}`,
            result
          );
          return [label, result] as const;
        }
      )
    ) as Record<
      "agentEvents" | "agentStderr" | "structuredResponse",
      SourceArtifactWithBuffer
    >;
    const responseText =
      resultArtifacts.structuredResponse.buffer.toString("utf8");
    const events = parseFrenchCodexAgentEvents(
      resultArtifacts.agentEvents.buffer.toString("utf8"),
      responseText
    );
    if (events.threadId !== run.threadId) {
      throw new Error(
        `french-pilot-quality-gate-blind-events-thread:${batch.batchId}`
      );
    }
    const rawDecisions = parseFrenchBlindReauditAgentResponse({
      responseText,
      views
    }).decisions;
    for (const rawDecision of rawDecisions) {
      assertBlindPublishedDecision({
        rawDecision,
        receipt: input.receiptByEntry.get(rawDecision.entryKey)!,
        published: input.decisionByEntry.get(rawDecision.entryKey)
      });
    }
  }
}

function assertBlindPublishedDecision(input: {
  rawDecision: FrenchBlindReauditAgentDecision;
  receipt: FrenchPilotBlindReauditReceipt;
  published: FrenchPilotBlindReauditDecision | undefined;
}): void {
  const content = frenchBlindReauditDecisionEnvelope({
    decision: input.rawDecision,
    agentId: input.receipt.agentId,
    taskName: input.receipt.taskName,
    threadId: input.receipt.threadId,
    completedAt: input.receipt.completedAt,
    receiptHash: input.receipt.receiptHash
  });
  const expected: FrenchPilotBlindReauditDecision = {
    ...content,
    artifactHash: frenchPilotBlindReauditDecisionHash(content)
  };
  if (
    !input.published ||
    canonicalFrenchInternalJson(input.published) !==
      canonicalFrenchInternalJson(expected)
  ) {
    throw new Error(
      `french-pilot-quality-gate-blind-published-decision:${input.rawDecision.entryKey}`
    );
  }
}

function assertBlindView(
  view: FrenchPilotBlindReauditView,
  packet: LexiconV3FrenchPacket,
  review: FrenchInternalReviewRecord,
  packetByKey: ReadonlyMap<string, LexiconV3FrenchPacket>,
  reviewByKey: ReadonlyMap<string, FrenchInternalReviewRecord>
): void {
  const { viewHash, ...content } = view;
  const proposal = review.arbiter?.proposal;
  const familyKey = frenchInternalSiblingFamilyKey(packet);
  const siblingMembers = [...packetByKey.values()]
    .filter(
      (candidate) => frenchInternalSiblingFamilyKey(candidate) === familyKey
    )
    .sort((left, right) => left.entryKey.localeCompare(right.entryKey))
    .map((candidate) => {
      const candidateProposal = reviewByKey.get(candidate.entryKey)?.arbiter
        ?.proposal;
      if (!candidateProposal) {
        throw new Error(
          `french-pilot-quality-gate-blind-sibling-review-missing:${candidate.entryKey}`
        );
      }
      return {
        entryKey: candidate.entryKey,
        identity: candidate.identity,
        english: candidate.english,
        finalFrench: {
          glossFr: candidateProposal.glossFr,
          meaningFr: candidateProposal.meaningFr,
          meaningHtmlFr: candidateProposal.meaningHtmlFr,
          notesFr: candidateProposal.notesFr,
          carrierTermsFr: candidateProposal.carrierTermsFr
        }
      };
    });
  if (
    !proposal ||
    view.schemaVersion !== FRENCH_PILOT_BLIND_REAUDIT_VIEW_SCHEMA_VERSION ||
    view.policyVersion !== FRENCH_PILOT_BLIND_REAUDIT_POLICY_VERSION ||
    view.role !== "blindReauditor" ||
    view.entryKey !== packet.entryKey ||
    view.packetHash !== packet.packetHash ||
    view.englishHash !== packet.english.contentHash ||
    view.finalReviewArtifactHash !== review.artifactHash ||
    canonicalFrenchInternalJson(view.source) !==
      canonicalFrenchInternalJson({
        identity: packet.identity,
        english: packet.english,
        protectedContent: packet.protectedContent
      }) ||
    canonicalFrenchInternalJson(view.finalFrench) !==
      canonicalFrenchInternalJson({
        glossFr: proposal.glossFr,
        meaningFr: proposal.meaningFr,
        meaningHtmlFr: proposal.meaningHtmlFr,
        notesFr: proposal.notesFr,
        carrierTermsFr: proposal.carrierTermsFr
      }) ||
    canonicalFrenchInternalJson(view.siblingContext) !==
      canonicalFrenchInternalJson({
        scope: "selected-pilot-family-members",
        familyKey,
        members: siblingMembers
      }) ||
    canonicalFrenchInternalJson(view.exposurePolicy) !==
      canonicalFrenchInternalJson({
        proposerOutputsExposed: false,
        arbiterOutputExposed: false,
        auditorOutputExposed: false,
        priorReasonsExposed: false,
        priorVerdictsExposed: false,
        historicalFrenchExposed: false,
        resourceFrenchExposed: false
      }) ||
    viewHash !== hashFrenchInternalJson(content) ||
    !exactKeys(view, [
      "schemaVersion",
      "policyVersion",
      "role",
      "entryKey",
      "packetHash",
      "englishHash",
      "finalReviewArtifactHash",
      "source",
      "finalFrench",
      "siblingContext",
      "exposurePolicy",
      "viewHash"
    ])
  ) {
    throw new Error(
      `french-pilot-quality-gate-blind-view-invalid:${view.entryKey}`
    );
  }
}

function outputMatches(
  output: {
    path: string;
    sha256: string;
    bytes: number;
    records: number;
    logicalDigest: string;
  },
  source: SourceArtifactWithBuffer,
  records: number,
  logicalDigest: string
): boolean {
  return (
    resolve(output.path) === resolve(source.path) &&
    output.sha256 === source.sha256 &&
    output.bytes === source.bytes &&
    output.records === records &&
    output.logicalDigest === logicalDigest
  );
}

function exactKeys(value: object, expected: readonly string[]): boolean {
  return (
    canonicalFrenchInternalJson(Object.keys(value).sort()) ===
    canonicalFrenchInternalJson([...expected].sort())
  );
}

function assertFinalReviews(input: {
  reviews: FrenchInternalReviewRecord[];
  packetByKey: Map<string, LexiconV3FrenchPacket>;
  pilot: FrenchInternalPilotPlan;
  generationConfigHash: string;
  executionClosures: ExecutionRunClosure[];
  receipts: Map<string, FrenchInternalExecutionReceipt>;
}): {
  strata: Record<string, Record<string, FrenchPilotQualityGateStratumMetric>>;
} {
  assertReviewCoverage(
    input.reviews,
    input.packetByKey,
    input.generationConfigHash,
    true,
    "final"
  );
  const closureByIdentity = new Map(
    input.executionClosures.map((closure) => [
      executionClosureIdentity(closure),
      closure
    ])
  );
  const selectionByKey = new Map(
    input.pilot.selections.map((selection) => [selection.entryKey, selection])
  );
  const strata = new Map<string, Map<string, QualityAccumulator>>();
  for (const review of input.reviews) {
    const packet = input.packetByKey.get(review.entryKey)!;
    const selection = selectionByKey.get(review.entryKey);
    const attestation = review.executionAttestation;
    if (!selection || !attestation) {
      throw new Error(
        `french-pilot-quality-gate-final-proof-missing:${review.entryKey}`
      );
    }
    const closure = closureByIdentity.get(
      executionAttestationIdentity(attestation)
    );
    if (!closure) {
      throw new Error(
        `french-pilot-quality-gate-final-attestation-unbound:${review.entryKey}`
      );
    }
    const entryReceipts = ROLES.map((role) => {
      const embedded = attestation.roleReceipts[role];
      const exact = input.receipts.get(`${embedded.receiptHash}`);
      if (
        !exact ||
        canonicalFrenchInternalJson(exact) !==
          canonicalFrenchInternalJson(embedded)
      ) {
        throw new Error(
          `french-pilot-quality-gate-final-receipt-unbound:${review.entryKey}:${role}`
        );
      }
      return exact;
    });
    if (
      new Set(entryReceipts.map((receipt) => receipt.role)).size !== 4 ||
      new Set(entryReceipts.map((receipt) => receipt.agentId)).size !== 4 ||
      new Set(entryReceipts.map((receipt) => receipt.threadId)).size !== 4
    ) {
      throw new Error(
        `french-pilot-quality-gate-final-role-separation:${review.entryKey}`
      );
    }
    const evaluation = evaluateFrenchInternalReview({
      record: review,
      packet,
      expectedGenerationConfigHash: input.generationConfigHash
    });
    if (
      review.status !== "auto_validated" ||
      !evaluation.structurallyValid ||
      !evaluation.autoEligible ||
      evaluation.structuralIssues.length > 0 ||
      evaluation.autoEligibilityIssues.length > 0 ||
      review.auditor?.verdict !== "safe" ||
      review.siblingConsistency?.verdict !== "consistent"
    ) {
      throw new Error(
        `french-pilot-quality-gate-final-review-not-clean:${review.entryKey}`
      );
    }
    addStrataMetrics(strata, selection.strata, {
      selected: 1,
      autoValidated: 1,
      validatorClean: 1,
      auditorSafe: 1,
      siblingConsistent: 1
    });
  }
  assertSiblingFamilies(input.reviews, input.packetByKey);
  const rendered = Object.fromEntries(
    [...strata.entries()].map(([dimension, values]) => [
      dimension,
      Object.fromEntries(
        [...values.entries()]
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([value, metric]) => [
            value,
            {
              ...metric,
              passRate:
                metric.selected === 0
                  ? 0
                  : metric.autoValidated / metric.selected
            }
          ])
      )
    ])
  );
  return { strata: rendered };
}

function assertReviewCoverage(
  reviews: readonly FrenchInternalReviewRecord[],
  packetByKey: Map<string, LexiconV3FrenchPacket>,
  generationConfigHash: string,
  requireAuto: boolean,
  label: string
): void {
  if (
    reviews.length !== FRENCH_PILOT_QUALITY_GATE_EXPECTED_ENTRIES ||
    new Set(reviews.map((review) => review.entryKey)).size !== reviews.length ||
    reviews.some((review) => !packetByKey.has(review.entryKey))
  ) {
    throw new Error(`french-pilot-quality-gate-${label}-coverage-invalid`);
  }
  for (const review of reviews) {
    const evaluation = evaluateFrenchInternalReview({
      record: review,
      packet: packetByKey.get(review.entryKey)!,
      expectedGenerationConfigHash: generationConfigHash
    });
    if (
      !evaluation.structurallyValid ||
      (requireAuto &&
        (!evaluation.autoEligible || review.status !== "auto_validated"))
    ) {
      throw new Error(
        `french-pilot-quality-gate-${label}-review-invalid:${review.entryKey}`
      );
    }
  }
}

function assertSiblingFamilies(
  reviews: readonly FrenchInternalReviewRecord[],
  packetByKey: Map<string, LexiconV3FrenchPacket>
): void {
  const families = new Map<string, string[]>();
  for (const [entryKey, packet] of packetByKey) {
    const familyKey = frenchInternalSiblingFamilyKey(packet);
    const members = families.get(familyKey) ?? [];
    members.push(entryKey);
    families.set(familyKey, members);
  }
  for (const review of reviews) {
    const proof = review.siblingConsistency!;
    const expectedMembers = [...(families.get(proof.familyKey) ?? [])].sort();
    const actualMembers = [...proof.memberEntryKeys].sort();
    if (
      canonicalFrenchInternalJson(actualMembers) !==
      canonicalFrenchInternalJson(expectedMembers)
    ) {
      throw new Error(
        `french-pilot-quality-gate-sibling-family-coverage:${review.entryKey}`
      );
    }
  }
}

function addStrataMetrics(
  output: Map<string, Map<string, QualityAccumulator>>,
  strata: FrenchInternalWorkStrata,
  delta: QualityAccumulator
): void {
  const dimensions: Array<[string, string[]]> = [
    ["language", [strata.language]],
    ["meaningCohort", [strata.meaningCohort]],
    ["position", [strata.pos]],
    ["properName", [String(strata.properName)]],
    ["theological", [String(strata.theological)]],
    ["legacyHtmlCategory", [strata.legacyHtmlCategory]],
    ["meaningSize", [strata.meaningSize]],
    [
      "riskCategory",
      strata.riskCategories.length > 0 ? [...strata.riskCategories] : ["none"]
    ]
  ];
  for (const [dimension, values] of dimensions) {
    const groups =
      output.get(dimension) ?? new Map<string, QualityAccumulator>();
    for (const value of values) {
      const current = groups.get(value) ?? {
        selected: 0,
        autoValidated: 0,
        validatorClean: 0,
        auditorSafe: 0,
        siblingConsistent: 0
      };
      groups.set(value, {
        selected: current.selected + delta.selected,
        autoValidated: current.autoValidated + delta.autoValidated,
        validatorClean: current.validatorClean + delta.validatorClean,
        auditorSafe: current.auditorSafe + delta.auditorSafe,
        siblingConsistent: current.siblingConsistent + delta.siblingConsistent
      });
    }
    output.set(dimension, groups);
  }
}

function assertPilot(
  pilot: FrenchInternalPilotPlan,
  manifest: FrenchCodexPilotBatchManifest
): void {
  const { contentHash, ...content } = pilot;
  const orderedManifestKeys = manifest.batches.flatMap((batch) => batch.keys);
  if (
    pilot.schemaVersion !== FRENCH_INTERNAL_PILOT_SCHEMA_VERSION ||
    pilot.policyVersion !== FRENCH_INTERNAL_WORK_POLICY_VERSION ||
    pilot.pilotSize !== FRENCH_PILOT_QUALITY_GATE_EXPECTED_ENTRIES ||
    pilot.keys.length !== pilot.pilotSize ||
    pilot.selections.length !== pilot.pilotSize ||
    new Set(pilot.keys).size !== pilot.pilotSize ||
    contentHash !== hashFrenchInternalWorkJson(content) ||
    pilot.releaseKey !== manifest.lineage.releaseKey ||
    pilot.releaseSnapshotFingerprint !==
      manifest.lineage.releaseSnapshotFingerprint ||
    pilot.sourceLogicalDigest !== manifest.lineage.sourceLogicalDigest ||
    pilot.keys.some((key, index) => key !== orderedManifestKeys[index]) ||
    pilot.selections.some(
      (selection, index) =>
        selection.entryKey !== pilot.keys[index] ||
        selection.lineage.releaseKey !== pilot.releaseKey ||
        selection.lineage.releaseSnapshotFingerprint !==
          pilot.releaseSnapshotFingerprint ||
        selection.lineage.sourceLogicalDigest !== pilot.sourceLogicalDigest
    )
  ) {
    throw new Error("french-pilot-quality-gate-pilot-selection-invalid");
  }
}

function assertPackets(
  packets: readonly LexiconV3FrenchPacket[],
  pilot: FrenchInternalPilotPlan,
  manifest: FrenchCodexPilotBatchManifest
): void {
  if (
    packets.length !== FRENCH_PILOT_QUALITY_GATE_EXPECTED_ENTRIES ||
    new Set(packets.map((packet) => packet.entryKey)).size !== packets.length ||
    packets.some((packet, index) => {
      const issues = validateFrenchPacket(packet);
      return (
        issues.length > 0 ||
        packet.schemaVersion !== FRENCH_PACKET_SCHEMA_VERSION ||
        packet.entryKey !== pilot.keys[index] ||
        packet.englishRelease.releaseKey !== manifest.lineage.releaseKey ||
        packet.englishRelease.releaseSnapshotFingerprint !==
          manifest.lineage.releaseSnapshotFingerprint ||
        packet.packetHash !== pilot.selections[index]?.lineage.packetHash ||
        packet.english.contentHash !==
          pilot.selections[index]?.lineage.englishHash
      );
    }) ||
    frenchCodexSelectedPacketsLogicalDigest(packets) !==
      manifest.selectedPackets.logicalDigest
  ) {
    throw new Error("french-pilot-quality-gate-packets-invalid");
  }
}

function assertConfiguration(
  configuration: FrenchInternalAssemblyConfigurationFile
): void {
  validateFrenchInternalAssemblyConfiguration(configuration);
  if (
    configuration.schemaVersion !==
      FRENCH_INTERNAL_ASSEMBLY_CONFIG_SCHEMA_VERSION ||
    canonicalFrenchInternalJson(
      configuration.configuration.approvedExecutionProfile
    ) !==
      canonicalFrenchInternalJson(FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE) ||
    frenchInternalGenerationConfigHash(configuration.configuration) !==
      configuration.generationConfigHash
  ) {
    throw new Error("french-pilot-quality-gate-configuration-invalid");
  }
}

function assertPilotEntityArtifacts(input: {
  configuration: FrenchInternalAssemblyConfigurationFile;
  artifacts: {
    canonicalEntities: SourceArtifactWithBuffer;
    canonicalEntryPolicies: SourceArtifactWithBuffer;
    entityMergeAttestation: SourceArtifactWithBuffer;
    entityGate: SourceArtifactWithBuffer;
    entityMentions: SourceArtifactWithBuffer;
    entityMentionResolutionAttestation: SourceArtifactWithBuffer;
    entityPackets: SourceArtifactWithBuffer;
  };
  selectedPackets: readonly LexiconV3FrenchPacket[];
}): void {
  const expected = input.configuration.configuration;
  for (const [key, actual] of [
    ["canonicalEntitiesHash", input.artifacts.canonicalEntities.sha256],
    [
      "canonicalEntryPoliciesHash",
      input.artifacts.canonicalEntryPolicies.sha256
    ],
    [
      "entityMergeAttestationHash",
      input.artifacts.entityMergeAttestation.sha256
    ],
    ["entityGateHash", input.artifacts.entityGate.sha256],
    ["entityMentionsHash", input.artifacts.entityMentions.sha256]
  ] as const) {
    if (expected[key] !== actual) {
      throw new Error(`french-pilot-quality-gate-entity-artifact-drift:${key}`);
    }
  }
  const canonicalEntities = parseJsonl<FrenchCanonicalEntityRecord>(
    input.artifacts.canonicalEntities,
    "canonical-entities"
  );
  const canonicalEntryPolicies = parseJsonl<FrenchCanonicalEntryNamePolicy>(
    input.artifacts.canonicalEntryPolicies,
    "canonical-entry-policies"
  );
  const entityGate = parseJson<FrenchEntityCanonicalizationGateResult>(
    input.artifacts.entityGate,
    "entity-gate"
  );
  const entityMentions = parseJson<FrenchEntityMentionsArtifact>(
    input.artifacts.entityMentions,
    "entity-mentions"
  );
  const entityMentionResolutionAttestation =
    parseJson<FrenchEntityMentionResolutionAttestation>(
      input.artifacts.entityMentionResolutionAttestation,
      "entity-mention-resolution-attestation"
    );
  const entityPackets = parseJsonl<LexiconV3FrenchPacket>(
    input.artifacts.entityPackets,
    "entity-packets"
  );
  const mergeReplay = assertFrenchEntityMergeAttestationAtPath({
    attestationPath: input.artifacts.entityMergeAttestation.path,
    canonicalEntitiesPath: input.artifacts.canonicalEntities.path,
    canonicalEntryPoliciesPath: input.artifacts.canonicalEntryPolicies.path,
    expectedReleaseKey: input.selectedPackets[0]?.englishRelease.releaseKey
  });
  assertFrenchEntityPipelineArtifacts({
    entityGate,
    entityMentions,
    canonicalEntities,
    canonicalEntryPolicies,
    packets: entityPackets,
    quarantinedEntryKeys: frenchEntityQuarantinedEntryKeysFromMerge({
      plan: mergeReplay.plan,
      merged: mergeReplay.merged
    }),
    mentionResolutionAttestation: entityMentionResolutionAttestation,
    allowConfigurationPinnedResolution: true
  });
  const entityPacketByKey = new Map(
    entityPackets.map((packet) => [packet.entryKey, packet])
  );
  if (entityPacketByKey.size !== entityPackets.length) {
    throw new Error("french-pilot-quality-gate-entity-packet-duplicate");
  }
  for (const packet of input.selectedPackets) {
    if (
      entityPacketByKey.get(packet.entryKey)?.packetHash !== packet.packetHash
    ) {
      throw new Error(
        `french-pilot-quality-gate-entity-packet-selection-drift:${packet.entryKey}`
      );
    }
  }
}

function assertProposerSummary(
  summary: FrenchCodexProposerSummary,
  manifest: FrenchCodexPilotBatchManifest,
  context: ReturnType<typeof assertFrenchCodexAnyBatchManifest>
): void {
  const { summaryHash, ...content } = summary;
  if (
    summary.schemaVersion !==
      FRENCH_CODEX_PILOT_PROPOSER_SUMMARY_SCHEMA_VERSION ||
    summary.runKind !== "pilot" ||
    summary.namespace !== "/fr-internal/pilot" ||
    summary.coverage !== "exact" ||
    summary.selectionHash !== context.selectionHash ||
    summary.keyOrderHash !== context.keyOrderHash ||
    summary.manifestHash !== manifest.manifestHash ||
    summary.counts.entries !== FRENCH_PILOT_QUALITY_GATE_EXPECTED_ENTRIES ||
    summary.counts.proposerA !== FRENCH_PILOT_QUALITY_GATE_EXPECTED_ENTRIES ||
    summary.counts.proposerB !== FRENCH_PILOT_QUALITY_GATE_EXPECTED_ENTRIES ||
    summary.counts.jobs !== manifest.batches.length * 2 ||
    summary.counts.distinctAgentThreads !== summary.counts.jobs ||
    canonicalFrenchInternalJson(summary.profiles) !==
      canonicalFrenchInternalJson({
        proposerA: FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.proposerA,
        proposerB: FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.proposerB
      }) ||
    summaryHash !== hashFrenchInternalJson(content)
  ) {
    throw new Error("french-pilot-quality-gate-proposer-summary-invalid");
  }
  for (const output of Object.values(summary.outputs)) {
    assertFileOutput(output, "proposer-output");
  }
}

function assertAssemblySummary(
  summary: FrenchInternalAssemblySummary,
  summaryArtifact: SourceArtifactWithBuffer,
  reviewArtifact: SourceArtifactWithBuffer,
  reviews: readonly FrenchInternalReviewRecord[],
  generationConfigHash: string,
  expectedEntries: number
): void {
  const { summaryDigest, ...content } = summary;
  if (
    summary.schemaVersion !== FRENCH_INTERNAL_ASSEMBLY_SUMMARY_SCHEMA_VERSION ||
    summaryDigest !== hashFrenchInternalJson(content) ||
    summary.generationConfigHash !== generationConfigHash ||
    summary.counts.packets !== expectedEntries ||
    summary.counts.outputRecords !== expectedEntries ||
    resolve(summary.sourcePaths.output) !== resolve(reviewArtifact.path) ||
    summary.outputDigest !== reviewArtifact.sha256 ||
    summary.recordsLogicalDigest !==
      hashFrenchInternalJson(
        reviews.map((review) => ({
          entryKey: review.entryKey,
          artifactHash: review.artifactHash
        }))
      ) ||
    summaryArtifact.sha256 !== sha256(summaryArtifact.buffer)
  ) {
    throw new Error("french-pilot-quality-gate-assembly-summary-invalid");
  }
  for (const [label, digest] of Object.entries(summary.sourceDigests)) {
    const path = summary.sourcePaths[label as keyof typeof summary.sourcePaths];
    if (typeof path !== "string" || artifact(path).sha256 !== digest) {
      throw new Error(
        `french-pilot-quality-gate-assembly-source-stale:${label}`
      );
    }
  }
}

function assertExecutionReceipts(
  receipts: readonly FrenchInternalExecutionReceipt[],
  summary: FrenchCodexExecutionReceiptsSummary,
  expectedEntries: number
): Map<string, FrenchInternalExecutionReceipt> {
  const jobs = new Set<string>();
  const output = new Map<string, FrenchInternalExecutionReceipt>();
  const byEntry = new Map<string, FrenchInternalExecutionReceipt[]>();
  for (const receipt of receipts) {
    try {
      assertFrenchCodexExecutionReceipt(receipt);
    } catch {
      throw new Error(
        `french-pilot-quality-gate-execution-receipt-invalid:${String(receipt.entryKey)}:${String(receipt.role)}`
      );
    }
    if (!ROLES.includes(receipt.role)) {
      throw new Error(
        `french-pilot-quality-gate-execution-receipt-invalid:${receipt.entryKey}:${receipt.role}`
      );
    }
    const expectedProfile =
      FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE[receipt.role];
    if (
      receipt.schemaVersion !==
        FRENCH_INTERNAL_EXECUTION_RECEIPT_SCHEMA_VERSION ||
      !ROLES.includes(receipt.role) ||
      receipt.receiptHash !== frenchInternalExecutionReceiptHash(receipt) ||
      receipt.namespace !== summary.namespace ||
      receipt.selectionHash !== summary.selectionHash ||
      receipt.model !== expectedProfile.model ||
      receipt.reasoningEffort !== expectedProfile.reasoningEffort ||
      receipt.executorPolicyVersion !==
        FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.executorPolicyVersion ||
      receipt.executor.version !==
        FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.codexVersion ||
      receipt.executor.sha256 !==
        FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE.codexSha256 ||
      receipt.capabilities.localTools !== "disabled" ||
      receipt.capabilities.networkDataTools !== "disabled" ||
      receipt.capabilities.shell !== "disabled" ||
      !SHA256_PATTERN.test(receipt.receiptHash) ||
      output.has(receipt.receiptHash) ||
      jobs.has(`${receipt.entryKey}:${receipt.role}`)
    ) {
      throw new Error(
        `french-pilot-quality-gate-execution-receipt-invalid:${receipt.entryKey}:${receipt.role}`
      );
    }
    jobs.add(`${receipt.entryKey}:${receipt.role}`);
    output.set(receipt.receiptHash, receipt);
    const entry = byEntry.get(receipt.entryKey) ?? [];
    entry.push(receipt);
    byEntry.set(receipt.entryKey, entry);
  }
  if (
    receipts.length !== expectedEntries * ROLES.length ||
    byEntry.size !== expectedEntries
  ) {
    throw new Error("french-pilot-quality-gate-execution-receipt-coverage");
  }
  for (const [entryKey, entry] of byEntry) {
    if (
      entry.length !== 4 ||
      new Set(entry.map((receipt) => receipt.role)).size !== 4 ||
      new Set(entry.map((receipt) => receipt.agentId)).size !== 4 ||
      new Set(entry.map((receipt) => receipt.threadId)).size !== 4
    ) {
      throw new Error(
        `french-pilot-quality-gate-execution-role-separation:${entryKey}`
      );
    }
  }
  return output;
}

function mergeExecutionReceipts(
  closures: readonly ExecutionRunClosure[]
): Map<string, FrenchInternalExecutionReceipt> {
  const output = new Map<string, FrenchInternalExecutionReceipt>();
  for (const closure of closures) {
    for (const [receiptHash, receipt] of closure.receipts) {
      const previous = output.get(receiptHash);
      if (
        previous &&
        canonicalFrenchInternalJson(previous) !==
          canonicalFrenchInternalJson(receipt)
      ) {
        throw new Error("french-pilot-quality-gate-receipt-hash-collision");
      }
      output.set(receiptHash, receipt);
    }
  }
  return output;
}

function executionClosureIdentity(closure: ExecutionRunClosure): string {
  return hashFrenchInternalJson({
    namespace: closure.namespace,
    releaseKey: closure.releaseKey,
    releaseSnapshotFingerprint: closure.releaseSnapshotFingerprint,
    selectionHash: closure.selectionHash,
    keyOrderHash: closure.keyOrderHash,
    proposerManifestHash: closure.proposerManifestHash,
    proposerSummaryHash: closure.proposerSummaryHash,
    arbiterManifestHash: closure.arbiterManifestHash,
    arbiterSummaryHash: closure.arbiterSummaryHash,
    auditorManifestHash: closure.auditorManifestHash,
    auditorSummaryHash: closure.auditorSummaryHash,
    executionReceiptsDigest: closure.executionReceiptsDigest,
    adjudicationSummaryHash: closure.adjudicationSummaryHash
  });
}

function executionAttestationIdentity(
  attestation: NonNullable<FrenchInternalReviewRecord["executionAttestation"]>
): string {
  return hashFrenchInternalJson({
    namespace: attestation.namespace,
    releaseKey: attestation.releaseKey,
    releaseSnapshotFingerprint: attestation.releaseSnapshotFingerprint,
    selectionHash: attestation.selectionHash,
    keyOrderHash: attestation.keyOrderHash,
    proposerManifestHash: attestation.proposerManifestHash,
    proposerSummaryHash: attestation.proposerSummaryHash,
    arbiterManifestHash: attestation.arbiterManifestHash,
    arbiterSummaryHash: attestation.arbiterSummaryHash,
    auditorManifestHash: attestation.auditorManifestHash,
    auditorSummaryHash: attestation.auditorSummaryHash,
    executionReceiptsDigest: attestation.executionReceiptsDigest,
    adjudicationSummaryHash: attestation.adjudicationSummaryHash
  });
}

function countStatuses(
  reviews: readonly FrenchInternalReviewRecord[]
): Record<FrenchInternalReviewStatus, number> {
  const output: Record<FrenchInternalReviewStatus, number> = {
    auto_validated: 0,
    review_needed: 0,
    blocked_source_issue: 0,
    failed: 0
  };
  for (const review of reviews) output[review.status] += 1;
  return output;
}

function stripBuffers<T extends Record<string, SourceArtifactWithBuffer>>(
  artifacts: T
): { [K in keyof T]: FrenchPilotQualityGateSourceArtifact } {
  return Object.fromEntries(
    Object.entries(artifacts).map(([label, value]) => {
      const { buffer: _buffer, ...artifactValue } = value;
      void _buffer;
      return [label, artifactValue];
    })
  ) as { [K in keyof T]: FrenchPilotQualityGateSourceArtifact };
}

function artifact(path: string): SourceArtifactWithBuffer {
  const absolute = resolve(path);
  if (!existsSync(absolute)) {
    throw new Error(`french-pilot-quality-gate-source-missing:${absolute}`);
  }
  const stat = lstatSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`french-pilot-quality-gate-source-not-regular:${absolute}`);
  }
  const buffer = readFileSync(absolute);
  return {
    path: absolute,
    sha256: sha256(buffer),
    bytes: buffer.byteLength,
    buffer
  };
}

function assertPinnedExecutionBinary(
  executor: FrenchInternalExecutionReceipt["executor"],
  transitive: Map<string, FrenchPilotQualityGateSourceArtifact>,
  label: string
): void {
  const path = resolve(executor.path);
  if (path !== FRENCH_CODEX_IMMUTABLE_BINARY_PATH) {
    throw new Error(`french-pilot-quality-gate-executor-path:${path}`);
  }
  const source = artifact(path);
  if (source.sha256 !== executor.sha256) {
    throw new Error(`french-pilot-quality-gate-executor-stale:${path}`);
  }
  const cached = VERIFIED_EXECUTION_BINARIES.get(path);
  if (cached !== source.sha256) {
    const identity = assertFrenchCodexImmutableBinary(path);
    if (
      canonicalFrenchInternalJson(identity) !==
      canonicalFrenchInternalJson(executor)
    ) {
      throw new Error(`french-pilot-quality-gate-executor-invalid:${path}`);
    }
    VERIFIED_EXECUTION_BINARIES.set(path, source.sha256);
  }
  addTransitive(transitive, label, source);
}

function addTransitive(
  output: Map<string, FrenchPilotQualityGateSourceArtifact>,
  label: string,
  source: SourceArtifactWithBuffer
): void {
  const { buffer: _buffer, ...value } = source;
  void _buffer;
  const previous = output.get(label);
  if (
    previous &&
    canonicalFrenchInternalJson(previous) !== canonicalFrenchInternalJson(value)
  ) {
    throw new Error(`french-pilot-quality-gate-transitive-label:${label}`);
  }
  output.set(label, value);
}

function parseJson<T>(source: SourceArtifactWithBuffer, label: string): T {
  try {
    return JSON.parse(source.buffer.toString("utf8")) as T;
  } catch {
    throw new Error(`french-pilot-quality-gate-invalid-json:${label}`);
  }
}

function parseJsonl<T>(source: SourceArtifactWithBuffer, label: string): T[] {
  const output: T[] = [];
  for (const [index, line] of source.buffer
    .toString("utf8")
    .split(/\r?\n/u)
    .entries()) {
    if (!line.trim()) continue;
    try {
      output.push(JSON.parse(line) as T);
    } catch {
      throw new Error(
        `french-pilot-quality-gate-invalid-jsonl:${label}:${index + 1}`
      );
    }
  }
  if (output.length === 0) {
    throw new Error(`french-pilot-quality-gate-empty-jsonl:${label}`);
  }
  return output;
}

function readSelfHashedJson(
  path: string,
  hashField: string,
  label: string
): { value: Record<string, unknown>; hash: string } {
  const source = artifact(path);
  const value = parseJson<Record<string, unknown>>(source, label);
  const hash = value[hashField];
  if (typeof hash !== "string" || !SHA256_PATTERN.test(hash)) {
    throw new Error(`french-pilot-quality-gate-self-hash-invalid:${label}`);
  }
  const content = { ...value };
  delete content[hashField];
  if (hashFrenchInternalJson(content) !== hash) {
    throw new Error(`french-pilot-quality-gate-self-hash-mismatch:${label}`);
  }
  return { value, hash };
}

function assertFileOutput(output: FileOutput, label: string): void {
  const source = artifact(output.path);
  if (
    source.sha256 !== output.sha256 ||
    source.bytes !== output.bytes ||
    !SHA256_PATTERN.test(output.logicalDigest)
  ) {
    throw new Error(`french-pilot-quality-gate-file-output-stale:${label}`);
  }
}

function assertDistinctPaths(
  options: BuildFrenchPilotQualityGateOptions
): void {
  const paths = Object.entries(options)
    .filter(([key, value]) => key.endsWith("Path") && typeof value === "string")
    .map(([key, value]) => [key, resolve(value as string)] as const);
  const seen = new Map<string, string>();
  for (const [label, path] of paths) {
    const previous = seen.get(path);
    if (previous) {
      throw new Error(
        `french-pilot-quality-gate-path-collision:${previous}:${label}`
      );
    }
    seen.set(path, label);
  }
}

function installContentAddressed(path: string, text: string): void {
  const absolute = resolve(path);
  mkdirSync(dirname(absolute), { recursive: true });
  if (existsSync(absolute)) {
    if (readFileSync(absolute, "utf8") !== text) {
      throw new Error(`french-pilot-quality-gate-output-collision:${absolute}`);
    }
    return;
  }
  const temporary = `${absolute}.tmp-${process.pid}-${Date.now()}`;
  let descriptor: number | null = null;
  try {
    descriptor = openSync(temporary, "wx", 0o600);
    writeFileSync(descriptor, text, "utf8");
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = null;
    try {
      linkSync(temporary, absolute);
    } catch (error) {
      if (
        (error as NodeJS.ErrnoException).code !== "EEXIST" ||
        readFileSync(absolute, "utf8") !== text
      ) {
        throw error;
      }
    }
  } finally {
    if (descriptor !== null) closeSync(descriptor);
    rmSync(temporary, { force: true });
  }
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function isCanonicalIsoTimestamp(value: unknown): value is string {
  const parsed = typeof value === "string" ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

export function parseFrenchPilotQualityGateArgs(
  args: readonly string[]
): BuildFrenchPilotQualityGateOptions {
  const allowed = new Set([
    "pilot-manifest",
    "pilot-selection",
    "selected-packets",
    "configuration",
    "canonical-entities",
    "canonical-entry-policies",
    "entity-merge-attestation",
    "entity-gate",
    "entity-mentions",
    "entity-mention-resolution-attestation",
    "entity-packets",
    "proposer-summary",
    "adjudication-summary",
    "execution-receipts",
    "execution-receipts-summary",
    "assembled-review",
    "assembly-summary",
    "remediation-summary",
    "final-review",
    "blind-reaudit-manifest",
    "blind-reaudit-summary",
    "blind-reaudit-receipts",
    "blind-reaudit-decisions",
    "output-dir",
    "generated-at"
  ]);
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index] ?? "";
    if (!token.startsWith("--")) {
      throw new Error(`unexpected-argument:${token}`);
    }
    const [key, inline] = token.slice(2).split("=", 2);
    if (!allowed.has(key)) throw new Error(`unknown-option:${key}`);
    if (values.has(key)) throw new Error(`duplicate-option:${key}`);
    const next = args[index + 1];
    if (inline !== undefined) {
      if (!inline) throw new Error(`missing-value:${key}`);
      values.set(key, inline);
    } else if (next && !next.startsWith("--")) {
      values.set(key, next);
      index += 1;
    } else {
      throw new Error(`missing-value:${key}`);
    }
  }
  const pilotManifestPath = resolve(
    values.get("pilot-manifest") ?? `${ROOT}/agent-batches/pilot/manifest.json`
  );
  let inferredSelectedPackets = `${ROOT}/agent-batches/pilot/selected-packets.jsonl`;
  if (existsSync(pilotManifestPath)) {
    const manifest = JSON.parse(
      readFileSync(pilotManifestPath, "utf8")
    ) as FrenchCodexPilotBatchManifest;
    if (manifest.selectedPackets?.path) {
      inferredSelectedPackets = manifest.selectedPackets.path;
    }
  }
  const outputRoot = resolve(
    values.get("output-dir") ?? `${ROOT}/pilot-quality-gates`
  );
  return {
    pilotManifestPath,
    pilotSelectionPath: resolve(
      values.get("pilot-selection") ?? `${ROOT}/work/pilot-keys.json`
    ),
    selectedPacketsPath: resolve(
      values.get("selected-packets") ?? inferredSelectedPackets
    ),
    configurationPath: resolve(
      values.get("configuration") ?? `${ROOT}/configuration.json`
    ),
    canonicalEntitiesPath: resolve(
      values.get("canonical-entities") ?? DEFAULT_CANONICAL_ENTITIES
    ),
    canonicalEntryPoliciesPath: resolve(
      values.get("canonical-entry-policies") ?? DEFAULT_CANONICAL_ENTRY_POLICIES
    ),
    entityMergeAttestationPath: resolve(
      values.get("entity-merge-attestation") ?? DEFAULT_ENTITY_MERGE_ATTESTATION
    ),
    entityGatePath: resolve(values.get("entity-gate") ?? DEFAULT_ENTITY_GATE),
    entityMentionsPath: resolve(
      values.get("entity-mentions") ?? DEFAULT_ENTITY_MENTIONS
    ),
    entityMentionResolutionAttestationPath: resolve(
      values.get("entity-mention-resolution-attestation") ??
        DEFAULT_ENTITY_MENTION_RESOLUTION_ATTESTATION
    ),
    entityPacketsPath: resolve(
      values.get("entity-packets") ?? DEFAULT_ENTITY_PACKETS
    ),
    proposerSummaryPath: resolve(
      values.get("proposer-summary") ??
        `${DEFAULT_PILOT_RUNTIME}/proposer-summary.json`
    ),
    adjudicationSummaryPath: resolve(
      values.get("adjudication-summary") ??
        `${DEFAULT_PILOT_RUNTIME}/adjudication-summary.json`
    ),
    executionReceiptsPath: resolve(
      values.get("execution-receipts") ??
        `${DEFAULT_PILOT_RUNTIME}/execution-receipts.jsonl`
    ),
    executionReceiptsSummaryPath: resolve(
      values.get("execution-receipts-summary") ??
        `${DEFAULT_PILOT_RUNTIME}/execution-receipts.summary.json`
    ),
    assembledReviewPath: resolve(
      values.get("assembled-review") ??
        `${DEFAULT_PILOT_RUNTIME}/french-review.jsonl`
    ),
    assemblySummaryPath: resolve(
      values.get("assembly-summary") ??
        `${DEFAULT_PILOT_RUNTIME}/french-review.summary.json`
    ),
    remediationSummaryPath: resolve(
      values.get("remediation-summary") ??
        `${DEFAULT_PILOT_RUNTIME}/remediation/run.summary.json`
    ),
    finalReviewPath: resolve(
      values.get("final-review") ??
        `${DEFAULT_PILOT_RUNTIME}/remediation/french-review.jsonl`
    ),
    blindReauditManifestPath: resolve(
      values.get("blind-reaudit-manifest") ??
        `${DEFAULT_PILOT_RUNTIME}/blind-reaudit/manifest.json`
    ),
    blindReauditSummaryPath: resolve(
      values.get("blind-reaudit-summary") ??
        `${DEFAULT_PILOT_RUNTIME}/blind-reaudit/summary.json`
    ),
    blindReauditReceiptsPath: resolve(
      values.get("blind-reaudit-receipts") ??
        `${DEFAULT_PILOT_RUNTIME}/blind-reaudit/receipts.jsonl`
    ),
    blindReauditDecisionsPath: resolve(
      values.get("blind-reaudit-decisions") ??
        `${DEFAULT_PILOT_RUNTIME}/blind-reaudit/decisions.jsonl`
    ),
    outputDir: outputRoot,
    ...(values.has("generated-at")
      ? { generatedAt: values.get("generated-at") }
      : {})
  };
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? "")).href) {
  try {
    const result = buildLexiconV3FrenchPilotQualityGate(
      parseFrenchPilotQualityGateArgs(process.argv.slice(2))
    );
    process.stdout.write(
      `${JSON.stringify(
        {
          event: "french-pilot-quality-gate-passed",
          gateHash: result.gate.gateHash,
          outputPath: result.outputPath,
          entries: result.gate.coverage.finalReviewEntries,
          strata: result.gate.quality.strata,
          blindReaudit: result.gate.blindReaudit
        },
        null,
        2
      )}\n`
    );
  } catch (error) {
    process.stderr.write(
      `${basename(process.argv[1] ?? "buildLexiconV3FrenchPilotQualityGate")}: ${
        error instanceof Error ? error.stack : String(error)
      }\n`
    );
    process.exitCode = 1;
  }
}
