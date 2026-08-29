import {
  frenchRenderedHtmlSkeleton,
  frenchSourceHtmlSkeleton,
  renderFrenchHtmlTemplate,
  type FrenchHtmlTemplate
} from "./frenchHtmlRenderer.js";
import { hashFrenchInternalJson } from "./frenchInternalReview.js";
import type { FrenchInternalProposerAView } from "./frenchInternalWork.js";
import {
  FRENCH_PROPOSAL_SCHEMA_VERSION,
  normalizeFrenchEntityForm,
  validateFrenchProposal,
  type FrenchEntityMentionTranslation,
  type FrenchLexiconProposal,
  type FrenchValidationIssue
} from "./frenchValidation.js";

export const FRENCH_ADAPTIVE_TASK_SCHEMA_VERSION =
  "lexicon-v3-french-adaptive-task@1" as const;
export const FRENCH_ADAPTIVE_DRAFT_SCHEMA_VERSION =
  "lexicon-v3-french-adaptive-draft@1" as const;
export const FRENCH_ADAPTIVE_REVIEW_SCHEMA_VERSION =
  "lexicon-v3-french-adaptive-review@1" as const;
export const FRENCH_ADAPTIVE_ARBITRATION_SCHEMA_VERSION =
  "lexicon-v3-french-adaptive-arbitration@1" as const;
export const FRENCH_ADAPTIVE_FINAL_SCHEMA_VERSION =
  "lexicon-v3-french-adaptive-final@1" as const;
export const FRENCH_ADAPTIVE_PIPELINE_VERSION =
  "lexicon-v3-french-adaptive-pipeline@1" as const;

export interface FrenchAdaptiveEntityMention {
  mentionId: string;
  segmentId: string;
  allowedFrenchForms: string[];
}

export interface FrenchAdaptiveTask {
  schemaVersion: typeof FRENCH_ADAPTIVE_TASK_SCHEMA_VERSION;
  entryKey: string;
  sourceHash: string;
  taskHash: string;
  releaseKey: string;
  identity: {
    stepEntryId: number;
    language: "greek" | "hebrew";
    eStrong: string;
    dStrong: string;
    uStrong: string;
    original: string;
    transliteration: string;
    morph: string;
  };
  english: {
    gloss: string;
    meaning: string;
    meaningHtml: string;
    segments: Array<{ id: string; text: string }>;
  };
  htmlTemplate: FrenchHtmlTemplate;
  protectedContent: {
    strongCodes: string[];
    references: string[];
    referenceLiterals: string[];
    originalTokens: string[];
    numericLiterals: string[];
    sigla: string[];
  };
  entityGlossFr: string | null;
  entityMentions: FrenchAdaptiveEntityMention[];
  riskReasons: string[];
  size: "short" | "medium" | "long" | "very_long";
}

export interface FrenchAdaptiveDraft {
  schemaVersion: typeof FRENCH_ADAPTIVE_DRAFT_SCHEMA_VERSION;
  entryKey: string;
  sourceHash: string;
  glossFr: string;
  meaningSegmentsFr: Array<{ id: string; text: string }>;
  entityMentionsFr: FrenchEntityMentionTranslation[];
  confidence: number;
}

export interface FrenchAdaptiveValidationIssue {
  code: string;
  severity: "error" | "warning";
  message: string;
}

export interface FrenchAdaptiveValidation {
  valid: boolean;
  issues: FrenchAdaptiveValidationIssue[];
  checks: {
    lineage: boolean;
    segmentCoverage: boolean;
    htmlStructure: boolean;
    protectedContent: boolean;
    noEnglishResidue: boolean;
    entities: boolean;
    gloss: boolean;
  };
  rendered: {
    meaningFr: string;
    meaningHtmlFr: string;
  } | null;
  validationHash: string;
}

export interface FrenchAdaptiveReviewPatch {
  gloss: { apply: boolean; value: string };
  segmentUpdates: Array<{ id: string; text: string }>;
  entityMentions: {
    apply: boolean;
    value: FrenchEntityMentionTranslation[];
  };
  confidence: { apply: boolean; value: number };
}

