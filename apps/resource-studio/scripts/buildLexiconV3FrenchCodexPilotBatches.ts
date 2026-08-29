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

import { FRENCH_INTERNAL_PROPOSER_DRAFT_SCHEMA_VERSION } from "../src/lexiconV3/frenchAgentDrafts.js";
import {
  FRENCH_INTERNAL_PROMPT_VERSION,
  hashFrenchInternalJson
} from "../src/lexiconV3/frenchInternalReview.js";
import {
  acquireFrenchCodexSqliteLock,
  FrenchCodexLockBusyError
} from "../src/lexiconV3/frenchCodexSqliteLock.js";
import {
  FRENCH_INTERNAL_PILOT_SCHEMA_VERSION,
  FRENCH_INTERNAL_PROPOSER_VIEW_SCHEMA_VERSION,
  FRENCH_INTERNAL_WORK_POLICY_VERSION,
  assertProposerABlindView,
  frenchInternalViewHash,
  hashFrenchInternalWorkJson,
  type FrenchInternalMeaningSize,
  type FrenchInternalPilotPlan,
  type FrenchInternalProposerAView,
  type FrenchInternalProposerBView
} from "../src/lexiconV3/frenchInternalWork.js";
import {
  validateFrenchPacket,
  type LexiconV3FrenchPacket
} from "../src/lexiconV3/frenchPackets.js";

export const FRENCH_CODEX_PILOT_BATCH_MANIFEST_SCHEMA_VERSION =
  "lexicon-v3-french-codex-pilot-batches@3" as const;

const DEFAULT_WORK_DIR = "outputs/lexicon-v3/fr-internal/work";
const DEFAULT_OUTPUT_DIR = "outputs/lexicon-v3/fr-internal/agent-batches/pilot";
const DEFAULT_PACKETS = "outputs/lexicon-v3/fr-internal/french-packets.jsonl";
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
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

interface BatchItem {
  entryKey: string;
  meaningSize: FrenchInternalMeaningSize;
  proposerA: FrenchInternalProposerAView;
  proposerB: FrenchInternalProposerBView;
  packet: LexiconV3FrenchPacket;
  aLine: string;
  bLine: string;
  packetLine: string;
}

export interface FrenchCodexFileArtifact {
  path: string;
  sha256: string;
  bytes: number;
}

export interface FrenchCodexSelectedPacketsArtifact extends FrenchCodexFileArtifact {
  records: number;
  logicalDigest: string;
  releaseKey: string;
  releaseSnapshotFingerprint: string;
  sourceLogicalDigest: string;
}

export interface FrenchCodexReleaseLineage {
  releaseKey: string;
  releaseSnapshotFingerprint: string;
  sourceLogicalDigest: string;
}

export interface FrenchCodexPilotBatchRecord {
  batchId: string;
  meaningSize: FrenchInternalMeaningSize;
  keys: string[];
  proposerAViewHashes: string[];
  proposerBViewHashes: string[];
  lineage: FrenchCodexReleaseLineage;
  inputs: {
    proposerA: FrenchCodexFileArtifact;
    proposerB: FrenchCodexFileArtifact;
    packets: FrenchCodexFileArtifact;
  };
  schemas: {
    proposerA: FrenchCodexFileArtifact;
    proposerB: FrenchCodexFileArtifact;
  };
  expectedDraftPaths: {
    proposerA: string;
    proposerB: string;
  };
  batchHash: string;
}

