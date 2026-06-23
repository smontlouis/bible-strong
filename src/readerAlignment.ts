import {
  alignVerse,
  type AssignedStrong,
  type AlignmentResult,
  type OriginalConstraint,
  type ReferenceSource,
  type StrongLexicon
} from "./align.js";
import {
  getOriginalStrongOccurrences,
  type OriginalStrongOccurrence
} from "./completeAlignment.js";
import { type OriginalVerse } from "./originalSource.js";
import {
  buildPhraseMatchIndex,
  findBestPhraseMatch,
  findPhraseCandidate,
  type StrongPhraseMatch,
  type StrongPhraseLexicon
} from "./phraseTranslationLexicon.js";
import { renderTaggedText } from "./render.js";
import { parseStrongOccurrences } from "./strongCsv.js";
import {
  escapeHtml,
  stripTags,
  tokenizeText,
  type TextSegment
} from "./tokenize.js";
import {
  findTranslationCandidate,
  type StrongTranslationCandidate,
  type StrongTranslationLexicon
} from "./translationLexicon.js";
import { type ReaderAlignmentPolicy } from "./translationProfiles.js";

export interface ReaderEmptyAssignment {
  strong: string;
  confidence: number;
  method: "editorial-empty" | "curated-empty";
  source: string;
  insertAfterWordIndex: number;
}

export interface ReaderPhraseAssignment {
  strong: string[];
  confidence: number;
  method: "curated-phrase" | "learned-phrase";
  source: string;
  startWordIndex: number;
  endWordIndex: number;
  originalConfirmed: boolean;
}

export interface ReaderAlignmentResult extends AlignmentResult {
  emptyAssignments: ReaderEmptyAssignment[];
  phraseAssignments: ReaderPhraseAssignment[];
  strongWordOccurrenceCount: number;
  emptyStrongOccurrenceCount: number;
  totalStrongOccurrenceCount: number;
  multiStrongWordCount: number;
}

interface EmptyOccurrence {
  strong: string;
  source: string;
  afterWordIndex: number;
  wordCount: number;
}

const MIN_EMPTY_SOURCES = 2;

const DEFAULT_READER_POLICY: ReaderAlignmentPolicy = {
  maxStrongPerWord: 3,
  minEmptySourceAgreement: MIN_EMPTY_SOURCES,
  learnedTranslationMinScore: 0.36,
  learnedFunctionWordMode: "restricted"
};

export function alignReaderVerse(options: {
  targetText: string;
  references: ReferenceSource[];
  lexicon?: StrongLexicon;
  original?: OriginalConstraint;
  originalVerse?: OriginalVerse;
  translationLexicon?: StrongTranslationLexicon;
  phraseLexicon?: StrongPhraseLexicon;
  readerPolicy?: ReaderAlignmentPolicy;
}): ReaderAlignmentResult {
  const readerPolicy = options.readerPolicy ?? DEFAULT_READER_POLICY;
  const base = alignVerse(
    options.targetText,
    options.references,
    options.lexicon,
    options.original
  );
  const phraseAssignments: ReaderPhraseAssignment[] = [];
  enrichAssignmentsFromOriginal({
    result: base,
    phraseAssignments,
    original: options.original,
    originalVerse: options.originalVerse,
    translationLexicon: options.translationLexicon,
    phraseLexicon: options.phraseLexicon,
    readerPolicy
  });
  const emptyAssignments = buildEditorialEmptyAssignments(
    base,
    phraseAssignments,
    options.references,
    readerPolicy
  );
  const phraseWordIndexes = getPhraseWordIndexes(phraseAssignments);
  const taggedWordCount = new Set([
    ...base.assignments.keys(),
    ...phraseWordIndexes
  ]).size;
  const lowConfidenceWordCount =
    [...base.assignments.values()].filter(
      (assignment) => assignment.confidence < 0.55
    ).length +
    phraseAssignments.filter((assignment) => assignment.confidence < 0.55)
      .length;
  const strongWordOccurrenceCount =
    [...base.assignments.values()].reduce(
      (sum, assignment) => sum + assignment.strong.length,
      0
    ) +
    phraseAssignments.reduce(
      (sum, assignment) => sum + assignment.strong.length,
      0
    );
  const emptyStrongOccurrenceCount = emptyAssignments.length;

  return {
    ...base,
    taggedWordCount,
    lowConfidenceWordCount,
    emptyAssignments,
    phraseAssignments,
    strongWordOccurrenceCount,
    emptyStrongOccurrenceCount,
    totalStrongOccurrenceCount:
      strongWordOccurrenceCount + emptyStrongOccurrenceCount,
    multiStrongWordCount: [...base.assignments.values()].filter(
      (assignment) => assignment.strong.length > 1
    ).length
  };
}

