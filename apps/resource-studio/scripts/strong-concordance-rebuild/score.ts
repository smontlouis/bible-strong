/**
 * Evaluator: pairs sealed predictions with the reference and measures them.
 * The reference is read only here, after the prediction hash is verified.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { readBibleJson } from "../../src/bibleJson.js";
import {
  extractGoldCarrierPlacements,
  scoreCarrierAwareVerse,
  type CarrierPlacement,
  type VerseEvaluation
} from "../../src/evaluateStrongGold.js";
import { readStrongCsv } from "../../src/strongCsv.js";
import { withoutPublisherNotes } from "../../src/strongReaderText.js";
import { rawPathFor } from "./acquire.js";
import {
  goldVerseFromConcordance,
  parseChapterForGold,
  wordTokens,
  type GoldOccurrence,
  type GoldVerse
} from "./gold.js";
import type {
  PredictedCarrier,
  PredictedDecision,
  PredictedVerse,
  PredictionRun
} from "./predict.js";
import {
  ACQUISITION_ROOT,
  EDITIONS,
  chapterOfRef,
  genreOfBook,
  sha256,
  stableStringify,
  testamentOfBook
} from "./shared.js";

export const SCORE_VERSION = "strong-concordance-rebuild-score-v3";

/* ------------------------------------------------------------------ */
/* Reference construction                                              */
/* ------------------------------------------------------------------ */

export interface ReferenceVerse {
  ref: string;
  nativeRef: string | null;
  gold: GoldVerse;
}

interface Correspondence {
  nativeByCanonical: Map<
    string,
    { nativeRef: string; kind: string } | { blocked: string }
  >;
}

async function correspondenceFor(
  editionId: keyof typeof EDITIONS
): Promise<Correspondence> {
  const edition = EDITIONS[editionId];
  const nativeByCanonical: Correspondence["nativeByCanonical"] = new Map();
  if (
    edition.localText.kind !== "bible-json" ||
    !edition.localText.verseCorrespondencePath
  )
    return { nativeByCanonical };
  const manifest = JSON.parse(
    await readFile(edition.localText.verseCorrespondencePath, "utf8")
  ) as {
    blocks: Array<{
      targetRefs: string[];
      canonicalRefs: string[];
      kind: string;
    }>;
  };
  for (const block of manifest.blocks) {
    for (const ref of block.canonicalRefs) {
      if (block.targetRefs.length === 1 && block.canonicalRefs.length === 1)
        nativeByCanonical.set(ref, {
          nativeRef: block.targetRefs[0]!,
          kind: block.kind
        });
      else
        nativeByCanonical.set(ref, {
          blocked: `${block.kind}:${block.targetRefs.join("+")}=>${block.canonicalRefs.join("+")}`
        });
    }
  }
  return { nativeByCanonical };
}

/** Concordance reference on the exact local text (SG21, NEG). */
export async function concordanceReference(
  editionId: "SG21" | "NEG",
  chapters: string[],
  acquisitionRoot = ACQUISITION_ROOT
): Promise<{
  verses: ReferenceVerse[];
  nonComparable: Array<{ ref: string; reason: string }>;
  pages: Record<string, string>;
}> {
  const edition = EDITIONS[editionId];
  if (edition.localText.kind !== "bible-json")
    throw new Error("concordance-reference-needs-bible");
  const local = new Map(
    (await readBibleJson(edition.localText.path)).map((verse) => [
      `${verse.bookId}.${verse.chapter}.${verse.verse}`,
      verse.text
    ])
  );
  const correspondence = await correspondenceFor(editionId);
  const verses: ReferenceVerse[] = [];
  const nonComparable: Array<{ ref: string; reason: string }> = [];
  const pages: Record<string, string> = {};
  for (const chapter of chapters) {
    const rawPath = rawPathFor(
      acquisitionRoot,
      edition.concordanceCode,
      chapter
    );
    const html = await readFile(rawPath, "utf8");
    pages[chapter] = sha256(html);
    const parsed = parseChapterForGold(html, chapter);
    for (const issue of parsed.issues)
      nonComparable.push({ ref: chapter, reason: `parse:${issue}` });
    for (const verse of parsed.verses) {
      const ref = `${chapter}.${verse.verse}`;
      const mapping = correspondence.nativeByCanonical.get(ref);
      if (mapping && "blocked" in mapping) {
        nonComparable.push({
          ref,
          reason: `versification-block:${mapping.blocked}`
        });
        continue;
      }
      const nativeRef = mapping ? mapping.nativeRef : ref;
      const localText = local.get(nativeRef);
      const gold = goldVerseFromConcordance({ ref, verse, localText });
      if (
        gold.comparability === "missing-local-verse" ||
        gold.comparability === "text-divergent-unmapped"
      ) {
        nonComparable.push({ ref, reason: gold.comparability });
        continue;
      }
      if (localText !== undefined && localText.trim() === "") {
        nonComparable.push({ ref, reason: "empty-local-verse" });
        continue;
      }
      verses.push({ ref, nativeRef, gold });
    }
    const goldRefs = new Set(
      parsed.verses.map((verse) => `${chapter}.${verse.verse}`)
    );
    const expected = correspondence.nativeByCanonical.size
      ? [...correspondence.nativeByCanonical.entries()]
          .filter(
            ([canonical, mapping]) =>
              chapterOfRef(canonical) === chapter && !("blocked" in mapping)
          )
          .map(([canonical, mapping]) => ({
            canonical,
            nativeRef: (mapping as { nativeRef: string }).nativeRef
          }))
      : [...local.keys()]
          .filter((ref) => chapterOfRef(ref) === chapter)
          .map((ref) => ({ canonical: ref, nativeRef: ref }));
    for (const { canonical, nativeRef } of expected)
      if (!goldRefs.has(canonical) && (local.get(nativeRef) ?? "").trim())
        nonComparable.push({
          ref: canonical,
          reason: "missing-concordance-verse"
        });
  }
  return { verses, nonComparable: dedupe(nonComparable), pages };
}

