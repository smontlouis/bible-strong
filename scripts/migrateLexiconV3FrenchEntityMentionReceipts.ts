import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  assertFrenchEntityMentionAudit,
  assertFrenchEntityMentionDecision,
  assertFrenchEntityMentionResolutionPlan,
  type FrenchEntityMentionAudit,
  type FrenchEntityMentionDecision,
  type FrenchEntityMentionResolutionPlan
} from "../src/lexiconV3/frenchEntityMentionResolution.js";
import {
  assertFrenchCodexExecutionReceipt,
  canonicalFrenchInternalJson,
  finalizeFrenchCodexExecutionReceipt,
  frenchCodexExecutionReceiptHash,
  FRENCH_INTERNAL_EXECUTION_RECEIPT_SCHEMA_VERSION,
  hashFrenchInternalJson,
  type FrenchCodexExecutionReceipt
} from "../src/lexiconV3/frenchCodexExecutionReceipt.js";
import {
  assertFrenchEntityMentionAgentBatchManifest,
  type FrenchEntityMentionAgentBatchManifest,
  type FrenchEntityMentionAgentBatchRecord
} from "./buildLexiconV3FrenchEntityMentionAgentBatches.js";

const MIGRATION_SCHEMA_VERSION =
  "lexicon-v3-french-entity-mention-receipt-migration@1" as const;

type Role = "proposerA" | "proposerB" | "arbiter" | "auditor";

interface CliOptions {
  manifest: string;
  resultsDir: string;
  backupDir: string;
  attestation: string;
}

interface GenericRun {
  role: Role;
  batchId: string;
  manifestHash: string;
  planHash: string;
  batchHash: string;
  threadId: string;
  runHash: string;
  resultHashes: Record<string, string>;
}

interface MigrationFile {
  role: Role;
  batchId: string;
  receiptCount: number;
  receiptPath: string;
  backupPath: string;
  originalSha256: string;
  canonicalSha256: string;
}

export function migrateLexiconV3FrenchEntityMentionReceipts(
  options: CliOptions
): void {
  const manifestPath = resolve(options.manifest);
  const manifestText = readFileSync(manifestPath, "utf8");
  const manifest = JSON.parse(
    manifestText
  ) as FrenchEntityMentionAgentBatchManifest;
  assertFrenchEntityMentionAgentBatchManifest(manifest);
  const planText = readFileSync(manifest.planPath, "utf8");
  const plan = JSON.parse(planText) as FrenchEntityMentionResolutionPlan;
  assertFrenchEntityMentionResolutionPlan(plan);
  const files: MigrationFile[] = [];
  let receipts = 0;

  for (const role of [
    "proposerA",
    "proposerB",
    "arbiter",
    "auditor"
  ] as const) {
    for (const batch of manifest.batches) {
      const migrated = migrateReceiptFile({
        role,
        batch,
        manifest,
        manifestPath,
        manifestText,
        plan,
        planText,
        resultsDir: resolve(options.resultsDir),
        backupDir: resolve(options.backupDir)
      });
      files.push(migrated);
      receipts += migrated.receiptCount;
    }
  }

  const content = {
    schemaVersion: MIGRATION_SCHEMA_VERSION,
    manifestHash: manifest.manifestHash,
    planHash: plan.planHash,
    sourceHashes: {
      manifest: sha256(manifestText),
      plan: sha256(planText)
    },
    counts: {
      roles: 4,
      batches: manifest.batches.length,
      files: files.length,
      receipts
    },
    files
  };
  const attestation = {
    ...content,
    contentHash: hashFrenchInternalJson(content)
  };
  installExact(
    resolve(options.attestation),
    `${canonicalFrenchInternalJson(attestation)}\n`
  );
  process.stdout.write(
    `${JSON.stringify(
      {
        files: files.length,
        receipts,
        backups: resolve(options.backupDir),
        attestation: resolve(options.attestation),
        contentHash: attestation.contentHash
      },
      null,
      2
    )}\n`
  );
}

