import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { basename, isAbsolute, resolve } from "node:path";

import {
  FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE,
  canonicalFrenchInternalJson,
  type FrenchInternalApprovedExecutionProfile,
  type FrenchInternalReviewStatus
} from "./frenchInternalReview.js";
import {
  FRENCH_PILOT_BLIND_REAUDIT_SAMPLE_SIZE,
  type FrenchPilotBlindReauditManifest
} from "./frenchPilotBlindReaudit.js";

export const FRENCH_PILOT_QUALITY_GATE_SCHEMA_VERSION =
  "lexicon-v3-french-pilot-quality-gate@1" as const;
export const FRENCH_PILOT_QUALITY_GATE_POLICY_VERSION =
  "lexicon-v3-french-pilot-quality-gate-policy@1" as const;
export const FRENCH_PILOT_QUALITY_GATE_EXPECTED_ENTRIES = 300 as const;

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const SOURCE_LABELS = [
  "pilotManifest",
  "pilotSelection",
  "selectedPackets",
  "configuration",
  "proposerSummary",
  "adjudicationSummary",
  "executionReceipts",
  "executionReceiptsSummary",
  "assembledReview",
  "assemblySummary",
  "remediationSummary",
  "finalReview",
  "blindReauditManifest",
  "blindReauditSummary",
  "blindReauditReceipts",
  "blindReauditDecisions"
] as const;
const VIOLATION_LABELS = [
  "identity",
  "protectedContent",
  "source",
  "html",
  "structural",
  "validator",
  "audit",
  "sibling"
] as const;
const ROLE_LABELS = ["proposerA", "proposerB", "arbiter", "auditor"] as const;

export type FrenchPilotQualityGateSourceLabel = (typeof SOURCE_LABELS)[number];
export type FrenchPilotQualityGateViolationLabel =
  (typeof VIOLATION_LABELS)[number];
export type FrenchPilotQualityGateRole = (typeof ROLE_LABELS)[number];

export interface FrenchPilotQualityGateSourceArtifact {
  path: string;
  sha256: string;
  bytes: number;
}

export interface FrenchPilotQualityGateStratumMetric {
  selected: number;
  autoValidated: number;
  validatorClean: number;
  auditorSafe: number;
  siblingConsistent: number;
  passRate: number;
}

export interface FrenchPilotQualityGateContent {
  schemaVersion: typeof FRENCH_PILOT_QUALITY_GATE_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_PILOT_QUALITY_GATE_POLICY_VERSION;
  status: "pass";
  generatedAt: string;
  lineage: {
    releaseKey: string;
    releaseSnapshotFingerprint: string;
    sourceLogicalDigest: string;
    packetSchemaVersion: "lexicon-v3-french-packet@3";
    pilotManifestHash: string;
    pilotSelectionHash: string;
    pilotKeyOrderHash: string;
    selectedPacketsLogicalDigest: string;
    generationConfigHash: string;
    approvedExecutionProfileHash: string;
  };
  sourceArtifacts: Record<
    FrenchPilotQualityGateSourceLabel,
    FrenchPilotQualityGateSourceArtifact
  >;
  /** Every receipt/manfiest/round artifact reached transitively from summaries. */
  transitiveArtifacts: Array<
    FrenchPilotQualityGateSourceArtifact & { label: string }
  >;
  coverage: {
    expectedEntries: typeof FRENCH_PILOT_QUALITY_GATE_EXPECTED_ENTRIES;
    selectedEntries: number;
    packetEntries: number;
    proposerAEntries: number;
    proposerBEntries: number;
    arbiterEntries: number;
    auditorEntries: number;
    assembledReviewEntries: number;
    finalReviewEntries: number;
    executionReceipts: number;
    expectedExecutionReceipts: number;
    exactSelection: true;
    exactPackets: true;
    exactRoleProofs: true;
    exactFinalReviews: true;
  };
  roles: {
    approvedExecutionProfile: FrenchInternalApprovedExecutionProfile;
    receiptsPerEntry: 4;
    fourDistinctRolesPerEntry: true;
    fourDistinctAgentsPerEntry: true;
    fourDistinctThreadsPerEntry: true;
    allReceiptsContentAddressed: true;
  };
  quality: {
    statusCounts: Record<FrenchInternalReviewStatus, number>;
    violationCounts: Record<FrenchPilotQualityGateViolationLabel, number>;
    strata: Record<string, Record<string, FrenchPilotQualityGateStratumMetric>>;
    allRequiredStrataRepresented: true;
  };
  remediation: {
    status: "complete";
    maxRounds: number;
    roundsUsed: number;
    residualEntries: 0;
    initialReviewLogicalDigest: string;
    finalReviewLogicalDigest: string;
    runHash: string;
  };
  blindReaudit: {
    status: "passed";
    sampleSize: typeof FRENCH_PILOT_BLIND_REAUDIT_SAMPLE_SIZE;
    safe: typeof FRENCH_PILOT_BLIND_REAUDIT_SAMPLE_SIZE;
    hold: 0;
    block: 0;
    violations: 0;
    freshAgainstPriorAgents: typeof FRENCH_PILOT_BLIND_REAUDIT_SAMPLE_SIZE;
    freshAgainstPriorThreads: typeof FRENCH_PILOT_BLIND_REAUDIT_SAMPLE_SIZE;
    manifestHash: string;
    selectionHash: string;
    summaryHash: string;
    receiptsLogicalDigest: string;
    decisionsLogicalDigest: string;
    strata: FrenchPilotBlindReauditManifest["selection"]["strataCounts"];
  };
}

