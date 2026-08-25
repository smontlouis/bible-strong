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
  readFrenchInternalArbiterArtifacts,
  readFrenchInternalAssemblyConfiguration,
  readFrenchInternalPackets,
  readFrenchInternalProposerArtifacts
} from "./assembleLexiconV3FrenchInternalReview.js";
import {
  frenchInternalAdjudicationViewHash,
  FRENCH_INTERNAL_ADJUDICATION_POLICY_VERSION,
  FRENCH_INTERNAL_ADJUDICATION_SUMMARY_SCHEMA_VERSION,
  FRENCH_INTERNAL_ARBITER_VIEW_SCHEMA_VERSION,
  FRENCH_INTERNAL_AUDITOR_VIEW_SCHEMA_VERSION,
  FRENCH_INTERNAL_REQUIRED_AUDIT_CHECKS,
  type FrenchInternalArbiterView,
  type FrenchInternalAuditorView
} from "./lexiconV3FrenchInternalAdjudication.js";
import {
  assertFrenchCodexAnyBatchManifest,
  type FrenchCodexAnyBatchManifest
} from "./buildLexiconV3FrenchCodexBatches.js";
import {
  FRENCH_INTERNAL_ARBITER_DRAFT_SCHEMA_VERSION,
  FRENCH_INTERNAL_AUDITOR_DRAFT_SCHEMA_VERSION
} from "../src/lexiconV3/frenchAgentDrafts.js";
import { frenchInternalPromptHash } from "../src/lexiconV3/frenchAgentPrompts.js";
import { hashFrenchInternalJson } from "../src/lexiconV3/frenchInternalReview.js";
import {
  acquireFrenchCodexSqliteLock,
  FrenchCodexLockBusyError
} from "../src/lexiconV3/frenchCodexSqliteLock.js";

export const FRENCH_CODEX_ADJUDICATION_BATCH_MANIFEST_SCHEMA_VERSION =
  "lexicon-v3-french-codex-adjudication-batches@1" as const;
export const FRENCH_CODEX_ADJUDICATION_SELECTION_SCHEMA_VERSION =
  "lexicon-v3-french-codex-adjudication-selection@1" as const;

const DEFAULT_ROOT = "outputs/lexicon-v3/fr-internal/pilot";
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;

export type FrenchCodexAdjudicationRole = "arbiter" | "auditor";
export type FrenchCodexAdjudicationView =
  | FrenchInternalArbiterView
  | FrenchInternalAuditorView;

export interface FrenchCodexAdjudicationFile {
  path: string;
  sha256: string;
  bytes: number;
}

export interface FrenchCodexAdjudicationBatchRecord {
  batchId: string;
  role: FrenchCodexAdjudicationRole;
  keys: string[];
  viewHashes: string[];
  input: FrenchCodexAdjudicationFile;
  outputSchema: FrenchCodexAdjudicationFile;
  selection: FrenchCodexAdjudicationFile;
  context: {
    packets: FrenchCodexAdjudicationFile;
    proposerA: FrenchCodexAdjudicationFile;
    proposerB: FrenchCodexAdjudicationFile;
    arbiterViews?: FrenchCodexAdjudicationFile;
    arbiters?: FrenchCodexAdjudicationFile;
  };
  expected: {
    responsePath: string;
    draftsPath: string;
    artifactsPath: string;
    artifactSummaryPath: string;
    eventsPath: string;
    stderrPath: string;
    runPath: string;
  };
  inputBytes: number;
  batchHash: string;
}

export interface FrenchCodexAdjudicationBatchManifest {
  schemaVersion: typeof FRENCH_CODEX_ADJUDICATION_BATCH_MANIFEST_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_INTERNAL_ADJUDICATION_POLICY_VERSION;
  role: FrenchCodexAdjudicationRole;
  namespace: string;
  sourcePaths: {
    views: string;
    viewSummary: string;
    packets: string;
    proposerA: string;
    proposerB: string;
    configuration: string;
    proposerRuns?: string;
    proposerSummary?: string;
    proposerBatchManifest?: string;
    proposerAttestationLinks?: string;
    arbiterViews?: string;
    arbiters?: string;
    arbiterSummary?: string;
  };
  sourceDigests: Record<string, string>;
  batching: {
    maxItems: number;
    maxInputBytes: number;
  };
  counts: {
    entries: number;
    batches: number;
  };
  entryOrderHash: string;
  batches: FrenchCodexAdjudicationBatchRecord[];
  manifestHash: string;
}

