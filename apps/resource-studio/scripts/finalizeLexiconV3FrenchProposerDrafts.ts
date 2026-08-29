import { createHash } from "node:crypto";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";

import {
  finalizeFrenchInternalProposerArtifact,
  FRENCH_INTERNAL_PROPOSER_ARTIFACT_SCHEMA_VERSION,
  readFrenchInternalAssemblyConfiguration,
  type FrenchInternalProposerArtifact
} from "./assembleLexiconV3FrenchInternalReview.js";
import {
  assertFrenchInternalProposerDraft,
  renderFrenchInternalProposerDraft
} from "../src/lexiconV3/frenchAgentDrafts.js";
import {
  buildFrenchHtmlTemplate,
  verifyFrenchHtmlTemplate
} from "../src/lexiconV3/frenchHtmlRenderer.js";
import {
  assertProposerABlindView,
  FRENCH_INTERNAL_PROPOSER_VIEW_SCHEMA_VERSION,
  FRENCH_INTERNAL_WORK_POLICY_VERSION,
  frenchInternalViewHash,
  type FrenchInternalProposerAView,
  type FrenchInternalProposerBView
} from "../src/lexiconV3/frenchInternalWork.js";
import { hashFrenchInternalJson } from "../src/lexiconV3/frenchInternalReview.js";
import {
  validateFrenchPacket,
  type LexiconV3FrenchPacket
} from "../src/lexiconV3/frenchPackets.js";

export const FRENCH_INTERNAL_PROPOSER_BATCH_SUMMARY_SCHEMA_VERSION =
  "lexicon-v3-french-internal-proposer-batch-summary@1" as const;

const DEFAULT_PACKETS = "outputs/lexicon-v3/fr-internal/french-packets.jsonl";
const DEFAULT_CONFIGURATION =
  "outputs/lexicon-v3/fr-internal/configuration.json";
const DEFAULT_WORK_DIR = "outputs/lexicon-v3/fr-internal/work";
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;

type ProposerRole = "proposerA" | "proposerB";
type ProposerView = FrenchInternalProposerAView | FrenchInternalProposerBView;

export interface FinalizeFrenchProposerDraftsOptions {
  role: ProposerRole;
  viewsPath: string;
  draftsPath: string;
  packetsPath: string;
  configurationPath: string;
  outputPath: string;
  summaryPath: string;
  agentId: string;
  taskName: string;
  completedAt: string;
}

export interface FrenchInternalProposerBatchSummary {
  schemaVersion: typeof FRENCH_INTERNAL_PROPOSER_BATCH_SUMMARY_SCHEMA_VERSION;
  role: ProposerRole;
  agentId: string;
  taskName: string;
  completedAt: string;
  generationConfigHash: string;
  sourcePaths: {
    views: string;
    drafts: string;
    packets: string;
    configuration: string;
    output: string;
  };
  sourceDigests: {
    views: string;
    drafts: string;
    packets: string;
    configuration: string;
  };
  counts: {
    drafts: number;
    artifacts: number;
    validatorClean: number;
    validatorReview: number;
    validationIssueCodes: Record<string, number>;
  };
  recordsLogicalDigest: string;
  outputDigest: string;
  summaryDigest: string;
}