export interface FrenchAdaptiveReview {
  schemaVersion: typeof FRENCH_ADAPTIVE_REVIEW_SCHEMA_VERSION;
  entryKey: string;
  sourceHash: string;
  translationHash: string;
  verdict: "accept" | "correct" | "escalate";
  reasons: string[];
  patch: FrenchAdaptiveReviewPatch;
}

export interface FrenchAdaptiveArbitration {
  schemaVersion: typeof FRENCH_ADAPTIVE_ARBITRATION_SCHEMA_VERSION;
  entryKey: string;
  sourceHash: string;
  translatorHash: string;
  reviewerHash: string;
  verdict: "translator" | "reviewer" | "corrected";
  reasons: string[];
  finalDraft: FrenchAdaptiveDraft;
}

export interface FrenchAdaptiveFinalRecord {
  schemaVersion: typeof FRENCH_ADAPTIVE_FINAL_SCHEMA_VERSION;
  pipelineVersion: typeof FRENCH_ADAPTIVE_PIPELINE_VERSION;
  entryKey: string;
  sourceHash: string;
  taskHash: string;
  translationHash: string;
  reviewHash: string;
  arbitrationHash: string | null;
  finalHash: string;
  glossFr: string;
  meaningFr: string;
  meaningHtmlFr: string;
  meaningSegmentsFr: Array<{ id: string; text: string }>;
  entityMentionsFr: FrenchEntityMentionTranslation[];
  validation: FrenchAdaptiveValidation;
  riskReasons: string[];
}

const CLEAR_ENGLISH_RESIDUE =
  /(?<![\p{L}\p{M}\p{N}_])(?:the|which|with|without|from|into|upon|whose|whereby|therefore|namely|hence|properly|figuratively|metaphorically|probably|perhaps|usually|especially|chiefly|meaning|spelling|compare|see\s+word|used\s+(?:of|for|as)|in\s+the\s+(?:lxx|nt|ot))(?![\p{L}\p{M}\p{N}_])/iu;

export function buildFrenchAdaptiveTask(
  view: FrenchInternalProposerAView
): FrenchAdaptiveTask {
  const segments = view.translationTask.htmlTemplate.tokens.flatMap((token) =>
    token.kind === "text" && token.translatable
      ? [{ id: token.id, text: token.sourceText }]
      : []
  );
  const entityMentions = view.entityConstraints.requiredMentions
    .filter((mention) => mention.resolution === "exact")
    .map((mention) => ({
      mentionId: mention.mentionId,
      segmentId: mention.segmentId,
      allowedFrenchForms: [...mention.allowedFrenchForms]
    }));
  const policy = view.entityConstraints.entryPolicy;
  const entityGlossFr = policy
    ? (policy.derivedFr ?? policy.primaryFr ?? null)
    : null;
  const rejectedMechanicalReferences = view.protectedContent.references.filter(
    (reference) =>
      !frenchAdaptiveReferenceIsMechanicallyAttested(
        reference,
        view.english.meaning
      )
  );
  const references = view.protectedContent.references.filter(
    (reference) => !rejectedMechanicalReferences.includes(reference)
  );
  const riskReasons = [
    ...frenchAdaptiveRiskReasons(view),
    ...rejectedMechanicalReferences.map(
      (reference) => `mechanical-reference-filter:${reference}`
    )
  ].sort();
  const content = {
    schemaVersion: FRENCH_ADAPTIVE_TASK_SCHEMA_VERSION,
    entryKey: view.entryKey,
    sourceHash: view.english.contentHash,
    releaseKey: view.lineage.releaseKey,
    identity: {
      stepEntryId: view.identity.stepEntryId,
      language: view.identity.language,
      eStrong: view.identity.eStrong,
      dStrong: view.identity.dStrong,
      uStrong: view.identity.uStrong,
      original: view.identity.original,
      transliteration: view.identity.transliteration,
      morph: view.identity.morph
    },
    english: {
      gloss: view.english.gloss,
      meaning: view.english.meaning,
      meaningHtml: view.english.meaningHtml,
      segments
    },
    htmlTemplate: view.translationTask.htmlTemplate,
    protectedContent: {
      strongCodes: [...view.protectedContent.strongCodes],
      references,
      referenceLiterals: [...view.protectedContent.referenceLiterals],
      originalTokens: [...view.protectedContent.originalTokens],
      numericLiterals: filterFrenchAdaptiveProtectedNumericLiterals(
        view.protectedContent.numericLiterals
      ),
      sigla: [...view.protectedContent.sigla]
    },
    entityGlossFr,
    entityMentions,
    riskReasons,
    size: view.translationProfile.meaningSize
  };
  return { ...content, taskHash: hashFrenchInternalJson(content) };
}

