import {
  alignVerse,
  type ReferenceSource,
  type StrongLexicon
} from "./align.js";
import {
  normalizeOriginalStrong,
  type OriginalToken,
  type OriginalVerse
} from "./originalSource.js";
import {
  getStepSourceIdentity,
  getStepSourceTokenIndex
} from "./stepOriginals.js";
import { escapeHtml, tokenizeText, type TextSegment } from "./tokenize.js";
import {
  findTranslationCandidate,
  type StrongTranslationLexicon
} from "./translationLexicon.js";
import { type ReaderAlignmentPolicy } from "./translationProfiles.js";
import { maximumWeightMatching } from "./maximumWeightMatching.js";

export interface OriginalStrongOccurrence {
  occurrenceId: string;
  tokenId: string;
  /** Source-native STEP index when available; ordinal fallback otherwise. */
  tokenIndex: number;
  /** Contiguous zero-based position used only for alignment scoring. */
  ordinalTokenIndex?: number;
  /** Explicit STEP `#NN` position, kept separate from the ordinal. */
  sourceTokenIndex?: number;
  /** Physical STEP identity, stable across projected reference aliases. */
  sourceIdentity?: string;
  strong: string;
  sourceStrong: string;
  text: string;
  gloss: string;
  lemma: string;
  morph: string;
  pos: string;
}

export interface CompleteWordAssignment {
  strong: string[];
  originalTokenIds: string[];
  originalOccurrenceIds: string[];
  confidence: number;
  method: string;
  source: string;
  fallback: boolean;
}

export interface EmptyStrongAssignment {
  strong: string;
  originalTokenId: string;
  originalOccurrenceId: string;
  sourceStrong?: string;
  confidence: number;
  method: "empty-original";
  insertAfterWordIndex: number;
}

export interface CompleteAlignmentResult {
  segments: TextSegment[];
  wordAssignments: Map<number, CompleteWordAssignment>;
  emptyAssignments: EmptyStrongAssignment[];
  originalOccurrences: OriginalStrongOccurrence[];
  frenchTokenCount: number;
  taggedFrenchTokenCount: number;
  originalStrongOccurrenceCount: number;
  representedStrongOccurrenceCount: number;
  missingStrongOccurrenceCount: number;
  realWordStrongOccurrenceCount: number;
  emptyStrongOccurrenceCount: number;
  multiStrongWordCount: number;
  fallbackStrongOccurrenceCount: number;
  originalDirectStrongOccurrenceCount: number;
  learnedTranslationStrongOccurrenceCount: number;
}