export interface FrenchPilotQualityGate extends FrenchPilotQualityGateContent {
  gateHash: string;
}

export interface AssertFrenchPilotQualityGateOptions {
  verifySourceFiles?: boolean;
  requireContentAddressedPath?: string;
  expectedReleaseKey?: string;
  expectedReleaseSnapshotFingerprint?: string;
  expectedSourceLogicalDigest?: string;
  expectedGenerationConfigHash?: string;
  expectedPilotManifestHash?: string;
  expectedPilotSelectionHash?: string;
  expectedPilotKeyOrderHash?: string;
  expectedSelectedPacketsLogicalDigest?: string;
}

export function frenchPilotQualityGateHash(
  gate:
    | FrenchPilotQualityGateContent
    | Omit<FrenchPilotQualityGate, "gateHash">
    | FrenchPilotQualityGate
): string {
  const { gateHash: _gateHash, ...content } = gate as FrenchPilotQualityGate;
  void _gateHash;
  return sha256(canonicalFrenchInternalJson(content));
}

export function finalizeFrenchPilotQualityGate(
  content: FrenchPilotQualityGateContent
): FrenchPilotQualityGate {
  return { ...content, gateHash: frenchPilotQualityGateHash(content) };
}

export function frenchPilotQualityGateFilename(gateHash: string): string {
  if (!SHA256_PATTERN.test(gateHash)) {
    throw new Error("french-pilot-quality-gate-hash-invalid");
  }
  return `pilot-quality-gate-${gateHash}.json`;
}

export function readFrenchPilotQualityGate(
  path: string,
  options: Omit<
    AssertFrenchPilotQualityGateOptions,
    "requireContentAddressedPath"
  > = {}
): FrenchPilotQualityGate {
  const absolutePath = resolve(path);
  if (!existsSync(absolutePath)) {
    throw new Error(`french-pilot-quality-gate-missing:${absolutePath}`);
  }
  const stat = lstatSync(absolutePath);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`french-pilot-quality-gate-not-regular:${absolutePath}`);
  }
  let gate: FrenchPilotQualityGate;
  try {
    gate = JSON.parse(
      readFileSync(absolutePath, "utf8")
    ) as FrenchPilotQualityGate;
  } catch {
    throw new Error(`french-pilot-quality-gate-invalid-json:${absolutePath}`);
  }
  assertFrenchPilotQualityGate(gate, {
    ...options,
    requireContentAddressedPath: absolutePath
  });
  return gate;
}

