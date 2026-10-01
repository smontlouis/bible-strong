import type { CanonicalBiblePublication } from "./strongBibleMobilePublication.js";
import {
  compareVerseRefs,
  extractWordsOfJesusSpans,
  hashVerseText,
  parseVerseRef,
  spanCoverage,
  type WordsOfJesusDataset,
  type WordsOfJesusVerse
} from "./wordsOfJesus.js";

/** Reference Bibles whose publishers mark the words of Jesus themselves. */
export const WORDS_OF_JESUS_REFERENCE_VERSION_IDS = [
  "KJV",
  "NASB2020",
  "NASB1995"
] as const;

const NEW_TESTAMENT_FIRST_BOOK = 40;
const COVERAGE_TOLERANCE = 0.45;

/**
 * Historical word-index spans shift by a word or two when a translation's
 * typography changed after they were authored ("veux : sois⟧ nettoyé",
 * "O ⟦femme"). Speech boundaries normally fall on punctuation or a capital.
 */
export function hasSuspiciousBoundary(
  text: string,
  spans: ReadonlyArray<readonly [number, number]>
): boolean {
  return spans.some(([start, end]) => {
    const startsMidSentence =
      /\p{L}\s*$/u.test(text.slice(0, start)) &&
      /^\p{Ll}/u.test(text.slice(start));
    const startsOnPunctuation = /^[:;,.!?]+(\s|$)/u.test(text.slice(start));
    const endsMidSentence =
      /\p{L}$/u.test(text.slice(start, end)) &&
      /^\s+\p{Ll}/u.test(text.slice(end));
    return startsMidSentence || startsOnPunctuation || endsMidSentence;
  });
}

export type WordsOfJesusFlagKind =
  /** The verse text changed since the decision was recorded. */
  | "drift"
  /** References mark the verse; this Bible has no decision for it. */
  | "missing"
  /** A single reference marks the verse; this Bible has no decision. */
  | "uncertain"
  /** This Bible marks a verse no reference marks. */
  | "unsupported"
  /** Both mark the verse, but with very different coverage. */
  | "coverage"
  /** A historical span starts or ends inside a sentence: likely shifted. */
  | "boundary";

export interface WordsOfJesusFlag {
  ref: string;
  kind: WordsOfJesusFlagKind;
  coverage: number;
  referenceCoverage: number[];
}

export interface WordsOfJesusReference {
  versionId: string;
  coverageByRef: Map<string, number>;
}

export interface WordsOfJesusAudit {
  versionId: string;
  decidedVerseCount: number;
  markedVerseCount: number;
  flags: WordsOfJesusFlag[];
  counts: Record<WordsOfJesusFlagKind, number>;
}

/** Coverage of the words of Jesus already marked in a reference publication. */
export function buildWordsOfJesusReference(
  versionId: string,
  publication: Pick<CanonicalBiblePublication, "verses">
): WordsOfJesusReference {
  const coverageByRef = new Map<string, number>();
  for (const [book, chapters] of Object.entries(publication.verses)) {
    if (Number(book) < NEW_TESTAMENT_FIRST_BOOK) continue;
    for (const [chapter, verses] of Object.entries(chapters)) {
      for (const [verse, value] of Object.entries(verses)) {
        const spans = extractWordsOfJesusSpans(value);
        if (spans.length === 0) continue;
        coverageByRef.set(
          `${book}-${chapter}-${verse}`,
          spanCoverage(value.text, spans)
        );
      }
    }
  }
  return { versionId, coverageByRef };
}

/** Coverage of a dataset's decisions over a Bible text, by verse. */
export function datasetCoverage(
  publication: Pick<CanonicalBiblePublication, "verses">,
  dataset: WordsOfJesusDataset
): Map<string, number> {
  const coverage = new Map<string, number>();
  for (const decision of dataset.verses) {
    const { book, chapter, verse } = parseVerseRef(decision.ref);
    const text = publication.verses[book]?.[chapter]?.[verse]?.text;
    if (text === undefined || decision.spans.length === 0) continue;
    coverage.set(decision.ref, spanCoverage(text, decision.spans));
  }
  return coverage;
}

const median = (values: number[]) => {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
};

/**
 * Flags the verses of one Bible whose words-of-Jesus decisions disagree with
 * the reference Bibles. Reviewed decisions (`aligned`, `manual`) are only
 * checked for text drift: a translation may legitimately close a quotation
 * earlier than the references, as some do after John 3:15.
 */
export function auditWordsOfJesus(options: {
  versionId: string;
  publication: Pick<CanonicalBiblePublication, "verses">;
  dataset?: WordsOfJesusDataset;
  references: readonly WordsOfJesusReference[];
}): WordsOfJesusAudit {
  const decisions = new Map<string, WordsOfJesusVerse>(
    (options.dataset?.verses ?? []).map((decision) => [decision.ref, decision])
  );
  const references = options.references.filter(
    (reference) => reference.versionId !== options.versionId
  );
  const flags: WordsOfJesusFlag[] = [];
  let markedVerseCount = 0;

  const verseRefs = new Set<string>();
  for (const [book, chapters] of Object.entries(options.publication.verses)) {
    if (Number(book) < NEW_TESTAMENT_FIRST_BOOK) continue;
    for (const [chapter, verses] of Object.entries(chapters)) {
      for (const verse of Object.keys(verses))
        verseRefs.add(`${book}-${chapter}-${verse}`);
    }
  }
  for (const ref of decisions.keys()) verseRefs.add(ref);

  for (const ref of [...verseRefs].sort(compareVerseRefs)) {
    const { book, chapter, verse } = parseVerseRef(ref);
    const text = options.publication.verses[book]?.[chapter]?.[verse]?.text;
    const decision = decisions.get(ref);
    const referenceCoverage = references.map(
      (reference) => reference.coverageByRef.get(ref) ?? 0
    );
    const markingReferences = referenceCoverage.filter((value) => value > 0);
    if (
      decision &&
      (text === undefined || hashVerseText(text) !== decision.verseSha256)
    ) {
      flags.push({ ref, kind: "drift", coverage: 0, referenceCoverage });
      continue;
    }
    if (text === undefined) continue;
    const coverage = decision ? spanCoverage(text, decision.spans) : 0;
    if (coverage > 0) markedVerseCount += 1;
    if (decision && decision.origin !== "legacy-red-words") continue;
    if (!decision) {
      if (markingReferences.length >= 2) {
        flags.push({ ref, kind: "missing", coverage, referenceCoverage });
      } else if (markingReferences.length === 1) {
        flags.push({ ref, kind: "uncertain", coverage, referenceCoverage });
      }
      continue;
    }
    if (markingReferences.length === 0) {
      flags.push({ ref, kind: "unsupported", coverage, referenceCoverage });
    } else if (
      Math.abs(coverage - median(markingReferences)) > COVERAGE_TOLERANCE
    ) {
      flags.push({ ref, kind: "coverage", coverage, referenceCoverage });
    } else if (hasSuspiciousBoundary(text, decision.spans)) {
      flags.push({ ref, kind: "boundary", coverage, referenceCoverage });
    }
  }

  const counts: Record<WordsOfJesusFlagKind, number> = {
    drift: 0,
    missing: 0,
    uncertain: 0,
    unsupported: 0,
    coverage: 0,
    boundary: 0
  };
  for (const flag of flags) counts[flag.kind] += 1;
  return {
    versionId: options.versionId,
    decidedVerseCount: decisions.size,
    markedVerseCount,
    flags,
    counts
  };
}
