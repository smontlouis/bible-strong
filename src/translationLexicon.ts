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
  for (const form of getEquivalentTranslationForms(strong, normalized)) {
    const exact = lexicon.exact.get(strong)?.get(form);
    if (exact) {
      return exact;
    }
  }

  for (const form of getEquivalentTranslationForms(strong, normalized)) {
    const stem = stemWord(form);
    if (stem.length >= 4) {
      const candidate = lexicon.stem.get(strong)?.get(stem);
      if (candidate) return candidate;
    }
  }

  return undefined;
}

export function getEquivalentTranslationForms(
  strong: string,
  normalized: string
): string[] {
  const forms = new Set([normalized]);

  if (normalized === "ciel") forms.add("cieux");
  if (normalized === "cieux") forms.add("ciel");
  if (normalized === "oeil") forms.add("yeux");
  if (normalized === "yeux") forms.add("oeil");

  for (const family of CONTROLLED_SEMANTIC_EQUIVALENCES) {
    if (!family.strong.has(strong) || !family.forms.has(normalized)) continue;
    for (const form of family.forms) {
      forms.add(form);
    }
  }

  return [...forms];
}

const CONTROLLED_SEMANTIC_EQUIVALENCES: Array<{
  strong: Set<string>;
  forms: Set<string>;
}> = [
  {
    strong: new Set(["H0120"]),
    forms: new Set([
      "homme",
      "hommes",
      "humain",
      "humains",
      "personne",
      "personnes"
    ])
  },
  {
    strong: new Set(["H5162"]),
    forms: new Set([
      "repens",
      "repent",
      "repentit",
      "repentir",
      "regrette",
      "regretta"
    ])
  },
  {
    strong: new Set(["H7843"]),
    forms: new Set([
      "corrompu",
      "corrompue",
      "corrompus",
      "corrompues",
      "perverti",
      "pervertie",
      "pervertis",
      "perverties",
      "detruire",
      "detruit",
      "detruis",
      "detruirai",
      "aneantir",
      "aneantis",
      "aneantirai"
    ])
  },
  {
    strong: new Set(["H5303"]),
    forms: new Set(["geant", "geants", "nephilim"])
  },
  {
    strong: new Set(["H8435"]),
    forms: new Set([
      "generation",
      "generations",
      "genealogie",
      "posterite",
      "descendance"
    ])
  },
  {
    strong: new Set(["H3068"]),
    forms: new Set(["eternel", "seigneur", "yahweh"])
  }
];

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
