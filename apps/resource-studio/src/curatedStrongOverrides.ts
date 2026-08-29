import { existsSync, readFileSync } from "node:fs";

import { type AssignedStrong } from "./align.js";
import { type ReaderAlignmentResult } from "./readerAlignment.js";

export interface CuratedStrongOverride {
  bible: string;
  ref: string;
  target?: "word" | "empty" | "phrase";
  replace?: {
    target: "word" | "empty" | "phrase";
    wordIndex?: number;
    startWordIndex?: number;
    endWordIndex?: number;
  };
  wordIndex: number;
  normalized: string;
  startWordIndex?: number;
  endWordIndex?: number;
  normalizedPhrase?: string[];
  strong: string[];
  confidence: number;
  source: string;
  reason: string;
}

export type CuratedStrongOverrideIndex = ReadonlyMap<
  string,
  CuratedStrongOverride[]
>;

export const CURATED_STRONG_OVERRIDES: CuratedStrongOverride[] = [
  {
    bible: "nbs",
    ref: "Gen.1.2",
    wordIndex: 18,
    normalized: "souffle",
    strong: ["H7307"],
    confidence: 0.9,
    source: "llm-transfer:Darby",
    reason: "Darby reference transfer matches the original ruach occurrence."
  },
  {
    bible: "nbs",
    ref: "Gen.1.2",
    wordIndex: 21,
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
  },
  {
    bible: "fixture-phrase",
    ref: "Heb.1.4",
    target: "phrase",
    wordIndex: 2,
    normalized: "dans la mesure ou",
    startWordIndex: 2,
    endWordIndex: 5,
    normalizedPhrase: ["dans", "la", "mesure", "ou"],
    strong: ["G3745"],
    confidence: 0.86,
    source: "test:curated-phrase",
    reason: "Fixture override used to verify curated phrase Strong handling."
  },
  {
    bible: "fixture-move",
    ref: "Gen.1.27",
    target: "word",
    replace: {
      target: "word",
      wordIndex: 14
    },
    wordIndex: 3,
    normalized: "humains",
    strong: ["H0120"],
    confidence: 0.95,
    source: "test:curated-relocation",
    reason: "Fixture override used to verify curated Strong relocation."
  }
];

