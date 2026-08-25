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
  applyFrenchEntityMentionResolution,
  assertFrenchEntityMentionAudit,
  assertFrenchEntityMentionDecision,
  assertFrenchEntityMentionResolutionAttestation,
  assertFrenchEntityMentionResolutionPlan,
  type FrenchEntityMentionAudit,
  type FrenchEntityMentionDecision,
  type FrenchEntityMentionResolutionPlan
} from "../src/lexiconV3/frenchEntityMentionResolution.js";
import {
  assertFrenchEntityMentionsArtifact,
  type FrenchEntityMentionsArtifact
} from "../src/lexiconV3/frenchEntityMentions.js";
import {
  assertFrenchCodexExecutionReceipt,
  canonicalFrenchInternalJson,
  hashFrenchInternalJson,
  type FrenchCodexExecutionReceipt
} from "../src/lexiconV3/frenchCodexExecutionReceipt.js";
import { FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE } from "../src/lexiconV3/frenchInternalReview.js";
import {
  assertFrenchEntityMentionAgentBatchManifest,
  type FrenchEntityMentionAgentBatchManifest,
  type FrenchEntityMentionAgentBatchRecord
} from "./buildLexiconV3FrenchEntityMentionAgentBatches.js";

interface CliOptions {
  manifest: string;
  rawMentions: string;
  resultsDir: string;
  output: string;
  attestation: string;
}

type Role = "proposerA" | "proposerB" | "arbiter" | "auditor";

interface GenericRun {
  schemaVersion: string;
  policyVersion: string;
  role: Role;
  batchId: string;
  manifestHash: string;
  planHash: string;
  batchHash: string;
  threadId: string;
  model: string;
  reasoningEffort: string;
  resultHashes: Record<string, string>;
  decisionHashes?: Record<string, string>;
  artifactHashes?: Record<string, string>;
  parentArtifactHashes?: string[];
  parentThreadIds?: string[];
  runHash: string;
}

export function finalizeLexiconV3FrenchEntityMentionResolution(
  options: CliOptions
): void {
  const manifestText = readFileSync(resolve(options.manifest), "utf8");
  const manifest = JSON.parse(
    manifestText
  ) as FrenchEntityMentionAgentBatchManifest;
  assertFrenchEntityMentionAgentBatchManifest(manifest);
  const plan = JSON.parse(
    readFileSync(manifest.planPath, "utf8")
  ) as FrenchEntityMentionResolutionPlan;
  assertFrenchEntityMentionResolutionPlan(plan);
  const raw = JSON.parse(
    readFileSync(resolve(options.rawMentions), "utf8")
  ) as FrenchEntityMentionsArtifact;
  assertFrenchEntityMentionsArtifact(raw);
  if (raw.contentHash !== plan.sourceHashes.mentions) {
    throw new Error("french-mention-finalize-raw-plan-lineage");
  }
  const collected = {
    proposerA: [] as FrenchEntityMentionDecision[],
    proposerB: [] as FrenchEntityMentionDecision[],
    arbiter: [] as FrenchEntityMentionDecision[],
    auditor: [] as FrenchEntityMentionAudit[]
  };
  const allThreads = new Set<string>();
  const allRunHashes = new Set<string>();
  for (const batch of manifest.batches) {
    const batchRuns = new Map<Role, GenericRun>();
    const batchArtifacts = new Map<
      Role,
      Array<FrenchEntityMentionDecision | FrenchEntityMentionAudit>
    >();
    for (const role of [
      "proposerA",
      "proposerB",
      "arbiter",
      "auditor"
    ] as const) {
      const loaded = loadRole({
        role,
        batch,
        manifest,
        manifestPath: resolve(options.manifest),
        plan,
        resultsDir: resolve(options.resultsDir)
      });
      if (allThreads.has(loaded.run.threadId)) {
        throw new Error(
          `french-mention-finalize-thread-reuse:${loaded.run.threadId}`
        );
      }
      if (allRunHashes.has(loaded.run.runHash)) {
        throw new Error(
          `french-mention-finalize-run-reuse:${loaded.run.runHash}`
        );
      }
      allThreads.add(loaded.run.threadId);
      allRunHashes.add(loaded.run.runHash);
      batchRuns.set(role, loaded.run);
      batchArtifacts.set(role, loaded.artifacts);
      if (role === "auditor")
        collected.auditor.push(
          ...(loaded.artifacts as FrenchEntityMentionAudit[])
        );
      else
        collected[role].push(
          ...(loaded.artifacts as FrenchEntityMentionDecision[])
        );
    }
    assertParentLineage(batch, batchRuns, batchArtifacts);
  }
  if (
    allThreads.size !== manifest.counts.batches * 4 ||
    allRunHashes.size !== manifest.counts.batches * 4
  ) {
    throw new Error("french-mention-finalize-execution-coverage");
  }
  const result = applyFrenchEntityMentionResolution({
    source: raw,
    plan,
    proposerADecisions: collected.proposerA,
    proposerBDecisions: collected.proposerB,
    arbiterDecisions: collected.arbiter,
    audits: collected.auditor,
    executionRunHashes: [...allRunHashes]
  });
  assertFrenchEntityMentionResolutionAttestation(result.attestation);
  writeAtomicPair(
    resolve(options.output),
    `${canonicalFrenchInternalJson(result.mentions)}\n`,
    resolve(options.attestation),
    `${canonicalFrenchInternalJson(result.attestation)}\n`
  );
  process.stdout.write(
    `${JSON.stringify(
      {
        mentions: result.mentions.requiredEntityMentions.length,
        blocking: result.mentions.blockingMentionIds.length,
        counts: result.attestation.counts,
        runs: allRunHashes.size,
        threads: allThreads.size,
        finalMentionsHash: result.mentions.contentHash,
        attestationHash: result.attestation.attestationHash
      },
      null,
      2
    )}\n`
  );
}