function enrichAssignmentsFromOriginal(options: {
  result: AlignmentResult;
  phraseAssignments: ReaderPhraseAssignment[];
  original?: OriginalConstraint;
  originalVerse?: OriginalVerse;
  translationLexicon?: StrongTranslationLexicon;
  phraseLexicon?: StrongPhraseLexicon;
  readerPolicy: ReaderAlignmentPolicy;
}): void {
  if (!options.originalVerse || !options.translationLexicon) {
    return;
  }

  const occurrences = getOriginalStrongOccurrences(options.originalVerse);
  const words = getWordSegments(options.result.segments);
  relocateSemanticAssignments({
    occurrences,
    words,
    assignments: options.result.assignments,
    translationLexicon: options.translationLexicon,
    readerPolicy: options.readerPolicy
  });
  const usedOccurrences = consumeBaseOccurrences(
    occurrences,
    options.result.assignments
  );
  const phraseMatchIndex = options.phraseLexicon
    ? buildPhraseMatchIndex({
        lexicon: options.phraseLexicon,
        words,
        existingStrongByWord: mergeExistingStrongByWord(
          options.result.assignments,
          options.phraseAssignments
        ),
        allowedStrong: new Set(
          occurrences.map((occurrence) => occurrence.strong)
        )
      })
    : undefined;

  for (const occurrence of occurrences) {
    if (usedOccurrences.has(occurrence.occurrenceId)) {
      continue;
    }

    const candidate = findReaderEnrichmentCandidate({
      occurrence,
      occurrences,
      words,
      assignments: options.result.assignments,
      phraseAssignments: options.phraseAssignments,
      phraseMatchIndex,
      translationLexicon: options.translationLexicon,
      phraseLexicon: options.phraseLexicon,
      readerPolicy: options.readerPolicy
    });

    if (!candidate) {
      continue;
    }

    const source = `${candidate.source}+${options.original?.source ?? "original"}`;

    if (candidate.target === "phrase") {
      removeStrongFromCoveredWords(
        options.result.assignments,
        candidate.startWordIndex,
        candidate.endWordIndex,
        [occurrence.strong]
      );
      options.phraseAssignments.push({
        strong: [occurrence.strong],
        confidence: candidate.confidence,
        source,
        method: candidate.method,
        startWordIndex: candidate.startWordIndex,
        endWordIndex: candidate.endWordIndex,
        originalConfirmed: true
      });
      usedOccurrences.add(occurrence.occurrenceId);
      continue;
    }

    const existing = options.result.assignments.get(candidate.wordIndex);

    if (existing) {
      existing.strong.push(occurrence.strong);
      existing.confidence = Math.max(existing.confidence, candidate.confidence);
      existing.source = mergeLabel(existing.source, source);
      existing.method = mergeMethod(existing.method, candidate.method);
      existing.originalConfirmed = true;
    } else {
      options.result.assignments.set(candidate.wordIndex, {
        strong: [occurrence.strong],
        confidence: candidate.confidence,
        source,
        method: candidate.method,
        originalConfirmed: true
      });
    }

    usedOccurrences.add(occurrence.occurrenceId);
  }
}

