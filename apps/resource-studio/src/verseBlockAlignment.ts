import { type BibleVerse } from "./bibleJson.js";
import { type ReferenceSource, type StrongLexicon } from "./align.js";
import {
  alignCompleteVerse,
  getOriginalStrongOccurrences,
  type CompleteAlignmentResult,
  type CompleteWordAssignment,
  type EmptyStrongAssignment,
  type OriginalStrongOccurrence
} from "./completeAlignment.js";
import { type OriginalToken, type OriginalVerse } from "./originalSource.js";
import {
  alignReaderVerse,
  type ReaderAlignmentResult,
  type ReaderPhraseAssignment
} from "./readerAlignment.js";
import { type StrongPhraseLexicon } from "./phraseTranslationLexicon.js";
import { parseStrongOccurrences, type StrongVerse } from "./strongCsv.js";
import { tokenizeText, type TextSegment } from "./tokenize.js";
import { type StrongTranslationLexicon } from "./translationLexicon.js";
import { type ReaderAlignmentPolicy } from "./translationProfiles.js";

export interface TargetWordRange {
  ref: string;
  verse: BibleVerse;
  globalWordStart: number;
  globalWordEndExclusive: number;
  wordCount: number;
}

export interface ProjectedVerseAlignment {
  verse: BibleVerse;
  range: TargetWordRange;
  reader: ReaderAlignmentResult;
  complete: CompleteAlignmentResult;
  original?: OriginalVerse;
}

export class VerseBlockProjectionError extends Error {
  readonly code:
    | "empty-target-block"
    | "word-count-drift"
    | "cross-target-phrase"
    | "unresolved-empty-boundary"
    | "unassigned-original-occurrence"
    | "duplicate-original-occurrence"
    | "split-original-token"
    | "unassigned-reference-occurrence";

  constructor(code: VerseBlockProjectionError["code"], message: string) {
    super(message);
    this.name = "VerseBlockProjectionError";
    this.code = code;
  }
}

export interface VerseBlockReferenceMap {
  name: string;
  family?: string;
  verses: ReadonlyMap<string, StrongVerse>;
}

/** Build one synthetic reference verse whose occurrence order spans refs. */
export function combineReferenceSourcesForRefs(
  sources: readonly VerseBlockReferenceMap[],
  refs: readonly string[]
): ReferenceSource[] {
  return sources.map((source) => {
    const verses = refs.flatMap((ref) => {
      const verse = source.verses.get(ref);
      return verse ? [verse] : [];
    });
    const first = verses[0];
    if (!first) return { name: source.name, family: source.family };
    return {
      name: source.name,
      family: source.family,
      verse: {
        row: {
          ...first.row,
          text: verses.map((verse) => verse.row.text).join(" ")
        },
        tokens: verses.flatMap((verse) => verse.tokens)
      }
    };
  });
}

/** Align once across the logical block, then project to native target refs. */
export function alignVerseBlock(options: {
  targetVerses: readonly BibleVerse[];
  references: ReferenceSource[];
  original?: OriginalVerse;
  lexicon?: StrongLexicon;
  translationLexicon?: StrongTranslationLexicon;
  phraseLexicon?: StrongPhraseLexicon;
  readerPolicy?: ReaderAlignmentPolicy;
}): ProjectedVerseAlignment[] {
  const { targetText } = buildTargetVerseBlock(options.targetVerses);
  const reader = alignReaderVerse({
    targetText,
    references: options.references,
    lexicon: options.lexicon,
    originalVerse: options.original,
    translationLexicon: options.translationLexicon,
    phraseLexicon: options.phraseLexicon,
    original: options.original
      ? { strongSet: options.original.strongSet, source: "STEP:block" }
      : undefined,
    readerPolicy: options.readerPolicy
  });
  const complete = alignCompleteVerse({
    targetText,
    references: options.references,
    lexicon: options.lexicon,
    translationLexicon: options.translationLexicon,
    original: options.original,
    readerPolicy: options.readerPolicy
  });
  return projectVerseBlockAlignment({
    targetVerses: options.targetVerses,
    reader,
    complete,
    original: options.original
  });
}

/**
 * Split witness inventories after the block alignment. Each witness
 * occurrence is stored once, on the native verse that owns the corresponding
 * STEP occurrence or reader carrier.
 */
