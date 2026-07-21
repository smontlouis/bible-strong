import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  assertSelectedPacketsMetadata,
  assertFrenchCodexPilotBatchManifest,
  FRENCH_CODEX_PILOT_BATCH_MANIFEST_SCHEMA_VERSION,
  frenchCodexPilotDraftOutputSchema,
  frenchCodexSelectedPacketsLogicalDigest,
  type FrenchCodexSelectedPacketsArtifact,
  type FrenchCodexReleaseLineage,
  type FrenchCodexPilotBatchManifest,
  type FrenchCodexPilotBatchRecord
} from "./buildLexiconV3FrenchCodexPilotBatches.js";
import {
  FRENCH_INTERNAL_PROMPT_VERSION,
  hashFrenchInternalJson
} from "../src/lexiconV3/frenchInternalReview.js";
import { readFrenchPilotQualityGate } from "../src/lexiconV3/frenchPilotQualityGate.js";
import {
  acquireFrenchCodexSqliteLock,
  FrenchCodexLockBusyError
} from "../src/lexiconV3/frenchCodexSqliteLock.js";
import {
  FRENCH_INTERNAL_PROPOSER_VIEW_SCHEMA_VERSION,
  FRENCH_INTERNAL_SHARDS_SCHEMA_VERSION,
  FRENCH_INTERNAL_SHARD_ITEM_SCHEMA_VERSION,
  FRENCH_INTERNAL_SHARD_SCHEMA_VERSION,
  FRENCH_INTERNAL_WORK_POLICY_VERSION,
  assertProposerABlindView,
  frenchInternalViewHash,
  hashFrenchInternalWorkJson,
  type FrenchInternalMeaningSize,
  type FrenchInternalProposerAView,
  type FrenchInternalProposerBView,
  type FrenchInternalShard,
  type FrenchInternalShardPlan
} from "../src/lexiconV3/frenchInternalWork.js";
import {
  validateFrenchPacket,
  type LexiconV3FrenchPacket
} from "../src/lexiconV3/frenchPackets.js";

export const FRENCH_CODEX_BATCH_MANIFEST_SCHEMA_VERSION =
  "lexicon-v3-french-codex-batches@4" as const;
export const FRENCH_CODEX_SELECTION_PROOF_SCHEMA_VERSION =
  "lexicon-v3-french-codex-selection-proof@3" as const;

const DEFAULT_ROOT = "outputs/lexicon-v3/fr-internal";
const DEFAULT_WORK = `${DEFAULT_ROOT}/work`;
const DEFAULT_PACKETS = `${DEFAULT_ROOT}/french-packets.jsonl`;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const SAFE_NAMESPACE_PATTERN =
  /^\/fr-internal\/(?:pilot|full|custom\/[a-z0-9][a-z0-9._-]*)$/u;
const SIZE_ORDER: readonly FrenchInternalMeaningSize[] = [
  "short",
  "medium",
  "long",
  "very_long"
];
const DEFAULT_MAX_ITEMS: Record<FrenchInternalMeaningSize, number> = {
  short: 20,
  medium: 8,
  long: 3,
  very_long: 1
};
const DEFAULT_MAX_COMBINED_BYTES = 300_000;

type Role = "proposerA" | "proposerB";
type View = FrenchInternalProposerAView | FrenchInternalProposerBView;
export type FrenchCodexRunKind = "full" | "custom";

interface FileArtifact {
  path: string;
  sha256: string;
  bytes: number;
}

export interface FrenchCodexPilotQualityGateArtifact extends FileArtifact {
  gateHash: string;
  generationConfigHash: string;
}

export interface FrenchCodexSelectionProof {
  schemaVersion: typeof FRENCH_CODEX_SELECTION_PROOF_SCHEMA_VERSION;
  runKind: FrenchCodexRunKind;
  namespace: string;
  sourceKind: "shards" | "keys";
  sourcePath: string;
  sourceFileHash: string;
  sourceContentHash: string;
  sourceLogicalDigest: string;
  releaseKey: string;
  releaseSnapshotFingerprint: string;
  expectedEntries: number;
  fullPlanEntries: number;
  exactFullCoverage: boolean;
  shardIds: string[];
  keys: string[];
  keyOrderHash: string;
  contentHash: string;
}

export interface FrenchCodexBatchManifest {
  schemaVersion: typeof FRENCH_CODEX_BATCH_MANIFEST_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_INTERNAL_WORK_POLICY_VERSION;
  promptVersion: typeof FRENCH_INTERNAL_PROMPT_VERSION;
  lineage: FrenchCodexReleaseLineage;
  runKind: FrenchCodexRunKind;
  namespace: string;
  outputRoot: string;
  selection: FrenchCodexSelectionProof;
  sourcePaths: {
    selection: string;
    proposerA: string;
    proposerB: string;
    packets: string;
  };
  sourceDigests: {
    selection: string;
    proposerA: string;
    proposerB: string;
    packets: string;
    selectionContentHash: string;
  };
  selectedPackets: FrenchCodexSelectedPacketsArtifact;
  pilotQualityGate: FrenchCodexPilotQualityGateArtifact | null;
  batching: {
    maxCombinedBytes: number;
    maxItems: Record<FrenchInternalMeaningSize, number>;
  };
  counts: {
    entries: number;
    batches: number;
    byMeaningSize: Record<FrenchInternalMeaningSize, number>;
  };
  batches: FrenchCodexPilotBatchRecord[];
  manifestHash: string;
}

export type FrenchCodexAnyBatchManifest =
  | FrenchCodexPilotBatchManifest
  | FrenchCodexBatchManifest;

export interface FrenchCodexManifestContext {
  runKind: "pilot" | FrenchCodexRunKind;
  namespace: string;
  expectedEntries: number;
  selectionHash: string;
  keyOrderHash: string;
  selectedPackets: FrenchCodexSelectedPacketsArtifact;
  lineage: FrenchCodexReleaseLineage;
  pilotQualityGate: FrenchCodexPilotQualityGateArtifact | null;
}

export interface FrenchCodexBatchManifestValidationOptions {
  verifyFiles?: boolean;
  expectedEntries?: number;
}

interface Options {
  runKind: FrenchCodexRunKind;
  namespace: string;
  selectionPath: string;
  proposerAPath: string;
  proposerBPath: string;
  packetsPath: string;
  pilotQualityGatePath?: string;
  outputDir: string;
  expectedEntries: number;
  maxCombinedBytes: number;
  maxItems: Record<FrenchInternalMeaningSize, number>;
  replaceExisting: boolean;
}

interface SelectedItem {
  entryKey: string;
  meaningSize: FrenchInternalMeaningSize;
  proposerA: FrenchInternalProposerAView;
  proposerB: FrenchInternalProposerBView;
  packet: LexiconV3FrenchPacket;
  shardId: string | null;
}

export function buildLexiconV3FrenchCodexBatches(
  options: Options
): FrenchCodexBatchManifest {
  assertOptions(options);
  const release = acquireLock(`${resolve(options.outputDir)}.lock`);
  try {
    return buildUnlocked(options);
  } finally {
    release();
  }
}

