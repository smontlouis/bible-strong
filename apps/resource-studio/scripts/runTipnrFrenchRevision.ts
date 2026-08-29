import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import {
  closeSync,
  createReadStream,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
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
  FRENCH_CODEX_IMMUTABLE_BINARY_PATH,
  prepareFrenchCodexImmutableExecution
} from "../src/lexiconV3/frenchCodexImmutableBinary.js";

type TriageVerdict = "keep" | "correct" | "escalate";
type ReviewVerdict = "accept" | "correct" | "escalate";
type ArbitrationVerdict = "translator" | "reviewer" | "corrected";
type Stage = "translator" | "reviewer" | "arbiter";

interface AuditIssue {
  code: string;
  severity: string;
  field: string;
  details?: Record<string, unknown>;
}

interface TriageTask {
  key: string;
  sourceId: number;
  stepCode: string | null;
  sourceHash: string;
  translationHash: string;
  deterministicIssues: AuditIssue[];
  fields: Record<string, { english: string; french: string }>;
}

interface TriageDecision {
  key: string;
  verdict: TriageVerdict;
  issueCodes: string[];
  fields: string[];
  reasons: string[];
  confidence: number;
}

interface RevisionInput {
  task: TriageTask;
  decision: TriageDecision;
  requiredFields: string[];
}

interface FieldPatch {
  field: string;
  value: string;
}

interface Translation {
  key: string;
  patches: FieldPatch[];
  confidence: number;
}

interface ValidationIssue {
  code: string;
  field: string;
  details?: Record<string, unknown>;
}

interface Validation {
  valid: boolean;
  issues: ValidationIssue[];
  fieldsHash: string;
}

interface ReviewInput extends RevisionInput {
  translation: Translation;
  translatedFields: Record<string, string>;
  validation: Validation;
}

interface Review {
  key: string;
  verdict: ReviewVerdict;
  reasons: string[];
  patches: FieldPatch[];
}

interface ArbitrationInput extends ReviewInput {
  review: Review;
  reviewedFields: Record<string, string>;
  reviewedValidation: Validation;
}

interface Arbitration {
  key: string;
  verdict: ArbitrationVerdict;
  reasons: string[];
  patches: FieldPatch[];
}

interface Batch<T> {
  id: string;
  items: T[];
  inputHash: string;
}

interface RuntimeIdentity {
  version: string;
  sha256: string;
}

interface AgentUsage {
  input_tokens?: number;
  cached_input_tokens?: number;
  output_tokens?: number;
  reasoning_output_tokens?: number;
}

interface EntryPointer {
  batchId: string;
  promptVersion: string;
  model: string;
  reasoning: string;
  responseHash: string;
}

interface Options {
  tasksPath: string;
  decisionsPath: string;
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
  selection: "all" | "auto-promoted";
}

const PIPELINE_VERSION = "tipnr-french-targeted-revision@1";
const VALIDATOR_VERSION = "tipnr-french-deterministic-validator@1";
const TRANSLATOR_PROMPT_VERSION = "tipnr-french-translator@1";
const REVIEWER_PROMPT_VERSION = "tipnr-french-reviewer@1";
const ARBITER_PROMPT_VERSION = "tipnr-french-arbiter@1";
const FIELD_ORDER = [
  "displayName",
  "description",
  "summaryHtml",
  "briefest",
  "brief",
  "shortDescription",
  "articleHtml"
] as const;
const SHA256 = /^[a-f0-9]{64}$/u;

const ENGLISH_RESIDUE =
  /(?<![\p{L}\p{N}])(?:the|and|another|because|being|called|city|concerning|daughter|derived|especially|except|figuratively|from|god|hence|highest|hosts|including|jealous|king|lord|meaning|mentioned|metaphorically|most\s+high|namely|only|outside|peace|people|perhaps|possibly|probably|properly|provider|referred|righteousness|spelling|therefore|through|uncertain|unknown|usually|whereas|which|wife|without|within|almighty|banner|everlasting)(?![\p{L}\p{N}])/giu;

const SCHOLARLY_TOKENS = new Set([
  "ad",
  "bc",
  "codex",
  "heb",
  "kjv",
  "lxx",
  "ms",
  "mss",
  "niv",
  "nt",
  "ot",
  "qere",
  "ketiv",
  "syr",
  "vulg"
]);

