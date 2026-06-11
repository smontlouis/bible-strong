import { stemWord } from "./align.js";
import { type StrongVerseMap } from "./strongCsv.js";

export interface StrongTranslationCandidate {
  strong: string;
  normalized: string;
  score: number;
  source: string;
  method: "learned-translation" | "learned-translation-stem";
}

export interface StrongTranslationLexicon {
  exact: Map<string, Map<string, StrongTranslationCandidate>>;
  stem: Map<string, Map<string, StrongTranslationCandidate>>;
}

const MIN_EXACT_COUNT = 2;
const MIN_STEM_COUNT = 4;
const MIN_SCORE = 0.18;

export function buildStrongTranslationLexicon(
  references: Array<{ name: string; map: StrongVerseMap }>
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

  return {
    exact: normalizeCounts(exactCounts, MIN_EXACT_COUNT, sourceNames),
    stem: normalizeCounts(stemCounts, MIN_STEM_COUNT, sourceNames)
  };
}

export function findTranslationCandidate(
  lexicon: StrongTranslationLexicon,
  strong: string,
  normalized: string
): StrongTranslationCandidate | undefined {
  for (const form of equivalentForms(normalized)) {
    const exact = lexicon.exact.get(strong)?.get(form);
    if (exact) {
      return exact;
    }
  }

  for (const form of equivalentForms(normalized)) {
    const stem = stemWord(form);
    if (stem.length >= 4) {
      const candidate = lexicon.stem.get(strong)?.get(stem);
      if (candidate) return candidate;
    }
  }

  return undefined;
}

function equivalentForms(normalized: string): string[] {
  const forms = new Set([normalized]);

  if (normalized === "ciel") forms.add("cieux");
  if (normalized === "cieux") forms.add("ciel");
  if (normalized === "oeil") forms.add("yeux");
  if (normalized === "yeux") forms.add("oeil");

  return [...forms];
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