export interface BuildFrenchCodexAdjudicationBatchesOptions {
  role: FrenchCodexAdjudicationRole;
  viewsPath: string;
  viewSummaryPath: string;
  packetsPath: string;
  proposerAPath: string;
  proposerBPath: string;
  configurationPath: string;
  proposerRunsPath?: string;
  proposerSummaryPath?: string;
  proposerBatchManifestPath?: string;
  proposerAttestationLinksPath?: string;
  arbiterViewsPath?: string;
  arbiterPath?: string;
  arbiterSummaryPath?: string;
  outputDir: string;
  maxItems: number;
  maxInputBytes: number;
  replaceExisting?: boolean;
  namespace?: string;
}

interface SourceRecord {
  entryKey: string;
  line: string;
}

export function buildLexiconV3FrenchCodexAdjudicationBatches(
  options: BuildFrenchCodexAdjudicationBatchesOptions
): FrenchCodexAdjudicationBatchManifest {
  const release = acquireBuildLock(`${resolve(options.outputDir)}.writer.lock`);
  try {
    return buildLexiconV3FrenchCodexAdjudicationBatchesUnlocked(options);
  } finally {
    release();
  }
}

function buildLexiconV3FrenchCodexAdjudicationBatchesUnlocked(
  options: BuildFrenchCodexAdjudicationBatchesOptions
): FrenchCodexAdjudicationBatchManifest {
  assertOptions(options);
  if (existsSync(options.outputDir) && !options.replaceExisting) {
    throw new Error(
      `french-codex-adjudication-output-exists:${resolve(options.outputDir)}`
    );
  }
  const viewsText = readFileSync(options.viewsPath, "utf8");
  const viewSummaryText = readFileSync(options.viewSummaryPath, "utf8");
  const views = readViews(viewsText, options.role);
  assertViewSummary(
    viewSummaryText,
    viewsText,
    views,
    options.role,
    options.viewsPath
  );
  const packets = recordsByKey(
    readFrenchInternalPackets(options.packetsPath).records,
    "packet"
  );
  const proposerA = recordsByKey(
    readFrenchInternalProposerArtifacts(options.proposerAPath, "proposerA")
      .records,
    "proposerA"
  );
  const proposerB = recordsByKey(
    readFrenchInternalProposerArtifacts(options.proposerBPath, "proposerB")
      .records,
    "proposerB"
  );
  const configuration = readFrenchInternalAssemblyConfiguration(
    options.configurationPath
  );
  if (
    configuration.configuration.arbiterPromptHash !==
      frenchInternalPromptHash("arbiter") ||
    configuration.configuration.auditorPromptHash !==
      frenchInternalPromptHash("auditor")
  ) {
    throw new Error("french-codex-adjudication-configuration-prompt-stale");
  }
  const arbiterViews =
    options.role === "auditor"
      ? rawRecordsByKey<FrenchInternalArbiterView>(
          requiredPath(options.arbiterViewsPath, "arbiter-views"),
          "arbiter-view"
        )
      : undefined;
  const arbiters =
    options.role === "auditor"
      ? recordsByKey(
          readFrenchInternalArbiterArtifacts(
            requiredPath(options.arbiterPath, "arbiters")
          ).records,
          "arbiter"
        )
      : undefined;

  assertContainedCoverage(views, packets, "packet");
  assertExactCoverage(views, proposerA, "proposerA");
  assertExactCoverage(views, proposerB, "proposerB");
  if (arbiterViews) assertExactCoverage(views, arbiterViews, "arbiter-view");
  if (arbiters) assertExactCoverage(views, arbiters, "arbiter");

  const groups = batchViews(views, options.maxItems, options.maxInputBytes);
  const tempDir = `${resolve(options.outputDir)}.tmp-${process.pid}-${Date.now()}`;
  const backupDir = `${resolve(options.outputDir)}.bak-${process.pid}-${Date.now()}`;
  mkdirSync(tempDir, { recursive: true });
  try {
    const batches = groups.map((group, index) =>
      writeBatch({
        group,
        index,
        role: options.role,
        tempDir,
        finalDir: resolve(options.outputDir),
        packets,
        proposerA,
        proposerB,
        arbiterViews,
        arbiters
      })
    );
    const sourcePaths = {
      views: resolve(options.viewsPath),
      viewSummary: resolve(options.viewSummaryPath),
      packets: resolve(options.packetsPath),
      proposerA: resolve(options.proposerAPath),
      proposerB: resolve(options.proposerBPath),
      configuration: resolve(options.configurationPath),
      ...(options.proposerRunsPath
        ? {
            proposerRuns: resolve(options.proposerRunsPath),
            proposerSummary: resolve(options.proposerSummaryPath!),
            proposerBatchManifest: resolve(options.proposerBatchManifestPath!),
            proposerAttestationLinks: resolve(
              options.proposerAttestationLinksPath!
            )
          }
        : {}),
      ...(options.role === "auditor"
        ? {
            arbiterViews: resolve(options.arbiterViewsPath!),
            arbiters: resolve(options.arbiterPath!),
            arbiterSummary: resolve(options.arbiterSummaryPath!)
          }
        : {})
    };
    const sourceDigests = Object.fromEntries(
      Object.entries(sourcePaths).map(([key, path]) => [key, sha256File(path)])
    );
    const content = {
      schemaVersion: FRENCH_CODEX_ADJUDICATION_BATCH_MANIFEST_SCHEMA_VERSION,
      policyVersion: FRENCH_INTERNAL_ADJUDICATION_POLICY_VERSION,
      role: options.role,
      namespace: options.namespace ?? "/fr-internal/pilot",
      sourcePaths,
      sourceDigests,
      batching: {
        maxItems: options.maxItems,
        maxInputBytes: options.maxInputBytes
      },
      counts: { entries: views.length, batches: batches.length },
      entryOrderHash: hashFrenchInternalJson(
        views.map((view) => view.entryKey)
      ),
      batches
    };
    const manifest: FrenchCodexAdjudicationBatchManifest = {
      ...content,
      manifestHash: hashFrenchInternalJson(content)
    };
    writeFileSync(
      join(tempDir, "manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8"
    );
    installDirectoryAtomically(tempDir, resolve(options.outputDir), backupDir);
    return manifest;
  } catch (error) {
    rmSync(tempDir, { recursive: true, force: true });
    throw error;
  }
}

export function assertFrenchCodexAdjudicationBatchManifest(
  manifest: FrenchCodexAdjudicationBatchManifest
): void {
  const { manifestHash, ...content } = manifest;
  if (
    manifest.schemaVersion !==
      FRENCH_CODEX_ADJUDICATION_BATCH_MANIFEST_SCHEMA_VERSION ||
    manifest.policyVersion !== FRENCH_INTERNAL_ADJUDICATION_POLICY_VERSION ||
    !/^\/fr-internal\/(?:pilot|full|custom\/[a-z0-9][a-z0-9._-]*)$/u.test(
      manifest.namespace
    ) ||
    !SHA256_PATTERN.test(manifestHash) ||
    hashFrenchInternalJson(content) !== manifestHash ||
    manifest.batches.length !== manifest.counts.batches ||
    manifest.batches.reduce((total, batch) => total + batch.keys.length, 0) !==
      manifest.counts.entries
  ) {
    throw new Error("french-codex-adjudication-manifest-invalid");
  }
  const keys = manifest.batches.flatMap((batch) => batch.keys);
  const batchIds = manifest.batches.map((batch) => batch.batchId);
  if (
    new Set(keys).size !== keys.length ||
    new Set(batchIds).size !== batchIds.length ||
    hashFrenchInternalJson(keys) !== manifest.entryOrderHash
  ) {
    throw new Error("french-codex-adjudication-manifest-coverage-invalid");
  }
  for (const batch of manifest.batches) {
    assertBatch(batch, manifest.role);
    if (
      batch.keys.length > manifest.batching.maxItems ||
      batch.inputBytes > manifest.batching.maxInputBytes
    ) {
      throw new Error(
        `french-codex-adjudication-batch-budget-invalid:${batch.batchId}`
      );
    }
  }
}

export function frenchCodexAdjudicationOutputSchema(
  role: FrenchCodexAdjudicationRole,
  count: number
): object {
  const common = {
    schemaVersion: {
      type: "string",
      enum: [
        role === "arbiter"
          ? FRENCH_INTERNAL_ARBITER_DRAFT_SCHEMA_VERSION
          : FRENCH_INTERNAL_AUDITOR_DRAFT_SCHEMA_VERSION
      ]
    },
    role: { type: "string", enum: [role] },
    entryKey: { type: "string", minLength: 1 },
    inputHash: { type: "string", pattern: "^[a-f0-9]{64}$" }
  };
  const properties =
    role === "arbiter"
      ? {
          ...common,
          verdict: { type: "string", enum: ["accept", "review_needed"] },
          selectedProposal: {
            type: "string",
            enum: ["proposalA", "proposalB"]
          },
          reasons: {
            type: "array",
            items: { type: "string", minLength: 1 }
          }
        }
      : {
          ...common,
          verdict: { type: "string", enum: ["safe", "hold", "block"] },
          reasons: {
            type: "array",
            items: { type: "string", minLength: 1 }
          },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          checks: {
            type: "object",
            additionalProperties: false,
            required: [...FRENCH_INTERNAL_REQUIRED_AUDIT_CHECKS],
            properties: Object.fromEntries(
              FRENCH_INTERNAL_REQUIRED_AUDIT_CHECKS.map((check) => [
                check,
                { type: "string", enum: ["pass", "fail"] }
              ])
            )
          }
        };
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    additionalProperties: false,
    required: ["drafts"],
    properties: {
      drafts: {
        type: "array",
        minItems: count,
        maxItems: count,
        items: {
          type: "object",
          additionalProperties: false,
          required:
            role === "arbiter"
              ? [
                  "schemaVersion",
                  "role",
                  "entryKey",
                  "inputHash",
                  "verdict",
                  "selectedProposal",
                  "reasons"
                ]
              : [
                  "schemaVersion",
                  "role",
                  "entryKey",
                  "inputHash",
                  "verdict",
                  "reasons",
                  "confidence",
                  "checks"
                ],
          properties
        }
      }
    }
  };
}

