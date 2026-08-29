import { spawn } from "node:child_process";
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
  assertFrenchEntityMentionDecision,
  finalizeFrenchEntityMentionDecision,
  FRENCH_ENTITY_MENTION_DECISION_SCHEMA_VERSION,
  FRENCH_ENTITY_MENTION_RESOLUTION_POLICY_VERSION,
  type FrenchEntityMentionDecision,
  type FrenchEntityMentionDisposition,
  type FrenchEntityMentionResolutionPlan
} from "../src/lexiconV3/frenchEntityMentionResolution.js";
import {
  canonicalFrenchInternalJson,
  finalizeFrenchCodexExecutionReceipt,
  FRENCH_INTERNAL_EXECUTION_RECEIPT_SCHEMA_VERSION,
  hashFrenchInternalJson
} from "../src/lexiconV3/frenchCodexExecutionReceipt.js";
import { prepareFrenchCodexImmutableExecution } from "../src/lexiconV3/frenchCodexImmutableBinary.js";
import { FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE } from "../src/lexiconV3/frenchInternalReview.js";
import {
  assertFrenchEntityMentionAgentBatchManifest,
  type FrenchEntityMentionAgentBatchManifest,
  type FrenchEntityMentionAgentBatchRecord
} from "./buildLexiconV3FrenchEntityMentionAgentBatches.js";
import {
  buildSealedFrenchCodexProposerEnvironment,
  FRENCH_CODEX_EXECUTOR_POLICY_VERSION,
  frenchCodexDisabledFeaturesHash,
  frenchCodexEnvironmentPolicyHash,
  frenchCodexProposerExecArgs,
  parseFrenchCodexAgentEvents
} from "./runLexiconV3FrenchCodexProposerBatch.js";

export const FRENCH_ENTITY_MENTION_AGENT_RUN_SCHEMA_VERSION =
  "lexicon-v3-french-entity-mention-agent-run@1" as const;

type Role = "proposerA" | "proposerB";

interface CliOptions {
  manifest: string;
  resultsDir: string;
  codexBinary: string;
  codexHome: string;
  stage: Role | "proposers";
  concurrency: number;
  timeoutMs: number;
  maxAttempts: number;
  limitBatches: number | null;
}

interface AgentRun {
  schemaVersion: typeof FRENCH_ENTITY_MENTION_AGENT_RUN_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_ENTITY_MENTION_RESOLUTION_POLICY_VERSION;
  role: Role;
  batchId: string;
  manifestHash: string;
  planHash: string;
  batchHash: string;
  inputHash: string;
  agentId: string;
  threadId: string;
  model: string;
  reasoningEffort: string;
  executor: { path: string; version: string; sha256: string };
  promptHash: string;
  sourceHashes: Record<string, string>;
  resultHashes: Record<string, string>;
  decisionHashes: Record<string, string>;
  startedAt: string;
  completedAt: string;
  runHash: string;
}

export async function runLexiconV3FrenchEntityMentionAgents(
  options: CliOptions
): Promise<void> {
  const manifestText = readFileSync(resolve(options.manifest), "utf8");
  const manifest = JSON.parse(
    manifestText
  ) as FrenchEntityMentionAgentBatchManifest;
  assertFrenchEntityMentionAgentBatchManifest(manifest);
  const plan = JSON.parse(
    readFileSync(manifest.planPath, "utf8")
  ) as FrenchEntityMentionResolutionPlan;
  const roles: Role[] =
    options.stage === "proposers"
      ? ["proposerA", "proposerB"]
      : [options.stage];
  const batches =
    options.limitBatches === null
      ? manifest.batches
      : manifest.batches.slice(0, options.limitBatches);
  const tasks = roles.flatMap((role) =>
    batches.map((batch) => ({ role, batch }))
  );
  let reused = 0;
  let executed = 0;
  await mapConcurrent(tasks, options.concurrency, async ({ role, batch }) => {
    const result = await runWithAttempts({
      options,
      manifest,
      manifestText,
      plan,
      role,
      batch
    });
    if (result.reused) reused += 1;
    else executed += 1;
    process.stdout.write(
      `${JSON.stringify({ role, batchId: batch.batchId, reused: result.reused })}\n`
    );
  });
  process.stdout.write(
    `${JSON.stringify(
      {
        stage: options.stage,
        batches: batches.length,
        runs: tasks.length,
        reused,
        executed
      },
      null,
      2
    )}\n`
  );
}

