import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  buildSealedFrenchCodexProposerEnvironment,
  frenchCodexProposerExecArgs,
  parseFrenchCodexAgentEvents
} from "./runLexiconV3FrenchCodexProposerBatch.js";
import { normalizeFrenchAdaptiveMechanicalStepArtifacts } from "./runLexiconV3FrenchAdaptivePipeline.js";
import {
  assertFrenchCodexImmutableBinary,
  ensureFrenchCodexImmutableBinary,
  FRENCH_CODEX_IMMUTABLE_BINARY_PATH,
  prepareFrenchCodexImmutableExecution
} from "../src/lexiconV3/frenchCodexImmutableBinary.js";
import {
  FRENCH_ADAPTIVE_ARBITRATION_SCHEMA_VERSION,
  FRENCH_ADAPTIVE_DRAFT_SCHEMA_VERSION,
  FRENCH_ADAPTIVE_REVIEW_SCHEMA_VERSION,
  applyFrenchAdaptiveReview,
  buildFrenchAdaptiveFinalRecord,
  frenchAdaptiveNeedsArbitration,
  frenchAdaptiveReviewHash,
  frenchAdaptiveTaskForAgent,
  frenchAdaptiveTranslationHash,
  validateFrenchAdaptiveDraft,
  type FrenchAdaptiveArbitration,
  type FrenchAdaptiveDraft,
  type FrenchAdaptiveFinalRecord,
  type FrenchAdaptiveReview,
  type FrenchAdaptiveTask,
  type FrenchAdaptiveValidation
} from "../src/lexiconV3/frenchAdaptivePipeline.js";
import { hashFrenchInternalJson } from "../src/lexiconV3/frenchInternalReview.js";

type Stage = "translator" | "reviewer" | "arbiter";
type TriageVerdict = "keep" | "correct" | "escalate";

interface TriageIssue {
  code: string;
  severity: string;
  field: string;
  details?: Record<string, unknown>;
}

export interface CoreTriageTask {
  key: string;
  sourceId: number;
  stepCode: string | null;
  sourceHash: string;
  translationHash: string;
  deterministicIssues: TriageIssue[];
  fields: Record<string, { english: string; french: string }>;
}

export interface CoreTriageDecision {
  key: string;
  verdict: TriageVerdict;
  issueCodes: string[];
  fields: string[];
  reasons: string[];
  confidence: number;
}

interface BaselineProvenance {
  schemaVersion: string;
  pipelineVersion: string;
  entryKey: string;
  sourceHash: string;
  taskHash: string;
  translation: Record<string, unknown>;
  deterministicValidation: FrenchAdaptiveValidation;
  review: Record<string, unknown>;
  reviewedValidation: FrenchAdaptiveValidation;
  arbitration: Record<string, unknown> | null;
  finalHash: string;
}

interface RevisionInput {
  task: FrenchAdaptiveTask;
  baselineFinal: FrenchAdaptiveFinalRecord;
  baselineDraft: FrenchAdaptiveDraft;
  triageTask: CoreTriageTask;
  decision: CoreTriageDecision;
}

interface ReviewInput extends RevisionInput {
  translatorRevision: FrenchAdaptiveReview;
  translation: FrenchAdaptiveDraft;
  validation: FrenchAdaptiveValidation;
}

interface ArbitrationInput extends ReviewInput {
  review: FrenchAdaptiveReview;
  reviewedDraft: FrenchAdaptiveDraft;
  reviewedValidation: FrenchAdaptiveValidation;
}

export interface Batch<T> {
  id: string;
  items: T[];
  inputHash: string;
}

interface Pointer {
  batchId: string;
  promptVersion: string;
  model: string;
  reasoningEffort: string;
  responseHash: string;
  recovery?: StageRecovery;
}

export interface StageRecovery {
  mode: "batch-salvage" | "isolated-retry" | "deterministic-fallback";
  parentBatchId: string;
  parentError: string;
  isolatedBatchId?: string;
  isolatedError?: string;
  fallbackCandidate?: "baseline" | "translator" | "reviewer";
}

export interface BatchExecution<R> {
  values: R[];
  responseHash: string;
  partial?: {
    error: string;
    unresolvedKeys: string[];
  };
}

export interface RecoveredBatchValue<R> {
  value: R;
  responseHash: string;
  recovery: StageRecovery;
}

export interface JsonlRecord<T> {
  raw: string;
  value: T;
}

interface Options {
  tasksPath: string;
  decisionsPath: string;
  baselineRoot: string;
  outputRoot: string;
  codexBinary: string;
  codexHome: string;
  translatorModel: string;
  translatorReasoning: string;
  reviewerModel: string;
  reviewerReasoning: string;
  arbiterModel: string;
  arbiterReasoning: string;
  concurrency: number;
  maxAttempts: number;
  timeoutMs: number;
  limit: number | null;
}

const PIPELINE_VERSION = "lexicon-v3-french-core-targeted-revision@2";
const TRANSLATOR_PROMPT_VERSION =
  "lexicon-v3-french-core-targeted-translator@1";
const REVIEWER_PROMPT_VERSION = "lexicon-v3-french-core-targeted-reviewer@1";
const ARBITER_PROMPT_VERSION = "lexicon-v3-french-core-targeted-arbiter@1";
const DEFAULT_BASELINE =
  "outputs/lexicon-v3/fr-runs/lexicon-v3-en-2026-07-14.4/fr-adaptive/full";

export async function runLexiconV3FrenchCoreTargetedRevision(
  options: Options
): Promise<object> {
  assertOptions(options);
  ensureFrenchCodexImmutableBinary({ requestedPath: options.codexBinary });
  const runtime = assertFrenchCodexImmutableBinary(options.codexBinary);
  mkdirSync(options.outputRoot, { recursive: true });
  const release = acquireRunLock(resolve(options.outputRoot, "runner.lock"));
  try {
    return await runUnlocked(options, runtime);
  } finally {
    release();
  }
}