function relocateSemanticAssignments(options: {
  occurrences: OriginalStrongOccurrence[];
  words: Array<{ wordIndex: number; normalized: string }>;
  assignments: Map<number, AssignedStrong>;
  translationLexicon: StrongTranslationLexicon;
  readerPolicy: ReaderAlignmentPolicy;
}): void {
  for (const occurrence of options.occurrences) {
    if (!isRelocatableOriginalOccurrence(occurrence)) {
      continue;
    }

    const current = [...options.assignments.entries()].filter(
      ([, assignment]) => assignment.strong.includes(occurrence.strong)
    );
    if (current.length === 0) {
      continue;
    }

    const currentScores = current.map(([wordIndex]) => ({
      wordIndex,
      score: scoreSemanticWordForOccurrence({
        strong: occurrence.strong,
        originalTokenIndex: occurrence.tokenIndex,
        originalCount: options.occurrences.length,
        word: options.words[wordIndex],
        wordCount: options.words.length,
        translationLexicon: options.translationLexicon
      })
    }));
    const weakestCurrent = currentScores.sort((a, b) => a.score - b.score)[0];
    if (!weakestCurrent) {
      continue;
    }

    const best = options.words
      .map((word) => {
        const existing = options.assignments.get(word.wordIndex);
        if (existing?.strong.includes(occurrence.strong)) {
          return undefined;
        }
        if (
          (existing?.strong.length ?? 0) >=
          options.readerPolicy.maxStrongPerWord
        ) {
          return undefined;
        }

        const score = scoreSemanticWordForOccurrence({
          strong: occurrence.strong,
          originalTokenIndex: occurrence.tokenIndex,
          originalCount: options.occurrences.length,
          word,
          wordCount: options.words.length,
          translationLexicon: options.translationLexicon
        });

        return { word, score };
      })
      .filter((value): value is NonNullable<typeof value> => Boolean(value))
      .sort((left, right) => right.score - left.score)[0];

    if (
      !best ||
      best.score < 0.62 ||
      best.score < weakestCurrent.score + 0.16
    ) {
      continue;
    }

    removeStrongFromCoveredWords(
      options.assignments,
      weakestCurrent.wordIndex,
      weakestCurrent.wordIndex,
      [occurrence.strong]
    );

    const existing = options.assignments.get(best.word.wordIndex);
    const source = `semantic-relocation:${occurrence.strong}`;
    const confidence = Math.min(0.86, 0.52 + best.score * 0.34);

    if (existing) {
      existing.strong.push(occurrence.strong);
      existing.confidence = Math.max(existing.confidence, confidence);
      existing.source = mergeLabel(existing.source, source);
      existing.method = "learned-translation";
      existing.originalConfirmed = true;
    } else {
      options.assignments.set(best.word.wordIndex, {
        strong: [occurrence.strong],
        confidence,
        source,
        method: "learned-translation",
        originalConfirmed: true
      });
    }
  }
}

function scoreSemanticWordForOccurrence(options: {
  strong: string;
  originalTokenIndex: number;
  originalCount: number;
  word: { wordIndex: number; normalized: string } | undefined;
  wordCount: number;
  translationLexicon: StrongTranslationLexicon;
}): number {
  if (!options.word || FRENCH_FUNCTION_WORDS.has(options.word.normalized)) {
    return 0;
  }

  const translation = findTranslationCandidate(
    options.translationLexicon,
    options.strong,
    options.word.normalized
  );
  if (!translation) {
    return 0;
  }

  const position = scorePosition(
    options.originalTokenIndex,
    options.originalCount,
    options.word.wordIndex,
    options.wordCount
  );

  return translation.score * 0.68 + position * 0.32;
}

function isRelocatableOriginalOccurrence(
  occurrence: OriginalStrongOccurrence
): boolean {
  return (
    occurrence.pos === "Name" ||
    occurrence.pos === "noun" ||
    occurrence.pos === "verb" ||
    occurrence.pos === "adj" ||
    occurrence.pos === "adv"
  );
}

function consumeBaseOccurrences(
  occurrences: OriginalStrongOccurrence[],
  assignments: Map<number, AssignedStrong>
): Set<string> {
  const usedOccurrences = new Set<string>();

  for (const assignment of assignments.values()) {
    for (const strong of assignment.strong) {
      const occurrence = occurrences.find(
        (candidate) =>
          candidate.strong === strong &&
          !usedOccurrences.has(candidate.occurrenceId)
      );

      if (occurrence) {
        usedOccurrences.add(occurrence.occurrenceId);
      }
    }
  }

  return usedOccurrences;
}