export interface FrenchCodexPilotBatchManifest {
  schemaVersion: typeof FRENCH_CODEX_PILOT_BATCH_MANIFEST_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_INTERNAL_WORK_POLICY_VERSION;
  promptVersion: typeof FRENCH_INTERNAL_PROMPT_VERSION;
  lineage: FrenchCodexReleaseLineage;
  sourcePaths: {
    pilot: string;
    proposerA: string;
    proposerB: string;
    packets: string;
  };
  sourceDigests: {
    pilot: string;
    proposerA: string;
    proposerB: string;
    packets: string;
    pilotContentHash: string;
  };
  selectedPackets: FrenchCodexSelectedPacketsArtifact;
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

interface Options {
  pilotPath: string;
  proposerAPath: string;
  proposerBPath: string;
  packetsPath: string;
  outputDir: string;
  maxCombinedBytes: number;
  maxItems: Record<FrenchInternalMeaningSize, number>;
}

export interface FrenchCodexPilotManifestValidationOptions {
  verifyFiles?: boolean;
  expectedEntries?: number;
}

export function buildLexiconV3FrenchCodexPilotBatches(
  options: Options
): FrenchCodexPilotBatchManifest {
  assertOptions(options);
  const releaseLock = acquireBuildLock(`${resolve(options.outputDir)}.lock`);
  try {
    return buildLexiconV3FrenchCodexPilotBatchesUnlocked(options);
  } finally {
    releaseLock();
  }
}

function buildLexiconV3FrenchCodexPilotBatchesUnlocked(
  options: Options
): FrenchCodexPilotBatchManifest {
  const pilotText = readFileSync(options.pilotPath, "utf8");
  const proposerAText = readFileSync(options.proposerAPath, "utf8");
  const proposerBText = readFileSync(options.proposerBPath, "utf8");
  const packetsText = readFileSync(options.packetsPath, "utf8");
  const pilot = JSON.parse(pilotText) as FrenchInternalPilotPlan;
  assertPilot(pilot);
  const proposerA = readViews(proposerAText, "proposerA");
  const proposerB = readViews(proposerBText, "proposerB");
  const packets = readPackets(packetsText, new Set(pilot.keys));
  assertExactPilotCoverage(pilot, proposerA, proposerB);

  const items = pilot.selections.map((selection) => {
    const a = proposerA.get(selection.entryKey)! as FrenchInternalProposerAView;
    const b = proposerB.get(selection.entryKey)! as FrenchInternalProposerBView;
    const packet = packets.get(selection.entryKey);
    if (!packet) {
      throw new Error(
        `french-codex-pilot-packet-missing:${selection.entryKey}`
      );
    }
    if (
      selection.proposerAViewHash !== a.viewHash ||
      selection.proposerBViewHash !== b.viewHash ||
      selection.workViewHash !== a.workViewHash ||
      selection.workViewHash !== b.workViewHash
    ) {
      throw new Error(
        `french-codex-pilot-selection-stale:${selection.entryKey}`
      );
    }
    assertExactPilotItemLineage(pilot, selection, a, b, packet);
    if (
      a.lineage.packetHash !== packet.packetHash ||
      b.lineage.packetHash !== packet.packetHash ||
      a.lineage.englishHash !== packet.english.contentHash ||
      b.lineage.englishHash !== packet.english.contentHash
    ) {
      throw new Error(
        `french-codex-pilot-packet-lineage-stale:${selection.entryKey}`
      );
    }
    return {
      entryKey: selection.entryKey,
      meaningSize: selection.strata.meaningSize,
      proposerA: a,
      proposerB: b,
      packet,
      aLine: `${JSON.stringify(a)}\n`,
      bLine: `${JSON.stringify(b)}\n`,
      packetLine: `${JSON.stringify(packet)}\n`
    } satisfies BatchItem;
  });
  const grouped = makeBatches(items, options);
  const tempDir = `${options.outputDir}.tmp-${process.pid}-${Date.now()}`;
  const backupDir = `${options.outputDir}.bak-${process.pid}-${Date.now()}`;
  mkdirSync(tempDir, { recursive: true });
  try {
    const batches = grouped
      .map((batchItems, index) => writeBatch(tempDir, batchItems, index))
      .map((batch) => rewriteBatchPaths(batch, tempDir, options.outputDir));
    const selectedPacketsText = jsonl(items.map((item) => item.packet));
    const selectedPackets = writeSelectedPacketsArtifact(
      join(tempDir, "selected-packets.jsonl"),
      join(resolve(options.outputDir), "selected-packets.jsonl"),
      selectedPacketsText,
      items.map((item) => item.packet),
      {
        releaseKey: pilot.releaseKey,
        releaseSnapshotFingerprint: pilot.releaseSnapshotFingerprint,
        sourceLogicalDigest: pilot.sourceLogicalDigest
      }
    );
    const counts = Object.fromEntries(
      SIZE_ORDER.map((size) => [
        size,
        items.filter((item) => item.meaningSize === size).length
      ])
    ) as Record<FrenchInternalMeaningSize, number>;
    const content = {
      schemaVersion: FRENCH_CODEX_PILOT_BATCH_MANIFEST_SCHEMA_VERSION,
      policyVersion: FRENCH_INTERNAL_WORK_POLICY_VERSION,
      promptVersion: FRENCH_INTERNAL_PROMPT_VERSION,
      lineage: {
        releaseKey: pilot.releaseKey,
        releaseSnapshotFingerprint: pilot.releaseSnapshotFingerprint,
        sourceLogicalDigest: pilot.sourceLogicalDigest
      },
      sourcePaths: {
        pilot: resolve(options.pilotPath),
        proposerA: resolve(options.proposerAPath),
        proposerB: resolve(options.proposerBPath),
        packets: resolve(options.packetsPath)
      },
      sourceDigests: {
        pilot: sha256(pilotText),
        proposerA: sha256(proposerAText),
        proposerB: sha256(proposerBText),
        packets: sha256(packetsText),
        pilotContentHash: pilot.contentHash
      },
      selectedPackets,
      batching: {
        maxCombinedBytes: options.maxCombinedBytes,
        maxItems: options.maxItems
      },
      counts: {
        entries: items.length,
        batches: batches.length,
        byMeaningSize: counts
      },
      batches
    };
    const manifest: FrenchCodexPilotBatchManifest = {
      ...content,
      manifestHash: hashFrenchInternalJson(content)
    };
    writeFileSync(
      join(tempDir, "manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8"
    );
    const installedManifestPath = join(options.outputDir, "manifest.json");
    if (existsSync(installedManifestPath)) {
      const installed = JSON.parse(
        readFileSync(installedManifestPath, "utf8")
      ) as FrenchCodexPilotBatchManifest;
      if (installed.manifestHash === manifest.manifestHash) {
        assertFrenchCodexPilotBatchManifest(installed, true);
        rmSync(tempDir, { recursive: true, force: true });
        return installed;
      }
    }
    installDirectoryAtomically(tempDir, options.outputDir, backupDir);
    return manifest;
  } catch (error) {
    rmSync(tempDir, { recursive: true, force: true });
    throw error;
  }
}

function makeBatches(items: BatchItem[], options: Options): BatchItem[][] {
  const result: BatchItem[][] = [];
  let current: BatchItem[] = [];
  let bytes = 0;
  for (const item of items) {
    const itemBytes =
      Buffer.byteLength(item.aLine) + Buffer.byteLength(item.bLine);
    if (itemBytes > options.maxCombinedBytes) {
      throw new Error(`french-codex-pilot-item-budget:${item.entryKey}`);
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
  if (current.length > 0) result.push(current);
  if (result.flat().length !== items.length) {
    throw new Error("french-codex-pilot-batch-cardinality-mismatch");
  }
  if (
    result
      .flat()
      .some((item, index) => item.entryKey !== items[index]?.entryKey)
  ) {
    throw new Error("french-codex-pilot-batch-order-mismatch");
  }
  return result;
}

function writeBatch(
  tempDir: string,
  items: BatchItem[],
  globalIndex: number
): FrenchCodexPilotBatchRecord {
  const meaningSize = items[0]!.meaningSize;
  if (items.some((item) => item.meaningSize !== meaningSize)) {
    throw new Error("french-codex-pilot-mixed-size-batch");
  }
  const batchId = `pilot-${meaningSize}-${String(globalIndex + 1).padStart(3, "0")}`;
  const batchDir = join(tempDir, batchId);
  mkdirSync(batchDir, { recursive: true });
  const aText = items.map((item) => item.aLine).join("");
  const bText = items.map((item) => item.bLine).join("");
  const packetText = items.map((item) => item.packetLine).join("");
  const aInput = writeArtifact(join(batchDir, "proposer-a-input.jsonl"), aText);
  const bInput = writeArtifact(join(batchDir, "proposer-b-input.jsonl"), bText);
  const packetInput = writeArtifact(
    join(batchDir, "packets.jsonl"),
    packetText
  );
  const aSchema = writeArtifact(
    join(batchDir, "proposer-a-output.schema.json"),
    `${JSON.stringify(draftOutputSchema("proposerA", items), null, 2)}\n`
  );
  const bSchema = writeArtifact(
    join(batchDir, "proposer-b-output.schema.json"),
    `${JSON.stringify(draftOutputSchema("proposerB", items), null, 2)}\n`
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
    inputs: { proposerA: aInput, proposerB: bInput, packets: packetInput },
    schemas: { proposerA: aSchema, proposerB: bSchema },
    expectedDraftPaths: {
      proposerA: join(batchDir, "proposer-a-drafts.jsonl"),
      proposerB: join(batchDir, "proposer-b-drafts.jsonl")
    }
  };
  return { ...content, batchHash: hashFrenchInternalJson(content) };
}

function draftOutputSchema(role: Role, items: BatchItem[]): object {
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

export function frenchCodexPilotDraftOutputSchema(
  role: "proposerA" | "proposerB",
  keys: readonly string[],
  hashes: readonly string[],
  segmentIds: readonly string[],
  itemCount: number
): object {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    additionalProperties: false,
    required: ["drafts"],
    properties: {
      drafts: {
        type: "array",
        minItems: itemCount,
        maxItems: itemCount,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "schemaVersion",
            "role",
            "entryKey",
            "inputHash",
            "glossFr",
            "meaningSegmentsFr",
            "entityMentionsFr",
            "notesFr",
            "carrierTermsFr",
            "confidence"
          ],
          properties: {
            schemaVersion: {
              type: "string",
              enum: [FRENCH_INTERNAL_PROPOSER_DRAFT_SCHEMA_VERSION]
            },
            role: { type: "string", enum: [role] },
            entryKey: { type: "string", enum: keys },
            inputHash: { type: "string", enum: hashes },
            glossFr: { type: "string", minLength: 1 },
            meaningSegmentsFr: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["id", "text"],
                properties: {
                  id: { type: "string", enum: segmentIds },
                  text: { type: "string", minLength: 1 }
                }
              }
            },
            entityMentionsFr: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["mentionId", "segmentId", "chosenFrenchForm"],
                properties: {
                  mentionId: { type: "string", minLength: 1 },
                  segmentId: { type: "string", minLength: 1 },
                  chosenFrenchForm: { type: "string", minLength: 1 }
                }
              }
            },
            notesFr: { type: "string" },
            carrierTermsFr: {
              type: "array",
              items: { type: "string", minLength: 1 }
            },
            confidence: { type: "number", minimum: 0, maximum: 1 }
          }
        }
      }
    }
  };
}