async function runUnlocked(
  options: Options,
  runtime: { version: string; sha256: string }
): Promise<object> {
  const triageTasks = readJsonl<CoreTriageTask>(options.tasksPath);
  const triageDecisions = readJsonl<CoreTriageDecision>(options.decisionsPath);
  const baselineTasks = readJsonlRecords<FrenchAdaptiveTask>(
    resolve(options.baselineRoot, "tasks.jsonl")
  );
  const baselineFinals = readJsonlRecords<FrenchAdaptiveFinalRecord>(
    resolve(options.baselineRoot, "final.jsonl")
  );
  const baselineProvenance = readJsonlRecords<BaselineProvenance>(
    resolve(options.baselineRoot, "provenance.jsonl")
  );
  const baselineTranslations = indexByEntryKey(
    readJsonl<FrenchAdaptiveDraft>(
      resolve(options.baselineRoot, "translations.jsonl")
    )
  );
  const baselineReviews = indexByEntryKey(
    readJsonl<FrenchAdaptiveReview>(
      resolve(options.baselineRoot, "reviews.jsonl")
    )
  );
  const baselineArbitrations = indexByEntryKey(
    readJsonl<FrenchAdaptiveArbitration>(
      resolve(options.baselineRoot, "arbitrations.jsonl")
    )
  );

  assertBaselineCoverage(baselineTasks, baselineFinals, baselineProvenance);
  const taskBySourceId = new Map(
    baselineTasks.map((record) => [
      record.value.identity.stepEntryId,
      record.value
    ])
  );
  const finalByKey = indexRecordsByEntryKey(baselineFinals);
  const decisionByKey = validateTriageCoverage(triageTasks, triageDecisions);
  const allSelected = triageTasks
    .filter(
      (triageTask) => required(decisionByKey, triageTask.key).verdict !== "keep"
    )
    .map((triageTask) => {
      const task = required(taskBySourceId, triageTask.sourceId);
      const baselineFinal = required(finalByKey, task.entryKey).value;
      assertTriageLineage(triageTask, task, baselineFinal);
      const baselineDraft = reconstructBaselineDraft({
        task,
        final: baselineFinal,
        translation: required(baselineTranslations, task.entryKey),
        review: required(baselineReviews, task.entryKey),
        arbitration: baselineArbitrations.get(task.entryKey) ?? null
      });
      return {
        task,
        baselineFinal,
        baselineDraft,
        triageTask,
        decision: required(decisionByKey, triageTask.key)
      } satisfies RevisionInput;
    });
  const selected =
    options.limit === null ? allSelected : allSelected.slice(0, options.limit);
  if (selected.length === 0) {
    throw new Error("french-core-targeted-empty-selection");
  }
  installJsonl(resolve(options.outputRoot, "selected.jsonl"), selected);

  const translator = await runStage({
    stage: "translator",
    items: selected,
    options,
    runtime,
    model: options.translatorModel,
    reasoningEffort: options.translatorReasoning,
    promptVersion: TRANSLATOR_PROMPT_VERSION,
    prompt: translatorPrompt,
    schema: revisionSchema,
    parse: parseTranslatorRevisions,
    retryIsolated: false,
    fallback: (item, error) =>
      translatorFallback(item, error, options.translatorModel)
  });
  const translatorRevisionByKey = indexByEntryKey(translator.values);
  installJsonl(
    resolve(options.outputRoot, "translator-revisions.jsonl"),
    translator.values
  );

  const reviewInputs = selected.map((input) => {
    const translatorRevision = required(
      translatorRevisionByKey,
      input.task.entryKey
    );
    const translation = applyFrenchAdaptiveReview(
      input.task,
      input.baselineDraft,
      translatorRevision
    );
    const validation = validateFrenchAdaptiveDraft({
      task: input.task,
      draft: translation,
      model: options.translatorModel
    });
    return {
      ...input,
      translatorRevision,
      translation,
      validation
    } satisfies ReviewInput;
  });
  installJsonl(
    resolve(options.outputRoot, "translation-validations.jsonl"),
    reviewInputs.map((input) => ({
      entryKey: input.task.entryKey,
      sourceHash: input.task.sourceHash,
      translationHash: frenchAdaptiveTranslationHash(input.translation),
      validation: input.validation
    }))
  );

  const reviewer = await runStage({
    stage: "reviewer",
    items: reviewInputs,
    options,
    runtime,
    model: options.reviewerModel,
    reasoningEffort: options.reviewerReasoning,
    promptVersion: REVIEWER_PROMPT_VERSION,
    prompt: reviewerPrompt,
    schema: revisionSchema,
    parse: parseReviews,
    fallback: (item, error) =>
      reviewerFallback(item, error, options.reviewerModel)
  });
  const reviewByKey = indexByEntryKey(reviewer.values);
  installJsonl(resolve(options.outputRoot, "reviews.jsonl"), reviewer.values);

  const arbitrationInputs: ArbitrationInput[] = reviewInputs.map((input) => {
    const review = required(reviewByKey, input.task.entryKey);
    const reviewedDraft = applyFrenchAdaptiveReview(
      input.task,
      input.translation,
      review
    );
    const reviewedValidation = validateFrenchAdaptiveDraft({
      task: input.task,
      draft: reviewedDraft,
      model: options.reviewerModel
    });
    return { ...input, review, reviewedDraft, reviewedValidation };
  });
  installJsonl(
    resolve(options.outputRoot, "review-validations.jsonl"),
    arbitrationInputs.map((input) => ({
      entryKey: input.task.entryKey,
      sourceHash: input.task.sourceHash,
      reviewHash: frenchAdaptiveReviewHash(input.review),
      validation: input.reviewedValidation
    }))
  );
  const needsArbitration = arbitrationInputs.filter((input) =>
    coreTargetedNeedsArbitration(input)
  );
  const arbiter = needsArbitration.length
    ? await runStage<ArbitrationInput, FrenchAdaptiveArbitration>({
        stage: "arbiter",
        items: needsArbitration,
        options,
        runtime,
        model: options.arbiterModel,
        reasoningEffort: options.arbiterReasoning,
        promptVersion: ARBITER_PROMPT_VERSION,
        prompt: arbiterPrompt,
        schema: arbitrationSchema,
        parse: (raw, items) =>
          parseArbitrations(raw, items, options.arbiterModel),
        fallback: (item, error) =>
          arbiterFallback(item, error, options.arbiterModel)
      })
    : { values: [] as FrenchAdaptiveArbitration[], pointers: new Map() };
  const arbitrationByKey = indexByEntryKey(arbiter.values);
  installJsonl(
    resolve(options.outputRoot, "arbitrations.jsonl"),
    arbiter.values
  );

  const finalReplacement = new Map<string, string>();
  const provenanceReplacement = new Map<string, string>();
  const provenanceByKey = indexRecordsByEntryKey(baselineProvenance);
  for (const input of arbitrationInputs) {
    const arbitration = arbitrationByKey.get(input.task.entryKey) ?? null;
    const final = buildFrenchAdaptiveFinalRecord({
      task: input.task,
      translation: input.translation,
      review: input.review,
      reviewedDraft: input.reviewedDraft,
      arbitration,
      model: arbitration ? options.arbiterModel : options.reviewerModel
    });
    if (!final.validation.valid) {
      throw new Error(
        `french-core-targeted-refuse-invalid-final:${input.task.entryKey}:${final.validation.issues.map((issue) => issue.code).join(",")}`
      );
    }
    const chosenDraft = arbitration?.finalDraft ?? input.reviewedDraft;
    const revisionDecision = arbitration?.verdict ?? "translator";
    finalReplacement.set(input.task.entryKey, JSON.stringify(final));

    const baseline = required(provenanceByKey, input.task.entryKey).value;
    const {
      translation: baselineTranslation,
      review: baselineReview,
      arbitration: baselineArbitration,
      ...baselineCore
    } = baseline;
    const revisedProvenance = {
      ...baselineCore,
      schemaVersion: "lexicon-v3-french-core-targeted-provenance@1",
      pipelineVersion: PIPELINE_VERSION,
      baselinePipelineVersion: baseline.pipelineVersion,
      baselineFinalHash: input.baselineFinal.finalHash,
      baselineProvenanceHash: hashFrenchInternalJson(baseline),
      baselineStages: {
        translation: baselineTranslation,
        review: baselineReview,
        arbitration: baselineArbitration
      },
      selectionReasons: {
        triageVerdict: input.decision.verdict,
        issueCodes: input.decision.issueCodes,
        fields: input.decision.fields,
        reasons: input.decision.reasons,
        confidence: input.decision.confidence,
        deterministicIssues: input.triageTask.deterministicIssues
      },
      translatorRevision: {
        ...required(translator.pointers, input.task.entryKey),
        verdict: input.translatorRevision.verdict,
        revisionHash: frenchAdaptiveReviewHash(input.translatorRevision),
        translationHash: frenchAdaptiveTranslationHash(input.translation)
      },
      deterministicValidation: input.validation,
      review: {
        ...required(reviewer.pointers, input.task.entryKey),
        verdict: input.review.verdict,
        reviewHash: frenchAdaptiveReviewHash(input.review)
      },
      reviewedValidation: input.reviewedValidation,
      arbitration: arbitration
        ? {
            ...required(arbiter.pointers, input.task.entryKey),
            verdict: arbitration.verdict,
            arbitrationHash: hashFrenchInternalJson(arbitration)
          }
        : null,
      finalConfidence: chosenDraft.confidence,
      revisionDecision,
      finalHash: final.finalHash
    };
    provenanceReplacement.set(
      input.task.entryKey,
      JSON.stringify(revisedProvenance)
    );
  }

  const finalText = overlayJsonlByEntryKey(baselineFinals, finalReplacement);
  const provenanceText = overlayJsonlByEntryKey(
    baselineProvenance,
    provenanceReplacement
  );
  assertKeepLinesByteIdentical(baselineFinals, finalText, finalReplacement);
  assertKeepLinesByteIdentical(
    baselineProvenance,
    provenanceText,
    provenanceReplacement
  );
  const finalPath = resolve(options.outputRoot, "final.jsonl");
  const provenancePath = resolve(options.outputRoot, "provenance.jsonl");
  installText(finalPath, finalText);
  installText(provenancePath, provenanceText);

  const content = {
    schemaVersion: "lexicon-v3-french-core-targeted-run@1",
    pipelineVersion: PIPELINE_VERSION,
    status: selected.length === allSelected.length ? "complete" : "partial",
    entries: baselineFinals.length,
    triaged: triageTasks.length,
    selected: allSelected.length,
    revised: selected.length,
    keptByteIdentical: baselineFinals.length - selected.length,
    arbitrated: arbiter.values.length,
    recovery: {
      translator: recoveryCounts(translator.pointers),
      reviewer: recoveryCounts(reviewer.pointers),
      arbiter: recoveryCounts(arbiter.pointers)
    },
    invalidFinal: [...finalReplacement.values()]
      .map((line) => JSON.parse(line) as FrenchAdaptiveFinalRecord)
      .filter((record) => !record.validation.valid).length,
    baseline: {
      root: options.baselineRoot,
      finalSha256: sha256File(resolve(options.baselineRoot, "final.jsonl")),
      provenanceSha256: sha256File(
        resolve(options.baselineRoot, "provenance.jsonl")
      )
    },
    triage: {
      tasksSha256: sha256File(options.tasksPath),
      decisionsSha256: sha256File(options.decisionsPath)
    },
    outputs: {
      final: fileArtifact(finalPath),
      provenance: fileArtifact(provenancePath)
    },
    execution: {
      internalCodex: true,
      cel: "forbidden",
      aiGateway: "forbidden",
      runtime,
      translator: {
        promptVersion: TRANSLATOR_PROMPT_VERSION,
        model: options.translatorModel,
        reasoningEffort: options.translatorReasoning,
        selectedOnly: true
      },
      reviewer: {
        promptVersion: REVIEWER_PROMPT_VERSION,
        model: options.reviewerModel,
        reasoningEffort: options.reviewerReasoning,
        selectedOnly: true
      },
      arbiter: {
        promptVersion: ARBITER_PROMPT_VERSION,
        model: options.arbiterModel,
        reasoningEffort: options.arbiterReasoning,
        conditional: true
      }
    }
  };
  const summary = { ...content, runHash: hashFrenchInternalJson(content) };
  installText(
    resolve(options.outputRoot, "summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`
  );
  return summary;
}

export function reconstructBaselineDraft(input: {
  task: FrenchAdaptiveTask;
  final: FrenchAdaptiveFinalRecord;
  translation: FrenchAdaptiveDraft;
  review: FrenchAdaptiveReview;
  arbitration: FrenchAdaptiveArbitration | null;
}): FrenchAdaptiveDraft {
  const draft = input.arbitration
    ? input.arbitration.finalDraft
    : applyFrenchAdaptiveReview(input.task, input.translation, input.review);
  if (
    input.final.entryKey !== input.task.entryKey ||
    input.final.sourceHash !== input.task.sourceHash ||
    frenchAdaptiveTranslationHash(draft) !== input.final.finalHash ||
    draft.glossFr !== input.final.glossFr ||
    draft.meaningSegmentsFr.length !== input.final.meaningSegmentsFr.length ||
    draft.meaningSegmentsFr.some(
      (segment, index) =>
        segment.id !== input.final.meaningSegmentsFr[index]?.id ||
        segment.text !== input.final.meaningSegmentsFr[index]?.text
    )
  ) {
    throw new Error(
      `french-core-targeted-baseline-drift:${input.task.entryKey}`
    );
  }
  return draft;
}

export function coreTargetedNeedsArbitration(input: ArbitrationInput): boolean {
  return (
    input.decision.verdict === "escalate" ||
    input.translatorRevision.verdict === "escalate" ||
    frenchAdaptiveNeedsArbitration({
      task: input.task,
      translatorValidation: input.validation,
      review: input.review,
      reviewedValidation: input.reviewedValidation
    })
  );
}

export function overlayJsonlByEntryKey<T extends { entryKey: string }>(
  baseline: JsonlRecord<T>[],
  replacements: ReadonlyMap<string, string>
): string {
  const seen = new Set<string>();
  const lines = baseline.map((record) => {
    const replacement = replacements.get(record.value.entryKey);
    if (replacement === undefined) return record.raw;
    seen.add(record.value.entryKey);
    return replacement;
  });
  if (seen.size !== replacements.size) {
    throw new Error(
      `french-core-targeted-overlay-coverage:${seen.size}:${replacements.size}`
    );
  }
  return `${lines.join("\n")}\n`;
}

function assertTriageLineage(
  triage: CoreTriageTask,
  task: FrenchAdaptiveTask,
  final: FrenchAdaptiveFinalRecord
): void {
  const stepCode = task.entryKey.split(":", 2)[1] ?? "";
  const fields = triage.fields;
  const sourceHash = sha256(
    [
      task.english.gloss,
      task.english.meaningHtml,
      task.english.meaningHtml
    ].join("\n")
  );
  const translationHash = sha256(
    [final.glossFr, final.meaningFr, final.meaningHtmlFr].join("\n")
  );
  if (
    triage.stepCode !== stepCode ||
    triage.key !== stepCode ||
    triage.sourceId !== task.identity.stepEntryId ||
    triage.sourceHash !== sourceHash ||
    triage.translationHash !== translationHash ||
    fields.gloss?.english !== task.english.gloss ||
    fields.meaning?.english !== task.english.meaningHtml ||
    fields.meaningHtml?.english !== task.english.meaningHtml ||
    fields.gloss?.french !== final.glossFr ||
    fields.meaning?.french !== final.meaningFr ||
    fields.meaningHtml?.french !== final.meaningHtmlFr
  ) {
    throw new Error(`french-core-targeted-triage-drift:${triage.key}`);
  }
}

function validateTriageCoverage(
  tasks: CoreTriageTask[],
  decisions: CoreTriageDecision[]
): Map<string, CoreTriageDecision> {
  const taskKeys = new Set(tasks.map((task) => task.key));
  const byKey = new Map<string, CoreTriageDecision>();
  for (const decision of decisions) {
    if (
      byKey.has(decision.key) ||
      !taskKeys.has(decision.key) ||
      !["keep", "correct", "escalate"].includes(decision.verdict) ||
      !Array.isArray(decision.issueCodes) ||
      !Array.isArray(decision.fields) ||
      !Array.isArray(decision.reasons) ||
      !Number.isFinite(decision.confidence) ||
      decision.confidence < 0 ||
      decision.confidence > 1
    ) {
      throw new Error(`french-core-targeted-invalid-triage:${decision.key}`);
    }
    byKey.set(decision.key, decision);
  }
  if (byKey.size !== tasks.length) {
    throw new Error(
      `french-core-targeted-triage-coverage:${byKey.size}:${tasks.length}`
    );
  }
  return byKey;
}

function assertBaselineCoverage(
  tasks: JsonlRecord<FrenchAdaptiveTask>[],
  finals: JsonlRecord<FrenchAdaptiveFinalRecord>[],
  provenance: JsonlRecord<BaselineProvenance>[]
): void {
  const taskKeys = tasks.map((record) => record.value.entryKey);
  const finalKeys = finals.map((record) => record.value.entryKey);
  const provenanceKeys = provenance.map((record) => record.value.entryKey);
  if (
    new Set(taskKeys).size !== taskKeys.length ||
    taskKeys.length !== finalKeys.length ||
    taskKeys.length !== provenanceKeys.length ||
    taskKeys.some(
      (key, index) => key !== finalKeys[index] || key !== provenanceKeys[index]
    )
  ) {
    throw new Error("french-core-targeted-baseline-coverage");
  }
}

function assertKeepLinesByteIdentical<T extends { entryKey: string }>(
  baseline: JsonlRecord<T>[],
  overlayText: string,
  replacements: ReadonlyMap<string, string>
): void {
  const body = overlayText.endsWith("\n")
    ? overlayText.slice(0, -1)
    : overlayText;
  const lines = body.split(/\r?\n/u);
  if (lines.length !== baseline.length) {
    throw new Error("french-core-targeted-overlay-count");
  }
  for (let index = 0; index < baseline.length; index += 1) {
    const record = baseline[index]!;
    if (
      !replacements.has(record.value.entryKey) &&
      lines[index] !== record.raw
    ) {
      throw new Error(
        `french-core-targeted-keep-mutated:${record.value.entryKey}`
      );
    }
  }
}

async function runStage<T, R extends { entryKey: string }>(input: {
  stage: Stage;
  items: T[];
  options: Options;
  runtime: { version: string; sha256: string };
  model: string;
  reasoningEffort: string;
  promptVersion: string;
  prompt: (items: T[]) => string;
  schema: (items: T[]) => object;
  parse: (raw: unknown, items: T[]) => R[];
  retryIsolated?: boolean;
  fallback: (
    item: T,
    error: Error
  ) => { value: R; candidate: StageRecovery["fallbackCandidate"] };
}): Promise<{ values: R[]; pointers: Map<string, Pointer> }> {
  const batches = buildBatches(input.items, input.stage);
  const results = new Array<R[]>(batches.length);
  const pointers = new Map<string, Pointer>();
  let cursor = 0;
  const worker = async (): Promise<void> => {
    for (;;) {
      const index = cursor++;
      if (index >= batches.length) return;
      const batch = batches[index]!;
      let execution: BatchExecution<R> | null = null;
      try {
        execution = await executeStageBatch(input, batch);
      } catch (error) {
        const parentError = asError(error);
        process.stdout.write(
          `${JSON.stringify({
            event: "isolate",
            stage: input.stage,
            batchId: batch.id,
            entries: batch.items.length,
            error: parentError.message
          })}\n`
        );
        const recovered = await recoverFailedBatchAsSingletons({
          batch,
          parentError,
          key: (item) => (item as { task: FrenchAdaptiveTask }).task.entryKey,
          execute: (isolated) =>
            input.retryIsolated === false || batch.items.length === 1
              ? Promise.reject(parentError)
              : executeStageBatch(input, isolated),
          fallback: input.fallback
        });
        results[index] = recovered.map((result) => result.value);
        for (const result of recovered) {
          pointers.set(result.value.entryKey, {
            ...pointerFor(
              input,
              result.recovery.isolatedBatchId ?? batch.id,
              result.responseHash
            ),
            recovery: result.recovery
          });
        }
      }
      if (execution) {
        if (execution.partial) {
          process.stdout.write(
            `${JSON.stringify({
              event: "partial-salvage",
              stage: input.stage,
              batchId: batch.id,
              salvaged: execution.values.length,
              isolated: execution.partial.unresolvedKeys.length,
              error: execution.partial.error
            })}\n`
          );
        }
        const recovered = execution.partial
          ? await recoverFailedBatchAsSingletons({
              batch,
              parentError: new Error(execution.partial.error),
              onlyKeys: new Set(execution.partial.unresolvedKeys),
              key: (item) =>
                (item as { task: FrenchAdaptiveTask }).task.entryKey,
              execute: (isolated) =>
                input.retryIsolated === false
                  ? Promise.reject(new Error(execution.partial!.error))
                  : executeStageBatch(input, isolated),
              fallback: input.fallback
            })
          : [];
        results[index] = mergeBatchValuesInInputOrder({
          batch,
          key: (item) => (item as { task: FrenchAdaptiveTask }).task.entryKey,
          values: [...execution.values, ...recovered.map((item) => item.value)]
        });
        for (const value of execution.values) {
          pointers.set(value.entryKey, {
            ...pointerFor(input, batch.id, execution.responseHash),
            ...(execution.partial
              ? {
                  recovery: {
                    mode: "batch-salvage" as const,
                    parentBatchId: batch.id,
                    parentError: execution.partial.error
                  }
                }
              : {})
          });
        }
        for (const result of recovered) {
          pointers.set(result.value.entryKey, {
            ...pointerFor(
              input,
              result.recovery.isolatedBatchId ?? batch.id,
              result.responseHash
            ),
            recovery: result.recovery
          });
        }
      }
      process.stdout.write(
        `${JSON.stringify({
          event: "completed",
          stage: input.stage,
          batchId: batch.id,
          entries: results[index]!.length
        })}\n`
      );
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.min(input.options.concurrency, batches.length) },
      worker
    )
  );
  const flat = results.flat();
  if (flat.length !== input.items.length || pointers.size !== flat.length) {
    throw new Error(`french-core-targeted-stage-coverage:${input.stage}`);
  }
  return { values: flat, pointers };
}