function writeBatch(input: {
  group: FrenchCodexAdjudicationView[];
  index: number;
  role: FrenchCodexAdjudicationRole;
  tempDir: string;
  finalDir: string;
  packets: Map<string, SourceRecord>;
  proposerA: Map<string, SourceRecord>;
  proposerB: Map<string, SourceRecord>;
  arbiterViews?: Map<string, SourceRecord>;
  arbiters?: Map<string, SourceRecord>;
}): FrenchCodexAdjudicationBatchRecord {
  const batchId = `${input.role}-${String(input.index + 1).padStart(3, "0")}`;
  const physicalDir = join(input.tempDir, batchId);
  const finalDir = join(input.finalDir, batchId);
  mkdirSync(physicalDir, { recursive: true });
  const keys = input.group.map((view) => view.entryKey);
  const viewHashes = input.group.map((view) => view.viewHash);
  const viewText = jsonl(input.group);
  const selectionContent = {
    schemaVersion: FRENCH_CODEX_ADJUDICATION_SELECTION_SCHEMA_VERSION,
    role: input.role,
    keys,
    viewHashes
  };
  const selection = {
    ...selectionContent,
    contentHash: hashFrenchInternalJson(selectionContent)
  };
  const context = {
    packets: writeFinalArtifact(
      physicalDir,
      finalDir,
      "packets.jsonl",
      selectedText(keys, input.packets, "packet")
    ),
    proposerA: writeFinalArtifact(
      physicalDir,
      finalDir,
      "proposer-a.jsonl",
      selectedText(keys, input.proposerA, "proposerA")
    ),
    proposerB: writeFinalArtifact(
      physicalDir,
      finalDir,
      "proposer-b.jsonl",
      selectedText(keys, input.proposerB, "proposerB")
    ),
    ...(input.role === "auditor"
      ? {
          arbiterViews: writeFinalArtifact(
            physicalDir,
            finalDir,
            "arbiter-views.jsonl",
            selectedText(keys, input.arbiterViews!, "arbiter-view")
          ),
          arbiters: writeFinalArtifact(
            physicalDir,
            finalDir,
            "arbiters.jsonl",
            selectedText(keys, input.arbiters!, "arbiter")
          )
        }
      : {})
  };
  const expected = {
    responsePath: join(finalDir, `${input.role}-structured-response.json`),
    draftsPath: join(finalDir, `${input.role}-drafts.jsonl`),
    artifactsPath: join(finalDir, `${input.role}-artifacts.jsonl`),
    artifactSummaryPath: join(finalDir, `${input.role}-artifacts.summary.json`),
    eventsPath: join(finalDir, `${input.role}-agent-events.jsonl`),
    stderrPath: join(finalDir, `${input.role}-agent-stderr.log`),
    runPath: join(finalDir, `${input.role}-agent-run.json`)
  };
  const content = {
    batchId,
    role: input.role,
    keys,
    viewHashes,
    input: writeFinalArtifact(
      physicalDir,
      finalDir,
      `${input.role}-input.jsonl`,
      viewText
    ),
    outputSchema: writeFinalArtifact(
      physicalDir,
      finalDir,
      `${input.role}-output.schema.json`,
      `${JSON.stringify(
        frenchCodexAdjudicationOutputSchema(input.role, keys.length),
        null,
        2
      )}\n`
    ),
    selection: writeFinalArtifact(
      physicalDir,
      finalDir,
      "selection.json",
      `${JSON.stringify(selection, null, 2)}\n`
    ),
    context,
    expected,
    inputBytes: Buffer.byteLength(viewText)
  };
  return { ...content, batchHash: hashFrenchInternalJson(content) };
}

