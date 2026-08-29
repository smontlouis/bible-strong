import { createHash } from "node:crypto";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";

import {
  finalizeFrenchInternalArbiterArtifact,
  finalizeFrenchInternalAuditorArtifact,
  frenchInternalRoleArtifactHash,
  FRENCH_INTERNAL_ARBITER_ARTIFACT_SCHEMA_VERSION,
  FRENCH_INTERNAL_AUDITOR_ARTIFACT_SCHEMA_VERSION,
  readFrenchInternalArbiterArtifacts,
  readFrenchInternalAssemblyConfiguration,
  readFrenchInternalPackets,
  readFrenchInternalProposerArtifacts,
  type FrenchInternalArbiterArtifact,
  type FrenchInternalAssemblyConfigurationFile,
  type FrenchInternalAuditorArtifact,
  type FrenchInternalProposerArtifact
} from "./assembleLexiconV3FrenchInternalReview.js";
import {
  assertFrenchInternalArbiterDraft,
  assertFrenchInternalAuditorDraft,
  FRENCH_INTERNAL_ARBITER_DRAFT_SCHEMA_VERSION,
  FRENCH_INTERNAL_AUDITOR_DRAFT_SCHEMA_VERSION,
  type FrenchInternalArbiterDraft,
  type FrenchInternalAuditorDraft
} from "../src/lexiconV3/frenchAgentDrafts.js";
import {
  buildFrenchHtmlTemplate,
  renderFrenchHtmlTemplate
} from "../src/lexiconV3/frenchHtmlRenderer.js";
import {
  canonicalFrenchInternalJson,
  hashFrenchInternalJson,
  type FrenchInternalAuditCheck
} from "../src/lexiconV3/frenchInternalReview.js";
import {
  FRENCH_PROPOSAL_SCHEMA_VERSION,
  type FrenchLexiconProposal,
  type FrenchValidationContext,
  type FrenchValidationResult,
  validateFrenchProposal
} from "../src/lexiconV3/frenchValidation.js";
import type { LexiconV3FrenchPacket } from "../src/lexiconV3/frenchPackets.js";

export const FRENCH_INTERNAL_ADJUDICATION_POLICY_VERSION =
  "lexicon-v3-french-internal-adjudication-policy@1" as const;
export const FRENCH_INTERNAL_ARBITER_VIEW_SCHEMA_VERSION =
  "lexicon-v3-french-internal-arbiter-input@1" as const;
export const FRENCH_INTERNAL_AUDITOR_VIEW_SCHEMA_VERSION =
  "lexicon-v3-french-internal-auditor-input@1" as const;
export const FRENCH_INTERNAL_ADJUDICATION_SUMMARY_SCHEMA_VERSION =
  "lexicon-v3-french-internal-adjudication-summary@1" as const;

const DEFAULT_ROOT = "outputs/lexicon-v3/fr-internal";
const DEFAULT_WORK_DIR = `${DEFAULT_ROOT}/work`;
const DEFAULT_PACKETS = `${DEFAULT_ROOT}/french-packets.jsonl`;
const DEFAULT_CONFIGURATION = `${DEFAULT_ROOT}/configuration.json`;
const DEFAULT_PROPOSER_A = `${DEFAULT_ROOT}/proposer-a.jsonl`;
const DEFAULT_PROPOSER_B = `${DEFAULT_ROOT}/proposer-b.jsonl`;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;

export const FRENCH_INTERNAL_REQUIRED_AUDIT_CHECKS: readonly FrenchInternalAuditCheck[] =
  [
    "identityExact",
    "semanticCoverage",
    "noSemanticAddition",
    "noSemanticOmission",
    "polarityModalityUncertaintyPreserved",
    "glossMorphologyConform",
    "properNamesAndTermsConform",
    "entityMentionsConform",
    "protectedContentPreserved",
    "htmlStructurePreserved",
    "naturalFrench",
    "siblingStepConsistency"
  ];

export interface FrenchInternalRenderedProposerWitness {
  role: "proposerA" | "proposerB";
  artifactHash: string;
  inputHash: string;
  agentId: string;
  taskName: string;
  completedAt: string;
  proposal: FrenchLexiconProposal;
  validation: FrenchValidationResult;
}

export interface FrenchInternalArbiterView {
  schemaVersion: typeof FRENCH_INTERNAL_ARBITER_VIEW_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_INTERNAL_ADJUDICATION_POLICY_VERSION;
  viewKind: "arbiter_exact_choice";
  role: "arbiter";
  entryKey: string;
  lineage: {
    packetHash: string;
    englishHash: string;
    generationConfigHash: string;
    proposerAArtifactHash: string;
    proposerBArtifactHash: string;
    proposerAInputHash: string;
    proposerBInputHash: string;
  };
  packet: LexiconV3FrenchPacket;
  proposalA: FrenchInternalRenderedProposerWitness;
  proposalB: FrenchInternalRenderedProposerWitness;
  decisionContract: {
    responseSchemaVersion: typeof FRENCH_INTERNAL_ARBITER_DRAFT_SCHEMA_VERSION;
    allowedSelections: ["proposalA", "proposalB"];
    allowedVerdicts: ["accept", "review_needed"];
    fusionAllowed: false;
    replacementProposalAllowed: false;
    acceptRequiresNoReasons: true;
  };
  viewHash: string;
}

export interface FrenchInternalAuditorView {
  schemaVersion: typeof FRENCH_INTERNAL_AUDITOR_VIEW_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_INTERNAL_ADJUDICATION_POLICY_VERSION;
  viewKind: "auditor_adversarial_check";
  role: "auditor";
  entryKey: string;
  lineage: {
    packetHash: string;
    englishHash: string;
    generationConfigHash: string;
    proposerAArtifactHash: string;
    proposerBArtifactHash: string;
    arbiterArtifactHash: string;
    arbiterInputHash: string;
  };
  packet: LexiconV3FrenchPacket;
  proposalA: FrenchInternalRenderedProposerWitness;
  proposalB: FrenchInternalRenderedProposerWitness;
  arbitration: {
    artifactHash: string;
    inputHash: string;
    agentId: string;
    taskName: string;
    completedAt: string;
    verdict: "accept" | "review_needed";
    selectedProposal: "proposalA" | "proposalB";
    reasons: string[];
    proposal: FrenchLexiconProposal;
    validation: FrenchValidationResult;
  };
  auditContract: {
    responseSchemaVersion: typeof FRENCH_INTERNAL_AUDITOR_DRAFT_SCHEMA_VERSION;
    allowedVerdicts: ["safe", "hold", "block"];
    requiredChecks: FrenchInternalAuditCheck[];
    safeRequiresAllChecksPass: true;
    safeRequiresNoReasons: true;
    safeMinimumConfidence: 0.9;
    replacementProposalAllowed: false;
  };
  viewHash: string;
}

