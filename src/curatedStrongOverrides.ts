import { existsSync, readFileSync } from "node:fs";

import { type AssignedStrong } from "./align.js";
import { type ReaderAlignmentResult } from "./readerAlignment.js";

export interface CuratedStrongOverride {
  bible: string;
  ref: string;
  target?: "word" | "empty";
  wordIndex: number;
  normalized: string;
  strong: string[];
  confidence: number;
  source: string;
  reason: string;
}

export const CURATED_STRONG_OVERRIDES: CuratedStrongOverride[] = [
  {
    bible: "nbs",
    ref: "Gen.1.2",
    wordIndex: 19,
    normalized: "souffle",
    strong: ["H7307"],
    confidence: 0.9,
    source: "llm-transfer:Darby",
    reason: "Darby reference transfer matches the original ruach occurrence."
  },
  {
    bible: "nbs",
    ref: "Gen.1.2",
    wordIndex: 22,
    normalized: "tournoyait",
    strong: ["H7363"],
    confidence: 0.9,
    source: "llm-transfer:Darby",
    reason: "Darby reference transfer matches the original rachaph occurrence."
  },
  {
    bible: "bds",
    ref: "Gen.1.2",
    wordIndex: 4,
    normalized: "chaotique",
    strong: ["H8414"],
    confidence: 0.88,
    source: "llm-transfer:Darby",
    reason: "Semantic match for tohu in the target wording."
  },
  {
    bible: "bds",
    ref: "Gen.1.4",
    wordIndex: 12,
    normalized: "des",
    strong: ["H0996"],
    confidence: 0.86,
    source: "llm-transfer:Darby",
    reason: "Translated separation preposition retained in the target wording."
  },
  {
    bible: "fmar",
    ref: "Gen.1.2",
    wordIndex: 5,
    normalized: "forme",
    strong: ["H8414"],
    confidence: 0.86,
    source: "llm-transfer:Darby+manual-index-correction",
    reason: "LLM identified the phrase sans forme; the content head is forme."
  },
  {
    bible: "fmar",
    ref: "Gen.1.2",
    wordIndex: 22,
    normalized: "mouvait",
    strong: ["H7363"],
    confidence: 0.86,
    source: "llm-transfer:Darby+manual-index-correction",
    reason: "LLM identified the phrase se mouvait; the content head is mouvait."
  },
  {
    bible: "fmar",
    ref: "Gen.1.4",
    wordIndex: 13,
    normalized: "des",
    strong: ["H0996"],
    confidence: 0.86,
    source: "llm-transfer:Darby",
    reason: "Translated separation preposition retained in the target wording."
  },
  {
    bible: "fmar",
    ref: "Gen.1.5",
    wordIndex: 2,
    normalized: "nomma",
    strong: ["H7121"],
    confidence: 0.88,
    source: "llm-transfer:Darby",
    reason: "Matches the first qara occurrence in the verse."
  },
  {
    bible: "fmar",
    ref: "Gen.1.5",
    wordIndex: 11,
    normalized: "fut",
    strong: ["H1961"],
    confidence: 0.88,
    source: "llm-transfer:Darby",
    reason: "Matches the first hayah occurrence in the verse."
  },
  {
    bible: "s21",
    ref: "Gen.1.4",
    wordIndex: 8,
    normalized: "il",
    strong: ["H0430"],
    confidence: 0.86,
    source: "llm-transfer:Darby+concordance.bible",
    reason:
      "Matches SG21 concordance.bible handling for the repeated Elohim subject."
  },
  {
    bible: "s21",
    ref: "Gen.1.4",
    wordIndex: 12,
    normalized: "des",
    strong: ["H0996"],
    confidence: 0.86,
    source: "llm-transfer:Darby+concordance.bible",
    reason:
      "Matches SG21 concordance.bible handling for the separation preposition."
  },
  {
    bible: "fixture-empty",
    ref: "Gen.1.4",
    target: "empty",
    wordIndex: 1,
    normalized: "",
    strong: ["H0996"],
    confidence: 0.8,
    source: "test:curated-empty",
    reason: "Fixture override used to verify curated empty Strong handling."
  }
];