function buildUnlocked(options: Options): FrenchCodexBatchManifest {
  const selectionText = readFileSync(options.selectionPath, "utf8");
  const proposerAText = readFileSync(options.proposerAPath, "utf8");
  const proposerBText = readFileSync(options.proposerBPath, "utf8");
  const packetsText = readFileSync(options.packetsPath, "utf8");
  const proposerA = readViews(proposerAText, "proposerA");
  const proposerB = readViews(proposerBText, "proposerB");
  const selection = buildSelectionProof({
    runKind: options.runKind,
    namespace: options.namespace,
    selectionPath: options.selectionPath,
    selectionText,
    expectedEntries: options.expectedEntries,
    proposerA,
    proposerB
  });
  const pilotQualityGate = buildPilotQualityGateArtifact(options, selection);
  const selectedKeys = new Set(selection.keys);
  const packets = readPackets(packetsText, selectedKeys);
  const shardByKey = new Map<string, string>();
  if (selection.sourceKind === "shards") {
    const plan = parseShardPlan(selectionText);
    for (const shard of plan.shards) {
      for (const item of shard.items)
        shardByKey.set(item.entryKey, shard.shardId);
    }
  }
  const items = selection.keys.map((entryKey) => {
    const a = proposerA.get(entryKey) as
      | FrenchInternalProposerAView
      | undefined;
    const b = proposerB.get(entryKey) as
      | FrenchInternalProposerBView
      | undefined;
    const packet = packets.get(entryKey);
    if (!a || !b || !packet) {
      throw new Error(`french-codex-selection-source-missing:${entryKey}`);
    }
    if (
      a.workViewHash !== b.workViewHash ||
      a.lineage.packetHash !== packet.packetHash ||
      b.lineage.packetHash !== packet.packetHash ||
      a.lineage.englishHash !== packet.english.contentHash ||
      b.lineage.englishHash !== packet.english.contentHash
    ) {
      throw new Error(`french-codex-selection-lineage-stale:${entryKey}`);
    }
    assertSelectedItemLineage(selection, a, b, packet, entryKey);
    return {
      entryKey,
      meaningSize: a.translationProfile.meaningSize,
      proposerA: a,
      proposerB: b,
      packet,
      shardId: shardByKey.get(entryKey) ?? null
    } satisfies SelectedItem;
  });
  const groups =
    selection.sourceKind === "shards"
      ? groupBySealedShards(items, selection.shardIds, options)
      : groupCustom(items, options);
  const tempDir = `${resolve(options.outputDir)}.tmp-${process.pid}-${Date.now()}`;
  const backupDir = `${resolve(options.outputDir)}.bak-${process.pid}-${Date.now()}`;
  mkdirSync(tempDir, { recursive: true });
  try {
    const shardParts = new Map<string, number>();
    const batches = groups.map((group, index) => {
      const shardId = group[0]?.shardId;
      const nextPart = shardId ? (shardParts.get(shardId) ?? 0) + 1 : 0;
      const suffix = shardId
        ? `${shardId}-p${String(nextPart).padStart(3, "0")}`
        : `${group[0]!.meaningSize}-${String(index + 1).padStart(5, "0")}`;
      if (shardId) shardParts.set(shardId, nextPart);
      return writeBatch(
        tempDir,
        resolve(options.outputDir),
        options.runKind,
        suffix,
        group
      );
    });
    const selectedPackets = writeSelectedPacketsArtifact(
      tempDir,
      resolve(options.outputDir),
      items.map((item) => item.packet),
      selection
    );
    const byMeaningSize = Object.fromEntries(
      SIZE_ORDER.map((size) => [
        size,
        items.filter((item) => item.meaningSize === size).length
      ])
    ) as Record<FrenchInternalMeaningSize, number>;
    const content = {
      schemaVersion: FRENCH_CODEX_BATCH_MANIFEST_SCHEMA_VERSION,
      policyVersion: FRENCH_INTERNAL_WORK_POLICY_VERSION,
      promptVersion: FRENCH_INTERNAL_PROMPT_VERSION,
      lineage: {
        releaseKey: selection.releaseKey,
        releaseSnapshotFingerprint: selection.releaseSnapshotFingerprint,
        sourceLogicalDigest: selection.sourceLogicalDigest
      },
      runKind: options.runKind,
      namespace: options.namespace,
      outputRoot: resolve(options.outputDir),
      selection,
      sourcePaths: {
        selection: resolve(options.selectionPath),
        proposerA: resolve(options.proposerAPath),
        proposerB: resolve(options.proposerBPath),
        packets: resolve(options.packetsPath)
      },
      sourceDigests: {
        selection: sha256(selectionText),
        proposerA: sha256(proposerAText),
        proposerB: sha256(proposerBText),
        packets: sha256(packetsText),
        selectionContentHash: selection.contentHash
      },
      selectedPackets,
      pilotQualityGate,
      batching: {
        maxCombinedBytes: options.maxCombinedBytes,
        maxItems: options.maxItems
      },
      counts: {
        entries: items.length,
        batches: batches.length,
        byMeaningSize
      },
      batches
    };
    const manifest: FrenchCodexBatchManifest = {
      ...content,
      manifestHash: hashFrenchInternalJson(content)
    };
    writeFileSync(
      join(tempDir, "manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8"
    );
    const installedManifestPath = join(
      resolve(options.outputDir),
      "manifest.json"
    );
    if (existsSync(installedManifestPath)) {
      const installed = JSON.parse(
        readFileSync(installedManifestPath, "utf8")
      ) as FrenchCodexBatchManifest;
      if (installed.manifestHash === manifest.manifestHash) {
        assertFrenchCodexBatchManifest(installed, {
          verifyFiles: true,
          expectedEntries: options.expectedEntries
        });
        rmSync(tempDir, { recursive: true, force: true });
        return installed;
      }
      if (!options.replaceExisting) {
        throw new Error(
          `french-codex-batch-output-stale:${resolve(options.outputDir)}`
        );
      }
    }
    if (
      existsSync(resolve(options.outputDir)) &&
      !existsSync(installedManifestPath) &&
      !options.replaceExisting
    ) {
      throw new Error(
        `french-codex-batch-output-unattested:${resolve(options.outputDir)}`
      );
    }
    installDirectoryAtomically(tempDir, resolve(options.outputDir), backupDir);
    return manifest;
  } catch (error) {
    rmSync(tempDir, { recursive: true, force: true });
    throw error;
  }
}

function buildPilotQualityGateArtifact(
  options: Options,
  selection: FrenchCodexSelectionProof
): FrenchCodexPilotQualityGateArtifact | null {
  if (options.runKind === "custom") {
    if (options.pilotQualityGatePath !== undefined) {
      throw new Error("french-codex-custom-pilot-quality-gate-forbidden");
    }
    return null;
  }
  if (!options.pilotQualityGatePath) {
    throw new Error("french-codex-full-pilot-quality-gate-required");
  }
  const path = resolve(options.pilotQualityGatePath);
  const gate = readFrenchPilotQualityGate(path, {
    verifySourceFiles: true,
    expectedReleaseKey: selection.releaseKey,
    expectedReleaseSnapshotFingerprint: selection.releaseSnapshotFingerprint,
    expectedSourceLogicalDigest: selection.sourceLogicalDigest
  });
  const buffer = readFileSync(path);
  return {
    path,
    sha256: sha256(buffer),
    bytes: buffer.byteLength,
    gateHash: gate.gateHash,
    generationConfigHash: gate.lineage.generationConfigHash
  };
}

function assertPilotQualityGateArtifact(
  manifest: FrenchCodexBatchManifest,
  verifyFiles: boolean
): void {
  const artifact = manifest.pilotQualityGate;
  if (manifest.runKind === "custom") {
    if (artifact !== null) {
      throw new Error("french-codex-custom-pilot-quality-gate-forbidden");
    }
    return;
  }
  if (
    !artifact ||
    resolve(artifact.path) !== artifact.path ||
    !SHA256_PATTERN.test(artifact.sha256) ||
    !SHA256_PATTERN.test(artifact.gateHash) ||
    !SHA256_PATTERN.test(artifact.generationConfigHash) ||
    !Number.isInteger(artifact.bytes) ||
    artifact.bytes < 1
  ) {
    throw new Error("french-codex-full-pilot-quality-gate-invalid");
  }
  if (!verifyFiles) return;
  const gate = readFrenchPilotQualityGate(artifact.path, {
    verifySourceFiles: true,
    expectedReleaseKey: manifest.lineage.releaseKey,
    expectedReleaseSnapshotFingerprint:
      manifest.lineage.releaseSnapshotFingerprint,
    expectedSourceLogicalDigest: manifest.lineage.sourceLogicalDigest,
    expectedGenerationConfigHash: artifact.generationConfigHash
  });
  const buffer = readFileSync(artifact.path);
  if (
    buffer.byteLength !== artifact.bytes ||
    sha256(buffer) !== artifact.sha256 ||
    gate.gateHash !== artifact.gateHash
  ) {
    throw new Error("french-codex-full-pilot-quality-gate-stale");
  }
}

function buildSelectionProof(input: {
  runKind: FrenchCodexRunKind;
  namespace: string;
  selectionPath: string;
  selectionText: string;
  expectedEntries: number;
  proposerA: Map<string, View>;
  proposerB: Map<string, View>;
}): FrenchCodexSelectionProof {
  let sourceKind: "shards" | "keys";
  let sourceContentHash: string;
  let sourceLogicalDigest: string;
  let releaseKey: string;
  let releaseSnapshotFingerprint: string;
  let fullPlanEntries: number;
  let exactFullCoverage: boolean;
  let shardIds: string[];
  let keys: string[];
  const parsed = JSON.parse(input.selectionText) as Record<string, unknown>;
  if (parsed.schemaVersion === FRENCH_INTERNAL_SHARDS_SCHEMA_VERSION) {
    if (input.runKind !== "full") {
      throw new Error("french-codex-selection-shards-require-full-kind");
    }
    const plan = parseShardPlan(input.selectionText);
    sourceKind = "shards";
    sourceContentHash = plan.contentHash;
    sourceLogicalDigest = plan.sourceLogicalDigest;
    releaseKey = plan.releaseKey;
    releaseSnapshotFingerprint = plan.releaseSnapshotFingerprint;
    shardIds = plan.shards.map((shard) => shard.shardId);
    keys = plan.shards.flatMap((shard) =>
      shard.items.map((item) => item.entryKey)
    );
    for (const shard of plan.shards) {
      for (const item of shard.items) {
        const a = input.proposerA.get(item.entryKey);
        const b = input.proposerB.get(item.entryKey);
        if (
          !a ||
          !b ||
          a.workViewHash !== item.workViewHash ||
          b.workViewHash !== item.workViewHash ||
          a.viewHash !== item.proposerAViewHash ||
          b.viewHash !== item.proposerBViewHash ||
          hashFrenchInternalJson(a.lineage) !==
            hashFrenchInternalJson(item.lineage) ||
          hashFrenchInternalJson(b.lineage) !==
            hashFrenchInternalJson(item.lineage)
        ) {
          throw new Error(`french-codex-shard-view-stale:${item.entryKey}`);
        }
      }
    }
    fullPlanEntries = keys.length;
    exactFullCoverage = true;
  } else {
    if (input.runKind !== "custom") {
      throw new Error("french-codex-selection-full-requires-shards");
    }
    const keysValue = parsed.keys;
    if (
      !Array.isArray(keysValue) ||
      keysValue.some((key) => typeof key !== "string")
    ) {
      throw new Error("french-codex-selection-keys-invalid");
    }
    keys = keysValue as string[];
    sourceKind = "keys";
    sourceContentHash =
      typeof parsed.contentHash === "string"
        ? parsed.contentHash
        : hashFrenchInternalJson({ keys });
    if (
      typeof parsed.contentHash === "string" &&
      parsed.contentHash !== hashFrenchInternalJson({ keys })
    ) {
      throw new Error("french-codex-selection-keys-content-hash-invalid");
    }
    const first = input.proposerA.get(keys[0]!);
    if (!first) throw new Error("french-codex-selection-view-missing:first");
    sourceLogicalDigest = first.lineage.sourceLogicalDigest;
    releaseKey = first.lineage.releaseKey;
    releaseSnapshotFingerprint = first.lineage.releaseSnapshotFingerprint;
    fullPlanEntries = keys.length;
    exactFullCoverage = true;
    shardIds = [];
  }
  if (
    keys.length !== input.expectedEntries ||
    keys.length < 1 ||
    new Set(keys).size !== keys.length
  ) {
    throw new Error(
      `french-codex-selection-count:${keys.length}:${input.expectedEntries}`
    );
  }
  for (const key of keys) {
    const proposerA = input.proposerA.get(key);
    const proposerB = input.proposerB.get(key);
    if (!proposerA || !proposerB) {
      throw new Error(`french-codex-selection-view-missing:${key}`);
    }
    if (
      proposerA.lineage.releaseKey !== releaseKey ||
      proposerB.lineage.releaseKey !== releaseKey ||
      proposerA.lineage.releaseSnapshotFingerprint !==
        releaseSnapshotFingerprint ||
      proposerB.lineage.releaseSnapshotFingerprint !==
        releaseSnapshotFingerprint ||
      proposerA.lineage.sourceLogicalDigest !== sourceLogicalDigest ||
      proposerB.lineage.sourceLogicalDigest !== sourceLogicalDigest ||
      hashFrenchInternalJson(proposerA.lineage) !==
        hashFrenchInternalJson(proposerB.lineage)
    ) {
      throw new Error(`french-codex-selection-release-mixed:${key}`);
    }
  }
  if (input.runKind === "full") {
    const expected = new Set(keys);
    if (
      input.proposerA.size !== keys.length ||
      input.proposerB.size !== keys.length ||
      [...input.proposerA.keys()].some((key) => !expected.has(key)) ||
      [...input.proposerB.keys()].some((key) => !expected.has(key))
    ) {
      throw new Error("french-codex-full-view-coverage-mismatch");
    }
  }
  const content = {
    schemaVersion: FRENCH_CODEX_SELECTION_PROOF_SCHEMA_VERSION,
    runKind: input.runKind,
    namespace: input.namespace,
    sourceKind,
    sourcePath: resolve(input.selectionPath),
    sourceFileHash: sha256(input.selectionText),
    sourceContentHash,
    sourceLogicalDigest,
    releaseKey,
    releaseSnapshotFingerprint,
    expectedEntries: input.expectedEntries,
    fullPlanEntries,
    exactFullCoverage,
    shardIds,
    keys,
    keyOrderHash: hashFrenchInternalJson(keys)
  };
  return { ...content, contentHash: hashFrenchInternalJson(content) };
}

function assertSelectedItemLineage(
  selection: FrenchCodexSelectionProof,
  proposerA: FrenchInternalProposerAView,
  proposerB: FrenchInternalProposerBView,
  packet: LexiconV3FrenchPacket,
  entryKey: string
): void {
  if (
    proposerA.lineage.releaseKey !== selection.releaseKey ||
    proposerB.lineage.releaseKey !== selection.releaseKey ||
    proposerA.lineage.releaseSnapshotFingerprint !==
      selection.releaseSnapshotFingerprint ||
    proposerB.lineage.releaseSnapshotFingerprint !==
      selection.releaseSnapshotFingerprint ||
    proposerA.lineage.sourceLogicalDigest !== selection.sourceLogicalDigest ||
    proposerB.lineage.sourceLogicalDigest !== selection.sourceLogicalDigest ||
    hashFrenchInternalJson(proposerA.lineage) !==
      hashFrenchInternalJson(proposerB.lineage) ||
    packet.englishRelease.releaseKey !== selection.releaseKey ||
    packet.englishRelease.releaseSnapshotFingerprint !==
      selection.releaseSnapshotFingerprint ||
    hashFrenchInternalJson(packet.englishRelease.parents) !==
      hashFrenchInternalJson(proposerA.lineage.englishParents)
  ) {
    throw new Error(`french-codex-selection-exact-lineage:${entryKey}`);
  }
}

function parseShardPlan(text: string): FrenchInternalShardPlan {
  const plan = JSON.parse(text) as FrenchInternalShardPlan;
  const { contentHash, ...content } = plan;
  if (
    plan.schemaVersion !== FRENCH_INTERNAL_SHARDS_SCHEMA_VERSION ||
    plan.policyVersion !== FRENCH_INTERNAL_WORK_POLICY_VERSION ||
    !plan.releaseKey?.trim() ||
    !SHA256_PATTERN.test(plan.releaseSnapshotFingerprint) ||
    !SHA256_PATTERN.test(plan.sourceLogicalDigest) ||
    !SHA256_PATTERN.test(contentHash) ||
    hashFrenchInternalWorkJson(content) !== contentHash ||
    plan.resumeContract.skipOnlyWhen !==
      "validated-role-output-pins-exact-shard-and-view-hashes" ||
    plan.resumeContract.changedViewCreatesNewResumeKey !== true ||
    plan.shards.length < 1
  ) {
    throw new Error("french-codex-shards-plan-invalid");
  }
  const seenKeys = new Set<string>();
  const seenShards = new Set<string>();
  for (const shard of plan.shards)
    assertShard(shard, plan, seenShards, seenKeys);
  return plan;
}

function assertShard(
  shard: FrenchInternalShard,
  plan: FrenchInternalShardPlan,
  seenShards: Set<string>,
  seenKeys: Set<string>
): void {
  const { shardHash, ...content } = shard;
  if (
    shard.schemaVersion !== FRENCH_INTERNAL_SHARD_SCHEMA_VERSION ||
    shard.policyVersion !== FRENCH_INTERNAL_WORK_POLICY_VERSION ||
    shard.sourceLogicalDigest !== plan.sourceLogicalDigest ||
    shard.releaseKey !== plan.releaseKey ||
    shard.releaseSnapshotFingerprint !== plan.releaseSnapshotFingerprint ||
    seenShards.has(shard.shardId) ||
    shard.items.length < 1 ||
    shard.items.length > shard.maxItems ||
    shard.maxItems !== plan.batchSizes[shard.meaningSize] ||
    !SHA256_PATTERN.test(shard.resumeKey) ||
    !SHA256_PATTERN.test(shardHash) ||
    hashFrenchInternalWorkJson(content) !== shardHash
  ) {
    throw new Error(`french-codex-shard-invalid:${shard.shardId}`);
  }
  seenShards.add(shard.shardId);
  for (const item of shard.items) {
    const { itemHash, ...itemContent } = item;
    if (
      item.schemaVersion !== FRENCH_INTERNAL_SHARD_ITEM_SCHEMA_VERSION ||
      seenKeys.has(item.entryKey) ||
      !SHA256_PATTERN.test(item.workViewHash) ||
      !SHA256_PATTERN.test(item.proposerAViewHash) ||
      !SHA256_PATTERN.test(item.proposerBViewHash) ||
      item.lineage.releaseKey !== plan.releaseKey ||
      item.lineage.releaseSnapshotFingerprint !==
        plan.releaseSnapshotFingerprint ||
      item.lineage.sourceLogicalDigest !== plan.sourceLogicalDigest ||
      !SHA256_PATTERN.test(itemHash) ||
      hashFrenchInternalWorkJson(itemContent) !== itemHash
    ) {
      throw new Error(`french-codex-shard-item-invalid:${item.entryKey}`);
    }
    seenKeys.add(item.entryKey);
  }
}

function groupBySealedShards(
  items: SelectedItem[],
  shardIds: string[],
  options: Options
): SelectedItem[][] {
  const byShard = new Map<string, SelectedItem[]>();
  for (const item of items) {
    if (!item.shardId)
      throw new Error(`french-codex-shard-key-unbound:${item.entryKey}`);
    const group = byShard.get(item.shardId) ?? [];
    group.push(item);
    byShard.set(item.shardId, group);
  }
  const groups = shardIds.map((shardId) => {
    const group = byShard.get(shardId);
    if (!group?.length) throw new Error(`french-codex-shard-empty:${shardId}`);
    return group;
  });
  if (
    groups.flat().length !== items.length ||
    byShard.size !== shardIds.length
  ) {
    throw new Error("french-codex-shard-coverage-invalid");
  }
  return groups.flatMap((group) => splitSealedGroup(group, options));
}

function splitSealedGroup(
  group: SelectedItem[],
  options: Options
): SelectedItem[][] {
  const result: SelectedItem[][] = [];
  let current: SelectedItem[] = [];
  let bytes = 0;
  const size = group[0]!.meaningSize;
  if (group.some((item) => item.meaningSize !== size)) {
    throw new Error(
      `french-codex-sealed-shard-mixed-size:${group[0]!.shardId}`
    );
  }
  for (const item of group) {
    const itemBytes = inputBytes(item);
    if (itemBytes > options.maxCombinedBytes) {
      throw new Error(
        `french-codex-sealed-item-budget-invalid:${item.entryKey}`
      );
    }
    if (
      current.length > 0 &&
      (current.length >= options.maxItems[size] ||
        bytes + itemBytes > options.maxCombinedBytes)
    ) {
      result.push(current);
      current = [];
      bytes = 0;
    }
    current.push(item);
    bytes += itemBytes;
  }
  if (current.length) result.push(current);
  for (const batch of result) assertBatchBudget(batch, options);
  return result;
}

function groupCustom(
  items: SelectedItem[],
  options: Options
): SelectedItem[][] {
  const result: SelectedItem[][] = [];
  let current: SelectedItem[] = [];
  let bytes = 0;
  for (const item of items) {
    const itemBytes = inputBytes(item);
    if (itemBytes > options.maxCombinedBytes) {
      throw new Error(`french-codex-custom-item-budget:${item.entryKey}`);
    }
    const currentSize = current[0]?.meaningSize;
    if (
      current.length > 0 &&
      (currentSize !== item.meaningSize ||
        current.length >= options.maxItems[item.meaningSize] ||
        bytes + itemBytes > options.maxCombinedBytes)
    ) {
      result.push(current);
      current = [];
      bytes = 0;
    }
    current.push(item);
    bytes += itemBytes;
  }
  if (current.length) result.push(current);
  for (const group of result) assertBatchBudget(group, options);
  if (result.flat().length !== items.length) {
    throw new Error("french-codex-custom-batch-coverage-invalid");
  }
  return result;
}

function assertBatchBudget(items: SelectedItem[], options: Options): void {
  const size = items[0]!.meaningSize;
  if (
    items.some((item) => item.meaningSize !== size) ||
    items.length > options.maxItems[size] ||
    items.reduce((sum, item) => sum + inputBytes(item), 0) >
      options.maxCombinedBytes
  ) {
    throw new Error(
      `french-codex-sealed-shard-budget-invalid:${items[0]!.shardId ?? "custom"}`
    );
  }
}

function inputBytes(item: SelectedItem): number {
  return (
    Buffer.byteLength(`${JSON.stringify(item.proposerA)}\n`) +
    Buffer.byteLength(`${JSON.stringify(item.proposerB)}\n`)
  );
}

function writeBatch(
  tempRoot: string,
  finalRoot: string,
  runKind: FrenchCodexRunKind,
  suffix: string,
  items: SelectedItem[]
): FrenchCodexPilotBatchRecord {
  const meaningSize = items[0]!.meaningSize;
  const batchId = `${runKind}-${suffix}`;
  if (!/^[a-z0-9][a-z0-9._-]*$/u.test(batchId)) {
    throw new Error(`french-codex-batch-id-invalid:${batchId}`);
  }
  const physicalDir = join(tempRoot, batchId);
  const finalDir = join(finalRoot, batchId);
  mkdirSync(physicalDir, { recursive: true });
  const aInput = writeFinalArtifact(
    physicalDir,
    finalDir,
    "proposer-a-input.jsonl",
    jsonl(items.map((item) => item.proposerA))
  );
  const bInput = writeFinalArtifact(
    physicalDir,
    finalDir,
    "proposer-b-input.jsonl",
    jsonl(items.map((item) => item.proposerB))
  );
  const packets = writeFinalArtifact(
    physicalDir,
    finalDir,
    "packets.jsonl",
    jsonl(items.map((item) => item.packet))
  );
  const aSchema = writeFinalArtifact(
    physicalDir,
    finalDir,
    "proposer-a-output.schema.json",
    `${JSON.stringify(outputSchema("proposerA", items), null, 2)}\n`
  );
  const bSchema = writeFinalArtifact(
    physicalDir,
    finalDir,
    "proposer-b-output.schema.json",
    `${JSON.stringify(outputSchema("proposerB", items), null, 2)}\n`
  );
  const content = {
    batchId,
    meaningSize,
    keys: items.map((item) => item.entryKey),
    proposerAViewHashes: items.map((item) => item.proposerA.viewHash),
    proposerBViewHashes: items.map((item) => item.proposerB.viewHash),
    lineage: {
      releaseKey: items[0]!.proposerA.lineage.releaseKey,
      releaseSnapshotFingerprint:
        items[0]!.proposerA.lineage.releaseSnapshotFingerprint,
      sourceLogicalDigest: items[0]!.proposerA.lineage.sourceLogicalDigest
    },
    inputs: { proposerA: aInput, proposerB: bInput, packets },
    schemas: { proposerA: aSchema, proposerB: bSchema },
    expectedDraftPaths: {
      proposerA: join(finalDir, "proposer-a-drafts.jsonl"),
      proposerB: join(finalDir, "proposer-b-drafts.jsonl")
    }
  };
  return { ...content, batchHash: hashFrenchInternalJson(content) };
}

function outputSchema(role: Role, items: SelectedItem[]): object {
  const keys = items.map((item) => item.entryKey);
  const hashes = items.map((item) =>
    role === "proposerA" ? item.proposerA.viewHash : item.proposerB.viewHash
  );
  const segmentIds = [
    ...new Set(
      items.flatMap((item) =>
        (role === "proposerA"
          ? item.proposerA
          : item.proposerB
        ).translationTask.htmlTemplate.tokens.flatMap((token) =>
          token.kind === "text" && token.translatable ? [token.id] : []
        )
      )
    )
  ];
  return frenchCodexPilotDraftOutputSchema(
    role,
    keys,
    hashes,
    segmentIds,
    items.length
  );
}

export function assertFrenchCodexBatchManifest(
  manifest: FrenchCodexBatchManifest,
  options: FrenchCodexBatchManifestValidationOptions = {}
): void {
  if (manifest.schemaVersion !== FRENCH_CODEX_BATCH_MANIFEST_SCHEMA_VERSION) {
    throw new Error(
      `french-codex-batch-manifest-migration-required:${String(
        (manifest as unknown as { schemaVersion?: unknown }).schemaVersion
      )}`
    );
  }
  const { manifestHash, ...content } = manifest;
  const selection = manifest.selection;
  const { contentHash: selectionHash, ...selectionContent } = selection;
  if (
    manifest.policyVersion !== FRENCH_INTERNAL_WORK_POLICY_VERSION ||
    manifest.promptVersion !== FRENCH_INTERNAL_PROMPT_VERSION ||
    manifest.lineage?.releaseKey !== selection.releaseKey ||
    manifest.lineage?.releaseSnapshotFingerprint !==
      selection.releaseSnapshotFingerprint ||
    manifest.lineage?.sourceLogicalDigest !== selection.sourceLogicalDigest ||
    (manifest.runKind === "full" && manifest.pilotQualityGate === null) ||
    (manifest.runKind === "custom" && manifest.pilotQualityGate !== null) ||
    manifest.runKind !== selection.runKind ||
    manifest.namespace !== selection.namespace ||
    !manifest.outputRoot ||
    resolve(manifest.outputRoot) !== manifest.outputRoot ||
    !SAFE_NAMESPACE_PATTERN.test(manifest.namespace) ||
    !SHA256_PATTERN.test(manifestHash) ||
    hashFrenchInternalJson(content) !== manifestHash ||
    selection.schemaVersion !== FRENCH_CODEX_SELECTION_PROOF_SCHEMA_VERSION ||
    !SHA256_PATTERN.test(selectionHash) ||
    !SHA256_PATTERN.test(selection.sourceFileHash) ||
    !SHA256_PATTERN.test(selection.sourceContentHash) ||
    !SHA256_PATTERN.test(selection.sourceLogicalDigest) ||
    !selection.releaseKey?.trim() ||
    !SHA256_PATTERN.test(selection.releaseSnapshotFingerprint) ||
    hashFrenchInternalJson(selectionContent) !== selectionHash ||
    selection.expectedEntries !== manifest.counts.entries ||
    selection.keys.length !== manifest.counts.entries ||
    manifest.counts.entries < 1 ||
    manifest.batches.length < 1 ||
    selection.keyOrderHash !== hashFrenchInternalJson(selection.keys) ||
    new Set(selection.keys).size !== selection.keys.length ||
    (manifest.runKind === "full" &&
      (selection.sourceKind !== "shards" ||
        selection.exactFullCoverage !== true ||
        selection.fullPlanEntries !== selection.expectedEntries ||
        selection.shardIds.length < 1 ||
        new Set(selection.shardIds).size !== selection.shardIds.length)) ||
    (manifest.runKind === "custom" &&
      (selection.sourceKind !== "keys" ||
        !manifest.namespace.startsWith("/fr-internal/custom/") ||
        selection.shardIds.length !== 0)) ||
    manifest.batches.length !== manifest.counts.batches ||
    (options.expectedEntries !== undefined &&
      manifest.counts.entries !== options.expectedEntries)
  ) {
    throw new Error("french-codex-batch-manifest-invalid");
  }
  const keys = manifest.batches.flatMap((batch) => batch.keys);
  const expectedKeys = selection.keys;
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key, index) => key !== expectedKeys[index]) ||
    new Set(keys).size !== keys.length
  ) {
    throw new Error("french-codex-batch-manifest-coverage-invalid");
  }
  assertSelectedPacketsMetadata(
    manifest.selectedPackets,
    join(manifest.outputRoot, "selected-packets.jsonl"),
    manifest.counts.entries,
    manifest.lineage
  );
  assertPilotQualityGateArtifact(manifest, options.verifyFiles === true);
  if (manifest.runKind === "full") {
    const observedShards: string[] = [];
    const nextPart = new Map<string, number>();
    for (const batch of manifest.batches) {
      const match =
        /^full-((?:short|medium|long|very_long)-\d{4})-p(\d{3})$/u.exec(
          batch.batchId
        );
      if (!match) {
        throw new Error(`french-codex-full-batch-id-invalid:${batch.batchId}`);
      }
      const shardId = match[1]!;
      const part = Number(match[2]);
      if (!nextPart.has(shardId)) observedShards.push(shardId);
      const expectedPart = (nextPart.get(shardId) ?? 0) + 1;
      if (part !== expectedPart) {
        throw new Error(`french-codex-full-batch-part-gap:${batch.batchId}`);
      }
      nextPart.set(shardId, part);
    }
    if (
      observedShards.length !== selection.shardIds.length ||
      observedShards.some(
        (shardId, index) => shardId !== selection.shardIds[index]
      )
    ) {
      throw new Error("french-codex-full-shard-coverage-invalid");
    }
  } else if (
    manifest.batches.some(
      (batch) =>
        !/^custom-(?:short|medium|long|very_long)-\d{5}$/u.test(batch.batchId)
    )
  ) {
    throw new Error("french-codex-custom-batch-id-invalid");
  }
  const ids = new Set<string>();
  const bySize = Object.fromEntries(
    SIZE_ORDER.map((size) => [size, 0])
  ) as Record<FrenchInternalMeaningSize, number>;
  for (const batch of manifest.batches) {
    const { batchHash, ...batchContent } = batch;
    if (
      ids.has(batch.batchId) ||
      !batch.batchId.startsWith(`${manifest.runKind}-`) ||
      !SHA256_PATTERN.test(batchHash) ||
      hashFrenchInternalJson(batchContent) !== batchHash ||
      batch.keys.length < 1 ||
      batch.keys.length !== batch.proposerAViewHashes.length ||
      batch.keys.length !== batch.proposerBViewHashes.length ||
      batch.lineage.releaseKey !== manifest.lineage.releaseKey ||
      batch.lineage.releaseSnapshotFingerprint !==
        manifest.lineage.releaseSnapshotFingerprint ||
      batch.lineage.sourceLogicalDigest !==
        manifest.lineage.sourceLogicalDigest ||
      new Set(batch.keys).size !== batch.keys.length ||
      [...batch.proposerAViewHashes, ...batch.proposerBViewHashes].some(
        (digest) => !SHA256_PATTERN.test(digest)
      ) ||
      batch.keys.length > manifest.batching.maxItems[batch.meaningSize] ||
      batch.inputs.proposerA.bytes + batch.inputs.proposerB.bytes >
        manifest.batching.maxCombinedBytes
    ) {
      throw new Error(`french-codex-batch-invalid:${batch.batchId}`);
    }
    ids.add(batch.batchId);
    bySize[batch.meaningSize] += batch.keys.length;
    const directory = join(manifest.outputRoot, batch.batchId);
    if (
      dirname(batch.inputs.proposerA.path) !== directory ||
      dirname(batch.inputs.proposerB.path) !== directory ||
      dirname(batch.inputs.packets.path) !== directory ||
      dirname(batch.schemas.proposerA.path) !== directory ||
      dirname(batch.schemas.proposerB.path) !== directory ||
      batch.expectedDraftPaths.proposerA !==
        join(directory, "proposer-a-drafts.jsonl") ||
      batch.expectedDraftPaths.proposerB !==
        join(directory, "proposer-b-drafts.jsonl")
    ) {
      throw new Error(`french-codex-batch-path-invalid:${batch.batchId}`);
    }
    if (options.verifyFiles) {
      for (const artifact of [
        batch.inputs.proposerA,
        batch.inputs.proposerB,
        batch.inputs.packets,
        batch.schemas.proposerA,
        batch.schemas.proposerB
      ])
        assertArtifact(artifact, batch.batchId);
    }
  }
  if (
    SIZE_ORDER.some(
      (size) => bySize[size] !== manifest.counts.byMeaningSize[size]
    ) ||
    Object.values(bySize).reduce((sum, count) => sum + count, 0) !==
      manifest.counts.entries
  ) {
    throw new Error("french-codex-batch-meaning-coverage-invalid");
  }
  if (!options.verifyFiles) return;
  for (const [label, path, digest] of [
    [
      "selection",
      manifest.sourcePaths.selection,
      manifest.sourceDigests.selection
    ],
    [
      "proposerA",
      manifest.sourcePaths.proposerA,
      manifest.sourceDigests.proposerA
    ],
    [
      "proposerB",
      manifest.sourcePaths.proposerB,
      manifest.sourceDigests.proposerB
    ],
    ["packets", manifest.sourcePaths.packets, manifest.sourceDigests.packets]
  ] as const) {
    if (!existsSync(path) || sha256(readFileSync(path)) !== digest) {
      throw new Error(`french-codex-batch-source-stale:${label}`);
    }
  }
  const sourceText = readFileSync(manifest.sourcePaths.selection, "utf8");
  if (
    sha256(sourceText) !== selection.sourceFileHash ||
    selection.sourcePath !== resolve(manifest.sourcePaths.selection) ||
    selection.contentHash !== manifest.sourceDigests.selectionContentHash
  ) {
    throw new Error("french-codex-batch-selection-stale");
  }
  const viewsA = readViews(
    readFileSync(manifest.sourcePaths.proposerA, "utf8"),
    "proposerA"
  );
  const viewsB = readViews(
    readFileSync(manifest.sourcePaths.proposerB, "utf8"),
    "proposerB"
  );
  const packets = readPackets(
    readFileSync(manifest.sourcePaths.packets, "utf8"),
    new Set(keys)
  );
  const selectedPackets = readPacketSequence(manifest.selectedPackets.path);
  const selectedText = readFileSync(manifest.selectedPackets.path, "utf8");
  const batchPacketText = manifest.batches
    .map((batch) => readFileSync(batch.inputs.packets.path, "utf8"))
    .join("");
  if (
    sha256(selectedText) !== manifest.selectedPackets.sha256 ||
    Buffer.byteLength(selectedText) !== manifest.selectedPackets.bytes ||
    selectedPackets.length !== manifest.selectedPackets.records ||
    selectedPackets.some(
      (packet, index) => packet.entryKey !== expectedKeys[index]
    ) ||
    frenchCodexSelectedPacketsLogicalDigest(selectedPackets) !==
      manifest.selectedPackets.logicalDigest ||
    selectedText !== batchPacketText ||
    selectedPackets.some(
      (packet) =>
        packets.get(packet.entryKey)?.packetHash !== packet.packetHash ||
        packet.englishRelease.releaseKey !== manifest.lineage.releaseKey ||
        packet.englishRelease.releaseSnapshotFingerprint !==
          manifest.lineage.releaseSnapshotFingerprint
    )
  ) {
    throw new Error("french-codex-selected-packets-content-invalid");
  }
  for (const batch of manifest.batches) {
    for (const [index, key] of batch.keys.entries()) {
      if (
        viewsA.get(key)?.viewHash !== batch.proposerAViewHashes[index] ||
        viewsB.get(key)?.viewHash !== batch.proposerBViewHashes[index] ||
        !packets.has(key)
      ) {
        throw new Error(`french-codex-batch-source-view-stale:${key}`);
      }
      assertSelectedItemLineage(
        selection,
        viewsA.get(key)! as FrenchInternalProposerAView,
        viewsB.get(key)! as FrenchInternalProposerBView,
        packets.get(key)!,
        key
      );
    }
  }
  const rebuilt = buildSelectionProof({
    runKind: manifest.runKind,
    namespace: manifest.namespace,
    selectionPath: manifest.sourcePaths.selection,
    selectionText: sourceText,
    expectedEntries: manifest.counts.entries,
    proposerA: viewsA,
    proposerB: viewsB
  });
  if (rebuilt.contentHash !== selection.contentHash) {
    throw new Error("french-codex-batch-selection-proof-mismatch");
  }
}