function readViews(text: string, role: Role): Map<string, View> {
  const result = new Map<string, View>();
  for (const [index, line] of text.split(/\r?\n/u).entries()) {
    if (!line.trim()) continue;
    const view = JSON.parse(line) as View;
    const expectedKind =
      role === "proposerA" ? "proposer_a_blind" : "proposer_b_candidates";
    if (
      view.schemaVersion !== FRENCH_INTERNAL_PROPOSER_VIEW_SCHEMA_VERSION ||
      view.policyVersion !== FRENCH_INTERNAL_WORK_POLICY_VERSION ||
      view.role !== role ||
      view.viewKind !== expectedKind ||
      !SHA256_PATTERN.test(view.viewHash) ||
      frenchInternalViewHash(view) !== view.viewHash
    ) {
      throw new Error(`french-codex-pilot-invalid-${role}-view:${index + 1}`);
    }
    if (role === "proposerA") {
      assertProposerABlindView(view as FrenchInternalProposerAView);
    }
    if (result.has(view.entryKey)) {
      throw new Error(`french-codex-pilot-duplicate-${role}:${view.entryKey}`);
    }
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
    if (issues.length > 0) {
      throw new Error(
        `french-codex-pilot-invalid-packet:${index + 1}:${issues.join(",")}`
      );
    }
    if (allKeys.has(packet.entryKey)) {
      throw new Error(`french-codex-pilot-duplicate-packet:${packet.entryKey}`);
    }
    if (allStepIds.has(packet.identity.stepEntryId)) {
      throw new Error(
        `french-codex-pilot-duplicate-step-id:${packet.identity.stepEntryId}`
      );
    }
    allKeys.add(packet.entryKey);
    allStepIds.add(packet.identity.stepEntryId);
    if (selected.has(packet.entryKey)) result.set(packet.entryKey, packet);
  }
  if (result.size !== selected.size) {
    throw new Error("french-codex-pilot-packet-coverage-mismatch");
  }
  return result;
}

