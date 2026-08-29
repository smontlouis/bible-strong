import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline";

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
type FinalStage = "existing" | "translator" | "reviewer" | "arbiter";

interface AuditIssue {
  code: string;
  severity: string;
  field: string;
  details?: Record<string, unknown>;
}

interface AuditRecord {
  layer: "lsj";
  key: string;
  sourceId: number;
  stepCode: string;
  sourceHash: string;
  translationHash: string;
  issues: AuditIssue[];
  fields: Record<string, { source: string; translation: string }>;
}

interface TriageDecision {
  key: string;
  verdict: TriageVerdict;
  issueCodes: string[];
  fields: string[];
  reasons: string[];
  confidence: number;
}

interface LsjGroup {
  representative: AuditRecord;
  members: AuditRecord[];
  triage: TriageDecision;
  effectiveVerdict: TriageVerdict;
  preValidation: ValidationResult;
  sourceHtml: string;
  currentHtmlFr: string;
}

export interface TranslationResult {
  key: string;
  contentHtmlFr: string;
  changeSummary: string[];
  confidence: number;
}

export interface ReviewResult {
  key: string;
  verdict: ReviewVerdict;
  correctedContentHtmlFr: string | null;
  reasons: string[];
  confidence: number;
}

interface ArbitrationResult {
  key: string;
  contentHtmlFr: string;
  selected: "translator" | "reviewer" | "corrected";
  reasons: string[];
  confidence: number;
}

interface ValidationResult {
  valid: boolean;
  issues: string[];
  checks: Record<string, boolean>;
}

interface AgentProfile {
  model: string;
  reasoning: string;
}

interface Options {
  recordsPath: string;
  tasksPath: string;
  decisionsPath: string;
  outputRoot: string;
  codexBinary: string;
  codexHome: string;
  translator: AgentProfile;
  reviewer: AgentProfile;
  arbiter: AgentProfile;
  concurrency: number;
  maxAttempts: number;
  timeoutMs: number;
  allowPartial: boolean;
  reuseTranslations: boolean;
  skipReviewer: boolean;
  limit: number | null;
}

interface AgentRuntime {
  version: string;
  sha256: string;
}

export interface Batch<T> {
  id: string;
  items: T[];
  inputHash: string;
}

interface AgentExecution {
  threadId: string;
  responseText: string;
  usage: unknown;
  startedAt: string;
  completedAt: string;
}

interface StagePointer {
  batchId: string;
  responseHash: string;
  model: string;
  reasoning: string;
  recovery?: Array<{
    strategy:
      | "partial-batch-salvage"
      | "unit-isolation"
      | "reviewer-unit-isolation"
      | "reviewer-error-escalation"
      | "segmented-after-unit-exhaustion"
      | "arbiter-after-segment-exhaustion"
      | "protected-micro-after-arbiter-exhaustion";
    exhaustedBatchId: string;
    errorHash: string;
  }>;
  segmentation?: {
    schemaVersion: "viewer-fr-lsj-segmented-provenance@1";
    promptVersion: string;
    sourceBytes: number;
    chunkTargetBytes: number;
    sourceReassemblyHash: string;
    translationReassemblyHash: string;
    chunks: Array<{
      index: number;
      count: number;
      key: string;
      sourceBytes: number;
      sourceHash: string;
      translationHash: string;
      batchId: string;
      responseHash: string;
    }>;
  };
}

export interface LsjHtmlTranslationSegment {
  index: number;
  count: number;
  sourceHtml: string;
  sourceHash: string;
}

export interface LsjTranslationSalvageInput {
  key: string;
  sourceHtml: string;
}

export interface LsjTranslationSalvageResult {
  results: TranslationResult[];
  unresolvedKeys: string[];
  issues: string[];
}

export interface LsjReviewSalvageInput {
  key: string;
  sourceHtml: string;
}

export interface LsjReviewSalvageResult {
  results: ReviewResult[];
  unresolvedKeys: string[];
  issues: string[];
}

interface FinalUnique {
  sourceHash: string;
  representativeKey: string;
  memberKeys: string[];
  sourceHtml: string;
  contentHtmlFr: string;
  contentTextFr: string;
  translationHash: string;
  stage: FinalStage;
  validation: ValidationResult;
  triage: TriageDecision;
  provenance: {
    translator: StagePointer | null;
    reviewer: StagePointer | null;
    arbiter: StagePointer | null;
  };
}

const PIPELINE_VERSION = "viewer-fr-lsj-targeted@1";
const TRANSLATOR_PROMPT_VERSION = "viewer-fr-lsj-translator@1";
const SEGMENTED_TRANSLATOR_PROMPT_VERSION =
  "viewer-fr-lsj-translator-segmented@1";
const SEGMENTED_ARBITER_PROMPT_VERSION =
  "viewer-fr-lsj-translator-segmented-arbiter@6";
const PROTECTED_MICROSEGMENT_PROMPT_VERSION =
  "viewer-fr-lsj-translator-protected-micro@2";