function dedupe(values: Array<{ ref: string; reason: string }>) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = `${value.ref}|${value.reason}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Witness CSV reference (historical controls, no source positions). */
export async function csvReference(
  editionId: "Sg1910" | "Darby" | "DarbyR",
  chapters: string[]
): Promise<Map<string, CarrierPlacement[]>> {
  const edition = EDITIONS[editionId];
  const planned = new Set(chapters);
  const rows = (await readStrongCsv(edition.localText.path)).filter((row) =>
    planned.has(`${row.bookId}.${row.chapter}`)
  );
  return new Map(
    rows.map((row) => [
      `${row.bookId}.${row.chapter}.${row.verse}`,
      extractGoldCarrierPlacements(withoutPublisherNotes(row.text))
    ])
  );
}

/* ------------------------------------------------------------------ */
/* Prediction views                                                    */
/* ------------------------------------------------------------------ */

export function readerPlacements(verse: PredictedVerse): CarrierPlacement[] {
  return verse.carriers
    .filter((carrier) => carrier.visibility === "reader")
    .flatMap((carrier): CarrierPlacement[] => {
      if (carrier.placement === "word" || carrier.placement === "phrase")
        return [
          {
            strong: carrier.strong,
            kind:
              carrier.startWordIndex === carrier.endWordIndex
                ? "word"
                : "phrase",
            startWordIndex: carrier.startWordIndex,
            endWordIndex: carrier.endWordIndex,
            confidence: carrier.confidence,
            source: `${carrier.source}:${carrier.diagnostic ?? carrier.placement}`
          }
        ];
      if (carrier.placement === "empty")
        return [
          {
            strong: carrier.strong,
            kind: "empty",
            insertAfterWordIndex: carrier.insertAfterWordIndex,
            confidence: carrier.confidence,
            source: `${carrier.source}:${carrier.diagnostic ?? carrier.placement}`
          }
        ];
      return [];
    });
}

export function goldPlacements(gold: GoldVerse): CarrierPlacement[] {
  return gold.occurrences.map((occurrence): CarrierPlacement =>
    occurrence.kind === "empty"
      ? {
          strong: occurrence.strong,
          kind: "empty",
          insertAfterWordIndex: occurrence.insertAfterWordIndex
        }
      : {
          strong: occurrence.strong,
          kind: occurrence.kind === "word" ? "word" : "phrase",
          startWordIndex: occurrence.tokenIndices[0],
          endWordIndex: occurrence.tokenIndices.at(-1)
        }
  );
}

/** `TAHOT.Exod.10.2.14.L` → STEP word number 14 (the Concordance position). */
export function stepPositionOfUnit(
  sourceUnitId: string
): { ref: string; position: number } | null {
  const match =
    /^(?:TAHOT|TAGNT)\.((?:[1-3])?[A-Za-z]+)\.(\d+)\.(\d+)\.(\d+)\./u.exec(
      sourceUnitId
    );
  if (!match) return null;
  return {
    ref: `${match[1]}.${match[2]}.${match[3]}`,
    position: Number(match[4])
  };
}

/* ------------------------------------------------------------------ */
/* Occurrence-level outcomes                                           */
/* ------------------------------------------------------------------ */

export type OccurrenceOutcome =
  | "visible-exact"
  | "visible-overlap"
  | "visible-wrong-carrier"
  | "visible-swapped-occurrence"
  | "gold-visible-pred-empty"
  | "gold-visible-pred-unresolved"
  | "gold-empty-pred-visible"
  | "empty-anchor-exact"
  | "empty-anchor-different"
  | "gold-empty-pred-unresolved"
  | "gold-occurrence-without-source-unit"
  | "source-strong-differs"
  | "gold-silent-pred-visible"
  | "gold-silent-pred-empty"
  | "gold-silent-pred-unresolved";

export interface OccurrenceRecord {
  ref: string;
  position: number | null;
  goldStrong: string | null;
  predictedStrong: string[];
  outcome: OccurrenceOutcome;
  goldKind: GoldOccurrence["kind"] | "silent";
  goldTokens: number[];
  goldAnchor?: number;
  predictedState: PredictedDecision["state"] | "absent";
  predictedTokens: number[];
  predictedAnchor?: number;
  predictedAssurance?: string;
  predictedSource?: string;
  difficulty: string[];
}

const FUNCTION_POS = new Set([
  "a",
  "A",
  "c",
  "ç",
  "é",
  "e",
  "E",
  "O",
  "p",
  "P",
  "q",
  "Q",
  "r",
  "f",
  "g",
  "J",
  "x",
  "X",
  "â",
  "ê",
  "y",
  "ï",
  "Ë"
]);

function difficultyLabels(options: {
  occurrence?: GoldOccurrence;
  repeatedStrong: boolean;
}): string[] {
  const labels: string[] = [];
  const occurrence = options.occurrence;
  if (options.repeatedStrong) labels.push("repeated-strong");
  if (occurrence?.kind === "phrase" || occurrence?.kind === "discontinuous")
    labels.push("multiword");
  if (occurrence?.kind === "empty")
    labels.push(
      occurrence.punctuationCarrier ? "punctuation-carrier" : "untranslated"
    );
  if (occurrence?.sharedWordWithOtherPositions) labels.push("shared-word");
  const pos = occurrence?.posTags.find((tag) => tag !== "§");
  if (pos === "N") labels.push("proper-noun");
  else if (pos && FUNCTION_POS.has(pos)) labels.push("function-word");
  else if (pos) labels.push("content-word");
  if (!occurrence) labels.push("gold-silent");
  return labels;
}

function carrierTokensOfDecision(
  decision: PredictedDecision,
  verse: PredictedVerse
): number[] {
  if (decision.state !== "visible") return [];
  if (decision.targetWordIndices.length)
    return [...decision.targetWordIndices].sort((a, b) => a - b);
  const carrier = verse.carriers.find(
    (candidate) =>
      candidate.visibility === "reader" &&
      candidate.resolutionUnitId === decision.sourceUnitId &&
      candidate.startWordIndex !== undefined
  );
  if (
    !carrier ||
    carrier.startWordIndex === undefined ||
    carrier.endWordIndex === undefined
  )
    return [];
  return Array.from(
    { length: carrier.endWordIndex - carrier.startWordIndex + 1 },
    (_, index) => carrier.startWordIndex! + index
  );
}

function readerSourceOf(
  decision: PredictedDecision,
  verse: PredictedVerse
): string | undefined {
  const carrier: PredictedCarrier | undefined = verse.carriers.find(
    (candidate) =>
      candidate.visibility === "reader" &&
      candidate.resolutionUnitId === decision.sourceUnitId
  );
  return carrier
    ? `${carrier.source}:${carrier.diagnostic ?? carrier.placement}`
    : undefined;
}

export function occurrenceRecords(
  reference: ReferenceVerse,
  verse: PredictedVerse
): OccurrenceRecord[] {
  const records: OccurrenceRecord[] = [];
  const decisionsByPosition = new Map<number, PredictedDecision[]>();
  const strongCount = new Map<string, number>();
  // STEP labels some verses with their English reference (`Hos.1.10(2.1)`):
  // the word numbers are those of the Hebrew verse, so every unit of the
  // predicted verse is used. Several STEP verses in one target verse would make
  // positions ambiguous; then only the unit verse equal to the reference is kept.
  const unitRefs = new Set(
    verse.decisions.flatMap((decision) => {
      const position = stepPositionOfUnit(decision.sourceUnitId);
      return position ? [position.ref] : [];
    })
  );
  const keepRef =
    unitRefs.size <= 1
      ? null
      : unitRefs.has(reference.ref)
        ? reference.ref
        : undefined;
  for (const decision of verse.decisions) {
    const position = stepPositionOfUnit(decision.sourceUnitId);
    if (!position || keepRef === undefined) continue;
    if (keepRef !== null && position.ref !== keepRef) continue;
    const list = decisionsByPosition.get(position.position) ?? [];
    list.push(decision);
    decisionsByPosition.set(position.position, list);
    for (const strong of decision.strong)
      strongCount.set(strong, (strongCount.get(strong) ?? 0) + 1);
  }
  const exactPositionMatches = new Set<PredictedDecision>();
  for (const occurrence of reference.gold.occurrences)
    for (const decision of occurrence.position === null
      ? []
      : (decisionsByPosition.get(occurrence.position) ?? []))
      if (decision.strong.includes(occurrence.strong))
        exactPositionMatches.add(decision);
  const goldStrongCount = new Map<string, number>();
  for (const occurrence of reference.gold.occurrences)
    goldStrongCount.set(
      occurrence.strong,
      (goldStrongCount.get(occurrence.strong) ?? 0) + 1
    );
  const shiftedDecisionFor = (
    occurrence: GoldOccurrence
  ): PredictedDecision | undefined => {
    // NA/TAGNT and BHS/TAHOT may number a word differently (order variants,
    // split words). Accept the nearest unit with the same Strong that no
    // reference occurrence claims at its own position, within three words, or
    // anywhere when this Strong occurs once on each side of the verse.
    let best: { decision: PredictedDecision; distance: number } | undefined;
    const unclaimed: PredictedDecision[] = [];
    for (const [position, decisions] of decisionsByPosition)
      for (const decision of decisions) {
        if (
          !decision.strong.includes(occurrence.strong) ||
          exactPositionMatches.has(decision)
        )
          continue;
        unclaimed.push(decision);
        const distance = Math.abs(position - (occurrence.position ?? position));
        if (distance > 3) continue;
        if (!best || distance < best.distance) best = { decision, distance };
      }
    if (best) return best.decision;
    return unclaimed.length === 1 &&
      goldStrongCount.get(occurrence.strong) === 1
      ? unclaimed[0]
      : undefined;
  };
  const shiftedClaims = new Set<PredictedDecision>();
  const goldByPosition = new Map<number, GoldOccurrence[]>();
  for (const occurrence of reference.gold.occurrences) {
    if (occurrence.position === null) continue;
    const list = goldByPosition.get(occurrence.position) ?? [];
    list.push(occurrence);
    goldByPosition.set(occurrence.position, list);
  }
  // Token owner of every gold visible occurrence, to recognise swapped repeats.
  const goldOwnerByToken = new Map<string, number>();
  for (const occurrence of reference.gold.occurrences)
    if (occurrence.position !== null)
      for (const token of occurrence.tokenIndices)
        goldOwnerByToken.set(
          `${occurrence.strong}@${token}`,
          occurrence.position
        );

  for (const occurrence of reference.gold.occurrences) {
    const repeated = (strongCount.get(occurrence.strong) ?? 0) > 1;
    const base = {
      ref: reference.ref,
      position: occurrence.position,
      goldStrong: occurrence.strong,
      goldKind: occurrence.kind,
      goldTokens: occurrence.tokenIndices,
      goldAnchor: occurrence.insertAfterWordIndex,
      difficulty: difficultyLabels({ occurrence, repeatedStrong: repeated })
    };
    const decisions =
      occurrence.position === null
        ? []
        : (decisionsByPosition.get(occurrence.position) ?? []);
    let decision = decisions.find((candidate) =>
      candidate.strong.includes(occurrence.strong)
    );
    let positionShift = false;
    if (!decision) {
      const shifted = shiftedDecisionFor(occurrence);
      if (shifted && !shiftedClaims.has(shifted)) {
        shiftedClaims.add(shifted);
        decision = shifted;
        positionShift = true;
      }
    }
    if (!decision && !decisions.length) {
      records.push({
        ...base,
        predictedStrong: [],
        outcome: "gold-occurrence-without-source-unit",
        predictedState: "absent",
        predictedTokens: []
      });
      continue;
    }
    if (!decision) {
      records.push({
        ...base,
        predictedStrong: decisions.flatMap((candidate) => candidate.strong),
        outcome: "source-strong-differs",
        predictedState: decisions[0]!.state,
        predictedTokens: carrierTokensOfDecision(decisions[0]!, verse)
      });
      continue;
    }
    if (positionShift) base.difficulty.push("source-position-shift");
    const predictedTokens = carrierTokensOfDecision(decision, verse);
    const common = {
      ...base,
      predictedStrong: decision.strong,
      predictedState: decision.state,
      predictedTokens,
      predictedAnchor:
        decision.state !== "visible"
          ? decision.anchor?.insertAfterWordIndex
          : undefined,
      predictedAssurance: decision.assurance,
      predictedSource: readerSourceOf(decision, verse)
    };
    let outcome: OccurrenceOutcome;
    if (occurrence.kind === "empty") {
      if (decision.state === "visible") outcome = "gold-empty-pred-visible";
      else if (decision.state === "empty")
        outcome =
          decision.anchor?.insertAfterWordIndex ===
          occurrence.insertAfterWordIndex
            ? "empty-anchor-exact"
            : "empty-anchor-different";
      else outcome = "gold-empty-pred-unresolved";
    } else if (decision.state === "empty") outcome = "gold-visible-pred-empty";
    else if (decision.state === "unresolved")
      outcome = "gold-visible-pred-unresolved";
    else {
      const gold = new Set(occurrence.tokenIndices);
      const exact =
        predictedTokens.length === gold.size &&
        predictedTokens.every((token) => gold.has(token));
      const overlap = predictedTokens.some((token) => gold.has(token));
      if (exact) outcome = "visible-exact";
      else if (overlap) outcome = "visible-overlap";
      else if (
        predictedTokens.some((token) => {
          const owner = goldOwnerByToken.get(`${occurrence.strong}@${token}`);
          return owner !== undefined && owner !== occurrence.position;
        })
      )
        outcome = "visible-swapped-occurrence";
      else outcome = "visible-wrong-carrier";
    }
    records.push({ ...common, outcome });
  }
  // Predicted source units on which the reference is silent.
  const goldPositions = new Set(goldByPosition.keys());
  const unnumbered = new Set(reference.gold.unnumberedPositions);
  for (const [position, decisions] of decisionsByPosition) {
    if (goldPositions.has(position) || unnumbered.has(position)) continue;
    for (const decision of decisions) {
      if (shiftedClaims.has(decision)) continue;
      records.push({
        ref: reference.ref,
        position,
        goldStrong: null,
        predictedStrong: decision.strong,
        outcome:
          decision.state === "visible"
            ? "gold-silent-pred-visible"
            : decision.state === "empty"
              ? "gold-silent-pred-empty"
              : "gold-silent-pred-unresolved",
        goldKind: "silent",
        goldTokens: [],
        predictedState: decision.state,
        predictedTokens: carrierTokensOfDecision(decision, verse),
        predictedAnchor:
          decision.state !== "visible"
            ? decision.anchor?.insertAfterWordIndex
            : undefined,
        predictedAssurance: decision.assurance,
        predictedSource: readerSourceOf(decision, verse),
        difficulty: difficultyLabels({
          repeatedStrong: decision.strong.some(
            (strong) => (strongCount.get(strong) ?? 0) > 1
          )
        })
      });
    }
  }
  return records;
}

/* ------------------------------------------------------------------ */
/* Aggregation                                                         */
/* ------------------------------------------------------------------ */

export interface OccurrenceSummary {
  goldOccurrences: number;
  goldVisible: number;
  goldEmpty: number;
  predictedUnits: number;
  outcomes: Record<string, number>;
  /** Occurrence-aware visible precision: exact carrier for the same source word. */
  visiblePrecisionExact: number;
  visiblePrecisionOverlap: number;
  visibleRecallExact: number;
  visibleRecallOverlap: number;
  visibleF1Exact: number;
  /** Gold-empty occurrences predicted empty / all predicted empties on annotated words. */
  emptyClassificationPrecision: number;
  emptyClassificationRecall: number;
  emptyAnchorExactRate: number;
  unresolvedRate: number;
  goldVisibleUnresolvedRate: number;
}

const ratio = (numerator: number, denominator: number) =>
  denominator === 0 ? 0 : Math.round((numerator / denominator) * 10000) / 10000;

export function summarizeOccurrences(
  records: OccurrenceRecord[]
): OccurrenceSummary {
  const outcomes: Record<string, number> = {};
  for (const record of records)
    outcomes[record.outcome] = (outcomes[record.outcome] ?? 0) + 1;
  const n = (key: OccurrenceOutcome) => outcomes[key] ?? 0;
  const predictedVisible =
    n("visible-exact") +
    n("visible-overlap") +
    n("visible-wrong-carrier") +
    n("visible-swapped-occurrence") +
    n("gold-empty-pred-visible") +
    n("gold-silent-pred-visible");
  const goldVisible = records.filter(
    (record) => record.goldKind !== "silent" && record.goldKind !== "empty"
  ).length;
  const goldEmpty = records.filter(
    (record) => record.goldKind === "empty"
  ).length;
  const precisionExact = ratio(n("visible-exact"), predictedVisible);
  const recallExact = ratio(n("visible-exact"), goldVisible);
  const predictedEmptyOnAnnotated =
    n("empty-anchor-exact") +
    n("empty-anchor-different") +
    n("gold-visible-pred-empty");
  const predictedUnits = records.filter(
    (record) => record.predictedState !== "absent"
  ).length;
  return {
    goldOccurrences: goldVisible + goldEmpty,
    goldVisible,
    goldEmpty,
    predictedUnits,
    outcomes,
    visiblePrecisionExact: precisionExact,
    visiblePrecisionOverlap: ratio(
      n("visible-exact") + n("visible-overlap"),
      predictedVisible
    ),
    visibleRecallExact: recallExact,
    visibleRecallOverlap: ratio(
      n("visible-exact") + n("visible-overlap"),
      goldVisible
    ),
    visibleF1Exact:
      precisionExact + recallExact === 0
        ? 0
        : Math.round(
            ((2 * precisionExact * recallExact) /
              (precisionExact + recallExact)) *
              10000
          ) / 10000,
    emptyClassificationPrecision: ratio(
      n("empty-anchor-exact") + n("empty-anchor-different"),
      predictedEmptyOnAnnotated
    ),
    emptyClassificationRecall: ratio(
      n("empty-anchor-exact") + n("empty-anchor-different"),
      goldEmpty
    ),
    emptyAnchorExactRate: ratio(
      n("empty-anchor-exact"),
      n("empty-anchor-exact") + n("empty-anchor-different")
    ),
    unresolvedRate: ratio(
      records.filter((record) => record.predictedState === "unresolved").length,
      predictedUnits
    ),
    goldVisibleUnresolvedRate: ratio(
      n("gold-visible-pred-unresolved"),
      goldVisible
    )
  };
}

export interface CarrierSummary {
  verses: number;
  carrierExact: VerseEvaluation["carrierExact"];
  carrierOverlap: VerseEvaluation["carrierOverlap"];
  visibilityClassification: VerseEvaluation["visibilityClassification"];
  visibleCarrierExact: VerseEvaluation["visibleCarrierExact"];
  emptyCarrierExact: VerseEvaluation["emptyCarrierExact"];
  inventoryOccurrence: VerseEvaluation["inventoryOccurrence"];
  cardinalityExactVerseRate: number;
  absoluteOccurrenceError: number;
}

function sumMetrics<
  T extends {
    truePositive: number;
    falsePositive: number;
    falseNegative: number;
    expectedCount: number;
    predictedCount: number;
  }
>(values: T[]) {
  const tp = values.reduce((total, value) => total + value.truePositive, 0);
  const fp = values.reduce((total, value) => total + value.falsePositive, 0);
  const fn = values.reduce((total, value) => total + value.falseNegative, 0);
  const precision = ratio(tp, tp + fp);
  const recall = ratio(tp, tp + fn);
  return {
    expectedCount: values.reduce(
      (total, value) => total + value.expectedCount,
      0
    ),
    predictedCount: values.reduce(
      (total, value) => total + value.predictedCount,
      0
    ),
    truePositive: tp,
    falsePositive: fp,
    falseNegative: fn,
    precision,
    recall,
    f1:
      precision + recall === 0
        ? 0
        : Math.round(
            ((2 * precision * recall) / (precision + recall)) * 10000
          ) / 10000
  };
}

export function summarizeCarriers(
  evaluations: VerseEvaluation[]
): CarrierSummary {
  const withSpan = <
    K extends "carrierExact" | "carrierOverlap" | "visibleCarrierExact"
  >(
    key: K
  ) => {
    const base = sumMetrics(evaluations.map((evaluation) => evaluation[key]));
    const matched = evaluations.reduce(
      (total, evaluation) => total + evaluation[key].matchedVisibleSpanCount,
      0
    );
    const iou = evaluations.reduce(
      (total, evaluation) =>
        total +
        evaluation[key].meanSpanIoU * evaluation[key].matchedVisibleSpanCount,
      0
    );
    return {
      ...base,
      matchedVisibleSpanCount: matched,
      meanSpanIoU: ratio(iou, matched)
    };
  };
  return {
    verses: evaluations.length,
    carrierExact: withSpan("carrierExact"),
    carrierOverlap: withSpan("carrierOverlap"),
    visibilityClassification: sumMetrics(
      evaluations.map((evaluation) => evaluation.visibilityClassification)
    ),
    visibleCarrierExact: withSpan("visibleCarrierExact"),
    emptyCarrierExact: sumMetrics(
      evaluations.map((evaluation) => evaluation.emptyCarrierExact)
    ),
    inventoryOccurrence: sumMetrics(
      evaluations.map((evaluation) => evaluation.inventoryOccurrence)
    ),
    cardinalityExactVerseRate: ratio(
      evaluations.filter(
        (evaluation) => evaluation.cardinality.exactVerseCount === 1
      ).length,
      evaluations.length
    ),
    absoluteOccurrenceError: evaluations.reduce(
      (total, evaluation) =>
        total + evaluation.cardinality.absoluteOccurrenceError,
      0
    )
  };
}

export interface VerseAccounting {
  ref: string;
  units: number;
  unresolved: number;
  fullyAccounted: boolean;
  /** Every reference occurrence exactly reproduced and no extra visible carrier. */
  fullyAgreeing: boolean | null;
}

export interface ScoreReport {
  version: typeof SCORE_VERSION;
  runId: string;
  edition: string;
  scenario: string;
  split: string;
  policy: Record<string, boolean>;
  predictionsSha256: string;
  referencePages: Record<string, string>;
  comparableVerses: number;
  nonComparable: Array<{ ref: string; reason: string }>;
  carrier: {
    all: CarrierSummary;
    byTestament: Record<string, CarrierSummary>;
    byGenre: Record<string, CarrierSummary>;
  };
  occurrences?: {
    all: OccurrenceSummary;
    byTestament: Record<string, OccurrenceSummary>;
    byGenre: Record<string, OccurrenceSummary>;
    byDifficulty: Record<string, OccurrenceSummary>;
    identity: {
      carrierExactWithPositions: number;
      sameSourcePosition: number;
      rate: number;
    };
  };
  accounting: {
    verses: number;
    fullyAccountedVerses: number;
    fullyAccountedRate: number;
    fullyAgreeingVerses: number;
    fullyAgreeingRate: number;
    unresolvedUnits: number;
    units: number;
  };
}

export async function scoreRun(options: {
  run: PredictionRun;
  expectedSha256: string;
  acquisitionRoot?: string;
}): Promise<{
  report: ScoreReport;
  records: OccurrenceRecord[];
  evaluations: VerseEvaluation[];
}> {
  const actual = sha256(stableStringify(options.run));
  if (actual !== options.expectedSha256)
    throw new Error(`prediction-hash-mismatch:${options.run.runId}`);
  const run = options.run;
  const predictedByCanonical = new Map<string, PredictedVerse>();
  const blocked = new Set<string>();
  for (const verse of run.verses) {
    if (verse.canonicalRefs.length === 1)
      predictedByCanonical.set(verse.canonicalRefs[0]!, verse);
    else verse.canonicalRefs.forEach((ref) => blocked.add(ref));
  }
  const evaluations: VerseEvaluation[] = [];
  const records: OccurrenceRecord[] = [];
  const accounting: VerseAccounting[] = [];
  const nonComparable: Array<{ ref: string; reason: string }> = [];
  let referencePages: Record<string, string> = {};
  const recordsByRef = new Map<string, OccurrenceRecord[]>();

  if (run.edition === "SG21" || run.edition === "NEG") {
    const reference = await concordanceReference(
      run.edition,
      run.chapters,
      options.acquisitionRoot
    );
    referencePages = reference.pages;
    nonComparable.push(...reference.nonComparable);
    for (const verse of reference.verses) {
      const predicted = predictedByCanonical.get(verse.ref);
      if (!predicted) {
        nonComparable.push({
          ref: verse.ref,
          reason: blocked.has(verse.ref)
            ? "prediction-versification-block"
            : "missing-prediction"
        });
        continue;
      }
      const localTokens = wordTokens(predicted.text).map((token) => token.text);
      if (localTokens.join("\u0001") !== predicted.tokens.join("\u0001"))
        throw new Error(`prediction-token-drift:${verse.ref}`);
      evaluations.push(
        scoreCarrierAwareVerse(
          verse.ref,
          readerPlacements(predicted),
          goldPlacements(verse.gold)
        )
      );
      const verseRecords = occurrenceRecords(verse, predicted);
      records.push(...verseRecords);
      recordsByRef.set(verse.ref, verseRecords);
      const units = predicted.decisions.length;
      const unresolved = predicted.decisions.filter(
        (decision) => decision.state === "unresolved"
      ).length;
      accounting.push({
        ref: verse.ref,
        units,
        unresolved,
        fullyAccounted:
          units > 0 &&
          unresolved === 0 &&
          predicted.resolutionIssues.length === 0,
        fullyAgreeing: verseRecords.every((record) =>
          [
            "visible-exact",
            "empty-anchor-exact",
            "gold-silent-pred-unresolved",
            "gold-silent-pred-empty"
          ].includes(record.outcome)
        )
      });
    }
  } else {
    const reference = await csvReference(run.edition, run.chapters);
    for (const [ref, gold] of reference) {
      const predicted = predictedByCanonical.get(ref);
      if (!predicted) {
        nonComparable.push({ ref, reason: "missing-prediction" });
        continue;
      }
      evaluations.push(
        scoreCarrierAwareVerse(ref, readerPlacements(predicted), gold)
      );
      const units = predicted.decisions.length;
      const unresolved = predicted.decisions.filter(
        (decision) => decision.state === "unresolved"
      ).length;
      accounting.push({
        ref,
        units,
        unresolved,
        fullyAccounted:
          units > 0 &&
          unresolved === 0 &&
          predicted.resolutionIssues.length === 0,
        fullyAgreeing: null
      });
    }
  }

  const groupCarrier = (key: (ref: string) => string) => {
    const groups = new Map<string, VerseEvaluation[]>();
    for (const evaluation of evaluations) {
      const group = key(evaluation.ref);
      groups.set(group, [...(groups.get(group) ?? []), evaluation]);
    }
    return Object.fromEntries(
      [...groups]
        .sort()
        .map(([group, values]) => [group, summarizeCarriers(values)])
    );
  };
  const groupOccurrences = (key: (record: OccurrenceRecord) => string[]) => {
    const groups = new Map<string, OccurrenceRecord[]>();
    for (const record of records)
      for (const group of key(record))
        groups.set(group, [...(groups.get(group) ?? []), record]);
    return Object.fromEntries(
      [...groups]
        .sort()
        .map(([group, values]) => [group, summarizeOccurrences(values)])
    );
  };
  const bookOf = (ref: string) => ref.split(".")[0]!;
  const identity = (() => {
    let withPositions = 0;
    let same = 0;
    for (const record of records) {
      if (record.goldKind === "silent" || record.goldKind === "empty") continue;
      if (record.outcome === "visible-exact") {
        withPositions += 1;
        same += 1;
      } else if (record.outcome === "visible-swapped-occurrence")
        withPositions += 1;
    }
    return {
      carrierExactWithPositions: withPositions,
      sameSourcePosition: same,
      rate: ratio(same, withPositions)
    };
  })();
  const fullyAgreeing = accounting.filter(
    (entry) => entry.fullyAgreeing === true
  ).length;
  const report: ScoreReport = {
    version: SCORE_VERSION,
    runId: run.runId,
    edition: run.edition,
    scenario: run.scenario,
    split: run.split,
    policy: run.policy,
    predictionsSha256: actual,
    referencePages,
    comparableVerses: evaluations.length,
    nonComparable,
    carrier: {
      all: summarizeCarriers(evaluations),
      byTestament: groupCarrier((ref) => testamentOfBook(bookOf(ref))),
      byGenre: groupCarrier((ref) => genreOfBook(bookOf(ref)))
    },
    occurrences: records.length
      ? {
          all: summarizeOccurrences(records),
          byTestament: groupOccurrences((record) => [
            testamentOfBook(bookOf(record.ref))
          ]),
          byGenre: groupOccurrences((record) => [
            genreOfBook(bookOf(record.ref))
          ]),
          byDifficulty: groupOccurrences((record) => record.difficulty),
          identity
        }
      : undefined,
    accounting: {
      verses: accounting.length,
      fullyAccountedVerses: accounting.filter((entry) => entry.fullyAccounted)
        .length,
      fullyAccountedRate: ratio(
        accounting.filter((entry) => entry.fullyAccounted).length,
        accounting.length
      ),
      fullyAgreeingVerses: fullyAgreeing,
      fullyAgreeingRate: ratio(fullyAgreeing, accounting.length),
      unresolvedUnits: accounting.reduce(
        (total, entry) => total + entry.unresolved,
        0
      ),
      units: accounting.reduce((total, entry) => total + entry.units, 0)
    }
  };
  return { report, records, evaluations };
}

export async function readRun(
  directory: string
): Promise<{ run: PredictionRun; sha256: string }> {
  const run = JSON.parse(
    await readFile(path.join(directory, "predictions.json"), "utf8")
  ) as PredictionRun;
  const manifest = JSON.parse(
    await readFile(path.join(directory, "manifest.json"), "utf8")
  ) as { predictionsSha256: string };
  return { run, sha256: manifest.predictionsSha256 };
}