function assertPilot(pilot: FrenchInternalPilotPlan): void {
  const { contentHash, ...content } = pilot;
  if (
    pilot.schemaVersion !== FRENCH_INTERNAL_PILOT_SCHEMA_VERSION ||
    pilot.policyVersion !== FRENCH_INTERNAL_WORK_POLICY_VERSION ||
    !pilot.releaseKey?.trim() ||
    !SHA256_PATTERN.test(pilot.releaseSnapshotFingerprint) ||
    !SHA256_PATTERN.test(pilot.sourceLogicalDigest) ||
    !SHA256_PATTERN.test(contentHash) ||
    hashFrenchInternalWorkJson(content) !== contentHash ||
    pilot.keys.length !== pilot.pilotSize ||
    pilot.selections.length !== pilot.pilotSize ||
    new Set(pilot.keys).size !== pilot.pilotSize
  ) {
    throw new Error("french-codex-pilot-plan-invalid");
  }
  for (const [index, selection] of pilot.selections.entries()) {
    const { selectionHash, ...selectionContent } = selection;
    if (
      pilot.keys[index] !== selection.entryKey ||
      !SHA256_PATTERN.test(selectionHash) ||
      hashFrenchInternalWorkJson(selectionContent) !== selectionHash
    ) {
      throw new Error(
        `french-codex-pilot-selection-invalid:${selection.entryKey}`
      );
    }
  }
}

function assertExactPilotItemLineage(
  pilot: FrenchInternalPilotPlan,
  selection: FrenchInternalPilotPlan["selections"][number],
  proposerA: FrenchInternalProposerAView,
  proposerB: FrenchInternalProposerBView,
  packet: LexiconV3FrenchPacket
): void {
  const expectedLineageHash = hashFrenchInternalJson(selection.lineage);
  if (
    hashFrenchInternalJson(proposerA.lineage) !== expectedLineageHash ||
    hashFrenchInternalJson(proposerB.lineage) !== expectedLineageHash ||
    selection.lineage.releaseKey !== pilot.releaseKey ||
    selection.lineage.releaseSnapshotFingerprint !==
      pilot.releaseSnapshotFingerprint ||
    selection.lineage.sourceLogicalDigest !== pilot.sourceLogicalDigest ||
    packet.englishRelease.releaseKey !== pilot.releaseKey ||
    packet.englishRelease.releaseSnapshotFingerprint !==
      pilot.releaseSnapshotFingerprint ||
    hashFrenchInternalJson(packet.englishRelease.parents) !==
      hashFrenchInternalJson(selection.lineage.englishParents) ||
    selection.lineage.packetHash !== packet.packetHash ||
    selection.lineage.englishHash !== packet.english.contentHash
  ) {
    throw new Error(
      `french-codex-pilot-exact-lineage-mismatch:${selection.entryKey}`
    );
  }
}