const REVIEWER_PROMPT_VERSION = "viewer-fr-lsj-reviewer@1";
const ARBITER_PROMPT_VERSION = "viewer-fr-lsj-arbiter@1";
const DEFAULT_ROOT = "outputs/lexicon-fr-quality/lsj-revision";
export const LSJ_SEGMENTATION_THRESHOLD_BYTES = 30_000;
export const LSJ_SEGMENT_TARGET_BYTES = 12_000;
export const LSJ_PROTECTED_MICROSEGMENT_TARGET_BYTES = 2_000;

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  for (const path of [
    options.recordsPath,
    options.tasksPath,
    options.decisionsPath
  ]) {
    if (!existsSync(path))
      throw new Error(`lsj-revision-input-missing:${path}`);
  }
  ensureFrenchCodexImmutableBinary({ requestedPath: options.codexBinary });
  const runtime = assertFrenchCodexImmutableBinary(options.codexBinary);
  mkdirSync(options.outputRoot, { recursive: true });

  const records = (await readJsonl<AuditRecord>(options.recordsPath)).filter(
    (record) => record.layer === "lsj"
  );
  const triageTasks = await readJsonl<{ key: string }>(options.tasksPath);
  const decisions = await readJsonl<TriageDecision>(options.decisionsPath);
  assertTriageCoverage(triageTasks, decisions);
  const groups = buildGroups(records, decisions, options);
  if (
    !options.allowPartial &&
    groups.length !== new Set(records.map((r) => r.sourceHash)).size
  ) {
    throw new Error(
      `lsj-revision-partial-triage:${groups.length}:${new Set(records.map((r) => r.sourceHash)).size}`
    );
  }

  const selected = groups.filter((group) => group.effectiveVerdict !== "keep");
  installJsonl(
    resolve(options.outputRoot, "selected.jsonl"),
    selected.map((group) => translationInput(group))
  );

  const translationRun = options.reuseTranslations
    ? await loadExistingTranslations(selected, options)
    : await runTranslationStage(selected, options, runtime);
  const translations = new Map(
    translationRun.results.map((result) => [result.key, result])
  );
  installJsonl(
    resolve(options.outputRoot, "translations.jsonl"),
    selected.map((group) => translations.get(group.representative.key)!)
  );

  const reviewRun = options.skipReviewer
    ? {
        results: buildSkippedReviewResults(
          selected.map((group) => group.representative.key)
        ),
        pointers: new Map<string, StagePointer>()
      }
    : await runReviewStage(selected, translations, options, runtime);
  const reviews = new Map(
    reviewRun.results.map((result) => [result.key, result])
  );
  installJsonl(
    resolve(options.outputRoot, "reviews.jsonl"),
    selected.map((group) => reviews.get(group.representative.key)!)
  );

  const arbitrationGroups = options.skipReviewer
    ? []
    : selected.filter((group) => {
        const review = reviews.get(group.representative.key)!;
        return (
          group.effectiveVerdict === "escalate" || review.verdict !== "accept"
        );
      });
  const arbitrationRun = options.skipReviewer
    ? {
        results: [] as ArbitrationResult[],
        pointers: new Map<string, StagePointer>()
      }
    : await runArbitrationStage(
        arbitrationGroups,
        translations,
        reviews,
        options,
        runtime
      );
  const arbitrations = new Map(
    arbitrationRun.results.map((result) => [result.key, result])
  );
  installJsonl(
    resolve(options.outputRoot, "arbitrations.jsonl"),
    arbitrationGroups.map(
      (group) => arbitrations.get(group.representative.key)!
    )
  );

  const finalUnique = groups.map((group): FinalUnique => {
    const key = group.representative.key;
    const translation = translations.get(key);
    const review = reviews.get(key);
    const arbitration = arbitrations.get(key);
    let stage: FinalStage = "existing";
    let contentHtmlFr = group.currentHtmlFr;
    if (translation) {
      stage = "translator";
      contentHtmlFr = translation.contentHtmlFr;
    }
    if (review?.verdict === "correct" && review.correctedContentHtmlFr) {
      stage = "reviewer";
      contentHtmlFr = review.correctedContentHtmlFr;
    }
    if (arbitration) {
      stage = "arbiter";
      contentHtmlFr = arbitration.contentHtmlFr;
    }
    const validation = validateLsjTranslation(group.sourceHtml, contentHtmlFr);
    if (!validation.valid) {
      throw new Error(
        `lsj-revision-final-invalid:${key}:${validation.issues.join(",")}`
      );
    }
    return {
      sourceHash: group.representative.sourceHash,
      representativeKey: key,
      memberKeys: group.members.map((member) => member.key),
      sourceHtml: group.sourceHtml,
      contentHtmlFr,
      contentTextFr: stripHtml(contentHtmlFr),
      translationHash: sha256(contentHtmlFr),
      stage,
      validation,
      triage: group.triage,
      provenance: {
        translator: translationRun.pointers.get(key) ?? null,
        reviewer: reviewRun.pointers.get(key) ?? null,
        arbiter: arbitrationRun.pointers.get(key) ?? null
      }
    };
  });
  installJsonl(resolve(options.outputRoot, "final-unique.jsonl"), finalUnique);

  const finalByKey = finalUnique
    .flatMap((item) =>
      item.memberKeys.map((key) => {
        const source = records.find((record) => record.key === key);
        if (!source) throw new Error(`lsj-revision-member-missing:${key}`);
        return {
          schemaVersion: "viewer-fr-lsj-final-resource@1",
          key,
          sourceId: source.sourceId,
          stepCode: source.stepCode,
          sourceHash: item.sourceHash,
          representativeKey: item.representativeKey,
          contentHtmlFr: item.contentHtmlFr,
          contentTextFr: item.contentTextFr,
          translationHash: item.translationHash,
          stage: item.stage,
          validation: item.validation,
          provenance: item.provenance
        };
      })
    )
    .sort(
      (a, b) => a.sourceId - b.sourceId || a.key.localeCompare(b.key, "en")
    );
  installJsonl(
    resolve(options.outputRoot, "final-resources.jsonl"),
    finalByKey
  );

  const stageCounts: Record<FinalStage, number> = {
    existing: 0,
    translator: 0,
    reviewer: 0,
    arbiter: 0
  };
  for (const item of finalUnique) stageCounts[item.stage] += 1;
  const content = {
    schemaVersion: "viewer-fr-lsj-targeted-summary@1",
    pipelineVersion: PIPELINE_VERSION,
    status: "complete",
    scope: options.allowPartial ? "partial" : "full",
    counts: {
      sourceRows: records.length,
      uniqueSources: groups.length,
      duplicateRowsCollapsed: finalByKey.length - groups.length,
      selectedForTranslation: selected.length,
      segmentedTranslations: selected.filter(
        (group) =>
          Buffer.byteLength(group.sourceHtml) > LSJ_SEGMENTATION_THRESHOLD_BYTES
      ).length,
      invalidKeepsAutoEscalated: groups.filter(
        (group) =>
          group.triage.verdict === "keep" &&
          group.effectiveVerdict === "escalate"
      ).length,
      reviewed: options.skipReviewer ? 0 : selected.length,
      reviewerSkipped: options.skipReviewer ? selected.length : 0,
      arbitrated: arbitrationGroups.length,
      finalRows: finalByKey.length,
      invalidFinal: 0,
      byFinalStage: stageCounts
    },
    sources: {
      auditRecords: artifact(options.recordsPath),
      triageTasks: artifact(options.tasksPath),
      triageDecisions: artifact(options.decisionsPath)
    },
    artifacts: {
      selected: artifact(resolve(options.outputRoot, "selected.jsonl")),
      translations: artifact(resolve(options.outputRoot, "translations.jsonl")),
      reviews: artifact(resolve(options.outputRoot, "reviews.jsonl")),
      arbitrations: artifact(resolve(options.outputRoot, "arbitrations.jsonl")),
      finalUnique: artifact(resolve(options.outputRoot, "final-unique.jsonl")),
      finalResources: artifact(
        resolve(options.outputRoot, "final-resources.jsonl")
      )
    },
    execution: {
      internalCodex: true,
      cel: "forbidden",
      aiGateway: "forbidden",
      runtime,
      translator: {
        ...options.translator,
        promptVersion: TRANSLATOR_PROMPT_VERSION,
        segmentedPromptVersion: SEGMENTED_TRANSLATOR_PROMPT_VERSION,
        segmentationThresholdBytes: LSJ_SEGMENTATION_THRESHOLD_BYTES,
        segmentTargetBytes: LSJ_SEGMENT_TARGET_BYTES,
        reusedValidatedArtifact: options.reuseTranslations
      },
      reviewer: {
        ...options.reviewer,
        promptVersion: REVIEWER_PROMPT_VERSION,
        skippedByUser: options.skipReviewer
      },
      arbiter: { ...options.arbiter, promptVersion: ARBITER_PROMPT_VERSION },
      arbiterConditional: true
    }
  };
  const summary = { ...content, runHash: sha256(stableJson(content)) };
  installText(
    resolve(options.outputRoot, "summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`
  );
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

function buildGroups(
  records: AuditRecord[],
  decisions: TriageDecision[],
  options: Options
): LsjGroup[] {
  const decisionByKey = new Map(
    decisions.map((decision) => [decision.key, decision])
  );
  const bySource = new Map<string, AuditRecord[]>();
  for (const record of records) {
    const group = bySource.get(record.sourceHash) ?? [];
    group.push(record);
    bySource.set(record.sourceHash, group);
  }
  let groups = [...bySource.values()]
    .map((members) => {
      members.sort((a, b) => a.key.localeCompare(b.key, "en"));
      const representative = members[0]!;
      const triage = decisionByKey.get(representative.key);
      if (!triage) return null;
      const sourceHtml = field(representative, "contentHtml", "source");
      const currentHtmlFr = field(representative, "contentHtml", "translation");
      if (!sourceHtml)
        throw new Error(`lsj-revision-empty-source:${representative.key}`);
      const preValidation = validateLsjTranslation(sourceHtml, currentHtmlFr);
      const effectiveVerdict =
        triage.verdict === "keep" && !preValidation.valid
          ? "escalate"
          : triage.verdict;
      return {
        representative,
        members,
        triage,
        effectiveVerdict,
        preValidation,
        sourceHtml,
        currentHtmlFr
      };
    })
    .filter((value): value is LsjGroup => value !== null);
  groups.sort((a, b) =>
    a.representative.key.localeCompare(b.representative.key, "en")
  );
  if (options.limit !== null) groups = groups.slice(0, options.limit);
  return groups;
}

function assertTriageCoverage(
  tasks: Array<{ key: string }>,
  decisions: TriageDecision[]
): void {
  const taskKeys = new Set(tasks.map((task) => task.key));
  const decisionKeys = new Set(decisions.map((decision) => decision.key));
  if (
    taskKeys.size !== tasks.length ||
    decisionKeys.size !== decisions.length ||
    taskKeys.size !== decisionKeys.size ||
    [...taskKeys].some((key) => !decisionKeys.has(key))
  ) {
    throw new Error(
      `lsj-revision-triage-coverage:${taskKeys.size}:${decisionKeys.size}`
    );
  }
  for (const decision of decisions) {
    if (
      !(["keep", "correct", "escalate"] as const).includes(decision.verdict)
    ) {
      throw new Error(`lsj-revision-triage-verdict:${decision.key}`);
    }
  }
}

async function runTranslationStage(
  groups: LsjGroup[],
  options: Options,
  runtime: AgentRuntime
): Promise<{
  results: TranslationResult[];
  pointers: Map<string, StagePointer>;
}> {
  const originalBatches = buildBatches(groups, "translate", 8, 150_000);
  const oversizedKeys = new Set(
    groups
      .filter(
        (group) =>
          Buffer.byteLength(group.sourceHtml) > LSJ_SEGMENTATION_THRESHOLD_BYTES
      )
      .map((group) => group.representative.key)
  );
  const normalBatches = originalBatches.flatMap((batch) => {
    const items = batch.items.filter(
      (group) => !oversizedKeys.has(group.representative.key)
    );
    if (!items.length) return [];
    if (items.length === batch.items.length) return [batch];
    return [
      {
        id: `${batch.id}-without-oversized`,
        items,
        inputHash: sha256(items.map(stableJson).join("\n") + "\n")
      }
    ];
  });
  const normalRun = await runStage({
    stage: "translator",
    promptVersion: TRANSLATOR_PROMPT_VERSION,
    groups: groups.filter(
      (group) => !oversizedKeys.has(group.representative.key)
    ),
    batches: normalBatches,
    profile: options.translator,
    options,
    runtime,
    schema: (count) => translationSchema(count),
    prompt: (batch, retryFeedback) =>
      translationPrompt(batch.items, retryFeedback),
    parse: (raw, batch) => parseTranslations(raw, batch.items),
    partialParse: (raw, batch) =>
      salvageValidTranslationResults(
        raw,
        batch.items.map((group) => ({
          key: group.representative.key,
          sourceHtml: group.sourceHtml
        }))
      ),
    keyOfInput: (group) => group.representative.key,
    recover: async (batch, exhaustedError) => {
      const unitOptions = { ...options, concurrency: 1 };
      const unitRun = await runStage({
        stage: "translator",
        promptVersion: TRANSLATOR_PROMPT_VERSION,
        groups: batch.items,
        batches: buildAdaptiveUnitTranslationBatches(batch.id, batch.items),
        profile: options.translator,
        options: unitOptions,
        runtime,
        schema: (count) => translationSchema(count),
        prompt: (unitBatch, retryFeedback) =>
          translationPrompt(unitBatch.items, retryFeedback),
        parse: (raw, unitBatch) => parseTranslations(raw, unitBatch.items),
        recover: async (unitBatch, unitError) => {
          const segmented = await runSegmentedTranslationStage(
            unitBatch.items,
            unitOptions,
            runtime
          );
          return {
            results: segmented.results,
            pointers: mapStagePointers(segmented.pointers, (pointer) =>
              withRecovery(pointer, {
                strategy: "segmented-after-unit-exhaustion",
                exhaustedBatchId: unitBatch.id,
                errorHash: sha256(errorMessage(unitError))
              })
            )
          };
        }
      });
      return {
        results: unitRun.results,
        pointers: mapStagePointers(unitRun.pointers, (pointer) =>
          withRecovery(pointer, {
            strategy: "unit-isolation",
            exhaustedBatchId: batch.id,
            errorHash: sha256(errorMessage(exhaustedError))
          })
        )
      };
    }
  });
  const segmentedRun = await runSegmentedTranslationStage(
    groups.filter((group) => oversizedKeys.has(group.representative.key)),
    options,
    runtime
  );
  const resultByKey = new Map(
    [...normalRun.results, ...segmentedRun.results].map((result) => [
      result.key,
      result
    ])
  );
  return {
    results: groups.map((group) =>
      required(resultByKey, group.representative.key, "translation")
    ),
    pointers: new Map([...normalRun.pointers, ...segmentedRun.pointers])
  };
}

export function buildAdaptiveUnitTranslationBatches<
  T extends { representative: { key: string } }
>(parentBatchId: string, items: T[]): Array<Batch<T>> {
  return items.map((item) => ({
    id: `${parentBatchId}-unit-${sha256(item.representative.key).slice(0, 12)}`,
    items: [item],
    inputHash: sha256(`${stableJson(item)}\n`)
  }));
}

async function runSegmentedTranslationStage(
  groups: LsjGroup[],
  options: Options,
  runtime: AgentRuntime
): Promise<{
  results: TranslationResult[];
  pointers: Map<string, StagePointer>;
}> {
  if (!groups.length) return { results: [], pointers: new Map() };
  const segmentMetadata = new Map<
    string,
    {
      parent: LsjGroup;
      segment: LsjHtmlTranslationSegment;
    }
  >();
  const segmentGroups = groups.flatMap((group) => {
    const segments = splitLsjHtmlForTranslation(group.sourceHtml);
    return segments.map((segment) => {
      const key = segmentedKey(group.representative.key, segment);
      const representative: AuditRecord = {
        ...group.representative,
        key,
        sourceHash: segment.sourceHash,
        fields: {
          ...group.representative.fields,
          contentHtml: { source: segment.sourceHtml, translation: "" }
        }
      };
      const segmentGroup: LsjGroup = {
        representative,
        members: [representative],
        triage: group.triage,
        effectiveVerdict: group.effectiveVerdict,
        preValidation: validateLsjTranslation(segment.sourceHtml, ""),
        sourceHtml: segment.sourceHtml,
        currentHtmlFr: ""
      };
      segmentMetadata.set(key, { parent: group, segment });
      return segmentGroup;
    });
  });
  const batches = segmentGroups.map((group) => {
    const metadata = required(
      segmentMetadata,
      group.representative.key,
      "translation-segment-metadata"
    );
    return {
      id: [
        "translate-segment",
        metadata.parent.representative.sourceHash.slice(0, 16),
        String(metadata.segment.index + 1).padStart(3, "0")
      ].join("-"),
      items: [group],
      inputHash: sha256(
        stableJson(translationSegmentInput(group, metadata)) + "\n"
      )
    };
  });
  const chunkRun = await runStage({
    stage: "translator-segmented",
    promptVersion: SEGMENTED_TRANSLATOR_PROMPT_VERSION,
    groups: segmentGroups,
    batches,
    profile: options.translator,
    options,
    runtime,
    schema: (count) => translationSchema(count),
    prompt: (batch, retryFeedback) =>
      translationSegmentPrompt(
        batch.items.map((group) => ({
          group,
          metadata: required(
            segmentMetadata,
            group.representative.key,
            "translation-segment-metadata"
          )
        })),
        retryFeedback
      ),
    parse: (raw, batch) => parseSegmentTranslations(raw, batch.items),
    recover: async (batch, exhaustedError) => {
      try {
        const arbiterRun = await runStage({
          stage: "translator-segmented-arbiter",
          promptVersion: SEGMENTED_ARBITER_PROMPT_VERSION,
          groups: batch.items,
          batches: [batch],
          profile: options.arbiter,
          options: { ...options, concurrency: 1 },
          runtime,
          schema: (count) => translationSchema(count),
          prompt: (arbiterBatch, retryFeedback) =>
            protectedTranslationSegmentPrompt(
              arbiterBatch.items.map((group) => ({
                group,
                metadata: required(
                  segmentMetadata,
                  group.representative.key,
                  "translation-segment-metadata"
                )
              })),
              exhaustedError,
              retryFeedback
            ),
          parse: (raw, arbiterBatch) =>
            parseProtectedSegmentTranslations(raw, arbiterBatch.items)
        });
        return {
          results: arbiterRun.results,
          pointers: mapStagePointers(arbiterRun.pointers, (pointer) =>
            withRecovery(pointer, {
              strategy: "arbiter-after-segment-exhaustion",
              exhaustedBatchId: batch.id,
              errorHash: sha256(errorMessage(exhaustedError))
            })
          )
        };
      } catch (error) {
        if (batch.items.length !== 1) {
          throw error;
        }
        return runProtectedMicroSegmentRecovery(
          batch.items[0]!,
          options,
          runtime,
          new Error(
            `${errorMessage(exhaustedError)} | protected-arbiter: ${errorMessage(
              error instanceof Error ? error : new Error(String(error))
            )}`
          ),
          batch.id
        );
      }
    }
  });
  const chunkResultByKey = new Map(
    chunkRun.results.map((result) => [result.key, result])
  );
  const results: TranslationResult[] = [];
  const pointers = new Map<string, StagePointer>();
  for (const group of groups) {
    const segments = splitLsjHtmlForTranslation(group.sourceHtml);
    const chunkResults = segments.map((segment) =>
      required(
        chunkResultByKey,
        segmentedKey(group.representative.key, segment),
        "translation-segment-result"
      )
    );
    const contentHtmlFr = reassembleLsjTranslationSegments(
      group.sourceHtml,
      segments,
      chunkResults.map((result) => result.contentHtmlFr)
    );
    const validation = validateLsjTranslation(group.sourceHtml, contentHtmlFr);
    if (!validation.valid) {
      throw new Error(
        `translator-segmented-aggregate-validation:${group.representative.key}:${validation.issues.join("|")}`
      );
    }
    const confidence = Math.min(
      ...chunkResults.map((result) => result.confidence)
    );
    const result: TranslationResult = {
      key: group.representative.key,
      contentHtmlFr,
      changeSummary: [
        `Notice traduite en ${segments.length} segments structuraux puis reconstituée et validée intégralement.`
      ],
      confidence
    };
    results.push(result);
    const chunks = segments.map((segment, index) => {
      const key = segmentedKey(group.representative.key, segment);
      const pointer = required(
        chunkRun.pointers,
        key,
        "translation-segment-pointer"
      );
      return {
        index: segment.index,
        count: segment.count,
        key,
        sourceBytes: Buffer.byteLength(segment.sourceHtml),
        sourceHash: segment.sourceHash,
        translationHash: sha256(chunkResults[index]!.contentHtmlFr),
        batchId: pointer.batchId,
        responseHash: pointer.responseHash
      };
    });
    const aggregateProvenance = {
      schemaVersion: "viewer-fr-lsj-segmented-provenance@1" as const,
      promptVersion: SEGMENTED_TRANSLATOR_PROMPT_VERSION,
      sourceBytes: Buffer.byteLength(group.sourceHtml),
      chunkTargetBytes: LSJ_SEGMENT_TARGET_BYTES,
      sourceReassemblyHash: sha256(
        segments.map((segment) => segment.sourceHtml).join("")
      ),
      translationReassemblyHash: sha256(contentHtmlFr),
      chunks
    };
    pointers.set(group.representative.key, {
      batchId: `segmented-${group.representative.sourceHash.slice(0, 16)}-${segments.length}`,
      responseHash: sha256(stableJson(aggregateProvenance)),
      model: options.translator.model,
      reasoning: options.translator.reasoning,
      segmentation: aggregateProvenance
    });
  }
  return { results, pointers };
}

async function runProtectedMicroSegmentRecovery(
  group: LsjGroup,
  options: Options,
  runtime: AgentRuntime,
  exhaustedError: Error,
  exhaustedBatchId: string
): Promise<{
  results: TranslationResult[];
  pointers: Map<string, StagePointer>;
}> {
  const segments = splitLsjHtmlForTranslation(
    group.sourceHtml,
    LSJ_PROTECTED_MICROSEGMENT_TARGET_BYTES
  );
  const metadata = new Map<
    string,
    { parent: LsjGroup; segment: LsjHtmlTranslationSegment }
  >();
  const microGroups = segments.map((segment) => {
    const key = segmentedKey(group.representative.key, segment);
    const representative: AuditRecord = {
      ...group.representative,
      key,
      sourceHash: segment.sourceHash,
      fields: {
        ...group.representative.fields,
        contentHtml: { source: segment.sourceHtml, translation: "" }
      }
    };
    const microGroup: LsjGroup = {
      representative,
      members: [representative],
      triage: group.triage,
      effectiveVerdict: group.effectiveVerdict,
      preValidation: validateLsjTranslation(segment.sourceHtml, ""),
      sourceHtml: segment.sourceHtml,
      currentHtmlFr: ""
    };
    metadata.set(key, { parent: group, segment });
    return microGroup;
  });
  const batches = microGroups.map((microGroup) => {
    const itemMetadata = required(
      metadata,
      microGroup.representative.key,
      "protected-microsegment-metadata"
    );
    return {
      id: [
        "translate-protected-micro",
        group.representative.sourceHash.slice(0, 16),
        String(itemMetadata.segment.index + 1).padStart(3, "0")
      ].join("-"),
      items: [microGroup],
      inputHash: sha256(
        stableJson(translationSegmentInput(microGroup, itemMetadata)) + "\n"
      )
    };
  });
  const run = await runStage({
    stage: "translator-protected-micro",
    promptVersion: PROTECTED_MICROSEGMENT_PROMPT_VERSION,
    groups: microGroups,
    batches,
    profile: options.arbiter,
    options: {
      ...options,
      concurrency: Math.min(options.concurrency, batches.length),
      maxAttempts: Math.max(options.maxAttempts, 6)
    },
    runtime,
    schema: (count) => translationSchema(count),
    prompt: (batch, retryFeedback) =>
      protectedTranslationSegmentPrompt(
        batch.items.map((microGroup) => ({
          group: microGroup,
          metadata: required(
            metadata,
            microGroup.representative.key,
            "protected-microsegment-metadata"
          )
        })),
        exhaustedError,
        retryFeedback
      ),
    parse: (raw, batch) => parseProtectedSegmentTranslations(raw, batch.items)
  });
  const byKey = new Map(run.results.map((result) => [result.key, result]));
  const translatedSegments = segments.map((segment) =>
    required(
      byKey,
      segmentedKey(group.representative.key, segment),
      "protected-microsegment-result"
    )
  );
  const contentHtmlFr = reassembleLsjTranslationSegments(
    group.sourceHtml,
    segments,
    translatedSegments.map((result) => result.contentHtmlFr)
  );
  const result: TranslationResult = {
    key: group.representative.key,
    contentHtmlFr,
    changeSummary: [
      `Segment mécanique récupéré en ${segments.length} micro-segments protégés puis validé intégralement.`
    ],
    confidence: Math.min(...translatedSegments.map((item) => item.confidence))
  };
  const chunks = segments.map((segment, index) => {
    const key = segmentedKey(group.representative.key, segment);
    const pointer = required(
      run.pointers,
      key,
      "protected-microsegment-pointer"
    );
    return {
      index,
      count: segments.length,
      key,
      sourceBytes: Buffer.byteLength(segment.sourceHtml),
      sourceHash: segment.sourceHash,
      translationHash: sha256(translatedSegments[index]!.contentHtmlFr),
      batchId: pointer.batchId,
      responseHash: pointer.responseHash
    };
  });
  const segmentation: NonNullable<StagePointer["segmentation"]> = {
    schemaVersion: "viewer-fr-lsj-segmented-provenance@1",
    promptVersion: PROTECTED_MICROSEGMENT_PROMPT_VERSION,
    sourceBytes: Buffer.byteLength(group.sourceHtml),
    chunkTargetBytes: LSJ_PROTECTED_MICROSEGMENT_TARGET_BYTES,
    sourceReassemblyHash: sha256(
      segments.map((segment) => segment.sourceHtml).join("")
    ),
    translationReassemblyHash: sha256(contentHtmlFr),
    chunks
  };
  return {
    results: [result],
    pointers: new Map([
      [
        group.representative.key,
        {
          batchId: `protected-micro-${group.representative.sourceHash.slice(0, 16)}-${segments.length}`,
          responseHash: sha256(stableJson(segmentation)),
          model: options.arbiter.model,
          reasoning: options.arbiter.reasoning,
          recovery: [
            {
              strategy: "protected-micro-after-arbiter-exhaustion",
              exhaustedBatchId,
              errorHash: sha256(errorMessage(exhaustedError))
            }
          ],
          segmentation
        }
      ]
    ])
  };
}

async function runReviewStage(
  groups: LsjGroup[],
  translations: Map<string, TranslationResult>,
  options: Options,
  runtime: AgentRuntime
): Promise<{ results: ReviewResult[]; pointers: Map<string, StagePointer> }> {
  const inputs = groups.map((group) => ({
    group,
    translation: required(translations, group.representative.key, "translation")
  }));
  return runStage({
    stage: "reviewer",
    promptVersion: REVIEWER_PROMPT_VERSION,
    groups,
    batches: buildBatches(inputs, "review", 8, 170_000),
    profile: options.reviewer,
    options,
    runtime,
    schema: (count) => reviewSchema(count),
    prompt: (batch, retryFeedback) => reviewPrompt(batch.items, retryFeedback),
    parse: (raw, batch) => parseReviews(raw, batch.items),
    partialParse: (raw, batch) =>
      salvageValidReviewResults(
        raw,
        batch.items.map(({ group }) => ({
          key: group.representative.key,
          sourceHtml: group.sourceHtml
        }))
      ),
    keyOfInput: ({ group }) => group.representative.key,
    recover: async (batch, exhaustedError) => {
      const unitOptions = { ...options, concurrency: 1 };
      const unitRun = await runStage({
        stage: "reviewer",
        promptVersion: REVIEWER_PROMPT_VERSION,
        groups: batch.items.map(({ group }) => group),
        batches: buildAdaptiveUnitReviewBatches(batch.id, batch.items),
        profile: options.reviewer,
        options: unitOptions,
        runtime,
        schema: (count) => reviewSchema(count),
        prompt: (unitBatch, retryFeedback) =>
          reviewPrompt(unitBatch.items, retryFeedback),
        parse: (raw, unitBatch) => parseReviews(raw, unitBatch.items),
        recover: async (unitBatch, unitError) => {
          const results = unitBatch.items.map(
            ({ group }): ReviewResult => ({
              key: group.representative.key,
              verdict: "escalate",
              correctedContentHtmlFr: null,
              reasons: [
                "Le réviseur n'a pas fourni de correction mécaniquement valide ; arbitrage requis."
              ],
              confidence: 0
            })
          );
          return {
            results,
            pointers: new Map(
              results.map((result) => [
                result.key,
                {
                  batchId: `review-error-escalation-${sha256(result.key).slice(0, 12)}`,
                  responseHash: sha256(stableJson(result)),
                  model: "deterministic-validator",
                  reasoning: "n/a",
                  recovery: [
                    {
                      strategy: "reviewer-error-escalation",
                      exhaustedBatchId: unitBatch.id,
                      errorHash: sha256(errorMessage(unitError))
                    }
                  ]
                }
              ])
            )
          };
        }
      });
      return {
        results: unitRun.results,
        pointers: mapStagePointers(unitRun.pointers, (pointer) =>
          withRecovery(pointer, {
            strategy: "reviewer-unit-isolation",
            exhaustedBatchId: batch.id,
            errorHash: sha256(errorMessage(exhaustedError))
          })
        )
      };
    }
  });
}

async function loadExistingTranslations(
  groups: LsjGroup[],
  options: Options
): Promise<{
  results: TranslationResult[];
  pointers: Map<string, StagePointer>;
}> {
  const path = resolve(options.outputRoot, "translations.jsonl");
  if (!existsSync(path)) {
    throw new Error(`lsj-revision-reused-translations-missing:${path}`);
  }
  const rows = await readJsonl<TranslationResult>(path);
  const byKey = new Map<string, TranslationResult>();
  for (const row of rows) {
    if (typeof row.key !== "string" || byKey.has(row.key)) {
      throw new Error(`lsj-revision-reused-translation-key:${String(row.key)}`);
    }
    if (typeof row.contentHtmlFr !== "string") {
      throw new Error(`lsj-revision-reused-translation-content:${row.key}`);
    }
    assertStrings(row.changeSummary, `translation-summary:${row.key}`);
    assertConfidence(row.confidence, row.key);
    byKey.set(row.key, row);
  }
  const expectedKeys = new Set(groups.map((group) => group.representative.key));
  const unexpected = [...byKey.keys()].filter((key) => !expectedKeys.has(key));
  if (unexpected.length > 0 || byKey.size !== groups.length) {
    throw new Error(
      `lsj-revision-reused-translation-coverage:${byKey.size}:${groups.length}:${unexpected.slice(0, 5).join(",")}`
    );
  }
  const results = groups.map((group) => {
    const result = required(
      byKey,
      group.representative.key,
      "reused-translation"
    );
    assertValidCandidate(group, result.contentHtmlFr, "reused-translation");
    return result;
  });
  return {
    results,
    pointers: new Map(
      results.map((result) => [
        result.key,
        {
          batchId: "reused-validated-translations-jsonl",
          responseHash: sha256(stableJson(result)),
          model: options.translator.model,
          reasoning: options.translator.reasoning
        }
      ])
    )
  };
}

export function buildSkippedReviewResults(keys: string[]): ReviewResult[] {
  return keys.map((key) => ({
    key,
    verdict: "accept",
    correctedContentHtmlFr: null,
    reasons: [
      "Révision sémantique lourde ignorée à la demande de l'utilisateur ; traduction conservée après validation déterministe."
    ],
    confidence: 1
  }));
}

export function buildAdaptiveUnitReviewBatches<
  T extends { group: { representative: { key: string } } }
>(parentBatchId: string, items: T[]): Array<Batch<T>> {
  return items.map((item) => ({
    id: `${parentBatchId}-unit-${sha256(item.group.representative.key).slice(0, 12)}`,
    items: [item],
    inputHash: sha256(`${stableJson(item)}\n`)
  }));
}

async function runArbitrationStage(
  groups: LsjGroup[],
  translations: Map<string, TranslationResult>,
  reviews: Map<string, ReviewResult>,
  options: Options,
  runtime: AgentRuntime
): Promise<{
  results: ArbitrationResult[];
  pointers: Map<string, StagePointer>;
}> {
  const inputs = groups.map((group) => ({
    group,
    translation: required(
      translations,
      group.representative.key,
      "translation"
    ),
    review: required(reviews, group.representative.key, "review")
  }));
  return runStage({
    stage: "arbiter",
    promptVersion: ARBITER_PROMPT_VERSION,
    groups,
    batches: buildBatches(inputs, "arbitrate", 5, 180_000),
    profile: options.arbiter,
    options,
    runtime,
    schema: (count) => arbitrationSchema(count),
    prompt: (batch, retryFeedback) =>
      arbitrationPrompt(batch.items, retryFeedback),
    parse: (raw, batch) => parseArbitrations(raw, batch.items)
  });
}

interface PartialStageParse<TResult> {
  results: TResult[];
  unresolvedKeys: string[];
  issues: string[];
}

class PartialStageRecoveryError extends Error {
  readonly cause: Error;

  constructor(cause: Error) {
    super(cause.message);
    this.name = "PartialStageRecoveryError";
    this.cause = cause;
  }
}

async function runStage<TInput, TResult extends { key: string }>(input: {
  stage: string;
  promptVersion: string;
  groups: LsjGroup[];
  batches: Array<Batch<TInput>>;
  profile: AgentProfile;
  options: Options;
  runtime: AgentRuntime;
  schema(count: number): object;
  prompt(batch: Batch<TInput>, retryFeedback: string[]): string;
  parse(raw: unknown, batch: Batch<TInput>): TResult[];
  partialParse?(raw: unknown, batch: Batch<TInput>): PartialStageParse<TResult>;
  keyOfInput?(item: TInput): string;
  recover?(
    batch: Batch<TInput>,
    exhaustedError: Error
  ): Promise<{
    results: TResult[];
    pointers: Map<string, StagePointer>;
  }>;
}): Promise<{ results: TResult[]; pointers: Map<string, StagePointer> }> {
  if (!input.batches.length) return { results: [], pointers: new Map() };
  const results = new Array<TResult[]>(input.batches.length);
  const pointers = new Map<string, StagePointer>();
  let cursor = 0;
  let completed = 0;
  const worker = async (): Promise<void> => {
    for (;;) {
      const index = cursor++;
      if (index >= input.batches.length) return;
      const batch = input.batches[index]!;
      const directory = resolve(
        input.options.outputRoot,
        "agents",
        input.stage,
        batch.id
      );
      mkdirSync(directory, { recursive: true });
      const schemaPath = resolve(directory, "output.schema.json");
      const resultPath = resolve(directory, "result.json");
      const runPath = resolve(directory, "run.json");
      const schemaText = `${JSON.stringify(input.schema(batch.items.length), null, 2)}\n`;
      installText(schemaPath, schemaText);
      let retryFeedback: string[] = [];
      let parsed: TResult[] | null = null;
      let pointer: StagePointer | null = null;
      let itemPointers: Map<string, StagePointer> | null = null;
      let exhaustedError: Error | null = null;
      for (
        let attempt = 1;
        attempt <= input.options.maxAttempts;
        attempt += 1
      ) {
        const prompt = input.prompt(batch, retryFeedback);
        const lineage = {
          stage: input.stage,
          batchId: batch.id,
          inputHash: batch.inputHash,
          promptHash: sha256(prompt),
          schemaHash: sha256(schemaText),
          promptVersion: input.promptVersion,
          model: input.profile.model,
          reasoning: input.profile.reasoning,
          runtimeSha256: input.runtime.sha256
        };
        try {
          if (attempt === 1 && existsSync(resultPath) && existsSync(runPath)) {
            const prior = JSON.parse(readFileSync(runPath, "utf8")) as Record<
              string,
              unknown
            >;
            if (
              Object.entries(lineage).every(
                ([key, value]) =>
                  (key === "promptHash" && prior.parseMode === "partial") ||
                  prior[key] === value
              ) &&
              prior.responseHash === sha256File(resultPath)
            ) {
              const cachedRaw = JSON.parse(
                readFileSync(resultPath, "utf8")
              ) as unknown;
              const cachedPointer: StagePointer = {
                batchId: batch.id,
                responseHash: prior.responseHash as string,
                model: input.profile.model,
                reasoning: input.profile.reasoning
              };
              if (prior.parseMode === "partial") {
                if (
                  !input.partialParse ||
                  !input.keyOfInput ||
                  !input.recover
                ) {
                  throw new Error(
                    `lsj-revision-partial-cache-unsupported:${input.stage}:${batch.id}`
                  );
                }
                const partial = input.partialParse(cachedRaw, batch);
                assertPartialCacheMatches(prior, partial, batch.id);
                let completedPartial: {
                  results: TResult[];
                  pointers: Map<string, StagePointer>;
                };
                try {
                  completedPartial = await completePartialStageBatch({
                    batch,
                    partial,
                    basePointer: cachedPointer,
                    parseError: new Error(
                      typeof prior.parseError === "string"
                        ? prior.parseError
                        : `lsj-revision-cached-partial:${input.stage}:${batch.id}`
                    ),
                    keyOfInput: input.keyOfInput,
                    recover: input.recover
                  });
                } catch (error) {
                  throw new PartialStageRecoveryError(
                    error instanceof Error ? error : new Error(String(error))
                  );
                }
                parsed = completedPartial.results;
                itemPointers = completedPartial.pointers;
              } else {
                parsed = input.parse(cachedRaw, batch);
                pointer = cachedPointer;
              }
              break;
            }
          }
          const execution = await executeAgent({
            options: input.options,
            directory,
            attempt,
            prompt,
            schemaPath,
            profile: input.profile
          });
          const raw = JSON.parse(execution.responseText) as unknown;
          let fullParseError: Error | null = null;
          try {
            parsed = input.parse(raw, batch);
          } catch (error) {
            fullParseError =
              error instanceof Error ? error : new Error(String(error));
          }
          if (
            fullParseError &&
            input.partialParse &&
            input.keyOfInput &&
            input.recover
          ) {
            const partial = input.partialParse(raw, batch);
            if (partial.results.length > 0) {
              installText(resultPath, `${JSON.stringify(raw, null, 2)}\n`);
              const responseHash = sha256File(resultPath);
              installText(
                runPath,
                `${JSON.stringify(
                  {
                    schemaVersion: "viewer-fr-lsj-agent-run@1",
                    ...lineage,
                    responseHash,
                    parseMode: "partial",
                    parseError: fullParseError.message,
                    parseErrorHash: sha256(fullParseError.message),
                    partialValidKeys: partial.results.map(
                      (result) => result.key
                    ),
                    partialUnresolvedKeys: partial.unresolvedKeys,
                    partialIssues: partial.issues,
                    threadId: execution.threadId,
                    usage: execution.usage,
                    startedAt: execution.startedAt,
                    completedAt: execution.completedAt
                  },
                  null,
                  2
                )}\n`
              );
              const basePointer: StagePointer = {
                batchId: batch.id,
                responseHash,
                model: input.profile.model,
                reasoning: input.profile.reasoning
              };
              try {
                const completedPartial = await completePartialStageBatch({
                  batch,
                  partial,
                  basePointer,
                  parseError: fullParseError,
                  keyOfInput: input.keyOfInput,
                  recover: input.recover
                });
                parsed = completedPartial.results;
                itemPointers = completedPartial.pointers;
              } catch (error) {
                throw new PartialStageRecoveryError(
                  error instanceof Error ? error : new Error(String(error))
                );
              }
              process.stdout.write(
                `${JSON.stringify({ event: "partial-salvage", stage: input.stage, batchId: batch.id, valid: partial.results.length, unresolved: partial.unresolvedKeys.length, issues: partial.issues })}\n`
              );
              break;
            }
          }
          if (fullParseError) throw fullParseError;
          installText(resultPath, `${JSON.stringify(raw, null, 2)}\n`);
          const responseHash = sha256File(resultPath);
          installText(
            runPath,
            `${JSON.stringify(
              {
                schemaVersion: "viewer-fr-lsj-agent-run@1",
                ...lineage,
                responseHash,
                parseMode: "complete",
                threadId: execution.threadId,
                usage: execution.usage,
                startedAt: execution.startedAt,
                completedAt: execution.completedAt
              },
              null,
              2
            )}\n`
          );
          pointer = {
            batchId: batch.id,
            responseHash,
            model: input.profile.model,
            reasoning: input.profile.reasoning
          };
          break;
        } catch (error) {
          if (error instanceof PartialStageRecoveryError) throw error.cause;
          const normalizedError =
            error instanceof Error ? error : new Error(String(error));
          const message = normalizedError.message;
          retryFeedback = [message];
          process.stdout.write(
            `${JSON.stringify({ event: "retry", stage: input.stage, batchId: batch.id, attempt, error: message })}\n`
          );
          if (attempt === input.options.maxAttempts) {
            exhaustedError = normalizedError;
            break;
          }
        }
      }
      if (!parsed || (!pointer && !itemPointers)) {
        if (!input.recover || !exhaustedError) {
          throw (
            exhaustedError ??
            new Error(`lsj-revision-stage-failed:${input.stage}:${batch.id}`)
          );
        }
        process.stdout.write(
          `${JSON.stringify({ event: "recovery", stage: input.stage, batchId: batch.id, strategy: "adaptive", error: exhaustedError.message })}\n`
        );
        const recovered = await input.recover(batch, exhaustedError);
        if (recovered.results.length !== batch.items.length) {
          throw new Error(
            `lsj-revision-recovery-count:${input.stage}:${batch.id}:${recovered.results.length}:${batch.items.length}`
          );
        }
        for (const result of recovered.results as Array<{ key: string }>) {
          const recoveredPointer = recovered.pointers.get(result.key);
          if (!recoveredPointer) {
            throw new Error(
              `lsj-revision-recovery-pointer:${input.stage}:${batch.id}:${result.key}`
            );
          }
          pointers.set(result.key, recoveredPointer);
        }
        results[index] = recovered.results;
        completed += 1;
        process.stdout.write(
          `${JSON.stringify({ event: "completed", stage: input.stage, batchId: batch.id, entries: recovered.results.length, completed, total: input.batches.length, recovered: true })}\n`
        );
        continue;
      }
      results[index] = parsed;
      for (const result of parsed) {
        const resultPointer = itemPointers?.get(result.key) ?? pointer;
        if (!resultPointer) {
          throw new Error(
            `lsj-revision-result-pointer:${input.stage}:${batch.id}:${result.key}`
          );
        }
        pointers.set(result.key, resultPointer);
      }
      completed += 1;
      process.stdout.write(
        `${JSON.stringify({ event: "completed", stage: input.stage, batchId: batch.id, entries: parsed.length, completed, total: input.batches.length })}\n`
      );
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.min(input.options.concurrency, input.batches.length) },
      worker
    )
  );
  return { results: results.flat(), pointers };
}