async function main(): Promise<void> {
  const args = parseFinalizeLexiconV3FrenchProposerDraftsArgs(
    process.argv.slice(2)
  );
  const role = parseRole(required(args, "role"));
  const outputPath = resolve(required(args, "output"));
  const result = await finalizeLexiconV3FrenchProposerDrafts({
    role,
    viewsPath: resolve(
      args.views ??
        `${DEFAULT_WORK_DIR}/${role === "proposerA" ? "proposer-a" : "proposer-b"}-input.jsonl`
    ),
    draftsPath: resolve(required(args, "drafts")),
    packetsPath: resolve(args.packets ?? DEFAULT_PACKETS),
    configurationPath: resolve(args.configuration ?? DEFAULT_CONFIGURATION),
    outputPath,
    summaryPath: resolve(args.summary ?? `${outputPath}.summary.json`),
    agentId: required(args, "agent-id"),
    taskName: required(args, "task-name"),
    completedAt: args["completed-at"] ?? new Date().toISOString()
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

export async function finalizeLexiconV3FrenchProposerDrafts(
  options: FinalizeFrenchProposerDraftsOptions
): Promise<FrenchInternalProposerBatchSummary> {
  assertOptions(options);
  const configuration = readFrenchInternalAssemblyConfiguration(
    options.configurationPath
  );
  const rawDrafts = await readAllJsonl<unknown>(options.draftsPath, "draft");
  if (rawDrafts.length === 0) throw new Error("empty-french-proposer-drafts");
  const draftKeys = new Set<string>();
  for (const [index, value] of rawDrafts.entries()) {
    const entryKey = readEntryKey(value, `draft:${index + 1}`);
    if (draftKeys.has(entryKey)) {
      throw new Error(`duplicate-french-proposer-draft:${entryKey}`);
    }
    draftKeys.add(entryKey);
  }
  const views = await readSelectedViews(
    options.viewsPath,
    draftKeys,
    options.role
  );
  const packets = await readSelectedPackets(options.packetsPath, draftKeys);
  assertExactCoverage(draftKeys, views, "view");
  assertExactCoverage(draftKeys, packets, "packet");

  const issueCounts = new Map<string, number>();
  const artifacts: FrenchInternalProposerArtifact[] = [];
  let validatorClean = 0;
  for (const value of rawDrafts) {
    const entryKey = readEntryKey(value, "draft");
    const view = views.get(entryKey)!;
    const packet = packets.get(entryKey)!;
    assertViewPacketLineage(view, packet);
    const draft = assertFrenchInternalProposerDraft(
      value,
      options.role,
      packet,
      view.viewHash,
      view.entityConstraints.requiredMentions
    );
    const rendered = renderFrenchInternalProposerDraft(
      draft,
      packet,
      options.agentId,
      view.entityConstraints.requiredMentions
    );
    if (rendered.validation.issues.length === 0) {
      validatorClean += 1;
    } else {
      for (const issue of rendered.validation.issues) {
        issueCounts.set(issue.code, (issueCounts.get(issue.code) ?? 0) + 1);
      }
    }
    artifacts.push(
      finalizeFrenchInternalProposerArtifact({
        schemaVersion: FRENCH_INTERNAL_PROPOSER_ARTIFACT_SCHEMA_VERSION,
        role: options.role,
        entryKey,
        packetHash: packet.packetHash,
        englishHash: packet.english.contentHash,
        generationConfigHash: configuration.generationConfigHash,
        inputHash: view.viewHash,
        agentId: options.agentId,
        taskName: options.taskName,
        completedAt: options.completedAt,
        glossFr: draft.glossFr.trim(),
        meaningSegmentsFr: draft.meaningSegmentsFr.map((segment) => ({
          id: segment.id,
          text: segment.text
        })),
        requiredEntityMentions: view.entityConstraints.requiredMentions.map(
          (mention) => ({ ...mention })
        ),
        entityMentionsFr: draft.entityMentionsFr.map((mention) => ({
          mentionId: mention.mentionId,
          segmentId: mention.segmentId,
          chosenFrenchForm: mention.chosenFrenchForm.trim()
        })),
        notesFr: draft.notesFr.trim(),
        carrierTermsFr: draft.carrierTermsFr.map((term) => term.trim()),
        confidence: draft.confidence
      })
    );
  }
  artifacts.sort((left, right) => left.entryKey.localeCompare(right.entryKey));
  const outputText = `${artifacts.map((value) => JSON.stringify(value)).join("\n")}\n`;
  const outputDigest = sha256(outputText);
  const summaryWithoutDigest = {
    schemaVersion: FRENCH_INTERNAL_PROPOSER_BATCH_SUMMARY_SCHEMA_VERSION,
    role: options.role,
    agentId: options.agentId,
    taskName: options.taskName,
    completedAt: options.completedAt,
    generationConfigHash: configuration.generationConfigHash,
    sourcePaths: {
      views: resolve(options.viewsPath),
      drafts: resolve(options.draftsPath),
      packets: resolve(options.packetsPath),
      configuration: resolve(options.configurationPath),
      output: resolve(options.outputPath)
    },
    sourceDigests: {
      views: await sha256File(options.viewsPath),
      drafts: await sha256File(options.draftsPath),
      packets: await sha256File(options.packetsPath),
      configuration: await sha256File(options.configurationPath)
    },
    counts: {
      drafts: rawDrafts.length,
      artifacts: artifacts.length,
      validatorClean,
      validatorReview: artifacts.length - validatorClean,
      validationIssueCodes: Object.fromEntries(
        [...issueCounts].sort(([left], [right]) => left.localeCompare(right))
      )
    },
    recordsLogicalDigest: hashFrenchInternalJson(
      artifacts.map((artifact) => ({
        entryKey: artifact.entryKey,
        inputHash: artifact.inputHash,
        artifactHash: artifact.artifactHash
      }))
    ),
    outputDigest
  };
  const summary: FrenchInternalProposerBatchSummary = {
    ...summaryWithoutDigest,
    summaryDigest: hashFrenchInternalJson(summaryWithoutDigest)
  };
  writePairAtomic(
    options.outputPath,
    outputText,
    options.summaryPath,
    `${JSON.stringify(summary, null, 2)}\n`
  );
  return summary;
}

async function readSelectedViews(
  path: string,
  selected: Set<string>,
  role: ProposerRole
): Promise<Map<string, ProposerView>> {
  const values = new Map<string, ProposerView>();
  const allKeys = new Set<string>();
  for await (const { lineNumber, value } of readJsonl(path)) {
    const entryKey = readEntryKey(value, `view:${lineNumber}`);
    if (allKeys.has(entryKey))
      throw new Error(`duplicate-french-view:${entryKey}`);
    allKeys.add(entryKey);
    if (!selected.has(entryKey)) continue;
    const view = value as unknown as ProposerView;
    assertProposerView(view, role, `view:${lineNumber}`);
    values.set(entryKey, view);
  }
  return values;
}

async function readSelectedPackets(
  path: string,
  selected: Set<string>
): Promise<Map<string, LexiconV3FrenchPacket>> {
  const values = new Map<string, LexiconV3FrenchPacket>();
  const allKeys = new Set<string>();
  const stepIds = new Set<number>();
  for await (const { lineNumber, value } of readJsonl(path)) {
    const packet = value as LexiconV3FrenchPacket;
    const issues = validateFrenchPacket(packet);
    if (issues.length > 0) {
      throw new Error(
        `invalid-french-packet:${lineNumber}:${issues.join(",")}`
      );
    }
    if (allKeys.has(packet.entryKey)) {
      throw new Error(`duplicate-french-packet:${packet.entryKey}`);
    }
    if (stepIds.has(packet.identity.stepEntryId)) {
      throw new Error(
        `duplicate-french-packet-step-id:${packet.identity.stepEntryId}`
      );
    }
    allKeys.add(packet.entryKey);
    stepIds.add(packet.identity.stepEntryId);
    if (selected.has(packet.entryKey)) values.set(packet.entryKey, packet);
  }
  return values;
}

function assertProposerView(
  view: ProposerView,
  role: ProposerRole,
  locator: string
): void {
  if (view.schemaVersion !== FRENCH_INTERNAL_PROPOSER_VIEW_SCHEMA_VERSION) {
    throw new Error(`invalid-french-proposer-view-schema:${locator}`);
  }
  if (view.policyVersion !== FRENCH_INTERNAL_WORK_POLICY_VERSION) {
    throw new Error(`invalid-french-proposer-view-policy:${locator}`);
  }
  const expectedKind =
    role === "proposerA" ? "proposer_a_blind" : "proposer_b_candidates";
  if (view.role !== role || view.viewKind !== expectedKind) {
    throw new Error(`french-proposer-view-role-mismatch:${locator}`);
  }
  if (
    !SHA256_PATTERN.test(view.viewHash) ||
    view.viewHash !== frenchInternalViewHash(view)
  ) {
    throw new Error(`french-proposer-view-hash-mismatch:${locator}`);
  }
  if (!SHA256_PATTERN.test(view.workViewHash)) {
    throw new Error(`invalid-french-proposer-work-view-hash:${locator}`);
  }
  if (role === "proposerA") {
    assertProposerABlindView(view as FrenchInternalProposerAView);
  }
  const templateIssues = verifyFrenchHtmlTemplate(
    view.translationTask.htmlTemplate,
    view.english.meaningHtml
  );
  if (templateIssues.length > 0) {
    throw new Error(
      `invalid-french-proposer-view-template:${locator}:${templateIssues.join(",")}`
    );
  }
}

function assertViewPacketLineage(
  view: ProposerView,
  packet: LexiconV3FrenchPacket
): void {
  if (
    view.entryKey !== packet.entryKey ||
    view.lineage.packetHash !== packet.packetHash ||
    view.lineage.englishHash !== packet.english.contentHash
  ) {
    throw new Error(
      `french-proposer-view-packet-lineage-mismatch:${packet.entryKey}`
    );
  }
  const packetTemplate = buildFrenchHtmlTemplate(packet.english.meaningHtml);
  if (
    view.translationTask.htmlTemplate.templateHash !==
    packetTemplate.templateHash
  ) {
    throw new Error(
      `french-proposer-view-template-lineage-mismatch:${packet.entryKey}`
    );
  }
}

async function readAllJsonl<T>(path: string, label: string): Promise<T[]> {
  const values: T[] = [];
  for await (const { lineNumber, value } of readJsonl(path)) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`invalid-${label}-json:${lineNumber}`);
    }
    values.push(value as T);
  }
  return values;
}