export function projectBlockReferences(options: {
  references: readonly ReferenceSource[];
  projected: readonly ProjectedVerseAlignment[];
}): ReferenceSource[][] {
  const ownersByStrong = new Map<string, number[]>();
  for (const [owner, item] of options.projected.entries()) {
    const originalStrong = item.complete.originalOccurrences.map(
      (occurrence) => occurrence.strong
    );
    const readerStrong = [...item.reader.assignments.values()].flatMap(
      (assignment) => assignment.strong
    );
    readerStrong.push(
      ...item.reader.phraseAssignments.flatMap(
        (assignment) => assignment.strong
      ),
      ...item.reader.emptyAssignments.map((assignment) => assignment.strong)
    );
    for (const strong of originalStrong.length > 0
      ? originalStrong
      : readerStrong) {
      const owners = ownersByStrong.get(strong) ?? [];
      owners.push(owner);
      ownersByStrong.set(strong, owners);
    }
    for (const strong of readerStrong) {
      if (ownersByStrong.has(strong)) continue;
      ownersByStrong.set(strong, [owner]);
    }
  }

  const result = options.projected.map(() => [] as ReferenceSource[]);
  for (const reference of options.references) {
    const occurrences = reference.verse
      ? parseStrongOccurrences(reference.verse.row.text)
      : [];
    const seenByStrong = new Map<string, number>();
    const byOwner = options.projected.map(() => [] as string[]);
    for (const [occurrenceIndex, strong] of occurrences.entries()) {
      const candidates = ownersByStrong.get(strong);
      if (!candidates || candidates.length === 0) {
        byOwner[
          positionalReferenceOwner({
            reference,
            strong,
            strongOrdinal: seenByStrong.get(strong) ?? 0,
            occurrenceIndex,
            occurrenceCount: occurrences.length,
            projected: options.projected
          })
        ]!.push(strong);
        seenByStrong.set(strong, (seenByStrong.get(strong) ?? 0) + 1);
        continue;
      }
      const ordinal = seenByStrong.get(strong) ?? 0;
      seenByStrong.set(strong, ordinal + 1);
      const owner = candidates[Math.min(ordinal, candidates.length - 1)]!;
      byOwner[owner]!.push(strong);
    }

    for (const [owner, item] of options.projected.entries()) {
      const strong = byOwner[owner]!;
      result[owner]!.push({
        name: reference.name,
        family: reference.family,
        verse: {
          row: {
            bookId: item.verse.bookId,
            chapter: item.verse.chapter,
            verse: item.verse.verse,
            text: strong.map((value) => `<w strong="${value}"></w>`).join("")
          },
          tokens: []
        }
      });
    }
  }
  return result;
}

function positionalReferenceOwner(options: {
  reference: ReferenceSource;
  strong: string;
  strongOrdinal: number;
  occurrenceIndex: number;
  occurrenceCount: number;
  projected: readonly ProjectedVerseAlignment[];
}): number {
  if (options.projected.length <= 1) return 0;
  const ranges = options.projected.map((item) => item.range);
  const totalTargetWords = ranges.at(-1)?.globalWordEndExclusive ?? 0;
  if (totalTargetWords === 0) return 0;
  const sourceTokens = options.reference.verse?.tokens ?? [];
  const visiblePositions = sourceTokens.flatMap((token, index) =>
    token.strong.includes(options.strong) ? [index] : []
  );
  const relativePosition =
    visiblePositions.length > 0 && sourceTokens.length > 0
      ? visiblePositions[
          Math.min(options.strongOrdinal, visiblePositions.length - 1)
        ]! / Math.max(1, sourceTokens.length - 1)
      : options.occurrenceIndex / Math.max(1, options.occurrenceCount - 1);
  const targetWordIndex = Math.min(
    totalTargetWords - 1,
    Math.max(0, Math.round(relativePosition * (totalTargetWords - 1)))
  );
  return ownerOfWord(targetWordIndex, ranges) ?? 0;
}

export function originalVerseForTargetBlock(options: {
  targetVerse: BibleVerse;
  tokens: readonly OriginalToken[];
}): OriginalVerse | undefined {
  if (options.tokens.length === 0) return undefined;
  return {
    bookId: options.targetVerse.bookId,
    chapter: options.targetVerse.chapter,
    verse: options.targetVerse.verse,
    tokens: [...options.tokens],
    strongSet: new Set(options.tokens.flatMap((token) => token.strong))
  };
}