function loadRole(input: {
  role: Role;
  batch: FrenchEntityMentionAgentBatchRecord;
  manifest: FrenchEntityMentionAgentBatchManifest;
  manifestPath: string;
  plan: FrenchEntityMentionResolutionPlan;
  resultsDir: string;
}): {
  run: GenericRun;
  artifacts: Array<FrenchEntityMentionDecision | FrenchEntityMentionAudit>;
} {
  const directory = join(input.resultsDir, input.role, input.batch.batchId);
  const runPath = join(directory, "run.json");
  const artifactPath = join(
    directory,
    input.role === "auditor" ? "audits.jsonl" : "decisions.jsonl"
  );
  const receiptsPath = join(directory, "execution-receipts.jsonl");
  if (![runPath, artifactPath, receiptsPath].every(existsSync)) {
    throw new Error(
      `french-mention-finalize-run-missing:${input.role}:${input.batch.batchId}`
    );
  }
  const runText = readFileSync(runPath, "utf8");
  const run = JSON.parse(runText) as GenericRun;
  const { runHash, ...runContent } = run;
  const profile = FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE[input.role];
  if (
    run.role !== input.role ||
    run.batchId !== input.batch.batchId ||
    run.manifestHash !== input.manifest.manifestHash ||
    run.planHash !== input.plan.planHash ||
    run.batchHash !== input.batch.batchHash ||
    run.model !== profile.model ||
    run.reasoningEffort !== profile.reasoningEffort ||
    hashFrenchInternalJson(runContent) !== runHash
  )
    throw new Error(
      `french-mention-finalize-run-lineage:${input.role}:${input.batch.batchId}`
    );
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
  if (artifacts.length !== input.batch.unitIds.length)
    throw new Error(
      `french-mention-finalize-artifact-coverage:${input.role}:${input.batch.batchId}`
    );
  const byId = new Map<
    string,
    FrenchEntityMentionDecision | FrenchEntityMentionAudit
  >();
  for (const artifact of artifacts) {
    if (input.role === "auditor")
      assertFrenchEntityMentionAudit(artifact as FrenchEntityMentionAudit);
    else {
      assertFrenchEntityMentionDecision(
        artifact as FrenchEntityMentionDecision
      );
      if ((artifact as FrenchEntityMentionDecision).role !== input.role)
        throw new Error(`french-mention-finalize-artifact-role:${input.role}`);
    }
    if (
      byId.has(artifact.unitId) ||
      !input.batch.unitIds.includes(artifact.unitId)
    )
      throw new Error(
        `french-mention-finalize-artifact-unit:${input.role}:${artifact.unitId}`
      );
    byId.set(artifact.unitId, artifact);
  }
  if (input.batch.unitIds.some((id) => !byId.has(id)))
    throw new Error(`french-mention-finalize-artifact-missing:${input.role}`);
  const hashes = run.decisionHashes ?? run.artifactHashes;
  if (
    !hashes ||
    canonicalFrenchInternalJson(hashes) !==
      canonicalFrenchInternalJson(
        Object.fromEntries(
          artifacts.map((item) => [item.unitId, item.artifactHash])
        )
      )
  )
    throw new Error(
      `french-mention-finalize-run-artifacts:${input.role}:${input.batch.batchId}`
    );
  const resultKey =
    input.role === "proposerA" || input.role === "proposerB"
      ? "decisions"
      : "artifacts";
  if (run.resultHashes[resultKey] !== sha256(artifactText))
    throw new Error(
      `french-mention-finalize-result-hash:${input.role}:${input.batch.batchId}`
    );
  const resultFiles: Record<string, string> = {
    response: join(directory, "structured-response.json"),
    events: join(directory, "agent-events.jsonl"),
    stderr: join(directory, "agent-stderr.log"),
    [resultKey]: artifactPath
  };
  if (
    canonicalFrenchInternalJson(Object.keys(run.resultHashes).sort()) !==
    canonicalFrenchInternalJson(Object.keys(resultFiles).sort())
  ) {
    throw new Error(
      `french-mention-finalize-result-keys:${input.role}:${input.batch.batchId}`
    );
  }
  for (const [key, path] of Object.entries(resultFiles)) {
    if (
      !existsSync(path) ||
      sha256(readFileSync(path)) !== run.resultHashes[key]
    ) {
      throw new Error(
        `french-mention-finalize-result-file:${input.role}:${input.batch.batchId}:${key}`
      );
    }
  }
  const receiptSourcePaths = {
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
  const receiptSourceHashes = Object.fromEntries(
    Object.entries(receiptSourcePaths).map(([key, path]) => [
      key,
      sha256(readFileSync(path))
    ])
  );
  const receiptResultPaths = {
    agentEvents: resultFiles.events!,
    agentStderr: resultFiles.stderr!,
    structuredResponse: resultFiles.response!,
    artifacts: artifactPath
  };
  const receiptResultHashes = {
    agentEvents: run.resultHashes.events!,
    agentStderr: run.resultHashes.stderr!,
    structuredResponse: run.resultHashes.response!,
    artifacts: run.resultHashes[resultKey]!
  };
  const receipts = readFileSync(receiptsPath, "utf8")
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as FrenchCodexExecutionReceipt<Role>);
  if (receipts.length !== artifacts.length)
    throw new Error(`french-mention-finalize-receipt-coverage:${input.role}`);
  const artifactById = new Map(
    artifacts.map((artifact) => [artifact.unitId, artifact])
  );
  for (const receipt of receipts) {
    assertFrenchCodexExecutionReceipt(receipt, { expectedRole: input.role });
    const artifact = artifactById.get(receipt.entryKey);
    if (
      !artifact ||
      receipt.batchId !== input.batch.batchId ||
      receipt.manifestHash !== input.manifest.manifestHash ||
      receipt.selectionHash !== input.plan.planHash ||
      receipt.threadId !== run.threadId ||
      receipt.runHash !== run.runHash ||
      receipt.artifactHash !== artifact.artifactHash ||
      receipt.inputHash !== artifact.inputHash ||
      canonicalFrenchInternalJson(receipt.sourcePaths) !==
        canonicalFrenchInternalJson(receiptSourcePaths) ||
      canonicalFrenchInternalJson(receipt.sourceHashes) !==
        canonicalFrenchInternalJson(receiptSourceHashes) ||
      canonicalFrenchInternalJson(receipt.resultPaths) !==
        canonicalFrenchInternalJson(receiptResultPaths) ||
      canonicalFrenchInternalJson(receipt.resultHashes) !==
        canonicalFrenchInternalJson(receiptResultHashes)
    )
      throw new Error(
        `french-mention-finalize-receipt-lineage:${input.role}:${receipt.entryKey}`
      );
  }
  return { run, artifacts: input.batch.unitIds.map((id) => byId.get(id)!) };
}