function assertPartialCacheMatches<TResult extends { key: string }>(
  prior: Record<string, unknown>,
  partial: PartialStageParse<TResult>,
  batchId: string
): void {
  const validKeys = partial.results.map((result) => result.key);
  if (
    !sameArray(asStringArray(prior.partialValidKeys), validKeys) ||
    !sameArray(
      asStringArray(prior.partialUnresolvedKeys),
      partial.unresolvedKeys
    )
  ) {
    throw new Error(`lsj-revision-partial-cache-drift:${batchId}`);
  }
}

async function completePartialStageBatch<
  TInput,
  TResult extends { key: string }
>(input: {
  batch: Batch<TInput>;
  partial: PartialStageParse<TResult>;
  basePointer: StagePointer;
  parseError: Error;
  keyOfInput(item: TInput): string;
  recover(
    batch: Batch<TInput>,
    exhaustedError: Error
  ): Promise<{
    results: TResult[];
    pointers: Map<string, StagePointer>;
  }>;
}): Promise<{ results: TResult[]; pointers: Map<string, StagePointer> }> {
  const expectedKeys = input.batch.items.map(input.keyOfInput);
  if (new Set(expectedKeys).size !== expectedKeys.length) {
    throw new Error(`lsj-revision-partial-input-duplicate:${input.batch.id}`);
  }
  const resultByKey = new Map<string, TResult>();
  for (const result of input.partial.results) {
    if (!expectedKeys.includes(result.key) || resultByKey.has(result.key)) {
      throw new Error(
        `lsj-revision-partial-valid-key:${input.batch.id}:${result.key}`
      );
    }
    resultByKey.set(result.key, result);
  }
  const validKeys = new Set(resultByKey.keys());
  const expectedUnresolvedKeys = expectedKeys.filter(
    (key) => !validKeys.has(key)
  );
  if (!sameArray(input.partial.unresolvedKeys, expectedUnresolvedKeys)) {
    throw new Error(
      `lsj-revision-partial-complement:${input.batch.id}:${input.partial.unresolvedKeys.join(",")}:${expectedUnresolvedKeys.join(",")}`
    );
  }
  const recovery = {
    strategy: "partial-batch-salvage" as const,
    exhaustedBatchId: input.batch.id,
    errorHash: sha256(errorMessage(input.parseError))
  };
  const pointers = new Map<string, StagePointer>();
  for (const key of validKeys) {
    pointers.set(key, withRecovery(input.basePointer, recovery));
  }
  if (expectedUnresolvedKeys.length) {
    const unresolvedSet = new Set(expectedUnresolvedKeys);
    const recoveryBatch = buildPartialRecoveryBatch(
      input.batch,
      expectedUnresolvedKeys,
      input.keyOfInput
    );
    const unresolvedItems = recoveryBatch.items;
    const recovered = await input.recover(recoveryBatch, input.parseError);
    if (recovered.results.length !== unresolvedItems.length) {
      throw new Error(
        `lsj-revision-partial-recovery-count:${input.batch.id}:${recovered.results.length}:${unresolvedItems.length}`
      );
    }
    for (const result of recovered.results) {
      if (!unresolvedSet.has(result.key) || resultByKey.has(result.key)) {
        throw new Error(
          `lsj-revision-partial-recovery-key:${input.batch.id}:${result.key}`
        );
      }
      const recoveredPointer = recovered.pointers.get(result.key);
      if (!recoveredPointer) {
        throw new Error(
          `lsj-revision-partial-recovery-pointer:${input.batch.id}:${result.key}`
        );
      }
      resultByKey.set(result.key, result);
      pointers.set(result.key, withRecovery(recoveredPointer, recovery));
    }
  }
  return {
    results: expectedKeys.map((key) =>
      required(resultByKey, key, "partial-stage-result")
    ),
    pointers
  };
}