export function assertFrenchCodexAnyBatchManifest(
  manifest: FrenchCodexAnyBatchManifest,
  options: FrenchCodexBatchManifestValidationOptions = {}
): FrenchCodexManifestContext {
  if (
    manifest.schemaVersion !== FRENCH_CODEX_BATCH_MANIFEST_SCHEMA_VERSION &&
    manifest.schemaVersion !== FRENCH_CODEX_PILOT_BATCH_MANIFEST_SCHEMA_VERSION
  ) {
    throw new Error(
      `french-codex-batch-manifest-migration-required:${String(
        (manifest as unknown as { schemaVersion?: unknown }).schemaVersion
      )}`
    );
  }
  if (manifest.schemaVersion === FRENCH_CODEX_BATCH_MANIFEST_SCHEMA_VERSION) {
    assertFrenchCodexBatchManifest(
      manifest as FrenchCodexBatchManifest,
      options
    );
    const value = manifest as FrenchCodexBatchManifest;
    return {
      runKind: value.runKind,
      namespace: value.namespace,
      expectedEntries: value.counts.entries,
      selectionHash: value.selection.contentHash,
      keyOrderHash: value.selection.keyOrderHash,
      selectedPackets: value.selectedPackets,
      lineage: value.lineage,
      pilotQualityGate: value.pilotQualityGate
    };
  }
  assertFrenchCodexPilotBatchManifest(
    manifest as FrenchCodexPilotBatchManifest,
    {
      verifyFiles: options.verifyFiles,
      expectedEntries: options.expectedEntries
    }
  );
  const pilot = manifest as FrenchCodexPilotBatchManifest;
  const keys = pilot.batches.flatMap((batch) => batch.keys);
  return {
    runKind: "pilot",
    namespace: "/fr-internal/pilot",
    expectedEntries: pilot.counts.entries,
    selectionHash: pilot.sourceDigests.pilotContentHash,
    keyOrderHash: hashFrenchInternalJson(keys),
    selectedPackets: pilot.selectedPackets,
    lineage: pilot.lineage,
    pilotQualityGate: null
  };
}

