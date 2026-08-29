import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  type LexicalCandidate,
  type LexicalCandidateItem,
  type LexicalCandidateReport
} from "./lexicalCandidateReport.js";
import { type StrongLedgerAnnotation } from "./strongLedger.js";
import { normalizeWord, tokenizeText } from "./tokenize.js";

export const PERMISSIVE_PROMOTION_PLAN_SCHEMA_VERSION = 1;
export const PERMISSIVE_MINIMUM_CANDIDATE_SCORE = 0.48;

export type PermissivePromotionTarget = "word" | "phrase";

export interface PermissivePromotion {
  annotationId: string;
  ref: string;
  strong: string;
  auditKind: LexicalCandidateItem["auditKind"];
  target: PermissivePromotionTarget;
  wordIndex: number;
  startWordIndex?: number;
  endWordIndex?: number;
  normalized: string;
  score: number;
  confidence: LexicalCandidate["confidence"];
  occupied: boolean;
  evidenceSources: string[];
}

export interface PermissivePromotionPlan {
  schemaVersion: number;
  bible: string;
  scope: string;
  inputFingerprint: string;
  policy: {
    name: "deterministic-high-recall-v1";
    minimumCandidateScore: number;
    acceptedConfidence: Array<"high" | "medium">;
    includeReaderAndAdvanced: true;
    promoteAdvancedWordAssignments: true;
    retainUnplacedAsEmpty: true;
    allowOccupiedCarrier: true;
    relocationMinimumGain: number;
    tieBreak: string;
  };
  metrics: {
    lexicalAuditItemCount: number;
    emptyAuditItemCount: number;
    relocationAuditItemCount: number;
    promotedAnnotationCount: number;
    promotedEmptyCount: number;
    promotedRelocationCount: number;
    promotedWordCount: number;
    promotedPhraseCount: number;
    retainedEmptyWithoutCandidateCount: number;
  };
  promotions: PermissivePromotion[];
}

export interface AppliedPermissivePromotions {
  annotations: StrongLedgerAnnotation[];
  promotedAnnotationCount: number;
  promotedWordCount: number;
  promotedPhraseCount: number;
  skippedDuplicateCarrierCount: number;
}

const RELOCATION_MINIMUM_GAIN = 0.12;

export function buildPermissivePromotionPlan(options: {
  report: LexicalCandidateReport;
  inputFingerprint: string;
}): PermissivePromotionPlan {
  const promotions: PermissivePromotion[] = [];
  let emptyAuditItemCount = 0;
  let relocationAuditItemCount = 0;
  let promotedEmptyCount = 0;
  let promotedRelocationCount = 0;
  let retainedEmptyWithoutCandidateCount = 0;

  const items = [...options.report.items].sort(compareLexicalItems);
  for (const item of items) {
    if (item.auditKind === "empty") emptyAuditItemCount += 1;
    else relocationAuditItemCount += 1;

    const candidate = selectPermissiveCandidate(item);
    if (!candidate) {
      if (item.auditKind === "empty") {
        retainedEmptyWithoutCandidateCount += 1;
      }
      continue;
    }

    if (item.auditKind === "empty") promotedEmptyCount += 1;
    else promotedRelocationCount += 1;
    promotions.push(toPromotion(item, candidate));
  }

  promotions.sort(comparePromotions);
  return {
    schemaVersion: PERMISSIVE_PROMOTION_PLAN_SCHEMA_VERSION,
    bible: options.report.bible,
    scope: options.report.scope,
    inputFingerprint: options.inputFingerprint,
    policy: {
      name: "deterministic-high-recall-v1",
      minimumCandidateScore: PERMISSIVE_MINIMUM_CANDIDATE_SCORE,
      acceptedConfidence: ["high", "medium"],
      includeReaderAndAdvanced: true,
      promoteAdvancedWordAssignments: true,
      retainUnplacedAsEmpty: true,
      allowOccupiedCarrier: true,
      relocationMinimumGain: RELOCATION_MINIMUM_GAIN,
      tieBreak:
        "score desc, confidence desc, open before occupied, nearest source anchor, word before phrase, word indexes asc, normalized asc"
    },
    metrics: {
      lexicalAuditItemCount: items.length,
      emptyAuditItemCount,
      relocationAuditItemCount,
      promotedAnnotationCount: promotions.length,
      promotedEmptyCount,
      promotedRelocationCount,
      promotedWordCount: promotions.filter(
        (promotion) => promotion.target === "word"
      ).length,
      promotedPhraseCount: promotions.filter(
        (promotion) => promotion.target === "phrase"
      ).length,
      retainedEmptyWithoutCandidateCount
    },
    promotions
  };
}