export function buildPartialRecoveryBatch<TInput>(
  parentBatch: Batch<TInput>,
  unresolvedKeys: string[],
  keyOfInput: (item: TInput) => string
): Batch<TInput> {
  const unresolvedSet = new Set(unresolvedKeys);
  if (unresolvedSet.size !== unresolvedKeys.length) {
    throw new Error(
      `lsj-revision-partial-unresolved-duplicate:${parentBatch.id}`
    );
  }
  const items = parentBatch.items.filter((item) =>
    unresolvedSet.has(keyOfInput(item))
  );
  const selectedKeys = items.map(keyOfInput);
  if (!sameArray(selectedKeys, unresolvedKeys)) {
    throw new Error(
      `lsj-revision-partial-unresolved-drift:${parentBatch.id}:${selectedKeys.join(",")}:${unresolvedKeys.join(",")}`
    );
  }
  return {
    id: `${parentBatch.id}-partial-${sha256(unresolvedKeys.join("\n")).slice(0, 12)}`,
    items,
    inputHash: sha256(items.map((item) => stableJson(item)).join("\n") + "\n")
  };
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    return [];
  }
  return value as string[];
}

function mapStagePointers(
  pointers: Map<string, StagePointer>,
  transform: (pointer: StagePointer) => StagePointer
): Map<string, StagePointer> {
  return new Map(
    [...pointers].map(([key, pointer]) => [key, transform(pointer)])
  );
}