async function runWithAttempts(input: {
  options: CliOptions;
  manifest: FrenchEntityMentionAgentBatchManifest;
  manifestText: string;
  plan: FrenchEntityMentionResolutionPlan;
  role: Role;
  batch: FrenchEntityMentionAgentBatchRecord;
}): Promise<{ reused: boolean }> {
  const finalDir = join(
    resolve(input.options.resultsDir),
    input.role,
    input.batch.batchId
  );
  if (existsSync(finalDir)) {
    assertExistingRun(finalDir, input);
    return { reused: true };
  }
  let lastError: unknown;
  const validationFeedback: string[] = [];
  for (let attempt = 1; attempt <= input.options.maxAttempts; attempt += 1) {
    try {
      await runOnce(input, finalDir, attempt, validationFeedback);
      return { reused: false };
    } catch (error) {
      lastError = error;
      validationFeedback.push(
        error instanceof Error ? error.message : String(error)
      );
    }
  }
  throw lastError;
}

async function runOnce(
  input: {
    options: CliOptions;
    manifest: FrenchEntityMentionAgentBatchManifest;
    manifestText: string;
    plan: FrenchEntityMentionResolutionPlan;
    role: Role;
    batch: FrenchEntityMentionAgentBatchRecord;
  },
  finalDir: string,
  attempt: number,
  validationFeedback: readonly string[]
): Promise<void> {
  mkdirSync(dirname(finalDir), { recursive: true });
  const temporary = `${finalDir}.tmp-${process.pid}-${Date.now()}-${attempt}`;
  mkdirSync(temporary, { recursive: false });
  const paths = {
    response: join(temporary, "structured-response.json"),
    events: join(temporary, "agent-events.jsonl"),
    stderr: join(temporary, "agent-stderr.log"),
    decisions: join(temporary, "decisions.jsonl"),
    receipts: join(temporary, "execution-receipts.jsonl"),
    run: join(temporary, "run.json")
  };
  try {
    const inputText = readFileSync(input.batch.inputPath, "utf8");
    const schemaText = readFileSync(input.batch.schemaPath, "utf8");
    if (
      sha256(inputText) !== input.batch.inputSha256 ||
      sha256(schemaText) !== input.batch.schemaSha256
    ) {
      throw new Error(
        `french-mention-agent-batch-drift:${input.batch.batchId}`
      );
    }
    const prompt = buildPrompt(
      input.role,
      inputText,
      input.batch,
      validationFeedback
    );
    const profile = FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE[input.role];
    const execution = await executeCodex({
      options: input.options,
      profile,
      prompt,
      schemaPath: input.batch.schemaPath,
      responsePath: paths.response,
      cwd: temporary
    });
    writeFileSync(paths.events, execution.stdout, "utf8");
    writeFileSync(paths.stderr, execution.stderr, "utf8");
    const decisions = parseDecisions({
      responseText: execution.responseText,
      role: input.role,
      batch: input.batch,
      plan: input.plan
    });
    const decisionsText = `${decisions
      .map((decision) => canonicalFrenchInternalJson(decision))
      .join("\n")}\n`;
    writeFileSync(paths.decisions, decisionsText, "utf8");
    const executor = prepareFrenchCodexImmutableExecution(
      input.options.codexBinary
    );
    const executorIdentity = executor.identity;
    executor.dispose();
    const runWithoutHash = {
      schemaVersion: FRENCH_ENTITY_MENTION_AGENT_RUN_SCHEMA_VERSION,
      policyVersion: FRENCH_ENTITY_MENTION_RESOLUTION_POLICY_VERSION,
      role: input.role,
      batchId: input.batch.batchId,
      manifestHash: input.manifest.manifestHash,
      planHash: input.plan.planHash,
      batchHash: input.batch.batchHash,
      inputHash: input.batch.inputHash,
      agentId: `codex-agent:${execution.threadId}`,
      threadId: execution.threadId,
      model: profile.model,
      reasoningEffort: profile.reasoningEffort,
      executor: executorIdentity,
      promptHash: hashFrenchInternalJson(prompt),
      sourceHashes: {
        manifest: sha256(input.manifestText),
        input: input.batch.inputSha256,
        schema: input.batch.schemaSha256
      },
      resultHashes: {
        response: sha256(execution.responseText),
        events: sha256(execution.stdout),
        stderr: sha256(execution.stderr),
        decisions: sha256(decisionsText)
      },
      decisionHashes: Object.fromEntries(
        decisions.map((decision) => [decision.unitId, decision.artifactHash])
      ),
      startedAt: execution.startedAt,
      completedAt: execution.completedAt
    };
    const run: AgentRun = {
      ...runWithoutHash,
      runHash: hashFrenchInternalJson(runWithoutHash)
    };
    const runText = `${canonicalFrenchInternalJson(run)}\n`;
    const finalPaths = Object.fromEntries(
      Object.entries(paths).map(([key, path]) => [
        key,
        join(finalDir, basename(path))
      ])
    ) as Record<keyof typeof paths, string>;
    const capabilities = {
      localTools: "disabled" as const,
      networkDataTools: "disabled" as const,
      shell: "disabled" as const,
      eventPolicy: "agent-message-only" as const,
      sealedWorkingDirectory: finalDir,
      disabledFeaturesHash: frenchCodexDisabledFeaturesHash(),
      environmentPolicyHash: frenchCodexEnvironmentPolicyHash()
    };
    const receipts = decisions.map((decision) =>
      finalizeFrenchCodexExecutionReceipt({
        schemaVersion: FRENCH_INTERNAL_EXECUTION_RECEIPT_SCHEMA_VERSION,
        role: input.role,
        entryKey: decision.unitId,
        batchId: input.batch.batchId,
        namespace: input.manifest.namespace,
        manifestHash: input.manifest.manifestHash,
        selectionHash: input.plan.planHash,
        inputHash: decision.inputHash,
        artifactHash: decision.artifactHash,
        agentId: run.agentId,
        taskName: `${input.manifest.namespace}/${input.role}/${input.batch.batchId}`,
        threadId: run.threadId,
        model: run.model,
        reasoningEffort: run.reasoningEffort,
        executorPolicyVersion: FRENCH_CODEX_EXECUTOR_POLICY_VERSION,
        executor: executorIdentity,
        capabilities,
        sourcePaths: {
          manifest: resolve(input.options.manifest),
          plan: input.manifest.planPath,
          sealedInput: input.batch.inputPath,
          outputSchema: input.batch.schemaPath,
          runPointer: finalPaths.run
        },
        sourceHashes: {
          manifest: run.sourceHashes.manifest!,
          plan: sha256(readFileSync(input.manifest.planPath, "utf8")),
          sealedInput: run.sourceHashes.input!,
          outputSchema: run.sourceHashes.schema!,
          runPointer: sha256(runText)
        },
        resultPaths: {
          agentEvents: finalPaths.events,
          agentStderr: finalPaths.stderr,
          structuredResponse: finalPaths.response,
          artifacts: finalPaths.decisions
        },
        resultHashes: {
          agentEvents: run.resultHashes.events!,
          agentStderr: run.resultHashes.stderr!,
          structuredResponse: run.resultHashes.response!,
          artifacts: run.resultHashes.decisions!
        },
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        runHash: run.runHash
      })
    );
    writeFileSync(
      paths.receipts,
      `${receipts.map((receipt) => canonicalFrenchInternalJson(receipt)).join("\n")}\n`,
      "utf8"
    );
    writeFileSync(paths.run, runText, "utf8");
    renameSync(temporary, finalDir);
    assertExistingRun(finalDir, input);
  } catch (error) {
    const failed = `${temporary}.failed`;
    if (existsSync(temporary)) renameSync(temporary, failed);
    throw error;
  }
}