export function applyCuratedStrongOverrides(options: {
  bible: string;
  ref: string;
  result: ReaderAlignmentResult;
  overrideIndex?: CuratedStrongOverrideIndex;
}): number {
  const bible = options.bible.toLowerCase();
  const overrides = options.overrideIndex
    ? (options.overrideIndex.get(overrideIndexKey(bible, options.ref)) ?? [])
    : getCuratedStrongOverrides().filter(
        (override) => override.bible === bible && override.ref === options.ref
      );
  let appliedStrongCount = 0;

  for (const override of overrides) {
    // A relocation is one logical operation. Validate both ends before
    // mutating the result so token drift cannot delete the old placement
    // without successfully creating the new one.
    if (
      !isValidOverrideDestination(options.result, override) ||
      !isValidReplacementSource(options.result, override)
    ) {
      continue;
    }

    applyReplacement(options.result, override);

    if (override.target === "phrase") {
      if (!isValidPhraseOverride(options.result, override)) {
        continue;
      }

      const startWordIndex = override.startWordIndex ?? override.wordIndex;
      const endWordIndex = override.endWordIndex ?? override.wordIndex;
      const missingStrong = override.strong.filter(
        (strong) =>
          !options.result.phraseAssignments.some(
            (assignment) =>
              assignment.startWordIndex === startWordIndex &&
              assignment.endWordIndex === endWordIndex &&
              assignment.strong.includes(strong)
          )
      );

      if (missingStrong.length === 0) {
        continue;
      }

      removeStrongFromCoveredWords(
        options.result,
        startWordIndex,
        endWordIndex,
        missingStrong
      );
      options.result.phraseAssignments.push({
        strong: missingStrong,
        confidence: override.confidence,
        method: "curated-phrase",
        source: override.source,
        startWordIndex,
        endWordIndex,
        originalConfirmed: true
      });
      options.result.phraseAssignments.sort(
        (left, right) =>
          left.startWordIndex - right.startWordIndex ||
          left.endWordIndex - right.endWordIndex ||
          left.strong.join(" ").localeCompare(right.strong.join(" "))
      );
      appliedStrongCount += missingStrong.length;
      continue;
    }

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

export function buildCuratedStrongOverrideIndex(
  overrides: CuratedStrongOverride[] = getCuratedStrongOverrides()
): CuratedStrongOverrideIndex {
  const index = new Map<string, CuratedStrongOverride[]>();
  for (const override of overrides) {
    const key = overrideIndexKey(override.bible.toLowerCase(), override.ref);
    const entries = index.get(key) ?? [];
    entries.push(override);
    index.set(key, entries);
  }
  return index;
}

function overrideIndexKey(bible: string, ref: string): string {
  return `${bible}\0${ref}`;
}

function isValidOverrideDestination(
  result: ReaderAlignmentResult,
  override: CuratedStrongOverride
): boolean {
  if (override.target === "phrase") {
    return isValidPhraseOverride(result, override);
  }

  if ((override.target ?? "word") === "empty") {
    return (
      Number.isInteger(override.wordIndex) &&
      override.wordIndex >= -1 &&
      override.wordIndex < countWords(result)
    );
  }

  const word = getWord(result, override.wordIndex);
  return !!word && word.normalized === override.normalized;
}

function isValidReplacementSource(
  result: ReaderAlignmentResult,
  override: CuratedStrongOverride
): boolean {
  const replacement = override.replace;
  if (!replacement) return true;

  const expected = new Set(
    override.strong.map((strong) => strong.toUpperCase())
  );
  const counts = new Map([...expected].map((strong) => [strong, 0]));
  const countStrong = (strong: string): void => {
    const normalized = strong.toUpperCase();
    if (!expected.has(normalized)) return;
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  };

  if (replacement.target === "word") {
    if (!Number.isInteger(replacement.wordIndex)) return false;
    for (const strong of result.assignments.get(replacement.wordIndex!)
      ?.strong ?? []) {
      countStrong(strong);
    }
  } else if (replacement.target === "phrase") {
    if (
      !Number.isInteger(replacement.startWordIndex) ||
      !Number.isInteger(replacement.endWordIndex)
    ) {
      return false;
    }
    for (const assignment of result.phraseAssignments) {
      if (
        assignment.startWordIndex !== replacement.startWordIndex ||
        assignment.endWordIndex !== replacement.endWordIndex
      ) {
        continue;
      }
      for (const strong of assignment.strong) {
        countStrong(strong);
      }
    }
  } else {
    if (!Number.isInteger(replacement.wordIndex)) return false;
    for (const assignment of result.emptyAssignments) {
      if (assignment.insertAfterWordIndex === replacement.wordIndex) {
        countStrong(assignment.strong);
      }
    }
  }

  return [...expected].every((strong) => counts.get(strong) === 1);
}

function applyReplacement(
  result: ReaderAlignmentResult,
  override: CuratedStrongOverride
): void {
  if (!override.replace) return;
  const strong = new Set(override.strong.map((code) => code.toUpperCase()));
  const replacement = override.replace;

  if (replacement.target === "word" && replacement.wordIndex !== undefined) {
    const assignment = result.assignments.get(replacement.wordIndex);
    if (assignment) {
      assignment.strong = assignment.strong.filter(
        (code) => !strong.has(code.toUpperCase())
      );
      if (assignment.strong.length === 0) {
        result.assignments.delete(replacement.wordIndex);
      }
    }
  }

  if (replacement.target === "phrase") {
    result.phraseAssignments = result.phraseAssignments
      .map((assignment) => {
        if (
          assignment.startWordIndex !== replacement.startWordIndex ||
          assignment.endWordIndex !== replacement.endWordIndex
        ) {
          return assignment;
        }
        return {
          ...assignment,
          strong: assignment.strong.filter(
            (code) => !strong.has(code.toUpperCase())
          )
        };
      })
      .filter((assignment) => assignment.strong.length > 0);
  }

  if (replacement.target === "empty" && replacement.wordIndex !== undefined) {
    result.emptyAssignments = result.emptyAssignments.filter(
      (assignment) =>
        assignment.insertAfterWordIndex !== replacement.wordIndex ||
        !strong.has(assignment.strong.toUpperCase())
    );
  }
}

export function getCuratedStrongOverrides(
  options: { includeLegacySingleModelAuto?: boolean } = {}
): CuratedStrongOverride[] {
  const overrides = [
    ...CURATED_STRONG_OVERRIDES,
    ...readJsonCuratedStrongOverrides("data/curated-strong-overrides.json")
  ];

  if (options.includeLegacySingleModelAuto) {
    return overrides;
  }

  return overrides.filter(
    (override) =>
      !isLegacySingleModelAutoOverride(override) &&
      !isUnverifiedSemanticRefillOverride(override)
  );
}

export function isLegacySingleModelAutoOverride(
  override: CuratedStrongOverride
): boolean {
  return (
    override.source.startsWith("llm-review:single-model-auto") ||
    (override.source === "llm-review:human-approved" &&
      /auto-accepted by review:llm/iu.test(override.reason))
  );
}

export function isUnverifiedSemanticRefillOverride(
  override: CuratedStrongOverride
): boolean {
  return (
    override.source === "semantic-refill:llm" ||
    override.source === "semantic-refill:llm-reference-style"
  );
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
      candidate.target === "empty" ||
      candidate.target === "phrase") &&
    Number.isInteger(candidate.wordIndex) &&
    typeof candidate.normalized === "string" &&
    (candidate.target !== "phrase" ||
      (Number.isInteger(candidate.startWordIndex) &&
        Number.isInteger(candidate.endWordIndex) &&
        Array.isArray(candidate.normalizedPhrase) &&
        candidate.normalizedPhrase.every(
          (normalized) => typeof normalized === "string"
        ))) &&
    (candidate.replace === undefined ||
      (typeof candidate.replace === "object" &&
        candidate.replace !== null &&
        (candidate.replace.target === "word" ||
          candidate.replace.target === "empty" ||
          candidate.replace.target === "phrase"))) &&
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

function countWords(result: ReaderAlignmentResult): number {
  return result.segments.reduce(
    (count, segment) => count + (segment.kind === "word" ? 1 : 0),
    0
  );
}

function isValidPhraseOverride(
  result: ReaderAlignmentResult,
  override: CuratedStrongOverride
): boolean {
  const startWordIndex = override.startWordIndex ?? override.wordIndex;
  const endWordIndex = override.endWordIndex ?? override.wordIndex;

  if (
    !Number.isInteger(startWordIndex) ||
    !Number.isInteger(endWordIndex) ||
    startWordIndex < 0 ||
    endWordIndex < startWordIndex
  ) {
    return false;
  }

  const expected = override.normalizedPhrase ?? [];
  if (expected.length !== endWordIndex - startWordIndex + 1) {
    return false;
  }

  for (let index = startWordIndex; index <= endWordIndex; index += 1) {
    const word = getWord(result, index);
    if (!word || word.normalized !== expected[index - startWordIndex]) {
      return false;
    }
  }

  return true;
}

function removeStrongFromCoveredWords(
  result: ReaderAlignmentResult,
  startWordIndex: number,
  endWordIndex: number,
  strong: string[]
): void {
  const strongSet = new Set(strong);

  for (let index = startWordIndex; index <= endWordIndex; index += 1) {
    const assignment = result.assignments.get(index);
    if (!assignment) continue;

    assignment.strong = assignment.strong.filter(
      (code) => !strongSet.has(code)
    );
    if (assignment.strong.length === 0) {
      result.assignments.delete(index);
    }
  }
}

function refreshResultCounts(result: ReaderAlignmentResult): void {
  const phraseWordIndexes = new Set<number>();
  for (const phrase of result.phraseAssignments) {
    for (
      let index = phrase.startWordIndex;
      index <= phrase.endWordIndex;
      index += 1
    ) {
      phraseWordIndexes.add(index);
    }
  }

  result.taggedWordCount = new Set([
    ...result.assignments.keys(),
    ...phraseWordIndexes
  ]).size;
  result.lowConfidenceWordCount =
    [...result.assignments.values()].filter(
      (assignment) => assignment.confidence < 0.55
    ).length +
    result.phraseAssignments.filter(
      (assignment) => assignment.confidence < 0.55
    ).length;
  result.strongWordOccurrenceCount =
    [...result.assignments.values()].reduce(
      (sum, assignment) => sum + assignment.strong.length,
      0
    ) +
    result.phraseAssignments.reduce(
      (sum, assignment) => sum + assignment.strong.length,
      0
    );
  result.emptyStrongOccurrenceCount = result.emptyAssignments.length;
  result.totalStrongOccurrenceCount =
    result.strongWordOccurrenceCount + result.emptyStrongOccurrenceCount;
  result.multiStrongWordCount =
    [...result.assignments.values()].filter(
      (assignment) => assignment.strong.length > 1
    ).length +
    result.phraseAssignments.filter(
      (assignment) => assignment.strong.length > 1
    ).length;
}

function mergeLabel(left: string, right: string): string {
  const labels = new Set(
    [...left.split("+"), ...right.split("+")].filter(Boolean)
  );

  return [...labels].join("+");
}
