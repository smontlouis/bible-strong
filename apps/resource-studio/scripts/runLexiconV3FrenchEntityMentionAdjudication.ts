import { spawn } from "node:child_process";
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
  finalizeFrenchEntityMentionAudit,
  finalizeFrenchEntityMentionDecision,
  FRENCH_ENTITY_MENTION_AUDIT_SCHEMA_VERSION,
  FRENCH_ENTITY_MENTION_DECISION_SCHEMA_VERSION,
  FRENCH_ENTITY_MENTION_RESOLUTION_POLICY_VERSION,
  type FrenchEntityMentionAudit,
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

export const FRENCH_ENTITY_MENTION_ADJUDICATION_RUN_SCHEMA_VERSION =
  "lexicon-v3-french-entity-mention-adjudication-run@1" as const;

type Role = "arbiter" | "auditor";

interface CliOptions {
  manifest: string;
  resultsDir: string;
  codexBinary: string;
  codexHome: string;
  stage: Role | "all";
  concurrency: number;
  timeoutMs: number;
  maxAttempts: number;
  limitBatches: number | null;
}

interface AdjudicationRun {
  schemaVersion: typeof FRENCH_ENTITY_MENTION_ADJUDICATION_RUN_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_ENTITY_MENTION_RESOLUTION_POLICY_VERSION;
  role: Role;
  batchId: string;
  manifestHash: string;
  planHash: string;
  batchHash: string;
  inputHash: string;
  parentArtifactHashes: string[];
  parentThreadIds: string[];
  agentId: string;
  threadId: string;
  model: string;
  reasoningEffort: string;
  executor: { path: string; version: string; sha256: string };
  promptHash: string;
  sourceHashes: Record<string, string>;
  resultHashes: Record<string, string>;
  artifactHashes: Record<string, string>;
  startedAt: string;
  completedAt: string;
  runHash: string;
}

interface ParentRun {
  threadId: string;
  manifestHash: string;
  planHash: string;
  batchHash: string;
  role: string;
}