async function* readJsonl(
  path: string
): AsyncGenerator<{ lineNumber: number; value: unknown }> {
  if (!existsSync(path))
    throw new Error(`missing-french-proposer-input:${path}`);
  const reader = createInterface({
    input: createReadStream(path, { encoding: "utf8" }),
    crlfDelay: Infinity
  });
  let lineNumber = 0;
  for await (const line of reader) {
    lineNumber += 1;
    if (!line.trim()) continue;
    try {
      yield { lineNumber, value: JSON.parse(line) as unknown };
    } catch {
      throw new Error(`invalid-jsonl:${path}:${lineNumber}`);
    }
  }
}

function assertExactCoverage<T>(
  expected: Set<string>,
  actual: Map<string, T>,
  label: string
): void {
  for (const key of expected) {
    if (!actual.has(key))
      throw new Error(`missing-french-proposer-${label}:${key}`);
  }
  if (actual.size !== expected.size) {
    throw new Error(`french-proposer-${label}-coverage-mismatch`);
  }
}

function readEntryKey(value: unknown, locator: string): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`invalid-french-entry:${locator}`);
  }
  const entryKey = (value as Record<string, unknown>).entryKey;
  if (typeof entryKey !== "string" || !entryKey.trim()) {
    throw new Error(`missing-french-entry:${locator}`);
  }
  return entryKey;
}