function parseDecisions(input: {
  responseText: string;
  role: Role;
  batch: FrenchEntityMentionAgentBatchRecord;
  plan: FrenchEntityMentionResolutionPlan;
}): FrenchEntityMentionDecision[] {
  const parsed = JSON.parse(input.responseText) as { decisions?: unknown[] };
  if (
    !Array.isArray(parsed.decisions) ||
    parsed.decisions.length !== input.batch.unitIds.length
  ) {
    throw new Error(
      `french-mention-agent-response-cardinality:${input.batch.batchId}`
    );
  }
  const unitById = new Map(
    input.plan.units.map((unit) => [unit.unitId, unit] as const)
  );
  const decisions = parsed.decisions.map((raw) => {
    if (!raw || typeof raw !== "object")
      throw new Error("french-mention-agent-decision-shape");
    const value = raw as Record<string, unknown>;
    if (
      value.schemaVersion !== FRENCH_ENTITY_MENTION_DECISION_SCHEMA_VERSION ||
      value.policyVersion !== FRENCH_ENTITY_MENTION_RESOLUTION_POLICY_VERSION ||
      value.role !== input.role ||
      typeof value.unitId !== "string" ||
      typeof value.inputHash !== "string" ||
      typeof value.disposition !== "string" ||
      !Array.isArray(value.reasonCodes) ||
      typeof value.rationale !== "string" ||
      typeof value.confidence !== "number"
    ) {
      throw new Error("french-mention-agent-decision-contract");
    }
    const unit = unitById.get(value.unitId);
    if (
      !unit ||
      unit.inputHash !== value.inputHash ||
      !input.batch.unitIds.includes(unit.unitId)
    ) {
      throw new Error(`french-mention-agent-decision-lineage:${value.unitId}`);
    }
    const disposition = value.disposition as FrenchEntityMentionDisposition;
    const selectedEntryKey =
      value.selectedEntryKey === null ? null : String(value.selectedEntryKey);
    if (
      disposition === "select" &&
      !unit.candidates.some(
        (candidate) => candidate.entryKey === selectedEntryKey
      )
    ) {
      const allowed = unit.candidates
        .map((candidate) => candidate.entryKey)
        .join(",");
      throw new Error(
        `french-mention-agent-selection-unauthorized:${value.unitId}:selected=${selectedEntryKey}:allowed=${allowed}`
      );
    }
    return finalizeFrenchEntityMentionDecision({
      role: input.role,
      unitId: unit.unitId,
      inputHash: unit.inputHash,
      disposition,
      selectedEntryKey,
      reasonCodes: value.reasonCodes.map(String),
      rationale: value.rationale,
      confidence: value.confidence
    });
  });
  const byId = new Map(
    decisions.map((decision) => [decision.unitId, decision])
  );
  if (
    byId.size !== input.batch.unitIds.length ||
    input.batch.unitIds.some((id) => !byId.has(id))
  ) {
    throw new Error(
      `french-mention-agent-response-coverage:${input.batch.batchId}`
    );
  }
  return input.batch.unitIds.map((id) => byId.get(id)!);
}

