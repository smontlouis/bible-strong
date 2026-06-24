import { stemWord } from "./align.js";
import { type StrongVerseMap } from "./strongCsv.js";

export interface StrongTranslationCandidate {
  strong: string;
  normalized: string;
  score: number;
  source: string;
  method:
    | "learned-translation"
    | "learned-translation-stem"
    | "dictionary-fr-exact"
    | "dictionary-fr-stem";
}

export interface StrongTranslationLexicon {
  exact: Map<string, Map<string, StrongTranslationCandidate>>;
  stem: Map<string, Map<string, StrongTranslationCandidate>>;
}

const MIN_EXACT_COUNT = 2;
const MIN_STEM_COUNT = 4;
const MIN_SCORE = 0.18;

export function buildStrongTranslationLexicon(
  references: Array<{ name: string; map: StrongVerseMap }>,
  options: { dictionaryCandidates?: StrongTranslationCandidate[] } = {}
): StrongTranslationLexicon {
  const exactCounts = new Map<string, Map<string, number>>();
  const stemCounts = new Map<string, Map<string, number>>();
  const sourceNames = references.map((reference) => reference.name).join("+");

  for (const reference of references) {
    for (const verse of reference.map.values()) {
      for (const token of verse.tokens) {
        if (token.strong.length === 0 || token.normalized.length < 2) {
          continue;
        }

        for (const strong of token.strong) {
          increment(exactCounts, strong, token.normalized);

          const stem = stemWord(token.normalized);
          if (stem.length >= 4) {
            increment(stemCounts, strong, stem);
          }
        }
      }
    }
  }

  const lexicon = {
    exact: normalizeCounts(exactCounts, MIN_EXACT_COUNT, sourceNames),
    stem: normalizeCounts(stemCounts, MIN_STEM_COUNT, sourceNames)
  };

  for (const candidate of options.dictionaryCandidates ?? []) {
    addDictionaryCandidate(lexicon, candidate);
  }

  return lexicon;
}

export function findTranslationCandidate(
  lexicon: StrongTranslationLexicon,
  strong: string,
  normalized: string
): StrongTranslationCandidate | undefined {
  const exact = lexicon.exact.get(strong)?.get(normalized);
  if (exact) {
    return exact;
  }

  const stem = stemWord(normalized);
  if (stem.length >= 4) {
    const candidate = lexicon.stem.get(strong)?.get(stem);
    if (candidate) return candidate;
  }

  return undefined;
}

function increment(
  counts: Map<string, Map<string, number>>,
  strong: string,
  normalized: string
): void {
  const wordCounts = counts.get(strong) ?? new Map<string, number>();
  wordCounts.set(normalized, (wordCounts.get(normalized) ?? 0) + 1);
  counts.set(strong, wordCounts);
}

function normalizeCounts(
  counts: Map<string, Map<string, number>>,
  minCount: number,
  source: string
): Map<string, Map<string, StrongTranslationCandidate>> {
  const lexicon = new Map<string, Map<string, StrongTranslationCandidate>>();

  for (const [strong, wordCounts] of counts) {
    const maxCount = Math.max(...wordCounts.values());
    const candidates = new Map<string, StrongTranslationCandidate>();

    for (const [normalized, count] of wordCounts) {
      if (count < minCount) {
        continue;
      }

      const score = count / maxCount;
      if (score < MIN_SCORE) {
        continue;
      }

      candidates.set(normalized, {
        strong,
        normalized,
        score,
        source,
        method:
          minCount === MIN_EXACT_COUNT
            ? "learned-translation"
            : "learned-translation-stem"
      });
    }

    if (candidates.size > 0) {
      lexicon.set(strong, candidates);
    }
  }

  return lexicon;
}

function addDictionaryCandidate(
  lexicon: StrongTranslationLexicon,
  candidate: StrongTranslationCandidate
): void {
  const target =
    candidate.method === "dictionary-fr-stem" ||
    candidate.method === "learned-translation-stem"
      ? lexicon.stem
      : lexicon.exact;
  const forms = target.get(candidate.strong) ?? new Map();
  const existing = forms.get(candidate.normalized);
  if (!existing || candidate.score > existing.score) {
    forms.set(candidate.normalized, candidate);
  }
  target.set(candidate.strong, forms);
}