async function executeStageBatch<T, R extends { entryKey: string }>(
  input: {
    stage: Stage;
    options: Options;
    runtime: { version: string; sha256: string };
    model: string;
    reasoningEffort: string;
    promptVersion: string;
    prompt: (items: T[]) => string;
    schema: (items: T[]) => object;
    parse: (raw: unknown, items: T[]) => R[];
  },
  batch: Batch<T>
): Promise<BatchExecution<R>> {
  const directory = resolve(
    input.options.outputRoot,
    "agents",
    input.stage,
    batch.id
  );
  mkdirSync(directory, { recursive: true });
  const prompt = input.prompt(batch.items);
  const schema = input.schema(batch.items);
  const schemaPath = resolve(directory, "output.schema.json");
  const resultPath = resolve(directory, "result.json");
  const runPath = resolve(directory, "run.json");
  const schemaText = `${JSON.stringify(schema, null, 2)}\n`;
  installText(schemaPath, schemaText);
  const lineage = {
    stage: input.stage,
    batchId: batch.id,
    promptVersion: input.promptVersion,
    promptHash: sha256(prompt),
    inputHash: batch.inputHash,
    schemaHash: sha256(schemaText),
    model: input.model,
    reasoningEffort: input.reasoningEffort,
    runtimeSha256: input.runtime.sha256
  };
  if (existsSync(resultPath) && existsSync(runPath)) {
    try {
      const prior = JSON.parse(readFileSync(runPath, "utf8")) as Record<
        string,
        unknown
      >;
      if (
        Object.entries(lineage).every(([key, value]) => prior[key] === value) &&
        prior.responseHash === sha256File(resultPath)
      ) {
        const raw = JSON.parse(readFileSync(resultPath, "utf8")) as unknown;
        try {
          return {
            values: input.parse(raw, batch.items),
            responseHash: prior.responseHash as string
          };
        } catch (error) {
          const partial = salvageStructurallyReadableBatch({
            raw,
            items: batch.items,
            key: (item) => (item as { task: FrenchAdaptiveTask }).task.entryKey,
            rootKey: input.stage === "arbiter" ? "arbitrations" : "revisions",
            parse: input.parse
          });
          if (partial.values.length === 0) throw error;
          const partialError = asError(error).message;
          installText(
            runPath,
            `${JSON.stringify(
              {
                ...prior,
                outcome: "partial-salvage",
                partialSalvage: {
                  error: partialError,
                  salvagedKeys: partial.values.map((value) => value.entryKey),
                  unresolvedKeys: partial.unresolvedKeys
                }
              },
              null,
              2
            )}\n`
          );
          return {
            values: partial.values,
            responseHash: prior.responseHash as string,
            partial: {
              error: partialError,
              unresolvedKeys: partial.unresolvedKeys
            }
          };
        }
      }
    } catch (error) {
      process.stdout.write(
        `${JSON.stringify({
          event: "invalid-cache",
          stage: input.stage,
          batchId: batch.id,
          error: asError(error).message
        })}\n`
      );
    }
  }
  let lastError = new Error(`french-core-targeted-batch:${batch.id}`);
  for (let attempt = 1; attempt <= input.options.maxAttempts; attempt += 1) {
    try {
      const execution = await executeAgent({
        options: input.options,
        directory,
        attempt,
        prompt,
        schemaPath,
        model: input.model,
        reasoningEffort: input.reasoningEffort
      });
      const raw = JSON.parse(execution.responseText) as unknown;
      let values: R[];
      let partial: { error: string; unresolvedKeys: string[] } | undefined;
      try {
        values = input.parse(raw, batch.items);
      } catch (error) {
        if (attempt !== input.options.maxAttempts) throw error;
        const salvaged = salvageStructurallyReadableBatch({
          raw,
          items: batch.items,
          key: (item) => (item as { task: FrenchAdaptiveTask }).task.entryKey,
          rootKey: input.stage === "arbiter" ? "arbitrations" : "revisions",
          parse: input.parse
        });
        if (salvaged.values.length === 0) throw error;
        values = salvaged.values;
        partial = {
          error: asError(error).message,
          unresolvedKeys: salvaged.unresolvedKeys
        };
      }
      installText(resultPath, `${JSON.stringify(raw, null, 2)}\n`);
      const responseHash = sha256File(resultPath);
      installText(
        runPath,
        `${JSON.stringify(
          {
            schemaVersion: "lexicon-v3-french-core-targeted-agent-run@1",
            ...lineage,
            runtimeVersion: input.runtime.version,
            responseHash,
            threadId: execution.threadId,
            usage: execution.usage,
            startedAt: execution.startedAt,
            completedAt: execution.completedAt,
            outcome: partial ? "partial-salvage" : "complete",
            ...(partial
              ? {
                  partialSalvage: {
                    error: partial.error,
                    salvagedKeys: values.map((value) => value.entryKey),
                    unresolvedKeys: partial.unresolvedKeys
                  }
                }
              : {})
          },
          null,
          2
        )}\n`
      );
      return { values, responseHash, partial };
    } catch (error) {
      lastError = asError(error);
      process.stdout.write(
        `${JSON.stringify({
          event: "retry",
          stage: input.stage,
          batchId: batch.id,
          attempt,
          error: lastError.message
        })}\n`
      );
    }
  }
  throw lastError;
}