function readViews(text: string, role: Role): Map<string, View> {
  const result = new Map<string, View>();
  const expectedKind =
    role === "proposerA" ? "proposer_a_blind" : "proposer_b_candidates";
  for (const [index, line] of text.split(/\r?\n/u).entries()) {
    if (!line.trim()) continue;
    const view = JSON.parse(line) as View;
    if (
      view.schemaVersion !== FRENCH_INTERNAL_PROPOSER_VIEW_SCHEMA_VERSION ||
      view.policyVersion !== FRENCH_INTERNAL_WORK_POLICY_VERSION ||
      view.role !== role ||
      view.viewKind !== expectedKind ||
      !SHA256_PATTERN.test(view.viewHash) ||
      frenchInternalViewHash(view) !== view.viewHash
    ) {
      throw new Error(`french-codex-view-invalid:${role}:${index + 1}`);
    }
    if (role === "proposerA")
      assertProposerABlindView(view as FrenchInternalProposerAView);
    if (result.has(view.entryKey))
      throw new Error(`french-codex-view-duplicate:${role}:${view.entryKey}`);
    result.set(view.entryKey, view);
  }
  return result;
}

function readPackets(
  text: string,
  selected: Set<string>
): Map<string, LexiconV3FrenchPacket> {
  const result = new Map<string, LexiconV3FrenchPacket>();
  const allKeys = new Set<string>();
  const allStepIds = new Set<number>();
  for (const [index, line] of text.split(/\r?\n/u).entries()) {
    if (!line.trim()) continue;
    const packet = JSON.parse(line) as LexiconV3FrenchPacket;
    const issues = validateFrenchPacket(packet);
    if (issues.length)
      throw new Error(
        `french-codex-packet-invalid:${index + 1}:${issues.join(",")}`
      );
    if (
      allKeys.has(packet.entryKey) ||
      allStepIds.has(packet.identity.stepEntryId)
    ) {
      throw new Error(`french-codex-packet-duplicate:${packet.entryKey}`);
    }
    allKeys.add(packet.entryKey);
    allStepIds.add(packet.identity.stepEntryId);
    if (selected.has(packet.entryKey)) result.set(packet.entryKey, packet);
  }
  if (result.size !== selected.size)
    throw new Error("french-codex-packet-selection-coverage-invalid");
  return result;
}