export async function runLexiconV3FrenchEntityMentionAdjudication(
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
  const batches =
    options.limitBatches === null
      ? manifest.batches
      : manifest.batches.slice(0, options.limitBatches);
  const roles: Role[] =
    options.stage === "all" ? ["arbiter", "auditor"] : [options.stage];
  for (const role of roles) {
    let reused = 0;
    let executed = 0;
    await mapConcurrent(batches, options.concurrency, async (batch) => {
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
      `${JSON.stringify({ role, batches: batches.length, reused, executed }, null, 2)}\n`
    );
  }
}

async function runWithAttempts(input: RunInput): Promise<{ reused: boolean }> {
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

interface RunInput {
  options: CliOptions;
  manifest: FrenchEntityMentionAgentBatchManifest;
  manifestText: string;
  plan: FrenchEntityMentionResolutionPlan;
  role: Role;
  batch: FrenchEntityMentionAgentBatchRecord;
}

async function runOnce(
  input: RunInput,
  finalDir: string,
  attempt: number,
  validationFeedback: readonly string[]
): Promise<void> {
  mkdirSync(dirname(finalDir), { recursive: true });
  const temporary = `${finalDir}.tmp-${process.pid}-${Date.now()}-${attempt}`;
  mkdirSync(temporary, { recursive: false });
  const paths = {
    input: join(temporary, "input.json"),
    schema: join(temporary, "output.schema.json"),
    response: join(temporary, "structured-response.json"),
    events: join(temporary, "agent-events.jsonl"),
    stderr: join(temporary, "agent-stderr.log"),
    artifacts: join(
      temporary,
      input.role === "arbiter" ? "decisions.jsonl" : "audits.jsonl"
    ),
    receipts: join(temporary, "execution-receipts.jsonl"),
    run: join(temporary, "run.json")
  };
  try {
    const parent = loadParents(input);
    const payload = buildPayload(input, parent);
    const inputText = `${canonicalFrenchInternalJson(payload)}\n`;
    const schemaText = `${JSON.stringify(
      input.role === "arbiter"
        ? decisionSchema(input)
        : auditSchema(input, parent.arbiterByUnit),
      null,
      2
    )}\n`;
    writeFileSync(paths.input, inputText, "utf8");
    writeFileSync(paths.schema, schemaText, "utf8");
    const prompt = buildFrenchEntityMentionAdjudicationPrompt(
      input.role,
      inputText,
      input.batch.unitIds.length,
      validationFeedback
    );
    const profile = FRENCH_INTERNAL_APPROVED_EXECUTION_PROFILE[input.role];
    const execution = await executeCodex({
      options: input.options,
      profile,
      prompt,
      schemaPath: paths.schema,
      responsePath: paths.response,
      cwd: temporary
    });
    if (parent.threadIds.includes(execution.threadId)) {
      throw new Error(
        `french-mention-adjudication-thread-reuse:${input.role}:${input.batch.batchId}`
      );
    }
    writeFileSync(paths.events, execution.stdout, "utf8");
    writeFileSync(paths.stderr, execution.stderr, "utf8");
    const artifacts =
      input.role === "arbiter"
        ? parseArbiterDecisions(execution.responseText, input)
        : parseAudits(execution.responseText, input, parent.arbiterByUnit);
    const artifactsText = `${artifacts.map(canonicalFrenchInternalJson).join("\n")}\n`;
    writeFileSync(paths.artifacts, artifactsText, "utf8");
    const executor = prepareFrenchCodexImmutableExecution(
      input.options.codexBinary
    );
    const executorIdentity = executor.identity;
    executor.dispose();
    const finalPaths = Object.fromEntries(
      Object.entries(paths).map(([key, path]) => [
        key,
        join(finalDir, basename(path))
      ])
    ) as Record<keyof typeof paths, string>;
    const sourceHashes = {
      manifest: sha256(input.manifestText),
      batchInput: input.batch.inputSha256,
      adjudicationInput: sha256(inputText),
      outputSchema: sha256(schemaText),
      ...parent.sourceHashes
    };
    const resultHashes = {
      response: sha256(execution.responseText),
      events: sha256(execution.stdout),
      stderr: sha256(execution.stderr),
      artifacts: sha256(artifactsText)
    };
    const artifactHashes = Object.fromEntries(
      artifacts.map((artifact) => [artifact.unitId, artifact.artifactHash])
    );
    const runWithoutHash = {
      schemaVersion: FRENCH_ENTITY_MENTION_ADJUDICATION_RUN_SCHEMA_VERSION,
      policyVersion: FRENCH_ENTITY_MENTION_RESOLUTION_POLICY_VERSION,
      role: input.role,
      batchId: input.batch.batchId,
      manifestHash: input.manifest.manifestHash,
      planHash: input.plan.planHash,
      batchHash: input.batch.batchHash,
      inputHash: hashFrenchInternalJson(payload),
      parentArtifactHashes: parent.artifactHashes.sort(compareText),
      parentThreadIds: parent.threadIds.sort(compareText),
      agentId: `codex-agent:${execution.threadId}`,
      threadId: execution.threadId,
      model: profile.model,
      reasoningEffort: profile.reasoningEffort,
      executor: executorIdentity,
      promptHash: hashFrenchInternalJson(prompt),
      sourceHashes,
      resultHashes,
      artifactHashes,
      startedAt: execution.startedAt,
      completedAt: execution.completedAt
    };
    const run: AdjudicationRun = {
      ...runWithoutHash,
      runHash: hashFrenchInternalJson(runWithoutHash)
    };
    const runText = `${canonicalFrenchInternalJson(run)}\n`;
    const capabilities = {
      localTools: "disabled" as const,
      networkDataTools: "disabled" as const,
      shell: "disabled" as const,
      eventPolicy: "agent-message-only" as const,
      sealedWorkingDirectory: finalDir,
      disabledFeaturesHash: frenchCodexDisabledFeaturesHash(),
      environmentPolicyHash: frenchCodexEnvironmentPolicyHash()
    };
    const receipts = artifacts.map((artifact) =>
      finalizeFrenchCodexExecutionReceipt({
        schemaVersion: FRENCH_INTERNAL_EXECUTION_RECEIPT_SCHEMA_VERSION,
        role: input.role,
        entryKey: artifact.unitId,
        batchId: input.batch.batchId,
        namespace: input.manifest.namespace,
        manifestHash: input.manifest.manifestHash,
        selectionHash: input.plan.planHash,
        inputHash: artifact.inputHash,
        artifactHash: artifact.artifactHash,
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
          sealedInput: finalPaths.input,
          outputSchema: finalPaths.schema,
          runPointer: finalPaths.run
        },
        sourceHashes: {
          manifest: sourceHashes.manifest!,
          plan: sha256(readFileSync(input.manifest.planPath, "utf8")),
          sealedInput: sourceHashes.adjudicationInput!,
          outputSchema: sourceHashes.outputSchema!,
          runPointer: sha256(runText)
        },
        resultPaths: {
          agentEvents: finalPaths.events,
          agentStderr: finalPaths.stderr,
          structuredResponse: finalPaths.response,
          artifacts: finalPaths.artifacts
        },
        resultHashes: {
          agentEvents: resultHashes.events,
          agentStderr: resultHashes.stderr,
          structuredResponse: resultHashes.response,
          artifacts: resultHashes.artifacts
        },
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        runHash: run.runHash
      })
    );
    writeFileSync(
      paths.receipts,
      `${receipts.map(canonicalFrenchInternalJson).join("\n")}\n`,
      "utf8"
    );
    writeFileSync(paths.run, runText, "utf8");
    renameSync(temporary, finalDir);
    assertExistingRun(finalDir, input);
  } catch (error) {
    if (existsSync(temporary)) renameSync(temporary, `${temporary}.failed`);
    throw error;
  }
}

function loadParents(input: RunInput): {
  proposerA: FrenchEntityMentionDecision[];
  proposerB: FrenchEntityMentionDecision[];
  arbiter: FrenchEntityMentionDecision[];
  arbiterByUnit: Map<string, FrenchEntityMentionDecision>;
  artifactHashes: string[];
  threadIds: string[];
  sourceHashes: Record<string, string>;
} {
  const load = (role: "proposerA" | "proposerB" | "arbiter") => {
    const dir = join(
      resolve(input.options.resultsDir),
      role,
      input.batch.batchId
    );
    const file = join(dir, "decisions.jsonl");
    const runFile = join(dir, "run.json");
    if (!existsSync(file) || !existsSync(runFile)) {
      throw new Error(
        `french-mention-adjudication-parent-missing:${role}:${input.batch.batchId}`
      );
    }
    const run = JSON.parse(readFileSync(runFile, "utf8")) as ParentRun;
    if (
      run.role !== role ||
      run.manifestHash !== input.manifest.manifestHash ||
      run.planHash !== input.plan.planHash ||
      run.batchHash !== input.batch.batchHash
    ) {
      throw new Error(
        `french-mention-adjudication-parent-lineage:${role}:${input.batch.batchId}`
      );
    }
    const text = readFileSync(file, "utf8");
    const decisions = text
      .split(/\r?\n/u)
      .filter(Boolean)
      .map((line) => JSON.parse(line) as FrenchEntityMentionDecision);
    if (decisions.length !== input.batch.unitIds.length)
      throw new Error(`french-mention-adjudication-parent-coverage:${role}`);
    decisions.forEach((decision) => {
      assertFrenchEntityMentionDecision(decision);
      if (
        decision.role !== role ||
        !input.batch.unitIds.includes(decision.unitId)
      ) {
        throw new Error(
          `french-mention-adjudication-parent-decision:${role}:${decision.unitId}`
        );
      }
    });
    return { decisions, run, file, text };
  };
  const a = load("proposerA");
  const b = load("proposerB");
  const arbiter = input.role === "auditor" ? load("arbiter") : null;
  const all = [a, b, ...(arbiter ? [arbiter] : [])];
  const threadIds = all.map((item) => item.run.threadId);
  if (new Set(threadIds).size !== threadIds.length)
    throw new Error(
      `french-mention-adjudication-parent-thread-collision:${input.batch.batchId}`
    );
  return {
    proposerA: a.decisions,
    proposerB: b.decisions,
    arbiter: arbiter?.decisions ?? [],
    arbiterByUnit: new Map(
      (arbiter?.decisions ?? []).map((item) => [item.unitId, item])
    ),
    artifactHashes: all.flatMap((item) =>
      item.decisions.map((decision) => decision.artifactHash)
    ),
    threadIds,
    sourceHashes: Object.fromEntries(
      all.flatMap((item) => [
        [`${item.run.role}Decisions`, sha256(item.text)],
        [
          `${item.run.role}Run`,
          sha256(readFileSync(join(dirname(item.file), "run.json"), "utf8"))
        ]
      ])
    )
  };
}

function buildPayload(
  input: RunInput,
  parent: ReturnType<typeof loadParents>
): object {
  const units = new Map(input.plan.units.map((unit) => [unit.unitId, unit]));
  const byId = (values: FrenchEntityMentionDecision[]) =>
    new Map(values.map((value) => [value.unitId, value]));
  const a = byId(parent.proposerA);
  const b = byId(parent.proposerB);
  const arbiter = byId(parent.arbiter);
  return {
    schemaVersion: `lexicon-v3-french-entity-mention-${input.role}-input@1`,
    policyVersion: FRENCH_ENTITY_MENTION_RESOLUTION_POLICY_VERSION,
    planHash: input.plan.planHash,
    batchId: input.batch.batchId,
    units: input.batch.unitIds.map((unitId) => ({
      unit: units.get(unitId),
      proposerA: a.get(unitId),
      proposerB: b.get(unitId),
      ...(input.role === "auditor" ? { arbiter: arbiter.get(unitId) } : {})
    }))
  };
}

function parseArbiterDecisions(
  responseText: string,
  input: RunInput
): FrenchEntityMentionDecision[] {
  const parsed = JSON.parse(responseText) as { decisions?: unknown[] };
  if (
    !Array.isArray(parsed.decisions) ||
    parsed.decisions.length !== input.batch.unitIds.length
  )
    throw new Error("french-mention-arbiter-cardinality");
  const unitById = new Map(input.plan.units.map((unit) => [unit.unitId, unit]));
  const decisions = parsed.decisions.map((raw) => {
    const value = raw as Record<string, unknown>;
    const unit = unitById.get(String(value.unitId));
    if (
      value.schemaVersion !== FRENCH_ENTITY_MENTION_DECISION_SCHEMA_VERSION ||
      value.policyVersion !== FRENCH_ENTITY_MENTION_RESOLUTION_POLICY_VERSION ||
      value.role !== "arbiter" ||
      !unit ||
      unit.inputHash !== value.inputHash ||
      !input.batch.unitIds.includes(unit.unitId) ||
      !Array.isArray(value.reasonCodes) ||
      typeof value.rationale !== "string" ||
      typeof value.confidence !== "number"
    )
      throw new Error(
        `french-mention-arbiter-contract:${String(value.unitId)}`
      );
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
        `french-mention-arbiter-selection:${unit.unitId}:selected=${selectedEntryKey}:allowed=${allowed}`
      );
    }
    return finalizeFrenchEntityMentionDecision({
      role: "arbiter",
      unitId: unit.unitId,
      inputHash: unit.inputHash,
      disposition,
      selectedEntryKey,
      reasonCodes: value.reasonCodes.map(String),
      rationale: value.rationale,
      confidence: value.confidence
    });
  });
  return orderAndCheck(decisions, input.batch.unitIds);
}