function assertOptions(options: FinalizeFrenchProposerDraftsOptions): void {
  if (!options.agentId.trim())
    throw new Error("missing-french-proposer-agent-id");
  if (!options.taskName.trim())
    throw new Error("missing-french-proposer-task-name");
  if (!Number.isFinite(Date.parse(options.completedAt))) {
    throw new Error("invalid-french-proposer-completed-at");
  }
  const outputs = [resolve(options.outputPath), resolve(options.summaryPath)];
  if (outputs[0] === outputs[1])
    throw new Error("french-proposer-output-path-collision");
  const inputs = new Set(
    [
      options.viewsPath,
      options.draftsPath,
      options.packetsPath,
      options.configurationPath
    ].map((path) => resolve(path))
  );
  if (outputs.some((path) => inputs.has(path))) {
    throw new Error("french-proposer-output-overwrites-input");
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

export function parseFinalizeLexiconV3FrenchProposerDraftsArgs(
  values: readonly string[]
): Record<string, string> {
  const allowed = new Set([
    "role",
    "views",
    "drafts",
    "packets",
    "configuration",
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
    if (result[key] !== undefined) throw new Error(`duplicate-option:${key}`);
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

function parseRole(value: string): ProposerRole {
  if (value !== "proposerA" && value !== "proposerB") {
    throw new Error(`invalid-french-proposer-role:${value}`);
  }
  return value;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exitCode = 1;
  });
}