function withRecovery(
  pointer: StagePointer,
  recovery: NonNullable<StagePointer["recovery"]>[number]
): StagePointer {
  return {
    ...pointer,
    recovery: [recovery, ...(pointer.recovery ?? [])]
  };
}

function errorMessage(error: Error): string {
  return error.message || error.name;
}

function buildBatches<T>(
  items: T[],
  prefix: string,
  maxItems: number,
  maxBytes: number
): Array<Batch<T>> {
  const batches: Array<Batch<T>> = [];
  let current: T[] = [];
  let bytes = 0;
  for (const item of items) {
    const itemBytes = Buffer.byteLength(JSON.stringify(item));
    if (
      current.length &&
      (current.length >= maxItems || bytes + itemBytes > maxBytes)
    ) {
      batches.push(makeBatch(prefix, batches.length + 1, current));
      current = [];
      bytes = 0;
    }
    current.push(item);
    bytes += itemBytes;
  }
  if (current.length)
    batches.push(makeBatch(prefix, batches.length + 1, current));
  return batches;
}

function makeBatch<T>(prefix: string, serial: number, items: T[]): Batch<T> {
  return {
    id: `${prefix}-${String(serial).padStart(5, "0")}`,
    items,
    inputHash: sha256(items.map(stableJson).join("\n") + "\n")
  };
}

function translationInput(group: LsjGroup): object {
  return {
    key: group.representative.key,
    sourceHash: group.representative.sourceHash,
    memberCount: group.members.length,
    stepCodes: group.members.map((member) => member.stepCode),
    triage: group.triage,
    effectiveVerdict: group.effectiveVerdict,
    preValidation: group.preValidation,
    deterministicIssues: group.representative.issues,
    sourceHtml: group.sourceHtml,
    currentContentHtmlFr: group.currentHtmlFr,
    protection: protectionSummary(group.sourceHtml)
  };
}

function translationSegmentInput(
  group: LsjGroup,
  metadata: { parent: LsjGroup; segment: LsjHtmlTranslationSegment }
): object {
  return {
    key: group.representative.key,
    parentKey: metadata.parent.representative.key,
    sourceHash: metadata.segment.sourceHash,
    segment: {
      index: metadata.segment.index,
      ordinal: metadata.segment.index + 1,
      count: metadata.segment.count,
      sourceBytes: Buffer.byteLength(metadata.segment.sourceHtml)
    },
    sourceHtml: metadata.segment.sourceHtml,
    protection: protectionSummary(metadata.segment.sourceHtml)
  };
}

function translationPrompt(
  groups: LsjGroup[],
  retryFeedback: string[]
): string {
  const prompt = `Tu traduis et corriges en français des notices TFLSJ dont l'anglais STEP est l'autorité éditoriale. Ne challenge pas, ne résume pas et n'enrichis pas la source. Pars du français existant et ne change que ce qui est nécessaire pour obtenir une traduction complète, fidèle, naturelle et publiable.

Contraintes absolues :
- recopier à l'identique et dans le même ordre tous les tags HTML/STEP de sourceHtml ;
- conserver tous les blocs de références, leur ordre et toutes leurs ancres bibliographiques ; leur texte éditorial peut être rendu en français ;
- recopier à l'identique et dans le même ordre chaque token grec/hébreu, code Strong et référence ;
- traduire le métalangage anglais hors citations et supprimer les artefacts de traduction ;
- ne jamais appeler CEL, AI Gateway, le réseau, un outil ou un fichier ; tout est dans les tâches ;
- une sortie par key, aucun Markdown.

Les erreurs de validation d'une tentative précédente doivent être corrigées : ${JSON.stringify(retryFeedback)}
<tasks_jsonl>
${groups.map((group) => JSON.stringify(translationInput(group))).join("\n")}
</tasks_jsonl>`;
  if (!groups.some((group) => Buffer.byteLength(group.sourceHtml) > 30_000)) {
    return prompt;
  }
  return prompt.replace(
    "Contraintes absolues :",
    "La notice volumineuse fournie tient dans la capacité de sortie. Produis impérativement le HTML complet : ne réponds jamais vide et ne refuse jamais pour cause de longueur.\n\nContraintes absolues :"
  );
}

function translationSegmentPrompt(
  inputs: Array<{
    group: LsjGroup;
    metadata: { parent: LsjGroup; segment: LsjHtmlTranslationSegment };
  }>,
  retryFeedback: string[]
): string {
  return `Tu traduis en français un segment structurel d'une longue notice TFLSJ. L'anglais STEP est l'autorité éditoriale. Traduis intégralement le segment sans le résumer, le réorganiser ni l'enrichir. Les segments seront concaténés mécaniquement dans leur ordre source, donc conserve le contenu complet et les séparateurs utiles au début et à la fin du segment.

Contraintes absolues :
- recopier à l'identique et dans le même ordre tous les tags HTML/STEP du segment ;
- conserver tous les blocs de références, leur ordre et toutes leurs ancres bibliographiques ; leur texte éditorial peut être rendu en français ;
- recopier à l'identique et dans le même ordre chaque token grec/hébreu, code Strong et référence ;
- traduire le métalangage anglais hors citations et supprimer les artefacts de traduction ;
- ne jamais appeler CEL, AI Gateway, le réseau, un outil ou un fichier ; tout est dans la tâche ;
- une sortie par key, aucun Markdown.

Les erreurs de validation d'une tentative précédente doivent être corrigées : ${JSON.stringify(retryFeedback)}
<tasks_jsonl>
${inputs
  .map(({ group, metadata }) =>
    JSON.stringify(translationSegmentInput(group, metadata))
  )
  .join("\n")}
</tasks_jsonl>`;
}

function protectedTranslationSegmentPrompt(
  inputs: Array<{
    group: LsjGroup;
    metadata: { parent: LsjGroup; segment: LsjHtmlTranslationSegment };
  }>,
  exhaustedError: Error,
  retryFeedback: string[]
): string {
  return `Tu arbitres la traduction française de segments TFLSJ qui ont échoué uniquement sur des contraintes mécaniques. STEP anglais reste l'unique autorité. Chaque balise HTML/STEP, ouverture typée de bloc ([Refs, [LXX, [NT, [OT), crochet structurel, token grec/hébreu, code Strong, ancre et abréviation bibliographique a été remplacé par un jeton numéroté ⟦STEP_HTML_XXXX⟧ : recopie chaque jeton exactement une fois, dans le même ordre, sans le traduire, le fusionner ni le déplacer hors de son fragment logique. Ne transforme jamais une indication comme ll.12ff ou p565 en une nouvelle référence numérique. Traduis intégralement tout le reste sans résumé ni enrichissement. Aucun outil, réseau, CEL, AI Gateway ou Markdown.

Erreur ayant déclenché l'arbitrage : ${JSON.stringify(exhaustedError.message)}
Erreurs d'une tentative d'arbitrage précédente : ${JSON.stringify(retryFeedback)}
<tasks_jsonl>
${inputs
  .map(({ group, metadata }) => {
    const protection = protectHtmlTagsForAgent(metadata.segment.sourceHtml);
    return JSON.stringify({
      key: group.representative.key,
      parentKey: metadata.parent.representative.key,
      sourceHash: metadata.segment.sourceHash,
      segment: {
        index: metadata.segment.index,
        ordinal: metadata.segment.index + 1,
        count: metadata.segment.count
      },
      sourceHtmlProtected: protection.protectedHtml,
      protectedHtmlTokens: protection.tokens.map((token) => token.placeholder),
      protection: protectionSummary(metadata.segment.sourceHtml)
    });
  })
  .join("\n")}
</tasks_jsonl>`;
}