function buildPrompt(
  role: Role,
  inputText: string,
  batch: FrenchEntityMentionAgentBatchRecord,
  validationFeedback: readonly string[]
): string {
  const stance =
    role === "proposerA"
      ? "Résous chaque mention depuis le contexte anglais scellé."
      : "Travaille indépendamment et cherche activement les faux positifs, homonymes et formes françaises manquantes.";
  const retryBlock =
    validationFeedback.length === 0
      ? ""
      : `\nRETOUR DU VALIDATEUR FAIL-CLOSED SUR TES ESSAIS PRÉCÉDENTS :\n${validationFeedback
          .map((feedback, index) => `${index + 1}. ${feedback}`)
          .join(
            "\n"
          )}\nCorrige ces violations dans une nouvelle décision indépendante. Ce retour décrit uniquement le contrat scellé; il ne fournit aucune réponse métier.\n`;
  return `RÔLE : spécialiste indépendant de résolution des mentions bibliques (${role}).

${stance}

AUTORITÉ : l'identité STEP exacte, le gloss et le meaning anglais scellés, puis les seules politiques candidates fournies. Aucun réseau, aucune recherche, aucun Strong classique, aucun outil et aucune connaissance externe.

Pour chaque unité, rends exactement une décision :
- select : la surface désigne sans ambiguïté une politique candidate; selectedEntryKey doit être cette clé exacte.
- non-entity : la surface est ici un mot commun, une abréviation, un auteur moderne ou un autre emploi non biblique; selectedEntryKey=null.
- policy-repair : l'entité est claire mais aucune IDENTITÉ candidate ne représente exactement le référent, ou la forme française autonome nécessaire manque réellement; selectedEntryKey=null.
- quarantine : le contexte ne permet pas de choisir honnêtement; selectedEntryKey=null.

IMPORTANT : sourceSurface, gloss et meaning sont anglais. allowedFrenchForms contient la traduction française autorisée À PRODUIRE après sélection. Ne compare jamais littéralement la surface anglaise à allowedFrenchForms et ne demande jamais que « Greece » soit déjà « Grèce », par exemple. Si l'identité candidate est prouvée, select autorise précisément ses allowedFrenchForms.

CONTRAINTE DE SORTIE ABSOLUE : pour chaque décision select, copie selectedEntryKey mot pour mot depuis le tableau candidates DE CETTE UNITÉ. Une clé visible dans sourceIdentity, uStrong, dStrong ou le meaning est interdite si elle n'apparaît pas aussi dans candidates. Dans ce cas, rends policy-repair ou quarantine, jamais la clé extérieure. L'identité de la NOTICE SOURCE (sourceEntryKey/sourceIdentity) ne prouve jamais l'identité d'une MENTION INTERNE : une notice peut définir, citer ou distinguer plusieurs personnes, lieux ou sens. Résous chaque occurrence uniquement d'après son propre segment et son contexte textuel; ne sélectionne l'entrée source que si CE RÉFÉRENT précis est textuellement prouvé.
${retryBlock}

Une candidate unique ne prouve jamais à elle seule que la surface désigne une entité. Ne choisis jamais une politique seulement parce que sa forme française paraît plausible. Préserve les distinctions STEP et sous-STEP. Confidence élevée uniquement avec preuve textuelle directe. reasonCodes est trié et sans doublon. La réponse contient exactement ${batch.unitIds.length} décisions dans l'ordre des unités, avec role=${role}, sans artifactHash, Markdown ni commentaire.

<sealed_input_json>
${inputText.trim()}
</sealed_input_json>`;
}