export function alignCompleteVerse(options: {
  targetText: string;
  references: ReferenceSource[];
  lexicon?: StrongLexicon;
  translationLexicon?: StrongTranslationLexicon;
  original?: OriginalVerse;
  readerPolicy?: ReaderAlignmentPolicy;
}): CompleteAlignmentResult {
  const base = alignVerse(
    options.targetText,
    options.references,
    options.lexicon,
    options.original
      ? { strongSet: options.original.strongSet, source: "original" }
      : undefined
  );
  const originalOccurrences = options.original
    ? getOriginalStrongOccurrences(options.original)
    : [];
  const usedOccurrences = new Set<string>();
  const wordAssignments = new Map<number, CompleteWordAssignment>();

  for (const [wordIndex, assignment] of base.assignments) {
    const occurrences: OriginalStrongOccurrence[] = [];

    for (const strong of assignment.strong) {
      const occurrence = originalOccurrences.find(
        (candidate) =>
          candidate.strong === strong &&
          !usedOccurrences.has(candidate.occurrenceId)
      );

      if (occurrence) {
        usedOccurrences.add(occurrence.occurrenceId);
        occurrences.push(occurrence);
      }
    }

    if (occurrences.length === 0 && originalOccurrences.length > 0) {
      continue;
    }

    wordAssignments.set(wordIndex, {
      strong:
        occurrences.length > 0
          ? occurrences.map((occurrence) => occurrence.strong)
          : assignment.strong,
      originalTokenIds: occurrences.map((occurrence) => occurrence.tokenId),
      originalOccurrenceIds: occurrences.map(
        (occurrence) => occurrence.occurrenceId
      ),
      confidence: assignment.confidence,
      method: assignment.method,
      source: assignment.source,
      fallback: occurrences.length === 0
    });
  }

  if (options.translationLexicon) {
    assignByTranslationLexicon({
      segments: base.segments,
      originalOccurrences,
      usedOccurrences,
      wordAssignments,
      translationLexicon: options.translationLexicon,
      maxStrongPerWord: options.readerPolicy?.maxStrongPerWord ?? 3,
      minScore: Math.max(
        0.28,
        (options.readerPolicy?.learnedTranslationMinScore ?? 0.36) - 0.08
      )
    });
  }

  const emptyAssignments = originalOccurrences
    .filter((occurrence) => !usedOccurrences.has(occurrence.occurrenceId))
    .map((occurrence) => ({
      strong: occurrence.strong,
      originalTokenId: occurrence.tokenId,
      originalOccurrenceId: occurrence.occurrenceId,
      sourceStrong: occurrence.sourceStrong,
      confidence: 0.35,
      method: "empty-original" as const,
      insertAfterWordIndex: findPreviousAssignedWordIndex(
        occurrence,
        wordAssignments,
        originalOccurrences
      )
    }));

  const realWordStrongOccurrenceCount = [...wordAssignments.values()].reduce(
    (sum, assignment) => sum + assignment.strong.length,
    0
  );
  const emptyStrongOccurrenceCount = emptyAssignments.length;
  const representedStrongOccurrenceCount =
    realWordStrongOccurrenceCount + emptyStrongOccurrenceCount;

  return {
    segments: base.segments,
    wordAssignments,
    emptyAssignments,
    originalOccurrences,
    frenchTokenCount: base.wordCount,
    taggedFrenchTokenCount: wordAssignments.size,
    originalStrongOccurrenceCount: originalOccurrences.length,
    representedStrongOccurrenceCount,
    missingStrongOccurrenceCount: Math.max(
      0,
      originalOccurrences.length - representedStrongOccurrenceCount
    ),
    realWordStrongOccurrenceCount,
    emptyStrongOccurrenceCount,
    multiStrongWordCount: [...wordAssignments.values()].filter(
      (assignment) => assignment.strong.length > 1
    ).length,
    fallbackStrongOccurrenceCount: [...wordAssignments.values()].reduce(
      (sum, assignment) =>
        sum + (assignment.fallback ? assignment.strong.length : 0),
      0
    ),
    originalDirectStrongOccurrenceCount: realWordStrongOccurrenceCount,
    learnedTranslationStrongOccurrenceCount: [
      ...wordAssignments.values()
    ].reduce(
      (sum, assignment) =>
        sum +
        (assignment.method.includes("learned-translation") ||
        assignment.method.includes("dictionary")
          ? assignment.strong.length
          : 0),
      0
    )
  };
}

