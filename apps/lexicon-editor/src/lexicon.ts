import {
  stemWord,
  type StrongLexicon,
  type StrongLexiconEntry
} from "./align.js";
import { type StrongVerseMap } from "./strongCsv.js";

interface LexiconOptions {
  minExactCount: number;
  minStemCount: number;
  minExactDominance: number;
  minStemDominance: number;
}

const DEFAULT_OPTIONS: LexiconOptions = {
  minExactCount: 2,
  minStemCount: 4,
  minExactDominance: 0.82,
  minStemDominance: 0.9
};

export function buildStrongLexicon(
  references: Array<{ name: string; map: StrongVerseMap }>,
  options: Partial<LexiconOptions> = {}
): StrongLexicon {
  const resolvedOptions = { ...DEFAULT_OPTIONS, ...options };
  const exactCounts = new Map<string, Map<string, number>>();
  const stemCounts = new Map<string, Map<string, number>>();

  for (const reference of references) {
    for (const verse of reference.map.values()) {
      for (const token of verse.tokens) {
        if (token.strong.length === 0 || token.normalized.length < 3) {
          continue;
        }

        addCount(exactCounts, token.normalized, token.strong.join(" "));

        const stem = stemWord(token.normalized);
        if (stem.length >= 5) {
          addCount(stemCounts, stem, token.strong.join(" "));
        }
      }
    }
  }

  return {
    exact: selectDominantEntries(exactCounts, {
      minCount: resolvedOptions.minExactCount,
      minDominance: resolvedOptions.minExactDominance,
      confidenceBase: 0.5,
      source: "global-lexicon:exact"
    }),
    stem: selectDominantEntries(stemCounts, {
      minCount: resolvedOptions.minStemCount,
      minDominance: resolvedOptions.minStemDominance,
      confidenceBase: 0.42,
      source: "global-lexicon:stem"
    })
  };
}

function addCount(
  counts: Map<string, Map<string, number>>,
  word: string,
  strong: string
): void {
  const strongCounts = counts.get(word) ?? new Map<string, number>();
  strongCounts.set(strong, (strongCounts.get(strong) ?? 0) + 1);
  counts.set(word, strongCounts);
}

function selectDominantEntries(
  counts: Map<string, Map<string, number>>,
  options: {
    minCount: number;
    minDominance: number;
    confidenceBase: number;
    source: string;
  }
): Map<string, StrongLexiconEntry> {
  const entries = new Map<string, StrongLexiconEntry>();

  for (const [word, strongCounts] of counts) {
    const total = [...strongCounts.values()].reduce(
      (sum, count) => sum + count,
      0
    );
    const [strong, count] = [...strongCounts.entries()].sort(
      (a, b) => b[1] - a[1]
    )[0] ?? ["", 0];
    const dominance = count / total;

    if (count < options.minCount || dominance < options.minDominance) {
      continue;
    }

    entries.set(word, {
      strong: strong.split(" ").filter(Boolean),
      confidence: Math.min(0.68, options.confidenceBase + dominance * 0.18),
      source: options.source
    });
  }

  return entries;
}