export function assertFrenchPilotQualityGate(
  gate: FrenchPilotQualityGate,
  options: AssertFrenchPilotQualityGateOptions = {}
): void {
  assertObject(gate, "french-pilot-quality-gate-invalid");
  assertExactKeys(
    gate,
    [
      "schemaVersion",
      "policyVersion",
      "status",
      "generatedAt",
      "lineage",
      "sourceArtifacts",
      "transitiveArtifacts",
      "coverage",
      "roles",
      "quality",
      "remediation",
      "blindReaudit",
      "gateHash"
    ],
    "french-pilot-quality-gate-keys-invalid"
  );
  if (
    gate.schemaVersion !== FRENCH_PILOT_QUALITY_GATE_SCHEMA_VERSION ||
    gate.policyVersion !== FRENCH_PILOT_QUALITY_GATE_POLICY_VERSION ||
    gate.status !== "pass" ||
    !isCanonicalIsoTimestamp(gate.generatedAt) ||
    !SHA256_PATTERN.test(gate.gateHash) ||
    frenchPilotQualityGateHash(gate) !== gate.gateHash
  ) {
    throw new Error("french-pilot-quality-gate-envelope-invalid");
  }
  assertLineage(gate);
  assertSources(gate, options.verifySourceFiles === true);
  assertCoverage(gate);
  assertRoles(gate);
  assertQuality(gate);
  assertRemediation(gate);
  assertBlindReaudit(gate);

  if (options.requireContentAddressedPath) {
    const absolute = resolve(options.requireContentAddressedPath);
    if (basename(absolute) !== frenchPilotQualityGateFilename(gate.gateHash)) {
      throw new Error("french-pilot-quality-gate-path-not-content-addressed");
    }
  }
  for (const [actual, expected, label] of [
    [gate.lineage.releaseKey, options.expectedReleaseKey, "release-key"],
    [
      gate.lineage.releaseSnapshotFingerprint,
      options.expectedReleaseSnapshotFingerprint,
      "release-snapshot"
    ],
    [
      gate.lineage.sourceLogicalDigest,
      options.expectedSourceLogicalDigest,
      "source-logical-digest"
    ],
    [
      gate.lineage.generationConfigHash,
      options.expectedGenerationConfigHash,
      "generation-config"
    ],
    [
      gate.lineage.pilotManifestHash,
      options.expectedPilotManifestHash,
      "pilot-manifest"
    ],
    [
      gate.lineage.pilotSelectionHash,
      options.expectedPilotSelectionHash,
      "pilot-selection"
    ],
    [
      gate.lineage.pilotKeyOrderHash,
      options.expectedPilotKeyOrderHash,
      "pilot-key-order"
    ],
    [
      gate.lineage.selectedPacketsLogicalDigest,
      options.expectedSelectedPacketsLogicalDigest,
      "selected-packets"
    ]
  ] as const) {
    if (expected !== undefined && actual !== expected) {
      throw new Error(`french-pilot-quality-gate-${label}-stale`);
    }
  }
}

function assertLineage(gate: FrenchPilotQualityGate): void {
  const lineage = gate.lineage;
  assertObject(lineage, "french-pilot-quality-gate-lineage-invalid");
  assertExactKeys(
    lineage,
    [
      "releaseKey",
      "releaseSnapshotFingerprint",
      "sourceLogicalDigest",
      "packetSchemaVersion",
      "pilotManifestHash",
      "pilotSelectionHash",
      "pilotKeyOrderHash",
      "selectedPacketsLogicalDigest",
      "generationConfigHash",
      "approvedExecutionProfileHash"
    ],
    "french-pilot-quality-gate-lineage-keys-invalid"
  );
  if (
    !lineage.releaseKey.trim() ||
    lineage.packetSchemaVersion !== "lexicon-v3-french-packet@3" ||
    [
      lineage.releaseSnapshotFingerprint,
      lineage.sourceLogicalDigest,
      lineage.pilotManifestHash,
      lineage.pilotSelectionHash,
      lineage.pilotKeyOrderHash,
      lineage.selectedPacketsLogicalDigest,
      lineage.generationConfigHash,
      lineage.approvedExecutionProfileHash
    ].some((hash) => !SHA256_PATTERN.test(hash)) ||
    lineage.approvedExecutionProfileHash !==
      sha256(
        canonicalFrenchInternalJson(FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE)
      )
  ) {
    throw new Error("french-pilot-quality-gate-lineage-invalid");
  }
}

