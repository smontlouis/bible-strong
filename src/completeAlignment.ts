import {
  alignVerse,
  type ReferenceSource,
  type StrongLexicon
} from "./align.js";
import { type OriginalToken, type OriginalVerse } from "./originalSource.js";
import { escapeHtml, tokenizeText, type TextSegment } from "./tokenize.js";

export interface OriginalStrongOccurrence {
  occurrenceId: string;
  tokenId: string;
  tokenIndex: number;
  strong: string;
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
}

export function alignCompleteVerse(options: {
  targetText: string;
  references: ReferenceSource[];
  lexicon?: StrongLexicon;
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

  const emptyAssignments = originalOccurrences
    .filter((occurrence) => !usedOccurrences.has(occurrence.occurrenceId))
    .map((occurrence) => ({
      strong: occurrence.strong,
      originalTokenId: occurrence.tokenId,
      originalOccurrenceId: occurrence.occurrenceId,
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
    originalDirectStrongOccurrenceCount: realWordStrongOccurrenceCount
  };
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
      occurrences.push(toOccurrence(token, tokenIndex, strong, strongIndex));
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