function assertExactPilotCoverage(
  pilot: FrenchInternalPilotPlan,
  proposerA: Map<string, View>,
  proposerB: Map<string, View>
): void {
  const expected = new Set(pilot.keys);
  for (const key of expected) {
    if (!proposerA.has(key) || !proposerB.has(key)) {
      throw new Error(`french-codex-pilot-view-missing:${key}`);
    }
  }
  for (const [label, views] of [
    ["proposerA", proposerA],
    ["proposerB", proposerB]
  ] as const) {
    const orphans = [...views.keys()].filter((key) => !expected.has(key));
    if (orphans.length > 0 || views.size !== expected.size) {
      throw new Error(`french-codex-pilot-${label}-coverage-mismatch`);
    }
  }
}

export function assertFrenchCodexPilotBatchManifest(
  manifest: FrenchCodexPilotBatchManifest,
  options: FrenchCodexPilotManifestValidationOptions | boolean = {}
): void {
  if (
    manifest.schemaVersion !== FRENCH_CODEX_PILOT_BATCH_MANIFEST_SCHEMA_VERSION
  ) {
    throw new Error(
      `french-codex-pilot-manifest-migration-required:${String(manifest.schemaVersion)}`
    );
  }
  const normalizedOptions =
    typeof options === "boolean" ? { verifyFiles: options } : options;
  const { manifestHash, ...content } = manifest;
  if (
    manifest.policyVersion !== FRENCH_INTERNAL_WORK_POLICY_VERSION ||
    manifest.promptVersion !== FRENCH_INTERNAL_PROMPT_VERSION ||
    !manifest.lineage?.releaseKey?.trim() ||
    !SHA256_PATTERN.test(manifest.lineage?.releaseSnapshotFingerprint ?? "") ||
    !SHA256_PATTERN.test(manifest.lineage?.sourceLogicalDigest ?? "") ||
    !SHA256_PATTERN.test(manifestHash) ||
    hashFrenchInternalJson(content) !== manifestHash ||
    manifest.counts.entries < 1 ||
    manifest.batches.length < 1 ||
    manifest.batches.length !== manifest.counts.batches ||
    (normalizedOptions.expectedEntries !== undefined &&
      manifest.counts.entries !== normalizedOptions.expectedEntries)
  ) {
    throw new Error("french-codex-pilot-manifest-invalid");
  }
  const batchIds = new Set<string>();
  const keys = new Set<string>();
  const orderedKeys: string[] = [];
  const byMeaningSize = Object.fromEntries(
    SIZE_ORDER.map((size) => [size, 0])
  ) as Record<FrenchInternalMeaningSize, number>;
  for (const batch of manifest.batches) {
    const { batchHash, ...batchContent } = batch;
    if (
      !/^pilot-(short|medium|long|very_long)-\d{3}$/u.test(batch.batchId) ||
      batchIds.has(batch.batchId) ||
      !SIZE_ORDER.includes(batch.meaningSize) ||
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
      )
    ) {
      throw new Error(`french-codex-pilot-batch-invalid:${batch.batchId}`);
    }
    batchIds.add(batch.batchId);
    byMeaningSize[batch.meaningSize] += batch.keys.length;
    for (const key of batch.keys) {
      if (keys.has(key)) {
        throw new Error(`french-codex-pilot-key-duplicate:${key}`);
      }
      keys.add(key);
      orderedKeys.push(key);
    }
    if (normalizedOptions.verifyFiles) {
      for (const artifact of [
        batch.inputs.proposerA,
        batch.inputs.proposerB,
        batch.inputs.packets,
        batch.schemas.proposerA,
        batch.schemas.proposerB
      ]) {
        assertManifestArtifact(artifact, batch.batchId);
      }
      const directory = dirname(batch.inputs.proposerA.path);
      if (
        dirname(batch.inputs.proposerB.path) !== directory ||
        dirname(batch.inputs.packets.path) !== directory ||
        dirname(batch.schemas.proposerA.path) !== directory ||
        dirname(batch.schemas.proposerB.path) !== directory ||
        batch.expectedDraftPaths.proposerA !==
          join(directory, "proposer-a-drafts.jsonl") ||
        batch.expectedDraftPaths.proposerB !==
          join(directory, "proposer-b-drafts.jsonl")
      ) {
        throw new Error(
          `french-codex-pilot-batch-path-invalid:${batch.batchId}`
        );
      }
    }
  }
  if (
    keys.size !== manifest.counts.entries ||
    SIZE_ORDER.some(
      (size) => byMeaningSize[size] !== manifest.counts.byMeaningSize[size]
    ) ||
    Object.values(manifest.counts.byMeaningSize).reduce(
      (sum, count) => sum + count,
      0
    ) !== manifest.counts.entries
  ) {
    throw new Error("french-codex-pilot-manifest-coverage-invalid");
  }
  const batchRoot = dirname(
    dirname(manifest.batches[0]!.inputs.proposerA.path)
  );
  assertSelectedPacketsMetadata(
    manifest.selectedPackets,
    join(batchRoot, "selected-packets.jsonl"),
    manifest.counts.entries,
    manifest.lineage
  );
  if (!normalizedOptions.verifyFiles) return;
  for (const [label, path, digest] of [
    ["pilot", manifest.sourcePaths.pilot, manifest.sourceDigests.pilot],
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
    if (!existsSync(path) || sha256(readFileSync(path, "utf8")) !== digest) {
      throw new Error(`french-codex-pilot-source-stale:${label}`);
    }
  }
  const pilot = JSON.parse(
    readFileSync(manifest.sourcePaths.pilot, "utf8")
  ) as FrenchInternalPilotPlan;
  assertPilot(pilot);
  if (
    pilot.contentHash !== manifest.sourceDigests.pilotContentHash ||
    pilot.releaseKey !== manifest.lineage.releaseKey ||
    pilot.releaseSnapshotFingerprint !==
      manifest.lineage.releaseSnapshotFingerprint ||
    pilot.sourceLogicalDigest !== manifest.lineage.sourceLogicalDigest ||
    pilot.pilotSize !== manifest.counts.entries ||
    pilot.keys.some((key, index) => key !== orderedKeys[index])
  ) {
    throw new Error("french-codex-pilot-source-plan-mismatch");
  }
  const sourceA = readViews(
    readFileSync(manifest.sourcePaths.proposerA, "utf8"),
    "proposerA"
  );
  const sourceB = readViews(
    readFileSync(manifest.sourcePaths.proposerB, "utf8"),
    "proposerB"
  );
  const sourcePackets = readPackets(
    readFileSync(manifest.sourcePaths.packets, "utf8"),
    keys
  );
  if (
    sourceA.size !== keys.size ||
    sourceB.size !== keys.size ||
    sourcePackets.size !== keys.size
  ) {
    throw new Error("french-codex-pilot-source-coverage-mismatch");
  }
  const selectedPackets = readPacketSequence(
    manifest.selectedPackets.path,
    "french-codex-pilot-selected-packets"
  );
  assertSelectedPacketsContent(
    manifest.selectedPackets,
    selectedPackets,
    orderedKeys,
    manifest.batches
  );
  if (
    selectedPackets.some(
      (packet) =>
        sourcePackets.get(packet.entryKey)?.packetHash !== packet.packetHash ||
        packet.englishRelease.releaseKey !== manifest.lineage.releaseKey ||
        packet.englishRelease.releaseSnapshotFingerprint !==
          manifest.lineage.releaseSnapshotFingerprint
    )
  ) {
    throw new Error("french-codex-pilot-selected-packets-source-mismatch");
  }
  for (const batch of manifest.batches) {
    for (const [index, key] of batch.keys.entries()) {
      if (
        sourceA.get(key)?.viewHash !== batch.proposerAViewHashes[index] ||
        sourceB.get(key)?.viewHash !== batch.proposerBViewHashes[index]
      ) {
        throw new Error(`french-codex-pilot-source-view-mismatch:${key}`);
      }
    }
  }
}