/** Join native target verses for one logical alignment without losing bounds. */
export function buildTargetVerseBlock(targetVerses: readonly BibleVerse[]): {
  targetText: string;
  ranges: TargetWordRange[];
} {
  if (targetVerses.length === 0) {
    throw new VerseBlockProjectionError(
      "empty-target-block",
      "A mapped verse block must contain at least one target verse."
    );
  }

  let globalWordStart = 0;
  const ranges = targetVerses.map((verse) => {
    const wordCount = countWords(tokenizeText(verse.text));
    const range: TargetWordRange = {
      ref: formatRef(verse),
      verse,
      globalWordStart,
      globalWordEndExclusive: globalWordStart + wordCount,
      wordCount
    };
    globalWordStart += wordCount;
    return range;
  });

  return {
    targetText: targetVerses.map((verse) => verse.text).join(" "),
    ranges
  };
}

/**
 * Project one block-wide reader/complete alignment back onto native verses.
 * Every original occurrence is assigned exactly once. Cross-verse phrases and
 * empty anchors without a deterministic native owner fail closed.
 */
export function projectVerseBlockAlignment(options: {
  targetVerses: readonly BibleVerse[];
  reader: ReaderAlignmentResult;
  complete: CompleteAlignmentResult;
  original?: OriginalVerse;
}): ProjectedVerseAlignment[] {
  const block = buildTargetVerseBlock(options.targetVerses);
  const complete = coalesceCompleteTokenPlacements(options.complete);
  const expectedWordCount = block.ranges.reduce(
    (sum, range) => sum + range.wordCount,
    0
  );
  if (
    options.reader.wordCount !== expectedWordCount ||
    complete.frenchTokenCount !== expectedWordCount
  ) {
    throw new VerseBlockProjectionError(
      "word-count-drift",
      `Block alignment has ${options.reader.wordCount}/${complete.frenchTokenCount} words; expected ${expectedWordCount}.`
    );
  }

  const readerWords = distributeMap(options.reader.assignments, block.ranges);
  const completeWords = distributeMap(complete.wordAssignments, block.ranges);
  const readerPhrases = distributePhrases(
    options.reader.phraseAssignments,
    block.ranges
  );
  const readerEmpties = distributeEmpties(
    options.reader.emptyAssignments,
    block.ranges
  );
  const completeEmpties = distributeEmpties(
    complete.emptyAssignments,
    block.ranges
  );

  const occurrenceOwners = assignOriginalOccurrenceOwners({
    occurrences: complete.originalOccurrences,
    wordAssignments: complete.wordAssignments,
    emptyAssignments: complete.emptyAssignments,
    ranges: block.ranges
  });
  const originalByRange = options.original
    ? projectOriginalVerse(options.original, occurrenceOwners, block.ranges)
    : block.ranges.map(() => undefined);

  return block.ranges.map((range, rangeIndex) => {
    const segments = tokenizeText(range.verse.text);
    const wordAssignments = completeWords[rangeIndex]!;
    const emptyAssignments = completeEmpties[rangeIndex]!;
    const projectedOriginal = originalByRange[rangeIndex];
    const originalOccurrences = projectedOriginal
      ? getOriginalStrongOccurrences(projectedOriginal)
      : [];
    const realWordStrongOccurrenceCount = sumAssignmentStrong(wordAssignments);
    const emptyStrongOccurrenceCount = emptyAssignments.length;
    const representedStrongOccurrenceCount =
      realWordStrongOccurrenceCount + emptyStrongOccurrenceCount;
    const readerAssignments = readerWords[rangeIndex]!;
    const phraseAssignments = readerPhrases[rangeIndex]!;
    const projectedReaderEmpties = readerEmpties[rangeIndex]!;
    const phraseWordIndexes = new Set(
      phraseAssignments.flatMap((phrase) =>
        integerRange(phrase.startWordIndex, phrase.endWordIndex)
      )
    );
    const readerStrongWordOccurrenceCount =
      sumAssignmentStrong(readerAssignments) +
      phraseAssignments.reduce(
        (sum, assignment) => sum + assignment.strong.length,
        0
      );

    return {
      verse: range.verse,
      range,
      original: projectedOriginal,
      reader: {
        ...options.reader,
        segments,
        assignments: readerAssignments,
        phraseAssignments,
        emptyAssignments: projectedReaderEmpties,
        wordCount: range.wordCount,
        taggedWordCount: new Set([
          ...readerAssignments.keys(),
          ...phraseWordIndexes
        ]).size,
        lowConfidenceWordCount:
          [...readerAssignments.values()].filter(
            (assignment) => assignment.confidence < 0.55
          ).length +
          phraseAssignments.filter((assignment) => assignment.confidence < 0.55)
            .length,
        strongWordOccurrenceCount: readerStrongWordOccurrenceCount,
        emptyStrongOccurrenceCount: projectedReaderEmpties.length,
        totalStrongOccurrenceCount:
          readerStrongWordOccurrenceCount + projectedReaderEmpties.length,
        multiStrongWordCount: [...readerAssignments.values()].filter(
          (assignment) => assignment.strong.length > 1
        ).length
      },
      complete: {
        ...complete,
        segments,
        wordAssignments,
        emptyAssignments,
        originalOccurrences,
        frenchTokenCount: range.wordCount,
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
      }
    };
  });
}