function parseAudits(
  responseText: string,
  input: RunInput,
  arbiterByUnit: Map<string, FrenchEntityMentionDecision>
): FrenchEntityMentionAudit[] {
  const parsed = JSON.parse(responseText) as { audits?: unknown[] };
  if (
    !Array.isArray(parsed.audits) ||
    parsed.audits.length !== input.batch.unitIds.length
  )
    throw new Error("french-mention-auditor-cardinality");
  const units = new Map(input.plan.units.map((unit) => [unit.unitId, unit]));
  const audits = parsed.audits.map((raw) => {
    const value = raw as Record<string, unknown>;
    const unit = units.get(String(value.unitId));
    const arbiter = unit ? arbiterByUnit.get(unit.unitId) : undefined;
    const checks = value.checks as Record<string, unknown> | undefined;
    if (
      value.schemaVersion !== FRENCH_ENTITY_MENTION_AUDIT_SCHEMA_VERSION ||
      value.policyVersion !== FRENCH_ENTITY_MENTION_RESOLUTION_POLICY_VERSION ||
      !unit ||
      !arbiter ||
      value.inputHash !== unit.inputHash ||
      value.arbiterArtifactHash !== arbiter.artifactHash ||
      !checks ||
      !Array.isArray(value.reasons) ||
      typeof value.confidence !== "number"
    )
      throw new Error(
        `french-mention-auditor-contract:${String(value.unitId)}`
      );
    return finalizeFrenchEntityMentionAudit({
      unitId: unit.unitId,
      inputHash: unit.inputHash,
      arbiterArtifactHash: arbiter.artifactHash,
      verdict: value.verdict as "safe" | "hold" | "block",
      checks: {
        sourceContextExact: checks.sourceContextExact === true,
        selectedPolicyAuthorized: checks.selectedPolicyAuthorized === true,
        nonEntityJustified: checks.nonEntityJustified === true,
        noInventedFrenchForm: checks.noInventedFrenchForm === true
      },
      reasons: value.reasons.map(String),
      confidence: value.confidence
    });
  });
  return orderAndCheck(audits, input.batch.unitIds);
}

