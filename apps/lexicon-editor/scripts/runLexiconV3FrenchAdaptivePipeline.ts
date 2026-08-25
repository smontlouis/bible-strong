import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import {
  closeSync,
  createReadStream,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";

import {
  buildSealedFrenchCodexProposerEnvironment,
  frenchCodexProposerExecArgs,
  parseFrenchCodexAgentEvents
} from "./runLexiconV3FrenchCodexProposerBatch.js";
import {
  assertFrenchCodexImmutableBinary,
  ensureFrenchCodexImmutableBinary,
  prepareFrenchCodexImmutableExecution
} from "../src/lexiconV3/frenchCodexImmutableBinary.js";
import {
  FRENCH_ADAPTIVE_ARBITRATION_SCHEMA_VERSION,
  FRENCH_ADAPTIVE_DRAFT_SCHEMA_VERSION,
  FRENCH_ADAPTIVE_PIPELINE_VERSION,
  FRENCH_ADAPTIVE_REVIEW_SCHEMA_VERSION,
  applyFrenchAdaptiveReview,
  buildFrenchAdaptiveFinalRecord,
  buildFrenchAdaptiveTask,
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
import {
  FRENCH_INTERNAL_PROPOSER_VIEW_SCHEMA_VERSION,
  type FrenchInternalProposerAView
} from "../src/lexiconV3/frenchInternalWork.js";

export const FRENCH_ADAPTIVE_RUN_SCHEMA_VERSION =
  "lexicon-v3-french-adaptive-run@1" as const;
export const FRENCH_ADAPTIVE_TRANSLATOR_PROMPT_VERSION =
  "lexicon-v3-french-adaptive-translator@2" as const;
export const FRENCH_ADAPTIVE_REVIEWER_PROMPT_VERSION =
  "lexicon-v3-french-adaptive-reviewer@2" as const;
export const FRENCH_ADAPTIVE_ARBITER_PROMPT_VERSION =
  "lexicon-v3-french-adaptive-arbiter@2" as const;

const SHA256 = /^[a-f0-9]{64}$/u;

type Mode = "pilot" | "full";
type Stage = "translator" | "reviewer" | "arbiter";

interface Options {
  mode: Mode;
  viewsPath: string;
  pilotManifestPath: string;
  pilotReviewPath: string;
  outputRoot: string;
  codexBinary: string;
  codexHome: string;
  codexVersion: string;
  codexSha256: string;
  translatorModel: string;
  translatorReasoning: string;
  reviewerModel: string;
  reviewerReasoning: string;
  arbiterModel: string;
  arbiterReasoning: string;
  concurrency: number;
  maxAttempts: number;
  timeoutMs: number;
}

interface AgentUsage {
  input_tokens?: number;
  cached_input_tokens?: number;
  output_tokens?: number;
  reasoning_output_tokens?: number;
}

interface AgentRun {
  schemaVersion: "lexicon-v3-french-adaptive-agent-run@1";
  stage: Stage;
  batchId: string;
  promptVersion: string;
  promptHash: string;
  inputHash: string;
  schemaHash: string;
  model: string;
  reasoningEffort: string;
  executor: { version: string; sha256: string };
  threadId: string;
  responseHash: string;
  usage: AgentUsage | null;
  startedAt: string;
  completedAt: string;
  runHash: string;
}

interface Batch<T> {
  id: string;
  items: T[];
  inputHash: string;
}

interface PilotReviewRecord {
  entryKey: string;
  status: string;
  arbiter: { proposal: LegacyProposal };
  auditor: { verdict: string; reasons: string[] };
}

interface LegacyProposal {
  entryKey: string;
  derivedFromEnglishHash: string;
  model: string;
  glossFr: string;
  meaningSegmentsFr: Array<{ id: string; text: string }>;
  entityMentionsFr: Array<{
    mentionId: string;
    segmentId: string;
    chosenFrenchForm: string;
  }>;
  confidence: number;
}

interface ReviewInput {
  task: FrenchAdaptiveTask;
  translation: FrenchAdaptiveDraft;
  validation: FrenchAdaptiveValidation;
  priorDiagnostics: string[];
}

interface ArbitrationInput {
  task: FrenchAdaptiveTask;
  translation: FrenchAdaptiveDraft;
  translationValidation: FrenchAdaptiveValidation;
  review: FrenchAdaptiveReview;
  reviewedDraft: FrenchAdaptiveDraft;
  reviewedValidation: FrenchAdaptiveValidation;
}

interface EntryAgentPointer {
  batchId: string;
  promptVersion: string;
  model: string;
  reasoningEffort: string;
  responseHash: string;
}

export async function runLexiconV3FrenchAdaptivePipeline(
  options: Options
): Promise<object> {
  assertOptions(options);
  ensureFrenchCodexImmutableBinary({ requestedPath: options.codexBinary });
  const identity = assertFrenchCodexImmutableBinary(options.codexBinary);
  if (
    identity.version !== options.codexVersion ||
    identity.sha256 !== options.codexSha256
  ) {
    throw new Error(
      `french-adaptive-runtime-unpinned:${identity.version}:${identity.sha256}`
    );
  }
  mkdirSync(options.outputRoot, { recursive: true });
  const release = acquireRunLock(resolve(options.outputRoot, "runner.lock"));
  try {
    return await runUnlocked(options);
  } finally {
    release();
  }
}

async function runUnlocked(options: Options): Promise<object> {
  const tasksPath = resolve(options.outputRoot, "tasks.jsonl");
  const requestedKeys =
    options.mode === "pilot"
      ? readPilotKeys(options.pilotManifestPath)
      : null;
  const tasks = await prepareTasks({
    viewsPath: options.viewsPath,
    outputPath: tasksPath,
    requestedKeys
  });
  const taskByKey = new Map(tasks.map((task) => [task.entryKey, task]));
  const pilotRecords =
    options.mode === "pilot"
      ? readPilotReviews(options.pilotReviewPath)
      : new Map<string, PilotReviewRecord>();

  let translations: FrenchAdaptiveDraft[];
  let translationPointers: Map<string, EntryAgentPointer>;
  if (options.mode === "pilot") {
    translations = importPilotTranslations(tasks, pilotRecords);
    const translationPath = resolve(options.outputRoot, "translations.jsonl");
    installText(
      translationPath,
      `${translations.map((value) => JSON.stringify(value)).join("\n")}\n`
    );
    translationPointers = new Map(
      translations.map((translation) => [
        translation.entryKey,
        {
          batchId: "imported-pilot",
          promptVersion: "legacy-pilot-import@1",
          model:
            pilotRecords.get(translation.entryKey)?.arbiter.proposal.model ??
            "unknown",
          reasoningEffort: "imported",
          responseHash: frenchAdaptiveTranslationHash(translation)
        }
      ])
    );
  } else {
    const translationInputs = tasks;
    const reused = loadReusableTranslations(options, translationInputs);
    const translationByKey = new Map(reused.translations);
    translationPointers = new Map(reused.pointers);
    const pendingInputs = translationInputs.filter(
      (task) => !translationByKey.has(task.entryKey)
    );
    process.stdout.write(
      `${JSON.stringify({
        event: "entry-cache",
        stage: "translator",
        reusedEntries: translationByKey.size,
        pendingEntries: pendingInputs.length,
        totalEntries: translationInputs.length
      })}\n`
    );
    if (pendingInputs.length > 0) {
      const stage = await runAgentStage({
        options,
        stage: "translator",
        batches: buildBatches(pendingInputs, "translator"),
        promptVersion: FRENCH_ADAPTIVE_TRANSLATOR_PROMPT_VERSION,
        model: options.translatorModel,
        reasoningEffort: options.translatorReasoning,
        schema: translatorSchema,
        prompt: translatorPrompt,
        parse: (raw, items) => parseTranslations(raw, items)
      });
      for (const batch of stage.results) {
        for (const translation of batch) {
          translationByKey.set(translation.entryKey, translation);
        }
      }
      for (const [entryKey, pointer] of stage.pointers) {
        translationPointers.set(entryKey, pointer);
      }
    }
    translations = tasks.map((task) =>
      required(translationByKey, task.entryKey)
    );
    installText(
      resolve(options.outputRoot, "translations.jsonl"),
      `${translations.map((value) => JSON.stringify(value)).join("\n")}\n`
    );
  }

  const translationByKey = new Map(
    translations.map((translation) => [translation.entryKey, translation])
  );
  const translationValidations = new Map<string, FrenchAdaptiveValidation>();
  const reviewInputs: ReviewInput[] = tasks.map((task) => {
    const translation = required(translationByKey, task.entryKey);
    const validation = validateFrenchAdaptiveDraft({
      task,
      draft: translation,
      model:
        translationPointers.get(task.entryKey)?.model ?? options.translatorModel
    });
    translationValidations.set(task.entryKey, validation);
    return {
      task,
      translation,
      validation,
      priorDiagnostics:
        pilotRecords.get(task.entryKey)?.auditor.reasons ?? []
    };
  });
  writeValidationArtifact(
    resolve(options.outputRoot, "translation-validations.jsonl"),
    reviewInputs.map((input) => ({
      entryKey: input.task.entryKey,
      sourceHash: input.task.sourceHash,
      translationHash: frenchAdaptiveTranslationHash(input.translation),
      validation: input.validation
    }))
  );

  const reusedReviews = loadReusableReviews(options, reviewInputs);
  const reviewByKey = new Map(reusedReviews.reviews);
  const reviewPointers = new Map(reusedReviews.pointers);
  const pendingReviewInputs = reviewInputs.filter(
    (input) => !reviewByKey.has(input.task.entryKey)
  );
  process.stdout.write(
    `${JSON.stringify({
      event: "entry-cache",
      stage: "reviewer",
      reusedEntries: reviewByKey.size,
      pendingEntries: pendingReviewInputs.length,
      totalEntries: reviewInputs.length
    })}\n`
  );
  if (pendingReviewInputs.length > 0) {
    const reviewStage = await runAgentStage({
      options,
      stage: "reviewer",
      batches: buildBatches(pendingReviewInputs, "reviewer"),
      promptVersion: FRENCH_ADAPTIVE_REVIEWER_PROMPT_VERSION,
      model: options.reviewerModel,
      reasoningEffort: options.reviewerReasoning,
      schema: reviewerSchema,
      prompt: reviewerPrompt,
      parse: (raw, items) => parseReviews(raw, items)
    });
    for (const batch of reviewStage.results) {
      for (const review of batch) reviewByKey.set(review.entryKey, review);
    }
    for (const [entryKey, pointer] of reviewStage.pointers) {
      reviewPointers.set(entryKey, pointer);
    }
  }
  const reviews = tasks.map((task) => required(reviewByKey, task.entryKey));
  installText(
    resolve(options.outputRoot, "reviews.jsonl"),
    `${reviews.map((value) => JSON.stringify(value)).join("\n")}\n`
  );
  const reviewedDrafts = new Map<string, FrenchAdaptiveDraft>();
  const reviewedValidations = new Map<string, FrenchAdaptiveValidation>();
  const arbitrationInputs: ArbitrationInput[] = [];
  for (const task of tasks) {
    const translation = required(translationByKey, task.entryKey);
    const review = required(reviewByKey, task.entryKey);
    const reviewedDraft = applyFrenchAdaptiveReview(task, translation, review);
    const reviewedValidation = validateFrenchAdaptiveDraft({
      task,
      draft: reviewedDraft,
      model: options.reviewerModel
    });
    reviewedDrafts.set(task.entryKey, reviewedDraft);
    reviewedValidations.set(task.entryKey, reviewedValidation);
    const translationValidation = required(
      translationValidations,
      task.entryKey
    );
    if (
      frenchAdaptiveNeedsArbitration({
        task,
        translatorValidation: translationValidation,
        review,
        reviewedValidation
      })
    ) {
      arbitrationInputs.push({
        task,
        translation,
        translationValidation,
        review,
        reviewedDraft,
        reviewedValidation
      });
    }
  }
  writeValidationArtifact(
    resolve(options.outputRoot, "review-validations.jsonl"),
    tasks.map((task) => ({
      entryKey: task.entryKey,
      sourceHash: task.sourceHash,
      reviewHash: frenchAdaptiveReviewHash(required(reviewByKey, task.entryKey)),
      validation: required(reviewedValidations, task.entryKey)
    }))
  );

  let arbitrationPointers = new Map<string, EntryAgentPointer>();
  let arbitrations: FrenchAdaptiveArbitration[] = [];
  if (arbitrationInputs.length > 0) {
    // Arbitration batches are deliberately compact, but their membership can
    // move when a deterministic validator is improved. Reuse each previously
    // validated decision by entry lineage instead of invalidating every later
    // batch merely because one entry was inserted or removed.
    const reused = loadReusableArbitrations(options, arbitrationInputs);
    const arbitrationByKey = new Map(reused.arbitrations);
    arbitrationPointers = new Map(reused.pointers);
    const pendingInputs = arbitrationInputs.filter(
      (input) => !arbitrationByKey.has(input.task.entryKey)
    );
    process.stdout.write(
      `${JSON.stringify({
        event: "entry-cache",
        stage: "arbiter",
        reusedEntries: arbitrationByKey.size,
        pendingEntries: pendingInputs.length,
        totalEntries: arbitrationInputs.length
      })}\n`
    );
    if (pendingInputs.length > 0) {
      const arbitrationStage = await runAgentStage({
        options,
        stage: "arbiter",
        batches: buildBatches(pendingInputs, "arbiter"),
        promptVersion: FRENCH_ADAPTIVE_ARBITER_PROMPT_VERSION,
        model: options.arbiterModel,
        reasoningEffort: options.arbiterReasoning,
        schema: arbiterSchema,
        prompt: arbiterPrompt,
        parse: (raw, items) => parseArbitrations(raw, items, options.arbiterModel)
      });
      for (const batch of arbitrationStage.results) {
        for (const arbitration of batch) {
          arbitrationByKey.set(arbitration.entryKey, arbitration);
        }
      }
      for (const [entryKey, pointer] of arbitrationStage.pointers) {
        arbitrationPointers.set(entryKey, pointer);
      }
    }
    arbitrations = arbitrationInputs.map((input) =>
      required(arbitrationByKey, input.task.entryKey)
    );
  }
  installText(
    resolve(options.outputRoot, "arbitrations.jsonl"),
    arbitrations.length > 0
      ? `${arbitrations.map((value) => JSON.stringify(value)).join("\n")}\n`
      : ""
  );
  const arbitrationByKey = new Map(
    arbitrations.map((arbitration) => [arbitration.entryKey, arbitration])
  );

  const finals: FrenchAdaptiveFinalRecord[] = tasks.map((task) =>
    buildFrenchAdaptiveFinalRecord({
      task,
      translation: required(translationByKey, task.entryKey),
      review: required(reviewByKey, task.entryKey),
      reviewedDraft: required(reviewedDrafts, task.entryKey),
      arbitration: arbitrationByKey.get(task.entryKey) ?? null,
      model: arbitrationByKey.has(task.entryKey)
        ? options.arbiterModel
        : options.reviewerModel
    })
  );
  installText(
    resolve(options.outputRoot, "final.jsonl"),
    `${finals.map((value) => JSON.stringify(value)).join("\n")}\n`
  );
  const finalByKey = new Map(finals.map((value) => [value.entryKey, value]));

  const provenance = tasks.map((task) => {
    const translation = required(translationByKey, task.entryKey);
    const review = required(reviewByKey, task.entryKey);
    const final = required(finalByKey, task.entryKey);
    return {
      schemaVersion: "lexicon-v3-french-adaptive-provenance@1",
      pipelineVersion: FRENCH_ADAPTIVE_PIPELINE_VERSION,
      entryKey: task.entryKey,
      sourceHash: task.sourceHash,
      taskHash: task.taskHash,
      translation: {
        ...required(translationPointers, task.entryKey),
        translationHash: frenchAdaptiveTranslationHash(translation)
      },
      deterministicValidation: required(
        translationValidations,
        task.entryKey
      ),
      review: {
        ...required(reviewPointers, task.entryKey),
        verdict: review.verdict,
        reviewHash: frenchAdaptiveReviewHash(review)
      },
      reviewedValidation: required(reviewedValidations, task.entryKey),
      arbitration: arbitrationByKey.has(task.entryKey)
        ? {
            ...required(arbitrationPointers, task.entryKey),
            arbitrationHash: hashFrenchInternalJson(
              required(arbitrationByKey, task.entryKey)
            )
          }
        : null,
      finalHash: final.finalHash
    };
  });
  installText(
    resolve(options.outputRoot, "provenance.jsonl"),
    `${provenance.map((value) => JSON.stringify(value)).join("\n")}\n`
  );

  const content = {
    schemaVersion: FRENCH_ADAPTIVE_RUN_SCHEMA_VERSION,
    pipelineVersion: FRENCH_ADAPTIVE_PIPELINE_VERSION,
    mode: options.mode,
    status: "complete",
    entries: tasks.length,
    reviewed: reviews.length,
    arbitrated: arbitrations.length,
    invalidFinal: finals.filter((value) => !value.validation.valid).length,
    riskEntries: tasks.filter((task) => task.riskReasons.length > 0).length,
    sourceDigest: hashFrenchInternalJson(
      tasks.map((task) => [task.entryKey, task.sourceHash])
    ),
    finalDigest: hashFrenchInternalJson(
      finals.map((value) => [value.entryKey, value.finalHash])
    ),
    files: {
      tasks: fileArtifact(tasksPath),
      translations: fileArtifact(resolve(options.outputRoot, "translations.jsonl")),
      reviews: fileArtifact(resolve(options.outputRoot, "reviews.jsonl")),
      arbitrations: fileArtifact(resolve(options.outputRoot, "arbitrations.jsonl")),
      final: fileArtifact(resolve(options.outputRoot, "final.jsonl")),
      provenance: fileArtifact(resolve(options.outputRoot, "provenance.jsonl"))
    },
    execution: {
      internalCodex: true,
      cel: "forbidden",
      aiGateway: "forbidden",
      translator: {
        promptVersion: FRENCH_ADAPTIVE_TRANSLATOR_PROMPT_VERSION,
        model: options.translatorModel,
        reasoningEffort: options.translatorReasoning,
        skippedForImportedPilot: options.mode === "pilot"
      },
      reviewer: {
        promptVersion: FRENCH_ADAPTIVE_REVIEWER_PROMPT_VERSION,
        model: options.reviewerModel,
        reasoningEffort: options.reviewerReasoning
      },
      arbiter: {
        promptVersion: FRENCH_ADAPTIVE_ARBITER_PROMPT_VERSION,
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

async function prepareTasks(input: {
  viewsPath: string;
  outputPath: string;
  requestedKeys: string[] | null;
}): Promise<FrenchAdaptiveTask[]> {
  const requested = input.requestedKeys ? new Set(input.requestedKeys) : null;
  const taskByKey = new Map<string, FrenchAdaptiveTask>();
  const reader = createInterface({
    input: createReadStream(input.viewsPath, { encoding: "utf8" }),
    crlfDelay: Infinity
  });
  for await (const line of reader) {
    if (!line.trim()) continue;
    const view = JSON.parse(line) as FrenchInternalProposerAView;
    if (requested && !requested.has(view.entryKey)) continue;
    if (
      view.schemaVersion !== FRENCH_INTERNAL_PROPOSER_VIEW_SCHEMA_VERSION ||
      view.role !== "proposerA" ||
      view.viewKind !== "proposer_a_blind" ||
      taskByKey.has(view.entryKey)
    ) {
      throw new Error(`invalid-french-adaptive-source-view:${view.entryKey}`);
    }
    taskByKey.set(view.entryKey, buildFrenchAdaptiveTask(view));
  }
  const order = input.requestedKeys ?? [...taskByKey.keys()];
  if (
    taskByKey.size !== order.length ||
    order.some((entryKey) => !taskByKey.has(entryKey))
  ) {
    throw new Error("french-adaptive-task-coverage-mismatch");
  }
  const tasks = order.map((entryKey) => required(taskByKey, entryKey));
  installText(
    input.outputPath,
    `${tasks.map((task) => JSON.stringify(task)).join("\n")}\n`
  );
  return tasks;
}

function importPilotTranslations(
  tasks: FrenchAdaptiveTask[],
  records: Map<string, PilotReviewRecord>
): FrenchAdaptiveDraft[] {
  return tasks.map((task) => {
    const proposal = required(records, task.entryKey).arbiter.proposal;
    if (proposal.derivedFromEnglishHash !== task.sourceHash) {
      throw new Error(`french-adaptive-pilot-source-drift:${task.entryKey}`);
    }
    return {
      schemaVersion: FRENCH_ADAPTIVE_DRAFT_SCHEMA_VERSION,
      entryKey: task.entryKey,
      sourceHash: task.sourceHash,
      glossFr: proposal.glossFr,
      meaningSegmentsFr: proposal.meaningSegmentsFr,
      entityMentionsFr: proposal.entityMentionsFr,
      confidence: proposal.confidence
    };
  });
}

function loadReusableAgentValues(input: {
  options: Options;
  stage: Stage;
  promptVersion: string;
  model: string;
  reasoningEffort: string;
  rootKey: string;
}): Array<{ completedAt: string; run: AgentRun; values: unknown[] }> {
  const stageRoot = resolve(
    input.options.outputRoot,
    "agents",
    input.stage
  );
  if (!existsSync(stageRoot)) return [];
  const candidates: Array<{
    completedAt: string;
    run: AgentRun;
    values: unknown[];
  }> = [];
  for (const entry of readdirSync(stageRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const directory = resolve(stageRoot, entry.name);
    const resultPath = resolve(directory, "result.json");
    const runPath = resolve(directory, "run.json");
    if (!existsSync(resultPath) || !existsSync(runPath)) continue;
    try {
      const run = JSON.parse(readFileSync(runPath, "utf8")) as AgentRun;
      if (
        run.stage !== input.stage ||
        run.promptVersion !== input.promptVersion ||
        run.model !== input.model ||
        run.reasoningEffort !== input.reasoningEffort ||
        run.executor.version !== input.options.codexVersion ||
        run.executor.sha256 !== input.options.codexSha256 ||
        run.responseHash !== sha256File(resultPath)
      ) {
        continue;
      }
      const raw = JSON.parse(readFileSync(resultPath, "utf8")) as Record<
        string,
        unknown
      >;
      const values = raw[input.rootKey];
      if (!Array.isArray(values)) continue;
      candidates.push({ completedAt: run.completedAt, run, values });
    } catch {
      // Partial or stale cache records are ignored and regenerated normally.
    }
  }
  return candidates.sort((left, right) =>
    left.completedAt.localeCompare(right.completedAt)
  );
}

function pointerFromRun(run: AgentRun): EntryAgentPointer {
  return {
    batchId: run.batchId,
    promptVersion: run.promptVersion,
    model: run.model,
    reasoningEffort: run.reasoningEffort,
    responseHash: run.responseHash
  };
}

function loadReusableTranslations(
  options: Options,
  tasks: FrenchAdaptiveTask[]
): {
  translations: Map<string, FrenchAdaptiveDraft>;
  pointers: Map<string, EntryAgentPointer>;
} {
  const translations = new Map<string, FrenchAdaptiveDraft>();
  const pointers = new Map<string, EntryAgentPointer>();
  const taskByKey = new Map(tasks.map((task) => [task.entryKey, task]));
  for (const candidate of loadReusableAgentValues({
    options,
    stage: "translator",
    promptVersion: FRENCH_ADAPTIVE_TRANSLATOR_PROMPT_VERSION,
    model: options.translatorModel,
    reasoningEffort: options.translatorReasoning,
    rootKey: "translations"
  })) {
    for (const value of candidate.values) {
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const entryKey = (value as { entryKey?: unknown }).entryKey;
      if (typeof entryKey !== "string") continue;
      const task = taskByKey.get(entryKey);
      if (!task) continue;
      try {
        translations.set(entryKey, assertDraft(value, task));
        pointers.set(entryKey, pointerFromRun(candidate.run));
      } catch {
        // Changed source lineage means this single entry must run again.
      }
    }
  }
  return { translations, pointers };
}

function loadReusableReviews(
  options: Options,
  inputs: ReviewInput[]
): {
  reviews: Map<string, FrenchAdaptiveReview>;
  pointers: Map<string, EntryAgentPointer>;
} {
  const reviews = new Map<string, FrenchAdaptiveReview>();
  const pointers = new Map<string, EntryAgentPointer>();
  const inputByKey = new Map(inputs.map((input) => [input.task.entryKey, input]));
  for (const candidate of loadReusableAgentValues({
    options,
    stage: "reviewer",
    promptVersion: FRENCH_ADAPTIVE_REVIEWER_PROMPT_VERSION,
    model: options.reviewerModel,
    reasoningEffort: options.reviewerReasoning,
    rootKey: "reviews"
  })) {
    for (const value of candidate.values) {
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const entryKey = (value as { entryKey?: unknown }).entryKey;
      if (typeof entryKey !== "string") continue;
      const currentInput = inputByKey.get(entryKey);
      if (!currentInput) continue;
      try {
        reviews.set(entryKey, assertReview(value, currentInput));
        pointers.set(entryKey, pointerFromRun(candidate.run));
      } catch {
        // Changed translation lineage means this single entry must run again.
      }
    }
  }
  return { reviews, pointers };
}

function loadReusableArbitrations(
  options: Options,
  inputs: ArbitrationInput[]
): {
  arbitrations: Map<string, FrenchAdaptiveArbitration>;
  pointers: Map<string, EntryAgentPointer>;
} {
  const arbitrations = new Map<string, FrenchAdaptiveArbitration>();
  const pointers = new Map<string, EntryAgentPointer>();
  const inputByKey = new Map(inputs.map((input) => [input.task.entryKey, input]));
  const stageRoot = resolve(options.outputRoot, "agents", "arbiter");
  if (!existsSync(stageRoot)) return { arbitrations, pointers };

  const candidates: Array<{
    completedAt: string;
    run: AgentRun;
    values: unknown[];
  }> = [];
  for (const entry of readdirSync(stageRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const directory = resolve(stageRoot, entry.name);
    const resultPath = resolve(directory, "result.json");
    const runPath = resolve(directory, "run.json");
    if (!existsSync(resultPath) || !existsSync(runPath)) continue;
    try {
      const run = JSON.parse(readFileSync(runPath, "utf8")) as AgentRun;
      if (
        run.stage !== "arbiter" ||
        run.promptVersion !== FRENCH_ADAPTIVE_ARBITER_PROMPT_VERSION ||
        run.model !== options.arbiterModel ||
        run.reasoningEffort !== options.arbiterReasoning ||
        run.executor.version !== options.codexVersion ||
        run.executor.sha256 !== options.codexSha256 ||
        run.responseHash !== sha256File(resultPath)
      ) {
        continue;
      }
      const raw = JSON.parse(readFileSync(resultPath, "utf8")) as {
        arbitrations?: unknown;
      };
      if (!Array.isArray(raw.arbitrations)) continue;
      candidates.push({
        completedAt: run.completedAt,
        run,
        values: raw.arbitrations
      });
    } catch {
      // Partial or stale cache records are ignored and regenerated normally.
    }
  }

  candidates.sort((left, right) =>
    left.completedAt.localeCompare(right.completedAt)
  );
  for (const candidate of candidates) {
    for (const value of candidate.values) {
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const entryKey = (value as { entryKey?: unknown }).entryKey;
      if (typeof entryKey !== "string") continue;
      const currentInput = inputByKey.get(entryKey);
      if (!currentInput) continue;
      try {
        const arbitration = assertArbitration(
          value,
          currentInput,
          options.arbiterModel
        );
        arbitrations.set(entryKey, arbitration);
        pointers.set(entryKey, {
          batchId: candidate.run.batchId,
          promptVersion: candidate.run.promptVersion,
          model: candidate.run.model,
          reasoningEffort: candidate.run.reasoningEffort,
          responseHash: candidate.run.responseHash
        });
      } catch {
        // Changed lineage or validation means this entry must run again.
      }
    }
  }
  return { arbitrations, pointers };
}

async function runAgentStage<I, O>(input: {
  options: Options;
  stage: Stage;
  batches: Batch<I>[];
  promptVersion: string;
  model: string;
  reasoningEffort: string;
  schema: (items: I[]) => object;
  prompt: (items: I[]) => string;
  parse: (raw: unknown, items: I[]) => O[];
}): Promise<{
  results: O[][];
  pointers: Map<string, EntryAgentPointer>;
}> {
  const stageRoot = resolve(input.options.outputRoot, "agents", input.stage);
  mkdirSync(stageRoot, { recursive: true });
  const results = new Array<O[]>(input.batches.length);
  const pointers = new Map<string, EntryAgentPointer>();
  let cursor = 0;
  let completed = 0;
  const worker = async (): Promise<void> => {
    for (;;) {
      const index = cursor++;
      if (index >= input.batches.length) return;
      const batch = input.batches[index]!;
      const directory = resolve(stageRoot, batch.id);
      mkdirSync(directory, { recursive: true });
      const prompt = input.prompt(batch.items);
      const schema = input.schema(batch.items);
      const schemaText = `${JSON.stringify(schema, null, 2)}\n`;
      const schemaPath = resolve(directory, "output.schema.json");
      installText(schemaPath, schemaText);
      const promptHash = sha256(prompt);
      const schemaHash = sha256(schemaText);
      const resultPath = resolve(directory, "result.json");
      const runPath = resolve(directory, "run.json");
      let parsed: O[] | null = null;
      let run: AgentRun | null = null;
      if (existsSync(resultPath) && existsSync(runPath)) {
        const candidateRun = JSON.parse(readFileSync(runPath, "utf8")) as AgentRun;
        if (
          candidateRun.inputHash === batch.inputHash &&
          candidateRun.promptHash === promptHash &&
          candidateRun.schemaHash === schemaHash &&
          candidateRun.model === input.model &&
          candidateRun.reasoningEffort === input.reasoningEffort &&
          candidateRun.promptVersion === input.promptVersion &&
          candidateRun.responseHash === sha256File(resultPath)
        ) {
          parsed = input.parse(JSON.parse(readFileSync(resultPath, "utf8")), batch.items);
          run = candidateRun;
        }
      }
      if (!parsed || !run) {
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
            parsed = input.parse(raw, batch.items);
            installText(resultPath, `${JSON.stringify(raw, null, 2)}\n`);
            const content = {
              schemaVersion: "lexicon-v3-french-adaptive-agent-run@1" as const,
              stage: input.stage,
              batchId: batch.id,
              promptVersion: input.promptVersion,
              promptHash,
              inputHash: batch.inputHash,
              schemaHash,
              model: input.model,
              reasoningEffort: input.reasoningEffort,
              executor: {
                version: input.options.codexVersion,
                sha256: input.options.codexSha256
              },
              threadId: execution.threadId,
              responseHash: sha256File(resultPath),
              usage: execution.usage,
              startedAt: execution.startedAt,
              completedAt: execution.completedAt
            };
            run = { ...content, runHash: hashFrenchInternalJson(content) };
            installText(runPath, `${JSON.stringify(run, null, 2)}\n`);
            break;
          } catch (error) {
            process.stdout.write(
              `${JSON.stringify({
                event: "retry",
                stage: input.stage,
                batchId: batch.id,
                attempt,
                error: error instanceof Error ? error.message : String(error)
              })}\n`
            );
            if (attempt === input.options.maxAttempts) throw error;
          }
        }
      }
      if (!parsed || !run) throw new Error(`french-adaptive-batch-failed:${batch.id}`);
      results[index] = parsed;
      for (const item of parsed as Array<{ entryKey: string }>) {
        pointers.set(item.entryKey, {
          batchId: batch.id,
          promptVersion: input.promptVersion,
          model: input.model,
          reasoningEffort: input.reasoningEffort,
          responseHash: run.responseHash
        });
      }
      completed += 1;
      process.stdout.write(
        `${JSON.stringify({
          event: "completed",
          stage: input.stage,
          batchId: batch.id,
          entries: parsed.length,
          completedBatches: completed,
          totalBatches: input.batches.length
        })}\n`
      );
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.min(input.options.concurrency, input.batches.length) },
      () => worker()
    )
  );
  return { results, pointers };
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
  usage: AgentUsage | null;
  startedAt: string;
  completedAt: string;
}> {
  const prefix = `attempt-${String(input.attempt).padStart(3, "0")}`;
  const responsePath = resolve(input.directory, `${prefix}-response.json`);
  const eventsPath = resolve(input.directory, `${prefix}-events.jsonl`);
  const stderrPath = resolve(input.directory, `${prefix}-stderr.log`);
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
  let child;
  try {
    child = spawn(executable.executionPath, args, {
      cwd: input.directory,
      env: buildSealedFrenchCodexProposerEnvironment(input.options.codexHome),
      stdio: ["pipe", "pipe", "pipe"],
      detached: process.platform !== "win32"
    });
  } catch (error) {
    executable.dispose();
    throw error;
  }
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
    child.on("error", (error) => {
      clearTimeout(timeout);
      if (killTimer) clearTimeout(killTimer);
      reject(error);
    });
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
  installText(eventsPath, stdout);
  installText(stderrPath, stderr);
  if (timedOut || exitCode !== 0 || !existsSync(responsePath)) {
    throw new Error(
      timedOut
        ? `french-adaptive-agent-timeout:${input.options.timeoutMs}`
        : `french-adaptive-agent-exit:${exitCode}`
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

function translatorPrompt(tasks: FrenchAdaptiveTask[]): string {
  return `Tu es le traducteur français d'un lexique biblique. La notice anglaise STEP fournie est l'unique source éditoriale : traduis-la fidèlement, sans la challenger, la compléter, la résumer ni importer un autre dictionnaire.

RÈGLES :
- glossFr est une vedette française brève et naturelle, conforme à morph; un verbe est à l'infinitif.
- Traduis exactement chaque segment anglais, dans le même ordre et avec le même id. Aucun HTML dans les segments : le HTML est reconstruit localement.
- Préserve littéralement grec, hébreu, codes Strong, nombres, sigles et références. Tu peux franciser le nom d'un livre biblique sans changer chapitre ou verset.
- entityGlossFr, lorsqu'il est non nul, impose exactement le gloss du nom propre.
- Pour chaque entityMentions, rends une ligne entityMentionsFr avec le même mentionId/segmentId et une allowedFrenchForms réellement présente dans le segment. N'en ajoute aucune autre.
- Français contemporain, précis et fluide. Aucun commentaire ni Markdown.

Rends uniquement l'objet JSON demandé. Les tâches compactes suivent :
<tasks_jsonl>
${tasks.map((task) => JSON.stringify(frenchAdaptiveTaskForAgent(task))).join("\n")}
</tasks_jsonl>`;
}

function reviewerPrompt(inputs: ReviewInput[]): string {
  return `Tu es le réviseur français d'un lexique biblique traduit depuis STEP. Compare la traduction à l'anglais, vérifie chaque sens, restriction, négation, modalité, référence et nom propre.

Ne produis pas une seconde traduction complète lorsqu'une entrée est déjà fidèle et naturelle : verdict=accept et patch vide. Si une correction est nécessaire, verdict=correct et rends seulement les champs/segments modifiés dans patch. Utilise verdict=escalate uniquement si une ambiguïté réelle ne peut pas être résolue à partir de STEP et du termbase fourni.

Les diagnostics déterministes sont contraignants. La source STEP reste l'unique autorité sémantique. Aucun ajout doctrinal, historique ou lexical externe. Aucun Markdown.
<review_items_jsonl>
${inputs
  .map((input) =>
    JSON.stringify({
      task: frenchAdaptiveTaskForAgent(input.task),
      translation: draftForAgent(input.translation),
      deterministicIssues: input.validation.issues,
      priorPilotDiagnostics: input.priorDiagnostics
    })
  )
  .join("\n")}
</review_items_jsonl>`;
}

function arbiterPrompt(inputs: ArbitrationInput[]): string {
  return `Tu es l'arbitre final d'un lexique français STEP. Tu ne reçois que des entrées à risque, en désaccord ou encore invalides. STEP anglais est l'unique autorité sémantique.

Pour chaque entrée, rends un finalDraft complet et publiable. Choisis translator si la version initiale est la meilleure, reviewer si la version révisée est la meilleure, corrected si une dernière correction est nécessaire. Respecte exactement les ids de segments, les formes d'entités autorisées, tous les littéraux protégés et un français naturel. Aucun HTML ni Markdown.
<arbitration_items_jsonl>
${inputs
  .map((input) =>
    JSON.stringify({
      task: frenchAdaptiveTaskForAgent(input.task),
      translation: draftForAgent(input.translation),
      translationIssues: input.translationValidation.issues,
      review: reviewForAgent(input.review),
      reviewedDraft: draftForAgent(input.reviewedDraft),
      reviewedIssues: input.reviewedValidation.issues
    })
  )
  .join("\n")}
</arbitration_items_jsonl>`;
}

function translatorSchema(items: FrenchAdaptiveTask[]): object {
  return {
    type: "object",
    additionalProperties: false,
    required: ["translations"],
    properties: {
      translations: {
        type: "array",
        minItems: items.length,
        maxItems: items.length,
        items: draftSchema()
      }
    }
  };
}

function reviewerSchema(items: ReviewInput[]): object {
  return {
    type: "object",
    additionalProperties: false,
    required: ["reviews"],
    properties: {
      reviews: {
        type: "array",
        minItems: items.length,
        maxItems: items.length,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "entryKey",
            "verdict",
            "reasons",
            "patch"
          ],
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
                segmentUpdates: {
                  type: "array",
                  items: segmentSchema()
                },
                entityMentions: {
                  type: "object",
                  additionalProperties: false,
                  required: ["apply", "value"],
                  properties: {
                    apply: { type: "boolean" },
                    value: {
                      type: "array",
                      items: entityMentionSchema()
                    }
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
        }
      }
    }
  };
}

function arbiterSchema(items: ArbitrationInput[]): object {
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
          required: [
            "entryKey",
            "verdict",
            "reasons",
            "finalDraft"
          ],
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
      meaningSegmentsFr: {
        type: "array",
        minItems: 1,
        items: segmentSchema()
      },
      entityMentionsFr: {
        type: "array",
        items: entityMentionSchema()
      },
      confidence: { type: "number", minimum: 0, maximum: 1 }
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

function parseTranslations(
  raw: unknown,
  tasks: FrenchAdaptiveTask[]
): FrenchAdaptiveDraft[] {
  const values = rootArray(raw, "translations", tasks.length);
  return alignByKey(values, tasks.map((task) => task.entryKey)).map(
    (value, index) => assertDraft(value, tasks[index]!)
  );
}

function parseReviews(raw: unknown, inputs: ReviewInput[]): FrenchAdaptiveReview[] {
  const values = rootArray(raw, "reviews", inputs.length);
  return alignByKey(values, inputs.map((input) => input.task.entryKey)).map(
    (value, index) => assertReview(value, inputs[index]!)
  );
}

function parseArbitrations(
  raw: unknown,
  inputs: ArbitrationInput[],
  model: string
): FrenchAdaptiveArbitration[] {
  const values = rootArray(raw, "arbitrations", inputs.length);
  return alignByKey(values, inputs.map((input) => input.task.entryKey)).map(
    (value, index) => assertArbitration(value, inputs[index]!, model)
  );
}

function assertDraft(raw: unknown, task: FrenchAdaptiveTask): FrenchAdaptiveDraft {
  assertObject(raw, "draft");
  assertExactKeys(raw, [
    "entryKey",
    "glossFr",
    "meaningSegmentsFr",
    "entityMentionsFr",
    "confidence"
  ]);
  // Lineage is owned by the deterministic runner. Entry keys are aligned and
  // checked before this point, so attaching source and artifact hashes locally
  // avoids spending model tokens on opaque metadata without allowing an answer
  // to be reassigned to another STEP entry.
  const draft = {
    ...(raw as Omit<FrenchAdaptiveDraft, "schemaVersion" | "sourceHash">),
    schemaVersion: FRENCH_ADAPTIVE_DRAFT_SCHEMA_VERSION,
    sourceHash: task.sourceHash
  };
  if (
    draft.schemaVersion !== FRENCH_ADAPTIVE_DRAFT_SCHEMA_VERSION ||
    draft.entryKey !== task.entryKey ||
    draft.sourceHash !== task.sourceHash ||
    typeof draft.glossFr !== "string" ||
    !draft.glossFr.trim() ||
    !Array.isArray(draft.meaningSegmentsFr) ||
    !Array.isArray(draft.entityMentionsFr) ||
    !Number.isFinite(draft.confidence)
  ) {
    throw new Error(`invalid-french-adaptive-draft:${task.entryKey}`);
  }
  const expected = task.english.segments.map((segment) => segment.id);
  const actual = draft.meaningSegmentsFr.map((segment) => segment.id);
  if (
    actual.length !== expected.length ||
    actual.some((id, index) => id !== expected[index]) ||
    draft.meaningSegmentsFr.some(
      (segment) => typeof segment.text !== "string" || !segment.text.trim()
    )
  ) {
    throw new Error(`invalid-french-adaptive-draft-segments:${task.entryKey}`);
  }
  return normalizeMentionIds(
    {
      ...draft,
      meaningSegmentsFr: draft.meaningSegmentsFr.map((segment) => ({
        ...segment,
        text: normalizeFrenchAdaptiveMechanicalStepArtifacts(segment.text)
      }))
    },
    task
  );
}

export function normalizeFrenchAdaptiveMechanicalStepArtifacts(
  value: string
): string {
  return value
    .replace(/\bll[.]\s*with\b/giu, "aux passages cités")
    .replace(/\bl[.]\s*with\b/giu, "au passage cité");
}

function assertReview(raw: unknown, input: ReviewInput): FrenchAdaptiveReview {
  assertObject(raw, "review");
  assertExactKeys(raw, [
    "entryKey",
    "verdict",
    "reasons",
    "patch"
  ]);
  const review = {
    ...(raw as Omit<
      FrenchAdaptiveReview,
      "schemaVersion" | "sourceHash" | "translationHash"
    >),
    schemaVersion: FRENCH_ADAPTIVE_REVIEW_SCHEMA_VERSION,
    sourceHash: input.task.sourceHash,
    translationHash: frenchAdaptiveTranslationHash(input.translation)
  };
  if (
    review.schemaVersion !== FRENCH_ADAPTIVE_REVIEW_SCHEMA_VERSION ||
    review.entryKey !== input.task.entryKey ||
    review.sourceHash !== input.task.sourceHash ||
    review.translationHash !== frenchAdaptiveTranslationHash(input.translation) ||
    !["accept", "correct", "escalate"].includes(review.verdict) ||
    !Array.isArray(review.reasons) ||
    review.reasons.some((reason) => typeof reason !== "string")
  ) {
    throw new Error(`invalid-french-adaptive-review:${input.task.entryKey}`);
  }
  assertReviewPatch(review, input.task);
  const normalizedReview: FrenchAdaptiveReview = {
    ...review,
    patch: {
      ...review.patch,
      segmentUpdates: review.patch.segmentUpdates.map((segment) => ({
        ...segment,
        text: normalizeFrenchAdaptiveMechanicalStepArtifacts(segment.text)
      }))
    }
  };
  applyFrenchAdaptiveReview(input.task, input.translation, normalizedReview);
  return normalizedReview;
}

function assertReviewPatch(
  review: FrenchAdaptiveReview,
  task: FrenchAdaptiveTask
): void {
  const patch = review.patch;
  if (!patch || typeof patch !== "object") {
    throw new Error(`invalid-french-adaptive-review-patch:${task.entryKey}`);
  }
  for (const pair of [patch.gloss, patch.confidence]) {
    if (!pair || typeof pair.apply !== "boolean") {
      throw new Error(`invalid-french-adaptive-review-pair:${task.entryKey}`);
    }
  }
  if (
    typeof patch.gloss.value !== "string" ||
    typeof patch.confidence.value !== "number" ||
    !Array.isArray(patch.segmentUpdates) ||
    !patch.entityMentions ||
    typeof patch.entityMentions.apply !== "boolean" ||
    !Array.isArray(patch.entityMentions.value)
  ) {
    throw new Error(`invalid-french-adaptive-review-patch:${task.entryKey}`);
  }
  if (
    !patch.gloss.apply &&
    patch.gloss.value !== "" ||
    !patch.confidence.apply &&
    patch.confidence.value !== 0 ||
    !patch.entityMentions.apply &&
    patch.entityMentions.value.length !== 0
  ) {
    throw new Error(`nonempty-disabled-french-adaptive-patch:${task.entryKey}`);
  }
}

function assertArbitration(
  raw: unknown,
  input: ArbitrationInput,
  model: string
): FrenchAdaptiveArbitration {
  assertObject(raw, "arbitration");
  assertExactKeys(raw, [
    "entryKey",
    "verdict",
    "reasons",
    "finalDraft"
  ]);
  const arbitration = {
    ...(raw as Omit<
      FrenchAdaptiveArbitration,
      "schemaVersion" | "sourceHash" | "translatorHash" | "reviewerHash"
    >),
    schemaVersion: FRENCH_ADAPTIVE_ARBITRATION_SCHEMA_VERSION,
    sourceHash: input.task.sourceHash,
    translatorHash: frenchAdaptiveTranslationHash(input.translation),
    reviewerHash: frenchAdaptiveReviewHash(input.review)
  };
  if (
    arbitration.schemaVersion !== FRENCH_ADAPTIVE_ARBITRATION_SCHEMA_VERSION ||
    arbitration.entryKey !== input.task.entryKey ||
    arbitration.sourceHash !== input.task.sourceHash ||
    arbitration.translatorHash !== frenchAdaptiveTranslationHash(input.translation) ||
    arbitration.reviewerHash !== frenchAdaptiveReviewHash(input.review) ||
    !["translator", "reviewer", "corrected"].includes(arbitration.verdict) ||
    !Array.isArray(arbitration.reasons)
  ) {
    throw new Error(`invalid-french-adaptive-arbitration:${input.task.entryKey}`);
  }
  arbitration.finalDraft = assertDraft(arbitration.finalDraft, input.task);
  const validation = validateFrenchAdaptiveDraft({
    task: input.task,
    draft: arbitration.finalDraft,
    model
  });
  if (!validation.valid) {
    // The arbiter is advisory, while the deterministic validator remains the
    // publication gate. If its newly composed draft is mechanically invalid,
    // keep the best already-valid candidate instead of paying for identical
    // retries. Prefer the candidate explicitly selected by the arbiter, then
    // the reviewed candidate, then the translator candidate. Only retry when
    // neither existing candidate satisfies the deterministic contract.
    const fallback =
      arbitration.verdict === "translator" && input.translationValidation.valid
        ? { verdict: "translator" as const, draft: input.translation }
        : arbitration.verdict === "reviewer" && input.reviewedValidation.valid
          ? { verdict: "reviewer" as const, draft: input.reviewedDraft }
          : input.reviewedValidation.valid
            ? { verdict: "reviewer" as const, draft: input.reviewedDraft }
            : input.translationValidation.valid
              ? { verdict: "translator" as const, draft: input.translation }
              : null;
    if (fallback) {
      return {
        ...arbitration,
        verdict: fallback.verdict,
        reasons: [
          ...arbitration.reasons,
          `Repli déterministe vers la variante ${fallback.verdict} déjà valide; la proposition arbitrée échouait: ${validation.issues.map((issue) => issue.code).join(",")}.`
        ],
        finalDraft: fallback.draft
      };
    }
    throw new Error(
      `invalid-french-adaptive-arbitrated-draft:${input.task.entryKey}:${validation.issues.map((issue) => issue.code).join(",")}`
    );
  }
  return arbitration;
}

function normalizeMentionIds(
  draft: FrenchAdaptiveDraft,
  task: FrenchAdaptiveTask
): FrenchAdaptiveDraft {
  const ids = new Set(task.entityMentions.map((mention) => mention.mentionId));
  let changed = false;
  const entityMentionsFr = draft.entityMentionsFr.map((output) => {
    if (ids.has(output.mentionId)) return output;
    const matches = task.entityMentions.filter(
      (mention) =>
        mention.segmentId === output.segmentId &&
        mention.allowedFrenchForms.includes(output.chosenFrenchForm)
    );
    if (matches.length !== 1) return output;
    changed = true;
    return { ...output, mentionId: matches[0]!.mentionId };
  });
  return changed ? { ...draft, entityMentionsFr } : draft;
}

function buildBatches<T extends { task?: FrenchAdaptiveTask } | FrenchAdaptiveTask>(
  items: T[],
  stage: Stage
): Batch<T>[] {
  const limits =
    stage === "translator"
      ? { short: 64, medium: 20, long: 5, very_long: 1 }
      : { short: 40, medium: 12, long: 3, very_long: 1 };
  const byteLimit = stage === "translator" ? 240_000 : 300_000;
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const task = "task" in item && item.task ? item.task : (item as FrenchAdaptiveTask);
    const group = groups.get(task.size) ?? [];
    group.push(item);
    groups.set(task.size, group);
  }
  const batches: Batch<T>[] = [];
  for (const size of ["short", "medium", "long", "very_long"] as const) {
    const group = groups.get(size) ?? [];
    let current: T[] = [];
    let bytes = 0;
    let serial = 0;
    for (const item of group) {
      const itemBytes = Buffer.byteLength(JSON.stringify(item));
      if (
        current.length > 0 &&
        (current.length >= limits[size] || bytes + itemBytes > byteLimit)
      ) {
        serial += 1;
        batches.push(makeBatch(stage, size, serial, current));
        current = [];
        bytes = 0;
      }
      current.push(item);
      bytes += itemBytes;
    }
    if (current.length > 0) {
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

function flattenStage<T extends { entryKey: string }>(
  results: T[][],
  order: FrenchAdaptiveTask[],
  key: (value: T) => string
): T[] {
  const byKey = new Map(results.flat().map((value) => [key(value), value]));
  if (byKey.size !== order.length) {
    throw new Error("french-adaptive-stage-coverage-mismatch");
  }
  return order.map((task) => required(byKey, task.entryKey));
}

function rootArray(raw: unknown, key: string, count: number): unknown[] {
  assertObject(raw, "root");
  if (
    Object.keys(raw).length !== 1 ||
    !Array.isArray(raw[key]) ||
    raw[key].length !== count
  ) {
    throw new Error(`invalid-french-adaptive-root:${key}`);
  }
  return raw[key];
}

function alignByKey(values: unknown[], keys: string[]): unknown[] {
  const byKey = new Map<string, unknown>();
  for (const value of values) {
    assertObject(value, "keyed-value");
    if (typeof value.entryKey !== "string" || byKey.has(value.entryKey)) {
      throw new Error("invalid-french-adaptive-entry-key");
    }
    byKey.set(value.entryKey, value);
  }
  if (byKey.size !== keys.length || keys.some((key) => !byKey.has(key))) {
    throw new Error("french-adaptive-entry-coverage-mismatch");
  }
  return keys.map((key) => byKey.get(key)!);
}

function readPilotKeys(path: string): string[] {
  const manifest = JSON.parse(readFileSync(path, "utf8")) as {
    selection?: { keys?: unknown };
    batches?: Array<{ keys?: unknown }>;
    counts?: { entries?: unknown };
  };
  const keys = Array.isArray(manifest.selection?.keys)
    ? manifest.selection.keys
    : Array.isArray(manifest.batches)
      ? manifest.batches.flatMap((batch) =>
          Array.isArray(batch.keys) ? batch.keys : [null]
        )
      : [];
  if (
    keys.some((key) => typeof key !== "string") ||
    keys.length !== 300 ||
    new Set(keys).size !== keys.length ||
    (manifest.counts?.entries !== undefined && manifest.counts.entries !== 300)
  ) {
    throw new Error("invalid-french-adaptive-pilot-selection");
  }
  return keys as string[];
}

function readPilotReviews(path: string): Map<string, PilotReviewRecord> {
  const records = readJsonl<PilotReviewRecord>(path);
  const byKey = new Map(records.map((record) => [record.entryKey, record]));
  if (byKey.size !== records.length) {
    throw new Error("duplicate-french-adaptive-pilot-review");
  }
  return byKey;
}

function readJsonl<T>(path: string): T[] {
  return readFileSync(path, "utf8")
    .split(/\r?\n/u)
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as T);
}

function writeValidationArtifact(path: string, values: object[]): void {
  installText(
    path,
    values.length > 0
      ? `${values.map((value) => JSON.stringify(value)).join("\n")}\n`
      : ""
  );
}

function fileArtifact(path: string): { path: string; sha256: string; bytes: number } {
  return {
    path: resolve(path),
    sha256: sha256File(path),
    bytes: readFileSync(path).byteLength
  };
}

function installText(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  if (existsSync(path) && readFileSync(path, "utf8") === text) return;
  const temporary = `${path}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(temporary, text, "utf8");
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
      throw new Error(`french-adaptive-run-locked:${owner.pid}`);
    } catch (probe) {
      if ((probe as Error).message.startsWith("french-adaptive-run-locked")) {
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

function assertOptions(options: Options): void {
  if (
    !["pilot", "full"].includes(options.mode) ||
    !existsSync(options.viewsPath) ||
    (options.mode === "pilot" &&
      (!existsSync(options.pilotManifestPath) || !existsSync(options.pilotReviewPath))) ||
    !existsSync(options.codexBinary) ||
    !existsSync(resolve(options.codexHome, "auth.json")) ||
    !SHA256.test(options.codexSha256) ||
    !Number.isInteger(options.concurrency) ||
    options.concurrency < 1 ||
    options.concurrency > 16 ||
    !Number.isInteger(options.maxAttempts) ||
    options.maxAttempts < 1 ||
    options.maxAttempts > 5 ||
    !Number.isSafeInteger(options.timeoutMs) ||
    options.timeoutMs < 1
  ) {
    throw new Error("invalid-french-adaptive-options");
  }
}

export function parseFrenchAdaptiveArgs(args: readonly string[]): Options {
  const values = new Map<string, string>();
  const allowed = new Set([
    "mode",
    "views",
    "pilot-manifest",
    "pilot-review",
    "output-root",
    "codex-binary",
    "codex-home",
    "codex-version",
    "codex-sha256",
    "translator-model",
    "translator-reasoning",
    "reviewer-model",
    "reviewer-reasoning",
    "arbiter-model",
    "arbiter-reasoning",
    "concurrency",
    "max-attempts",
    "timeout-ms"
  ]);
  for (let index = 0; index < args.length; index += 2) {
    const token = args[index] ?? "";
    if (!token.startsWith("--")) throw new Error(`unexpected-argument:${token}`);
    const key = token.slice(2);
    const value = args[index + 1];
    if (!allowed.has(key)) throw new Error(`unknown-option:${key}`);
    if (!value || value.startsWith("--")) throw new Error(`missing-value:${key}`);
    if (values.has(key)) throw new Error(`duplicate-option:${key}`);
    values.set(key, value);
  }
  const mode = values.get("mode") as Mode | undefined;
  if (mode !== "pilot" && mode !== "full") {
    throw new Error("invalid-french-adaptive-mode");
  }
  const integer = (key: string, fallback: number): number => {
    const raw = values.get(key);
    if (raw === undefined) return fallback;
    if (!/^[1-9]\d*$/u.test(raw)) throw new Error(`invalid-integer:${key}`);
    return Number(raw);
  };
  return {
    mode,
    viewsPath: resolve(values.get("views") ?? ""),
    pilotManifestPath: resolve(values.get("pilot-manifest") ?? "unused"),
    pilotReviewPath: resolve(values.get("pilot-review") ?? "unused"),
    outputRoot: resolve(values.get("output-root") ?? ""),
    codexBinary: resolve(values.get("codex-binary") ?? ""),
    codexHome: resolve(values.get("codex-home") ?? ""),
    codexVersion: values.get("codex-version") ?? "codex-cli 0.144.0-alpha.4",
    codexSha256: values.get("codex-sha256") ?? "",
    translatorModel: values.get("translator-model") ?? "gpt-5.6-sol",
    translatorReasoning: values.get("translator-reasoning") ?? "low",
    reviewerModel: values.get("reviewer-model") ?? "gpt-5.6-terra",
    reviewerReasoning: values.get("reviewer-reasoning") ?? "medium",
    arbiterModel: values.get("arbiter-model") ?? "gpt-5.6-sol",
    arbiterReasoning: values.get("arbiter-reasoning") ?? "medium",
    concurrency: integer("concurrency", 16),
    maxAttempts: integer("max-attempts", 5),
    timeoutMs: integer("timeout-ms", 1_200_000)
  };
}

function assertObject(
  value: unknown,
  label: string
): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`invalid-french-adaptive-${label}`);
  }
}

function assertExactKeys(value: Record<string, unknown>, keys: string[]): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    throw new Error("invalid-french-adaptive-keys");
  }
}

function required<K, V>(map: Map<K, V>, key: K): V {
  const value = map.get(key);
  if (value === undefined) throw new Error(`missing-french-adaptive-value:${String(key)}`);
  return value;
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function sha256File(path: string): string {
  return sha256(readFileSync(path));
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? "")).href) {
  runLexiconV3FrenchAdaptivePipeline(parseFrenchAdaptiveArgs(process.argv.slice(2)))
    .then((summary) => process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`))
    .catch((error: unknown) => {
      process.stderr.write(
        `${basename(process.argv[1] ?? "runLexiconV3FrenchAdaptivePipeline")}: ${
          error instanceof Error ? error.stack : String(error)
        }\n`
      );
      process.exitCode = 1;
    });
}