function coalesceCompleteTokenPlacements(
  input: CompleteAlignmentResult
): CompleteAlignmentResult {
  const wordAssignments = new Map(
    [...input.wordAssignments].map(([wordIndex, assignment]) => [
      wordIndex,
      {
        ...assignment,
        strong: [...assignment.strong],
        originalTokenIds: [...assignment.originalTokenIds],
        originalOccurrenceIds: [...assignment.originalOccurrenceIds]
      }
    ])
  );
  let emptyAssignments = input.emptyAssignments.map((assignment) => ({
    ...assignment
  }));
  const occurrencesByToken = new Map<string, OriginalStrongOccurrence[]>();
  for (const occurrence of input.originalOccurrences) {
    const group = occurrencesByToken.get(occurrence.tokenId) ?? [];
    group.push(occurrence);
    occurrencesByToken.set(occurrence.tokenId, group);
  }

  for (const occurrences of occurrencesByToken.values()) {
    if (occurrences.length < 2) continue;
    const occurrenceIds = new Set(
      occurrences.map((occurrence) => occurrence.occurrenceId)
    );
    const wordPlacements = [...wordAssignments].flatMap(
      ([wordIndex, assignment]) =>
        assignment.originalOccurrenceIds.some((id) => occurrenceIds.has(id))
          ? [{ wordIndex, assignment }]
          : []
    );
    const emptyPlacements = emptyAssignments.filter((assignment) =>
      occurrenceIds.has(assignment.originalOccurrenceId)
    );
    const distinctCarriers = new Set([
      ...wordPlacements.map((placement) => `word:${placement.wordIndex}`),
      ...emptyPlacements.map(
        (placement) => `empty:${placement.insertAfterWordIndex}`
      )
    ]);
    if (distinctCarriers.size <= 1) continue;

    const preferredWord = [...wordPlacements].sort(
      (left, right) =>
        right.assignment.confidence - left.assignment.confidence ||
        left.wordIndex - right.wordIndex
    )[0];
    const preferredEmpty = [...emptyPlacements].sort(
      (left, right) =>
        right.confidence - left.confidence ||
        left.insertAfterWordIndex - right.insertAfterWordIndex
    )[0];

    for (const [wordIndex, assignment] of wordAssignments) {
      const keep = assignment.originalOccurrenceIds.map(
        (id) => !occurrenceIds.has(id)
      );
      if (keep.every(Boolean)) continue;
      const keptIndexes = keep.flatMap((value, index) =>
        value ? [index] : []
      );
      assignment.strong = keptIndexes.flatMap((index) =>
        assignment.strong[index] ? [assignment.strong[index]!] : []
      );
      assignment.originalTokenIds = keptIndexes.flatMap((index) =>
        assignment.originalTokenIds[index]
          ? [assignment.originalTokenIds[index]!]
          : []
      );
      assignment.originalOccurrenceIds = keptIndexes.map(
        (index) => assignment.originalOccurrenceIds[index]!
      );
      if (assignment.originalOccurrenceIds.length === 0) {
        wordAssignments.delete(wordIndex);
      }
    }
    emptyAssignments = emptyAssignments.filter(
      (assignment) => !occurrenceIds.has(assignment.originalOccurrenceId)
    );

    if (preferredWord) {
      const target =
        wordAssignments.get(preferredWord.wordIndex) ??
        ({
          ...preferredWord.assignment,
          strong: [],
          originalTokenIds: [],
          originalOccurrenceIds: []
        } satisfies CompleteWordAssignment);
      for (const occurrence of occurrences) {
        target.strong.push(occurrence.strong);
        target.originalTokenIds.push(occurrence.tokenId);
        target.originalOccurrenceIds.push(occurrence.occurrenceId);
      }
      wordAssignments.set(preferredWord.wordIndex, target);
      continue;
    }
    if (preferredEmpty) {
      emptyAssignments.push(
        ...occurrences.map((occurrence) => ({
          strong: occurrence.strong,
          originalTokenId: occurrence.tokenId,
          originalOccurrenceId: occurrence.occurrenceId,
          sourceStrong: occurrence.sourceStrong,
          confidence: preferredEmpty.confidence,
          method: "empty-original" as const,
          insertAfterWordIndex: preferredEmpty.insertAfterWordIndex
        }))
      );
    }
  }

  return { ...input, wordAssignments, emptyAssignments };
}