function orderAndCheck<T extends { unitId: string }>(
  values: T[],
  unitIds: string[]
): T[] {
  const byId = new Map(values.map((value) => [value.unitId, value]));
  if (byId.size !== unitIds.length || unitIds.some((id) => !byId.has(id)))
    throw new Error("french-mention-adjudication-coverage");
  return unitIds.map((id) => byId.get(id)!);
}

export function buildFrenchEntityMentionAdjudicationPrompt(
  role: Role,
  inputText: string,
  count: number,
  validationFeedback: readonly string[]
): string {
  const retryBlock =
    validationFeedback.length === 0
      ? ""
      : `\nRETOUR DU VALIDATEUR FAIL-CLOSED SUR TES ESSAIS PRÉCÉDENTS :\n${validationFeedback
          .map((feedback, index) => `${index + 1}. ${feedback}`)
          .join(
            "\n"
          )}\nCorrige uniquement ces violations du contrat scellé. Ce retour ne fournit aucune réponse métier.\n`;
  if (role === "arbiter")
    return `RÔLE : arbitre indépendant des mentions bibliques.

Compare les deux avis avec le contexte anglais scellé. Décide toi-même : une candidate unique ne prouve jamais à elle seule que la surface désigne une entité; select seulement si une identité candidate exacte est textuellement prouvée; non-entity pour un emploi commun/abréviation/auteur moderne; policy-repair si l'entité est claire mais aucune IDENTITÉ candidate ne représente exactement le référent, ou si une forme française autonome nécessaire manque réellement; quarantine si un doute subsiste. L'identité de la NOTICE SOURCE (sourceEntryKey/sourceIdentity) ne prouve jamais l'identité d'une MENTION INTERNE : une notice peut définir, citer ou distinguer plusieurs personnes, lieux ou sens. Résous chaque occurrence uniquement d'après son propre segment et son contexte textuel; ne sélectionne l'entrée source que si CE RÉFÉRENT précis est textuellement prouvé. sourceSurface, gloss et meaning sont anglais; allowedFrenchForms est la traduction française autorisée À PRODUIRE. Ne compare jamais littéralement « Greece » à « Grèce » : si l'identité est prouvée, select autorise ses allowedFrenchForms. Ne suis jamais la majorité par défaut. Préserve STEP et sous-STEP. Aucun réseau, outil, Strong classique ou connaissance externe. Pour select, copie selectedEntryKey mot pour mot depuis candidates DE CETTE UNITÉ; toute clé extérieure impose policy-repair ou quarantine. selectedEntryKey est nul hors select. Rends exactement ${count} décisions, role=arbiter, dans l'ordre, sans artifactHash, Markdown ni commentaire.
${retryBlock}

<sealed_input_json>\n${inputText.trim()}\n</sealed_input_json>`;
  return `RÔLE : auditeur adversarial indépendant des mentions bibliques.

Vérifie la décision de l'arbitre contre le contexte anglais et les candidates scellées. La capitalisation, une candidate unique ou une abréviation biblique ne prouvent jamais à elles seules une identité. L'identité de la NOTICE SOURCE (sourceEntryKey/sourceIdentity) n'est jamais une preuve de l'identité d'une MENTION INTERNE : vérifie le référent précis dans son segment et son contexte textuel. Si l'arbitre sélectionne l'entrée source seulement parce que la mention se trouve dans sa notice, ou confond deux sens/personnes/lieux cités par une même notice, rends block avec sourceContextExact=false et selectedPolicyAuthorized=false. sourceSurface est anglais et allowedFrenchForms est la traduction française autorisée : leur différence linguistique n'est jamais un défaut. safe exige quatre checks vrais : contexte exact; politique autorisée (ou sans objet honnête); non-entité justifiée (ou sans objet honnête); aucune forme française inventée. Au moindre doute, contradiction, surinterprétation, mauvais sous-STEP ou candidate absente, rends hold ou block. Une décision de quarantaine peut être safe si elle est correctement prudente. Aucun réseau, outil ou connaissance externe. Rends exactement ${count} audits dans l'ordre, sans artifactHash, Markdown ni commentaire.
${retryBlock}

<sealed_input_json>\n${inputText.trim()}\n</sealed_input_json>`;
}