function findReaderEnrichmentCandidate(options: {
  occurrence: OriginalStrongOccurrence;
  occurrences: OriginalStrongOccurrence[];
  words: Array<{ wordIndex: number; normalized: string }>;
  assignments: Map<number, AssignedStrong>;
  phraseAssignments: ReaderPhraseAssignment[];
  phraseMatchIndex?: Map<string, StrongPhraseMatch[]>;
  translationLexicon: StrongTranslationLexicon;
  phraseLexicon?: StrongPhraseLexicon;
  readerPolicy: ReaderAlignmentPolicy;
}):
  | {
      target: "word";
      wordIndex: number;
      confidence: number;
      method: AssignedStrong["method"];
      source: string;
    }
  | {
      target: "phrase";
      wordIndex: number;
      startWordIndex: number;
      endWordIndex: number;
      confidence: number;
      method: "learned-phrase";
      source: string;
    }
  | undefined {
  const maxStrongPerWord = options.readerPolicy.maxStrongPerWord;
  const originalRatio =
    options.occurrences.length <= 1
      ? 1
      : options.occurrence.tokenIndex / (options.occurrences.length - 1);
  const phrase = options.phraseMatchIndex
    ? findBestPhraseMatch({
        matches: options.phraseMatchIndex,
        strong: options.occurrence.strong,
        originalRatio
      })
    : options.phraseLexicon
      ? findPhraseCandidate({
          lexicon: options.phraseLexicon,
          strong: options.occurrence.strong,
          words: options.words,
          existingStrongByWord: new Map(
            mergeExistingStrongByWord(
              options.assignments,
              options.phraseAssignments
            )
          ),
          originalRatio
        })
      : undefined;
  const phraseExisting =
    phrase &&
    (options.assignments.get(phrase.wordIndex)?.strong.length ?? 0) +
      options.phraseAssignments
        .filter(
          (assignment) =>
            assignment.startWordIndex === phrase.startWordIndex &&
            assignment.endWordIndex === phrase.endWordIndex
        )
        .reduce((sum, assignment) => sum + assignment.strong.length, 0);
  const phraseHasStrong =
    phrase &&
    options.phraseAssignments.some(
      (assignment) =>
        assignment.startWordIndex === phrase.startWordIndex &&
        assignment.endWordIndex === phrase.endWordIndex &&
        assignment.strong.includes(options.occurrence.strong)
    );
  if (phrase && !phraseHasStrong && (phraseExisting ?? 0) < maxStrongPerWord) {
    return {
      target: "phrase",
      wordIndex: phrase.wordIndex,
      startWordIndex: phrase.startWordIndex,
      endWordIndex: phrase.endWordIndex,
      confidence: Math.min(0.88, 0.5 + phrase.score * 0.34),
      method: phrase.method,
      source: `${phrase.source}:phrase:${phrase.phrase.join("_")}`
    };
  }

  const hasRuleCandidate = options.words.some((word) =>
    findReaderStrongRule(options.occurrence.strong, word.normalized)
  );
  const candidates = options.words
    .map((word) => {
      const existing = options.assignments.get(word.wordIndex);
      if ((existing?.strong.length ?? 0) >= maxStrongPerWord) {
        return undefined;
      }
      if (existing?.strong.includes(options.occurrence.strong)) {
        return undefined;
      }

      const learned = findTranslationCandidate(
        options.translationLexicon,
        options.occurrence.strong,
        word.normalized
      );
      const rule = findReaderStrongRule(
        options.occurrence.strong,
        word.normalized
      );
      const match = hasRuleCandidate
        ? rule
        : chooseReaderMatch(
            isAllowedLearnedTranslation(
              options.occurrence.strong,
              word.normalized,
              options.readerPolicy
            )
              ? learned
              : undefined,
            rule
          );

      if (!match) {
        return undefined;
      }

      const positionScore = scorePosition(
        options.occurrence.tokenIndex,
        options.occurrences.length,
        word.wordIndex,
        options.words.length
      );
      const score = match.score * 0.68 + positionScore * 0.32;

      return {
        wordIndex: word.wordIndex,
        score,
        method: match.method,
        source: match.source
      };
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value))
    .sort((a, b) => b.score - a.score);

  const best = candidates[0];
  if (!best || best.score < options.readerPolicy.learnedTranslationMinScore) {
    return undefined;
  }

  return {
    target: "word",
    wordIndex: best.wordIndex,
    confidence: Math.min(0.86, 0.46 + best.score * 0.36),
    method: best.method,
    source: best.source
  };
}

function chooseReaderMatch(
  learned: StrongTranslationCandidate | undefined,
  rule: ReaderRuleMatch | undefined
):
  | {
      score: number;
      method: AssignedStrong["method"];
      source: string;
    }
  | undefined {
  if (!learned) return rule;
  if (!rule) {
    return {
      score: learned.score,
      method: learned.method,
      source: learned.source
    };
  }

  if (rule.score > learned.score) {
    return rule;
  }

  return {
    score: learned.score,
    method: learned.method,
    source: learned.source
  };
}

interface ReaderRuleMatch {
  score: number;
  method: "reader-strong-rule";
  source: string;
}