export async function runTipnrFrenchRevision(options: Options): Promise<object> {
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
  runtime: RuntimeIdentity
): Promise<object> {
  const tasks = await readJsonl<TriageTask>(options.tasksPath);
  const decisions = await readJsonl<TriageDecision>(options.decisionsPath);
  assertTriageInputs(tasks, decisions);
  const taskByKey = new Map(tasks.map((task) => [task.key, task]));
  let selected = decisions
    .map((decision) => {
      const task = required(taskByKey, decision.key);
      const baselineValidation = validateFields(task, currentFields(task));
      const effectiveDecision: TriageDecision =
        decision.verdict === "keep" && !baselineValidation.valid
          ? {
              ...decision,
              verdict: "correct",
              issueCodes: unique([
                ...decision.issueCodes,
                ...baselineValidation.issues.map((issue) => issue.code)
              ]),
              fields: unique([
                ...decision.fields,
                ...baselineValidation.issues.map((issue) => issue.field)
              ]).filter((field) => field in task.fields),
              reasons: [
                ...decision.reasons,
                "Promotion automatique par le validateur déterministe."
              ],
              confidence: 1
            }
          : decision;
      if (effectiveDecision.verdict === "keep") return null;
      return {
        task,
        decision: effectiveDecision,
        requiredFields: requiredRevisionFields(task, effectiveDecision)
      } satisfies RevisionInput;
    })
    .filter((value): value is RevisionInput => value !== null);
  if (options.selection === "auto-promoted") {
    const originalByKey = new Map(decisions.map((decision) => [decision.key, decision]));
    selected = selected.filter(
      (input) => required(originalByKey, input.task.key).verdict === "keep"
    );
  }
  if (options.limit !== null) selected = selected.slice(0, options.limit);
  if (!selected.length) throw new Error("tipnr-revision-empty-selection");

  installJsonl(resolve(options.outputRoot, "selected.jsonl"), selected);

  const translationRun = await runStage({
    stage: "translator",
    batches: buildBatches(selected, "translator"),
    outputRoot: options.outputRoot,
    options,
    runtime,
    model: options.translatorModel,
    reasoning: options.translatorReasoning,
    promptVersion: TRANSLATOR_PROMPT_VERSION,
    prompt: translatorPrompt,
    schema: (batch) => translationSchema(batch.items.length),
    parse: (raw, batch) => parseTranslations(raw, batch.items)
  });
  const translations = translationRun.values;
  const translationByKey = new Map(translations.map((value) => [value.key, value]));
  installJsonl(resolve(options.outputRoot, "translations.jsonl"), translations);

  const reviewInputs = selected.map((input) => {
    const translation = required(translationByKey, input.task.key);
    const translatedFields = applyPatches(input.task, currentFields(input.task), translation.patches);
    const validation = validateFields(input.task, translatedFields);
    if (!validation.valid) {
      throw new Error(
        `tipnr-invalid-translator-final:${input.task.key}:${issueCodes(validation)}`
      );
    }
    return { ...input, translation, translatedFields, validation } satisfies ReviewInput;
  });

  const reviewRun = await runStage({
    stage: "reviewer",
    batches: buildBatches(reviewInputs, "reviewer"),
    outputRoot: options.outputRoot,
    options,
    runtime,
    model: options.reviewerModel,
    reasoning: options.reviewerReasoning,
    promptVersion: REVIEWER_PROMPT_VERSION,
    prompt: reviewerPrompt,
    schema: (batch) => reviewSchema(batch.items.length),
    parse: (raw, batch) => parseReviews(raw, batch.items)
  });
  const reviews = reviewRun.values;
  const reviewByKey = new Map(reviews.map((value) => [value.key, value]));
  installJsonl(resolve(options.outputRoot, "reviews.jsonl"), reviews);

  const reviewed = reviewInputs.map((input) => {
    const review = required(reviewByKey, input.task.key);
    const reviewedFields = applyPatches(input.task, input.translatedFields, review.patches);
    const reviewedValidation = validateFields(input.task, reviewedFields);
    if (!reviewedValidation.valid) {
      throw new Error(
        `tipnr-invalid-reviewer-final:${input.task.key}:${issueCodes(reviewedValidation)}`
      );
    }
    return { ...input, review, reviewedFields, reviewedValidation } satisfies ArbitrationInput;
  });

  const arbitrationInputs = reviewed.filter(needsArbitration);
  let arbitrationRun: {
    values: Arbitration[];
    pointers: Map<string, EntryPointer>;
  } = { values: [], pointers: new Map() };
  if (arbitrationInputs.length) {
    arbitrationRun = await runStage({
      stage: "arbiter",
      batches: buildBatches(arbitrationInputs, "arbiter"),
      outputRoot: options.outputRoot,
      options,
      runtime,
      model: options.arbiterModel,
      reasoning: options.arbiterReasoning,
      promptVersion: ARBITER_PROMPT_VERSION,
      prompt: arbiterPrompt,
      schema: (batch) => arbitrationSchema(batch.items.length),
      parse: (raw, batch) => parseArbitrations(raw, batch.items)
    });
  }
  const arbitrationByKey = new Map(
    arbitrationRun.values.map((value) => [value.key, value])
  );
  installJsonl(
    resolve(options.outputRoot, "arbitrations.jsonl"),
    arbitrationRun.values
  );

  const validations: Array<Record<string, unknown>> = [];
  const finals = reviewed.map((input) => {
    const arbitration = arbitrationByKey.get(input.task.key);
    const finalFields = arbitration
      ? fieldsFromArbitration(input, arbitration)
      : input.reviewedFields;
    const validation = validateFields(input.task, finalFields);
    if (!validation.valid) {
      throw new Error(
        `tipnr-invalid-final:${input.task.key}:${issueCodes(validation)}`
      );
    }
    const translationPointer = required(
      translationRun.pointers,
      input.task.key
    );
    const reviewPointer = required(reviewRun.pointers, input.task.key);
    const arbiterPointer = arbitration
      ? required(arbitrationRun.pointers, input.task.key)
      : null;
    const finalHash = hashFields(finalFields);
    validations.push({
      schemaVersion: "tipnr-french-validation@1",
      key: input.task.key,
      validatorVersion: VALIDATOR_VERSION,
      valid: true,
      issues: [],
      sourceHash: input.task.sourceHash,
      priorTranslationHash: input.task.translationHash,
      finalHash
    });
    const provenance = {
      sourceHash: input.task.sourceHash,
      priorTranslationHash: input.task.translationHash,
      triageDecisionHash: sha256(stableJson(input.decision)),
      translator: translationPointer,
      reviewer: reviewPointer,
      arbiter: arbiterPointer,
      validatorVersion: VALIDATOR_VERSION,
      validationHash: sha256(stableJson(validation))
    };
    return {
      schemaVersion: "tipnr-french-revision-final@1",
      key: input.task.key,
      sourceId: input.task.sourceId,
      stepCode: input.task.stepCode,
      sourceHash: input.task.sourceHash,
      priorTranslationHash: input.task.translationHash,
      finalHash,
      fields: finalFields,
      path: arbitration
        ? `arbiter:${arbitration.verdict}`
        : input.review.verdict === "accept"
          ? "reviewer:accepted-translator"
          : "reviewer:corrected",
      provenance,
      recordHash: sha256(stableJson({ key: input.task.key, finalHash, provenance }))
    };
  });
  installJsonl(resolve(options.outputRoot, "validations.jsonl"), validations);
  installJsonl(resolve(options.outputRoot, "final.jsonl"), finals);

  const provenance = finals.map((entry) => ({
    key: entry.key,
    sourceHash: entry.sourceHash,
    priorTranslationHash: entry.priorTranslationHash,
    finalHash: entry.finalHash,
    recordHash: entry.recordHash,
    provenance: entry.provenance
  }));
  installJsonl(resolve(options.outputRoot, "provenance.jsonl"), provenance);

  const triageCounts = { correct: 0, escalate: 0 };
  const reviewCounts: Record<ReviewVerdict, number> = {
    accept: 0,
    correct: 0,
    escalate: 0
  };
  for (const input of selected) triageCounts[input.decision.verdict as "correct" | "escalate"] += 1;
  for (const review of reviews) reviewCounts[review.verdict] += 1;
  const content = {
    schemaVersion: "tipnr-french-revision-summary@1",
    pipelineVersion: PIPELINE_VERSION,
    validatorVersion: VALIDATOR_VERSION,
    status: "complete",
    publication: "not-published",
    sourceEntries: tasks.length,
    selectedEntries: selected.length,
    finalEntries: finals.length,
    invalidFinal: 0,
    triageCounts,
    reviewCounts,
    arbitrated: arbitrationInputs.length,
    inputs: {
      tasks: { path: options.tasksPath, sha256: sha256File(options.tasksPath) },
      decisions: {
        path: options.decisionsPath,
        sha256: sha256File(options.decisionsPath)
      }
    },
    artifacts: {
      selected: artifact(resolve(options.outputRoot, "selected.jsonl")),
      translations: artifact(resolve(options.outputRoot, "translations.jsonl")),
      reviews: artifact(resolve(options.outputRoot, "reviews.jsonl")),
      arbitrations: artifact(resolve(options.outputRoot, "arbitrations.jsonl")),
      validations: artifact(resolve(options.outputRoot, "validations.jsonl")),
      final: artifact(resolve(options.outputRoot, "final.jsonl")),
      provenance: artifact(resolve(options.outputRoot, "provenance.jsonl"))
    },
    execution: {
      internalCodex: true,
      cel: "forbidden",
      aiGateway: "forbidden",
      runtime,
      translator: {
        model: options.translatorModel,
        reasoning: options.translatorReasoning,
        promptVersion: TRANSLATOR_PROMPT_VERSION
      },
      reviewer: {
        model: options.reviewerModel,
        reasoning: options.reviewerReasoning,
        promptVersion: REVIEWER_PROMPT_VERSION
      },
      arbiter: {
        model: options.arbiterModel,
        reasoning: options.arbiterReasoning,
        promptVersion: ARBITER_PROMPT_VERSION,
        conditional: true
      }
    }
  };
  const summary = { ...content, runHash: sha256(stableJson(content)) };
  installText(
    resolve(options.outputRoot, "summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`
  );
  return summary;
}

function assertTriageInputs(
  tasks: TriageTask[],
  decisions: TriageDecision[]
): void {
  if (!tasks.length || decisions.length !== tasks.length) {
    throw new Error(`tipnr-triage-coverage:${tasks.length}:${decisions.length}`);
  }
  const taskByKey = new Map<string, TriageTask>();
  for (const task of tasks) {
    if (
      !task.key ||
      taskByKey.has(task.key) ||
      !Number.isSafeInteger(task.sourceId) ||
      !SHA256.test(task.sourceHash) ||
      !SHA256.test(task.translationHash) ||
      !task.fields ||
      !Object.keys(task.fields).length
    ) {
      throw new Error(`tipnr-invalid-task:${task.key ?? "unknown"}`);
    }
    const sourceHash = sha256(
      FIELD_ORDER.filter((field) => field in task.fields)
        .map((field) => task.fields[field]!.english)
        .join("\n")
    );
    const translationHash = sha256(
      FIELD_ORDER.filter((field) => field in task.fields)
        .map((field) => task.fields[field]!.french)
        .join("\n")
    );
    if (sourceHash !== task.sourceHash || translationHash !== task.translationHash) {
      throw new Error(`tipnr-task-hash-drift:${task.key}`);
    }
    taskByKey.set(task.key, task);
  }
  const seen = new Set<string>();
  for (const decision of decisions) {
    const task = taskByKey.get(decision.key);
    if (
      !task ||
      seen.has(decision.key) ||
      !["keep", "correct", "escalate"].includes(decision.verdict) ||
      !Array.isArray(decision.fields) ||
      decision.fields.some((field) => !(field in task.fields)) ||
      typeof decision.confidence !== "number" ||
      decision.confidence < 0 ||
      decision.confidence > 1
    ) {
      throw new Error(`tipnr-invalid-decision:${decision.key ?? "unknown"}`);
    }
    seen.add(decision.key);
  }
}

function requiredRevisionFields(
  task: TriageTask,
  decision: TriageDecision
): string[] {
  const deterministicValidationFields = validateFields(task, currentFields(task)).issues
    .map((issue) => issue.field)
    .filter((field) => field in task.fields);
  const explicit = unique([...decision.fields, ...deterministicValidationFields]);
  if (explicit.length) return orderedFields(task, explicit);
  const deterministic = unique(
    task.deterministicIssues.map((issue) => issue.field).filter((field) => field in task.fields)
  );
  if (deterministic.length) return orderedFields(task, deterministic);
  return orderedFields(
    task,
    Object.entries(task.fields)
      .filter(([, pair]) => pair.english.trim())
      .map(([field]) => field)
  );
}

function orderedFields(task: TriageTask, fields: string[]): string[] {
  const positions = new Map(FIELD_ORDER.map((field, index) => [field, index]));
  return fields
    .filter((field) => field in task.fields)
    .sort(
      (left, right) =>
        (positions.get(left as (typeof FIELD_ORDER)[number]) ?? 999) -
          (positions.get(right as (typeof FIELD_ORDER)[number]) ?? 999) ||
        left.localeCompare(right, "en")
    );
}

function currentFields(task: TriageTask): Record<string, string> {
  return Object.fromEntries(
    Object.entries(task.fields).map(([field, pair]) => [field, pair.french])
  );
}

function applyPatches(
  task: TriageTask,
  base: Record<string, string>,
  patches: FieldPatch[]
): Record<string, string> {
  const result = { ...base };
  const seen = new Set<string>();
  for (const patch of patches) {
    if (!(patch.field in task.fields) || seen.has(patch.field)) {
      throw new Error(`tipnr-invalid-patch-field:${task.key}:${patch.field}`);
    }
    if (typeof patch.value !== "string" || patch.value === result[patch.field]) {
      throw new Error(`tipnr-nonminimal-patch:${task.key}:${patch.field}`);
    }
    result[patch.field] = patch.value;
    seen.add(patch.field);
  }
  return result;
}

function fieldsFromArbitration(
  input: ArbitrationInput,
  arbitration: Arbitration
): Record<string, string> {
  if (arbitration.verdict === "translator") return input.translatedFields;
  if (arbitration.verdict === "reviewer") return input.reviewedFields;
  return applyPatches(input.task, input.reviewedFields, arbitration.patches);
}

function needsArbitration(input: ArbitrationInput): boolean {
  return (
    input.decision.verdict === "escalate" ||
    input.review.verdict !== "accept"
  );
}

export function validateTipnrFrenchFields(
  task: TriageTask,
  fields: Record<string, string>
): Validation {
  return validateFields(task, fields);
}

function validateFields(
  task: TriageTask,
  fields: Record<string, string>
): Validation {
  const issues: ValidationIssue[] = [];
  const expectedKeys = Object.keys(task.fields).sort();
  const actualKeys = Object.keys(fields).sort();
  if (!sameArray(expectedKeys, actualKeys)) {
    issues.push({ code: "field-coverage-mismatch", field: "*" });
  }
  for (const field of expectedKeys) {
    const source = task.fields[field]!.english;
    const french = fields[field] ?? "";
    if (stripMarkup(source).trim() && !stripMarkup(french).trim()) {
      issues.push({ code: "missing-translation", field });
      continue;
    }
    if (
      stripMarkup(source).length >= 45 &&
      normalizeText(source) === normalizeText(french)
    ) {
      issues.push({ code: "untranslated-prose", field });
    }
    const sourceTags = tagSequence(source);
    const frenchTags = tagSequence(french);
    if (!sameArray(sourceTags, frenchTags)) {
      issues.push({
        code: "tag-order-mismatch",
        field,
        details: { expected: sourceTags, actual: frenchTags }
      });
    }
    const balance = htmlBalance(french);
    const sourceBalance = htmlBalance(source);
    if (
      !balance.valid &&
      (sourceBalance.valid || sourceBalance.reason !== balance.reason)
    ) {
      issues.push({
        code: "invalid-html-structure",
        field,
        details: { reason: balance.reason }
      });
    }
    compareSequence(
      issues,
      field,
      "strong-order-mismatch",
      strongSequence(source),
      strongSequence(french)
    );
    compareSequence(
      issues,
      field,
      "original-token-order-mismatch",
      originalSequence(source),
      originalSequence(french)
    );
    compareSequence(
      issues,
      field,
      "reference-order-mismatch",
      referenceSequence(task.fields[field]!.french),
      referenceSequence(french)
    );
    validateLinkedStrongTermbase(task, field, french, issues);
    const residues = englishResidues(french);
    if (residues.length) {
      issues.push({
        code: "english-residue",
        field,
        details: { tokens: residues }
      });
    }
    if (/\b(?:l['’]|d['’])\s+[aeiouyhéèêàâîïôöùûü]/iu.test(french)) {
      issues.push({ code: "broken-french-elision", field });
    }
    if (/\s+[.,]|[,:;]{2,}|\(\s*\)|\.{4,}/u.test(french)) {
      issues.push({ code: "typography-artifact", field });
    }
  }
  const deduped = dedupeIssues(issues);
  return {
    valid: deduped.length === 0,
    issues: deduped,
    fieldsHash: hashFields(fields)
  };
}

function validateLinkedStrongTermbase(
  task: TriageTask,
  field: string,
  french: string,
  issues: ValidationIssue[]
): void {
  const links = linkedStrongLabels(french);
  for (const issue of task.deterministicIssues) {
    if (issue.code !== "linked-strong-label-not-french" || issue.field !== field) {
      continue;
    }
    const code =
      typeof issue.details?.code === "string"
        ? normalizeStrong(issue.details.code)
        : null;
    const canonical =
      typeof issue.details?.canonical === "string" ? issue.details.canonical : null;
    if (!code || !canonical) continue;
    const candidates = links.filter((link) => link.code === code);
    if (
      !candidates.length ||
      candidates.some((link) => normalizeText(link.label) !== normalizeText(canonical))
    ) {
      issues.push({
        code: "termbase-linked-label-mismatch",
        field,
        details: {
          code,
          canonical,
          actual: candidates.map((link) => link.label)
        }
      });
    }
  }
}

function linkedStrongLabels(value: string): Array<{ code: string; label: string }> {
  return [...value.matchAll(/<strong\s*=\s*["']([^"']+)["']\s*>([\s\S]*?)<\/strong>/giu)].map(
    (match) => ({ code: normalizeStrong(match[1]), label: stripMarkup(match[2]).trim() })
  );
}

function compareSequence(
  issues: ValidationIssue[],
  field: string,
  code: string,
  expected: string[],
  actual: string[]
): void {
  if (!sameArray(expected, actual)) {
    issues.push({ code, field, details: { expected, actual } });
  }
}

function tagSequence(value: string): string[] {
  const tags: string[] = [];
  for (const match of value.matchAll(/<\s*(\/)?\s*([^\s=>/]+)([^<>]*)>/gu)) {
    const closing = Boolean(match[1]);
    const rawName = match[2];
    if (/^[GH]\d{3,5}[A-Z]?(?:-[A-Za-z]+)?$/iu.test(rawName)) continue;
    const name = rawName.toLowerCase();
    const tail = match[3] ?? "";
    if (name === "strong" || name === "ref") {
      const linked = tail.match(/^\s*=\s*["']?([^"'\s>]+)["']?/u)?.[1] ?? "";
      tags.push(`${closing ? "/" : ""}${name}${linked ? `:${normalizeStrong(linked)}` : ""}`);
    } else {
      tags.push(`${closing ? "/" : ""}${name}`);
    }
  }
  return tags;
}

function strongSequence(value: string): string[] {
  return [...value.matchAll(/(?<![\p{L}\p{N}])(?:[GH]\d{1,5}[A-Z]?(?:-[A-Za-z]+)?)(?![\p{L}\p{N}])/giu)].map(
    (match) => normalizeStrong(match[0])
  );
}

function originalSequence(value: string): string[] {
  return [...value.matchAll(/[\p{Script=Hebrew}\p{Script=Greek}][\p{Script=Hebrew}\p{Script=Greek}\p{M}·'’.-]*/gu)].map(
    (match) => match[0]
  );
}

function referenceSequence(value: string): string[] {
  const normalized = stripMarkup(value);
  return [...normalized.matchAll(/(?<![\p{L}\p{N}])((?:(?:[1-4]|I{1,3}|IV|First|Second|Third|Fourth|Premier|Première|Deuxième|Troisième|Quatrième)\s*)?[\p{L}]{2,14})\.?\s*(\d{1,3})(?:[.:](\d{1,3}))?(?:[-–](\d{1,3}))?/giu)]
    .flatMap((match) => {
      const book = canonicalBook(match[1]);
      return book
        ? [`${book}.${match[2]}${match[3] ? `.${match[3]}` : ""}${match[4] ? `-${match[4]}` : ""}`]
        : [];
    });
}

function canonicalBook(value: string): string | null {
  const normalized = value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/gu, "")
    .toLowerCase();
  const numbered = normalized.match(/^([1-4])(.+)$/u);
  const roman = normalized.match(/^(iv|iii|ii|i)(.+)$/u);
  const ordinal = normalized.match(/^(first|second|third|fourth|premier|premiere|deuxieme|troisieme|quatrieme)(.+)$/u);
  const romanValue: Record<string, string> = { i: "1", ii: "2", iii: "3", iv: "4" };
  const ordinalValue: Record<string, string> = {
    first: "1", premier: "1", premiere: "1",
    second: "2", deuxieme: "2",
    third: "3", troisieme: "3",
    fourth: "4", quatrieme: "4"
  };
  const prefix =
    numbered?.[1] ??
    (roman ? romanValue[roman[1]] : undefined) ??
    (ordinal ? ordinalValue[ordinal[1]] : undefined) ??
    "";
  const name = numbered?.[2] ?? roman?.[2] ?? ordinal?.[2] ?? normalized;
  const aliases: Record<string, string> = {
    gen: "gen", genesis: "gen", genese: "gen", gn: "gen",
    exod: "exod", exodus: "exod", exode: "exod", exo: "exod",
    lev: "lev", levitique: "lev",
    num: "num", numbers: "num", nombres: "num", nom: "num",
    deut: "deut", deuteronomy: "deut", deuteronome: "deut", dt: "deut",
    josh: "josh", joshua: "josh", josue: "josh", jos: "josh",
    judg: "judg", judges: "judg", juges: "judg", jug: "judg", jdg: "judg",
    ruth: "ruth", rut: "ruth",
    sam: "sam", samuel: "sam", sa: "sam",
    kgs: "kgs", ki: "kgs", kings: "kgs", rois: "kgs",
    chr: "chr", ch: "chr", chronicles: "chr", chroniques: "chr",
    ezra: "ezra", esdras: "ezra",
    neh: "neh", nehemiah: "neh", nehemie: "neh",
    esth: "esth", esther: "esth",
    job: "job",
    ps: "ps", psa: "ps", psalm: "ps", psalms: "ps", psaume: "ps", psaumes: "ps",
    prov: "prov", proverbs: "prov", proverbes: "prov", pro: "prov",
    eccl: "eccl", ecclesiastes: "eccl", ecclesiaste: "eccl", qohelet: "eccl",
    song: "song", songs: "song", cantique: "song", cantiques: "song",
    isa: "isa", isaiah: "isa", esaie: "isa", es: "isa",
    jer: "jer", jeremiah: "jer", jeremie: "jer",
    lam: "lam", lamentations: "lam",
    ezek: "ezek", ezekiel: "ezek", ezk: "ezek", ezechiel: "ezek", eze: "ezek",
    dan: "dan", daniel: "dan",
    hos: "hos", hosea: "hos", osee: "hos",
    joel: "joel", jl: "joel",
    amos: "amos", am: "amos",
    obad: "obad", obadiah: "obad", abdias: "obad",
    jonah: "jonah", jonas: "jonah",
    mic: "mic", micah: "mic", michee: "mic",
    nah: "nah", nahum: "nah",
    hab: "hab", habakkuk: "hab", habacuc: "hab",
    zeph: "zeph", zephaniah: "zeph", sophonie: "zeph",
    hag: "hag", haggai: "hag", aggee: "hag",
    zech: "zech", zechariah: "zech", zacharie: "zech",
    mal: "mal", malachie: "mal",
    matt: "matt", matthew: "matt", mat: "matt", mt: "matt", matthieu: "matt",
    mark: "mark", mrk: "mark", mk: "mark", marc: "mark", mc: "mark",
    luke: "luke", luk: "luke", luc: "luke", lc: "luke",
    john: "john", jhn: "john", jean: "john", jn: "john",
    acts: "acts", act: "acts", actes: "acts", ac: "acts",
    rom: "rom", romans: "rom", rm: "rom",
    cor: "cor", corinthians: "cor", corinthiens: "cor",
    gal: "gal", galatians: "gal", galates: "gal",
    eph: "eph", ephesians: "eph", ephesiens: "eph",
    phil: "phil", philippians: "phil", philippiens: "phil",
    col: "col", colossians: "col", colossiens: "col",
    thess: "thess", thessalonians: "thess", thessaloniciens: "thess",
    tim: "tim", timothy: "tim", timothee: "tim",
    titus: "titus", tit: "titus", tite: "titus",
    phlm: "phlm", philemon: "phlm",
    heb: "heb", hebrews: "heb", hebreux: "heb",
    jas: "jas", james: "jas", jacques: "jas", jac: "jas",
    pet: "pet", peter: "pet", pierre: "pet",
    jude: "jude", jud: "jude",
    rev: "rev", revelation: "rev", apocalypse: "rev", apo: "rev"
  };
  const canonical = aliases[name];
  return canonical ? `${prefix}${canonical}` : null;
}

function englishResidues(value: string): string[] {
  const plain = stripMarkup(value)
    .replace(/\b(?:KJV|NIV|LXX|NT|OT|MS|MSS|Vulg|Syr|Heb)\b/gu, " ")
    .replace(/\bKing\s+James(?:\s+Version)?\b/giu, " ");
  return unique(
    [...plain.matchAll(ENGLISH_RESIDUE)]
      .map((match) => match[0].toLowerCase())
      .filter((token) => !SCHOLARLY_TOKENS.has(token))
  ).sort();
}

function htmlBalance(value: string): { valid: boolean; reason?: string } {
  const stack: string[] = [];
  const voidTags = new Set(["br", "hr", "img", "input", "lb"]);
  for (const match of value.matchAll(/<\s*(\/)?\s*([^\s=>/]+)([^<>]*)>/gu)) {
    const closing = Boolean(match[1]);
    const rawName = match[2];
    if (/^[GH]\d{3,5}[A-Z]?(?:-[A-Za-z]+)?$/iu.test(rawName)) continue;
    const tag = rawName.toLowerCase();
    if (voidTags.has(tag) || /\/\s*>$/u.test(match[0])) continue;
    if (!closing) stack.push(tag);
    else if (stack.pop() !== tag) {
      return { valid: false, reason: `unexpected-closing:${tag}` };
    }
  }
  return stack.length
    ? { valid: false, reason: `unclosed:${stack.join(",")}` }
    : { valid: true };
}

function stripMarkup(value: string): string {
  return value
    .replace(/<[^>]*>/gu, " ")
    .replace(/&nbsp;|&#160;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">")
    .replace(/&quot;/giu, '"')
    .replace(/&#39;|&apos;/giu, "'")
    .replace(/\s+/gu, " ")
    .trim();
}

function normalizeText(value: string): string {
  return stripMarkup(value)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("fr")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function normalizeStrong(value: string): string {
  const normalized = value.trim().toUpperCase();
  const match = normalized.match(/^([GH])(\d{1,5})([A-Z]?)(.*)$/u);
  return match
    ? `${match[1]}${match[2].padStart(4, "0")}${match[3]}${match[4]}`
    : normalized;
}

function translatorPrompt(items: RevisionInput[]): string {
  return `Tu traduis uniquement les champs TIPNR signalés. L'anglais TIPNR est l'unique source éditoriale. Corrige fidèlement le français actuel sans ajouter, retrancher, résumer, expliquer ni challenger le contenu.

CONTRAT STRICT :
- Rends exactement une entrée par key et exactement un patch pour chaque requiredFields, aucun autre champ.
- Un patch remplace le champ entier mais doit rester minimal éditorialement : conserve les passages français déjà bons.
- Préserve exactement, dans le même ordre, toutes les balises HTML/pseudo-balises, codes Strong/STEP, références, textes grecs et hébreux.
- Chaque termbaseConstraints impose exactement canonical comme libellé français à l'intérieur du lien Strong concerné; réécris au besoin les mots anglais adjacents pour garder une phrase naturelle.
- Traduis les libellés anglais restants, notamment God, Lord, Almighty, Most High, Banner, Peace, Provider, Righteousness, Everlasting, Jealous, Hosts et Highest.
- Français naturel, complet, homogène; noms propres et entités cohérents avec la traduction actuelle lorsqu'elle est correcte.
- confidence entre 0 et 1. Aucun Markdown ni commentaire.
<items_jsonl>
${items.map(compactRevisionInput).map((item) => JSON.stringify(item)).join("\n")}
</items_jsonl>`;
}

function reviewerPrompt(items: ReviewInput[]): string {
  return `Tu révises une correction française TIPNR contre l'anglais autoritatif. Ne refais pas une traduction complète si la proposition est bonne : verdict=accept et patches vide.

Si une correction est nécessaire, verdict=correct et rends seulement les champs réellement modifiés. verdict=escalate seulement pour une ambiguïté réelle. Préserve exactement balises, codes Strong/STEP, références, grec et hébreu. Aucun ajout de contenu externe. Aucun Markdown.
<items_jsonl>
${items
  .map((input) => ({
    ...compactRevisionInput(input),
    translator: input.translation,
    translatedFields: fieldSubset(input.translatedFields, input.requiredFields),
    deterministicValidation: input.validation
  }))
  .map((item) => JSON.stringify(item))
  .join("\n")}
</items_jsonl>`;
}

function arbiterPrompt(items: ArbitrationInput[]): string {
  return `Tu arbitres seulement des corrections TIPNR en désaccord ou à risque. L'anglais TIPNR est l'unique autorité.

Choisis translator ou reviewer avec patches vide si cette version est la meilleure. Choisis corrected uniquement si une dernière correction est nécessaire, avec les seuls champs modifiés par rapport à reviewedFields. Préserve exactement balises, codes Strong/STEP, références, grec et hébreu; aucun ajout externe ni Markdown.
<items_jsonl>
${items
  .map((input) => ({
    ...compactRevisionInput(input),
    translator: input.translation,
    translatedFields: fieldSubset(input.translatedFields, input.requiredFields),
    reviewer: input.review,
    reviewedFields: fieldSubset(input.reviewedFields, input.requiredFields),
    deterministicValidation: input.reviewedValidation
  }))
  .map((item) => JSON.stringify(item))
  .join("\n")}
</items_jsonl>`;
}

function fieldSubset(
  fields: Record<string, string>,
  selected: string[]
): Record<string, string> {
  return Object.fromEntries(selected.map((field) => [field, fields[field] ?? ""]));
}

function compactRevisionInput(input: RevisionInput): object {
  return {
    key: input.task.key,
    sourceId: input.task.sourceId,
    stepCode: input.task.stepCode,
    sourceHash: input.task.sourceHash,
    triage: input.decision,
    termbaseConstraints: input.task.deterministicIssues.filter(
      (issue) =>
        issue.code === "linked-strong-label-not-french" &&
        input.requiredFields.includes(issue.field)
    ),
    requiredFields: input.requiredFields,
    fields: Object.fromEntries(
      Object.entries(input.task.fields).filter(([field]) =>
        input.requiredFields.includes(field)
      )
    )
  };
}

function translationSchema(count: number): object {
  return collectionSchema("translations", count, {
    type: "object",
    additionalProperties: false,
    required: ["key", "patches", "confidence"],
    properties: {
      key: { type: "string" },
      patches: patchArraySchema(1),
      confidence: { type: "number", minimum: 0, maximum: 1 }
    }
  });
}

function reviewSchema(count: number): object {
  return collectionSchema("reviews", count, {
    type: "object",
    additionalProperties: false,
    required: ["key", "verdict", "reasons", "patches"],
    properties: {
      key: { type: "string" },
      verdict: { type: "string", enum: ["accept", "correct", "escalate"] },
      reasons: { type: "array", items: { type: "string" } },
      patches: patchArraySchema(0)
    }
  });
}

function arbitrationSchema(count: number): object {
  return collectionSchema("arbitrations", count, {
    type: "object",
    additionalProperties: false,
    required: ["key", "verdict", "reasons", "patches"],
    properties: {
      key: { type: "string" },
      verdict: {
        type: "string",
        enum: ["translator", "reviewer", "corrected"]
      },
      reasons: { type: "array", items: { type: "string" } },
      patches: patchArraySchema(0)
    }
  });
}

function collectionSchema(property: string, count: number, item: object): object {
  return {
    type: "object",
    additionalProperties: false,
    required: [property],
    properties: {
      [property]: {
        type: "array",
        minItems: count,
        maxItems: count,
        items: item
      }
    }
  };
}

function patchArraySchema(minItems: number): object {
  return {
    type: "array",
    minItems,
    items: {
      type: "object",
      additionalProperties: false,
      required: ["field", "value"],
      properties: {
        field: { type: "string", enum: [...FIELD_ORDER] },
        value: { type: "string" }
      }
    }
  };
}

function parseTranslations(raw: unknown, items: RevisionInput[]): Translation[] {
  const values = collection(raw, "translations", items.length);
  const byKey = new Map(items.map((item) => [item.task.key, item]));
  const parsed = values.map((value) => {
    assertObject(value, "translation");
    assertExactKeys(value, ["key", "patches", "confidence"]);
    const translation = value as unknown as Translation;
    const input = byKey.get(translation.key);
    if (
      !input ||
      typeof translation.confidence !== "number" ||
      translation.confidence < 0 ||
      translation.confidence > 1
    ) {
      throw new Error(`tipnr-invalid-translation:${translation.key ?? "unknown"}`);
    }
    assertPatches(
      translation.patches,
      input.task,
      new Set(input.requiredFields),
      false,
      false
    );
    // A triage signal can be a false positive. Agents express "no change"
    // under the strict schema by returning the current value; normalize those
    // fields to an empty patch and let the independent reviewer decide.
    const current = currentFields(input.task);
    translation.patches = translation.patches.filter(
      (patch) => patch.value !== current[patch.field]
    );
    const patched = applyPatches(
      input.task,
      current,
      translation.patches
    );
    const validation = validateFields(input.task, patched);
    if (!validation.valid) {
      const currentValidation = validateFields(input.task, current);
      if (!currentValidation.valid) {
        throw new Error(
          `tipnr-invalid-translation:${translation.key}:${issueCodes(validation)}`
        );
      }
      // Never publish a mechanically damaged patch. Revert this candidate to
      // the already-valid baseline and let the independent reviewer retry the
      // editorial correction using the triage reasons.
      translation.patches = [];
      translation.confidence = Math.min(translation.confidence, 0.5);
    }
    return translation;
  });
  return orderByInputs(parsed, items.map((item) => item.task.key));
}

function parseReviews(raw: unknown, items: ReviewInput[]): Review[] {
  const values = collection(raw, "reviews", items.length);
  const byKey = new Map(items.map((item) => [item.task.key, item]));
  const parsed = values.map((value) => {
    assertObject(value, "review");
    assertExactKeys(value, ["key", "verdict", "reasons", "patches"]);
    const review = value as unknown as Review;
    const input = byKey.get(review.key);
    if (
      !input ||
      !["accept", "correct", "escalate"].includes(review.verdict) ||
      !Array.isArray(review.reasons) ||
      review.reasons.some((reason) => typeof reason !== "string")
    ) {
      throw new Error(`tipnr-invalid-review:${review.key ?? "unknown"}`);
    }
    const mustPatch = review.verdict === "correct";
    assertPatches(
      review.patches,
      input.task,
      new Set(input.requiredFields),
      mustPatch,
      false
    );
    review.patches = review.patches.filter(
      (patch) => patch.value !== input.translatedFields[patch.field]
    );
    if (review.verdict === "correct" && review.patches.length === 0) {
      review.verdict = "accept";
      review.reasons = [...review.reasons, "Aucune modification matérielle nécessaire."];
    }
    if (review.verdict !== "correct" && review.patches.length) {
      throw new Error(`tipnr-invalid-review-patch:${review.key}`);
    }
    const reviewed = applyPatches(input.task, input.translatedFields, review.patches);
    const validation = validateFields(input.task, reviewed);
    if (!validation.valid) {
      if (!input.validation.valid) {
        throw new Error(`tipnr-invalid-review:${review.key}:${issueCodes(validation)}`);
      }
      review.verdict = "escalate";
      review.patches = [];
      review.reasons = [
        ...review.reasons,
        `Patch refusé par le validateur (${issueCodes(validation)}); arbitrage requis.`
      ];
    }
    return review;
  });
  return orderByInputs(parsed, items.map((item) => item.task.key));
}

function parseArbitrations(
  raw: unknown,
  items: ArbitrationInput[]
): Arbitration[] {
  const values = collection(raw, "arbitrations", items.length);
  const byKey = new Map(items.map((item) => [item.task.key, item]));
  const parsed = values.map((value) => {
    assertObject(value, "arbitration");
    assertExactKeys(value, ["key", "verdict", "reasons", "patches"]);
    const arbitration = value as unknown as Arbitration;
    const input = byKey.get(arbitration.key);
    if (
      !input ||
      !["translator", "reviewer", "corrected"].includes(arbitration.verdict) ||
      !Array.isArray(arbitration.reasons) ||
      arbitration.reasons.some((reason) => typeof reason !== "string")
    ) {
      throw new Error(`tipnr-invalid-arbitration:${arbitration.key ?? "unknown"}`);
    }
    const corrected = arbitration.verdict === "corrected";
    assertPatches(
      arbitration.patches,
      input.task,
      new Set(input.requiredFields),
      corrected,
      false
    );
    if (corrected) {
      arbitration.patches = arbitration.patches.filter(
        (patch) => patch.value !== input.reviewedFields[patch.field]
      );
      if (arbitration.patches.length === 0) {
        arbitration.verdict = "reviewer";
        arbitration.reasons = [
          ...arbitration.reasons,
          "Aucune correction matérielle supplémentaire nécessaire."
        ];
      }
    }
    if (!corrected && arbitration.patches.length) {
      throw new Error(`tipnr-invalid-arbitration-patch:${arbitration.key}`);
    }
    const fields = fieldsFromArbitration(input, arbitration);
    const validation = validateFields(input.task, fields);
    if (!validation.valid) {
      if (input.reviewedValidation.valid) {
        arbitration.verdict = "reviewer";
        arbitration.patches = [];
        arbitration.reasons = [
          ...arbitration.reasons,
          `Patch arbitré refusé (${issueCodes(validation)}); version révisée valide conservée.`
        ];
      } else if (input.validation.valid) {
        arbitration.verdict = "translator";
        arbitration.patches = [];
        arbitration.reasons = [
          ...arbitration.reasons,
          `Patch arbitré refusé (${issueCodes(validation)}); version traducteur valide conservée.`
        ];
      } else {
        throw new Error(
          `tipnr-invalid-arbitration:${arbitration.key}:${issueCodes(validation)}`
        );
      }
    }
    return arbitration;
  });
  return orderByInputs(parsed, items.map((item) => item.task.key));
}

function assertPatches(
  patches: FieldPatch[],
  task: TriageTask,
  allowedFields: Set<string>,
  requireAny: boolean,
  requireExact: boolean
): void {
  if (!Array.isArray(patches) || (requireAny && !patches.length)) {
    throw new Error(`tipnr-invalid-patches:${task.key}`);
  }
  const seen = new Set<string>();
  for (const patch of patches) {
    if (
      !patch ||
      typeof patch !== "object" ||
      typeof patch.field !== "string" ||
      typeof patch.value !== "string" ||
      !(patch.field in task.fields) ||
      !allowedFields.has(patch.field) ||
      seen.has(patch.field)
    ) {
      throw new Error(`tipnr-invalid-patch:${task.key}`);
    }
    seen.add(patch.field);
  }
  if (
    requireExact &&
    (seen.size !== allowedFields.size || [...seen].some((field) => !allowedFields.has(field)))
  ) {
    throw new Error(`tipnr-patch-field-coverage:${task.key}`);
  }
}

async function runStage<T, R>(input: {
  stage: Stage;
  batches: Batch<T>[];
  outputRoot: string;
  options: Options;
  runtime: RuntimeIdentity;
  model: string;
  reasoning: string;
  promptVersion: string;
  prompt: (items: T[]) => string;
  schema: (batch: Batch<T>) => object;
  parse: (raw: unknown, batch: Batch<T>) => R[];
}): Promise<{ values: R[]; pointers: Map<string, EntryPointer> }> {
  const results = new Array<R[]>(input.batches.length);
  const pointers = new Map<string, EntryPointer>();
  let cursor = 0;
  let completed = 0;
  const worker = async (): Promise<void> => {
    for (;;) {
      const index = cursor++;
      if (index >= input.batches.length) return;
      const batch = input.batches[index]!;
      const result = await runBatch(input, batch);
      results[index] = result.values;
      for (const key of result.keys) pointers.set(key, result.pointer);
      completed += 1;
      process.stdout.write(
        `${JSON.stringify({ event: "completed", stage: input.stage, batchId: batch.id, entries: batch.items.length, completed, total: input.batches.length })}\n`
      );
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.min(input.options.concurrency, input.batches.length) },
      worker
    )
  );
  return { values: results.flat(), pointers };
}

async function runBatch<T, R>(
  input: Parameters<typeof runStage<T, R>>[0],
  batch: Batch<T>
): Promise<{ values: R[]; keys: string[]; pointer: EntryPointer }> {
  const directory = resolve(input.outputRoot, "agents", input.stage, batch.id);
  mkdirSync(directory, { recursive: true });
  const prompt = input.prompt(batch.items);
  const schema = input.schema(batch);
  const schemaPath = resolve(directory, "output.schema.json");
  const resultPath = resolve(directory, "result.json");
  const runPath = resolve(directory, "run.json");
  const schemaText = `${JSON.stringify(schema, null, 2)}\n`;
  installText(schemaPath, schemaText);
  const lineage = {
    stage: input.stage,
    inputHash: batch.inputHash,
    promptHash: sha256(prompt),
    schemaHash: sha256(schemaText),
    promptVersion: input.promptVersion,
    model: input.model,
    reasoning: input.reasoning,
    runtimeSha256: input.runtime.sha256
  };
  if (existsSync(resultPath) && existsSync(runPath)) {
    const prior = JSON.parse(readFileSync(runPath, "utf8")) as Record<string, unknown>;
    if (
      Object.entries(lineage).every(([key, value]) => prior[key] === value) &&
      prior.responseHash === sha256File(resultPath)
    ) {
      const values = input.parse(JSON.parse(readFileSync(resultPath, "utf8")), batch);
      return {
        values,
        keys: resultKeys(values),
        pointer: pointerFromRun(prior, batch.id, input)
      };
    }
  }
  for (let attempt = 1; attempt <= input.options.maxAttempts; attempt += 1) {
    try {
      const execution = await executeAgent({
        options: input.options,
        directory,
        attempt,
        prompt,
        schemaPath,
        model: input.model,
        reasoning: input.reasoning
      });
      const raw = JSON.parse(execution.responseText) as unknown;
      const values = input.parse(raw, batch);
      installText(resultPath, `${JSON.stringify(raw, null, 2)}\n`);
      const run = {
        schemaVersion: "tipnr-french-agent-run@1",
        batchId: batch.id,
        ...lineage,
        responseHash: sha256File(resultPath),
        threadId: execution.threadId,
        usage: execution.usage,
        startedAt: execution.startedAt,
        completedAt: execution.completedAt
      };
      installText(runPath, `${JSON.stringify(run, null, 2)}\n`);
      return {
        values,
        keys: resultKeys(values),
        pointer: pointerFromRun(run, batch.id, input)
      };
    } catch (error) {
      process.stdout.write(
        `${JSON.stringify({ event: "retry", stage: input.stage, batchId: batch.id, attempt, error: error instanceof Error ? error.message : String(error) })}\n`
      );
      if (attempt === input.options.maxAttempts) throw error;
    }
  }
  throw new Error(`tipnr-stage-failed:${input.stage}:${batch.id}`);
}

function resultKeys(values: unknown[]): string[] {
  return values.map((value) => {
    if (!value || typeof value !== "object" || !("key" in value)) {
      throw new Error("tipnr-result-key-missing");
    }
    return String(value.key);
  });
}

function pointerFromRun<T, R>(
  run: Record<string, unknown>,
  batchId: string,
  input: Parameters<typeof runStage<T, R>>[0]
): EntryPointer {
  return {
    batchId,
    promptVersion: input.promptVersion,
    model: input.model,
    reasoning: input.reasoning,
    responseHash: String(run.responseHash)
  };
}

async function executeAgent(input: {
  options: Options;
  directory: string;
  attempt: number;
  prompt: string;
  schemaPath: string;
  model: string;
  reasoning: string;
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
  const executable = prepareFrenchCodexImmutableExecution(input.options.codexBinary);
  const startedAt = new Date().toISOString();
  const args = frenchCodexProposerExecArgs({
    model: input.model,
    reasoningEffort: input.reasoning,
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
  installText(eventsPath, stdout);
  installText(stderrPath, stderr);
  if (timedOut || exitCode !== 0 || !existsSync(responsePath)) {
    throw new Error(
      timedOut
        ? `tipnr-agent-timeout:${input.options.timeoutMs}`
        : `tipnr-agent-exit:${exitCode}:${stderr.slice(-500)}`
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

function buildBatches<T>(items: T[], stage: Stage): Batch<T>[] {
  const maxItems = stage === "translator" ? 12 : stage === "reviewer" ? 15 : 10;
  const maxBytes = 180_000;
  const batches: Batch<T>[] = [];
  let current: T[] = [];
  let bytes = 0;
  for (const item of items) {
    const size = Buffer.byteLength(JSON.stringify(item));
    if (current.length && (current.length >= maxItems || bytes + size > maxBytes)) {
      batches.push(makeBatch(stage, batches.length + 1, current));
      current = [];
      bytes = 0;
    }
    current.push(item);
    bytes += size;
  }
  if (current.length) batches.push(makeBatch(stage, batches.length + 1, current));
  return batches;
}

function makeBatch<T>(stage: Stage, serial: number, items: T[]): Batch<T> {
  return {
    id: `${stage}-${String(serial).padStart(5, "0")}`,
    items,
    inputHash: sha256(items.map(stableJson).join("\n") + "\n")
  };
}

function collection(raw: unknown, property: string, count: number): unknown[] {
  assertObject(raw, "root");
  assertExactKeys(raw, [property]);
  const values = raw[property];
  if (!Array.isArray(values) || values.length !== count) {
    throw new Error(`tipnr-invalid-${property}-count`);
  }
  return values;
}

function orderByInputs<T extends { key: string }>(values: T[], keys: string[]): T[] {
  const byKey = new Map<string, T>();
  for (const value of values) {
    if (byKey.has(value.key)) throw new Error(`tipnr-duplicate-result:${value.key}`);
    byKey.set(value.key, value);
  }
  if (byKey.size !== keys.length || keys.some((key) => !byKey.has(key))) {
    throw new Error("tipnr-result-coverage-mismatch");
  }
  return keys.map((key) => required(byKey, key));
}

function issueCodes(validation: Validation): string {
  return unique(validation.issues.map((issue) => issue.code)).join(",");
}

function dedupeIssues(issues: ValidationIssue[]): ValidationIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = stableJson(issue);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function hashFields(fields: Record<string, string>): string {
  return sha256(stableJson(fields));
}

function artifact(path: string): { path: string; sha256: string; bytes: number } {
  const bytes = readFileSync(path).byteLength;
  return { path, sha256: sha256File(path), bytes };
}

function acquireRunLock(path: string): () => void {
  mkdirSync(dirname(path), { recursive: true });
  try {
    closeSync(openSync(path, "wx"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error(`tipnr-revision-run-locked:${path}`);
    }
    throw error;
  }
  return () => rmSync(path, { force: true });
}

async function readJsonl<T>(path: string): Promise<T[]> {
  const values: T[] = [];
  const reader = createInterface({
    input: createReadStream(path, { encoding: "utf8" }),
    crlfDelay: Infinity
  });
  for await (const line of reader) if (line.trim()) values.push(JSON.parse(line) as T);
  return values;
}

function installJsonl(path: string, values: unknown[]): void {
  installText(path, values.map(stableJson).join("\n") + (values.length ? "\n" : ""));
}

function installText(path: string, value: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}`;
  writeFileSync(temporary, value, "utf8");
  renameSync(temporary, path);
}

function parseArgs(values: readonly string[]): Options {
  const args = new Map<string, string>();
  const allowed = new Set([
    "tasks",
    "decisions",
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
    "limit",
    "selection"
  ]);
  for (let index = 0; index < values.length; index += 1) {
    const token = values[index] ?? "";
    if (!token.startsWith("--")) throw new Error(`unexpected-argument:${token}`);
    const [key, inline] = token.slice(2).split("=", 2);
    if (!allowed.has(key)) throw new Error(`unknown-option:${key}`);
    const value = inline ?? values[++index];
    if (!value || value.startsWith("--")) throw new Error(`missing-value:${key}`);
    if (args.has(key)) throw new Error(`duplicate-option:${key}`);
    args.set(key, value);
  }
  const integer = (key: string, fallback: number): number => {
    const value = args.get(key);
    if (value === undefined) return fallback;
    if (!/^[1-9]\d*$/u.test(value)) throw new Error(`invalid-integer:${key}`);
    return Number(value);
  };
  const selection = args.get("selection") ?? "all";
  if (selection !== "all" && selection !== "auto-promoted") {
    throw new Error("invalid-selection");
  }
  return {
    tasksPath: resolve(
      args.get("tasks") ?? "outputs/lexicon-fr-quality/triage/tipnr/tasks.jsonl"
    ),
    decisionsPath: resolve(
      args.get("decisions") ??
        "outputs/lexicon-fr-quality/triage/tipnr/decisions.jsonl"
    ),
    outputRoot: resolve(
      args.get("output-root") ?? "outputs/lexicon-fr-quality/revision/tipnr"
    ),
    codexBinary: resolve(args.get("codex-binary") ?? FRENCH_CODEX_IMMUTABLE_BINARY_PATH),
    codexHome: resolve(args.get("codex-home") ?? "/Users/stephane/.codex"),
    translatorModel: args.get("translator-model") ?? "gpt-5.6-sol",
    translatorReasoning: args.get("translator-reasoning") ?? "low",
    reviewerModel: args.get("reviewer-model") ?? "gpt-5.6-terra",
    reviewerReasoning: args.get("reviewer-reasoning") ?? "low",
    arbiterModel: args.get("arbiter-model") ?? "gpt-5.6-sol",
    arbiterReasoning: args.get("arbiter-reasoning") ?? "medium",
    concurrency: integer("concurrency", 8),
    maxAttempts: integer("max-attempts", 4),
    timeoutMs: integer("timeout-ms", 1_200_000),
    limit: args.has("limit") ? integer("limit", 1) : null,
    selection
  };
}

function assertOptions(options: Options): void {
  if (
    !existsSync(options.tasksPath) ||
    !existsSync(options.decisionsPath) ||
    !existsSync(options.codexBinary) ||
    !existsSync(resolve(options.codexHome, "auth.json")) ||
    options.concurrency < 1 ||
    options.concurrency > 16 ||
    options.maxAttempts < 1 ||
    options.maxAttempts > 5 ||
    options.timeoutMs < 1
  ) {
    throw new Error("tipnr-invalid-options");
  }
}

function assertObject(
  value: unknown,
  label: string
): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`tipnr-invalid-${label}`);
  }
}

function assertExactKeys(value: Record<string, unknown>, keys: string[]): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (!sameArray(actual, expected)) throw new Error("tipnr-invalid-keys");
}

function sameArray(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function required<K, V>(map: Map<K, V>, key: K): V {
  const value = map.get(key);
  if (value === undefined) throw new Error(`tipnr-missing-value:${String(key)}`);
  return value;
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`)
    .join(",")}}`;
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function sha256File(path: string): string {
  return sha256(readFileSync(path));
}

function signalGroup(pid: number | undefined, signal: NodeJS.Signals): void {
  if (!pid) return;
  try {
    process.kill(process.platform === "win32" ? pid : -pid, signal);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? "")).href) {
  runTipnrFrenchRevision(parseArgs(process.argv.slice(2)))
    .then((summary) => process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`))
    .catch((error: unknown) => {
      process.stderr.write(
        `${basename(process.argv[1] ?? "runTipnrFrenchRevision")}: ${
          error instanceof Error ? error.stack : String(error)
        }\n`
      );
      process.exitCode = 1;
    });
}