function assignByTranslationLexicon(options: {
  segments: TextSegment[];
  originalOccurrences: OriginalStrongOccurrence[];
  usedOccurrences: Set<string>;
  wordAssignments: Map<number, CompleteWordAssignment>;
  translationLexicon: StrongTranslationLexicon;
  maxStrongPerWord: number;
  minScore: number;
}): void {
  const words = getWordSegments(options.segments);
  let occurrences = options.originalOccurrences.filter(
    (occurrence) => !options.usedOccurrences.has(occurrence.occurrenceId)
  );
  const wordByIndex = new Map(words.map((word) => [word.wordIndex, word]));
  const originalTokenCount = originalPositionTokenCount(
    options.originalOccurrences
  );

  // A French carrier can legitimately represent more than one distinct
  // original Strong. Model each remaining capacity unit as a matching slot.
  // A large-but-bounded stacking penalty prefers an available open carrier,
  // while a positive floor still permits stacking when it is the only lexical
  // carrier in the verse.
  while (occurrences.length > 0) {
    const slots = words.flatMap((word) => {
      const existingCount =
        options.wordAssignments.get(word.wordIndex)?.strong.length ?? 0;
      const remainingCapacity = Math.max(
        0,
        options.maxStrongPerWord - existingCount
      );
      return Array.from({ length: remainingCapacity }, (_, slotIndex) => ({
        wordIndex: word.wordIndex,
        stackDepth: existingCount + slotIndex
      }));
    });
    if (slots.length === 0) break;

    const edges = occurrences.flatMap((occurrence, left) =>
      slots.flatMap((slot, right) => {
        const word = wordByIndex.get(slot.wordIndex);
        if (!word) return [];
        const existing = options.wordAssignments.get(word.wordIndex);
        if (existing?.strong.includes(occurrence.strong)) return [];

        const translation = findTranslationCandidate(
          options.translationLexicon,
          occurrence.strong,
          word.normalized,
          occurrence.sourceStrong
        );
        if (!translation) return [];

        const positionScore = scorePosition(
          occurrenceOrdinalTokenIndex(occurrence),
          originalTokenCount,
          word.wordIndex,
          words.length
        );
        const score = translation.score * 0.72 + positionScore * 0.28;
        if (score < options.minScore) return [];

        return [
          {
            left,
            right,
            weight: Math.max(
              MIN_POSITIVE_MATCH_WEIGHT,
              score - slot.stackDepth * STACKING_SLOT_PENALTY
            ),
            value: {
              occurrence,
              wordIndex: word.wordIndex,
              translation,
              score
            }
          }
        ];
      })
    );
    const rawMatches = maximumWeightMatching({
      leftCount: occurrences.length,
      rightCount: slots.length,
      edges
    });
    if (rawMatches.length === 0) break;

    const bestMatchByStrongTarget = new Map<
      string,
      (typeof rawMatches)[number]
    >();
    for (const match of rawMatches) {
      const key = `${match.value.wordIndex}:${match.value.occurrence.strong}`;
      const previous = bestMatchByStrongTarget.get(key);
      if (
        !previous ||
        match.weight > previous.weight ||
        (match.weight === previous.weight && match.left < previous.left)
      ) {
        bestMatchByStrongTarget.set(key, match);
      }
    }
    const matches = [...bestMatchByStrongTarget.values()].sort(
      (left, right) => left.left - right.left || left.right - right.right
    );

    const acceptedOccurrenceIds = new Set<string>();
    const occupiedStrongTargets = new Set(
      [...options.wordAssignments].flatMap(([wordIndex, assignment]) =>
        assignment.strong.map((strong) => `${wordIndex}:${strong}`)
      )
    );

    for (const match of matches) {
      const candidate = match.value;
      const occurrence = candidate.occurrence;
      const targetKey = `${candidate.wordIndex}:${occurrence.strong}`;
      // Capacity slots alone do not express the separate constraint that one
      // Strong code must not be duplicated on the same French carrier. Keep the
      // best such match and let a later iteration rematch the rejected one.
      if (occupiedStrongTargets.has(targetKey)) continue;

      const existing = options.wordAssignments.get(candidate.wordIndex);
      const confidence = Math.min(0.88, 0.48 + candidate.score * 0.35);

      if (existing) {
        existing.strong.push(occurrence.strong);
        existing.originalTokenIds.push(occurrence.tokenId);
        existing.originalOccurrenceIds.push(occurrence.occurrenceId);
        existing.confidence = Math.max(existing.confidence, confidence);
        existing.method = mergeLabel(
          existing.method,
          candidate.translation.method
        );
        existing.source = mergeLabel(
          existing.source,
          candidate.translation.source
        );
      } else {
        options.wordAssignments.set(candidate.wordIndex, {
          strong: [occurrence.strong],
          originalTokenIds: [occurrence.tokenId],
          originalOccurrenceIds: [occurrence.occurrenceId],
          confidence,
          method: candidate.translation.method,
          source: candidate.translation.source,
          fallback: false
        });
      }

      occupiedStrongTargets.add(targetKey);
      acceptedOccurrenceIds.add(occurrence.occurrenceId);
      options.usedOccurrences.add(occurrence.occurrenceId);
    }

    if (acceptedOccurrenceIds.size === 0) break;
    occurrences = occurrences.filter(
      (occurrence) => !acceptedOccurrenceIds.has(occurrence.occurrenceId)
    );
  }
}

const STACKING_SLOT_PENALTY = 0.5;
const MIN_POSITIVE_MATCH_WEIGHT = 1e-6;