function findReaderStrongRule(
  strong: string,
  normalized: string
): ReaderRuleMatch | undefined {
  const rules: Record<string, Set<string>> = {
    H1961: new Set([
      "ait",
      "eut",
      "est",
      "etait",
      "etaient",
      "ete",
      "fut",
      "fussent",
      "passa",
      "sera",
      "serait",
      "seront",
      "servir",
      "serviront",
      "soit"
    ]),
    H8414: new Set(["abime", "chaos", "desolation", "informe"]),
    G1096: new Set(["arriva", "arriver", "devint", "devenir", "fut"])
  };

  if (!rules[strong]?.has(normalized)) {
    return undefined;
  }

  return {
    score: 0.82,
    method: "reader-strong-rule",
    source: `reader-rule:${strong}`
  };
}

function isAllowedLearnedTranslation(
  strong: string,
  normalized: string,
  policy: ReaderAlignmentPolicy
): boolean {
  if (strong === "H0853") {
    return false;
  }

  if (
    policy.learnedFunctionWordMode === "reference-only" &&
    FRENCH_FUNCTION_WORDS.has(normalized)
  ) {
    return false;
  }

  const relationStrongAllowlist: Record<string, Set<string>> = {
    H0996: new Set(["avec", "de", "des", "entre"]),
    H5921: new Set(["a", "au", "dessus", "sur"])
  };
  const allowed = relationStrongAllowlist[strong];
  if (allowed) {
    return allowed.has(normalized);
  }

  return !FRENCH_FUNCTION_WORDS.has(normalized);
}

const FRENCH_FUNCTION_WORDS = new Set([
  "a",
  "au",
  "aux",
  "avec",
  "ce",
  "ces",
  "cet",
  "cette",
  "de",
  "des",
  "du",
  "en",
  "et",
  "il",
  "ils",
  "la",
  "le",
  "les",
  "leur",
  "leurs",
  "lui",
  "nous",
  "on",
  "ou",
  "par",
  "pour",
  "qu",
  "que",
  "qui",
  "sa",
  "se",
  "ses",
  "son",
  "sur",
  "un",
  "une",
  "y"
]);

export function renderReaderTaggedText(result: ReaderAlignmentResult): string {
  let wordIndex = -1;
  let output = renderEmptyAssignments(result.emptyAssignments, -1);
  let activePhrase: ReaderPhraseAssignment | undefined;
  const phraseStarts = buildPhraseStartMap(result.phraseAssignments);

  for (const segment of result.segments) {
    if (segment.kind === "text") {
      output += escapeHtml(segment.text);
      continue;
    }

    wordIndex += 1;
    const startingPhrase = phraseStarts.get(wordIndex);
    if (startingPhrase) {
      activePhrase = startingPhrase;
      output += `<w strong="${escapeHtml(startingPhrase.strong.join(" "))}" data-confidence="${startingPhrase.confidence.toFixed(
        2
      )}" data-source="${escapeHtml(startingPhrase.source)}" data-method="${
        startingPhrase.method
      }" data-original="${
        startingPhrase.originalConfirmed ? "true" : "false"
      }" data-target="phrase">`;
    }

    if (activePhrase) {
      output += escapeHtml(segment.text);
      if (activePhrase.endWordIndex === wordIndex) {
        output += "</w>";
        activePhrase = undefined;
        output += renderEmptyAssignments(result.emptyAssignments, wordIndex);
      }
      continue;
    }

    output += renderTaggedText({
      ...result,
      segments: [segment],
      assignments: shiftAssignment(result, wordIndex)
    });
    output += renderEmptyAssignments(result.emptyAssignments, wordIndex);
  }

  if (activePhrase) {
    output += "</w>";
  }

  return output;
}

function buildPhraseStartMap(
  phraseAssignments: ReaderPhraseAssignment[]
): Map<number, ReaderPhraseAssignment> {
  const byStart = new Map<number, ReaderPhraseAssignment>();
  let coveredUntil = -1;

  for (const phrase of [...phraseAssignments].sort(
    (left, right) =>
      left.startWordIndex - right.startWordIndex ||
      right.endWordIndex - left.endWordIndex
  )) {
    if (phrase.startWordIndex <= coveredUntil) continue;
    if (phrase.endWordIndex < phrase.startWordIndex) continue;
    byStart.set(phrase.startWordIndex, phrase);
    coveredUntil = phrase.endWordIndex;
  }

  return byStart;
}