async function executeCodex(input: {
  options: CliOptions;
  profile: { model: string; reasoningEffort: string };
  prompt: string;
  schemaPath: string;
  responsePath: string;
  cwd: string;
}): Promise<{
  threadId: string;
  stdout: string;
  stderr: string;
  responseText: string;
  startedAt: string;
  completedAt: string;
}> {
  const executable = prepareFrenchCodexImmutableExecution(
    input.options.codexBinary
  );
  const startedAt = new Date().toISOString();
  let stdout = "";
  let stderr = "";
  let timedOut = false;
  try {
    const child = spawn(
      executable.executionPath,
      frenchCodexProposerExecArgs({
        model: input.profile.model,
        reasoningEffort: input.profile.reasoningEffort,
        schemaPath: input.schemaPath,
        responsePath: input.responsePath,
        cwd: input.cwd
      }),
      {
        cwd: input.cwd,
        env: buildSealedFrenchCodexProposerEnvironment(input.options.codexHome),
        stdio: ["pipe", "pipe", "pipe"],
        detached: true
      }
    );
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => (stdout += chunk));
    child.stderr.on("data", (chunk: string) => (stderr += chunk));
    child.stdin.end(input.prompt);
    const exitCode = await new Promise<number>((resolveExit, reject) => {
      const timeout = setTimeout(() => {
        timedOut = true;
        if (child.pid) process.kill(-child.pid, "SIGTERM");
      }, input.options.timeoutMs);
      child.once("error", reject);
      child.once("close", (code) => {
        clearTimeout(timeout);
        resolveExit(code ?? -1);
      });
    });
    executable.assertUnchanged();
    if (timedOut || exitCode !== 0 || !existsSync(input.responsePath)) {
      throw new Error(
        timedOut
          ? "french-mention-agent-timeout"
          : `french-mention-agent-exit:${exitCode}:${stderr}`
      );
    }
    const responseText = readFileSync(input.responsePath, "utf8");
    const events = parseFrenchCodexAgentEvents(stdout, responseText);
    return {
      threadId: events.threadId,
      stdout,
      stderr,
      responseText,
      startedAt,
      completedAt: new Date().toISOString()
    };
  } finally {
    executable.dispose();
  }
}