function writeFinalArtifact(
  physicalDir: string,
  finalDir: string,
  filename: string,
  text: string
): FrenchCodexAdjudicationFile {
  writeFileSync(join(physicalDir, filename), text, "utf8");
  return {
    path: join(finalDir, filename),
    sha256: sha256(text),
    bytes: Buffer.byteLength(text)
  };
}

function batchViews(
  views: FrenchCodexAdjudicationView[],
  maxItems: number,
  maxInputBytes: number
): FrenchCodexAdjudicationView[][] {
  const result: FrenchCodexAdjudicationView[][] = [];
  let current: FrenchCodexAdjudicationView[] = [];
  let bytes = 0;
  for (const view of views) {
    const lineBytes = Buffer.byteLength(`${JSON.stringify(view)}\n`);
    if (lineBytes > maxInputBytes) {
      throw new Error(
        `french-codex-adjudication-single-view-too-large:${view.entryKey}:${lineBytes}:${maxInputBytes}`
      );
    }
    if (
      current.length > 0 &&
      (current.length >= maxItems || bytes + lineBytes > maxInputBytes)
    ) {
      result.push(current);
      current = [];
      bytes = 0;
    }
    current.push(view);
    bytes += lineBytes;
  }
  if (current.length > 0) result.push(current);
  return result;
}