function buildEditorialEmptyAssignments(
  result: AlignmentResult,
  phraseAssignments: ReaderPhraseAssignment[],
  references: ReferenceSource[],
  policy: ReaderAlignmentPolicy
): ReaderEmptyAssignment[] {
  const occurrencesByStrong = new Map<string, EmptyOccurrence[]>();
  const totalCountsByStrong = new Map<string, number[]>();

  for (const reference of references) {
    if (!reference.verse) continue;

    const sourceOccurrences = extractEmptyOccurrences(
      reference.name,
      reference.verse.row.text
    );
    const totalCounts = countOccurrencesByStrong(
      parseStrongOccurrences(reference.verse.row.text)
    );

    for (const [strong, count] of totalCounts) {
      const counts = totalCountsByStrong.get(strong) ?? [];
      counts.push(count);
      totalCountsByStrong.set(strong, counts);
    }

    for (const occurrence of sourceOccurrences) {
      const occurrences = occurrencesByStrong.get(occurrence.strong) ?? [];
      occurrences.push(occurrence);
      occurrencesByStrong.set(occurrence.strong, occurrences);
    }
  }

  const targetWordCount = result.wordCount;
  const assignedCounts = countOccurrencesByStrong([
    ...[...result.assignments.values()].flatMap(
      (assignment) => assignment.strong
    ),
    ...phraseAssignments.flatMap((assignment) => assignment.strong)
  ]);
  const assignments: ReaderEmptyAssignment[] = [];

  for (const [strong, occurrences] of occurrencesByStrong) {
    const bySource = groupBySource(occurrences);
    if (bySource.size < policy.minEmptySourceAgreement) continue;

    const sourceEmptyCounts = [...bySource.values()].map(
      (sourceOccurrences) => sourceOccurrences.length
    );
    const editorialEmptyCount = Math.min(...sourceEmptyCounts);
    const expectedTotal = median(totalCountsByStrong.get(strong) ?? []);
    const assignedCount = assignedCounts.get(strong) ?? 0;
    const missingCount = Math.max(0, expectedTotal - assignedCount);
    const count = Math.min(editorialEmptyCount, missingCount);

    for (let index = 0; index < count; index += 1) {
      const occurrenceSlice = [...bySource.values()]
        .map((sourceOccurrences) => sourceOccurrences[index])
        .filter((occurrence): occurrence is EmptyOccurrence =>
          Boolean(occurrence)
        );
      const ratio = average(
        occurrenceSlice.map((occurrence) =>
          occurrence.wordCount <= 1
            ? 0
            : occurrence.afterWordIndex / (occurrence.wordCount - 1)
        )
      );

      assignments.push({
        strong,
        confidence: Math.min(0.82, 0.58 + bySource.size * 0.08),
        method: "editorial-empty",
        source: [...bySource.keys()].sort().join("+"),
        insertAfterWordIndex:
          targetWordCount <= 0
            ? -1
            : Math.min(
                targetWordCount - 1,
                Math.max(-1, Math.round(ratio * (targetWordCount - 1)))
              )
      });
    }
  }

  return assignments.sort(
    (a, b) =>
      a.insertAfterWordIndex - b.insertAfterWordIndex ||
      a.strong.localeCompare(b.strong)
  );
}