function assertSources(
  gate: FrenchPilotQualityGate,
  verifyFiles: boolean
): void {
  assertObject(
    gate.sourceArtifacts,
    "french-pilot-quality-gate-sources-invalid"
  );
  assertExactKeys(
    gate.sourceArtifacts,
    SOURCE_LABELS,
    "french-pilot-quality-gate-source-set-invalid"
  );
  const paths = new Set<string>();
  for (const label of SOURCE_LABELS) {
    const artifact = gate.sourceArtifacts[label];
    assertObject(artifact, `french-pilot-quality-gate-source-invalid:${label}`);
    assertExactKeys(
      artifact,
      ["path", "sha256", "bytes"],
      `french-pilot-quality-gate-source-keys-invalid:${label}`
    );
    if (
      !isAbsolute(artifact.path) ||
      resolve(artifact.path) !== artifact.path ||
      !SHA256_PATTERN.test(artifact.sha256) ||
      !Number.isSafeInteger(artifact.bytes) ||
      artifact.bytes < 0 ||
      paths.has(artifact.path)
    ) {
      throw new Error(`french-pilot-quality-gate-source-invalid:${label}`);
    }
    paths.add(artifact.path);
    if (verifyFiles) {
      if (!existsSync(artifact.path)) {
        throw new Error(`french-pilot-quality-gate-source-missing:${label}`);
      }
      const stat = lstatSync(artifact.path);
      if (!stat.isFile() || stat.isSymbolicLink()) {
        throw new Error(
          `french-pilot-quality-gate-source-not-regular:${label}`
        );
      }
      const buffer = readFileSync(artifact.path);
      if (
        buffer.byteLength !== artifact.bytes ||
        sha256(buffer) !== artifact.sha256
      ) {
        throw new Error(`french-pilot-quality-gate-source-stale:${label}`);
      }
    }
  }
  if (
    !Array.isArray(gate.transitiveArtifacts) ||
    gate.transitiveArtifacts.length < 1
  ) {
    throw new Error("french-pilot-quality-gate-transitive-sources-invalid");
  }
  const labels = new Set<string>();
  for (const artifact of gate.transitiveArtifacts) {
    assertObject(
      artifact,
      "french-pilot-quality-gate-transitive-source-invalid"
    );
    assertExactKeys(
      artifact,
      ["label", "path", "sha256", "bytes"],
      "french-pilot-quality-gate-transitive-source-keys-invalid"
    );
    if (
      !artifact.label.trim() ||
      labels.has(artifact.label) ||
      !isAbsolute(artifact.path) ||
      resolve(artifact.path) !== artifact.path ||
      !SHA256_PATTERN.test(artifact.sha256) ||
      !Number.isSafeInteger(artifact.bytes) ||
      artifact.bytes < 0
    ) {
      throw new Error("french-pilot-quality-gate-transitive-source-invalid");
    }
    labels.add(artifact.label);
    if (verifyFiles) {
      if (!existsSync(artifact.path)) {
        throw new Error(
          `french-pilot-quality-gate-transitive-source-missing:${artifact.label}`
        );
      }
      const stat = lstatSync(artifact.path);
      if (!stat.isFile() || stat.isSymbolicLink()) {
        throw new Error(
          `french-pilot-quality-gate-transitive-source-not-regular:${artifact.label}`
        );
      }
      const buffer = readFileSync(artifact.path);
      if (
        buffer.byteLength !== artifact.bytes ||
        sha256(buffer) !== artifact.sha256
      ) {
        throw new Error(
          `french-pilot-quality-gate-transitive-source-stale:${artifact.label}`
        );
      }
    }
  }
}