export function filterFrenchAdaptiveProtectedNumericLiterals(
  literals: string[]
): string[] {
  // A numeric literal cannot contain whitespace. Values such as “39 -29”
  // come from two adjacent reference fragments merged by the upstream parser;
  // canonical Bible references are protected independently.
  return literals.filter((literal) => !/\s/u.test(literal));
}

export function frenchAdaptiveReferenceIsMechanicallyAttested(
  reference: string,
  sourceMeaning: string
): boolean {
  const match = /\.([0-9]+)\.([0-9]+)$/u.exec(reference);
  if (!match) return true;
  const chapter = escapeRegExp(match[1]!);
  const verse = escapeRegExp(match[2]!);
  const sourceVerseSuffix = "(?:[a-d]|ff?)?";
  const direct = new RegExp(
    `(?<![0-9])${chapter}[.:]${verse}${sourceVerseSuffix}(?![\\p{L}\\p{N}])`,
    "iu"
  );
  if (direct.test(sourceMeaning)) return true;
  const chapterAnchor = new RegExp(
    `(?<![0-9])${chapter}[.:][0-9]+`,
    "u"
  );
  const continuation = new RegExp(
    `(?:[,;]\\s*|\\bib\\.?\\s*|\\b(?:and|or)\\s+)${verse}${sourceVerseSuffix}(?![\\p{L}\\p{N}])`,
    "iu"
  );
  return chapterAnchor.test(sourceMeaning) && continuation.test(sourceMeaning);
}

export function frenchAdaptiveTaskForAgent(task: FrenchAdaptiveTask): object {
  return {
    entryKey: task.entryKey,
    identity: task.identity,
    english: {
      gloss: task.english.gloss,
      segments: task.english.segments
    },
    entityGlossFr: task.entityGlossFr,
    entityMentions: task.entityMentions,
    riskReasons: task.riskReasons
  };
}

export function frenchAdaptiveTranslationHash(
  draft: FrenchAdaptiveDraft
): string {
  return hashFrenchInternalJson(draft);
}

export function frenchAdaptiveReviewHash(review: FrenchAdaptiveReview): string {
  return hashFrenchInternalJson(review);
}