export function applyCuratedStrongOverrides(options: {
  bible: string;
  ref: string;
  result: ReaderAlignmentResult;
}): number {
  const overrides = getCuratedStrongOverrides().filter(
    (override) =>
      override.bible === options.bible.toLowerCase() &&
      override.ref === options.ref
  );
  let appliedStrongCount = 0;

  for (const override of overrides) {
    if ((override.target ?? "word") === "empty") {
      const missingStrong = override.strong.filter(
        (strong) =>
          !options.result.emptyAssignments.some(
            (assignment) =>
              assignment.strong === strong &&
              assignment.insertAfterWordIndex === override.wordIndex &&
              assignment.source === override.source
          )
      );
      if (missingStrong.length === 0) {
        continue;
      }

      for (const strong of missingStrong) {
        options.result.emptyAssignments.push({
          strong,
          confidence: override.confidence,
          method: "curated-empty",
          source: override.source,
          insertAfterWordIndex: override.wordIndex
        });
      }
      options.result.emptyAssignments.sort(
        (left, right) =>
          left.insertAfterWordIndex - right.insertAfterWordIndex ||
          left.strong.localeCompare(right.strong)
      );
      appliedStrongCount += missingStrong.length;
      continue;
    }

    const word = getWord(options.result, override.wordIndex);
    if (!word || word.normalized !== override.normalized) {
      continue;
    }

    const existing = options.result.assignments.get(override.wordIndex);
    const missingStrong = override.strong.filter(
      (strong) => !existing?.strong.includes(strong)
    );
    if (missingStrong.length === 0) {
      continue;
    }

    if (existing) {
      existing.strong.push(...missingStrong);
      existing.confidence = Math.max(existing.confidence, override.confidence);
      existing.source = mergeLabel(existing.source, override.source);
      existing.method = "curated-llm-transfer";
      existing.originalConfirmed = true;
    } else {
      options.result.assignments.set(override.wordIndex, {
        strong: missingStrong,
        confidence: override.confidence,
        source: override.source,
        method: "curated-llm-transfer",
        originalConfirmed: true
      } satisfies AssignedStrong);
    }

    appliedStrongCount += missingStrong.length;
  }

  refreshResultCounts(options.result);
  return appliedStrongCount;
}

export function getCuratedStrongOverrides(): CuratedStrongOverride[] {
  return [
    ...CURATED_STRONG_OVERRIDES,
    ...readJsonCuratedStrongOverrides("data/curated-strong-overrides.json")
  ];
}

function readJsonCuratedStrongOverrides(path: string): CuratedStrongOverride[] {
  if (!existsSync(path)) return [];

  const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
  if (!Array.isArray(raw)) return [];

  return raw.filter(isCuratedStrongOverride);
}

function isCuratedStrongOverride(
  value: unknown
): value is CuratedStrongOverride {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CuratedStrongOverride>;

  return (
    typeof candidate.bible === "string" &&
    typeof candidate.ref === "string" &&
    (candidate.target === undefined ||
      candidate.target === "word" ||
      candidate.target === "empty") &&
    Number.isInteger(candidate.wordIndex) &&
    typeof candidate.normalized === "string" &&
    Array.isArray(candidate.strong) &&
    candidate.strong.every((strong) => typeof strong === "string") &&
    typeof candidate.confidence === "number" &&
    typeof candidate.source === "string" &&
    typeof candidate.reason === "string"
  );
}

function getWord(
  result: ReaderAlignmentResult,
  wantedWordIndex: number
): { normalized: string } | undefined {
  let wordIndex = -1;

  for (const segment of result.segments) {
    if (segment.kind !== "word") continue;
    wordIndex += 1;
    if (wordIndex === wantedWordIndex) {
      return { normalized: segment.normalized };
    }
  }

  return undefined;
}

function refreshResultCounts(result: ReaderAlignmentResult): void {
  result.taggedWordCount = result.assignments.size;
  result.lowConfidenceWordCount = [...result.assignments.values()].filter(
    (assignment) => assignment.confidence < 0.55
  ).length;
  result.strongWordOccurrenceCount = [...result.assignments.values()].reduce(
    (sum, assignment) => sum + assignment.strong.length,
    0
  );
  result.emptyStrongOccurrenceCount = result.emptyAssignments.length;
  result.totalStrongOccurrenceCount =
    result.strongWordOccurrenceCount + result.emptyStrongOccurrenceCount;
  result.multiStrongWordCount = [...result.assignments.values()].filter(
    (assignment) => assignment.strong.length > 1
  ).length;
}

function mergeLabel(left: string, right: string): string {
  const labels = new Set(
    [...left.split("+"), ...right.split("+")].filter(Boolean)
  );

  return [...labels].join("+");
}