function decisionSchema(input: RunInput): object {
  const units = input.plan.units.filter((unit) =>
    input.batch.unitIds.includes(unit.unitId)
  );
  return responseSchema("decisions", units.length, {
    anyOf: units.map((unit) => ({
      type: "object",
      additionalProperties: false,
      required: [
        "schemaVersion",
        "policyVersion",
        "role",
        "unitId",
        "inputHash",
        "disposition",
        "selectedEntryKey",
        "reasonCodes",
        "rationale",
        "confidence"
      ],
      properties: {
        schemaVersion: {
          type: "string",
          enum: [FRENCH_ENTITY_MENTION_DECISION_SCHEMA_VERSION]
        },
        policyVersion: {
          type: "string",
          enum: [FRENCH_ENTITY_MENTION_RESOLUTION_POLICY_VERSION]
        },
        role: { type: "string", enum: ["arbiter"] },
        unitId: { type: "string", enum: [unit.unitId] },
        inputHash: { type: "string", enum: [unit.inputHash] },
        disposition: {
          type: "string",
          enum: ["select", "non-entity", "policy-repair", "quarantine"]
        },
        selectedEntryKey: {
          anyOf: [
            {
              type: "string",
              enum: unit.candidates.map((candidate) => candidate.entryKey)
            },
            { type: "null" }
          ]
        },
        reasonCodes: {
          type: "array",
          items: { type: "string", minLength: 1 }
        },
        rationale: { type: "string" },
        confidence: { type: "number", minimum: 0, maximum: 1 }
      }
    }))
  });
}