function assertManifestArtifact(
  artifact: FrenchCodexFileArtifact,
  batchId: string
): void {
  if (
    !existsSync(artifact.path) ||
    !SHA256_PATTERN.test(artifact.sha256) ||
    readFileSync(artifact.path).byteLength !== artifact.bytes ||
    sha256(readFileSync(artifact.path, "utf8")) !== artifact.sha256
  ) {
    throw new Error(`french-codex-pilot-artifact-stale:${batchId}`);
  }
}

function writeArtifact(path: string, text: string): FrenchCodexFileArtifact {
  writeFileSync(path, text, "utf8");
  return {
    path,
    sha256: sha256(text),
    bytes: Buffer.byteLength(text)
  };
}

function writeSelectedPacketsArtifact(
  physicalPath: string,
  finalPath: string,
  text: string,
  packets: readonly LexiconV3FrenchPacket[],
  lineage: FrenchCodexReleaseLineage
): FrenchCodexSelectedPacketsArtifact {
  writeFileSync(physicalPath, text, "utf8");
  return {
    path: finalPath,
    sha256: sha256(text),
    bytes: Buffer.byteLength(text),
    records: packets.length,
    logicalDigest: frenchCodexSelectedPacketsLogicalDigest(packets),
    ...lineage
  };
}

