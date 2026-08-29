import { createHash } from "node:crypto";
import {
  closeSync,
  createReadStream,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";

import {
  assembleLexiconV3FrenchInternalReview,
  readFrenchInternalAssemblyConfiguration,
  readFrenchInternalPackets,
  type FrenchInternalAssemblyConfigurationFile
} from "./assembleLexiconV3FrenchInternalReview.js";
import { buildLexiconV3FrenchCodexBatches } from "./buildLexiconV3FrenchCodexBatches.js";
import {
  buildLexiconV3FrenchRemediation,
  frenchInternalRemediationReviewSource,
  installTextContentAddressed,
  readFrenchInternalReviewRecords
} from "./buildLexiconV3FrenchRemediation.js";
import { mergeLexiconV3FrenchInternalReviews } from "./mergeLexiconV3FrenchInternalReviews.js";
import {
  parseFrenchCodexAdjudicationArgs,
  runLexiconV3FrenchCodexPilotAdjudication
} from "./runLexiconV3FrenchCodexPilotAdjudication.js";
import {
  parseFrenchCodexProposersArgs,
  runLexiconV3FrenchCodexPilotProposers
} from "./runLexiconV3FrenchCodexPilotProposers.js";
import {
  FRENCH_INTERNAL_REMEDIATION_POLICY_VERSION,
  FRENCH_INTERNAL_REMEDIATION_VIEW_CONTEXT_SCHEMA_VERSION,
  frenchInternalRemediationReviewLogicalDigest,
  type FrenchInternalRemediationPlan,
  type FrenchInternalRemediationPlanItem
} from "../src/lexiconV3/frenchInternalRemediation.js";
import { hashFrenchInternalJson } from "../src/lexiconV3/frenchInternalReview.js";
import {
  FRENCH_INTERNAL_PROPOSER_VIEW_SCHEMA_VERSION,
  FRENCH_INTERNAL_WORK_POLICY_VERSION,
  assertProposerABlindView,
  frenchInternalViewHash,
  hashFrenchInternalWorkJson,
  type FrenchInternalProposerAView,
  type FrenchInternalProposerBView
} from "../src/lexiconV3/frenchInternalWork.js";
import {
  ensureFrenchCodexImmutableBinary,
  FRENCH_CODEX_IMMUTABLE_BINARY_PATH
} from "../src/lexiconV3/frenchCodexImmutableBinary.js";
import type {
  FrenchCanonicalEntityRecord,
  FrenchCanonicalEntryNamePolicy,
  FrenchEntityCanonicalizationGateResult
} from "../src/lexiconV3/frenchEntityCanonicalization.js";
import type { FrenchEntityMentionsArtifact } from "../src/lexiconV3/frenchEntityMentions.js";
import type { FrenchEntityMentionResolutionAttestation } from "../src/lexiconV3/frenchEntityMentionResolution.js";
import { assertFrenchEntityMergeAttestationAtPath } from "../src/lexiconV3/frenchEntityMergeAttestation.js";
import {
  assertFrenchEntityPipelineArtifacts,
  frenchEntityQuarantinedEntryKeysFromMerge
} from "../src/lexiconV3/frenchEntityPipeline.js";
import type { LexiconV3FrenchPacket } from "../src/lexiconV3/frenchPackets.js";

export const FRENCH_INTERNAL_REMEDIATION_RUN_SCHEMA_VERSION =
  "lexicon-v3-french-internal-remediation-run@1" as const;

const DEFAULT_ROOT = "outputs/lexicon-v3/fr-internal";
const DEFAULT_CODEX_BINARY = FRENCH_CODEX_IMMUTABLE_BINARY_PATH;
const DEFAULT_CODEX_HOME = `${DEFAULT_ROOT}/codex-agent-home`;
const DEFAULT_ENTITY_RESOLVED = "outputs/lexicon-v3/french-entities/resolved";
// Deliberately independent from --packets: pilot remediation uses a 300-row
// selection while entity mentions are sealed against the complete corpus.
const DEFAULT_ENTITY_PACKETS = `${DEFAULT_ROOT}/french-packets.jsonl`;
const DEFAULT_ENTITY_MENTION_RESOLUTION_ATTESTATION = `${DEFAULT_ENTITY_RESOLVED}/entity-mention-resolution-attestation.json`;
const DEFAULT_MAX_COMBINED_BYTES = 400_000;
const DEFAULT_CODEX_VERSION = "codex-cli 0.144.0-alpha.4";
const DEFAULT_CODEX_SHA256 =
  "e48ce8a0455b97ba25aa6b373f694ad7788f960c4bfc311f68b6d5bf7121f2f4";

export interface RunLexiconV3FrenchInternalRemediationOptions {
  packetsPath: string;
  entityPacketsPath: string;
  reviewsPath: string;
  proposerAViewsPath: string;
  proposerBViewsPath: string;
  configurationPath: string;
  canonicalEntitiesPath: string;
  canonicalEntryPoliciesPath: string;
  entityMergeAttestationPath: string;
  entityGatePath: string;
  entityMentionsPath: string;
  entityMentionResolutionAttestationPath: string;
  outputRoot: string;
  finalReviewPath: string;
  summaryPath: string;
  maxRounds: number;
  maxCombinedBytes: number;
  concurrency: number;
  maxAttempts: number;
  timeoutMs: number;
  codexBinary: string;
  codexHome: string;
  expectedCodexVersion: string;
  expectedCodexSha256: string;
  proposerAModel: string;
  proposerAReasoningEffort: string;
  proposerBModel: string;
  proposerBReasoningEffort: string;
  arbiterModel: string;
  arbiterReasoningEffort: string;
  auditorModel: string;
  auditorReasoningEffort: string;
}

export interface FrenchInternalRemediationRunRound {
  round: number;
  namespace: string;
  planPath: string;
  planHash: string;
  selected: number;
  batchManifestPath: string;
  batchManifestHash: string;
  proposerSummaryPath: string;
  proposerSummaryHash: string;
  adjudicationSummaryPath: string;
  adjudicationSummarySha256: string;
  attemptedReviewPath: string;
  attemptedReviewSha256: string;
  mergedReviewPath: string;
  mergeSummaryPath: string;
  mergeHash: string;
  replaced: number;
  residual: number;
  roundHash: string;
}

export interface FrenchInternalRemediationRunSummary {
  schemaVersion: typeof FRENCH_INTERNAL_REMEDIATION_RUN_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_INTERNAL_REMEDIATION_POLICY_VERSION;
  status: "complete" | "failed_residual";
  maxRounds: number;
  executionContract: {
    runtime: "codex-internal-agent-runtime";
    cel: "forbidden";
    aiGateway: "forbidden";
    localTools: "disabled";
    networkDataTools: "disabled";
    shell: "disabled";
    boundedRounds: true;
    exactCoverage: true;
    mergePolicy: "fresh-attempt-advances-auto-validated-only-publishes";
  };
  initialReviews: {
    path: string;
    sha256: string;
    records: number;
    logicalDigest: string;
  };
  rounds: FrenchInternalRemediationRunRound[];
  finalReviews: {
    path: string;
    sha256: string;
    records: number;
    logicalDigest: string;
  };
  residuals: Array<{
    entryKey: string;
    status: "review_needed" | "blocked_source_issue" | "failed";
    reviewArtifactHash: string;
  }>;
  runHash: string;
}

export async function runLexiconV3FrenchInternalRemediation(
  options: RunLexiconV3FrenchInternalRemediationOptions
): Promise<FrenchInternalRemediationRunSummary> {
  assertOptions(options);
  ensureFrenchCodexImmutableBinary({ requestedPath: options.codexBinary });
  assertRequiredFiles([
    options.packetsPath,
    options.entityPacketsPath,
    options.reviewsPath,
    options.proposerAViewsPath,
    options.proposerBViewsPath,
    options.configurationPath,
    options.canonicalEntitiesPath,
    options.canonicalEntryPoliciesPath,
    options.entityMergeAttestationPath,
    options.entityGatePath,
    options.entityMentionsPath,
    options.entityMentionResolutionAttestationPath,
    options.codexBinary,
    resolve(options.codexHome, "auth.json")
  ]);
  const configuration = readFrenchInternalAssemblyConfiguration(
    options.configurationPath
  );
  const entityReplay = assertFrenchEntityMergeAttestationAtPath({
    attestationPath: options.entityMergeAttestationPath,
    canonicalEntitiesPath: options.canonicalEntitiesPath,
    canonicalEntryPoliciesPath: options.canonicalEntryPoliciesPath
  });
  if (
    configuration.configuration.entityMergeAttestationHash !==
      sha256File(options.entityMergeAttestationPath) ||
    entityReplay.attestation.releaseKey !==
      entityReplay.plan.sourceLineage.releaseKey
  ) {
    throw new Error("french-remediation-entity-attestation-lineage-invalid");
  }
  assertFrenchInternalRemediationEntityArtifactBoundary({
    options,
    configuration,
    releaseKey: entityReplay.attestation.releaseKey,
    releaseSnapshotFingerprint:
      entityReplay.attestation.releaseSnapshotFingerprint,
    quarantinedEntryKeys: frenchEntityQuarantinedEntryKeysFromMerge({
      plan: entityReplay.plan,
      merged: entityReplay.merged
    })
  });
  mkdirSync(options.outputRoot, { recursive: true });
  const release = acquireRunLock(resolve(options.outputRoot, "runner.lock"));
  try {
    return await runUnlocked(options);
  } finally {
    release();
  }
}

async function runUnlocked(
  options: RunLexiconV3FrenchInternalRemediationOptions
): Promise<FrenchInternalRemediationRunSummary> {
  let currentReviewsPath = resolve(options.reviewsPath);
  const initialReviews = readFrenchInternalReviewRecords(currentReviewsPath);
  const initialSource = frenchInternalRemediationReviewSource(
    currentReviewsPath,
    initialReviews
  );
  const rounds: FrenchInternalRemediationRunRound[] = [];
  let residuals: FrenchInternalRemediationRunSummary["residuals"] = [];

  for (let round = 1; round <= options.maxRounds; round += 1) {
    const roundName = `round-${String(round).padStart(3, "0")}`;
    const roundRoot = resolve(options.outputRoot, roundName);
    const planPath = resolve(roundRoot, "plan.json");
    const plan = buildLexiconV3FrenchRemediation({
      packetsPath: options.packetsPath,
      reviewsPath: currentReviewsPath,
      entityMentionsPath: options.entityMentionsPath,
      outputPath: planPath,
      round,
      maxRounds: options.maxRounds
    });
    if (plan.counts.selected === 0) {
      return finalizeRun(options, {
        status: "complete",
        initialSource,
        rounds,
        currentReviewsPath,
        residuals: []
      });
    }

    const namespace = `/fr-internal/custom/remediation-r${String(round).padStart(3, "0")}`;
    const remediationViews = await writeFrenchInternalRemediationViews({
      plan,
      proposerAPath: options.proposerAViewsPath,
      proposerBPath: options.proposerBViewsPath,
      outputRoot: roundRoot
    });
    const batchRoot = resolve(roundRoot, "agent-batches");
    const manifest = buildLexiconV3FrenchCodexBatches({
      runKind: "custom",
      namespace,
      selectionPath: planPath,
      proposerAPath: remediationViews.proposerA,
      proposerBPath: remediationViews.proposerB,
      packetsPath: options.packetsPath,
      outputDir: batchRoot,
      expectedEntries: plan.counts.selected,
      maxCombinedBytes: options.maxCombinedBytes,
      maxItems: { short: 20, medium: 8, long: 3, very_long: 1 },
      replaceExisting: false
    });
    const manifestPath = resolve(batchRoot, "manifest.json");
    const runtimeRoot = resolve(roundRoot, "runtime");
    const proposerSummary = await runLexiconV3FrenchCodexPilotProposers(
      parseFrenchCodexProposersArgs(
        buildFrenchInternalRemediationProposerArgs(options, {
          manifestPath,
          runtimeRoot,
          expectedEntries: plan.counts.selected
        })
      )
    );
    const adjudication = await runLexiconV3FrenchCodexPilotAdjudication(
      parseFrenchCodexAdjudicationArgs([
        "--phase",
        "all",
        "--namespace",
        namespace,
        "--packets",
        manifest.selectedPackets.path,
        "--proposer-a",
        resolve(runtimeRoot, "proposer-a.jsonl"),
        "--proposer-b",
        resolve(runtimeRoot, "proposer-b.jsonl"),
        "--configuration",
        options.configurationPath,
        "--selection",
        planPath,
        "--output-dir",
        runtimeRoot,
        "--proposer-runs",
        resolve(runtimeRoot, "proposer-runs.jsonl"),
        "--proposer-summary",
        resolve(runtimeRoot, "proposer-summary.json"),
        "--proposer-batch-manifest",
        manifestPath,
        "--codex-binary",
        options.codexBinary,
        "--codex-home",
        options.codexHome,
        "--arbiter-model",
        options.arbiterModel,
        "--arbiter-reasoning-effort",
        options.arbiterReasoningEffort,
        "--auditor-model",
        options.auditorModel,
        "--auditor-reasoning-effort",
        options.auditorReasoningEffort,
        "--concurrency",
        String(options.concurrency),
        "--max-attempts",
        String(options.maxAttempts),
        "--timeout-ms",
        String(options.timeoutMs),
        "--expected-entries",
        String(plan.counts.selected),
        "--codex-version",
        options.expectedCodexVersion,
        "--codex-sha256",
        options.expectedCodexSha256
      ])
    );
    if (!adjudication.executionReceipts) {
      throw new Error("french-remediation-execution-receipts-missing");
    }

    const attemptedReviewPath = resolve(roundRoot, "attempted-review.jsonl");
    assembleLexiconV3FrenchInternalReview({
      batchManifestPath: manifestPath,
      packetsPath: manifest.selectedPackets.path,
      proposerAPath: resolve(runtimeRoot, "proposer-a.jsonl"),
      proposerBPath: resolve(runtimeRoot, "proposer-b.jsonl"),
      arbiterPath: resolve(runtimeRoot, "arbiter.jsonl"),
      auditorPath: resolve(runtimeRoot, "auditor.jsonl"),
      configurationPath: options.configurationPath,
      canonicalEntitiesPath: options.canonicalEntitiesPath,
      canonicalEntryPoliciesPath: options.canonicalEntryPoliciesPath,
      entityMergeAttestationPath: options.entityMergeAttestationPath,
      entityGatePath: options.entityGatePath,
      entityMentionsPath: options.entityMentionsPath,
      entityMentionResolutionAttestationPath:
        options.entityMentionResolutionAttestationPath,
      entityPacketsPath: options.entityPacketsPath,
      executionReceiptsPath: resolve(
        adjudication.executionReceipts.output.path
      ),
      executionReceiptsSummaryPath: resolve(
        runtimeRoot,
        "execution-receipts.summary.json"
      ),
      adjudicationSummaryPath: adjudication.summaryPath,
      outputPath: attemptedReviewPath,
      summaryPath: resolve(roundRoot, "attempted-review.summary.json")
    });
    const mergedReviewPath = resolve(roundRoot, "merged-review.jsonl");
    const mergeSummaryPath = resolve(roundRoot, "merge.summary.json");
    const merge = mergeLexiconV3FrenchInternalReviews({
      planPath,
      batchManifestPath: manifestPath,
      packetsPath: options.packetsPath,
      previousReviewsPath: currentReviewsPath,
      attemptedReviewsPath: attemptedReviewPath,
      entityMentionsPath: options.entityMentionsPath,
      outputPath: mergedReviewPath,
      summaryPath: mergeSummaryPath
    });
    const roundContent = {
      round,
      namespace,
      planPath,
      planHash: plan.planHash,
      selected: plan.counts.selected,
      batchManifestPath: manifestPath,
      batchManifestHash: manifest.manifestHash,
      proposerSummaryPath: resolve(runtimeRoot, "proposer-summary.json"),
      proposerSummaryHash: proposerSummary.summaryHash,
      adjudicationSummaryPath: adjudication.summaryPath,
      adjudicationSummarySha256: sha256File(adjudication.summaryPath),
      attemptedReviewPath,
      attemptedReviewSha256: sha256File(attemptedReviewPath),
      mergedReviewPath,
      mergeSummaryPath,
      mergeHash: merge.mergeHash,
      replaced: merge.counts.replaced,
      residual: merge.counts.residual
    };
    rounds.push({
      ...roundContent,
      roundHash: hashFrenchInternalJson(roundContent)
    });
    currentReviewsPath = mergedReviewPath;
    residuals = merge.residuals.map((residual) => ({
      entryKey: residual.entryKey,
      status: residual.status,
      reviewArtifactHash: residual.reviewArtifactHash
    }));
    if (residuals.length === 0) {
      return finalizeRun(options, {
        status: "complete",
        initialSource,
        rounds,
        currentReviewsPath,
        residuals
      });
    }
  }

  const summary = finalizeRun(options, {
    status: "failed_residual",
    initialSource,
    rounds,
    currentReviewsPath,
    residuals
  });
  throw new Error(
    `french-remediation-residual-after-max-rounds:${summary.residuals.length}:${summary.runHash}`
  );
}

export function buildFrenchInternalRemediationProposerArgs(
  options: RunLexiconV3FrenchInternalRemediationOptions,
  input: {
    manifestPath: string;
    runtimeRoot: string;
    expectedEntries: number;
  }
): string[] {
  return [
    "--manifest",
    input.manifestPath,
    "--configuration",
    options.configurationPath,
    "--output-dir",
    input.runtimeRoot,
    "--codex-binary",
    options.codexBinary,
    "--codex-home",
    options.codexHome,
    "--a-model",
    options.proposerAModel,
    "--a-reasoning-effort",
    options.proposerAReasoningEffort,
    "--b-model",
    options.proposerBModel,
    "--b-reasoning-effort",
    options.proposerBReasoningEffort,
    "--concurrency",
    String(options.concurrency),
    "--max-attempts",
    String(options.maxAttempts),
    "--timeout-ms",
    String(options.timeoutMs),
    "--expected-entries",
    String(input.expectedEntries),
    "--codex-version",
    options.expectedCodexVersion,
    "--codex-sha256",
    options.expectedCodexSha256
  ];
}

type BaseProposerView =
  | FrenchInternalProposerAView
  | FrenchInternalProposerBView;

interface FrenchInternalRemediationViewContext {
  schemaVersion: typeof FRENCH_INTERNAL_REMEDIATION_VIEW_CONTEXT_SCHEMA_VERSION;
  round: number;
  planHash: string;
  planItemHash: string;
  parentHash: string;
  parentViewHash: string;
  parentStatus: FrenchInternalRemediationPlanItem["parentStatus"];
  parentGateIssues: string[];
  parentDiagnostics: FrenchInternalRemediationPlanItem["parentDiagnostics"];
  parentEvaluationHash: string;
  previousFrenchProposalExposed: false;
  diagnosticFeedbackExposed: true;
  instruction:
    | "retranslate-from-sealed-english-and-correct-exact-diagnostics-without-copying-prior-proposal"
    | "reassess-from-sealed-english-candidates-and-correct-exact-diagnostics-without-copying-prior-proposal";
}

type RemediationProposerView = BaseProposerView & {
  remediationContext: FrenchInternalRemediationViewContext;
};

async function writeFrenchInternalRemediationViews(input: {
  plan: FrenchInternalRemediationPlan;
  proposerAPath: string;
  proposerBPath: string;
  outputRoot: string;
}): Promise<{ proposerA: string; proposerB: string }> {
  const output = {
    proposerA: resolve(input.outputRoot, "proposer-a-remediation-views.jsonl"),
    proposerB: resolve(input.outputRoot, "proposer-b-remediation-views.jsonl")
  };
  await Promise.all([
    writeFrenchInternalRemediationRoleViews(
      input.plan,
      "proposerA",
      input.proposerAPath,
      output.proposerA
    ),
    writeFrenchInternalRemediationRoleViews(
      input.plan,
      "proposerB",
      input.proposerBPath,
      output.proposerB
    )
  ]);
  return output;
}

async function writeFrenchInternalRemediationRoleViews(
  plan: FrenchInternalRemediationPlan,
  role: "proposerA" | "proposerB",
  sourcePath: string,
  outputPath: string
): Promise<void> {
  const selected = new Map(plan.items.map((item) => [item.entryKey, item]));
  const views = new Map<string, RemediationProposerView>();
  const lines = createInterface({
    input: createReadStream(sourcePath, { encoding: "utf8" }),
    crlfDelay: Infinity
  });
  let lineNumber = 0;
  for await (const line of lines) {
    lineNumber += 1;
    if (!line.trim()) continue;
    let view: BaseProposerView;
    try {
      view = JSON.parse(line) as BaseProposerView;
    } catch {
      throw new Error(
        `french-remediation-view-invalid-json:${role}:${lineNumber}`
      );
    }
    const item = selected.get(view.entryKey);
    if (!item) continue;
    if (
      view.schemaVersion !== FRENCH_INTERNAL_PROPOSER_VIEW_SCHEMA_VERSION ||
      view.policyVersion !== FRENCH_INTERNAL_WORK_POLICY_VERSION ||
      view.role !== role ||
      view.lineage.packetHash !== item.packetHash ||
      view.lineage.englishHash !== item.englishHash ||
      view.lineage.releaseKey !== item.englishReleaseKey ||
      view.lineage.releaseSnapshotFingerprint !==
        item.englishReleaseSnapshotFingerprint ||
      view.lineage.glossParentContentHash !== item.glossParentContentHash ||
      view.lineage.meaningParentContentHash !== item.meaningParentContentHash ||
      frenchInternalViewHash(view) !== view.viewHash ||
      views.has(view.entryKey)
    ) {
      throw new Error(`french-remediation-view-stale:${role}:${view.entryKey}`);
    }
    if (role === "proposerA") {
      assertProposerABlindView(view as FrenchInternalProposerAView);
    }
    const { viewHash: parentViewHash, ...base } = view;
    const content = {
      ...base,
      remediationContext: {
        schemaVersion: FRENCH_INTERNAL_REMEDIATION_VIEW_CONTEXT_SCHEMA_VERSION,
        round: plan.round,
        planHash: plan.planHash,
        planItemHash: item.itemHash,
        parentHash: item.parentHash,
        parentViewHash,
        parentStatus: item.parentStatus,
        parentGateIssues: item.parentGateIssues,
        parentDiagnostics: item.parentDiagnostics,
        parentEvaluationHash: item.parentEvaluationHash,
        previousFrenchProposalExposed: false as const,
        diagnosticFeedbackExposed: true as const,
        instruction:
          role === "proposerA"
            ? ("retranslate-from-sealed-english-and-correct-exact-diagnostics-without-copying-prior-proposal" as const)
            : ("reassess-from-sealed-english-candidates-and-correct-exact-diagnostics-without-copying-prior-proposal" as const)
      }
    };
    const remediationView = {
      ...content,
      viewHash: hashFrenchInternalWorkJson(content)
    } as RemediationProposerView;
    if (role === "proposerA") {
      assertProposerABlindView(remediationView as FrenchInternalProposerAView);
    }
    views.set(view.entryKey, remediationView);
  }
  const missing = plan.keys.filter((entryKey) => !views.has(entryKey));
  if (missing.length > 0 || views.size !== plan.keys.length) {
    throw new Error(
      `french-remediation-view-coverage:${role}:${missing.join("|")}`
    );
  }
  installTextContentAddressed(
    outputPath,
    `${plan.keys.map((entryKey) => JSON.stringify(views.get(entryKey)!)).join("\n")}\n`
  );
}

function finalizeRun(
  options: RunLexiconV3FrenchInternalRemediationOptions,
  input: {
    status: FrenchInternalRemediationRunSummary["status"];
    initialSource: FrenchInternalRemediationRunSummary["initialReviews"];
    rounds: FrenchInternalRemediationRunRound[];
    currentReviewsPath: string;
    residuals: FrenchInternalRemediationRunSummary["residuals"];
  }
): FrenchInternalRemediationRunSummary {
  const finalRecords = readFrenchInternalReviewRecords(
    input.currentReviewsPath
  );
  if (
    input.status === "complete" &&
    finalRecords.some((record) => record.status !== "auto_validated")
  ) {
    throw new Error("french-remediation-complete-status-has-residual");
  }
  const targetPath =
    input.status === "complete"
      ? resolve(options.finalReviewPath)
      : resolve(input.currentReviewsPath);
  if (input.status === "complete") {
    installTextContentAddressed(
      targetPath,
      readFileSync(input.currentReviewsPath, "utf8")
    );
  }
  const installedRecords = readFrenchInternalReviewRecords(targetPath);
  const finalReviews = {
    path: targetPath,
    sha256: sha256File(targetPath),
    records: installedRecords.length,
    logicalDigest:
      frenchInternalRemediationReviewLogicalDigest(installedRecords)
  };
  const content = {
    schemaVersion: FRENCH_INTERNAL_REMEDIATION_RUN_SCHEMA_VERSION,
    policyVersion: FRENCH_INTERNAL_REMEDIATION_POLICY_VERSION,
    status: input.status,
    maxRounds: options.maxRounds,
    executionContract: {
      runtime: "codex-internal-agent-runtime" as const,
      cel: "forbidden" as const,
      aiGateway: "forbidden" as const,
      localTools: "disabled" as const,
      networkDataTools: "disabled" as const,
      shell: "disabled" as const,
      boundedRounds: true as const,
      exactCoverage: true as const,
      mergePolicy:
        "fresh-attempt-advances-auto-validated-only-publishes" as const
    },
    initialReviews: input.initialSource,
    rounds: input.rounds,
    finalReviews,
    residuals: input.residuals
  };
  const summary = { ...content, runHash: hashFrenchInternalJson(content) };
  installTextContentAddressed(
    options.summaryPath,
    `${JSON.stringify(summary, null, 2)}\n`
  );
  return summary;
}

export function parseRunLexiconV3FrenchInternalRemediationArgs(
  args: readonly string[]
): RunLexiconV3FrenchInternalRemediationOptions {
  const values = new Map<string, string>();
  const allowed = new Set([
    "packets",
    "entity-packets",
    "reviews",
    "proposer-a-views",
    "proposer-b-views",
    "configuration",
    "canonical-entities",
    "canonical-entry-policies",
    "entity-merge-attestation",
    "entity-gate",
    "entity-mentions",
    "entity-mention-resolution-attestation",
    "output-root",
    "final-review",
    "summary",
    "max-rounds",
    "max-combined-bytes",
    "concurrency",
    "max-attempts",
    "timeout-ms",
    "codex-binary",
    "codex-home",
    "codex-version",
    "codex-sha256",
    "a-model",
    "a-reasoning-effort",
    "b-model",
    "b-reasoning-effort",
    "arbiter-model",
    "arbiter-reasoning-effort",
    "auditor-model",
    "auditor-reasoning-effort"
  ]);
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index] ?? "";
    if (!token.startsWith("--"))
      throw new Error(`unexpected-argument:${token}`);
    const key = token.slice(2);
    if (!allowed.has(key)) throw new Error(`unknown-option:${key}`);
    if (values.has(key)) throw new Error(`duplicate-option:${key}`);
    const value = args[index + 1];
    if (!value || value.startsWith("--"))
      throw new Error(`missing-value:${key}`);
    values.set(key, value);
    index += 1;
  }
  const outputRoot = resolve(
    values.get("output-root") ?? `${DEFAULT_ROOT}/remediation`
  );
  const positiveSafeInteger = (key: string, fallback: number): number => {
    const raw = values.get(key);
    if (raw === undefined) return fallback;
    if (!/^[1-9]\d*$/u.test(raw)) {
      throw new Error(`invalid-positive-safe-integer:${key}:${raw}`);
    }
    const parsed = Number(raw);
    if (!Number.isSafeInteger(parsed)) {
      throw new Error(`invalid-positive-safe-integer:${key}:${raw}`);
    }
    return parsed;
  };
  const maxCombinedBytes = positiveSafeInteger(
    "max-combined-bytes",
    DEFAULT_MAX_COMBINED_BYTES
  );
  if (maxCombinedBytes > DEFAULT_MAX_COMBINED_BYTES) {
    throw new Error(
      `invalid-bounded-positive-safe-integer:max-combined-bytes:${maxCombinedBytes}:max=${DEFAULT_MAX_COMBINED_BYTES}`
    );
  }
  return {
    packetsPath: resolve(
      values.get("packets") ?? `${DEFAULT_ROOT}/french-packets.jsonl`
    ),
    entityPacketsPath: resolve(
      values.get("entity-packets") ?? DEFAULT_ENTITY_PACKETS
    ),
    reviewsPath: resolve(
      values.get("reviews") ?? `${DEFAULT_ROOT}/french-review.jsonl`
    ),
    proposerAViewsPath: resolve(
      values.get("proposer-a-views") ??
        `${DEFAULT_ROOT}/work/proposer-a-input.jsonl`
    ),
    proposerBViewsPath: resolve(
      values.get("proposer-b-views") ??
        `${DEFAULT_ROOT}/work/proposer-b-input.jsonl`
    ),
    configurationPath: resolve(
      values.get("configuration") ?? `${DEFAULT_ROOT}/configuration.json`
    ),
    canonicalEntitiesPath: resolve(
      values.get("canonical-entities") ??
        `${DEFAULT_ENTITY_RESOLVED}/canonical-entities.jsonl`
    ),
    canonicalEntryPoliciesPath: resolve(
      values.get("canonical-entry-policies") ??
        `${DEFAULT_ENTITY_RESOLVED}/canonical-entry-name-policies.jsonl`
    ),
    entityMergeAttestationPath: resolve(
      values.get("entity-merge-attestation") ??
        `${DEFAULT_ENTITY_RESOLVED}/entity-merge-attestation.json`
    ),
    entityGatePath: resolve(
      values.get("entity-gate") ?? `${DEFAULT_ENTITY_RESOLVED}/entity-gate.json`
    ),
    entityMentionsPath: resolve(
      values.get("entity-mentions") ??
        `${DEFAULT_ENTITY_RESOLVED}/required-entity-mentions.json`
    ),
    entityMentionResolutionAttestationPath: resolve(
      values.get("entity-mention-resolution-attestation") ??
        DEFAULT_ENTITY_MENTION_RESOLUTION_ATTESTATION
    ),
    outputRoot,
    finalReviewPath: resolve(
      values.get("final-review") ?? resolve(outputRoot, "french-review.jsonl")
    ),
    summaryPath: resolve(
      values.get("summary") ?? resolve(outputRoot, "run.summary.json")
    ),
    maxRounds: Number(values.get("max-rounds") ?? 3),
    maxCombinedBytes,
    concurrency: Number(values.get("concurrency") ?? 4),
    maxAttempts: Number(values.get("max-attempts") ?? 2),
    timeoutMs: Number(values.get("timeout-ms") ?? 20 * 60 * 1000),
    codexBinary: resolve(values.get("codex-binary") ?? DEFAULT_CODEX_BINARY),
    codexHome: resolve(values.get("codex-home") ?? DEFAULT_CODEX_HOME),
    expectedCodexVersion: values.get("codex-version") ?? DEFAULT_CODEX_VERSION,
    expectedCodexSha256: values.get("codex-sha256") ?? DEFAULT_CODEX_SHA256,
    proposerAModel: values.get("a-model") ?? "gpt-5.6-luna",
    proposerAReasoningEffort: values.get("a-reasoning-effort") ?? "medium",
    proposerBModel: values.get("b-model") ?? "gpt-5.6-sol",
    proposerBReasoningEffort: values.get("b-reasoning-effort") ?? "low",
    arbiterModel: values.get("arbiter-model") ?? "gpt-5.6-terra",
    arbiterReasoningEffort: values.get("arbiter-reasoning-effort") ?? "medium",
    auditorModel: values.get("auditor-model") ?? "gpt-5.6-sol",
    auditorReasoningEffort: values.get("auditor-reasoning-effort") ?? "medium"
  };
}