export async function writePermissivePromotionPlan(
  outputPath: string,
  plan: PermissivePromotionPlan
): Promise<void> {
  const temporaryPath = `${outputPath}.tmp-${process.pid}-${Date.now()}`;
  try {
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(
      temporaryPath,
      `${JSON.stringify(plan, null, 2)}\n`,
      "utf8"
    );
    await rename(temporaryPath, outputPath);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
}

export function parsePermissivePromotionPlan(
  value: unknown
): PermissivePromotionPlan {
  if (!isObject(value)) {
    throw new Error("invalid-permissive-promotion-plan");
  }
  if (
    value.schemaVersion !== PERMISSIVE_PROMOTION_PLAN_SCHEMA_VERSION ||
    typeof value.bible !== "string" ||
    typeof value.scope !== "string" ||
    typeof value.inputFingerprint !== "string" ||
    !isObject(value.policy) ||
    value.policy.name !== "deterministic-high-recall-v1" ||
    !isObject(value.metrics) ||
    !Array.isArray(value.promotions)
  ) {
    throw new Error("invalid-permissive-promotion-plan-header");
  }

  const promotions = value.promotions.map((promotion, index) =>
    parsePromotion(promotion, index)
  );
  if (!isSorted(promotions, comparePromotions)) {
    throw new Error("non-deterministic-permissive-promotion-order");
  }

  return value as unknown as PermissivePromotionPlan;
}

export function applyPermissivePromotionPlan(options: {
  ref: string;
  annotations: StrongLedgerAnnotation[];
  promotionsByAnnotationId: ReadonlyMap<string, PermissivePromotion>;
}): AppliedPermissivePromotions {
  let promotedAnnotationCount = 0;
  let promotedWordCount = 0;
  let promotedPhraseCount = 0;
  let skippedDuplicateCarrierCount = 0;
  const annotations = options.annotations.map((source) => {
    const promotion = options.promotionsByAnnotationId.get(source.id);
    if (!promotion || promotion.ref !== options.ref) return { ...source };
    if (promotion.strong.toUpperCase() !== source.strong.toUpperCase()) {
      throw new Error(
        `permissive-promotion-strong-mismatch:${options.ref}:${source.id}`
      );
    }
    if (source.visibility !== "reader" && source.visibility !== "advanced") {
      throw new Error(
        `permissive-promotion-invisible-annotation:${options.ref}:${source.id}`
      );
    }
    if (
      options.annotations.some(
        (candidate) =>
          candidate !== source &&
          (candidate.visibility === "reader" ||
            candidate.visibility === "advanced") &&
          candidate.strong.toUpperCase() === source.strong.toUpperCase() &&
          annotationMatchesPromotion(candidate, promotion)
      )
    ) {
      skippedDuplicateCarrierCount += 1;
      return { ...source };
    }

    promotedAnnotationCount += 1;
    if (promotion.target === "word") promotedWordCount += 1;
    else promotedPhraseCount += 1;
    return promotedAnnotation(source, promotion);
  });

  return {
    annotations,
    promotedAnnotationCount,
    promotedWordCount,
    promotedPhraseCount,
    skippedDuplicateCarrierCount
  };
}

export function promotionMap(
  plan: PermissivePromotionPlan
): Map<string, PermissivePromotion> {
  const result = new Map<string, PermissivePromotion>();
  for (const promotion of plan.promotions) {
    if (result.has(promotion.annotationId)) {
      throw new Error(
        `duplicate-permissive-promotion:${promotion.annotationId}`
      );
    }
    result.set(promotion.annotationId, promotion);
  }
  return result;
}

function selectPermissiveCandidate(
  item: LexicalCandidateItem
): LexicalCandidate | undefined {
  const candidates = [...item.candidates, ...dictionaryExactCandidates(item)]
    .filter(isPermissiveCandidate)
    .sort((left, right) => compareCandidates(left, right, item));
  const best = candidates[0];
  if (!best) return undefined;

  if (item.auditKind === "relocation") {
    if (!item.currentTarget) return undefined;
    if (best.wordIndex === item.currentTarget.wordIndex) return undefined;
    const currentScore =
      item.candidates.find(
        (candidate) =>
          candidate.target === "word" &&
          candidate.wordIndex === item.currentTarget?.wordIndex
      )?.score ?? 0;
    if (best.score < currentScore + RELOCATION_MINIMUM_GAIN) return undefined;
  }
  return best;
}

function dictionaryExactCandidates(
  item: LexicalCandidateItem
): LexicalCandidate[] {
  const terms = new Set(
    item.dictionaryTerms.map(normalizeWord).filter((term) => term.length > 1)
  );
  if (terms.size === 0) return [];

  let wordIndex = -1;
  const candidates: LexicalCandidate[] = [];
  for (const segment of tokenizeText(item.text)) {
    if (segment.kind !== "word") continue;
    wordIndex += 1;
    if (!terms.has(segment.normalized)) continue;
    candidates.push({
      target: "word",
      wordIndex,
      text: segment.text,
      normalized: segment.normalized,
      lemma: segment.normalized,
      score: 0.86,
      confidence: "high",
      occupied: false,
      evidence: [
        {
          source: "permissive-dictionary-exact",
          provenanceRoot: "strong-dictionary",
          detail: `${segment.normalized} exactly matches a Strong dictionary term`,
          weight: 0.86
        }
      ]
    });
  }
  return candidates;
}

function isPermissiveCandidate(candidate: LexicalCandidate): boolean {
  if (
    candidate.score < PERMISSIVE_MINIMUM_CANDIDATE_SCORE ||
    candidate.confidence === "low"
  ) {
    return false;
  }
  if (!Number.isSafeInteger(candidate.wordIndex) || candidate.wordIndex < 0) {
    return false;
  }
  if (candidate.target === "phrase") {
    return (
      Number.isSafeInteger(candidate.startWordIndex) &&
      Number.isSafeInteger(candidate.endWordIndex) &&
      candidate.startWordIndex! >= 0 &&
      candidate.endWordIndex! >= candidate.startWordIndex!
    );
  }
  return true;
}

function compareCandidates(
  left: LexicalCandidate,
  right: LexicalCandidate,
  item: LexicalCandidateItem
): number {
  return (
    right.score - left.score ||
    confidenceRank(right.confidence) - confidenceRank(left.confidence) ||
    Number(left.occupied) - Number(right.occupied) ||
    distanceFromAnchor(left, item) - distanceFromAnchor(right, item) ||
    targetRank(left.target) - targetRank(right.target) ||
    left.wordIndex - right.wordIndex ||
    (left.startWordIndex ?? -1) - (right.startWordIndex ?? -1) ||
    (left.endWordIndex ?? -1) - (right.endWordIndex ?? -1) ||
    left.normalized.localeCompare(right.normalized)
  );
}

function confidenceRank(confidence: LexicalCandidate["confidence"]): number {
  if (confidence === "high") return 2;
  if (confidence === "medium") return 1;
  return 0;
}

function distanceFromAnchor(
  candidate: LexicalCandidate,
  item: LexicalCandidateItem
): number {
  return Math.abs(candidate.wordIndex - (item.insertAfterWordIndex ?? -1));
}

function targetRank(target: LexicalCandidate["target"]): number {
  return target === "word" ? 0 : 1;
}

function toPromotion(
  item: LexicalCandidateItem,
  candidate: LexicalCandidate
): PermissivePromotion {
  return {
    annotationId: item.annotationId,
    ref: item.ref,
    strong: item.strong.toUpperCase(),
    auditKind: item.auditKind,
    target: candidate.target,
    wordIndex: candidate.wordIndex,
    ...(candidate.startWordIndex === undefined
      ? {}
      : { startWordIndex: candidate.startWordIndex }),
    ...(candidate.endWordIndex === undefined
      ? {}
      : { endWordIndex: candidate.endWordIndex }),
    normalized: candidate.normalized,
    score: candidate.score,
    confidence: candidate.confidence,
    occupied: candidate.occupied,
    evidenceSources: [
      ...new Set(candidate.evidence.map((evidence) => evidence.source))
    ].sort()
  };
}

function promotedAnnotation(
  source: StrongLedgerAnnotation,
  promotion: PermissivePromotion
): StrongLedgerAnnotation {
  const common = {
    ...source,
    placement: promotion.target,
    insertAfterWordIndex: undefined,
    confidence: Math.max(source.confidence, promotion.score),
    diagnostics: [
      ...new Set([
        ...source.diagnostics,
        "permissive-deterministic-promotion",
        ...promotion.evidenceSources
      ])
    ]
  };
  if (promotion.target === "phrase") {
    return {
      ...common,
      wordIndex: undefined,
      normalizedWord: undefined,
      startWordIndex: promotion.startWordIndex,
      endWordIndex: promotion.endWordIndex,
      normalizedPhrase: promotion.normalized
    };
  }
  return {
    ...common,
    wordIndex: promotion.wordIndex,
    normalizedWord: promotion.normalized,
    startWordIndex: undefined,
    endWordIndex: undefined,
    normalizedPhrase: undefined
  };
}

function annotationMatchesPromotion(
  annotation: StrongLedgerAnnotation,
  promotion: PermissivePromotion
): boolean {
  if (promotion.target === "phrase") {
    return (
      annotation.placement === "phrase" &&
      annotation.startWordIndex === promotion.startWordIndex &&
      annotation.endWordIndex === promotion.endWordIndex
    );
  }
  return (
    (annotation.placement === "word" || annotation.placement === "duplicate") &&
    annotation.wordIndex === promotion.wordIndex
  );
}

function compareLexicalItems(
  left: LexicalCandidateItem,
  right: LexicalCandidateItem
): number {
  return (
    left.ref.localeCompare(right.ref) ||
    left.annotationId.localeCompare(right.annotationId) ||
    left.strong.localeCompare(right.strong)
  );
}

function comparePromotions(
  left: PermissivePromotion,
  right: PermissivePromotion
): number {
  return (
    left.ref.localeCompare(right.ref) ||
    left.annotationId.localeCompare(right.annotationId) ||
    left.strong.localeCompare(right.strong)
  );
}

function parsePromotion(value: unknown, index: number): PermissivePromotion {
  if (
    !isObject(value) ||
    typeof value.annotationId !== "string" ||
    typeof value.ref !== "string" ||
    typeof value.strong !== "string" ||
    !/^[GH]\d{4,5}$/u.test(value.strong) ||
    (value.auditKind !== "empty" && value.auditKind !== "relocation") ||
    (value.target !== "word" && value.target !== "phrase") ||
    !Number.isSafeInteger(value.wordIndex) ||
    Number(value.wordIndex) < 0 ||
    typeof value.normalized !== "string" ||
    typeof value.score !== "number" ||
    value.score < PERMISSIVE_MINIMUM_CANDIDATE_SCORE ||
    (value.confidence !== "high" && value.confidence !== "medium") ||
    typeof value.occupied !== "boolean" ||
    !Array.isArray(value.evidenceSources) ||
    !value.evidenceSources.every((source) => typeof source === "string")
  ) {
    throw new Error(`invalid-permissive-promotion:${index}`);
  }
  if (
    value.target === "phrase" &&
    (!Number.isSafeInteger(value.startWordIndex) ||
      !Number.isSafeInteger(value.endWordIndex) ||
      Number(value.startWordIndex) < 0 ||
      Number(value.endWordIndex) < Number(value.startWordIndex))
  ) {
    throw new Error(`invalid-permissive-phrase-promotion:${index}`);
  }
  return value as unknown as PermissivePromotion;
}

function isSorted<T>(
  values: T[],
  compare: (left: T, right: T) => number
): boolean {
  for (let index = 1; index < values.length; index += 1) {
    if (compare(values[index - 1]!, values[index]!) > 0) return false;
  }
  return true;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