export interface BuildFrenchInternalArbiterWorkOptions {
  packetsPath: string;
  proposerAPath: string;
  proposerBPath: string;
  configurationPath: string;
  selectionPath?: string;
  outputPath: string;
  summaryPath: string;
}

export interface FinalizeFrenchInternalArbiterDraftsOptions extends BuildFrenchInternalArbiterWorkOptions {
  viewsPath: string;
  draftsPath: string;
  agentId: string;
  taskName: string;
  completedAt: string;
}

export interface BuildFrenchInternalAuditorWorkOptions extends BuildFrenchInternalArbiterWorkOptions {
  arbiterViewsPath: string;
  arbiterPath: string;
}

export interface FinalizeFrenchInternalAuditorDraftsOptions extends BuildFrenchInternalAuditorWorkOptions {
  viewsPath: string;
  draftsPath: string;
  agentId: string;
  taskName: string;
  completedAt: string;
}

export interface FrenchInternalAdjudicationSummary {
  schemaVersion: typeof FRENCH_INTERNAL_ADJUDICATION_SUMMARY_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_INTERNAL_ADJUDICATION_POLICY_VERSION;
  operation:
    | "build-arbiter"
    | "finalize-arbiter"
    | "build-auditor"
    | "finalize-auditor";
  generationConfigHash: string;
  sourcePaths: Record<string, string>;
  sourceDigests: Record<string, string>;
  counts: {
    records: number;
    accepted?: number;
    reviewNeeded?: number;
    safe?: number;
    hold?: number;
    block?: number;
  };
  entryOrderHash: string;
  recordsLogicalDigest: string;
  outputDigest: string;
  summaryDigest: string;
}

interface CommonLoadedContext {
  configuration: FrenchInternalAssemblyConfigurationFile;
  packets: Map<string, LexiconV3FrenchPacket>;
  packetOrder: string[];
  proposerA: Map<string, FrenchInternalProposerArtifact>;
  proposerB: Map<string, FrenchInternalProposerArtifact>;
  keys: string[];
}

interface OutputRecord {
  entryKey: string;
}