function readViews(
  text: string,
  role: FrenchCodexAdjudicationRole
): FrenchCodexAdjudicationView[] {
  const records = parseJsonl<FrenchCodexAdjudicationView>(text, "view");
  const seen = new Set<string>();
  for (const view of records) {
    const expectedSchema =
      role === "arbiter"
        ? FRENCH_INTERNAL_ARBITER_VIEW_SCHEMA_VERSION
        : FRENCH_INTERNAL_AUDITOR_VIEW_SCHEMA_VERSION;
    const expectedKind =
      role === "arbiter" ? "arbiter_exact_choice" : "auditor_adversarial_check";
    if (
      view.role !== role ||
      view.schemaVersion !== expectedSchema ||
      view.policyVersion !== FRENCH_INTERNAL_ADJUDICATION_POLICY_VERSION ||
      view.viewKind !== expectedKind ||
      !SHA256_PATTERN.test(view.viewHash) ||
      frenchInternalAdjudicationViewHash(view) !== view.viewHash ||
      seen.has(view.entryKey)
    ) {
      throw new Error(
        `french-codex-adjudication-invalid-${role}-view:${view.entryKey}`
      );
    }
    seen.add(view.entryKey);
  }
  if (records.length === 0) {
    throw new Error(`french-codex-adjudication-empty-${role}-views`);
  }
  return records;
}

function recordsByKey<T extends { entryKey: string }>(
  values: T[],
  label: string
): Map<string, SourceRecord> {
  const result = new Map<string, SourceRecord>();
  for (const value of values) {
    if (result.has(value.entryKey)) {
      throw new Error(
        `french-codex-adjudication-duplicate-${label}:${value.entryKey}`
      );
    }
    result.set(value.entryKey, {
      entryKey: value.entryKey,
      line: `${JSON.stringify(value)}\n`
    });
  }
  return result;
}

function rawRecordsByKey<T extends { entryKey: string }>(
  path: string,
  label: string
): Map<string, SourceRecord> {
  return recordsByKey(parseJsonl<T>(readFileSync(path, "utf8"), label), label);
}