export function validateFrenchAdaptiveDraft(input: {
  task: FrenchAdaptiveTask;
  draft: FrenchAdaptiveDraft;
  model: string;
}): FrenchAdaptiveValidation {
  const issues: FrenchAdaptiveValidationIssue[] = [];
  const { task, draft } = input;
  const lineage =
    draft.schemaVersion === FRENCH_ADAPTIVE_DRAFT_SCHEMA_VERSION &&
    draft.entryKey === task.entryKey &&
    draft.sourceHash === task.sourceHash;
  if (!lineage) {
    issues.push(error("lineage-mismatch", "Entrée ou hash anglais incorrect."));
  }

  const expectedIds = task.english.segments.map((segment) => segment.id);
  const actualIds = draft.meaningSegmentsFr.map((segment) => segment.id);
  const segmentCoverage =
    actualIds.length === expectedIds.length &&
    actualIds.every((id, index) => id === expectedIds[index]) &&
    new Set(actualIds).size === actualIds.length &&
    draft.meaningSegmentsFr.every((segment) => segment.text.trim().length > 0);
  if (!segmentCoverage) {
    issues.push(
      error(
        "segment-coverage-mismatch",
        "Les segments traduits ne couvrent pas exactement les segments STEP."
      )
    );
  }

  let rendered: FrenchAdaptiveValidation["rendered"] = null;
  let htmlStructure = false;
  if (segmentCoverage) {
    try {
      rendered = renderFrenchHtmlTemplate(
        task.htmlTemplate,
        draft.meaningSegmentsFr
      );
      htmlStructure =
        arraysEqual(
          frenchSourceHtmlSkeleton(task.english.meaningHtml),
          frenchRenderedHtmlSkeleton(rendered.meaningHtmlFr)
        );
    } catch {
      htmlStructure = false;
    }
  }
  if (!htmlStructure) {
    issues.push(
      error(
        "html-structure-mismatch",
        "La structure HTML reconstruite ne correspond pas à STEP."
      )
    );
  }

  if (!draft.glossFr.trim()) {
    issues.push(error("empty-gloss", "Le gloss français est vide."));
  }
  if (!Number.isFinite(draft.confidence) || draft.confidence < 0 || draft.confidence > 1) {
    issues.push(error("invalid-confidence", "La confiance doit être comprise entre 0 et 1."));
  }

  if (rendered) {
    const proposal: FrenchLexiconProposal = {
      schemaVersion: FRENCH_PROPOSAL_SCHEMA_VERSION,
      entryKey: task.entryKey,
      derivedFromEnglishHash: task.sourceHash,
      model: input.model,
      glossFr: draft.glossFr,
      meaningSegmentsFr: draft.meaningSegmentsFr,
      entityMentionsFr: draft.entityMentionsFr,
      meaningFr: rendered.meaningFr,
      meaningHtmlFr: rendered.meaningHtmlFr,
      notesFr: "",
      carrierTermsFr: [],
      confidence: draft.confidence
    };
    const base = validateFrenchProposal(proposal, {
      entryKey: task.entryKey,
      englishHash: task.sourceHash,
      englishStatus: "validated",
      englishGloss: task.english.gloss,
      englishMeaning: task.english.meaning,
      original: task.identity.original,
      morph: task.identity.morph,
      sourceStrongCodes: task.protectedContent.strongCodes,
      sourceReferences: task.protectedContent.references,
      concordanceForms: [],
      requiredEntityMentions: task.entityMentions.map((mention) => ({
        ...mention,
        sourceEntryKey: task.entryKey,
        sourceSurface: "",
        citedStrong: null,
        resolution: "exact" as const,
        targetEntityIds: [],
        targetEntryKey: null,
        contentHash: hashFrenchInternalJson(mention)
      }))
    });
    issues.push(...base.issues.map(fromLegacyIssue));
  }

  const display = `${draft.glossFr} ${rendered?.meaningFr ?? draft.meaningSegmentsFr.map((s) => s.text).join(" ")}`;
  const protectedIssues = validateAdaptiveProtectedContent(task, display);
  issues.push(...protectedIssues);
  const protectedContent = protectedIssues.length === 0;

  const residueCandidate = stripSharedEnglishBibliographicTitles(
    task.english.meaning,
    display
  );
  const noEnglishResidue = !CLEAR_ENGLISH_RESIDUE.test(residueCandidate);
  if (!noEnglishResidue) {
    issues.push(
      error(
        "residual-english-extended",
        "Du vocabulaire lexicographique anglais subsiste dans le français."
      )
    );
  }

  const entityIssues = issues.filter((issue) => issue.code.includes("entity"));
  const entities = entityIssues.length === 0;
  if (
    task.entityGlossFr !== null &&
    normalizeFrenchEntityForm(draft.glossFr) !==
      normalizeFrenchEntityForm(task.entityGlossFr)
  ) {
    issues.push(
      error(
        "entity-gloss-mismatch",
        `Le gloss doit employer le lemme canonique « ${task.entityGlossFr} ».`
      )
    );
  }

  const deduped = dedupeIssues(issues);
  const checks = {
    lineage,
    segmentCoverage,
    htmlStructure,
    protectedContent,
    noEnglishResidue,
    entities:
      entities && !deduped.some((issue) => issue.code === "entity-gloss-mismatch"),
    gloss: !deduped.some((issue) =>
      ["empty-gloss", "entity-gloss-mismatch"].includes(issue.code)
    )
  };
  const content = {
    valid: deduped.length === 0 && Object.values(checks).every(Boolean),
    issues: deduped,
    checks,
    rendered
  };
  return { ...content, validationHash: hashFrenchInternalJson(content) };
}