export function frenchCodexSelectedPacketsLogicalDigest(
  packets: readonly LexiconV3FrenchPacket[]
): string {
  return hashFrenchInternalJson(
    packets.map((packet) => ({
      entryKey: packet.entryKey,
      packetHash: packet.packetHash
    }))
  );
}

export function assertSelectedPacketsMetadata(
  artifact: FrenchCodexSelectedPacketsArtifact,
  expectedPath: string,
  expectedRecords: number,
  expectedLineage?: FrenchCodexReleaseLineage
): void {
  if (
    resolve(artifact?.path ?? "") !== resolve(expectedPath) ||
    basename(artifact.path) !== "selected-packets.jsonl" ||
    !SHA256_PATTERN.test(artifact.sha256) ||
    !Number.isInteger(artifact.bytes) ||
    artifact.bytes < 1 ||
    !Number.isInteger(artifact.records) ||
    artifact.records !== expectedRecords ||
    !SHA256_PATTERN.test(artifact.logicalDigest) ||
    !artifact.releaseKey?.trim() ||
    !SHA256_PATTERN.test(artifact.releaseSnapshotFingerprint) ||
    !SHA256_PATTERN.test(artifact.sourceLogicalDigest) ||
    (expectedLineage !== undefined &&
      (artifact.releaseKey !== expectedLineage.releaseKey ||
        artifact.releaseSnapshotFingerprint !==
          expectedLineage.releaseSnapshotFingerprint ||
        artifact.sourceLogicalDigest !== expectedLineage.sourceLogicalDigest))
  ) {
    throw new Error("french-codex-selected-packets-metadata-invalid");
  }
}

function assertSelectedPacketsContent(
  artifact: FrenchCodexSelectedPacketsArtifact,
  packets: readonly LexiconV3FrenchPacket[],
  expectedKeys: readonly string[],
  batches: readonly FrenchCodexPilotBatchRecord[]
): void {
  const text = readFileSync(artifact.path, "utf8");
  if (
    sha256(text) !== artifact.sha256 ||
    Buffer.byteLength(text) !== artifact.bytes ||
    packets.length !== artifact.records ||
    packets.some((packet, index) => packet.entryKey !== expectedKeys[index]) ||
    packets.some(
      (packet) =>
        packet.englishRelease.releaseKey !== artifact.releaseKey ||
        packet.englishRelease.releaseSnapshotFingerprint !==
          artifact.releaseSnapshotFingerprint
    ) ||
    frenchCodexSelectedPacketsLogicalDigest(packets) !== artifact.logicalDigest
  ) {
    throw new Error("french-codex-selected-packets-content-invalid");
  }
  const batchPacketsText = batches
    .map((batch) => readFileSync(batch.inputs.packets.path, "utf8"))
    .join("");
  if (batchPacketsText !== text) {
    throw new Error("french-codex-selected-packets-batches-mismatch");
  }
}

function readPacketSequence(
  path: string,
  label: string
): LexiconV3FrenchPacket[] {
  if (!existsSync(path)) throw new Error(`${label}-missing`);
  const packets: LexiconV3FrenchPacket[] = [];
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
      throw new Error(`${label}-invalid-json:${index + 1}`);
    }
    const issues = validateFrenchPacket(packet);
    if (
      issues.length > 0 ||
      keys.has(packet.entryKey) ||
      stepIds.has(packet.identity.stepEntryId)
    ) {
      throw new Error(`${label}-invalid:${index + 1}:${issues.join(",")}`);
    }
    keys.add(packet.entryKey);
    stepIds.add(packet.identity.stepEntryId);
    packets.push(packet);
  }
  if (packets.length < 1) throw new Error(`${label}-empty`);
  return packets;
}

function jsonl(values: readonly unknown[]): string {
  return `${values.map((value) => JSON.stringify(value)).join("\n")}\n`;
}

function installDirectoryAtomically(
  tempDir: string,
  outputDir: string,
  backupDir: string
): void {
  mkdirSync(dirname(outputDir), { recursive: true });
  const existed = existsSync(outputDir);
  try {
    if (existed) renameSync(outputDir, backupDir);
    renameSync(tempDir, outputDir);
    rmSync(backupDir, { recursive: true, force: true });
  } catch (error) {
    rmSync(outputDir, { recursive: true, force: true });
    if (existed && existsSync(backupDir)) renameSync(backupDir, outputDir);
    throw error;
  }
}