function parseJsonl<T>(text: string, label: string): T[] {
  const result: T[] = [];
  for (const [index, line] of text.split(/\r?\n/u).entries()) {
    if (!line.trim()) continue;
    try {
      result.push(JSON.parse(line) as T);
    } catch {
      throw new Error(
        `french-codex-adjudication-invalid-${label}-json:${index + 1}`
      );
    }
  }
  return result;
}

function assertExactCoverage(
  views: FrenchCodexAdjudicationView[],
  records: Map<string, SourceRecord>,
  label: string
): void {
  const keys = new Set(views.map((view) => view.entryKey));
  for (const key of keys) {
    if (!records.has(key)) {
      throw new Error(`french-codex-adjudication-missing-${label}:${key}`);
    }
  }
  for (const key of records.keys()) {
    if (!keys.has(key)) {
      throw new Error(`french-codex-adjudication-orphan-${label}:${key}`);
    }
  }
}

function assertContainedCoverage(
  views: FrenchCodexAdjudicationView[],
  records: Map<string, SourceRecord>,
  label: string
): void {
  for (const view of views) {
    if (!records.has(view.entryKey)) {
      throw new Error(
        `french-codex-adjudication-missing-${label}:${view.entryKey}`
      );
    }
  }
}

function selectedText(
  keys: string[],
  records: Map<string, SourceRecord>,
  label: string
): string {
  return keys
    .map((key) => {
      const record = records.get(key);
      if (!record) {
        throw new Error(`french-codex-adjudication-missing-${label}:${key}`);
      }
      return record.line;
    })
    .join("");
}

function jsonl(values: unknown[]): string {
  return `${values.map((value) => JSON.stringify(value)).join("\n")}\n`;
}

function assertViewSummary(
  summaryText: string,
  viewsText: string,
  views: FrenchCodexAdjudicationView[],
  role: FrenchCodexAdjudicationRole,
  viewsPath: string
): void {
  let summary: Record<string, unknown>;
  try {
    summary = JSON.parse(summaryText) as Record<string, unknown>;
  } catch {
    throw new Error("french-codex-adjudication-view-summary-invalid-json");
  }
  const summaryDigest = summary.summaryDigest;
  const { summaryDigest: _digest, ...content } = summary;
  void _digest;
  const counts = isObject(summary.counts) ? summary.counts : {};
  const sourcePaths = isObject(summary.sourcePaths) ? summary.sourcePaths : {};
  const sourceDigests = isObject(summary.sourceDigests)
    ? summary.sourceDigests
    : {};
  if (
    summary.schemaVersion !==
      FRENCH_INTERNAL_ADJUDICATION_SUMMARY_SCHEMA_VERSION ||
    summary.policyVersion !== FRENCH_INTERNAL_ADJUDICATION_POLICY_VERSION ||
    summary.operation !== `build-${role}` ||
    typeof summaryDigest !== "string" ||
    !SHA256_PATTERN.test(summaryDigest) ||
    hashFrenchInternalJson(content) !== summaryDigest ||
    summary.outputDigest !== sha256(viewsText) ||
    resolve(String(sourcePaths.output ?? "")) !== resolve(viewsPath) ||
    counts.records !== views.length ||
    summary.entryOrderHash !==
      hashFrenchInternalJson(views.map((view) => view.entryKey)) ||
    summary.recordsLogicalDigest !==
      hashFrenchInternalJson(
        views.map((view) => ({
          entryKey: view.entryKey,
          recordHash: view.viewHash
        }))
      )
  ) {
    throw new Error("french-codex-adjudication-view-summary-stale");
  }
  for (const [key, digest] of Object.entries(sourceDigests)) {
    const path = sourcePaths[key];
    if (
      typeof path !== "string" ||
      typeof digest !== "string" ||
      !existsSync(path) ||
      sha256File(path) !== digest
    ) {
      throw new Error(
        `french-codex-adjudication-view-summary-source-stale:${key}`
      );
    }
  }
}

function assertBatch(
  batch: FrenchCodexAdjudicationBatchRecord,
  role: FrenchCodexAdjudicationRole
): void {
  const { batchHash, ...content } = batch;
  if (
    batch.role !== role ||
    !SHA256_PATTERN.test(batchHash) ||
    hashFrenchInternalJson(content) !== batchHash ||
    batch.keys.length < 1 ||
    batch.keys.length !== batch.viewHashes.length ||
    new Set(batch.keys).size !== batch.keys.length ||
    batch.input.bytes !== batch.inputBytes
  ) {
    throw new Error(`french-codex-adjudication-batch-invalid:${batch.batchId}`);
  }
}