function reviewPrompt(
  inputs: Array<{ group: LsjGroup; translation: TranslationResult }>,
  retryFeedback: string[]
): string {
  return `Tu es réviseur français minimal de notices TFLSJ. Compare chaque candidateContentHtmlFr à sourceHtml. Si elle est fidèle, complète, naturelle et publiable, réponds accept et mets correctedContentHtmlFr à null : ne produis surtout pas une seconde traduction complète. Réponds correct avec le HTML complet uniquement si une correction réelle est nécessaire. Réponds escalate seulement pour une ambiguïté éditoriale sérieuse.

Toute correction doit conserver exactement la séquence des tags HTML/STEP, les blocs et ancres de références, les tokens grecs/hébreux, les codes Strong et les références. N'ajoute aucune information. Aucun outil, réseau, CEL ou AI Gateway. Raisons brèves en français, aucun Markdown.

Erreurs de validation d'une tentative précédente : ${JSON.stringify(retryFeedback)}
<tasks_jsonl>
${inputs
  .map(({ group, translation }) =>
    JSON.stringify({
      key: group.representative.key,
      sourceHtml: group.sourceHtml,
      candidateContentHtmlFr: translation.contentHtmlFr,
      triage: group.triage,
      protection: protectionSummary(group.sourceHtml)
    })
  )
  .join("\n")}
</tasks_jsonl>`;
}

function arbitrationPrompt(
  inputs: Array<{
    group: LsjGroup;
    translation: TranslationResult;
    review: ReviewResult;
  }>,
  retryFeedback: string[]
): string {
  return `Tu arbitres uniquement des notices TFLSJ signalées à risque ou sur lesquelles traducteur et réviseur divergent. STEP anglais reste l'unique autorité. Choisis translator ou reviewer lorsqu'une proposition est correcte ; utilise corrected uniquement si les deux exigent une correction locale. Retourne le HTML français complet final, sans enrichissement ni résumé.

Contraintes absolues : séquence et graphie exactes des tags HTML/STEP ; ordre et ancres de tous les blocs de références ; tokens grecs/hébreux, codes Strong et références inchangés ; français complet et naturel hors citations. Aucun outil, réseau, CEL ou AI Gateway. Aucun Markdown.

Erreurs de validation d'une tentative précédente : ${JSON.stringify(retryFeedback)}
<tasks_jsonl>
${inputs
  .map(({ group, translation, review }) =>
    JSON.stringify({
      key: group.representative.key,
      sourceHtml: group.sourceHtml,
      translatorContentHtmlFr: translation.contentHtmlFr,
      reviewer: review,
      triage: group.triage,
      protection: protectionSummary(group.sourceHtml)
    })
  )
  .join("\n")}
</tasks_jsonl>`;
}

function translationSchema(count: number): object {
  return collectionSchema("translations", count, {
    type: "object",
    additionalProperties: false,
    required: ["key", "contentHtmlFr", "changeSummary", "confidence"],
    properties: {
      key: { type: "string" },
      contentHtmlFr: { type: "string" },
      changeSummary: { type: "array", items: { type: "string" } },
      confidence: { type: "number", minimum: 0, maximum: 1 }
    }
  });
}

function reviewSchema(count: number): object {
  return collectionSchema("reviews", count, {
    type: "object",
    additionalProperties: false,
    required: [
      "key",
      "verdict",
      "correctedContentHtmlFr",
      "reasons",
      "confidence"
    ],
    properties: {
      key: { type: "string" },
      verdict: { type: "string", enum: ["accept", "correct", "escalate"] },
      correctedContentHtmlFr: { type: ["string", "null"] },
      reasons: { type: "array", items: { type: "string" } },
      confidence: { type: "number", minimum: 0, maximum: 1 }
    }
  });
}

function arbitrationSchema(count: number): object {
  return collectionSchema("arbitrations", count, {
    type: "object",
    additionalProperties: false,
    required: ["key", "contentHtmlFr", "selected", "reasons", "confidence"],
    properties: {
      key: { type: "string" },
      contentHtmlFr: { type: "string" },
      selected: {
        type: "string",
        enum: ["translator", "reviewer", "corrected"]
      },
      reasons: { type: "array", items: { type: "string" } },
      confidence: { type: "number", minimum: 0, maximum: 1 }
    }
  });
}

function collectionSchema(
  property: string,
  count: number,
  item: object
): object {
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

function parseTranslations(
  raw: unknown,
  groups: LsjGroup[]
): TranslationResult[] {
  const results = parseCollection<TranslationResult>(
    raw,
    "translations",
    groups
  );
  for (const result of results) {
    assertStrings(result.changeSummary, `translation-summary:${result.key}`);
    assertConfidence(result.confidence, result.key);
    if (typeof result.contentHtmlFr !== "string")
      throw new Error(`translation-html:${result.key}`);
    const group = groups.find(
      (item) => item.representative.key === result.key
    )!;
    assertValidCandidate(group, result.contentHtmlFr, "translator");
  }
  return orderByGroups(results, groups);
}

export function salvageValidTranslationResults(
  raw: unknown,
  expected: LsjTranslationSalvageInput[]
): LsjTranslationSalvageResult {
  const unresolvedKeys = expected.map((item) => item.key);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { results: [], unresolvedKeys, issues: ["translations-root"] };
  }
  const values = (raw as Record<string, unknown>).translations;
  if (!Array.isArray(values)) {
    return { results: [], unresolvedKeys, issues: ["translations-array"] };
  }
  const expectedByKey = new Map(expected.map((item) => [item.key, item]));
  if (expectedByKey.size !== expected.length) {
    throw new Error("translations-partial-expected-duplicate-key");
  }
  const valuesByKey = new Map<string, unknown[]>();
  const issues: string[] = [];
  for (const value of values) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      issues.push("translations-item");
      continue;
    }
    const key = (value as { key?: unknown }).key;
    if (typeof key !== "string" || !expectedByKey.has(key)) {
      issues.push(`translations-key:${String(key)}`);
      continue;
    }
    const existing = valuesByKey.get(key) ?? [];
    existing.push(value);
    valuesByKey.set(key, existing);
  }
  const results: TranslationResult[] = [];
  for (const item of expected) {
    const candidates = valuesByKey.get(item.key) ?? [];
    if (candidates.length !== 1) {
      issues.push(
        candidates.length === 0
          ? `translations-missing:${item.key}`
          : `translations-duplicate:${item.key}`
      );
      continue;
    }
    const candidate = candidates[0] as Partial<TranslationResult>;
    try {
      if (candidate.key !== item.key) {
        throw new Error(`translation-key:${item.key}`);
      }
      if (typeof candidate.contentHtmlFr !== "string") {
        throw new Error(`translation-html:${item.key}`);
      }
      assertStrings(candidate.changeSummary, `translation-summary:${item.key}`);
      assertConfidence(candidate.confidence, item.key);
      const validation = validateLsjTranslation(
        item.sourceHtml,
        candidate.contentHtmlFr
      );
      if (!validation.valid) {
        throw new Error(
          `translator-validation:${item.key}:${validation.issues.join("|")}`
        );
      }
      results.push(candidate as TranslationResult);
    } catch (error) {
      issues.push(
        errorMessage(error instanceof Error ? error : new Error(String(error)))
      );
    }
  }
  const validKeys = new Set(results.map((result) => result.key));
  return {
    results,
    unresolvedKeys: expected
      .map((item) => item.key)
      .filter((key) => !validKeys.has(key)),
    issues
  };
}

export function salvageValidReviewResults(
  raw: unknown,
  expected: LsjReviewSalvageInput[]
): LsjReviewSalvageResult {
  const unresolvedKeys = expected.map((item) => item.key);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { results: [], unresolvedKeys, issues: ["reviews-root"] };
  }
  const values = (raw as Record<string, unknown>).reviews;
  if (!Array.isArray(values)) {
    return { results: [], unresolvedKeys, issues: ["reviews-array"] };
  }
  const expectedByKey = new Map(expected.map((item) => [item.key, item]));
  if (expectedByKey.size !== expected.length) {
    throw new Error("reviews-partial-expected-duplicate-key");
  }
  const valuesByKey = new Map<string, unknown[]>();
  const issues: string[] = [];
  for (const value of values) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      issues.push("reviews-item");
      continue;
    }
    const key = (value as { key?: unknown }).key;
    if (typeof key !== "string" || !expectedByKey.has(key)) {
      issues.push(`reviews-key:${String(key)}`);
      continue;
    }
    const existing = valuesByKey.get(key) ?? [];
    existing.push(value);
    valuesByKey.set(key, existing);
  }
  const results: ReviewResult[] = [];
  for (const item of expected) {
    const candidates = valuesByKey.get(item.key) ?? [];
    if (candidates.length !== 1) {
      issues.push(
        candidates.length === 0
          ? `reviews-missing:${item.key}`
          : `reviews-duplicate:${item.key}`
      );
      continue;
    }
    const candidate = candidates[0] as Partial<ReviewResult>;
    try {
      if (candidate.key !== item.key) {
        throw new Error(`review-key:${item.key}`);
      }
      if (
        !(["accept", "correct", "escalate"] as const).includes(
          candidate.verdict as ReviewVerdict
        )
      ) {
        throw new Error(`review-verdict:${item.key}`);
      }
      assertStrings(candidate.reasons, `review-reasons:${item.key}`);
      assertConfidence(candidate.confidence, item.key);
      if (candidate.verdict === "correct") {
        if (typeof candidate.correctedContentHtmlFr !== "string") {
          throw new Error(`review-correction-missing:${item.key}`);
        }
        const validation = validateLsjTranslation(
          item.sourceHtml,
          candidate.correctedContentHtmlFr
        );
        if (!validation.valid) {
          throw new Error(
            `reviewer-validation:${item.key}:${validation.issues.join("|")}`
          );
        }
      } else if (candidate.correctedContentHtmlFr !== null) {
        throw new Error(`review-unneeded-full-translation:${item.key}`);
      }
      results.push(candidate as ReviewResult);
    } catch (error) {
      issues.push(
        errorMessage(error instanceof Error ? error : new Error(String(error)))
      );
    }
  }
  const validKeys = new Set(results.map((result) => result.key));
  return {
    results,
    unresolvedKeys: expected
      .map((item) => item.key)
      .filter((key) => !validKeys.has(key)),
    issues
  };
}

function parseSegmentTranslations(
  raw: unknown,
  groups: LsjGroup[]
): TranslationResult[] {
  return parseTranslations(raw, groups).map((result) => {
    const group = groups.find(
      (item) => item.representative.key === result.key
    )!;
    const contentHtmlFr = preserveBoundaryWhitespace(
      group.sourceHtml,
      result.contentHtmlFr
    );
    assertValidCandidate(group, contentHtmlFr, "translator-segmented");
    return { ...result, contentHtmlFr };
  });
}

function parseProtectedSegmentTranslations(
  raw: unknown,
  groups: LsjGroup[]
): TranslationResult[] {
  const results = parseCollection<TranslationResult>(
    raw,
    "translations",
    groups
  );
  for (const result of results) {
    assertStrings(result.changeSummary, `translation-summary:${result.key}`);
    assertConfidence(result.confidence, result.key);
    if (typeof result.contentHtmlFr !== "string") {
      throw new Error(`translation-html:${result.key}`);
    }
    const group = groups.find(
      (item) => item.representative.key === result.key
    )!;
    result.contentHtmlFr = restoreHtmlTagsFromAgent(
      group.sourceHtml,
      result.contentHtmlFr
    );
    assertValidCandidate(
      group,
      result.contentHtmlFr,
      "translator-segmented-arbiter-protected"
    );
  }
  return orderByGroups(results, groups);
}