function acquireBuildLock(path: string): () => void {
  try {
    return acquireFrenchCodexSqliteLock(path);
  } catch (error) {
    if (error instanceof FrenchCodexLockBusyError) {
      throw new Error(`french-codex-pilot-build-locked:${path}`);
    }
    throw error;
  }
}

function rewriteBatchPaths(
  batch: FrenchCodexPilotBatchRecord,
  oldRoot: string,
  newRoot: string
): FrenchCodexPilotBatchRecord {
  const rewritten = JSON.parse(
    JSON.stringify(batch).split(oldRoot).join(newRoot)
  ) as FrenchCodexPilotBatchRecord;
  const { batchHash: _batchHash, ...content } = rewritten;
  void _batchHash;
  return { ...content, batchHash: hashFrenchInternalJson(content) };
}

function assertOptions(options: Options): void {
  if (
    !Number.isSafeInteger(options.maxCombinedBytes) ||
    options.maxCombinedBytes < 1
  ) {
    throw new Error("french-codex-pilot-invalid-max-bytes");
  }
  for (const size of SIZE_ORDER) {
    if (
      !Number.isSafeInteger(options.maxItems[size]) ||
      options.maxItems[size] < 1
    ) {
      throw new Error(`french-codex-pilot-invalid-max-items:${size}`);
    }
  }
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function parseFrenchCodexPilotBatchArgs(
  args: readonly string[]
): Options {
  const allowed = new Set([
    "pilot",
    "proposer-a",
    "proposer-b",
    "packets",
    "output-dir",
    "max-combined-bytes",
    "short-max-items",
    "medium-max-items",
    "long-max-items",
    "very-long-max-items"
  ]);
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index] ?? "";
    if (!token.startsWith("--")) {
      throw new Error(`unexpected-argument:${token}`);
    }
    const option = token.slice(2);
    const separator = option.indexOf("=");
    const key = separator === -1 ? option : option.slice(0, separator);
    const inline = separator === -1 ? undefined : option.slice(separator + 1);
    if (!allowed.has(key)) throw new Error(`unknown-option:${key}`);
    if (values.has(key)) throw new Error(`duplicate-option:${key}`);
    const next = args[index + 1];
    if (inline !== undefined) {
      if (inline.length === 0) throw new Error(`missing-value:${key}`);
      values.set(key, inline);
    } else if (next && !next.startsWith("--")) {
      values.set(key, next);
      index += 1;
    } else throw new Error(`missing-value:${key}`);
  }
  const integer = (key: string, fallback: number): number => {
    const value = values.get(key);
    if (value === undefined) return fallback;
    if (!/^[1-9]\d*$/u.test(value)) {
      throw new Error(`invalid-positive-safe-integer:${key}:${value}`);
    }
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed)) {
      throw new Error(`invalid-positive-safe-integer:${key}:${value}`);
    }
    return parsed;
  };
  return {
    pilotPath: resolve(
      values.get("pilot") ?? join(DEFAULT_WORK_DIR, "pilot-keys.json")
    ),
    proposerAPath: resolve(
      values.get("proposer-a") ??
        join(DEFAULT_WORK_DIR, "pilot-proposer-a-input.jsonl")
    ),
    proposerBPath: resolve(
      values.get("proposer-b") ??
        join(DEFAULT_WORK_DIR, "pilot-proposer-b-input.jsonl")
    ),
    packetsPath: resolve(values.get("packets") ?? DEFAULT_PACKETS),
    outputDir: resolve(values.get("output-dir") ?? DEFAULT_OUTPUT_DIR),
    maxCombinedBytes: integer("max-combined-bytes", DEFAULT_MAX_COMBINED_BYTES),
    maxItems: {
      short: integer("short-max-items", DEFAULT_MAX_ITEMS.short),
      medium: integer("medium-max-items", DEFAULT_MAX_ITEMS.medium),
      long: integer("long-max-items", DEFAULT_MAX_ITEMS.long),
      very_long: integer("very-long-max-items", DEFAULT_MAX_ITEMS.very_long)
    }
  };
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? "")).href) {
  try {
    const options = parseFrenchCodexPilotBatchArgs(process.argv.slice(2));
    const manifest = buildLexiconV3FrenchCodexPilotBatches(options);
    process.stdout.write(
      `${JSON.stringify(
        {
          entries: manifest.counts.entries,
          batches: manifest.counts.batches,
          byMeaningSize: manifest.counts.byMeaningSize,
          manifestHash: manifest.manifestHash,
          output: resolve(options.outputDir)
        },
        null,
        2
      )}\n`
    );
  } catch (error) {
    process.stderr.write(
      `${basename(process.argv[1] ?? "buildLexiconV3FrenchCodexPilotBatches")}: ${
        error instanceof Error ? error.message : String(error)
      }\n`
    );
    process.exitCode = 1;
  }
}