async function main(): Promise<void> {
  const [command, ...tokens] = process.argv.slice(2);
  const args = parseArgs(tokens);
  if (command === "build-arbiter") {
    const result = await buildLexiconV3FrenchInternalArbiterWork({
      ...commonBuildOptions(args),
      outputPath: resolve(
        args.output ?? `${DEFAULT_WORK_DIR}/arbiter-input.jsonl`
      ),
      summaryPath: resolve(
        args.summary ?? `${DEFAULT_WORK_DIR}/arbiter-input.summary.json`
      )
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  if (command === "finalize-arbiter") {
    const outputPath = resolve(
      args.output ?? `${DEFAULT_WORK_DIR}/arbiter.jsonl`
    );
    const result = await finalizeLexiconV3FrenchInternalArbiterDrafts({
      ...commonBuildOptions(args),
      viewsPath: resolve(
        args.views ?? `${DEFAULT_WORK_DIR}/arbiter-input.jsonl`
      ),
      draftsPath: resolve(
        args.drafts ?? `${DEFAULT_WORK_DIR}/arbiter-drafts.jsonl`
      ),
      outputPath,
      summaryPath: resolve(args.summary ?? `${outputPath}.summary.json`),
      agentId: required(args, "agent-id"),
      taskName: required(args, "task-name"),
      completedAt: args["completed-at"] ?? new Date().toISOString()
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  if (command === "build-auditor") {
    const result = await buildLexiconV3FrenchInternalAuditorWork({
      ...commonBuildOptions(args),
      arbiterViewsPath: resolve(
        args["arbiter-views"] ?? `${DEFAULT_WORK_DIR}/arbiter-input.jsonl`
      ),
      arbiterPath: resolve(args.arbiter ?? `${DEFAULT_WORK_DIR}/arbiter.jsonl`),
      outputPath: resolve(
        args.output ?? `${DEFAULT_WORK_DIR}/auditor-input.jsonl`
      ),
      summaryPath: resolve(
        args.summary ?? `${DEFAULT_WORK_DIR}/auditor-input.summary.json`
      )
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  if (command === "finalize-auditor") {
    const outputPath = resolve(
      args.output ?? `${DEFAULT_WORK_DIR}/auditor.jsonl`
    );
    const result = await finalizeLexiconV3FrenchInternalAuditorDrafts({
      ...commonBuildOptions(args),
      arbiterViewsPath: resolve(
        args["arbiter-views"] ?? `${DEFAULT_WORK_DIR}/arbiter-input.jsonl`
      ),
      arbiterPath: resolve(args.arbiter ?? `${DEFAULT_WORK_DIR}/arbiter.jsonl`),
      viewsPath: resolve(
        args.views ?? `${DEFAULT_WORK_DIR}/auditor-input.jsonl`
      ),
      draftsPath: resolve(
        args.drafts ?? `${DEFAULT_WORK_DIR}/auditor-drafts.jsonl`
      ),
      outputPath,
      summaryPath: resolve(args.summary ?? `${outputPath}.summary.json`),
      agentId: required(args, "agent-id"),
      taskName: required(args, "task-name"),
      completedAt: args["completed-at"] ?? new Date().toISOString()
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  throw new Error(
    "usage: lexiconV3FrenchInternalAdjudication.ts <build-arbiter|finalize-arbiter|build-auditor|finalize-auditor> [options]"
  );
}

export async function buildLexiconV3FrenchInternalArbiterWork(
  options: BuildFrenchInternalArbiterWorkOptions
): Promise<FrenchInternalAdjudicationSummary> {
  assertOutputOptions(options);
  const loaded = loadCommonContext(options);
  const views = loaded.keys.map((entryKey) =>
    buildFrenchInternalArbiterView({
      packet: requiredMapValue(loaded.packets, entryKey, "packet"),
      proposerA: requiredMapValue(loaded.proposerA, entryKey, "proposerA"),
      proposerB: requiredMapValue(loaded.proposerB, entryKey, "proposerB"),
      configuration: loaded.configuration
    })
  );
  return await writeOperation({
    operation: "build-arbiter",
    records: views,
    outputPath: options.outputPath,
    summaryPath: options.summaryPath,
    generationConfigHash: loaded.configuration.generationConfigHash,
    sourcePaths: commonSourcePaths(options),
    counts: { records: views.length }
  });
}

export async function finalizeLexiconV3FrenchInternalArbiterDrafts(
  options: FinalizeFrenchInternalArbiterDraftsOptions
): Promise<FrenchInternalAdjudicationSummary> {
  assertOutputOptions(options);
  assertExecutionIdentity(
    options.agentId,
    options.taskName,
    options.completedAt
  );
  const loaded = loadCommonContext(options);
  const views = await readJsonlObjects<FrenchInternalArbiterView>(
    options.viewsPath,
    "arbiter-view"
  );
  const drafts = await readJsonlObjects<FrenchInternalArbiterDraft>(
    options.draftsPath,
    "arbiter-draft"
  );
  assertExactOrderedCoverage(loaded.keys, views, "arbiter-view");
  assertExactOrderedCoverage(loaded.keys, drafts, "arbiter-draft");
  const artifacts: FrenchInternalArbiterArtifact[] = [];
  let accepted = 0;
  for (let index = 0; index < loaded.keys.length; index += 1) {
    const entryKey = loaded.keys[index]!;
    const expectedView = buildFrenchInternalArbiterView({
      packet: requiredMapValue(loaded.packets, entryKey, "packet"),
      proposerA: requiredMapValue(loaded.proposerA, entryKey, "proposerA"),
      proposerB: requiredMapValue(loaded.proposerB, entryKey, "proposerB"),
      configuration: loaded.configuration
    });
    const view = views[index]!;
    assertExactView(view, expectedView, "arbiter");
    const draft = assertFrenchInternalArbiterDraft(
      drafts[index],
      entryKey,
      view.viewHash
    );
    if (draft.verdict === "accept") accepted += 1;
    artifacts.push(
      finalizeFrenchInternalArbiterArtifact({
        schemaVersion: FRENCH_INTERNAL_ARBITER_ARTIFACT_SCHEMA_VERSION,
        role: "arbiter",
        entryKey,
        packetHash: view.lineage.packetHash,
        englishHash: view.lineage.englishHash,
        generationConfigHash: view.lineage.generationConfigHash,
        inputHash: view.viewHash,
        agentId: options.agentId,
        taskName: options.taskName,
        completedAt: options.completedAt,
        verdict: draft.verdict,
        selectedProposal: draft.selectedProposal,
        reasons: [...draft.reasons]
      })
    );
  }
  return await writeOperation({
    operation: "finalize-arbiter",
    records: artifacts,
    outputPath: options.outputPath,
    summaryPath: options.summaryPath,
    generationConfigHash: loaded.configuration.generationConfigHash,
    sourcePaths: {
      ...commonSourcePaths(options),
      views: options.viewsPath,
      drafts: options.draftsPath
    },
    counts: {
      records: artifacts.length,
      accepted,
      reviewNeeded: artifacts.length - accepted
    }
  });
}

export async function buildLexiconV3FrenchInternalAuditorWork(
  options: BuildFrenchInternalAuditorWorkOptions
): Promise<FrenchInternalAdjudicationSummary> {
  assertOutputOptions(options);
  const loaded = loadAuditorContext(options);
  const views = loaded.common.keys.map((entryKey) =>
    buildFrenchInternalAuditorView({
      packet: requiredMapValue(loaded.common.packets, entryKey, "packet"),
      proposerA: requiredMapValue(
        loaded.common.proposerA,
        entryKey,
        "proposerA"
      ),
      proposerB: requiredMapValue(
        loaded.common.proposerB,
        entryKey,
        "proposerB"
      ),
      arbiterView: requiredMapValue(
        loaded.arbiterViews,
        entryKey,
        "arbiter-view"
      ),
      arbiter: requiredMapValue(loaded.arbiters, entryKey, "arbiter"),
      configuration: loaded.common.configuration
    })
  );
  return await writeOperation({
    operation: "build-auditor",
    records: views,
    outputPath: options.outputPath,
    summaryPath: options.summaryPath,
    generationConfigHash: loaded.common.configuration.generationConfigHash,
    sourcePaths: auditorSourcePaths(options),
    counts: { records: views.length }
  });
}

export async function finalizeLexiconV3FrenchInternalAuditorDrafts(
  options: FinalizeFrenchInternalAuditorDraftsOptions
): Promise<FrenchInternalAdjudicationSummary> {
  assertOutputOptions(options);
  assertExecutionIdentity(
    options.agentId,
    options.taskName,
    options.completedAt
  );
  const loaded = loadAuditorContext(options);
  const views = await readJsonlObjects<FrenchInternalAuditorView>(
    options.viewsPath,
    "auditor-view"
  );
  const drafts = await readJsonlObjects<FrenchInternalAuditorDraft>(
    options.draftsPath,
    "auditor-draft"
  );
  assertExactOrderedCoverage(loaded.common.keys, views, "auditor-view");
  assertExactOrderedCoverage(loaded.common.keys, drafts, "auditor-draft");
  const artifacts: FrenchInternalAuditorArtifact[] = [];
  const verdictCounts = { safe: 0, hold: 0, block: 0 };
  for (let index = 0; index < loaded.common.keys.length; index += 1) {
    const entryKey = loaded.common.keys[index]!;
    const expectedView = buildFrenchInternalAuditorView({
      packet: requiredMapValue(loaded.common.packets, entryKey, "packet"),
      proposerA: requiredMapValue(
        loaded.common.proposerA,
        entryKey,
        "proposerA"
      ),
      proposerB: requiredMapValue(
        loaded.common.proposerB,
        entryKey,
        "proposerB"
      ),
      arbiterView: requiredMapValue(
        loaded.arbiterViews,
        entryKey,
        "arbiter-view"
      ),
      arbiter: requiredMapValue(loaded.arbiters, entryKey, "arbiter"),
      configuration: loaded.common.configuration
    });
    const view = views[index]!;
    assertExactView(view, expectedView, "auditor");
    const draft = assertFrenchInternalAuditorDraft(
      drafts[index],
      entryKey,
      view.viewHash
    );
    verdictCounts[draft.verdict] += 1;
    artifacts.push(
      finalizeFrenchInternalAuditorArtifact({
        schemaVersion: FRENCH_INTERNAL_AUDITOR_ARTIFACT_SCHEMA_VERSION,
        role: "auditor",
        entryKey,
        packetHash: view.lineage.packetHash,
        englishHash: view.lineage.englishHash,
        generationConfigHash: view.lineage.generationConfigHash,
        inputHash: view.viewHash,
        agentId: options.agentId,
        taskName: options.taskName,
        completedAt: options.completedAt,
        verdict: draft.verdict,
        reasons: [...draft.reasons],
        confidence: draft.confidence,
        checks: { ...draft.checks }
      })
    );
  }
  return await writeOperation({
    operation: "finalize-auditor",
    records: artifacts,
    outputPath: options.outputPath,
    summaryPath: options.summaryPath,
    generationConfigHash: loaded.common.configuration.generationConfigHash,
    sourcePaths: {
      ...auditorSourcePaths(options),
      views: options.viewsPath,
      drafts: options.draftsPath
    },
    counts: {
      records: artifacts.length,
      ...verdictCounts
    }
  });
}

export function buildFrenchInternalArbiterView(input: {
  packet: LexiconV3FrenchPacket;
  proposerA: FrenchInternalProposerArtifact;
  proposerB: FrenchInternalProposerArtifact;
  configuration: FrenchInternalAssemblyConfigurationFile;
}): FrenchInternalArbiterView {
  assertProposerLineage(
    input.proposerA,
    "proposerA",
    input.packet,
    input.configuration.generationConfigHash
  );
  assertProposerLineage(
    input.proposerB,
    "proposerB",
    input.packet,
    input.configuration.generationConfigHash
  );
  if (input.proposerA.inputHash === input.proposerB.inputHash) {
    throw new Error(
      `french-adjudication-proposer-inputs-not-role-distinct:${input.packet.entryKey}`
    );
  }
  if (
    hashFrenchInternalJson(input.proposerA.requiredEntityMentions) !==
    hashFrenchInternalJson(input.proposerB.requiredEntityMentions)
  ) {
    throw new Error(
      `french-adjudication-proposer-entity-lineage-mismatch:${input.packet.entryKey}`
    );
  }
  const content: Omit<FrenchInternalArbiterView, "viewHash"> = {
    schemaVersion: FRENCH_INTERNAL_ARBITER_VIEW_SCHEMA_VERSION,
    policyVersion: FRENCH_INTERNAL_ADJUDICATION_POLICY_VERSION,
    viewKind: "arbiter_exact_choice",
    role: "arbiter",
    entryKey: input.packet.entryKey,
    lineage: {
      packetHash: input.packet.packetHash,
      englishHash: input.packet.english.contentHash,
      generationConfigHash: input.configuration.generationConfigHash,
      proposerAArtifactHash: input.proposerA.artifactHash,
      proposerBArtifactHash: input.proposerB.artifactHash,
      proposerAInputHash: input.proposerA.inputHash,
      proposerBInputHash: input.proposerB.inputHash
    },
    packet: input.packet,
    proposalA: renderProposerWitness(input.proposerA, input.packet),
    proposalB: renderProposerWitness(input.proposerB, input.packet),
    decisionContract: {
      responseSchemaVersion: FRENCH_INTERNAL_ARBITER_DRAFT_SCHEMA_VERSION,
      allowedSelections: ["proposalA", "proposalB"],
      allowedVerdicts: ["accept", "review_needed"],
      fusionAllowed: false,
      replacementProposalAllowed: false,
      acceptRequiresNoReasons: true
    }
  };
  return finalizeAdjudicationView(content);
}

export function buildFrenchInternalAuditorView(input: {
  packet: LexiconV3FrenchPacket;
  proposerA: FrenchInternalProposerArtifact;
  proposerB: FrenchInternalProposerArtifact;
  arbiterView: FrenchInternalArbiterView;
  arbiter: FrenchInternalArbiterArtifact;
  configuration: FrenchInternalAssemblyConfigurationFile;
}): FrenchInternalAuditorView {
  const expectedArbiterView = buildFrenchInternalArbiterView(input);
  assertExactView(input.arbiterView, expectedArbiterView, "arbiter");
  assertArbiterLineage(
    input.arbiter,
    input.packet,
    input.configuration.generationConfigHash,
    input.arbiterView.viewHash
  );
  const selected =
    input.arbiter.selectedProposal === "proposalA"
      ? expectedArbiterView.proposalA
      : expectedArbiterView.proposalB;
  const content: Omit<FrenchInternalAuditorView, "viewHash"> = {
    schemaVersion: FRENCH_INTERNAL_AUDITOR_VIEW_SCHEMA_VERSION,
    policyVersion: FRENCH_INTERNAL_ADJUDICATION_POLICY_VERSION,
    viewKind: "auditor_adversarial_check",
    role: "auditor",
    entryKey: input.packet.entryKey,
    lineage: {
      packetHash: input.packet.packetHash,
      englishHash: input.packet.english.contentHash,
      generationConfigHash: input.configuration.generationConfigHash,
      proposerAArtifactHash: input.proposerA.artifactHash,
      proposerBArtifactHash: input.proposerB.artifactHash,
      arbiterArtifactHash: input.arbiter.artifactHash,
      arbiterInputHash: input.arbiter.inputHash
    },
    packet: input.packet,
    proposalA: expectedArbiterView.proposalA,
    proposalB: expectedArbiterView.proposalB,
    arbitration: {
      artifactHash: input.arbiter.artifactHash,
      inputHash: input.arbiter.inputHash,
      agentId: input.arbiter.agentId,
      taskName: input.arbiter.taskName,
      completedAt: input.arbiter.completedAt,
      verdict: input.arbiter.verdict,
      selectedProposal: input.arbiter.selectedProposal,
      reasons: [...input.arbiter.reasons],
      proposal: selected.proposal,
      validation: selected.validation
    },
    auditContract: {
      responseSchemaVersion: FRENCH_INTERNAL_AUDITOR_DRAFT_SCHEMA_VERSION,
      allowedVerdicts: ["safe", "hold", "block"],
      requiredChecks: [...FRENCH_INTERNAL_REQUIRED_AUDIT_CHECKS],
      safeRequiresAllChecksPass: true,
      safeRequiresNoReasons: true,
      safeMinimumConfidence: 0.9,
      replacementProposalAllowed: false
    }
  };
  return finalizeAdjudicationView(content);
}

export function frenchInternalAdjudicationViewHash(value: {
  viewHash?: string;
}): string {
  const { viewHash: _viewHash, ...content } = value;
  void _viewHash;
  return hashFrenchInternalJson(content);
}

export function finalizeAdjudicationView<
  T extends
    | Omit<FrenchInternalArbiterView, "viewHash">
    | Omit<FrenchInternalAuditorView, "viewHash">
>(value: T): T & { viewHash: string } {
  return { ...value, viewHash: hashFrenchInternalJson(value) };
}

function loadCommonContext(
  options: BuildFrenchInternalArbiterWorkOptions
): CommonLoadedContext {
  assertRequiredFiles([
    options.packetsPath,
    options.proposerAPath,
    options.proposerBPath,
    options.configurationPath,
    ...(options.selectionPath ? [options.selectionPath] : [])
  ]);
  const configuration = readFrenchInternalAssemblyConfiguration(
    options.configurationPath
  );
  const packetRecords = readFrenchInternalPackets(options.packetsPath).records;
  const proposerARecords = readFrenchInternalProposerArtifacts(
    options.proposerAPath,
    "proposerA"
  ).records;
  const proposerBRecords = readFrenchInternalProposerArtifacts(
    options.proposerBPath,
    "proposerB"
  ).records;
  const packets = uniqueMap(packetRecords, "packet");
  const proposerA = uniqueMap(proposerARecords, "proposerA");
  const proposerB = uniqueMap(proposerBRecords, "proposerB");
  assertSameKeySet(proposerA, proposerB, "proposerA", "proposerB");
  const keys = options.selectionPath
    ? readSelectionKeys(options.selectionPath)
    : packetRecords
        .map((packet) => packet.entryKey)
        .filter((entryKey) => proposerA.has(entryKey));
  if (keys.length === 0) throw new Error("empty-french-adjudication-scope");
  assertExactKeySet(keys, proposerA, "proposerA");
  assertExactKeySet(keys, proposerB, "proposerB");
  for (const entryKey of keys) {
    if (!packets.has(entryKey)) {
      throw new Error(`missing-french-adjudication-packet:${entryKey}`);
    }
  }
  return {
    configuration,
    packets,
    packetOrder: packetRecords.map((packet) => packet.entryKey),
    proposerA,
    proposerB,
    keys
  };
}

function loadAuditorContext(options: BuildFrenchInternalAuditorWorkOptions): {
  common: CommonLoadedContext;
  arbiterViews: Map<string, FrenchInternalArbiterView>;
  arbiters: Map<string, FrenchInternalArbiterArtifact>;
} {
  const common = loadCommonContext(options);
  assertRequiredFiles([options.arbiterViewsPath, options.arbiterPath]);
  const arbiterViewRecords = readJsonlObjectsSync<FrenchInternalArbiterView>(
    options.arbiterViewsPath,
    "arbiter-view"
  );
  const arbiterRecords = readFrenchInternalArbiterArtifacts(
    options.arbiterPath
  ).records;
  const arbiterViews = uniqueMap(arbiterViewRecords, "arbiter-view");
  const arbiters = uniqueMap(arbiterRecords, "arbiter");
  assertExactOrderedCoverage(common.keys, arbiterViewRecords, "arbiter-view");
  assertExactOrderedCoverage(common.keys, arbiterRecords, "arbiter");
  for (const entryKey of common.keys) {
    const expected = buildFrenchInternalArbiterView({
      packet: requiredMapValue(common.packets, entryKey, "packet"),
      proposerA: requiredMapValue(common.proposerA, entryKey, "proposerA"),
      proposerB: requiredMapValue(common.proposerB, entryKey, "proposerB"),
      configuration: common.configuration
    });
    assertExactView(
      requiredMapValue(arbiterViews, entryKey, "arbiter-view"),
      expected,
      "arbiter"
    );
    assertArbiterLineage(
      requiredMapValue(arbiters, entryKey, "arbiter"),
      requiredMapValue(common.packets, entryKey, "packet"),
      common.configuration.generationConfigHash,
      expected.viewHash
    );
  }
  return { common, arbiterViews, arbiters };
}

function renderProposerWitness(
  artifact: FrenchInternalProposerArtifact,
  packet: LexiconV3FrenchPacket
): FrenchInternalRenderedProposerWitness {
  const rendered = renderFrenchHtmlTemplate(
    buildFrenchHtmlTemplate(packet.english.meaningHtml),
    artifact.meaningSegmentsFr
  );
  const proposal: FrenchLexiconProposal = {
    schemaVersion: FRENCH_PROPOSAL_SCHEMA_VERSION,
    entryKey: packet.entryKey,
    derivedFromEnglishHash: packet.english.contentHash,
    model: `internal-agent/${artifact.agentId}`,
    glossFr: artifact.glossFr.trim(),
    meaningSegmentsFr: artifact.meaningSegmentsFr.map((segment) => ({
      id: segment.id,
      text: segment.text
    })),
    entityMentionsFr: artifact.entityMentionsFr.map((mention) => ({
      mentionId: mention.mentionId,
      segmentId: mention.segmentId,
      chosenFrenchForm: mention.chosenFrenchForm.trim()
    })),
    meaningFr: rendered.meaningFr,
    meaningHtmlFr: rendered.meaningHtmlFr,
    notesFr: artifact.notesFr.trim(),
    carrierTermsFr: artifact.carrierTermsFr.map((term) => term.trim()),
    confidence: artifact.confidence
  };
  return {
    role: artifact.role,
    artifactHash: artifact.artifactHash,
    inputHash: artifact.inputHash,
    agentId: artifact.agentId,
    taskName: artifact.taskName,
    completedAt: artifact.completedAt,
    proposal,
    validation: validateFrenchProposal(
      proposal,
      validationContext(packet, artifact.requiredEntityMentions)
    )
  };
}

function validationContext(
  packet: LexiconV3FrenchPacket,
  requiredEntityMentions: FrenchInternalProposerArtifact["requiredEntityMentions"]
): FrenchValidationContext {
  return {
    entryKey: packet.entryKey,
    englishHash: packet.english.contentHash,
    englishStatus: packet.english.status,
    englishGloss: packet.english.gloss,
    englishMeaning: packet.english.meaning,
    original: packet.identity.original,
    sourceStrongCodes: packet.protectedContent.strongCodes,
    sourceReferences: packet.protectedContent.references,
    legacyGloss: packet.evidence.legacy?.gloss,
    legacyMeaning: packet.evidence.legacy?.meaning,
    concordanceForms: packet.evidence.concordanceForms,
    requiredEntityMentions
  };
}

function assertProposerLineage(
  artifact: FrenchInternalProposerArtifact,
  role: "proposerA" | "proposerB",
  packet: LexiconV3FrenchPacket,
  generationConfigHash: string
): void {
  if (artifact.role !== role) {
    throw new Error(
      `french-adjudication-proposer-role-mismatch:${packet.entryKey}`
    );
  }
  assertArtifactHash(artifact, role);
  if (artifact.entryKey !== packet.entryKey) {
    throw new Error(
      `french-adjudication-proposer-entry-mismatch:${packet.entryKey}:${role}`
    );
  }
  if (artifact.packetHash !== packet.packetHash) {
    throw new Error(
      `french-adjudication-proposer-packet-stale:${packet.entryKey}:${role}`
    );
  }
  if (artifact.englishHash !== packet.english.contentHash) {
    throw new Error(
      `french-adjudication-proposer-english-stale:${packet.entryKey}:${role}`
    );
  }
  if (artifact.generationConfigHash !== generationConfigHash) {
    throw new Error(
      `french-adjudication-proposer-config-stale:${packet.entryKey}:${role}`
    );
  }
}

function assertArbiterLineage(
  artifact: FrenchInternalArbiterArtifact,
  packet: LexiconV3FrenchPacket,
  generationConfigHash: string,
  expectedInputHash: string
): void {
  assertArtifactHash(artifact, "arbiter");
  if (artifact.entryKey !== packet.entryKey) {
    throw new Error(
      `french-adjudication-arbiter-entry-mismatch:${packet.entryKey}`
    );
  }
  if (artifact.packetHash !== packet.packetHash) {
    throw new Error(
      `french-adjudication-arbiter-packet-stale:${packet.entryKey}`
    );
  }
  if (artifact.englishHash !== packet.english.contentHash) {
    throw new Error(
      `french-adjudication-arbiter-english-stale:${packet.entryKey}`
    );
  }
  if (artifact.generationConfigHash !== generationConfigHash) {
    throw new Error(
      `french-adjudication-arbiter-config-stale:${packet.entryKey}`
    );
  }
  if (artifact.inputHash !== expectedInputHash) {
    throw new Error(
      `french-adjudication-arbiter-input-stale:${packet.entryKey}`
    );
  }
  if (
    !(["proposalA", "proposalB"] as const).includes(artifact.selectedProposal)
  ) {
    throw new Error(
      `french-adjudication-arbiter-invalid-selection:${packet.entryKey}`
    );
  }
  if (artifact.verdict === "accept" && artifact.reasons.length > 0) {
    throw new Error(
      `french-adjudication-accepted-arbiter-has-reasons:${packet.entryKey}`
    );
  }
}

function assertArtifactHash(
  artifact:
    | FrenchInternalProposerArtifact
    | FrenchInternalArbiterArtifact
    | FrenchInternalAuditorArtifact,
  role: string
): void {
  if (
    !SHA256_PATTERN.test(artifact.artifactHash) ||
    artifact.artifactHash !== frenchInternalRoleArtifactHash(artifact)
  ) {
    throw new Error(
      `french-adjudication-artifact-hash-mismatch:${role}:${artifact.entryKey}`
    );
  }
}

function assertExactView<T extends { viewHash: string }>(
  actual: T,
  expected: T,
  role: "arbiter" | "auditor"
): void {
  if (
    !SHA256_PATTERN.test(actual.viewHash) ||
    actual.viewHash !== frenchInternalAdjudicationViewHash(actual)
  ) {
    throw new Error(
      `french-adjudication-${role}-view-hash-mismatch:${String((actual as T & { entryKey?: string }).entryKey ?? "unknown")}`
    );
  }
  if (
    canonicalFrenchInternalJson(actual) !==
    canonicalFrenchInternalJson(expected)
  ) {
    throw new Error(
      `french-adjudication-${role}-view-lineage-mismatch:${String((expected as T & { entryKey?: string }).entryKey ?? "unknown")}`
    );
  }
}

function readSelectionKeys(path: string): string[] {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch {
    throw new Error(`invalid-french-adjudication-selection-json:${path}`);
  }
  let raw: unknown;
  if (Array.isArray(value)) {
    raw = value;
  } else if (isObject(value) && Array.isArray(value.keys)) {
    raw = value.keys;
  } else if (
    isObject(value) &&
    isObject(value.selection) &&
    Array.isArray(value.selection.keys)
  ) {
    raw = value.selection.keys;
  } else if (isObject(value) && Array.isArray(value.shards)) {
    raw = value.shards.flatMap((shard) =>
      isObject(shard) && Array.isArray(shard.items)
        ? shard.items.map((item) =>
            isObject(item) ? item.entryKey : undefined
          )
        : [undefined]
    );
  } else if (isObject(value) && Array.isArray(value.items)) {
    raw = value.items.map((item) =>
      isObject(item) ? item.entryKey : undefined
    );
  } else {
    throw new Error(`invalid-french-adjudication-selection-shape:${path}`);
  }
  if (
    !Array.isArray(raw) ||
    raw.length === 0 ||
    raw.some((entryKey) => typeof entryKey !== "string" || !entryKey.trim())
  ) {
    throw new Error(`invalid-french-adjudication-selection-keys:${path}`);
  }
  const keys = raw as string[];
  if (new Set(keys).size !== keys.length) {
    throw new Error(`duplicate-french-adjudication-selection-key:${path}`);
  }
  return keys;
}

async function writeOperation<T extends OutputRecord>(input: {
  operation: FrenchInternalAdjudicationSummary["operation"];
  records: T[];
  outputPath: string;
  summaryPath: string;
  generationConfigHash: string;
  sourcePaths: Record<string, string>;
  counts: FrenchInternalAdjudicationSummary["counts"];
}): Promise<FrenchInternalAdjudicationSummary> {
  const outputText = `${input.records.map((record) => JSON.stringify(record)).join("\n")}\n`;
  const outputDigest = sha256(outputText);
  const resolvedSources = Object.fromEntries(
    Object.entries(input.sourcePaths).map(([key, path]) => [key, resolve(path)])
  );
  const sourceDigests = Object.fromEntries(
    await Promise.all(
      Object.entries(resolvedSources).map(async ([key, path]) => [
        key,
        await sha256File(path)
      ])
    )
  );
  const summaryWithoutDigest = {
    schemaVersion: FRENCH_INTERNAL_ADJUDICATION_SUMMARY_SCHEMA_VERSION,
    policyVersion: FRENCH_INTERNAL_ADJUDICATION_POLICY_VERSION,
    operation: input.operation,
    generationConfigHash: input.generationConfigHash,
    sourcePaths: {
      ...resolvedSources,
      output: resolve(input.outputPath)
    },
    sourceDigests,
    counts: input.counts,
    entryOrderHash: hashFrenchInternalJson(
      input.records.map((record) => record.entryKey)
    ),
    recordsLogicalDigest: hashFrenchInternalJson(
      input.records.map((record) => ({
        entryKey: record.entryKey,
        recordHash:
          "viewHash" in record
            ? String(record.viewHash)
            : "artifactHash" in record
              ? String(record.artifactHash)
              : hashFrenchInternalJson(record)
      }))
    ),
    outputDigest
  };
  const summary: FrenchInternalAdjudicationSummary = {
    ...summaryWithoutDigest,
    summaryDigest: hashFrenchInternalJson(summaryWithoutDigest)
  };
  writePairAtomic(
    input.outputPath,
    outputText,
    input.summaryPath,
    `${JSON.stringify(summary, null, 2)}\n`
  );
  return summary;
}

function uniqueMap<T extends { entryKey: string }>(
  records: T[],
  label: string
): Map<string, T> {
  const result = new Map<string, T>();
  for (const record of records) {
    if (result.has(record.entryKey)) {
      throw new Error(
        `duplicate-french-adjudication-${label}:${record.entryKey}`
      );
    }
    result.set(record.entryKey, record);
  }
  return result;
}

function assertSameKeySet<T, U>(
  left: Map<string, T>,
  right: Map<string, U>,
  leftLabel: string,
  rightLabel: string
): void {
  for (const key of left.keys()) {
    if (!right.has(key)) {
      throw new Error(`missing-french-adjudication-${rightLabel}:${key}`);
    }
  }
  for (const key of right.keys()) {
    if (!left.has(key)) {
      throw new Error(`missing-french-adjudication-${leftLabel}:${key}`);
    }
  }
}

function assertExactKeySet<T>(
  keys: string[],
  actual: Map<string, T>,
  label: string
): void {
  const expected = new Set(keys);
  if (expected.size !== keys.length) {
    throw new Error(`duplicate-french-adjudication-key:${label}`);
  }
  for (const key of expected) {
    if (!actual.has(key)) {
      throw new Error(`missing-french-adjudication-${label}:${key}`);
    }
  }
  for (const key of actual.keys()) {
    if (!expected.has(key)) {
      throw new Error(`unexpected-french-adjudication-${label}:${key}`);
    }
  }
}

function assertExactOrderedCoverage<T extends { entryKey: string }>(
  keys: string[],
  records: T[],
  label: string
): void {
  const seen = new Set<string>();
  for (const record of records) {
    if (seen.has(record.entryKey)) {
      throw new Error(
        `duplicate-french-adjudication-${label}:${record.entryKey}`
      );
    }
    seen.add(record.entryKey);
  }
  if (records.length !== keys.length) {
    const missing = keys.find((key) => !seen.has(key));
    if (missing) {
      throw new Error(`missing-french-adjudication-${label}:${missing}`);
    }
    throw new Error(`french-adjudication-${label}-coverage-mismatch`);
  }
  for (let index = 0; index < keys.length; index += 1) {
    if (records[index]?.entryKey !== keys[index]) {
      throw new Error(
        `french-adjudication-${label}-order-mismatch:${keys[index]}:${records[index]?.entryKey ?? "missing"}`
      );
    }
  }
}

function requiredMapValue<T>(
  map: Map<string, T>,
  key: string,
  label: string
): T {
  const value = map.get(key);
  if (!value) throw new Error(`missing-french-adjudication-${label}:${key}`);
  return value;
}

async function readJsonlObjects<T extends { entryKey: string }>(
  path: string,
  label: string
): Promise<T[]> {
  if (!existsSync(path))
    throw new Error(`missing-french-adjudication-input:${path}`);
  const records: T[] = [];
  const reader = createInterface({
    input: createReadStream(path, { encoding: "utf8" }),
    crlfDelay: Infinity
  });
  let lineNumber = 0;
  for await (const line of reader) {
    lineNumber += 1;
    if (!line.trim()) continue;
    let value: unknown;
    try {
      value = JSON.parse(line) as unknown;
    } catch {
      throw new Error(`invalid-jsonl:${path}:${lineNumber}`);
    }
    if (!isObject(value) || typeof value.entryKey !== "string") {
      throw new Error(
        `invalid-french-adjudication-${label}:${path}:${lineNumber}`
      );
    }
    records.push(value as unknown as T);
  }
  if (records.length === 0) {
    throw new Error(`empty-french-adjudication-${label}:${path}`);
  }
  return records;
}

function readJsonlObjectsSync<T extends { entryKey: string }>(
  path: string,
  label: string
): T[] {
  if (!existsSync(path))
    throw new Error(`missing-french-adjudication-input:${path}`);
  const records: T[] = [];
  const lines = readFileSync(path, "utf8").split(/\r?\n/u);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    if (!line.trim()) continue;
    let value: unknown;
    try {
      value = JSON.parse(line) as unknown;
    } catch {
      throw new Error(`invalid-jsonl:${path}:${index + 1}`);
    }
    if (!isObject(value) || typeof value.entryKey !== "string") {
      throw new Error(
        `invalid-french-adjudication-${label}:${path}:${index + 1}`
      );
    }
    records.push(value as unknown as T);
  }
  if (records.length === 0) {
    throw new Error(`empty-french-adjudication-${label}:${path}`);
  }
  return records;
}

function commonBuildOptions(
  args: Record<string, string>
): Omit<BuildFrenchInternalArbiterWorkOptions, "outputPath" | "summaryPath"> {
  return {
    packetsPath: resolve(args.packets ?? DEFAULT_PACKETS),
    proposerAPath: resolve(args["proposer-a"] ?? DEFAULT_PROPOSER_A),
    proposerBPath: resolve(args["proposer-b"] ?? DEFAULT_PROPOSER_B),
    configurationPath: resolve(args.configuration ?? DEFAULT_CONFIGURATION),
    selectionPath: args.selection ? resolve(args.selection) : undefined
  };
}

function commonSourcePaths(
  options: BuildFrenchInternalArbiterWorkOptions
): Record<string, string> {
  return {
    packets: options.packetsPath,
    proposerA: options.proposerAPath,
    proposerB: options.proposerBPath,
    configuration: options.configurationPath,
    ...(options.selectionPath ? { selection: options.selectionPath } : {})
  };
}

function auditorSourcePaths(
  options: BuildFrenchInternalAuditorWorkOptions
): Record<string, string> {
  return {
    ...commonSourcePaths(options),
    arbiterViews: options.arbiterViewsPath,
    arbiter: options.arbiterPath
  };
}

function assertOutputOptions<
  T extends {
    outputPath: string;
    summaryPath: string;
  }
>(options: T): void {
  const outputPath = resolve(options.outputPath);
  const summaryPath = resolve(options.summaryPath);
  if (outputPath === summaryPath) {
    throw new Error("french-adjudication-output-path-collision");
  }
  for (const [key, value] of Object.entries(
    options as Record<string, unknown>
  )) {
    if (
      !key.endsWith("Path") ||
      key === "outputPath" ||
      key === "summaryPath"
    ) {
      continue;
    }
    if (
      typeof value === "string" &&
      [outputPath, summaryPath].includes(resolve(value))
    ) {
      throw new Error(`french-adjudication-output-overwrites-input:${key}`);
    }
  }
}

function assertExecutionIdentity(
  agentId: string,
  taskName: string,
  completedAt: string
): void {
  if (!agentId.trim()) throw new Error("missing-french-adjudication-agent-id");
  if (!taskName.trim())
    throw new Error("missing-french-adjudication-task-name");
  if (!Number.isFinite(Date.parse(completedAt))) {
    throw new Error("invalid-french-adjudication-completed-at");
  }
}

function assertRequiredFiles(paths: string[]): void {
  for (const path of paths) {
    if (!existsSync(path))
      throw new Error(`missing-french-adjudication-input:${path}`);
  }
}

async function sha256File(path: string): Promise<string> {
  return await new Promise((resolveHash, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolveHash(hash.digest("hex")));
  });
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function writePairAtomic(
  outputPath: string,
  outputText: string,
  summaryPath: string,
  summaryText: string
): void {
  mkdirSync(dirname(outputPath), { recursive: true });
  mkdirSync(dirname(summaryPath), { recursive: true });
  const nonce = `${process.pid}-${Date.now()}`;
  const outputTemp = `${outputPath}.tmp-${nonce}`;
  const summaryTemp = `${summaryPath}.tmp-${nonce}`;
  const outputBackup = `${outputPath}.bak-${nonce}`;
  const summaryBackup = `${summaryPath}.bak-${nonce}`;
  const outputExisted = existsSync(outputPath);
  const summaryExisted = existsSync(summaryPath);
  let outputBackedUp = false;
  let summaryBackedUp = false;
  let outputInstalled = false;
  let summaryInstalled = false;
  try {
    writeFileSync(outputTemp, outputText, "utf8");
    writeFileSync(summaryTemp, summaryText, "utf8");
    if (outputExisted) {
      renameSync(outputPath, outputBackup);
      outputBackedUp = true;
    }
    if (summaryExisted) {
      renameSync(summaryPath, summaryBackup);
      summaryBackedUp = true;
    }
    renameSync(outputTemp, outputPath);
    outputInstalled = true;
    renameSync(summaryTemp, summaryPath);
    summaryInstalled = true;
    rmSync(outputBackup, { force: true });
    rmSync(summaryBackup, { force: true });
  } catch (error) {
    rmSync(outputTemp, { force: true });
    rmSync(summaryTemp, { force: true });
    if (outputInstalled) rmSync(outputPath, { force: true });
    if (summaryInstalled) rmSync(summaryPath, { force: true });
    if (outputBackedUp) renameSync(outputBackup, outputPath);
    if (summaryBackedUp) renameSync(summaryBackup, summaryPath);
    throw error;
  }
}

function parseArgs(values: string[]): Record<string, string> {
  const allowed = new Set([
    "packets",
    "proposer-a",
    "proposer-b",
    "configuration",
    "selection",
    "arbiter-views",
    "arbiter",
    "views",
    "drafts",
    "output",
    "summary",
    "agent-id",
    "task-name",
    "completed-at"
  ]);
  const result: Record<string, string> = {};
  for (let index = 0; index < values.length; index += 1) {
    const token = values[index] ?? "";
    if (!token.startsWith("--"))
      throw new Error(`unexpected-argument:${token}`);
    const key = token.slice(2);
    if (!allowed.has(key)) throw new Error(`unknown-option:${key}`);
    const value = values[index + 1];
    if (!value || value.startsWith("--"))
      throw new Error(`missing-value:${key}`);
    result[key] = value;
    index += 1;
  }
  return result;
}

function required(values: Record<string, string>, key: string): string {
  const value = values[key];
  if (!value) throw new Error(`missing-required-option:${key}`);
  return value;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exitCode = 1;
  });
}