function assertCoverage(gate: FrenchPilotQualityGate): void {
  const coverage = gate.coverage;
  assertObject(coverage, "french-pilot-quality-gate-coverage-invalid");
  assertExactKeys(
    coverage,
    [
      "expectedEntries",
      "selectedEntries",
      "packetEntries",
      "proposerAEntries",
      "proposerBEntries",
      "arbiterEntries",
      "auditorEntries",
      "assembledReviewEntries",
      "finalReviewEntries",
      "executionReceipts",
      "expectedExecutionReceipts",
      "exactSelection",
      "exactPackets",
      "exactRoleProofs",
      "exactFinalReviews"
    ],
    "french-pilot-quality-gate-coverage-keys-invalid"
  );
  const counts = [
    coverage.expectedEntries,
    coverage.selectedEntries,
    coverage.packetEntries,
    coverage.proposerAEntries,
    coverage.proposerBEntries,
    coverage.arbiterEntries,
    coverage.auditorEntries,
    coverage.assembledReviewEntries,
    coverage.finalReviewEntries
  ];
  if (
    counts.some(
      (count) => count !== FRENCH_PILOT_QUALITY_GATE_EXPECTED_ENTRIES
    ) ||
    coverage.expectedExecutionReceipts !==
      FRENCH_PILOT_QUALITY_GATE_EXPECTED_ENTRIES * ROLE_LABELS.length ||
    coverage.executionReceipts !== coverage.expectedExecutionReceipts ||
    coverage.exactSelection !== true ||
    coverage.exactPackets !== true ||
    coverage.exactRoleProofs !== true ||
    coverage.exactFinalReviews !== true
  ) {
    throw new Error("french-pilot-quality-gate-coverage-invalid");
  }
}

function assertRoles(gate: FrenchPilotQualityGate): void {
  const roles = gate.roles;
  assertObject(roles, "french-pilot-quality-gate-roles-invalid");
  assertExactKeys(
    roles,
    [
      "approvedExecutionProfile",
      "receiptsPerEntry",
      "fourDistinctRolesPerEntry",
      "fourDistinctAgentsPerEntry",
      "fourDistinctThreadsPerEntry",
      "allReceiptsContentAddressed"
    ],
    "french-pilot-quality-gate-roles-keys-invalid"
  );
  if (
    canonicalFrenchInternalJson(roles.approvedExecutionProfile) !==
      canonicalFrenchInternalJson(FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE) ||
    roles.receiptsPerEntry !== 4 ||
    roles.fourDistinctRolesPerEntry !== true ||
    roles.fourDistinctAgentsPerEntry !== true ||
    roles.fourDistinctThreadsPerEntry !== true ||
    roles.allReceiptsContentAddressed !== true
  ) {
    throw new Error("french-pilot-quality-gate-roles-invalid");
  }
}

function assertQuality(gate: FrenchPilotQualityGate): void {
  const quality = gate.quality;
  assertObject(quality, "french-pilot-quality-gate-quality-invalid");
  assertExactKeys(
    quality,
    [
      "statusCounts",
      "violationCounts",
      "strata",
      "allRequiredStrataRepresented"
    ],
    "french-pilot-quality-gate-quality-keys-invalid"
  );
  assertExactKeys(
    quality.statusCounts,
    ["auto_validated", "review_needed", "blocked_source_issue", "failed"],
    "french-pilot-quality-gate-status-counts-invalid"
  );
  if (
    quality.statusCounts.auto_validated !==
      FRENCH_PILOT_QUALITY_GATE_EXPECTED_ENTRIES ||
    quality.statusCounts.review_needed !== 0 ||
    quality.statusCounts.blocked_source_issue !== 0 ||
    quality.statusCounts.failed !== 0
  ) {
    throw new Error("french-pilot-quality-gate-residual-status");
  }
  assertExactKeys(
    quality.violationCounts,
    VIOLATION_LABELS,
    "french-pilot-quality-gate-violations-invalid"
  );
  if (VIOLATION_LABELS.some((label) => quality.violationCounts[label] !== 0)) {
    throw new Error("french-pilot-quality-gate-has-violations");
  }
  if (
    quality.allRequiredStrataRepresented !== true ||
    !quality.strata ||
    typeof quality.strata !== "object" ||
    Array.isArray(quality.strata) ||
    Object.keys(quality.strata).length === 0
  ) {
    throw new Error("french-pilot-quality-gate-strata-invalid");
  }
  for (const [dimension, values] of Object.entries(quality.strata)) {
    if (!dimension.trim() || Object.keys(values).length === 0) {
      throw new Error("french-pilot-quality-gate-strata-invalid");
    }
    for (const [value, metric] of Object.entries(values)) {
      assertObject(metric, "french-pilot-quality-gate-stratum-invalid");
      assertExactKeys(
        metric,
        [
          "selected",
          "autoValidated",
          "validatorClean",
          "auditorSafe",
          "siblingConsistent",
          "passRate"
        ],
        "french-pilot-quality-gate-stratum-keys-invalid"
      );
      if (
        !value.trim() ||
        !Number.isInteger(metric.selected) ||
        metric.selected < 1 ||
        metric.autoValidated !== metric.selected ||
        metric.validatorClean !== metric.selected ||
        metric.auditorSafe !== metric.selected ||
        metric.siblingConsistent !== metric.selected ||
        metric.passRate !== 1
      ) {
        throw new Error(
          `french-pilot-quality-gate-stratum-not-clean:${dimension}:${value}`
        );
      }
    }
  }
}