function assertOptions(
  options: RunLexiconV3FrenchInternalRemediationOptions
): void {
  if (
    !Number.isInteger(options.maxRounds) ||
    options.maxRounds < 1 ||
    options.maxRounds > 10 ||
    !Number.isSafeInteger(options.maxCombinedBytes) ||
    options.maxCombinedBytes < 1 ||
    options.maxCombinedBytes > DEFAULT_MAX_COMBINED_BYTES ||
    !Number.isInteger(options.concurrency) ||
    options.concurrency < 1 ||
    options.concurrency > 16 ||
    !Number.isInteger(options.maxAttempts) ||
    options.maxAttempts < 1 ||
    options.maxAttempts > 5 ||
    !Number.isFinite(options.timeoutMs) ||
    options.timeoutMs < 1
  ) {
    throw new Error("french-remediation-run-options-invalid");
  }
  if (
    resolve(options.outputRoot) === resolve(options.reviewsPath) ||
    resolve(options.outputRoot) === resolve(options.entityPacketsPath) ||
    resolve(options.finalReviewPath) === resolve(options.reviewsPath) ||
    resolve(options.finalReviewPath) === resolve(options.entityPacketsPath) ||
    resolve(options.summaryPath) === resolve(options.reviewsPath) ||
    resolve(options.summaryPath) === resolve(options.entityPacketsPath) ||
    resolve(options.finalReviewPath) === resolve(options.summaryPath)
  ) {
    throw new Error("french-remediation-run-output-input-collision");
  }
}