function distributeMap<T>(
  assignments: ReadonlyMap<number, T>,
  ranges: readonly TargetWordRange[]
): Map<number, T>[] {
  const projected = ranges.map(() => new Map<number, T>());
  for (const [globalWordIndex, assignment] of assignments) {
    const rangeIndex = ownerOfWord(globalWordIndex, ranges);
    if (rangeIndex === undefined) {
      throw new VerseBlockProjectionError(
        "word-count-drift",
        `Word assignment ${globalWordIndex} falls outside the target block.`
      );
    }
    const range = ranges[rangeIndex]!;
    projected[rangeIndex]!.set(
      globalWordIndex - range.globalWordStart,
      assignment
    );
  }
  return projected;
}

function distributePhrases(
  assignments: readonly ReaderPhraseAssignment[],
  ranges: readonly TargetWordRange[]
): ReaderPhraseAssignment[][] {
  const projected = ranges.map(() => [] as ReaderPhraseAssignment[]);
  for (const assignment of assignments) {
    const startOwner = ownerOfWord(assignment.startWordIndex, ranges);
    const endOwner = ownerOfWord(assignment.endWordIndex, ranges);
    if (startOwner === undefined || endOwner === undefined) {
      throw new VerseBlockProjectionError(
        "word-count-drift",
        `Phrase ${assignment.startWordIndex}-${assignment.endWordIndex} falls outside the target block.`
      );
    }
    if (startOwner !== endOwner) {
      throw new VerseBlockProjectionError(
        "cross-target-phrase",
        `Phrase ${assignment.startWordIndex}-${assignment.endWordIndex} crosses ${ranges[startOwner]!.ref}/${ranges[endOwner]!.ref}.`
      );
    }
    const range = ranges[startOwner]!;
    projected[startOwner]!.push({
      ...assignment,
      startWordIndex: assignment.startWordIndex - range.globalWordStart,
      endWordIndex: assignment.endWordIndex - range.globalWordStart
    });
  }
  return projected;
}

function distributeEmpties<T extends { insertAfterWordIndex: number }>(
  assignments: readonly T[],
  ranges: readonly TargetWordRange[]
): T[][] {
  const projected = ranges.map(() => [] as T[]);
  for (const assignment of assignments) {
    const owner = ownerOfEmptyAnchor(assignment.insertAfterWordIndex, ranges);
    if (owner === undefined) {
      throw new VerseBlockProjectionError(
        "unresolved-empty-boundary",
        `Empty anchor ${assignment.insertAfterWordIndex} has no deterministic target verse.`
      );
    }
    const range = ranges[owner]!;
    projected[owner]!.push({
      ...assignment,
      insertAfterWordIndex:
        assignment.insertAfterWordIndex < 0
          ? -1
          : assignment.insertAfterWordIndex - range.globalWordStart
    });
  }
  return projected;
}