function assertRemediation(gate: FrenchPilotQualityGate): void {
  const remediation = gate.remediation;
  assertObject(remediation, "french-pilot-quality-gate-remediation-invalid");
  assertExactKeys(
    remediation,
    [
      "status",
      "maxRounds",
      "roundsUsed",
      "residualEntries",
      "initialReviewLogicalDigest",
      "finalReviewLogicalDigest",
      "runHash"
    ],
    "french-pilot-quality-gate-remediation-keys-invalid"
  );
  if (
    remediation.status !== "complete" ||
    !Number.isInteger(remediation.maxRounds) ||
    remediation.maxRounds < 1 ||
    !Number.isInteger(remediation.roundsUsed) ||
    remediation.roundsUsed < 0 ||
    remediation.roundsUsed > remediation.maxRounds ||
    remediation.residualEntries !== 0 ||
    [
      remediation.initialReviewLogicalDigest,
      remediation.finalReviewLogicalDigest,
      remediation.runHash
    ].some((hash) => !SHA256_PATTERN.test(hash))
  ) {
    throw new Error("french-pilot-quality-gate-remediation-invalid");
  }
}

function assertBlindReaudit(gate: FrenchPilotQualityGate): void {
  const audit = gate.blindReaudit;
  assertObject(audit, "french-pilot-quality-gate-blind-reaudit-invalid");
  assertExactKeys(
    audit,
    [
      "status",
      "sampleSize",
      "safe",
      "hold",
      "block",
      "violations",
      "freshAgainstPriorAgents",
      "freshAgainstPriorThreads",
      "manifestHash",
      "selectionHash",
      "summaryHash",
      "receiptsLogicalDigest",
      "decisionsLogicalDigest",
      "strata"
    ],
    "french-pilot-quality-gate-blind-reaudit-keys-invalid"
  );
  if (
    audit.status !== "passed" ||
    audit.sampleSize !== FRENCH_PILOT_BLIND_REAUDIT_SAMPLE_SIZE ||
    audit.safe !== FRENCH_PILOT_BLIND_REAUDIT_SAMPLE_SIZE ||
    audit.hold !== 0 ||
    audit.block !== 0 ||
    audit.violations !== 0 ||
    audit.freshAgainstPriorAgents !== FRENCH_PILOT_BLIND_REAUDIT_SAMPLE_SIZE ||
    audit.freshAgainstPriorThreads !== FRENCH_PILOT_BLIND_REAUDIT_SAMPLE_SIZE ||
    [
      audit.manifestHash,
      audit.selectionHash,
      audit.summaryHash,
      audit.receiptsLogicalDigest,
      audit.decisionsLogicalDigest
    ].some((hash) => !SHA256_PATTERN.test(hash)) ||
    !audit.strata ||
    typeof audit.strata !== "object" ||
    Array.isArray(audit.strata) ||
    Object.keys(audit.strata).length === 0
  ) {
    throw new Error("french-pilot-quality-gate-blind-reaudit-invalid");
  }
}

function assertExactKeys(
  value: unknown,
  expected: readonly string[],
  error: string
): void {
  assertObject(value, error);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (
    canonicalFrenchInternalJson(actual) !== canonicalFrenchInternalJson(wanted)
  ) {
    throw new Error(error);
  }
}

function assertObject(
  value: unknown,
  error: string
): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(error);
  }
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function isCanonicalIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}
