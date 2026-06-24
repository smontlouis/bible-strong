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
import { escapeHtml, tokenizeText, type TextSegment } from "./tokenize.js";
import {
  findTranslationCandidate,
  type StrongTranslationLexicon
} from "./translationLexicon.js";

export interface OriginalStrongOccurrence {
  occurrenceId: string;
  tokenId: string;
  tokenIndex: number;
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
      translationLexicon: options.translationLexicon
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
}): void {
  const words = getWordSegments(options.segments);
  const maxStrongPerWord = 3;

  for (const occurrence of options.originalOccurrences) {
    if (options.usedOccurrences.has(occurrence.occurrenceId)) {
      continue;
    }

    const candidate = words
      .map((word) => {
        const translation = findTranslationCandidate(
          options.translationLexicon,
          occurrence.strong,
          word.normalized
        );

        if (!translation) {
          return undefined;
        }

        const existing = options.wordAssignments.get(word.wordIndex);
        if ((existing?.strong.length ?? 0) >= maxStrongPerWord) {
          return undefined;
        }
        if (existing?.strong.includes(occurrence.strong)) {
          return undefined;
        }

        const positionScore = scorePosition(
          occurrence.tokenIndex,
          options.originalOccurrences.length,
          word.wordIndex,
          words.length
        );

        return {
          wordIndex: word.wordIndex,
          translation,
          score: translation.score * 0.72 + positionScore * 0.28
        };
      })
      .filter((value): value is NonNullable<typeof value> => Boolean(value))
      .sort((a, b) => b.score - a.score)[0];

    if (!candidate || candidate.score < 0.28) {
      continue;
    }

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

    options.usedOccurrences.add(occurrence.occurrenceId);
  }
}

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
  tokenIndex: number,
  strong: string,
  strongIndex: number
): OriginalStrongOccurrence {
  return {
    occurrenceId: `${token.id}:${strongIndex}`,
    tokenId: token.id,
    tokenIndex,
    strong,
    sourceStrong: token.sourceStrong?.[strongIndex] ?? strong,
    text: token.text,
    gloss: token.gloss,
    lemma: token.lemma,
    morph: token.morph,
    pos: token.pos
  };
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