function assertOptions(
  options: BuildFrenchCodexAdjudicationBatchesOptions
): void {
  if (options.role !== "arbiter" && options.role !== "auditor") {
    throw new Error(`french-codex-adjudication-role-invalid:${options.role}`);
  }
  const required = [
    options.viewsPath,
    options.viewSummaryPath,
    options.packetsPath,
    options.proposerAPath,
    options.proposerBPath,
    options.configurationPath,
    ...(options.proposerRunsPath
      ? [
          options.proposerRunsPath,
          requiredPath(options.proposerSummaryPath, "proposer-summary"),
          requiredPath(
            options.proposerBatchManifestPath,
            "proposer-batch-manifest"
          ),
          requiredPath(
            options.proposerAttestationLinksPath,
            "proposer-attestation-links"
          )
        ]
      : []),
    ...(options.role === "auditor"
      ? [
          requiredPath(options.arbiterViewsPath, "arbiter-views"),
          requiredPath(options.arbiterPath, "arbiters"),
          requiredPath(options.arbiterSummaryPath, "arbiter-summary")
        ]
      : [])
  ];
  for (const path of required) {
    if (!existsSync(path)) {
      throw new Error(`french-codex-adjudication-source-missing:${path}`);
    }
  }
  const proposerProofPaths = [
    options.proposerRunsPath,
    options.proposerSummaryPath,
    options.proposerBatchManifestPath,
    options.proposerAttestationLinksPath
  ];
  if (
    proposerProofPaths.some(Boolean) &&
    proposerProofPaths.some((value) => !value)
  ) {
    throw new Error("french-codex-adjudication-proposer-proof-incomplete");
  }
  if (options.proposerBatchManifestPath) {
    const proposerManifest = JSON.parse(
      readFileSync(options.proposerBatchManifestPath, "utf8")
    ) as FrenchCodexAnyBatchManifest;
    const context = assertFrenchCodexAnyBatchManifest(proposerManifest, {
      verifyFiles: true
    });
    if (
      resolve(options.packetsPath) !== resolve(context.selectedPackets.path)
    ) {
      throw new Error(
        "french-codex-adjudication-selected-packets-source-mismatch"
      );
    }
  }
  if (!Number.isInteger(options.maxItems) || options.maxItems < 1) {
    throw new Error("french-codex-adjudication-max-items-invalid");
  }
  if (!Number.isInteger(options.maxInputBytes) || options.maxInputBytes < 1) {
    throw new Error("french-codex-adjudication-max-bytes-invalid");
  }
}