function assertExistingRun(
  directory: string,
  expected: {
    manifest: FrenchEntityMentionAgentBatchManifest;
    plan: FrenchEntityMentionResolutionPlan;
    role: Role;
    batch: FrenchEntityMentionAgentBatchRecord;
  }
): void {
  const run = JSON.parse(
    readFileSync(join(directory, "run.json"), "utf8")
  ) as AgentRun;
  if (
    run.schemaVersion !== FRENCH_ENTITY_MENTION_AGENT_RUN_SCHEMA_VERSION ||
    run.manifestHash !== expected.manifest.manifestHash ||
    run.planHash !== expected.plan.planHash ||
    run.batchHash !== expected.batch.batchHash ||
    run.role !== expected.role ||
    run.runHash !==
      hashFrenchInternalJson(
        Object.fromEntries(
          Object.entries(run).filter(([key]) => key !== "runHash")
        )
      )
  ) {
    throw new Error(
      `french-mention-agent-existing-run-invalid:${expected.role}:${expected.batch.batchId}`
    );
  }
  const decisions = readFileSync(join(directory, "decisions.jsonl"), "utf8")
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as FrenchEntityMentionDecision);
  if (decisions.length !== expected.batch.unitIds.length) {
    throw new Error("french-mention-agent-existing-decisions-cardinality");
  }
  decisions.forEach(assertFrenchEntityMentionDecision);
}

async function mapConcurrent<T>(
  values: readonly T[],
  concurrency: number,
  worker: (value: T) => Promise<void>
): Promise<void> {
  let index = 0;
  const errors: unknown[] = [];
  const run = async (): Promise<void> => {
    while (true) {
      const current = index;
      index += 1;
      if (current >= values.length) return;
      try {
        await worker(values[current]!);
      } catch (error) {
        errors.push(error);
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, run)
  );
  if (errors.length > 0) {
    throw new AggregateError(
      errors,
      `french-mention-agent-task-failures:${errors.length}`
    );
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
      throw new Error(`french-mention-agent-option:${token}`);
    const value = inline ?? args[index + 1];
    if (!value || (!inline && value.startsWith("--")))
      throw new Error(`french-mention-agent-value:${key}`);
    values.set(key, value);
    if (inline === undefined) index += 1;
  }
  const required = (key: string): string => {
    const value = values.get(key);
    if (!value) throw new Error(`french-mention-agent-required:${key}`);
    return resolve(value);
  };
  const stage = values.get("stage") ?? "proposers";
  if (!["proposerA", "proposerB", "proposers"].includes(stage)) {
    throw new Error(`french-mention-agent-stage:${stage}`);
  }
  return {
    manifest: required("manifest"),
    resultsDir: required("results-dir"),
    codexBinary: required("codex-binary"),
    codexHome: required("codex-home"),
    stage: stage as CliOptions["stage"],
    concurrency: positiveInteger(values.get("concurrency") ?? "4"),
    timeoutMs: positiveInteger(values.get("timeout-ms") ?? "1200000"),
    maxAttempts: positiveInteger(values.get("max-attempts") ?? "2"),
    limitBatches: values.has("limit-batches")
      ? positiveInteger(values.get("limit-batches")!)
      : null
  };
}

function positiveInteger(value: string): number {
  if (!/^[1-9]\d*$/u.test(value))
    throw new Error(`french-mention-agent-integer:${value}`);
  return Number(value);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (import.meta.url === invokedPath) {
  runLexiconV3FrenchEntityMentionAgents(parseArgs(process.argv.slice(2))).catch(
    (error) => {
      process.stderr.write(
        `${basename(process.argv[1] ?? "runLexiconV3FrenchEntityMentionAgents")}: ${error instanceof Error ? error.message : String(error)}\n`
      );
      process.exitCode = 1;
    }
  );
}