export async function recoverFailedBatchAsSingletons<
  T,
  R extends { entryKey: string }
>(input: {
  batch: Batch<T>;
  parentError: Error;
  onlyKeys?: ReadonlySet<string>;
  key: (item: T) => string;
  execute: (batch: Batch<T>) => Promise<BatchExecution<R>>;
  fallback: (
    item: T,
    error: Error
  ) => { value: R; candidate: StageRecovery["fallbackCandidate"] };
}): Promise<RecoveredBatchValue<R>[]> {
  const recovered: RecoveredBatchValue<R>[] = [];
  for (const [index, item] of input.batch.items.entries()) {
    if (input.onlyKeys && !input.onlyKeys.has(input.key(item))) continue;
    const isolatedBatch = makeIsolatedBatch(
      input.batch,
      index,
      item,
      input.key(item)
    );
    try {
      const execution = await input.execute(isolatedBatch);
      if (
        execution.values.length !== 1 ||
        execution.values[0]?.entryKey !== input.key(item)
      ) {
        throw new Error(
          `french-core-targeted-isolated-coverage:${input.key(item)}`
        );
      }
      recovered.push({
        value: execution.values[0],
        responseHash: execution.responseHash,
        recovery: {
          mode: "isolated-retry",
          parentBatchId: input.batch.id,
          parentError: input.parentError.message,
          isolatedBatchId: isolatedBatch.id
        }
      });
    } catch (error) {
      const isolatedError = asError(error);
      const fallback = input.fallback(item, isolatedError);
      if (fallback.value.entryKey !== input.key(item)) {
        throw new Error(
          `french-core-targeted-fallback-coverage:${input.key(item)}`
        );
      }
      recovered.push({
        value: fallback.value,
        responseHash: hashFrenchInternalJson(fallback.value),
        recovery: {
          mode: "deterministic-fallback",
          parentBatchId: input.batch.id,
          parentError: input.parentError.message,
          isolatedBatchId: isolatedBatch.id,
          isolatedError: isolatedError.message,
          fallbackCandidate: fallback.candidate
        }
      });
    }
  }
  return recovered;
}

export function salvageStructurallyReadableBatch<
  T,
  R extends { entryKey: string }