function assignOriginalOccurrenceOwners(options: {
  occurrences: readonly OriginalStrongOccurrence[];
  wordAssignments: ReadonlyMap<number, CompleteWordAssignment>;
  emptyAssignments: readonly EmptyStrongAssignment[];
  ranges: readonly TargetWordRange[];
}): Map<string, number> {
  const owners = new Map<string, number>();
  const assign = (occurrenceId: string, owner: number) => {
    const existing = owners.get(occurrenceId);
    if (existing !== undefined) {
      throw new VerseBlockProjectionError(
        existing === owner
          ? "duplicate-original-occurrence"
          : "split-original-token",
        `Original occurrence ${occurrenceId} was assigned more than once.`
      );
    }
    owners.set(occurrenceId, owner);
  };

  for (const [wordIndex, assignment] of options.wordAssignments) {
    const owner = ownerOfWord(wordIndex, options.ranges);
    if (owner === undefined) {
      throw new VerseBlockProjectionError(
        "word-count-drift",
        `Original word assignment ${wordIndex} falls outside the target block.`
      );
    }
    for (const occurrenceId of assignment.originalOccurrenceIds) {
      assign(occurrenceId, owner);
    }
  }
  for (const assignment of options.emptyAssignments) {
    const owner = ownerOfEmptyAnchor(
      assignment.insertAfterWordIndex,
      options.ranges
    );
    if (owner === undefined) {
      throw new VerseBlockProjectionError(
        "unresolved-empty-boundary",
        `Original empty ${assignment.originalOccurrenceId} has no target verse.`
      );
    }
    assign(assignment.originalOccurrenceId, owner);
  }

  for (const occurrence of options.occurrences) {
    if (!owners.has(occurrence.occurrenceId)) {
      throw new VerseBlockProjectionError(
        "unassigned-original-occurrence",
        `Original occurrence ${occurrence.occurrenceId} was not projected.`
      );
    }
  }
  return owners;
}

function projectOriginalVerse(
  original: OriginalVerse,
  occurrenceOwners: ReadonlyMap<string, number>,
  ranges: readonly TargetWordRange[]
): Array<OriginalVerse | undefined> {
  const tokensByRange = ranges.map(() => [] as OriginalToken[]);
  for (const token of original.tokens) {
    const ownerSet = new Set<number>();
    token.strong.forEach((_strong, strongIndex) => {
      const owner = occurrenceOwners.get(`${token.id}:${strongIndex}`);
      if (owner !== undefined) ownerSet.add(owner);
    });
    if (ownerSet.size === 0) continue;
    if (ownerSet.size !== 1) {
      throw new VerseBlockProjectionError(
        "split-original-token",
        `Original token ${token.id} was projected to several target verses.`
      );
    }
    tokensByRange[[...ownerSet][0]!]!.push(token);
  }

  return ranges.map((range, index) => {
    const tokens = tokensByRange[index]!;
    if (tokens.length === 0) return undefined;
    return {
      bookId: range.verse.bookId,
      chapter: range.verse.chapter,
      verse: range.verse.verse,
      tokens,
      strongSet: new Set(tokens.flatMap((token) => token.strong))
    };
  });
}

function ownerOfWord(
  globalWordIndex: number,
  ranges: readonly TargetWordRange[]
): number | undefined {
  const owner = ranges.findIndex(
    (range) =>
      globalWordIndex >= range.globalWordStart &&
      globalWordIndex < range.globalWordEndExclusive
  );
  return owner >= 0 ? owner : undefined;
}

function ownerOfEmptyAnchor(
  insertAfterWordIndex: number,
  ranges: readonly TargetWordRange[]
): number | undefined {
  if (insertAfterWordIndex === -1) return ranges[0] ? 0 : undefined;
  return ownerOfWord(insertAfterWordIndex, ranges);
}

function countWords(segments: readonly TextSegment[]): number {
  return segments.filter((segment) => segment.kind === "word").length;
}

function sumAssignmentStrong(
  assignments: ReadonlyMap<number, { strong: readonly string[] }>
): number {
  return [...assignments.values()].reduce(
    (sum, assignment) => sum + assignment.strong.length,
    0
  );
}

function integerRange(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function formatRef(verse: BibleVerse): string {
  return `${verse.bookId}.${verse.chapter}.${verse.verse}`;
}