function requiredPath(value: string | undefined, label: string): string {
  if (!value) throw new Error(`french-codex-adjudication-${label}-missing`);
  return value;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function installDirectoryAtomically(
  tempDir: string,
  outputDir: string,
  backupDir: string
): void {
  rmSync(backupDir, { recursive: true, force: true });
  let backedUp = false;
  try {
    if (existsSync(outputDir)) {
      renameSync(outputDir, backupDir);
      backedUp = true;
    }
    mkdirSync(dirname(outputDir), { recursive: true });
    renameSync(tempDir, outputDir);
    rmSync(backupDir, { recursive: true, force: true });
  } catch (error) {
    rmSync(outputDir, { recursive: true, force: true });
    if (backedUp && existsSync(backupDir)) renameSync(backupDir, outputDir);
    throw error;
  }
}

function acquireBuildLock(path: string): () => void {
  try {
    return acquireFrenchCodexSqliteLock(path);
  } catch (error) {
    if (error instanceof FrenchCodexLockBusyError) {
      throw new Error(`french-codex-adjudication-builder-locked:${path}`);
    }
    throw error;
  }
}

function sha256File(path: string): string {
  return sha256(readFileSync(path));
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export function parseFrenchCodexAdjudicationBatchArgs(
  args: readonly string[]
): BuildFrenchCodexAdjudicationBatchesOptions {
  const allowed = new Set([
    "role",
    "root",
    "namespace",
    "views",
    "view-summary",
    "packets",
    "proposer-a",
    "proposer-b",
    "configuration",
    "proposer-runs",
    "proposer-summary",
    "proposer-batch-manifest",
    "proposer-attestation-links",
    "arbiter-views",
    "arbiters",
    "arbiter-summary",
    "output-dir",
    "max-items",
    "max-input-bytes"
  ]);
  const values = new Map<string, string>();
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
  const role = values.get("role");
  if (role !== "arbiter" && role !== "auditor") {
    throw new Error(`french-codex-adjudication-role-invalid:${String(role)}`);
  }
  const positiveInteger = (key: string, fallback: number): number => {
    const raw = values.get(key);
    if (raw === undefined) return fallback;
    if (!/^[1-9]\d*$/u.test(raw)) {
      throw new Error(`invalid-positive-integer:${key}:${raw}`);
    }
    return Number(raw);
  };
  const maxItems = positiveInteger("max-items", role === "arbiter" ? 8 : 4);
  const maxInputBytes = positiveInteger("max-input-bytes", 450_000);
  const roleRoot = resolve(values.get("root") ?? DEFAULT_ROOT);
  const defaultScope = basename(roleRoot) === "full" ? "full" : "pilot";
  const proposerBatchManifestPath = resolve(
    values.get("proposer-batch-manifest") ??
      join(roleRoot, "..", "agent-batches", defaultScope, "manifest.json")
  );
  const proposerBatchManifest = JSON.parse(
    readFileSync(proposerBatchManifestPath, "utf8")
  ) as FrenchCodexAnyBatchManifest;
  const selectedPacketsPath = assertFrenchCodexAnyBatchManifest(
    proposerBatchManifest
  ).selectedPackets.path;
  return {
    role,
    namespace: values.get("namespace") ?? `/fr-internal/${defaultScope}`,
    viewsPath: resolve(
      values.get("views") ?? join(roleRoot, `${role}-input.jsonl`)
    ),
    viewSummaryPath: resolve(
      values.get("view-summary") ?? join(roleRoot, `${role}-input.summary.json`)
    ),
    packetsPath: resolve(values.get("packets") ?? selectedPacketsPath),
    proposerAPath: resolve(
      values.get("proposer-a") ?? join(roleRoot, "proposer-a.jsonl")
    ),
    proposerBPath: resolve(
      values.get("proposer-b") ?? join(roleRoot, "proposer-b.jsonl")
    ),
    configurationPath: resolve(
      values.get("configuration") ??
        "outputs/lexicon-v3/fr-internal/configuration.json"
    ),
    proposerRunsPath: resolve(
      values.get("proposer-runs") ?? join(roleRoot, "proposer-runs.jsonl")
    ),
    proposerSummaryPath: resolve(
      values.get("proposer-summary") ?? join(roleRoot, "proposer-summary.json")
    ),
    proposerBatchManifestPath,
    proposerAttestationLinksPath: resolve(
      values.get("proposer-attestation-links") ??
        join(roleRoot, "proposer-attestation-links.jsonl")
    ),
    arbiterViewsPath:
      role === "auditor"
        ? resolve(
            values.get("arbiter-views") ?? join(roleRoot, "arbiter-input.jsonl")
          )
        : undefined,
    arbiterPath:
      role === "auditor"
        ? resolve(values.get("arbiters") ?? join(roleRoot, "arbiter.jsonl"))
        : undefined,
    arbiterSummaryPath:
      role === "auditor"
        ? resolve(
            values.get("arbiter-summary") ??
              join(roleRoot, "arbiter.summary.json")
          )
        : undefined,
    outputDir: resolve(
      values.get("output-dir") ?? join(roleRoot, "agent-batches", role)
    ),
    maxItems,
    maxInputBytes
  };
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? "")).href) {
  try {
    const manifest = buildLexiconV3FrenchCodexAdjudicationBatches(
      parseFrenchCodexAdjudicationBatchArgs(process.argv.slice(2))
    );
    process.stdout.write(
      `${JSON.stringify(
        {
          event: "french-codex-adjudication-batches-built",
          role: manifest.role,
          counts: manifest.counts,
          manifestHash: manifest.manifestHash
        },
        null,
        2
      )}\n`
    );
  } catch (error) {
    process.stderr.write(
      `${basename(process.argv[1] ?? "buildLexiconV3FrenchCodexAdjudicationBatches")}: ${
        error instanceof Error ? error.message : String(error)
      }\n`
    );
    process.exitCode = 1;
  }
}