export interface FrenchInternalRemediationEntityPacketSelectionProof {
  selectedEntries: number;
  entityEntries: number;
  releaseKey: string;
  releaseSnapshotFingerprint: string;
}

export function assertFrenchInternalRemediationEntityPacketSelection(input: {
  selectedPackets: readonly LexiconV3FrenchPacket[];
  entityPackets: readonly LexiconV3FrenchPacket[];
  releaseKey: string;
  releaseSnapshotFingerprint: string;
}): FrenchInternalRemediationEntityPacketSelectionProof {
  if (input.selectedPackets.length < 1 || input.entityPackets.length < 1) {
    throw new Error("french-remediation-entity-packets-empty");
  }
  const entityPacketByKey = new Map<string, LexiconV3FrenchPacket>();
  for (const packet of input.entityPackets) {
    if (entityPacketByKey.has(packet.entryKey)) {
      throw new Error(
        `french-remediation-entity-packet-duplicate:${packet.entryKey}`
      );
    }
    if (
      packet.englishRelease.releaseKey !== input.releaseKey ||
      packet.englishRelease.releaseSnapshotFingerprint !==
        input.releaseSnapshotFingerprint
    ) {
      throw new Error(
        `french-remediation-entity-packet-lineage-invalid:${packet.entryKey}`
      );
    }
    entityPacketByKey.set(packet.entryKey, packet);
  }
  for (const packet of input.selectedPackets) {
    const entityPacket = entityPacketByKey.get(packet.entryKey);
    if (!entityPacket || entityPacket.packetHash !== packet.packetHash) {
      throw new Error(
        `french-remediation-entity-packet-selection-drift:${packet.entryKey}`
      );
    }
  }
  return {
    selectedEntries: input.selectedPackets.length,
    entityEntries: input.entityPackets.length,
    releaseKey: input.releaseKey,
    releaseSnapshotFingerprint: input.releaseSnapshotFingerprint
  };
}