function extractEmptyOccurrences(
  source: string,
  html: string
): EmptyOccurrence[] {
  const occurrences: EmptyOccurrence[] = [];
  const wordCount = countWords(stripTags(html));
  const emptyPattern = /<w\b([^>]*)><\/w>/giu;

  for (const match of html.matchAll(emptyPattern)) {
    const attributes = match[1] ?? "";
    const strong = attributes
      .match(/\bstrong=(["'])(.*?)\1/i)?.[2]
      ?.trim()
      .split(/\s+/)
      .filter(Boolean);

    if (!strong || strong.length === 0) continue;

    const before = html.slice(0, match.index ?? 0);
    const afterWordIndex = Math.max(0, countWords(stripTags(before)) - 1);

    for (const code of strong) {
      occurrences.push({
        strong: code.toUpperCase(),
        source,
        afterWordIndex,
        wordCount
      });
    }
  }

  return occurrences;
}

function countWords(text: string): number {
  return tokenizeText(text).filter((segment) => segment.kind === "word").length;
}

function countOccurrencesByStrong(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) {
    const strong = value.toUpperCase();
    counts.set(strong, (counts.get(strong) ?? 0) + 1);
  }
  return counts;
}

function groupBySource(
  occurrences: EmptyOccurrence[]
): Map<string, EmptyOccurrence[]> {
  const grouped = new Map<string, EmptyOccurrence[]>();
  for (const occurrence of occurrences) {
    const sourceOccurrences = grouped.get(occurrence.source) ?? [];
    sourceOccurrences.push(occurrence);
    grouped.set(occurrence.source, sourceOccurrences);
  }
  return grouped;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function shiftAssignment(
  result: ReaderAlignmentResult,
  wordIndex: number
): Map<number, AssignedStrong> {
  const assignment = result.assignments.get(wordIndex);
  return assignment ? new Map([[0, assignment]]) : new Map();
}

function getPhraseWordIndexes(
  phraseAssignments: ReaderPhraseAssignment[]
): Set<number> {
  const indexes = new Set<number>();

  for (const phrase of phraseAssignments) {
    for (
      let wordIndex = phrase.startWordIndex;
      wordIndex <= phrase.endWordIndex;
      wordIndex += 1
    ) {
      indexes.add(wordIndex);
    }
  }

  return indexes;
}

function mergeExistingStrongByWord(
  assignments: Map<number, AssignedStrong>,
  phraseAssignments: ReaderPhraseAssignment[]
): Map<number, string[]> {
  const existing = new Map(
    [...assignments].map(([wordIndex, assignment]) => [
      wordIndex,
      [...assignment.strong]
    ])
  );

  for (const phrase of phraseAssignments) {
    for (
      let wordIndex = phrase.startWordIndex;
      wordIndex <= phrase.endWordIndex;
      wordIndex += 1
    ) {
      const current = existing.get(wordIndex) ?? [];
      existing.set(wordIndex, [...current, ...phrase.strong]);
    }
  }

  return existing;
}

function removeStrongFromCoveredWords(
  assignments: Map<number, AssignedStrong>,
  startWordIndex: number,
  endWordIndex: number,
  strong: string[]
): void {
  const strongSet = new Set(strong);

  for (
    let wordIndex = startWordIndex;
    wordIndex <= endWordIndex;
    wordIndex += 1
  ) {
    const assignment = assignments.get(wordIndex);
    if (!assignment) continue;

    assignment.strong = assignment.strong.filter(
      (code) => !strongSet.has(code)
    );
    if (assignment.strong.length === 0) {
      assignments.delete(wordIndex);
    }
  }
}

function getWordSegments(
  segments: TextSegment[]
): Array<{ wordIndex: number; normalized: string }> {
  const words: Array<{ wordIndex: number; normalized: string }> = [];
  let wordIndex = -1;

  for (const segment of segments) {
    if (segment.kind !== "word") {
      continue;
    }

    wordIndex += 1;
    words.push({ wordIndex, normalized: segment.normalized });
  }

  return words;
}

function scorePosition(
  originalIndex: number,
  originalCount: number,
  wordIndex: number,
  wordCount: number
): number {
  if (originalCount <= 1 || wordCount <= 1) {
    return 1;
  }

  const originalRatio = originalIndex / (originalCount - 1);
  const wordRatio = wordIndex / (wordCount - 1);
  return Math.max(0, 1 - Math.abs(originalRatio - wordRatio));
}

function mergeMethod(
  current: AssignedStrong["method"],
  next: AssignedStrong["method"]
): AssignedStrong["method"] {
  if (current === next) return current;
  if (
    current === "learned-translation" ||
    current === "learned-translation-stem" ||
    next === "learned-translation" ||
    next === "learned-translation-stem"
  ) {
    return next;
  }

  return next;
}

function mergeLabel(current: string, next: string): string {
  const labels = new Set([...current.split("+"), ...next.split("+")]);
  return [...labels].filter(Boolean).join("+");
}

function renderEmptyAssignments(
  assignments: ReaderEmptyAssignment[],
  wordIndex: number
): string {
  return assignments
    .filter((assignment) => assignment.insertAfterWordIndex === wordIndex)
    .map(
      (assignment) =>
        `<w strong="${escapeHtml(assignment.strong)}" data-empty="true" data-confidence="${assignment.confidence.toFixed(
          2
        )}" data-source="${escapeHtml(
          assignment.source
        )}" data-method="${assignment.method}"></w>`
    )
    .join("");
}