function migrateReceiptFile(input: {
  role: Role;
  batch: FrenchEntityMentionAgentBatchRecord;
  manifest: FrenchEntityMentionAgentBatchManifest;
  manifestPath: string;
  manifestText: string;
  plan: FrenchEntityMentionResolutionPlan;
  planText: string;
  resultsDir: string;
  backupDir: string;
}): MigrationFile {
  const directory = join(input.resultsDir, input.role, input.batch.batchId);
  const runPath = join(directory, "run.json");
  const receiptPath = join(directory, "execution-receipts.jsonl");
  const artifactPath = join(
    directory,
    input.role === "auditor" ? "audits.jsonl" : "decisions.jsonl"
  );
  const backupPath = join(
    input.backupDir,
    input.role,
    input.batch.batchId,
    "execution-receipts.jsonl"
  );
  for (const path of [runPath, receiptPath, artifactPath]) {
    if (!existsSync(path)) {
      throw new Error(`french-mention-receipt-migration-missing:${path}`);
    }
  }
  const runText = readFileSync(runPath, "utf8");
  const run = JSON.parse(runText) as GenericRun;
  const { runHash, ...runContent } = run;
  if (
    run.role !== input.role ||
    run.batchId !== input.batch.batchId ||
    run.manifestHash !== input.manifest.manifestHash ||
    run.planHash !== input.plan.planHash ||
    run.batchHash !== input.batch.batchHash ||
    runHash !== hashFrenchInternalJson(runContent)
  ) {
    throw new Error(
      `french-mention-receipt-migration-run:${input.role}:${input.batch.batchId}`
    );
  }
  const artifactText = readFileSync(artifactPath, "utf8");
  const artifacts = artifactText
    .split(/\r?\n/u)
    .filter(Boolean)
    .map(
      (line) =>
        JSON.parse(line) as
          | FrenchEntityMentionDecision
          | FrenchEntityMentionAudit
    );
  if (artifacts.length !== input.batch.unitIds.length) {
    throw new Error(
      `french-mention-receipt-migration-artifacts:${input.role}:${input.batch.batchId}`
    );
  }
  for (const artifact of artifacts) {
    if (input.role === "auditor") {
      assertFrenchEntityMentionAudit(artifact as FrenchEntityMentionAudit);
    } else {
      assertFrenchEntityMentionDecision(
        artifact as FrenchEntityMentionDecision
      );
    }
  }
  const originalText = existsSync(backupPath)
    ? readFileSync(backupPath, "utf8")
    : readFileSync(receiptPath, "utf8");
  const originalReceipts = parseReceipts(originalText);
  if (originalReceipts.length !== artifacts.length) {
    throw new Error(
      `french-mention-receipt-migration-coverage:${input.role}:${input.batch.batchId}`
    );
  }
  const artifactById = new Map(
    artifacts.map((artifact) => [artifact.unitId, artifact])
  );
  const seen = new Set<string>();
  for (const receipt of originalReceipts) {
    const artifact = artifactById.get(receipt.entryKey);
    if (
      seen.has(receipt.entryKey) ||
      !artifact ||
      receipt.role !== input.role ||
      receipt.batchId !== input.batch.batchId ||
      receipt.manifestHash !== input.manifest.manifestHash ||
      receipt.selectionHash !== input.plan.planHash ||
      receipt.threadId !== run.threadId ||
      receipt.runHash !== run.runHash ||
      receipt.inputHash !== artifact.inputHash ||
      receipt.artifactHash !== artifact.artifactHash ||
      receipt.receiptHash !== frenchCodexExecutionReceiptHash(receipt)
    ) {
      throw new Error(
        `french-mention-receipt-migration-lineage:${input.role}:${input.batch.batchId}:${receipt.entryKey}`
      );
    }
    seen.add(receipt.entryKey);
  }
  const sourcePaths = canonicalSourcePaths(input, directory, runPath);
  const sourceHashes = Object.fromEntries(
    Object.entries(sourcePaths).map(([key, path]) => [
      key,
      sha256(readFileSync(path))
    ])
  );
  const resultPaths = {
    agentEvents: join(directory, "agent-events.jsonl"),
    agentStderr: join(directory, "agent-stderr.log"),
    structuredResponse: join(directory, "structured-response.json"),
    artifacts: artifactPath
  };
  const resultHashes = Object.fromEntries(
    Object.entries(resultPaths).map(([key, path]) => [
      key,
      sha256(readFileSync(path))
    ])
  );
  assertRunResultHashes(run, resultHashes, input.role);
  const canonicalReceipts = originalReceipts.map((receipt) => {
    const { receiptHash: _oldHash, ...oldContent } = receipt;
    void _oldHash;
    const canonical = finalizeFrenchCodexExecutionReceipt({
      ...oldContent,
      schemaVersion: FRENCH_INTERNAL_EXECUTION_RECEIPT_SCHEMA_VERSION,
      sourcePaths,
      sourceHashes,
      resultPaths,
      resultHashes
    });
    assertFrenchCodexExecutionReceipt(canonical, {
      expectedRole: input.role
    });
    return canonical;
  });
  const canonicalText = `${canonicalReceipts
    .map(canonicalFrenchInternalJson)
    .join("\n")}\n`;
  const currentText = readFileSync(receiptPath, "utf8");
  if (currentText !== originalText && currentText !== canonicalText) {
    throw new Error(
      `french-mention-receipt-migration-current-drift:${input.role}:${input.batch.batchId}`
    );
  }
  if (!existsSync(backupPath)) installExact(backupPath, originalText);
  replaceExact(receiptPath, canonicalText);
  return {
    role: input.role,
    batchId: input.batch.batchId,
    receiptCount: canonicalReceipts.length,
    receiptPath,
    backupPath,
    originalSha256: sha256(originalText),
    canonicalSha256: sha256(canonicalText)
  };
}