function parseReviews(
  raw: unknown,
  inputs: Array<{ group: LsjGroup; translation: TranslationResult }>
): ReviewResult[] {
  const groups = inputs.map((input) => input.group);
  const results = parseCollection<ReviewResult>(raw, "reviews", groups);
  for (const result of results) {
    if (
      !(["accept", "correct", "escalate"] as const).includes(result.verdict)
    ) {
      throw new Error(`review-verdict:${result.key}`);
    }
    assertStrings(result.reasons, `review-reasons:${result.key}`);
    assertConfidence(result.confidence, result.key);
    if (result.verdict === "correct") {
      if (typeof result.correctedContentHtmlFr !== "string") {
        throw new Error(`review-correction-missing:${result.key}`);
      }
      const group = groups.find(
        (item) => item.representative.key === result.key
      )!;
      assertValidCandidate(group, result.correctedContentHtmlFr, "reviewer");
    } else if (result.correctedContentHtmlFr !== null) {
      throw new Error(`review-unneeded-full-translation:${result.key}`);
    }
  }
  return orderByGroups(results, groups);
}

function parseArbitrations(
  raw: unknown,
  inputs: Array<{
    group: LsjGroup;
    translation: TranslationResult;
    review: ReviewResult;
  }>
): ArbitrationResult[] {
  const groups = inputs.map((input) => input.group);
  const results = parseCollection<ArbitrationResult>(
    raw,
    "arbitrations",
    groups
  );
  for (const result of results) {
    if (
      !(["translator", "reviewer", "corrected"] as const).includes(
        result.selected
      )
    ) {
      throw new Error(`arbiter-selected:${result.key}`);
    }
    assertStrings(result.reasons, `arbiter-reasons:${result.key}`);
    assertConfidence(result.confidence, result.key);
    if (typeof result.contentHtmlFr !== "string")
      throw new Error(`arbiter-html:${result.key}`);
    const group = groups.find(
      (item) => item.representative.key === result.key
    )!;
    assertValidCandidate(group, result.contentHtmlFr, "arbiter");
    const input = inputs.find(
      (item) => item.group.representative.key === result.key
    )!;
    if (
      result.selected === "translator" &&
      result.contentHtmlFr !== input.translation.contentHtmlFr
    ) {
      throw new Error(`arbiter-translator-mismatch:${result.key}`);
    }
    if (
      result.selected === "reviewer" &&
      result.contentHtmlFr !== input.review.correctedContentHtmlFr
    ) {
      throw new Error(`arbiter-reviewer-mismatch:${result.key}`);
    }
  }
  return orderByGroups(results, groups);
}

function parseCollection<T extends { key: string }>(
  raw: unknown,
  property: string,
  groups: LsjGroup[]
): T[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error(`${property}-root`);
  const values = (raw as Record<string, unknown>)[property];
  if (!Array.isArray(values) || values.length !== groups.length) {
    throw new Error(
      `${property}-count:${Array.isArray(values) ? values.length : "invalid"}:${groups.length}`
    );
  }
  const allowed = new Set(groups.map((group) => group.representative.key));
  const seen = new Set<string>();
  for (const value of values) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error(`${property}-item`);
    const key = (value as { key?: unknown }).key;
    if (typeof key !== "string" || !allowed.has(key) || seen.has(key)) {
      throw new Error(`${property}-key:${String(key)}`);
    }
    seen.add(key);
  }
  return values as T[];
}

function orderByGroups<T extends { key: string }>(
  values: T[],
  groups: LsjGroup[]
): T[] {
  const byKey = new Map(values.map((value) => [value.key, value]));
  return groups.map((group) =>
    required(byKey, group.representative.key, "stage-result")
  );
}

function assertValidCandidate(
  group: LsjGroup,
  candidate: string,
  stage: string
): void {
  const validation = validateLsjTranslation(group.sourceHtml, candidate);
  if (!validation.valid) {
    throw new Error(
      `${stage}-validation:${group.representative.key}:${validation.issues.join("|")}`
    );
  }
}

export function validateLsjTranslation(
  sourceHtml: string,
  contentHtmlFr: string
): ValidationResult {
  const issues: string[] = [];
  const sourceTags = htmlTags(sourceHtml);
  const targetTags = htmlTags(contentHtmlFr);
  const tags = sameArray(sourceTags, targetTags);
  if (!tags) issues.push("html-step-tag-sequence-mismatch");

  const sourceHtmlBalance = htmlBalance(sourceHtml);
  const targetHtmlBalance = htmlBalance(contentHtmlFr);
  const html =
    targetHtmlBalance.valid ||
    (!sourceHtmlBalance.valid &&
      tags &&
      sourceHtmlBalance.reason === targetHtmlBalance.reason);
  if (!html) issues.push(`invalid-html:${targetHtmlBalance.reason}`);

  const sourceBlocks = referenceBlocks(sourceHtml);
  const targetBlocks = referenceBlocks(contentHtmlFr);
  const referenceBlockTopology =
    sourceBlocks.length === targetBlocks.length &&
    sourceBlocks.every((block, index) => {
      const target = targetBlocks[index]!;
      return (
        block.kind === target.kind &&
        sameArray(
          citationAnchors(block.content),
          citationAnchors(target.content)
        )
      );
    });
  if (!referenceBlockTopology) issues.push("reference-block-sequence-mismatch");

  const scripts = sameArray(
    scriptTokens(sourceHtml),
    scriptTokens(contentHtmlFr)
  );
  if (!scripts) issues.push("greek-hebrew-sequence-mismatch");
  const strongs = sameArray(
    strongCodes(sourceHtml),
    strongCodes(contentHtmlFr)
  );
  if (!strongs) issues.push("strong-sequence-mismatch");
  const references = sameArray(
    citationAnchors(sourceHtml),
    citationAnchors(contentHtmlFr)
  );
  if (!references) issues.push("reference-sequence-mismatch");

  const complete = stripHtml(contentHtmlFr).length > 0;
  if (!complete) issues.push("empty-translation");
  const residualEnglish =
    englishResiduesOutsideReferences(contentHtmlFr).length === 0;
  if (!residualEnglish) issues.push("residual-english-prose");
  const sourceTypographyArtifacts = typographyArtifacts(sourceHtml);
  const targetTypographyArtifacts = typographyArtifacts(contentHtmlFr);
  const typography =
    targetTypographyArtifacts.length === 0 ||
    sameArray(sourceTypographyArtifacts, targetTypographyArtifacts);
  if (!typography) issues.push("translation-artifact");

  return {
    valid: issues.length === 0,
    issues,
    checks: {
      complete,
      html,
      tags,
      referenceBlockTopology,
      scripts,
      strongs,
      references,
      residualEnglish,
      typography
    }
  };
}

export function splitLsjHtmlForTranslation(
  sourceHtml: string,
  maxBytes = LSJ_SEGMENT_TARGET_BYTES
): LsjHtmlTranslationSegment[] {
  if (!Number.isInteger(maxBytes) || maxBytes <= 0) {
    throw new Error(`lsj-segment-invalid-max-bytes:${maxBytes}`);
  }
  if (!sourceHtml) throw new Error("lsj-segment-empty-source");
  const parts: string[] = [];
  let start = 0;
  let cursor = 0;
  let squareDepth = 0;
  let lastSafe = 0;
  while (cursor < sourceHtml.length) {
    if (sourceHtml[cursor] === "<") {
      const closing = sourceHtml.indexOf(">", cursor + 1);
      if (closing >= 0) {
        cursor = closing + 1;
        if (
          squareDepth === 0 &&
          /^(?:<\s*\/|<\s*(?:br|hr|img|input|lb|meta|link)\b|<[^<>]*\/\s*>)/iu.test(
            sourceHtml.slice(sourceHtml.lastIndexOf("<", cursor - 1), cursor)
          )
        ) {
          lastSafe = cursor;
        }
      } else {
        cursor = sourceHtml.length;
      }
    } else {
      const codePoint = sourceHtml.codePointAt(cursor)!;
      const character = String.fromCodePoint(codePoint);
      if (character === "[") squareDepth += 1;
      else if (character === "]" && squareDepth > 0) squareDepth -= 1;
      cursor += character.length;
      if (squareDepth === 0 && /\s/u.test(character)) {
        while (cursor < sourceHtml.length) {
          const nextCodePoint = sourceHtml.codePointAt(cursor)!;
          const next = String.fromCodePoint(nextCodePoint);
          if (!/\s/u.test(next)) break;
          cursor += next.length;
        }
        lastSafe = cursor;
      }
    }
    if (Buffer.byteLength(sourceHtml.slice(start, cursor)) < maxBytes) continue;
    if (lastSafe <= start) continue;
    parts.push(sourceHtml.slice(start, lastSafe));
    start = lastSafe;
    if (cursor < start) cursor = start;
    lastSafe = start;
  }
  if (start < sourceHtml.length) parts.push(sourceHtml.slice(start));
  if (parts.join("") !== sourceHtml)
    throw new Error("lsj-segment-source-reassembly");
  const count = parts.length;
  return parts.map((source, index) => ({
    index,
    count,
    sourceHtml: source,
    sourceHash: sha256(source)
  }));
}

export function reassembleLsjTranslationSegments(
  sourceHtml: string,
  segments: LsjHtmlTranslationSegment[],
  translatedHtmlSegments: string[]
): string {
  if (!segments.length || segments.length !== translatedHtmlSegments.length) {
    throw new Error(
      `lsj-segment-count:${segments.length}:${translatedHtmlSegments.length}`
    );
  }
  if (
    segments.some(
      (segment, index) =>
        segment.index !== index ||
        segment.count !== segments.length ||
        segment.sourceHash !== sha256(segment.sourceHtml)
    ) ||
    segments.map((segment) => segment.sourceHtml).join("") !== sourceHtml
  ) {
    throw new Error("lsj-segment-source-drift");
  }
  const contentHtmlFr = translatedHtmlSegments
    .map((translation, index) =>
      preserveBoundaryWhitespace(segments[index]!.sourceHtml, translation)
    )
    .join("");
  const validation = validateLsjTranslation(sourceHtml, contentHtmlFr);
  if (!validation.valid) {
    throw new Error(
      `lsj-segment-aggregate-validation:${validation.issues.join("|")}`
    );
  }
  return contentHtmlFr;
}

function preserveBoundaryWhitespace(
  source: string,
  translation: string
): string {
  const leading = source.match(/^\s*/u)?.[0] ?? "";
  const trailing = source.match(/\s*$/u)?.[0] ?? "";
  const body = translation.replace(/^\s*/u, "").replace(/\s*$/u, "");
  return `${leading}${body}${trailing}`;
}

function segmentedKey(
  parentKey: string,
  segment: Pick<LsjHtmlTranslationSegment, "index" | "count" | "sourceHash">
): string {
  return `${parentKey}::segment-${String(segment.index + 1).padStart(3, "0")}-of-${String(segment.count).padStart(3, "0")}-${segment.sourceHash.slice(0, 12)}`;
}

function typographyArtifacts(value: string): string[] {
  return [
    ...value.matchAll(/,,|\uFFFD|\[\[|\]\]|\b(?:undefined|null)\b/giu)
  ].map((match) => match[0].toLowerCase());
}

function protectionSummary(sourceHtml: string): object {
  const tags = htmlTags(sourceHtml);
  const blocks = referenceBlocks(sourceHtml);
  const scripts = scriptTokens(sourceHtml);
  const strongs = strongCodes(sourceHtml);
  const references = citationAnchors(sourceHtml);
  return {
    htmlTags: protectedDigest(tags),
    referenceBlocks: protectedDigest(
      blocks.map(
        (block) => `${block.kind}:${citationAnchors(block.content).join("|")}`
      )
    ),
    scriptTokens: protectedDigest(scripts),
    strongCodes: protectedDigest(strongs),
    references: protectedDigest(references)
  };
}

function protectedDigest(values: string[]): { count: number; sha256: string } {
  return { count: values.length, sha256: sha256(values.join("\n")) };
}