function auditSchema(
  input: RunInput,
  arbiterByUnit: Map<string, FrenchEntityMentionDecision>
): object {
  const units = input.plan.units.filter((unit) =>
    input.batch.unitIds.includes(unit.unitId)
  );
  return responseSchema("audits", units.length, {
    anyOf: units.map((unit) => ({
      type: "object",
      additionalProperties: false,
      required: [
        "schemaVersion",
        "policyVersion",
        "unitId",
        "inputHash",
        "arbiterArtifactHash",
        "verdict",
        "checks",
        "reasons",
        "confidence"
      ],
      properties: {
        schemaVersion: {
          type: "string",
          enum: [FRENCH_ENTITY_MENTION_AUDIT_SCHEMA_VERSION]
        },
        policyVersion: {
          type: "string",
          enum: [FRENCH_ENTITY_MENTION_RESOLUTION_POLICY_VERSION]
        },
        unitId: { type: "string", enum: [unit.unitId] },
        inputHash: { type: "string", enum: [unit.inputHash] },
        arbiterArtifactHash: {
          type: "string",
          enum: [arbiterByUnit.get(unit.unitId)?.artifactHash]
        },
        verdict: { type: "string", enum: ["safe", "hold", "block"] },
        checks: {
          type: "object",
          additionalProperties: false,
          required: [
            "sourceContextExact",
            "selectedPolicyAuthorized",
            "nonEntityJustified",
            "noInventedFrenchForm"
          ],
          properties: {
            sourceContextExact: { type: "boolean" },
            selectedPolicyAuthorized: { type: "boolean" },
            nonEntityJustified: { type: "boolean" },
            noInventedFrenchForm: { type: "boolean" }
          }
        },
        reasons: { type: "array", items: { type: "string" } },
        confidence: { type: "number", minimum: 0, maximum: 1 }
      }
    }))
  });
}