>(input: {
  raw: unknown;
  items: T[];
  key: (item: T) => string;
  rootKey: string;
  parse: (raw: unknown, items: T[]) => R[];
}): { values: R[]; unresolvedKeys: string[] } {
  if (!input.raw || typeof input.raw !== "object" || Array.isArray(input.raw)) {
    throw new Error("french-core-targeted-unsalvageable-root");
  }
  const candidates = (input.raw as Record<string, unknown>)[input.rootKey];
  if (!Array.isArray(candidates)) {
    throw new Error(
      `french-core-targeted-unsalvageable-array:${input.rootKey}`
    );
  }
  const expected = new Map(input.items.map((item) => [input.key(item), item]));
  const byKey = new Map<string, unknown[]>();
  for (const candidate of candidates) {
    if (
      !candidate ||
      typeof candidate !== "object" ||
      Array.isArray(candidate)
    ) {
      continue;
    }
    const key = (candidate as Record<string, unknown>).entryKey;
    if (typeof key !== "string" || !expected.has(key)) continue;
    const group = byKey.get(key) ?? [];
    group.push(candidate);
    byKey.set(key, group);
  }
  const values: R[] = [];
  const unresolvedKeys: string[] = [];
  for (const item of input.items) {
    const key = input.key(item);
    const candidatesForKey = byKey.get(key) ?? [];
    if (candidatesForKey.length !== 1) {
      unresolvedKeys.push(key);
      continue;
    }
    try {
      const parsed = input.parse({ [input.rootKey]: candidatesForKey }, [item]);
      if (parsed.length !== 1 || parsed[0]?.entryKey !== key) {
        throw new Error(`french-core-targeted-salvage-coverage:${key}`);
      }
      values.push(parsed[0]);
    } catch {
      unresolvedKeys.push(key);
    }
  }
  return { values, unresolvedKeys };
}

export function mergeBatchValuesInInputOrder<
  T,
  R extends { entryKey: string }
>(input: { batch: Batch<T>; key: (item: T) => string; values: R[] }): R[] {
  const byKey = new Map<string, R>();
  for (const value of input.values) {
    if (byKey.has(value.entryKey)) {
      throw new Error(
        `french-core-targeted-merged-duplicate:${value.entryKey}`
      );
    }
    byKey.set(value.entryKey, value);
  }
  const ordered = input.batch.items.map((item) => {
    const key = input.key(item);
    const value = byKey.get(key);
    if (!value) {
      throw new Error(`french-core-targeted-merged-missing:${key}`);
    }
    byKey.delete(key);
    return value;
  });
  if (byKey.size !== 0) {
    throw new Error(
      `french-core-targeted-merged-extra:${[...byKey.keys()].join(",")}`
    );
  }
  return ordered;
}

function makeIsolatedBatch<T>(
  parent: Batch<T>,
  index: number,
  item: T,
  key: string
): Batch<T> {
  return {
    id: `${parent.id}--isolated-${String(index + 1).padStart(3, "0")}-${sha256(key).slice(0, 10)}`,
    items: [item],
    inputHash: hashFrenchInternalJson([item])
  };
}

function pointerFor(
  input: {
    promptVersion: string;
    model: string;
    reasoningEffort: string;
  },
  batchId: string,
  responseHash: string
): Pointer {
  return {
    batchId,
    promptVersion: input.promptVersion,
    model: input.model,
    reasoningEffort: input.reasoningEffort,
    responseHash
  };
}

function recoveryCounts(pointers: ReadonlyMap<string, Pointer>): {
  batchSalvage: number;
  isolatedRetry: number;
  deterministicFallback: number;
} {
  let batchSalvage = 0;
  let isolatedRetry = 0;
  let deterministicFallback = 0;
  for (const pointer of pointers.values()) {
    if (pointer.recovery?.mode === "batch-salvage") batchSalvage += 1;
    if (pointer.recovery?.mode === "isolated-retry") isolatedRetry += 1;
    if (pointer.recovery?.mode === "deterministic-fallback") {
      deterministicFallback += 1;
    }
  }
  return { batchSalvage, isolatedRetry, deterministicFallback };
}

async function executeAgent(input: {
  options: Options;
  directory: string;
  attempt: number;
  prompt: string;
  schemaPath: string;
  model: string;
  reasoningEffort: string;
}): Promise<{
  threadId: string;
  responseText: string;
  usage: unknown;
  startedAt: string;
  completedAt: string;
}> {
  const prefix = `attempt-${String(input.attempt).padStart(3, "0")}`;
  const responsePath = resolve(input.directory, `${prefix}-response.json`);
  rmSync(responsePath, { force: true });
  const executable = prepareFrenchCodexImmutableExecution(
    input.options.codexBinary
  );
  const startedAt = new Date().toISOString();
  const args = frenchCodexProposerExecArgs({
    model: input.model,
    reasoningEffort: input.reasoningEffort,
    schemaPath: input.schemaPath,
    responsePath,
    cwd: input.directory
  });
  const child = spawn(executable.executionPath, args, {
    cwd: input.directory,
    env: buildSealedFrenchCodexProposerEnvironment(input.options.codexHome),
    stdio: ["pipe", "pipe", "pipe"],
    detached: process.platform !== "win32"
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => (stdout += chunk));
  child.stderr.on("data", (chunk: string) => (stderr += chunk));
  child.stdin.end(input.prompt);
  let timedOut = false;
  const exitCode = await new Promise<number>((resolveExit, reject) => {
    let killTimer: ReturnType<typeof setTimeout> | undefined;
    const timeout = setTimeout(() => {
      timedOut = true;
      signalGroup(child.pid, "SIGTERM");
      killTimer = setTimeout(() => signalGroup(child.pid, "SIGKILL"), 2_000);
    }, input.options.timeoutMs);
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (killTimer) clearTimeout(killTimer);
      resolveExit(code ?? -1);
    });
  }).finally(() => {
    try {
      executable.assertUnchanged();
    } finally {
      executable.dispose();
    }
  });
  const completedAt = new Date().toISOString();
  installText(resolve(input.directory, `${prefix}-events.jsonl`), stdout);
  installText(resolve(input.directory, `${prefix}-stderr.log`), stderr);
  if (timedOut || exitCode !== 0 || !existsSync(responsePath)) {
    throw new Error(
      timedOut
        ? `french-core-targeted-timeout:${input.options.timeoutMs}`
        : `french-core-targeted-agent-exit:${exitCode}:${stderr.slice(-500)}`
    );
  }
  const responseText = readFileSync(responsePath, "utf8");
  const events = parseFrenchCodexAgentEvents(stdout, responseText);
  return {
    threadId: events.threadId,
    responseText,
    usage: events.usage,
    startedAt,
    completedAt
  };
}

function translatorPrompt(inputs: RevisionInput[]): string {
  return `Tu corriges uniquement des traductions françaises STEP déjà triées correct/escalate. STEP anglais est l'unique autorité éditoriale. Ne reconstruis, ne challenge et n'enrichis jamais la notice.

Compare chaque baselineDraft à task.english et aux selectionReasons. verdict=accept si le triage était un faux positif et la version est déjà publiable; verdict=correct avec le patch minimal sinon; verdict=escalate seulement pour une ambiguïté réelle. Ne rends jamais une seconde traduction complète. Préserve ids de segments, grec/hébreu, codes Strong, références, nombres, sigles et entités imposées. Aucun HTML ni Markdown.
<revision_items_jsonl>
${inputs
  .map((input) =>
    JSON.stringify({
      task: frenchAdaptiveTaskForAgent(input.task),
      baselineDraft: draftForAgent(input.baselineDraft),
      selectionReasons: selectionReasons(input)
    })
  )
  .join("\n")}
</revision_items_jsonl>`;
}

function reviewerPrompt(inputs: ReviewInput[]): string {
  return `Tu es le réviseur français final d'une correction ciblée du lexique STEP. Compare la candidateTranslation à STEP anglais et au baseline. Si elle est fidèle, complète, naturelle et mécaniquement sûre, verdict=accept avec patch vide. Sinon verdict=correct avec le patch minimal. verdict=escalate seulement si le dossier reste réellement ambigu. Ne réécris pas ce qui est déjà bon, n'ajoute aucune information externe, aucun HTML ni Markdown.
<review_items_jsonl>
${inputs
  .map((input) =>
    JSON.stringify({
      task: frenchAdaptiveTaskForAgent(input.task),
      baselineDraft: draftForAgent(input.baselineDraft),
      candidateTranslation: draftForAgent(input.translation),
      deterministicIssues: input.validation.issues,
      selectionReasons: selectionReasons(input)
    })
  )
  .join("\n")}
</review_items_jsonl>`;
}

function arbiterPrompt(inputs: ArbitrationInput[]): string {
  return `Tu es l'arbitre conditionnel d'une révision française STEP. Tu ne reçois que des désaccords, erreurs déterministes ou entrées à risque. STEP anglais est l'unique autorité.

Choisis translator si candidateTranslation est la meilleure, reviewer si reviewedDraft est la meilleure, corrected seulement si une ultime correction est indispensable. finalDraft doit être complet, mais strictement dérivé des variantes et de STEP. Préserve tous les ids, littéraux et entités; aucun HTML ni Markdown.
<arbitration_items_jsonl>
${inputs
  .map((input) =>
    JSON.stringify({
      task: frenchAdaptiveTaskForAgent(input.task),
      baselineDraft: draftForAgent(input.baselineDraft),
      candidateTranslation: draftForAgent(input.translation),
      translationIssues: input.validation.issues,
      review: reviewForAgent(input.review),
      reviewedDraft: draftForAgent(input.reviewedDraft),
      reviewedIssues: input.reviewedValidation.issues,
      selectionReasons: selectionReasons(input)
    })
  )
  .join("\n")}
</arbitration_items_jsonl>`;
}