function assertFrenchInternalRemediationEntityArtifactBoundary(input: {
  options: RunLexiconV3FrenchInternalRemediationOptions;
  configuration: FrenchInternalAssemblyConfigurationFile;
  releaseKey: string;
  releaseSnapshotFingerprint: string;
  quarantinedEntryKeys: string[];
}): void {
  const selectedPackets = readFrenchInternalPackets(
    input.options.packetsPath
  ).records;
  const entityPackets = readFrenchInternalPackets(
    input.options.entityPacketsPath
  ).records;
  assertFrenchInternalRemediationEntityPacketSelection({
    selectedPackets,
    entityPackets,
    releaseKey: input.releaseKey,
    releaseSnapshotFingerprint: input.releaseSnapshotFingerprint
  });

  const canonicalEntities = readJsonlArtifact<FrenchCanonicalEntityRecord>(
    input.options.canonicalEntitiesPath,
    "canonical-entities"
  );
  const canonicalEntryPolicies =
    readJsonlArtifact<FrenchCanonicalEntryNamePolicy>(
      input.options.canonicalEntryPoliciesPath,
      "canonical-entry-policies"
    );
  const entityGate = readJsonArtifact<FrenchEntityCanonicalizationGateResult>(
    input.options.entityGatePath,
    "entity-gate"
  );
  const entityMentions = readJsonArtifact<FrenchEntityMentionsArtifact>(
    input.options.entityMentionsPath,
    "entity-mentions"
  );
  const entityMentionResolutionAttestation =
    readJsonArtifact<FrenchEntityMentionResolutionAttestation>(
      input.options.entityMentionResolutionAttestationPath,
      "entity-mention-resolution-attestation"
    );
  const expectedHashes = input.configuration.configuration;
  for (const [label, actual, expected] of [
    [
      "canonical-entities",
      sha256File(input.options.canonicalEntitiesPath),
      expectedHashes.canonicalEntitiesHash
    ],
    [
      "canonical-entry-policies",
      sha256File(input.options.canonicalEntryPoliciesPath),
      expectedHashes.canonicalEntryPoliciesHash
    ],
    [
      "entity-merge-attestation",
      sha256File(input.options.entityMergeAttestationPath),
      expectedHashes.entityMergeAttestationHash
    ],
    [
      "entity-gate",
      sha256File(input.options.entityGatePath),
      expectedHashes.entityGateHash
    ],
    [
      "entity-mentions",
      sha256File(input.options.entityMentionsPath),
      expectedHashes.entityMentionsHash
    ]
  ] as const) {
    if (actual !== expected) {
      throw new Error(`french-remediation-entity-artifact-drift:${label}`);
    }
  }
  assertFrenchEntityPipelineArtifacts({
    entityGate,
    entityMentions,
    canonicalEntities,
    canonicalEntryPolicies,
    packets: entityPackets,
    quarantinedEntryKeys: input.quarantinedEntryKeys,
    mentionResolutionAttestation: entityMentionResolutionAttestation,
    allowConfigurationPinnedResolution: true
  });
}