function writeFinalArtifact(
  physicalDir: string,
  finalDir: string,
  name: string,
  text: string
): FileArtifact {
  writeFileSync(join(physicalDir, name), text, "utf8");
  return {
    path: join(finalDir, name),
    sha256: sha256(text),
    bytes: Buffer.byteLength(text)
  };
}

function writeSelectedPacketsArtifact(
  physicalRoot: string,
  finalRoot: string,
  packets: readonly LexiconV3FrenchPacket[],
  lineage: Pick<
    FrenchCodexSelectionProof,
    "releaseKey" | "releaseSnapshotFingerprint" | "sourceLogicalDigest"
  >
): FrenchCodexSelectedPacketsArtifact {
  const text = jsonl([...packets]);
  writeFileSync(join(physicalRoot, "selected-packets.jsonl"), text, "utf8");
  return {
    path: join(finalRoot, "selected-packets.jsonl"),
    sha256: sha256(text),
    bytes: Buffer.byteLength(text),
    records: packets.length,
    logicalDigest: frenchCodexSelectedPacketsLogicalDigest(packets),
    releaseKey: lineage.releaseKey,
    releaseSnapshotFingerprint: lineage.releaseSnapshotFingerprint,
    sourceLogicalDigest: lineage.sourceLogicalDigest
  };
}