function selectionReasons(input: RevisionInput): object {
  return {
    triageVerdict: input.decision.verdict,
    issueCodes: input.decision.issueCodes,
    fields: input.decision.fields,
    reasons: input.decision.reasons,
    confidence: input.decision.confidence,
    deterministicIssues: input.triageTask.deterministicIssues
  };
}

function draftForAgent(draft: FrenchAdaptiveDraft): object {
  return {
    entryKey: draft.entryKey,
    glossFr: draft.glossFr,
    meaningSegmentsFr: draft.meaningSegmentsFr,
    entityMentionsFr: draft.entityMentionsFr,
    confidence: draft.confidence
  };
}

function reviewForAgent(review: FrenchAdaptiveReview): object {
  return {
    entryKey: review.entryKey,
    verdict: review.verdict,
    reasons: review.reasons,
    patch: review.patch
  };
}

function revisionSchema(items: unknown[]): object {
  return {
    type: "object",
    additionalProperties: false,
    required: ["revisions"],
    properties: {
      revisions: {
        type: "array",
        minItems: items.length,
        maxItems: items.length,
        items: reviewSchema()
      }
    }
  };
}

function arbitrationSchema(items: unknown[]): object {
  return {
    type: "object",
    additionalProperties: false,
    required: ["arbitrations"],
    properties: {
      arbitrations: {
        type: "array",
        minItems: items.length,
        maxItems: items.length,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["entryKey", "verdict", "reasons", "finalDraft"],
          properties: {
            entryKey: { type: "string" },
            verdict: {
              type: "string",
              enum: ["translator", "reviewer", "corrected"]
            },
            reasons: { type: "array", items: { type: "string" } },
            finalDraft: draftSchema()
          }
        }
      }
    }
  };
}

function reviewSchema(): object {
  return {
    type: "object",
    additionalProperties: false,
    required: ["entryKey", "verdict", "reasons", "patch"],
    properties: {
      entryKey: { type: "string" },
      verdict: {
        type: "string",
        enum: ["accept", "correct", "escalate"]
      },
      reasons: { type: "array", items: { type: "string" } },
      patch: {
        type: "object",
        additionalProperties: false,
        required: ["gloss", "segmentUpdates", "entityMentions", "confidence"],
        properties: {
          gloss: patchStringSchema(),
          segmentUpdates: { type: "array", items: segmentSchema() },
          entityMentions: {
            type: "object",
            additionalProperties: false,
            required: ["apply", "value"],
            properties: {
              apply: { type: "boolean" },
              value: { type: "array", items: entityMentionSchema() }
            }
          },
          confidence: {
            type: "object",
            additionalProperties: false,
            required: ["apply", "value"],
            properties: {
              apply: { type: "boolean" },
              value: { type: "number", minimum: 0, maximum: 1 }
            }
          }
        }
      }
    }
  };
}

function draftSchema(): object {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "entryKey",
      "glossFr",
      "meaningSegmentsFr",
      "entityMentionsFr",
      "confidence"
    ],
    properties: {
      entryKey: { type: "string" },
      glossFr: { type: "string", minLength: 1 },
      meaningSegmentsFr: { type: "array", items: segmentSchema() },
      entityMentionsFr: { type: "array", items: entityMentionSchema() },
      confidence: { type: "number", minimum: 0, maximum: 1 }
    }
  };
}

function patchStringSchema(): object {
  return {
    type: "object",
    additionalProperties: false,
    required: ["apply", "value"],
    properties: {
      apply: { type: "boolean" },
      value: { type: "string" }
    }
  };
}

function segmentSchema(): object {
  return {
    type: "object",
    additionalProperties: false,
    required: ["id", "text"],
    properties: {
      id: { type: "string" },
      text: { type: "string", minLength: 1 }
    }
  };
}

function entityMentionSchema(): object {
  return {
    type: "object",
    additionalProperties: false,
    required: ["mentionId", "segmentId", "chosenFrenchForm"],
    properties: {
      mentionId: { type: "string" },
      segmentId: { type: "string" },
      chosenFrenchForm: { type: "string", minLength: 1 }
    }
  };
}

function parseTranslatorRevisions(
  raw: unknown,
  inputs: RevisionInput[]
): FrenchAdaptiveReview[] {
  return parseRevisionArray(raw, inputs, (input) => input.baselineDraft);
}

function parseReviews(
  raw: unknown,
  inputs: ReviewInput[]
): FrenchAdaptiveReview[] {
  return parseRevisionArray(raw, inputs, (input) => input.translation);
}

export function translatorFallback(
  input: RevisionInput,
  error: Error,
  model: string
): { value: FrenchAdaptiveReview; candidate: "baseline" } {
  assertValidFallbackDraft(input.task, input.baselineDraft, model, "baseline");
  return {
    value: {
      ...noOpReview(
        input.task,
        input.baselineDraft,
        `Repli déterministe sur la baseline validée après épuisement des retries; arbitrage requis: ${error.message}`
      ),
      verdict: "escalate"
    },
    candidate: "baseline"
  };
}

export function reviewerFallback(
  input: ReviewInput,
  error: Error,
  model: string
): {
  value: FrenchAdaptiveReview;
  candidate: "translator" | "baseline";
} {
  if (isValidFallbackDraft(input.task, input.translation, model)) {
    return {
      value: {
        ...noOpReview(
          input.task,
          input.translation,
          `Repli déterministe sur la candidate traducteur validée après épuisement des retries; arbitrage requis: ${error.message}`
        ),
        verdict: "escalate"
      },
      candidate: "translator"
    };
  }
  assertValidFallbackDraft(input.task, input.baselineDraft, model, "baseline");
  return {
    value: reviewReplacingDraft(
      input.task,
      input.translation,
      input.baselineDraft,
      `Repli déterministe sur la baseline validée après épuisement des retries: ${error.message}`
    ),
    candidate: "baseline"
  };
}

export function arbiterFallback(
  input: ArbitrationInput,
  error: Error,
  model: string
): {
  value: FrenchAdaptiveArbitration;
  candidate: "reviewer" | "translator" | "baseline";
} {
  const selected = isValidFallbackDraft(input.task, input.reviewedDraft, model)
    ? {
        verdict: "reviewer" as const,
        candidate: "reviewer" as const,
        draft: input.reviewedDraft
      }
    : isValidFallbackDraft(input.task, input.translation, model)
      ? {
          verdict: "translator" as const,
          candidate: "translator" as const,
          draft: input.translation
        }
      : isValidFallbackDraft(input.task, input.baselineDraft, model)
        ? {
            verdict: "corrected" as const,
            candidate: "baseline" as const,
            draft: input.baselineDraft
          }
        : null;
  if (!selected) {
    throw new Error(
      `french-core-targeted-no-valid-fallback:${input.task.entryKey}:arbiter:${error.message}`
    );
  }
  return {
    value: {
      schemaVersion: FRENCH_ADAPTIVE_ARBITRATION_SCHEMA_VERSION,
      entryKey: input.task.entryKey,
      sourceHash: input.task.sourceHash,
      translatorHash: frenchAdaptiveTranslationHash(input.translation),
      reviewerHash: frenchAdaptiveReviewHash(input.review),
      verdict: selected.verdict,
      reasons: [
        `Repli déterministe sur ${selected.candidate} validé après épuisement des retries: ${error.message}`
      ],
      finalDraft: selected.draft
    },
    candidate: selected.candidate
  };
}

function noOpReview(
  task: FrenchAdaptiveTask,
  draft: FrenchAdaptiveDraft,
  reason: string
): FrenchAdaptiveReview {
  return {
    schemaVersion: FRENCH_ADAPTIVE_REVIEW_SCHEMA_VERSION,
    entryKey: task.entryKey,
    sourceHash: task.sourceHash,
    translationHash: frenchAdaptiveTranslationHash(draft),
    verdict: "accept",
    reasons: [reason],
    patch: {
      gloss: { apply: false, value: "" },
      segmentUpdates: [],
      entityMentions: { apply: false, value: [] },
      confidence: { apply: false, value: 0 }
    }
  };
}