export function protectHtmlTagsForAgent(sourceHtml: string): {
  protectedHtml: string;
  tokens: Array<{ placeholder: string; tag: string }>;
} {
  const tokens: Array<{ placeholder: string; tag: string }> = [];
  const protectedHtml = sourceHtml.replace(
    /\[(?:Refs?|Réf(?:érence)?s?|NT|OT|LXX)\b|<[^<>]+>|\x5B|\x5D|(?<![\p{L}\p{N}])[GH]\d{3,5}[A-Z]?(?:-[A-Za-z]+)?(?![\p{L}\p{N}])|[\p{Script=Greek}\p{Script=Hebrew}][\p{Script=Greek}\p{Script=Hebrew}\p{M}᾽'’.-]*|\b(?:NT\.)?[1-4]?[A-Z][A-Za-z]{1,14}\.\d+(?:\.\d+)+(?:[-–]\d+)?\b|(?<![\p{L}\p{N}])\d+(?:\.\d+){1,3}[a-z]?(?![\p{L}\p{N}])|\b(?:pp?|vol|ll?|lines?)\.?\s*\d+(?:[-–,]\d+)*(?:ff|sqq?)?\.?(?![\p{L}\p{N}])|(?<![\p{L}\p{N}])\d+(?:[-–,]\d+)*(?:ff|sqq?)\.?(?![\p{L}\p{N}])/giu,
    (tag) => {
      const placeholder = `⟦STEP_HTML_${String(tokens.length).padStart(4, "0")}⟧`;
      if (sourceHtml.includes(placeholder)) {
        throw new Error(
          `lsj-protected-html-placeholder-collision:${placeholder}`
        );
      }
      tokens.push({ placeholder, tag });
      return placeholder;
    }
  );
  return { protectedHtml, tokens };
}

export function restoreHtmlTagsFromAgent(
  sourceHtml: string,
  translatedProtectedHtml: string
): string {
  const protection = protectHtmlTagsForAgent(sourceHtml);
  const observed = [
    ...translatedProtectedHtml.matchAll(/⟦STEP_HTML_\d{4}⟧/gu)
  ].map((match) => match[0]);
  const expected = protection.tokens.map((token) => token.placeholder);
  if (!sameArray(observed, expected)) {
    throw new Error(
      `lsj-protected-html-token-sequence:${observed.length}:${expected.length}`
    );
  }
  let restored = translatedProtectedHtml;
  for (const token of protection.tokens) {
    const first = restored.indexOf(token.placeholder);
    if (first < 0 || restored.indexOf(token.placeholder, first + 1) >= 0) {
      throw new Error(`lsj-protected-html-token-count:${token.placeholder}`);
    }
    restored = restored.replace(token.placeholder, token.tag);
  }
  if (/⟦STEP_HTML_\d{4}⟧/u.test(restored)) {
    throw new Error("lsj-protected-html-token-extra");
  }
  return restored;
}

function htmlTags(value: string): string[] {
  return [...value.matchAll(/<[^<>]+>/gu)].map((match) => match[0]);
}

function htmlBalance(value: string): { valid: boolean; reason?: string } {
  const stack: string[] = [];
  const voidTags = new Set(["br", "hr", "img", "input", "lb", "meta", "link"]);
  const normalized = value.replace(/<(ref|strong)=/giu, "<$1 data-value=");
  for (const match of normalized.matchAll(
    /<\s*(\/)?\s*([a-z][\w-]*)(?:\s[^<>]*)?>/giu
  )) {
    const closing = Boolean(match[1]);
    const tag = match[2].toLowerCase();
    if (voidTags.has(tag) || /\/\s*>$/u.test(match[0])) continue;
    if (!closing) stack.push(tag);
    else if (stack.pop() !== tag)
      return { valid: false, reason: `unexpected-closing:${tag}` };
  }
  return stack.length
    ? { valid: false, reason: `unclosed:${stack.join(",")}` }
    : { valid: true };
}

function referenceBlocks(
  value: string
): Array<{ kind: string; content: string }> {
  const results: Array<{ kind: string; content: string }> = [];
  const opening = /\[(Refs?|Réf(?:érence)?s?|NT|OT|LXX)\b/giu;
  let searchFrom = 0;
  for (;;) {
    opening.lastIndex = searchFrom;
    const match = opening.exec(value);
    if (!match) break;
    let depth = 0;
    let end = -1;
    for (let index = match.index; index < value.length; index += 1) {
      if (value[index] === "[") depth += 1;
      else if (value[index] === "]") {
        depth -= 1;
        if (depth === 0) {
          end = index + 1;
          break;
        }
      }
    }
    if (end < 0) {
      results.push({
        kind: canonicalBlockKind(match[1]),
        content: value.slice(match.index)
      });
      break;
    }
    results.push({
      kind: canonicalBlockKind(match[1]),
      content: value.slice(match.index, end)
    });
    searchFrom = end;
  }
  return results;
}

function canonicalBlockKind(value: string): string {
  const normalized = value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
  if (normalized.startsWith("ref")) return "refs";
  return normalized;
}

function citationAnchors(value: string): string[] {
  const anchors: Array<{ index: number; value: string }> = [];
  const patterns = [
    /\b(?:NT\.)?[1-4]?[A-Z][A-Za-z]{1,14}\.\d+(?:\.\d+)+(?:[-–]\d+)?\b/gu,
    /(?<![\p{L}\p{N}])\d+(?:\.\d+){1,3}[a-z]?(?![\p{L}\p{N}])/gu,
    /\b(?:pp?|vol)\.\s*\d+(?:[-–,]\d+)*\b/giu
  ];
  for (const pattern of patterns) {
    for (const match of value.matchAll(pattern))
      anchors.push({ index: match.index!, value: match[0] });
  }
  anchors.sort(
    (a, b) => a.index - b.index || a.value.localeCompare(b.value, "en")
  );
  const seenAt = new Set<string>();
  return anchors
    .filter((anchor) => {
      const key = `${anchor.index}:${anchor.value}`;
      if (seenAt.has(key)) return false;
      seenAt.add(key);
      return true;
    })
    .map((anchor) => anchor.value);
}

function scriptTokens(value: string): string[] {
  return [
    ...value.matchAll(
      /[\p{Script=Greek}\p{Script=Hebrew}][\p{Script=Greek}\p{Script=Hebrew}\p{M}᾽'’.-]*/gu
    )
  ].map((match) => match[0]);
}

function strongCodes(value: string): string[] {
  return [
    ...value.matchAll(
      /(?<![\p{L}\p{N}])[GH]\d{3,5}[A-Z]?(?:-[A-Za-z]+)?(?![\p{L}\p{N}])/gu
    )
  ].map((match) => match[0]);
}

function englishResiduesOutsideReferences(value: string): string[] {
  let withoutReferences = value;
  for (const block of [...referenceBlocks(value)].reverse()) {
    withoutReferences = withoutReferences.replace(block.content, " ");
  }
  const text = stripHtml(withoutReferences);
  const pattern =
    /\b(?:according to|also used|and the|as a|as an|called|chiefly|compare|corresponding to|derived from|especially|figuratively|in the|meaning|metaphorically|namely|only used|properly|refers to|therefore|usually|whereas|which is|without)\b/giu;
  return [
    ...new Set(
      [...text.matchAll(pattern)].map((match) => match[0].toLowerCase())
    )
  ];
}

async function executeAgent(input: {
  options: Options;
  directory: string;
  attempt: number;
  prompt: string;
  schemaPath: string;
  profile: AgentProfile;
}): Promise<AgentExecution> {
  const prefix = `attempt-${String(input.attempt).padStart(3, "0")}`;
  const responsePath = resolve(input.directory, `${prefix}-response.json`);
  const executable = prepareFrenchCodexImmutableExecution(
    input.options.codexBinary
  );
  rmSync(responsePath, { force: true });
  const startedAt = new Date().toISOString();
  const args = frenchCodexProposerExecArgs({
    model: input.profile.model,
    reasoningEffort: input.profile.reasoning,
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
        ? `lsj-agent-timeout:${input.options.timeoutMs}`
        : `lsj-agent-exit:${exitCode}:${stderr.slice(-500)}`
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

function parseOptions(values: string[]): Options {
  const args = parseArgs(values);
  const outputRoot = resolve(args.output ?? DEFAULT_ROOT);
  return {
    recordsPath: resolve(
      args.records ?? "outputs/lexicon-fr-quality/audit/records.jsonl"
    ),
    tasksPath: resolve(
      args.tasks ?? "outputs/lexicon-fr-quality/triage/lsj/tasks.jsonl"
    ),
    decisionsPath: resolve(
      args.decisions ?? "outputs/lexicon-fr-quality/triage/lsj/decisions.jsonl"
    ),
    outputRoot,
    codexBinary: resolve(
      args["codex-binary"] ?? FRENCH_CODEX_IMMUTABLE_BINARY_PATH
    ),
    codexHome: resolve(args["codex-home"] ?? "/Users/stephane/.codex"),
    translator: {
      model: args["translator-model"] ?? "gpt-5.6-sol",
      reasoning: args["translator-reasoning"] ?? "low"
    },
    reviewer: {
      model: args["reviewer-model"] ?? "gpt-5.6-terra",
      reasoning: args["reviewer-reasoning"] ?? "low"
    },
    arbiter: {
      model: args["arbiter-model"] ?? "gpt-5.6-sol",
      reasoning: args["arbiter-reasoning"] ?? "medium"
    },
    concurrency: integer(args.concurrency, 4),
    maxAttempts: integer(args["max-attempts"], 4),
    timeoutMs: integer(args["timeout-ms"], 1_200_000),
    allowPartial: boolean(args["allow-partial"], false),
    reuseTranslations: boolean(args["reuse-translations"], false),
    skipReviewer: boolean(args["skip-reviewer"], false),
    limit: args.limit === undefined ? null : integer(args.limit, 0)
  };
}

function parseArgs(values: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--"))
      throw new Error(`unexpected-argument:${value}`);
    const [key, inline] = value.slice(2).split("=", 2);
    result[key] = inline ?? values[++index] ?? "";
  }
  return result;
}

function integer(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  if (!/^\d+$/u.test(value)) throw new Error(`invalid-integer:${value}`);
  return Number(value);
}

function boolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`invalid-boolean:${value}`);
}

function field(
  record: AuditRecord,
  name: string,
  side: "source" | "translation"
): string {
  const value = record.fields[name];
  if (!value)
    throw new Error(`lsj-revision-field-missing:${record.key}:${name}`);
  return value[side];
}

function required<K, V>(map: Map<K, V>, key: K, label: string): V {
  const value = map.get(key);
  if (value === undefined) throw new Error(`${label}-missing:${String(key)}`);
  return value;
}

function assertStrings(
  value: unknown,
  label: string
): asserts value is string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(label);
  }
}

function assertConfidence(
  value: unknown,
  key: string
): asserts value is number {
  if (typeof value !== "number" || value < 0 || value > 1) {
    throw new Error(`confidence:${key}`);
  }
}

function artifact(path: string): {
  path: string;
  sha256: string;
  bytes: number;
} {
  const value = readFileSync(path);
  return { path, sha256: sha256(value), bytes: value.byteLength };
}

function stripHtml(value: string): string {
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

function sameArray(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

async function readJsonl<T>(path: string): Promise<T[]> {
  const values: T[] = [];
  const reader = createInterface({
    input: createReadStream(path, { encoding: "utf8" }),
    crlfDelay: Infinity
  });
  for await (const line of reader)
    if (line.trim()) values.push(JSON.parse(line) as T);
  return values;
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

function installJsonl(path: string, values: unknown[]): void {
  installText(
    path,
    values.map(stableJson).join("\n") + (values.length ? "\n" : "")
  );
}

function installText(path: string, value: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(temporary, value, "utf8");
  renameSync(temporary, path);
}

function signalGroup(pid: number | undefined, signal: NodeJS.Signals): void {
  if (!pid) return;
  try {
    process.kill(process.platform === "win32" ? pid : -pid, signal);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
}

if (process.argv[1]?.endsWith("runFrenchLsjRevision.ts")) {
  void main();
}
