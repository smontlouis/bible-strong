/**
 * Evaluator-side view for the local prototype: every verse of a scored run
 * with our placements and Concordance's, both on our own words, and the
 * outcome of each source word. It quotes target text and reference
 * annotations, so it stays under the ignored outputs directory.
 */
import { tokenizeText } from "../../src/tokenize.js";
import type { PredictedVerse, PredictionRun } from "./predict.js";
import { disagreementCategory, type DisagreementCategory } from "./report.js";
import {
  concordanceReference,
  occurrenceRecords,
  stepPositionOfUnit,
  type OccurrenceOutcome,
  type OccurrenceRecord,
  type ReferenceVerse
} from "./score.js";
import { chapterOfRef } from "./shared.js";

export const COMPARE_VIEW_VERSION = "strong-concordance-compare-view-v1";

export interface SourceWord {
  surface: string;
  gloss: string;
  morphology: string;
}

export interface CompareCarrier {
  /** Our words carrying the Strong (a discontinuous reference keeps its gap). */
  tokens: number[];
  strong: string;
  position: number | null;
  /** Ours: how the engine placed it. Theirs: word, phrase or discontinuous. */
  method: string;
}

export interface CompareEmpty {
  after: number;
  strong: string;
  position: number | null;
  /** Ours: assurance of the decision. Theirs: marker or punctuation. */
  method: string;
}

export interface CompareOutcome {
  position: number | null;
  strong: string;
  ours: string[];
  ourState: OccurrenceRecord["predictedState"];
  outcome: OccurrenceOutcome;
  category: DisagreementCategory | null;
  theirTokens: number[];
  ourTokens: number[];
  theirAnchor?: number;
  ourAnchor?: number;
}

export interface CompareVerse {
  ref: string;
  verse: number;
  /** Concordance's comparability, or why the verse could not be compared. */
  comparability: string;
  textDifferences: Array<{ concordance: string | null; local: string | null }>;
  segments: Array<{ t: string; w?: number }>;
  ours: {
    carriers: CompareCarrier[];
    empties: CompareEmpty[];
    uncertain: Array<{ strong: string; position: number | null }>;
  };
  theirs: { carriers: CompareCarrier[]; empties: CompareEmpty[] } | null;
  outcomes: CompareOutcome[];
  sources: Record<string, SourceWord>;
}

export interface CompareView {
  version: typeof COMPARE_VIEW_VERSION;
  runId: string;
  edition: string;
  split: string;
  chapters: Record<string, CompareVerse[]>;
}

/** A STEP row (first six columns joined by " | ") as the reader sees it. */
export function sourceWordOfStepRow(row: string): SourceWord {
  const [, a = "", b = "", c = "", , e = ""] = row.split(" | ");
  if (/^G\d/u.test(c))
    return {
      surface: a.replace(/\s*\([^)]*\)\s*$/u, ""),
      gloss: b,
      morphology: c.split("=")[1] ?? ""
    };
  return { surface: a.replace(/[/\\]/gu, ""), gloss: c, morphology: e };
}

const positionOfUnit = (unitId: string | undefined) =>
  unitId ? (stepPositionOfUnit(unitId)?.position ?? null) : null;

const span = (start: number, end: number) =>
  Array.from({ length: end - start + 1 }, (_, index) => start + index);

function ourSide(verse: PredictedVerse): CompareVerse["ours"] {
  return {
    carriers: verse.carriers
      .filter(
        (carrier) =>
          carrier.visibility === "reader" &&
          (carrier.placement === "word" || carrier.placement === "phrase") &&
          carrier.startWordIndex !== undefined
      )
      .map((carrier) => ({
        tokens: span(
          carrier.startWordIndex!,
          carrier.endWordIndex ?? carrier.startWordIndex!
        ),
        strong: carrier.strong,
        position: positionOfUnit(carrier.resolutionUnitId),
        method:
          carrier.placement === "phrase"
            ? "phrase"
            : (carrier.diagnostic ?? carrier.source)
      })),
    empties: verse.decisions
      .filter((decision) => decision.state === "empty")
      .map((decision) => ({
        after: decision.anchor?.insertAfterWordIndex ?? -1,
        strong: decision.strong.join(" "),
        position: positionOfUnit(decision.sourceUnitId),
        method: decision.assurance
      })),
    uncertain: verse.decisions
      .filter((decision) => decision.state === "unresolved")
      .map((decision) => ({
        strong: decision.strong.join(" "),
        position: positionOfUnit(decision.sourceUnitId)
      }))
  };
}