function reviewReplacingDraft(
  task: FrenchAdaptiveTask,
  from: FrenchAdaptiveDraft,
  to: FrenchAdaptiveDraft,
  reason: string
): FrenchAdaptiveReview {
  const replaceGloss = from.glossFr !== to.glossFr;
  const replaceEntities =
    hashFrenchInternalJson(from.entityMentionsFr) !==
    hashFrenchInternalJson(to.entityMentionsFr);
  const replaceConfidence = from.confidence !== to.confidence;
  return {
    schemaVersion: FRENCH_ADAPTIVE_REVIEW_SCHEMA_VERSION,
    entryKey: task.entryKey,
    sourceHash: task.sourceHash,
    translationHash: frenchAdaptiveTranslationHash(from),
    verdict: "correct",
    reasons: [reason],
    patch: {
      gloss: { apply: replaceGloss, value: replaceGloss ? to.glossFr : "" },
      segmentUpdates: to.meaningSegmentsFr.filter(
        (segment, index) =>
          from.meaningSegmentsFr[index]?.id !== segment.id ||
          from.meaningSegmentsFr[index]?.text !== segment.text
      ),
      entityMentions: {
        apply: replaceEntities,
        value: replaceEntities ? to.entityMentionsFr : []
      },
      confidence: {
        apply: replaceConfidence,
        value: replaceConfidence ? to.confidence : 0
      }
    }
  };
}

function assertValidFallbackDraft(
  task: FrenchAdaptiveTask,
  draft: FrenchAdaptiveDraft,
  model: string,
  candidate: string
): void {
  if (!isValidFallbackDraft(task, draft, model)) {
    throw new Error(
      `french-core-targeted-no-valid-fallback:${task.entryKey}:${candidate}`
    );
  }
}

function isValidFallbackDraft(
  task: FrenchAdaptiveTask,
  draft: FrenchAdaptiveDraft,
  model: string
): boolean {
  return validateFrenchAdaptiveDraft({ task, draft, model }).valid;
}

function parseRevisionArray<T extends RevisionInput>(
  raw: unknown,
  inputs: T[],
  draft: (input: T) => FrenchAdaptiveDraft
): FrenchAdaptiveReview[] {
  const values = rootArray(raw, "revisions", inputs.length);
  const aligned = alignByEntryKey(
    values,
    inputs.map((input) => input.task.entryKey)
  );
  return aligned.map((value, index) =>
    parseRevision(value, inputs[index]!.task, draft(inputs[index]!))
  );
}

function parseRevision(
  raw: unknown,
  task: FrenchAdaptiveTask,
  draft: FrenchAdaptiveDraft
): FrenchAdaptiveReview {
  assertObject(raw, "revision");
  assertExactKeys(raw, ["entryKey", "verdict", "reasons", "patch"]);
  const revision = {
    ...raw,
    schemaVersion: FRENCH_ADAPTIVE_REVIEW_SCHEMA_VERSION,
    sourceHash: task.sourceHash,
    translationHash: frenchAdaptiveTranslationHash(draft)
  } as FrenchAdaptiveReview;
  if (
    revision.entryKey !== task.entryKey ||
    !["accept", "correct", "escalate"].includes(revision.verdict) ||
    !Array.isArray(revision.reasons) ||
    revision.reasons.some((reason) => typeof reason !== "string")
  ) {
    throw new Error(`french-core-targeted-invalid-revision:${task.entryKey}`);
  }
  assertPatch(revision, task);
  const normalized = {
    ...revision,
    patch: {
      ...revision.patch,
      segmentUpdates: revision.patch.segmentUpdates.map((segment) => ({
        ...segment,
        text: normalizeFrenchAdaptiveMechanicalStepArtifacts(segment.text)
      }))
    }
  };
  applyFrenchAdaptiveReview(task, draft, normalized);
  return normalized;
}

function assertPatch(
  revision: FrenchAdaptiveReview,
  task: FrenchAdaptiveTask
): void {
  const patch = revision.patch;
  if (
    !patch ||
    typeof patch !== "object" ||
    typeof patch.gloss?.apply !== "boolean" ||
    typeof patch.gloss?.value !== "string" ||
    !Array.isArray(patch.segmentUpdates) ||
    typeof patch.entityMentions?.apply !== "boolean" ||
    !Array.isArray(patch.entityMentions?.value) ||
    typeof patch.confidence?.apply !== "boolean" ||
    typeof patch.confidence?.value !== "number" ||
    patch.confidence.value < 0 ||
    patch.confidence.value > 1 ||
    (!patch.gloss.apply && patch.gloss.value !== "") ||
    (!patch.entityMentions.apply && patch.entityMentions.value.length !== 0) ||
    (!patch.confidence.apply && patch.confidence.value !== 0)
  ) {
    throw new Error(`french-core-targeted-invalid-patch:${task.entryKey}`);
  }
}

function parseArbitrations(
  raw: unknown,
  inputs: ArbitrationInput[],
  model: string
): FrenchAdaptiveArbitration[] {
  const values = alignByEntryKey(
    rootArray(raw, "arbitrations", inputs.length),
    inputs.map((input) => input.task.entryKey)
  );
  return values.map((value, index) => {
    const input = inputs[index]!;
    assertObject(value, "arbitration");
    assertExactKeys(value, ["entryKey", "verdict", "reasons", "finalDraft"]);
    const arbitration = {
      ...value,
      schemaVersion: FRENCH_ADAPTIVE_ARBITRATION_SCHEMA_VERSION,
      sourceHash: input.task.sourceHash,
      translatorHash: frenchAdaptiveTranslationHash(input.translation),
      reviewerHash: frenchAdaptiveReviewHash(input.review),
      finalDraft: parseDraft(value.finalDraft, input.task)
    } as FrenchAdaptiveArbitration;
    if (
      arbitration.entryKey !== input.task.entryKey ||
      !["translator", "reviewer", "corrected"].includes(arbitration.verdict) ||
      !Array.isArray(arbitration.reasons)
    ) {
      throw new Error(
        `french-core-targeted-invalid-arbitration:${input.task.entryKey}`
      );
    }
    const validation = validateFrenchAdaptiveDraft({
      task: input.task,
      draft: arbitration.finalDraft,
      model
    });
    if (validation.valid) return arbitration;
    const fallback =
      arbitration.verdict === "translator" && input.validation.valid
        ? { verdict: "translator" as const, draft: input.translation }
        : arbitration.verdict === "reviewer" && input.reviewedValidation.valid
          ? { verdict: "reviewer" as const, draft: input.reviewedDraft }
          : input.reviewedValidation.valid
            ? { verdict: "reviewer" as const, draft: input.reviewedDraft }
            : input.validation.valid
              ? { verdict: "translator" as const, draft: input.translation }
              : null;
    if (!fallback) {
      throw new Error(
        `french-core-targeted-invalid-arbitrated:${input.task.entryKey}:${validation.issues.map((issue) => issue.code).join(",")}`
      );
    }
    return {
      ...arbitration,
      verdict: fallback.verdict,
      reasons: [
        ...arbitration.reasons,
        `Repli déterministe vers ${fallback.verdict}; la proposition arbitrée échouait: ${validation.issues.map((issue) => issue.code).join(",")}.`
      ],
      finalDraft: fallback.draft
    };
  });
}

function parseDraft(
  raw: unknown,
  task: FrenchAdaptiveTask
): FrenchAdaptiveDraft {
  assertObject(raw, "draft");
  assertExactKeys(raw, [
    "entryKey",
    "glossFr",
    "meaningSegmentsFr",
    "entityMentionsFr",
    "confidence"
  ]);
  const draft = {
    ...raw,
    schemaVersion: FRENCH_ADAPTIVE_DRAFT_SCHEMA_VERSION,
    sourceHash: task.sourceHash
  } as FrenchAdaptiveDraft;
  const expectedIds = task.english.segments.map((segment) => segment.id);
  if (
    draft.entryKey !== task.entryKey ||
    typeof draft.glossFr !== "string" ||
    !draft.glossFr.trim() ||
    !Array.isArray(draft.meaningSegmentsFr) ||
    draft.meaningSegmentsFr.length !== expectedIds.length ||
    draft.meaningSegmentsFr.some(
      (segment, index) =>
        segment.id !== expectedIds[index] ||
        typeof segment.text !== "string" ||
        !segment.text.trim()
    ) ||
    !Array.isArray(draft.entityMentionsFr) ||
    !Number.isFinite(draft.confidence) ||
    draft.confidence < 0 ||
    draft.confidence > 1
  ) {
    throw new Error(`french-core-targeted-invalid-draft:${task.entryKey}`);
  }
  return {
    ...draft,
    meaningSegmentsFr: draft.meaningSegmentsFr.map((segment) => ({
      ...segment,
      text: normalizeFrenchAdaptiveMechanicalStepArtifacts(segment.text)
    }))
  };
}

function rootArray(raw: unknown, key: string, count: number): unknown[] {
  assertObject(raw, "root");
  const values = raw[key];
  if (
    Object.keys(raw).length !== 1 ||
    !Array.isArray(values) ||
    values.length !== count
  ) {
    throw new Error(`french-core-targeted-invalid-root:${key}`);
  }
  return values;
}

function alignByEntryKey(values: unknown[], keys: string[]): unknown[] {
  const byKey = new Map<string, unknown>();
  for (const value of values) {
    assertObject(value, "entry");
    if (typeof value.entryKey !== "string" || byKey.has(value.entryKey)) {
      throw new Error("french-core-targeted-invalid-entry-key");
    }
    byKey.set(value.entryKey, value);
  }
  if (byKey.size !== keys.length || keys.some((key) => !byKey.has(key))) {
    throw new Error("french-core-targeted-agent-coverage");
  }
  return keys.map((key) => required(byKey, key));
}