function readPacketSequence(path: string): LexiconV3FrenchPacket[] {
  if (!existsSync(path)) {
    throw new Error("french-codex-selected-packets-missing");
  }
  const result: LexiconV3FrenchPacket[] = [];
  const keys = new Set<string>();
  const stepIds = new Set<number>();
  for (const [index, line] of readFileSync(path, "utf8")
    .split(/\r?\n/u)
    .entries()) {
    if (!line.trim()) continue;
    let packet: LexiconV3FrenchPacket;
    try {
      packet = JSON.parse(line) as LexiconV3FrenchPacket;
    } catch {
      throw new Error(`french-codex-selected-packet-invalid-json:${index + 1}`);
    }
    const issues = validateFrenchPacket(packet);
    if (
      issues.length > 0 ||
      keys.has(packet.entryKey) ||
      stepIds.has(packet.identity.stepEntryId)
    ) {
      throw new Error(
        `french-codex-selected-packet-invalid:${index + 1}:${issues.join(",")}`
      );
    }
    keys.add(packet.entryKey);
    stepIds.add(packet.identity.stepEntryId);
    result.push(packet);
  }
  if (result.length < 1) throw new Error("french-codex-selected-packets-empty");
  return result;
}

function assertArtifact(artifact: FileArtifact, batchId: string): void {
  if (
    !existsSync(artifact.path) ||
    !SHA256_PATTERN.test(artifact.sha256) ||
    readFileSync(artifact.path).byteLength !== artifact.bytes ||
    sha256(readFileSync(artifact.path)) !== artifact.sha256
  ) {
    throw new Error(`french-codex-batch-artifact-stale:${batchId}`);
  }
}