function assertParentLineage(
  batch: FrenchEntityMentionAgentBatchRecord,
  runs: Map<Role, GenericRun>,
  artifacts: Map<
    Role,
    Array<FrenchEntityMentionDecision | FrenchEntityMentionAudit>
  >
): void {
  const a = runs.get("proposerA")!;
  const b = runs.get("proposerB")!;
  const arbiter = runs.get("arbiter")!;
  const auditor = runs.get("auditor")!;
  const hashes = (roles: Role[]) =>
    roles
      .flatMap((role) => artifacts.get(role)!.map((item) => item.artifactHash))
      .sort(compareText);
  if (
    canonicalFrenchInternalJson(arbiter.parentThreadIds?.sort(compareText)) !==
      canonicalFrenchInternalJson([a.threadId, b.threadId].sort(compareText)) ||
    canonicalFrenchInternalJson(
      arbiter.parentArtifactHashes?.sort(compareText)
    ) !== canonicalFrenchInternalJson(hashes(["proposerA", "proposerB"])) ||
    canonicalFrenchInternalJson(auditor.parentThreadIds?.sort(compareText)) !==
      canonicalFrenchInternalJson(
        [a.threadId, b.threadId, arbiter.threadId].sort(compareText)
      ) ||
    canonicalFrenchInternalJson(
      auditor.parentArtifactHashes?.sort(compareText)
    ) !==
      canonicalFrenchInternalJson(hashes(["proposerA", "proposerB", "arbiter"]))
  )
    throw new Error(`french-mention-finalize-parent-lineage:${batch.batchId}`);
  const arbiterById = new Map(
    (artifacts.get("arbiter") as FrenchEntityMentionDecision[]).map((item) => [
      item.unitId,
      item
    ])
  );
  for (const audit of artifacts.get("auditor") as FrenchEntityMentionAudit[]) {
    if (
      audit.arbiterArtifactHash !== arbiterById.get(audit.unitId)?.artifactHash
    )
      throw new Error(`french-mention-finalize-audit-parent:${audit.unitId}`);
  }
}