function responseSchema(key: string, count: number, item: object): object {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    additionalProperties: false,
    required: [key],
    properties: {
      [key]: { type: "array", minItems: count, maxItems: count, items: item }
    }
  };
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
    if (timedOut || exitCode !== 0 || !existsSync(input.responsePath))
      throw new Error(
        timedOut
          ? "french-mention-adjudication-timeout"
          : `french-mention-adjudication-exit:${exitCode}:${stderr}`
      );
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

function assertExistingRun(directory: string, expected: RunInput): void {
  const run = JSON.parse(
    readFileSync(join(directory, "run.json"), "utf8")
  ) as AdjudicationRun;
  const { runHash, ...content } = run;
  if (
    run.schemaVersion !==
      FRENCH_ENTITY_MENTION_ADJUDICATION_RUN_SCHEMA_VERSION ||
    run.policyVersion !== FRENCH_ENTITY_MENTION_RESOLUTION_POLICY_VERSION ||
    run.role !== expected.role ||
    run.batchId !== expected.batch.batchId ||
    run.manifestHash !== expected.manifest.manifestHash ||
    run.planHash !== expected.plan.planHash ||
    run.batchHash !== expected.batch.batchHash ||
    hashFrenchInternalJson(content) !== runHash
  )
    throw new Error(
      `french-mention-adjudication-existing-run:${expected.role}:${expected.batch.batchId}`
    );
  const file = join(
    directory,
    expected.role === "arbiter" ? "decisions.jsonl" : "audits.jsonl"
  );
  const artifacts = readFileSync(file, "utf8")
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  if (artifacts.length !== expected.batch.unitIds.length)
    throw new Error("french-mention-adjudication-existing-coverage");
  if (expected.role === "arbiter")
    artifacts.forEach((value) =>
      assertFrenchEntityMentionDecision(value as FrenchEntityMentionDecision)
    );
  else
    artifacts.forEach((value) =>
      assertFrenchEntityMentionAudit(value as FrenchEntityMentionAudit)
    );
}

async function mapConcurrent<T>(
  values: readonly T[],
  concurrency: number,
  worker: (value: T) => Promise<void>
): Promise<void> {
  let index = 0;
  const errors: unknown[] = [];
  const run = async () => {
    while (true) {
      const current = index++;
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
      `french-mention-adjudication-task-failures:${errors.length}`
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
      throw new Error(`french-mention-adjudication-option:${token}`);
    const value = inline ?? args[index + 1];
    if (!value || (!inline && value.startsWith("--")))
      throw new Error(`french-mention-adjudication-value:${key}`);
    values.set(key, value);
    if (inline === undefined) index += 1;
  }
  const required = (key: string) => {
    const value = values.get(key);
    if (!value) throw new Error(`french-mention-adjudication-required:${key}`);
    return resolve(value);
  };
  const stage = values.get("stage") ?? "all";
  if (!["arbiter", "auditor", "all"].includes(stage))
    throw new Error(`french-mention-adjudication-stage:${stage}`);
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
    throw new Error(`french-mention-adjudication-integer:${value}`);
  return Number(value);
}
function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (import.meta.url === invokedPath) {
  runLexiconV3FrenchEntityMentionAdjudication(
    parseArgs(process.argv.slice(2))
  ).catch((error) => {
    process.stderr.write(
      `${basename(process.argv[1] ?? "runLexiconV3FrenchEntityMentionAdjudication")}: ${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exitCode = 1;
  });
}