function buildBatches<T>(items: T[], stage: Stage): Batch<T>[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const task = (item as { task: FrenchAdaptiveTask }).task;
    const group = groups.get(task.size) ?? [];
    group.push(item);
    groups.set(task.size, group);
  }
  const limits = { short: 36, medium: 12, long: 3, very_long: 1 } as const;
  const batches: Batch<T>[] = [];
  for (const size of ["short", "medium", "long", "very_long"] as const) {
    const group = groups.get(size) ?? [];
    let current: T[] = [];
    let bytes = 0;
    let serial = 0;
    for (const item of group) {
      const itemBytes = Buffer.byteLength(JSON.stringify(item));
      if (
        current.length &&
        (current.length >= limits[size] || bytes + itemBytes > 240_000)
      ) {
        serial += 1;
        batches.push(makeBatch(stage, size, serial, current));
        current = [];
        bytes = 0;
      }
      current.push(item);
      bytes += itemBytes;
    }
    if (current.length) {
      serial += 1;
      batches.push(makeBatch(stage, size, serial, current));
    }
  }
  return batches;
}

function makeBatch<T>(
  stage: Stage,
  size: string,
  serial: number,
  items: T[]
): Batch<T> {
  return {
    id: `${stage}-${size}-${String(serial).padStart(5, "0")}`,
    items,
    inputHash: hashFrenchInternalJson(items)
  };
}

function readJsonlRecords<T>(path: string): JsonlRecord<T>[] {
  return readFileSync(path, "utf8")
    .split(/\r?\n/u)
    .filter((line) => line.trim())
    .map((raw) => ({ raw, value: JSON.parse(raw) as T }));
}

function readJsonl<T>(path: string): T[] {
  return readJsonlRecords<T>(path).map((record) => record.value);
}

function indexByEntryKey<T extends { entryKey: string }>(
  values: T[]
): Map<string, T> {
  const result = new Map<string, T>();
  for (const value of values) {
    if (result.has(value.entryKey)) {
      throw new Error(`french-core-targeted-duplicate:${value.entryKey}`);
    }
    result.set(value.entryKey, value);
  }
  return result;
}

function indexRecordsByEntryKey<T extends { entryKey: string }>(
  values: JsonlRecord<T>[]
): Map<string, JsonlRecord<T>> {
  const result = new Map<string, JsonlRecord<T>>();
  for (const value of values) {
    if (result.has(value.value.entryKey)) {
      throw new Error(`french-core-targeted-duplicate:${value.value.entryKey}`);
    }
    result.set(value.value.entryKey, value);
  }
  return result;
}

function installJsonl(path: string, values: unknown[]): void {
  installText(
    path,
    values.length
      ? `${values.map((value) => JSON.stringify(value)).join("\n")}\n`
      : ""
  );
}

function installText(path: string, value: string): void {
  mkdirSync(dirname(path), { recursive: true });
  if (existsSync(path) && readFileSync(path, "utf8") === value) return;
  const temporary = `${path}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(temporary, value, "utf8");
  renameSync(temporary, path);
}

function acquireRunLock(path: string): () => void {
  mkdirSync(dirname(path), { recursive: true });
  try {
    const descriptor = openSync(path, "wx", 0o600);
    writeFileSync(
      descriptor,
      `${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })}\n`
    );
    closeSync(descriptor);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const owner = JSON.parse(readFileSync(path, "utf8")) as { pid: number };
    try {
      process.kill(owner.pid, 0);
      throw new Error(`french-core-targeted-run-locked:${owner.pid}`);
    } catch (probe) {
      if (
        (probe as Error).message.startsWith("french-core-targeted-run-locked")
      ) {
        throw probe;
      }
      rmSync(path, { force: true });
      return acquireRunLock(path);
    }
  }
  return () => rmSync(path, { force: true });
}

function signalGroup(pid: number | undefined, signal: NodeJS.Signals): void {
  if (!pid) return;
  try {
    process.kill(process.platform === "win32" ? pid : -pid, signal);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
}

function fileArtifact(path: string): {
  path: string;
  sha256: string;
  bytes: number;
} {
  const contents = readFileSync(path);
  return { path, sha256: sha256(contents), bytes: contents.byteLength };
}

function assertOptions(options: Options): void {
  const requiredPaths = [
    options.tasksPath,
    options.decisionsPath,
    options.codexBinary,
    resolve(options.codexHome, "auth.json"),
    ...[
      "tasks.jsonl",
      "translations.jsonl",
      "reviews.jsonl",
      "arbitrations.jsonl",
      "final.jsonl",
      "provenance.jsonl"
    ].map((file) => resolve(options.baselineRoot, file))
  ];
  if (
    requiredPaths.some((path) => !existsSync(path)) ||
    !Number.isInteger(options.concurrency) ||
    options.concurrency < 1 ||
    options.concurrency > 16 ||
    !Number.isInteger(options.maxAttempts) ||
    options.maxAttempts < 1 ||
    options.maxAttempts > 5 ||
    !Number.isSafeInteger(options.timeoutMs) ||
    options.timeoutMs < 1 ||
    (options.limit !== null &&
      (!Number.isInteger(options.limit) || options.limit < 1))
  ) {
    throw new Error("invalid-french-core-targeted-options");
  }
}

export function parseFrenchCoreTargetedArgs(args: readonly string[]): Options {
  const values = new Map<string, string>();
  const allowed = new Set([
    "tasks",
    "decisions",
    "baseline-root",
    "output-root",
    "codex-binary",
    "codex-home",
    "translator-model",
    "translator-reasoning",
    "reviewer-model",
    "reviewer-reasoning",
    "arbiter-model",
    "arbiter-reasoning",
    "concurrency",
    "max-attempts",
    "timeout-ms",
    "limit"
  ]);
  for (let index = 0; index < args.length; index += 2) {
    const token = args[index] ?? "";
    const value = args[index + 1];
    if (!token.startsWith("--"))
      throw new Error(`unexpected-argument:${token}`);
    const key = token.slice(2);
    if (!allowed.has(key)) throw new Error(`unknown-option:${key}`);
    if (!value || value.startsWith("--"))
      throw new Error(`missing-value:${key}`);
    if (values.has(key)) throw new Error(`duplicate-option:${key}`);
    values.set(key, value);
  }
  const integer = (key: string, fallback: number): number => {
    const value = values.get(key);
    if (value === undefined) return fallback;
    if (!/^[1-9]\d*$/u.test(value)) throw new Error(`invalid-integer:${key}`);
    return Number(value);
  };
  return {
    tasksPath: resolve(
      values.get("tasks") ??
        "outputs/lexicon-fr-quality/triage/core/tasks.jsonl"
    ),
    decisionsPath: resolve(
      values.get("decisions") ??
        "outputs/lexicon-fr-quality/triage/core/decisions.jsonl"
    ),
    baselineRoot: resolve(values.get("baseline-root") ?? DEFAULT_BASELINE),
    outputRoot: resolve(
      values.get("output-root") ?? "outputs/lexicon-fr-quality/revision/core"
    ),
    codexBinary: resolve(
      values.get("codex-binary") ?? FRENCH_CODEX_IMMUTABLE_BINARY_PATH
    ),
    codexHome: resolve(values.get("codex-home") ?? "/Users/stephane/.codex"),
    translatorModel: values.get("translator-model") ?? "gpt-5.6-sol",
    translatorReasoning: values.get("translator-reasoning") ?? "low",
    reviewerModel: values.get("reviewer-model") ?? "gpt-5.6-terra",
    reviewerReasoning: values.get("reviewer-reasoning") ?? "medium",
    arbiterModel: values.get("arbiter-model") ?? "gpt-5.6-sol",
    arbiterReasoning: values.get("arbiter-reasoning") ?? "medium",
    concurrency: integer("concurrency", 12),
    maxAttempts: integer("max-attempts", 4),
    timeoutMs: integer("timeout-ms", 1_200_000),
    limit: values.has("limit") ? integer("limit", 1) : null
  };
}

function assertObject(
  value: unknown,
  label: string
): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`french-core-targeted-invalid-${label}`);
  }
}

function assertExactKeys(value: Record<string, unknown>, keys: string[]): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    throw new Error("french-core-targeted-invalid-keys");
  }
}

function required<K, V>(map: ReadonlyMap<K, V>, key: K): V {
  const value = map.get(key);
  if (value === undefined) {
    throw new Error(`french-core-targeted-missing:${String(key)}`);
  }
  return value;
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function sha256File(path: string): string {
  return sha256(readFileSync(path));
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? "")).href) {
  runLexiconV3FrenchCoreTargetedRevision(
    parseFrenchCoreTargetedArgs(process.argv.slice(2))
  )
    .then((summary) =>
      process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
    )
    .catch((error: unknown) => {
      process.stderr.write(
        `${basename(process.argv[1] ?? "runLexiconV3FrenchCoreTargetedRevision")}: ${
          error instanceof Error ? error.stack : String(error)
        }\n`
      );
      process.exitCode = 1;
    });
}