function writeAtomicPair(
  first: string,
  firstBody: string,
  second: string,
  secondBody: string
): void {
  if (first === second)
    throw new Error("french-mention-finalize-output-collision");
  const files = [
    [first, firstBody],
    [second, secondBody]
  ] as const;
  for (const [path, body] of files) {
    if (existsSync(path) && readFileSync(path, "utf8") !== body) {
      throw new Error(`french-mention-finalize-existing-output:${path}`);
    }
  }
  for (const [path, body] of files) {
    if (existsSync(path)) continue;
    mkdirSync(dirname(path), { recursive: true });
    const temporary = `${path}.tmp-${process.pid}`;
    writeFileSync(temporary, body, { encoding: "utf8", flag: "wx" });
    renameSync(temporary, path);
  }
}

function parseArgs(args: readonly string[]): CliOptions {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index] ?? "";
    const [key, inline] = token.startsWith("--")
      ? token.slice(2).split("=", 2)
      : ["", ""];
    if (!key || values.has(key))
      throw new Error(`french-mention-finalize-option:${token}`);
    const value = inline ?? args[index + 1];
    if (!value || (!inline && value.startsWith("--")))
      throw new Error(`french-mention-finalize-value:${key}`);
    values.set(key, value);
    if (inline === undefined) index += 1;
  }
  const required = (key: string) => {
    const value = values.get(key);
    if (!value) throw new Error(`french-mention-finalize-required:${key}`);
    return resolve(value);
  };
  return {
    manifest: required("manifest"),
    rawMentions: required("raw-mentions"),
    resultsDir: required("results-dir"),
    output: required("output"),
    attestation: required("attestation")
  };
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}
function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (import.meta.url === invokedPath) {
  try {
    finalizeLexiconV3FrenchEntityMentionResolution(
      parseArgs(process.argv.slice(2))
    );
  } catch (error) {
    process.stderr.write(
      `${basename(process.argv[1] ?? "finalizeLexiconV3FrenchEntityMentionResolution")}: ${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exitCode = 1;
  }
}