function theirSide(reference: ReferenceVerse): CompareVerse["theirs"] {
  const occurrences = reference.gold.occurrences;
  return {
    carriers: occurrences
      .filter((occurrence) => occurrence.kind !== "empty")
      .map((occurrence) => ({
        tokens: occurrence.tokenIndices,
        strong: occurrence.strong,
        position: occurrence.position,
        method: occurrence.kind
      })),
    empties: occurrences
      .filter((occurrence) => occurrence.kind === "empty")
      .map((occurrence) => ({
        after: occurrence.insertAfterWordIndex ?? -1,
        strong: occurrence.strong,
        position: occurrence.position,
        method: occurrence.punctuationCarrier ? "punctuation" : "marker"
      }))
  };
}

export async function buildCompareView(options: {
  run: PredictionRun;
  stepRows: Map<string, string>;
  acquisitionRoot?: string;
}): Promise<CompareView> {
  const { run } = options;
  if (run.edition !== "SG21" && run.edition !== "NEG")
    throw new Error(`compare-view-needs-a-concordance-edition:${run.edition}`);
  const reference = await concordanceReference(
    run.edition,
    run.chapters,
    options.acquisitionRoot
  );
  const references = new Map(
    reference.verses.map((verse) => [verse.ref, verse])
  );
  const reasons = new Map(
    reference.nonComparable.map((entry) => [entry.ref, entry.reason])
  );
  const chapters: Record<string, CompareVerse[]> = Object.fromEntries(
    run.chapters.map((chapter) => [chapter, []])
  );
  // As in the evaluator, a canonical verse claimed by several native verses is
  // compared with the last one only.
  const scored = new Map<string, PredictedVerse>();
  for (const verse of run.verses)
    if (verse.canonicalRefs.length === 1)
      scored.set(verse.canonicalRefs[0]!, verse);
  for (const verse of run.verses) {
    // Several canonical verses in one native verse cannot be scored per verse:
    // the verse is shown with our side only.
    const merged =
      verse.canonicalRefs.length !== 1 ||
      scored.get(verse.canonicalRefs[0]!) !== verse;
    const ref = merged
      ? verse.canonicalRefs.join("+")
      : verse.canonicalRefs[0]!;
    const list = chapters[chapterOfRef(verse.canonicalRefs[0]!)];
    if (!list) continue;
    const gold = merged ? undefined : references.get(ref);
    let word = 0;
    const segments = tokenizeText(verse.text.trimEnd()).map((segment) =>
      segment.kind === "word"
        ? { t: segment.text, w: word++ }
        : { t: segment.text }
    );
    const outcomes: CompareOutcome[] = gold
      ? occurrenceRecords(gold, verse).map((record) => ({
          position: record.position,
          strong: record.goldStrong ?? record.predictedStrong.join(" "),
          ours: record.predictedStrong,
          ourState: record.predictedState,
          outcome: record.outcome,
          category: disagreementCategory(record),
          theirTokens: record.goldTokens,
          ourTokens: record.predictedTokens,
          ...(record.goldAnchor !== undefined
            ? { theirAnchor: record.goldAnchor }
            : {}),
          ...(record.predictedAnchor !== undefined
            ? { ourAnchor: record.predictedAnchor }
            : {})
        }))
      : [];
    // A unit names its own STEP verse; a reference-only position uses ours.
    const sources: Record<string, SourceWord> = {};
    const addSource = (stepRef: string, position: number) => {
      const row = options.stepRows.get(`${stepRef}#${position}`);
      if (row && !sources[position])
        sources[position] = sourceWordOfStepRow(row);
    };
    for (const decision of verse.decisions) {
      const unit = stepPositionOfUnit(decision.sourceUnitId);
      if (unit) addSource(unit.ref, unit.position);
    }
    for (const occurrence of gold?.gold.occurrences ?? [])
      if (occurrence.position !== null) addSource(ref, occurrence.position);
    list.push({
      ref,
      verse: Number(verse.canonicalRefs[0]!.split(".")[2]),
      comparability: gold
        ? gold.gold.comparability
        : merged
          ? "versification-block"
          : (reasons.get(ref) ?? "missing-concordance-verse"),
      textDifferences: gold?.gold.textDifferences ?? [],
      segments,
      ours: ourSide(verse),
      theirs: gold ? theirSide(gold) : null,
      outcomes,
      sources
    });
  }
  for (const list of Object.values(chapters))
    list.sort((left, right) => left.verse - right.verse);
  return {
    version: COMPARE_VIEW_VERSION,
    runId: run.runId,
    edition: run.edition,
    split: run.split,
    chapters
  };
}