function stripSharedEnglishBibliographicTitles(
  sourceEnglish: string,
  translatedDisplay: string
): string {
  // An untranslated bibliographic title is not editorial English residue.
  // Only exempt title-case phrases that occur verbatim in STEP and in the
  // French output; ordinary prose such as “the lexical meaning” stays gated.
  const titles = sourceEnglish.match(
    /\b(?:The|A|An)(?:\s+[A-Z][A-Za-z'’.-]+){1,8}\b/gu
  );
  if (!titles) return translatedDisplay;
  return [...new Set(titles)]
    .sort((left, right) => right.length - left.length)
    .reduce(
      (value, title) => value.replaceAll(title, " "),
      translatedDisplay
    );
}

export function applyFrenchAdaptiveReview(
  task: FrenchAdaptiveTask,
  draft: FrenchAdaptiveDraft,
  review: FrenchAdaptiveReview
): FrenchAdaptiveDraft {
  if (
    review.schemaVersion !== FRENCH_ADAPTIVE_REVIEW_SCHEMA_VERSION ||
    review.entryKey !== task.entryKey ||
    review.sourceHash !== task.sourceHash ||
    review.translationHash !== frenchAdaptiveTranslationHash(draft)
  ) {
    throw new Error(`invalid-french-adaptive-review-lineage:${task.entryKey}`);
  }
  if (review.verdict === "accept") {
    if (
      review.patch.gloss.apply ||
      review.patch.segmentUpdates.length > 0 ||
      review.patch.entityMentions.apply ||
      review.patch.confidence.apply
    ) {
      throw new Error(`invalid-french-adaptive-accept-patch:${task.entryKey}`);
    }
    return draft;
  }
  const segments = new Map(
    draft.meaningSegmentsFr.map((segment) => [segment.id, segment.text])
  );
  const seen = new Set<string>();
  for (const update of review.patch.segmentUpdates) {
    if (!segments.has(update.id) || seen.has(update.id) || !update.text.trim()) {
      throw new Error(`invalid-french-adaptive-segment-patch:${task.entryKey}`);
    }
    seen.add(update.id);
    segments.set(update.id, update.text);
  }
  return {
    ...draft,
    glossFr: review.patch.gloss.apply
      ? review.patch.gloss.value
      : draft.glossFr,
    meaningSegmentsFr: draft.meaningSegmentsFr.map((segment) => ({
      id: segment.id,
      text: segments.get(segment.id)!
    })),
    entityMentionsFr: review.patch.entityMentions.apply
      ? review.patch.entityMentions.value
      : draft.entityMentionsFr,
    confidence: review.patch.confidence.apply
      ? review.patch.confidence.value
      : draft.confidence
  };
}

export function frenchAdaptiveNeedsArbitration(input: {
  task: FrenchAdaptiveTask;
  translatorValidation: FrenchAdaptiveValidation;
  review: FrenchAdaptiveReview;
  reviewedValidation: FrenchAdaptiveValidation;
}): boolean {
  return (
    input.task.riskReasons.length > 0 ||
    !input.translatorValidation.valid ||
    input.review.verdict !== "accept" ||
    !input.reviewedValidation.valid
  );
}

export function buildFrenchAdaptiveFinalRecord(input: {
  task: FrenchAdaptiveTask;
  translation: FrenchAdaptiveDraft;
  review: FrenchAdaptiveReview;
  reviewedDraft: FrenchAdaptiveDraft;
  arbitration: FrenchAdaptiveArbitration | null;
  model: string;
}): FrenchAdaptiveFinalRecord {
  const finalDraft = input.arbitration?.finalDraft ?? input.reviewedDraft;
  const validation = validateFrenchAdaptiveDraft({
    task: input.task,
    draft: finalDraft,
    model: input.model
  });
  if (!validation.valid || !validation.rendered) {
    throw new Error(`french-adaptive-final-invalid:${input.task.entryKey}`);
  }
  if (
    input.arbitration &&
    (input.arbitration.entryKey !== input.task.entryKey ||
      input.arbitration.sourceHash !== input.task.sourceHash ||
      input.arbitration.translatorHash !==
        frenchAdaptiveTranslationHash(input.translation) ||
      input.arbitration.reviewerHash !== frenchAdaptiveReviewHash(input.review))
  ) {
    throw new Error(`french-adaptive-arbitration-lineage:${input.task.entryKey}`);
  }
  const finalHash = frenchAdaptiveTranslationHash(finalDraft);
  return {
    schemaVersion: FRENCH_ADAPTIVE_FINAL_SCHEMA_VERSION,
    pipelineVersion: FRENCH_ADAPTIVE_PIPELINE_VERSION,
    entryKey: input.task.entryKey,
    sourceHash: input.task.sourceHash,
    taskHash: input.task.taskHash,
    translationHash: frenchAdaptiveTranslationHash(input.translation),
    reviewHash: frenchAdaptiveReviewHash(input.review),
    arbitrationHash: input.arbitration
      ? hashFrenchInternalJson(input.arbitration)
      : null,
    finalHash,
    glossFr: finalDraft.glossFr,
    meaningFr: validation.rendered.meaningFr,
    meaningHtmlFr: validation.rendered.meaningHtmlFr,
    meaningSegmentsFr: finalDraft.meaningSegmentsFr,
    entityMentionsFr: finalDraft.entityMentionsFr,
    validation,
    riskReasons: input.task.riskReasons
  };
}

function frenchAdaptiveRiskReasons(
  view: FrenchInternalProposerAView
): string[] {
  const reasons: string[] = [];
  if (["long", "very_long"].includes(view.translationProfile.meaningSize)) {
    reasons.push(`meaning-${view.translationProfile.meaningSize}`);
  }
  if (view.translationProfile.properName) reasons.push("proper-name");
  if (view.translationProfile.theological) reasons.push("theological");
  if (view.entityConstraints.quarantined) reasons.push("entity-quarantined");
  if (
    /\b(?:perhaps|probably|possibly|uncertain|sometimes assumed|may be)\b/iu.test(
      view.english.meaning
    )
  ) {
    reasons.push("uncertainty");
  }
  return [...new Set(reasons)].sort();
}

function validateAdaptiveProtectedContent(
  task: FrenchAdaptiveTask,
  display: string
): FrenchAdaptiveValidationIssue[] {
  const issues: FrenchAdaptiveValidationIssue[] = [];
  for (const strong of task.protectedContent.strongCodes) {
    if (!display.includes(strong)) {
      issues.push(error("missing-strong", `Code Strong absent : ${strong}.`));
    }
  }
  for (const literal of [
    ...task.protectedContent.numericLiterals,
    ...task.protectedContent.sigla
  ]) {
    if (!containsLiteral(display, literal)) {
      issues.push(
        error("missing-protected-literal", `Élément protégé absent : ${literal}.`)
      );
    }
  }
  for (const token of exactOriginalScriptTokens(
    task.english.meaning,
    task.identity.original
  )) {
    if (!display.includes(token)) {
      issues.push(
        error("missing-original-token", `Forme originale absente : ${token}.`)
      );
    }
  }
  return issues;
}

function exactOriginalScriptTokens(
  englishMeaning: string,
  identityOriginal: string
): string[] {
  const script =
    /[\p{Script=Greek}\p{Script=Hebrew}][\p{Script=Greek}\p{Script=Hebrew}\p{Mark}]*/gu;
  const identity = new Set(identityOriginal.match(script) ?? []);
  return [
    ...new Set(
      (englishMeaning.match(script) ?? []).filter(
        (token) => token.length > 1 || identity.has(token)
      )
    )
  ].sort();
}

function containsLiteral(display: string, literal: string): boolean {
  if (!literal.trim()) return true;
  const escaped = literal.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return /[\p{L}\p{N}]/u.test(literal)
    ? new RegExp(
        `(?<![\\p{L}\\p{M}\\p{N}])${escaped}(?![\\p{L}\\p{M}\\p{N}])`,
        "u"
      ).test(display)
    : display.includes(literal);
}

function fromLegacyIssue(issue: FrenchValidationIssue): FrenchAdaptiveValidationIssue {
  return {
    code: issue.code,
    severity: issue.severity === "info" ? "warning" : "error",
    message: issue.message
  };
}

function dedupeIssues(
  issues: FrenchAdaptiveValidationIssue[]
): FrenchAdaptiveValidationIssue[] {
  const result = new Map<string, FrenchAdaptiveValidationIssue>();
  for (const issue of issues) {
    const key = `${issue.code}\u0000${issue.message}`;
    if (!result.has(key)) result.set(key, issue);
  }
  return [...result.values()].sort((left, right) =>
    `${left.code}:${left.message}`.localeCompare(`${right.code}:${right.message}`)
  );
}

function arraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function error(code: string, message: string): FrenchAdaptiveValidationIssue {
  return { code, severity: "error", message };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