function jsonl(values: unknown[]): string {
  return `${values.map((value) => JSON.stringify(value)).join("\n")}\n`;
}

function installDirectoryAtomically(
  temp: string,
  output: string,
  backup: string
): void {
  mkdirSync(dirname(output), { recursive: true });
  const existed = existsSync(output);
  try {
    if (existed) renameSync(output, backup);
    renameSync(temp, output);
    rmSync(backup, { recursive: true, force: true });
  } catch (error) {
    rmSync(output, { recursive: true, force: true });
    if (existed && existsSync(backup)) renameSync(backup, output);
    throw error;
  }
}

function acquireLock(path: string): () => void {
  try {
    return acquireFrenchCodexSqliteLock(path);
  } catch (error) {
    if (error instanceof FrenchCodexLockBusyError) {
      throw new Error(`french-codex-batch-build-locked:${path}`);
    }
    throw error;
  }
}

function assertOptions(options: Options): void {
  if (
    !SAFE_NAMESPACE_PATTERN.test(options.namespace) ||
    (options.runKind === "full" && options.namespace !== "/fr-internal/full") ||
    (options.runKind === "custom" &&
      !options.namespace.startsWith("/fr-internal/custom/")) ||
    !Number.isInteger(options.expectedEntries) ||
    options.expectedEntries < 1 ||
    !Number.isInteger(options.maxCombinedBytes) ||
    options.maxCombinedBytes < 1
  ) {
    throw new Error("french-codex-batch-options-invalid");
  }
  for (const size of SIZE_ORDER) {
    if (
      !Number.isInteger(options.maxItems[size]) ||
      options.maxItems[size] < 1
    ) {
      throw new Error(`french-codex-batch-max-items-invalid:${size}`);
    }
  }
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export function parseFrenchCodexBatchArgs(args: readonly string[]): Options {
  const values = new Map<string, string>();
  const seen = new Set<string>();
  const allowed = new Set([
    "run-kind",
    "namespace",
    "selection",
    "proposer-a",
    "proposer-b",
    "packets",
    "pilot-quality-gate",
    "output-dir",
    "expected-entries",
    "max-combined-bytes",
    "short-max-items",
    "medium-max-items",
    "long-max-items",
    "very-long-max-items",
    "replace-existing"
  ]);
  let replaceExisting = false;
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index] ?? "";
    if (!token.startsWith("--"))
      throw new Error(`unexpected-argument:${token}`);
    const key = token.slice(2);
    if (!allowed.has(key)) throw new Error(`unknown-option:${key}`);
    if (seen.has(key)) throw new Error(`duplicate-option:${key}`);
    seen.add(key);
    if (key === "replace-existing") {
      replaceExisting = true;
      continue;
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--"))
      throw new Error(`missing-value:${key}`);
    values.set(key, value);
    index += 1;
  }
  const runKind = values.get("run-kind") ?? "full";
  if (runKind !== "full" && runKind !== "custom")
    throw new Error(`french-codex-run-kind-invalid:${runKind}`);
  const namespace =
    values.get("namespace") ?? (runKind === "full" ? "/fr-internal/full" : "");
  const expected = values.get("expected-entries");
  if (!expected) throw new Error("french-codex-expected-entries-required");
  const integer = (key: string, fallback: number): number => {
    const raw = values.get(key);
    if (raw === undefined) return fallback;
    if (!/^[1-9]\d*$/u.test(raw)) {
      throw new Error(`invalid-positive-integer:${key}:${raw}`);
    }
    return Number(raw);
  };
  return {
    runKind,
    namespace,
    selectionPath: resolve(
      values.get("selection") ?? `${DEFAULT_WORK}/shards.json`
    ),
    proposerAPath: resolve(
      values.get("proposer-a") ?? `${DEFAULT_WORK}/proposer-a-input.jsonl`
    ),
    proposerBPath: resolve(
      values.get("proposer-b") ?? `${DEFAULT_WORK}/proposer-b-input.jsonl`
    ),
    packetsPath: resolve(values.get("packets") ?? DEFAULT_PACKETS),
    ...(values.has("pilot-quality-gate")
      ? {
          pilotQualityGatePath: resolve(values.get("pilot-quality-gate")!)
        }
      : {}),
    outputDir: resolve(
      values.get("output-dir") ?? `${DEFAULT_ROOT}/agent-batches/${runKind}`
    ),
    expectedEntries: integer("expected-entries", 0),
    maxCombinedBytes: integer("max-combined-bytes", DEFAULT_MAX_COMBINED_BYTES),
    maxItems: {
      short: integer("short-max-items", DEFAULT_MAX_ITEMS.short),
      medium: integer("medium-max-items", DEFAULT_MAX_ITEMS.medium),
      long: integer("long-max-items", DEFAULT_MAX_ITEMS.long),
      very_long: integer("very-long-max-items", DEFAULT_MAX_ITEMS.very_long)
    },
    replaceExisting
  };
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? "")).href) {
  try {
    const options = parseFrenchCodexBatchArgs(process.argv.slice(2));
    const manifest = buildLexiconV3FrenchCodexBatches(options);
    process.stdout.write(
      `${JSON.stringify(
        {
          event: "french-codex-batches-built",
          runKind: manifest.runKind,
          namespace: manifest.namespace,
          entries: manifest.counts.entries,
          batches: manifest.counts.batches,
          selectionHash: manifest.selection.contentHash,
          manifestHash: manifest.manifestHash,
          output: resolve(options.outputDir)
        },
        null,
        2
      )}\n`
    );
  } catch (error) {
    process.stderr.write(
      `${basename(process.argv[1] ?? "buildLexiconV3FrenchCodexBatches")}: ${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exitCode = 1;
  }
}