function readJsonArtifact<T>(path: string, label: string): T {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    throw new Error(
      `french-remediation-${label}-invalid-json:${resolve(path)}`
    );
  }
}

function readJsonlArtifact<T>(path: string, label: string): T[] {
  const records: T[] = [];
  for (const [index, line] of readFileSync(path, "utf8")
    .split(/\r?\n/u)
    .entries()) {
    if (!line.trim()) continue;
    try {
      records.push(JSON.parse(line) as T);
    } catch {
      throw new Error(
        `french-remediation-${label}-invalid-json:${resolve(path)}:${index + 1}`
      );
    }
  }
  if (records.length === 0) {
    throw new Error(`french-remediation-${label}-empty:${resolve(path)}`);
  }
  return records;
}

function assertRequiredFiles(paths: readonly string[]): void {
  const missing = paths.filter((path) => !existsSync(path));
  if (missing.length > 0) {
    throw new Error(
      `french-remediation-run-input-missing:${missing.join(",")}`
    );
  }
}

function acquireRunLock(path: string): () => void {
  mkdirSync(dirname(path), { recursive: true });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const descriptor = openSync(path, "wx", 0o600);
      try {
        writeFileSync(
          descriptor,
          `${JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() })}\n`
        );
      } finally {
        closeSync(descriptor);
      }
      let released = false;
      return () => {
        if (!released) rmSync(path, { force: true });
        released = true;
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const owner = readLockOwner(path);
      if (owner !== null && processIsAlive(owner)) {
        throw new Error(`french-remediation-run-locked:${path}:${owner}`);
      }
      rmSync(path, { force: true });
    }
  }
  throw new Error(`french-remediation-run-lock-unavailable:${path}`);
}

function readLockOwner(path: string): number | null {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as { pid?: unknown };
    return Number.isInteger(parsed.pid) && Number(parsed.pid) > 0
      ? Number(parsed.pid)
      : null;
  } catch {
    return null;
  }
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? "")).href) {
  runLexiconV3FrenchInternalRemediation(
    parseRunLexiconV3FrenchInternalRemediationArgs(process.argv.slice(2))
  )
    .then((summary) => {
      process.stdout.write(
        `${JSON.stringify(
          {
            event: "french-remediation-complete",
            rounds: summary.rounds.length,
            records: summary.finalReviews.records,
            residuals: summary.residuals.length,
            finalReview: summary.finalReviews.path,
            runHash: summary.runHash
          },
          null,
          2
        )}\n`
      );
    })
    .catch((error: unknown) => {
      process.stderr.write(
        `${basename(process.argv[1] ?? "runLexiconV3FrenchInternalRemediation")}: ${
          error instanceof Error ? error.stack : String(error)
        }\n`
      );
      process.exitCode = 1;
    });
}