function canonicalSourcePaths(
  input: {
    role: Role;
    batch: FrenchEntityMentionAgentBatchRecord;
    manifestPath: string;
    manifest: FrenchEntityMentionAgentBatchManifest;
  },
  directory: string,
  runPath: string
): Record<string, string> {
  return {
    manifest: input.manifestPath,
    plan: input.manifest.planPath,
    sealedInput:
      input.role === "proposerA" || input.role === "proposerB"
        ? input.batch.inputPath
        : join(directory, "input.json"),
    outputSchema:
      input.role === "proposerA" || input.role === "proposerB"
        ? input.batch.schemaPath
        : join(directory, "output.schema.json"),
    runPointer: runPath
  };
}

function assertRunResultHashes(
  run: GenericRun,
  canonical: Record<string, string>,
  role: Role
): void {
  const artifactKey =
    role === "proposerA" || role === "proposerB" ? "decisions" : "artifacts";
  if (
    run.resultHashes.events !== canonical.agentEvents ||
    run.resultHashes.stderr !== canonical.agentStderr ||
    run.resultHashes.response !== canonical.structuredResponse ||
    run.resultHashes[artifactKey] !== canonical.artifacts
  ) {
    throw new Error(
      `french-mention-receipt-migration-result-hashes:${role}:${run.batchId}`
    );
  }
}

function parseReceipts(text: string): Array<FrenchCodexExecutionReceipt<Role>> {
  return text
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as FrenchCodexExecutionReceipt<Role>);
}

function installExact(path: string, body: string): void {
  if (existsSync(path)) {
    if (readFileSync(path, "utf8") !== body) {
      throw new Error(`french-mention-receipt-migration-existing:${path}`);
    }
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}`;
  writeFileSync(temporary, body, { encoding: "utf8", flag: "wx" });
  renameSync(temporary, path);
}

function replaceExact(path: string, body: string): void {
  if (readFileSync(path, "utf8") === body) return;
  const temporary = `${path}.tmp-${process.pid}`;
  writeFileSync(temporary, body, { encoding: "utf8", flag: "wx" });
  renameSync(temporary, path);
}

function parseArgs(args: readonly string[]): CliOptions {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index] ?? "";
    const [key, inline] = token.startsWith("--")
      ? token.slice(2).split("=", 2)
      : ["", ""];
    if (!key || values.has(key)) {
      throw new Error(`french-mention-receipt-migration-option:${token}`);
    }
    const value = inline ?? args[index + 1];
    if (!value || (!inline && value.startsWith("--"))) {
      throw new Error(`french-mention-receipt-migration-value:${key}`);
    }
    values.set(key, value);
    if (inline === undefined) index += 1;
  }
  const required = (key: string): string => {
    const value = values.get(key);
    if (!value) {
      throw new Error(`french-mention-receipt-migration-required:${key}`);
    }
    return resolve(value);
  };
  return {
    manifest: required("manifest"),
    resultsDir: required("results-dir"),
    backupDir: required("backup-dir"),
    attestation: required("attestation")
  };
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (import.meta.url === invokedPath) {
  try {
    migrateLexiconV3FrenchEntityMentionReceipts(
      parseArgs(process.argv.slice(2))
    );
  } catch (error) {
    process.stderr.write(
      `${basename(process.argv[1] ?? "migrateLexiconV3FrenchEntityMentionReceipts")}: ${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exitCode = 1;
  }
}
