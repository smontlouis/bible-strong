/**
 * Evaluator-only reference construction. Nothing in this module may be imported
 * by the prediction step: it reads the Concordance cache and the target labels.
 */
import { tokenizeText, normalizeWord } from "../../src/tokenize.js";
import {
  parseConcordanceChapter,
  verseReadingText,
  type ConcordanceChapter,
  type ConcordanceVerse
} from "./concordanceHtml.js";

export interface TargetToken {
  text: string;
  normalized: string;
  start: number;
  end: number;
}

export function wordTokens(text: string): TargetToken[] {
  const tokens: TargetToken[] = [];
  let offset = 0;
  for (const segment of tokenizeText(text)) {
    const start = offset;
    offset += segment.text.length;
    if (segment.kind === "word")
      tokens.push({
        text: segment.text,
        normalized: comparableForm(segment.text),
        start,
        end: offset
      });
  }
  return tokens;
}

/** Typographic variants that do not change the reading text. */
export function comparableForm(word: string): string {
  return normalizeWord(word.replace(/[’‘ʼ`´]/gu, "'")).replace(/'/gu, "’");
}

/**
 * Monotone token alignment (longest common subsequence on comparable forms).
 * Identical sequences, the normal case, are mapped one to one.
 */
export function alignTokenSequences(
  left: string[],
  right: string[]
): Array<number | null> {
  if (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  )
    return left.map((_, index) => index);
  const rows = left.length + 1;
  const columns = right.length + 1;
  const table = new Uint16Array(rows * columns);
  for (let i = left.length - 1; i >= 0; i -= 1)
    for (let j = right.length - 1; j >= 0; j -= 1)
      table[i * columns + j] =
        left[i] === right[j]
          ? table[(i + 1) * columns + j + 1]! + 1
          : Math.max(
              table[(i + 1) * columns + j]!,
              table[i * columns + j + 1]!
            );
  const mapping: Array<number | null> = left.map(() => null);
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      mapping[i] = j;
      i += 1;
      j += 1;
    } else if (table[(i + 1) * columns + j]! >= table[i * columns + j + 1]!)
      i += 1;
    else j += 1;
  }
  return mapping;
}

export type GoldCarrierKind = "word" | "phrase" | "discontinuous" | "empty";

export interface GoldOccurrence {
  /** `position:strong`; positions are the BHS/NA (STEP `#NN`) word numbers. */
  key: string;
  strong: string;
  position: number | null;
  kind: GoldCarrierKind;
  /** Local target word indices carrying the occurrence (visible kinds). */
  tokenIndices: number[];
  /** Empty anchor in local word indices (-1 = before the first word). */
  insertAfterWordIndex?: number;
  lemmas: string[];
  /** Concordance part-of-speech letters of the carrying French words. */
  posTags: string[];
  locution: string | null;
  /** Several source positions share one French word (e.g. article + noun). */
  sharedWordWithOtherPositions: boolean;
  /** Concordance shows the Strong on punctuation; scored as an anchored empty. */
  punctuationCarrier: boolean;
}

export type VerseComparability =
  | "identical-text"
  | "typographic-variants-only"
  | "text-divergent-mapped"
  | "text-divergent-unmapped"
  | "missing-local-verse"
  | "missing-concordance-verse";

export interface GoldVerse {
  ref: string;
  comparability: VerseComparability;
  textDifferences: Array<{ concordance: string | null; local: string | null }>;
  occurrences: GoldOccurrence[];
  /** Source positions that Concordance links to a French word without a Strong. */
  unnumberedPositions: number[];
  notes: number;
  issues: string[];
  localTokenCount: number;
}

interface WordItemPlacement {
  itemIndex: number;
  tokenIndices: number[];
  insertAfterWordIndex: number;
  /** A visible Concordance carrier made only of punctuation. */
  punctuation?: boolean;
}

/** Map every Concordance word item to the local target tokens it covers. */
function placeItems(
  verse: ConcordanceVerse,
  localText: string
): {
  placements: Map<number, WordItemPlacement>;
  comparability: VerseComparability;
  differences: GoldVerse["textDifferences"];
} {
  const reading = verseReadingText(verse);
  const concordanceTokens = wordTokens(reading.text);
  const localTokens = wordTokens(localText);
  const mapping = alignTokenSequences(
    concordanceTokens.map((token) => token.normalized),
    localTokens.map((token) => token.normalized)
  );
  const differences: GoldVerse["textDifferences"] = [];
  const matchedLocal = new Set(
    mapping.filter((value): value is number => value !== null)
  );
  concordanceTokens.forEach((token, index) => {
    if (mapping[index] === null)
      differences.push({ concordance: token.text, local: null });
  });
  localTokens.forEach((token, index) => {
    if (!matchedLocal.has(index))
      differences.push({ concordance: null, local: token.text });
  });
  const surfaceDifferent = concordanceTokens.some(
    (token, index) =>
      mapping[index] !== null &&
      token.text.replace(/[’']/gu, "'") !==
        localTokens[mapping[index]!]!.text.replace(/[’']/gu, "'")
  );
  const placements = new Map<number, WordItemPlacement>();
  verse.items.forEach((item, itemIndex) => {
    if (item.kind !== "word") return;
    const range = reading.ranges[itemIndex];
    if (!range) return;
    if (item.untranslated) {
      const before = concordanceTokens.filter(
        (token) => token.end <= range.start
      );
      let anchor = -1;
      for (let index = before.length - 1; index >= 0; index -= 1) {
        const mapped = mapping[index];
        if (mapped !== null && mapped !== undefined) {
          anchor = mapped;
          break;
        }
      }
      placements.set(itemIndex, {
        itemIndex,
        tokenIndices: [],
        insertAfterWordIndex: anchor
      });
      return;
    }
    const covered = concordanceTokens.flatMap((token, index) =>
      token.start < range.end && range.start < token.end ? [index] : []
    );
    if (covered.length === 0) {
      // A Strong carried by punctuation (« je vous le dis, si » for ὅτι) has
      // no word: like the CSV convention, it is an empty anchored after the
      // preceding word.
      const before = concordanceTokens.filter(
        (token) => token.end <= range.start
      );
      let anchor = -1;
      for (let index = before.length - 1; index >= 0; index -= 1) {
        const mapped = mapping[index];
        if (mapped !== null && mapped !== undefined) {
          anchor = mapped;
          break;
        }
      }
      placements.set(itemIndex, {
        itemIndex,
        tokenIndices: [],
        insertAfterWordIndex: anchor,
        punctuation: true
      });
      return;
    }
    const mapped = covered
      .map((index) => mapping[index])
      .filter(
        (value): value is number => value !== null && value !== undefined
      );
    placements.set(itemIndex, {
      itemIndex,
      tokenIndices: [...new Set(mapped)].sort((a, b) => a - b),
      insertAfterWordIndex: -1
    });
  });
  const comparability: VerseComparability =
    differences.length === 0
      ? surfaceDifferent
        ? "typographic-variants-only"
        : "identical-text"
      : "text-divergent-mapped";
  return { placements, comparability, differences };
}

/** Build reference occurrences of one verse on the exact local target text. */
export function goldVerseFromConcordance(options: {
  ref: string;
  verse: ConcordanceVerse | undefined;
  localText: string | undefined;
}): GoldVerse {
  const base = {
    ref: options.ref,
    textDifferences: [],
    occurrences: [],
    unnumberedPositions: [],
    notes: options.verse?.notes.length ?? 0,
    issues: [] as string[],
    localTokenCount: options.localText
      ? wordTokens(options.localText).length
      : 0
  };
  if (!options.verse)
    return { ...base, comparability: "missing-concordance-verse" };
  if (options.localText === undefined)
    return { ...base, comparability: "missing-local-verse" };
  const { placements, comparability, differences } = placeItems(
    options.verse,
    options.localText
  );
  const grouped = new Map<
    string,
    {
      strong: string;
      position: number | null;
      visibleTokens: Set<number>;
      emptyAnchors: number[];
      lemmas: Set<string>;
      posTags: Set<string>;
      locution: string | null;
      shared: boolean;
      unmapped: boolean;
      punctuation?: boolean;
    }
  >();
  const unnumbered = new Set<number>();
  options.verse.items.forEach((item, itemIndex) => {
    if (item.kind !== "word") return;
    const placement = placements.get(itemIndex);
    const positions = item.positions.length
      ? item.positions
      : item.numberStrongs.map((strong) => ({
          position: Number.NaN,
          strong,
          raw: strong
        }));
    const numbered = positions.filter((position) => position.strong);
    for (const position of positions) {
      if (!position.strong) {
        if (Number.isInteger(position.position))
          unnumbered.add(position.position);
        continue;
      }
      const hasPosition = Number.isInteger(position.position);
      const key = hasPosition
        ? `${position.position}:${position.strong}`
        : `nopos:${position.strong}:${itemIndex}`;
      const entry = grouped.get(key) ?? {
        strong: position.strong,
        position: hasPosition ? position.position : null,
        visibleTokens: new Set<number>(),
        emptyAnchors: [],
        lemmas: new Set<string>(),
        posTags: new Set<string>(),
        locution: null,
        shared: false,
        unmapped: false
      };
      if (item.lemma) entry.lemmas.add(item.lemma);
      if (item.pos) entry.posTags.add(item.pos);
      entry.locution ??= item.locution;
      if (numbered.length > 1) entry.shared = true;
      if (!placement) entry.unmapped = true;
      else if (item.untranslated)
        entry.emptyAnchors.push(placement.insertAfterWordIndex);
      else if (placement.punctuation) {
        entry.emptyAnchors.push(placement.insertAfterWordIndex);
        entry.punctuation = true;
      } else if (placement.tokenIndices.length === 0) entry.unmapped = true;
      else
        placement.tokenIndices.forEach((index) =>
          entry.visibleTokens.add(index)
        );
      grouped.set(key, entry);
    }
  });
  const issues: string[] = [];
  const occurrences: GoldOccurrence[] = [];
  for (const [key, entry] of grouped) {
    if (
      entry.unmapped &&
      entry.visibleTokens.size === 0 &&
      entry.emptyAnchors.length === 0
    ) {
      issues.push(`unmapped-carrier:${key}`);
      continue;
    }
    if (entry.unmapped) issues.push(`partly-unmapped-carrier:${key}`);
    if (entry.visibleTokens.size > 0 && entry.emptyAnchors.length > 0)
      issues.push(`visible-and-empty:${key}`);
    const tokens = [...entry.visibleTokens].sort((a, b) => a - b);
    const kind: GoldCarrierKind =
      tokens.length === 0
        ? "empty"
        : tokens.length === 1
          ? "word"
          : tokens.at(-1)! - tokens[0]! + 1 === tokens.length
            ? "phrase"
            : "discontinuous";
    occurrences.push({
      key,
      strong: entry.strong,
      position: entry.position,
      kind,
      tokenIndices: tokens,
      insertAfterWordIndex:
        kind === "empty" ? entry.emptyAnchors[0] : undefined,
      lemmas: [...entry.lemmas].sort(),
      posTags: [...entry.posTags].sort(),
      locution: entry.locution,
      sharedWordWithOtherPositions: entry.shared,
      punctuationCarrier: entry.punctuation === true
    });
  }
  occurrences.sort(
    (left, right) =>
      (left.tokenIndices[0] ?? left.insertAfterWordIndex ?? -1) -
        (right.tokenIndices[0] ?? right.insertAfterWordIndex ?? -1) ||
      left.key.localeCompare(right.key)
  );
  return {
    ...base,
    comparability:
      comparability === "text-divergent-mapped" &&
      issues.some((issue) => issue.startsWith("unmapped"))
        ? "text-divergent-unmapped"
        : comparability,
    textDifferences: differences,
    occurrences,
    unnumberedPositions: [...unnumbered].sort((a, b) => a - b),
    issues
  };
}

export function parseChapterForGold(
  html: string,
  chapter: string
): ConcordanceChapter {
  const testament = isNewTestamentChapter(chapter) ? "NT" : "OT";
  return parseConcordanceChapter(html, testament);
}

const NT_BOOKS = new Set([
  "Matt",
  "Mark",
  "Luke",
  "John",
  "Acts",
  "Rom",
  "1Cor",
  "2Cor",
  "Gal",
  "Eph",
  "Phil",
  "Col",
  "1Thess",
  "2Thess",
  "1Tim",
  "2Tim",
  "Titus",
  "Phlm",
  "Heb",
  "Jas",
  "1Pet",
  "2Pet",
  "1John",
  "2John",
  "3John",
  "Jude",
  "Rev"
]);

export function isNewTestamentChapter(chapter: string): boolean {
  return NT_BOOKS.has(chapter.split(".")[0] ?? "");
}