export function renderCompleteTaggedText(
  result: CompleteAlignmentResult
): string {
  let wordIndex = -1;
  let output = renderEmptyAssignments(result.emptyAssignments, -1);

  for (const segment of result.segments) {
    if (segment.kind === "text") {
      output += escapeHtml(segment.text);
      continue;
    }

    wordIndex += 1;
    const assignment = result.wordAssignments.get(wordIndex);

    if (!assignment) {
      output += escapeHtml(segment.text);
    } else {
      output += `<w strong="${escapeHtml(assignment.strong.join(" "))}" data-empty="false" data-original-token="${escapeHtml(
        assignment.originalTokenIds.join(" ")
      )}" data-original-occurrence="${escapeHtml(
        assignment.originalOccurrenceIds.join(" ")
      )}" data-confidence="${assignment.confidence.toFixed(
        2
      )}" data-method="${escapeHtml(assignment.method)}" data-source="${escapeHtml(
        assignment.source
      )}" data-fallback="${assignment.fallback ? "true" : "false"}">${escapeHtml(
        segment.text
      )}</w>`;
    }

    output += renderEmptyAssignments(result.emptyAssignments, wordIndex);
  }

  return output;
}

export function getOriginalStrongOccurrences(
  original: OriginalVerse
): OriginalStrongOccurrence[] {
  const occurrences: OriginalStrongOccurrence[] = [];

  original.tokens.forEach((token, tokenIndex) => {
    token.strong.forEach((strong, strongIndex) => {
      const normalizedStrong = normalizeOriginalStrong(strong);
      if (!normalizedStrong) return;
      occurrences.push(
        toOccurrence(token, tokenIndex, normalizedStrong, strongIndex)
      );
    });
  });

  return occurrences;
}

export function countFrenchTokens(text: string): number {
  return tokenizeText(text).filter((segment) => segment.kind === "word").length;
}

function toOccurrence(
  token: OriginalToken,
  ordinalTokenIndex: number,
  strong: string,
  strongIndex: number
): OriginalStrongOccurrence {
  const sourceTokenIndex = getStepSourceTokenIndex(token);
  return {
    occurrenceId: `${token.id}:${strongIndex}`,
    tokenId: token.id,
    tokenIndex: sourceTokenIndex ?? ordinalTokenIndex,
    ordinalTokenIndex,
    sourceTokenIndex,
    sourceIdentity: getStepSourceIdentity(token),
    strong,
    sourceStrong: token.sourceStrong?.[strongIndex] ?? strong,
    text: token.text,
    gloss: token.gloss,
    lemma: token.lemma,
    morph: token.morph,
    pos: token.pos
  };
}

function occurrenceOrdinalTokenIndex(
  occurrence: OriginalStrongOccurrence
): number {
  return occurrence.ordinalTokenIndex ?? occurrence.tokenIndex;
}

function originalPositionTokenCount(
  occurrences: OriginalStrongOccurrence[]
): number {
  if (occurrences.length === 0) return 0;
  return Math.max(...occurrences.map(occurrenceOrdinalTokenIndex)) + 1;
}

function findPreviousAssignedWordIndex(
  occurrence: OriginalStrongOccurrence,
  assignments: Map<number, CompleteWordAssignment>,
  originalOccurrences: OriginalStrongOccurrence[]
): number {
  let previousWordIndex = -1;
  const occurrenceIndex = originalOccurrences.findIndex(
    (candidate) => candidate.occurrenceId === occurrence.occurrenceId
  );

  for (const [wordIndex, assignment] of assignments) {
    const firstOccurrenceIndex = originalOccurrences.findIndex((candidate) =>
      assignment.originalOccurrenceIds.includes(candidate.occurrenceId)
    );

    if (
      firstOccurrenceIndex !== -1 &&
      firstOccurrenceIndex < occurrenceIndex &&
      wordIndex > previousWordIndex
    ) {
      previousWordIndex = wordIndex;
    }
  }

  return previousWordIndex;
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

function mergeLabel(current: string, next: string): string {
  const labels = new Set([...current.split("+"), ...next.split("+")]);
  return [...labels].filter(Boolean).join("+");
}

function renderEmptyAssignments(
  assignments: EmptyStrongAssignment[],
  wordIndex: number
): string {
  return assignments
    .filter((assignment) => assignment.insertAfterWordIndex === wordIndex)
    .map(
      (assignment) =>
        `<w strong="${escapeHtml(assignment.strong)}" data-empty="true" data-original-token="${escapeHtml(
          assignment.originalTokenId
        )}" data-original-occurrence="${escapeHtml(
          assignment.originalOccurrenceId
        )}" data-confidence="${assignment.confidence.toFixed(
          2
        )}" data-method="${assignment.method}"></w>`
    )
    .join("");
}
