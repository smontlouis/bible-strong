import { stemWord } from "./align.js";
import { isGenericFrenchCarrier } from "./frenchLexicalSafety.js";
import { type StrongVerseMap } from "./strongCsv.js";
import { normalizeStepStrongCode } from "./lexiconV3/identity.js";

export interface StrongTranslationCandidate {
  strong: string;
  stepStrong?: string;
  normalized: string;
  score: number;
  source: string;
  /** Root dataset used to avoid counting derived evidence twice. */
  provenanceRoot?: string;
  /** Candidate may be reported for review but must not enrich production. */
  reviewOnly?: boolean;
  method:
    | "learned-translation"
    | "learned-translation-stem"
    | "dictionary-fr-exact"
    | "dictionary-fr-stem";
}

export interface StrongTranslationLexicon {
  exact: Map<string, Map<string, StrongTranslationCandidate>>;
  stem: Map<string, Map<string, StrongTranslationCandidate>>;
  exactByStep?: Map<string, Map<string, StrongTranslationCandidate>>;
  stemByStep?: Map<string, Map<string, StrongTranslationCandidate>>;
}

interface FormCount {
  strong: string;
  normalized: string;
  count: number;
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
  const exactSupports = new Map<string, Map<string, Set<string>>>();
  const stemSupports = new Map<string, Map<string, Set<string>>>();

  for (const [family, familyReferences] of groupReferencesByFamily(
    references
  )) {
    for (const verseRef of collectVerseRefs(familyReferences)) {
      const exactFamilyVerseCounts = new Map<string, FormCount>();
      const stemFamilyVerseCounts = new Map<string, FormCount>();

      for (const reference of familyReferences) {
        const verse = reference.map.get(verseRef);
        if (!verse) continue;
        const exactEditionVerseCounts = new Map<string, FormCount>();
        const stemEditionVerseCounts = new Map<string, FormCount>();

        for (const token of verse.tokens) {
          if (token.strong.length === 0 || token.normalized.length < 2) {
            continue;
          }

          for (const strong of token.strong) {
            if (isGenericFrenchCarrier(token.normalized)) {
              continue;
            }
            incrementFormCount(
              exactEditionVerseCounts,
              strong,
              token.normalized
            );

            const stem = stemWord(token.normalized);
            if (stem.length >= 4) {
              incrementFormCount(stemEditionVerseCounts, strong, stem);
            }
          }
        }

        mergeMaximumFormCounts(exactFamilyVerseCounts, exactEditionVerseCounts);
        mergeMaximumFormCounts(stemFamilyVerseCounts, stemEditionVerseCounts);
      }

      addEffectiveFamilyCounts(
        exactCounts,
        exactSupports,
        family,
        exactFamilyVerseCounts
      );
      addEffectiveFamilyCounts(
        stemCounts,
        stemSupports,
        family,
        stemFamilyVerseCounts
      );
    }
  }

  const lexicon = {
    exact: normalizeCounts(exactCounts, exactSupports, MIN_EXACT_COUNT),
    stem: normalizeCounts(stemCounts, stemSupports, MIN_STEM_COUNT),
    exactByStep: new Map<string, Map<string, StrongTranslationCandidate>>(),
    stemByStep: new Map<string, Map<string, StrongTranslationCandidate>>()
  };

  for (const candidate of options.dictionaryCandidates ?? []) {
    if (candidate.reviewOnly || isGenericFrenchCarrier(candidate.normalized)) {
      continue;
    }
    addDictionaryCandidate(lexicon, candidate);
  }

  return lexicon;
}

export function findTranslationCandidate(
  lexicon: StrongTranslationLexicon,
  strong: string,
  normalized: string,
  stepStrong?: string
): StrongTranslationCandidate | undefined {
  const normalizedStep = stepStrong
    ? (normalizeStepStrongCode(stepStrong) ?? undefined)
    : undefined;
  const stepExact = normalizedStep
    ? lexicon.exactByStep?.get(normalizedStep)?.get(normalized)
    : undefined;
  if (stepExact) return stepExact;

  const exact = lexicon.exact.get(strong)?.get(normalized);
  if (exact && stepCandidateIsCompatible(exact, normalizedStep)) {
    return exact;
  }

  const stem = stemWord(normalized);
  if (stem.length >= 4) {
    const stepCandidate = normalizedStep
      ? lexicon.stemByStep?.get(normalizedStep)?.get(stem)
      : undefined;
    if (stepCandidate) return stepCandidate;
    const candidate = lexicon.stem.get(strong)?.get(stem);
    if (candidate && stepCandidateIsCompatible(candidate, normalizedStep)) {
      return candidate;
    }
  }

  return undefined;
}

function stepCandidateIsCompatible(
  candidate: StrongTranslationCandidate,
  wantedStepStrong: string | undefined
): boolean {
  if (!candidate.stepStrong) return true;
  const candidateStep = normalizeStepStrongCode(candidate.stepStrong);
  if (!candidateStep) return false;
  if (!wantedStepStrong) return isClassicalStepStrong(candidateStep);
  if (candidateStep === wantedStepStrong) return true;
  return isClassicalStepStrong(candidateStep);
}

function isClassicalStepStrong(value: string): boolean {
  return /^[HG]\d{4,5}$/u.test(value);
}

function increment(
  counts: Map<string, Map<string, number>>,
  strong: string,
  normalized: string,
  amount = 1
): void {
  const wordCounts = counts.get(strong) ?? new Map<string, number>();
  wordCounts.set(normalized, (wordCounts.get(normalized) ?? 0) + amount);
  counts.set(strong, wordCounts);
}

function incrementFormCount(
  counts: Map<string, FormCount>,
  strong: string,
  normalized: string
): void {
  const key = `${strong}\u0000${normalized}`;
  const existing = counts.get(key);
  if (existing) {
    existing.count += 1;
    return;
  }
  counts.set(key, { strong, normalized, count: 1 });
}

function mergeMaximumFormCounts(
  familyCounts: Map<string, FormCount>,
  editionCounts: Map<string, FormCount>
): void {
  for (const value of editionCounts.values()) {
    const key = `${value.strong}\u0000${value.normalized}`;
    const existing = familyCounts.get(key);
    if (!existing || value.count > existing.count) {
      familyCounts.set(key, { ...value });
    }
  }
}

function collectVerseRefs(
  references: Array<{ map: StrongVerseMap }>
): Set<string> {
  const refs = new Set<string>();
  for (const reference of references) {
    for (const ref of reference.map.keys()) refs.add(ref);
  }
  return refs;
}

function addEffectiveFamilyCounts(
  counts: Map<string, Map<string, number>>,
  supports: Map<string, Map<string, Set<string>>>,
  family: string,
  familyVerseCounts: Map<string, FormCount>
): void {
  for (const value of familyVerseCounts.values()) {
    increment(counts, value.strong, value.normalized, value.count);
    addSupport(supports, value.strong, value.normalized, family);
  }
}

function groupReferencesByFamily(
  references: Array<{ name: string; map: StrongVerseMap }>
): Map<string, Array<{ name: string; map: StrongVerseMap }>> {
  const grouped = new Map<
    string,
    Array<{ name: string; map: StrongVerseMap }>
  >();
  for (const reference of references) {
    const family = referenceFamily(reference.name);
    const familyReferences = grouped.get(family) ?? [];
    familyReferences.push(reference);
    grouped.set(family, familyReferences);
  }
  return grouped;
}

function normalizeCounts(
  counts: Map<string, Map<string, number>>,
  supports: Map<string, Map<string, Set<string>>>,
  minCount: number
): Map<string, Map<string, StrongTranslationCandidate>> {
  const lexicon = new Map<string, Map<string, StrongTranslationCandidate>>();
  const totalsByForm = new Map<string, number>();
  for (const wordCounts of counts.values()) {
    for (const [form, count] of wordCounts) {
      totalsByForm.set(form, (totalsByForm.get(form) ?? 0) + count);
    }
  }

  for (const [strong, wordCounts] of counts) {
    const maxCount = Math.max(...wordCounts.values());
    const candidates = new Map<string, StrongTranslationCandidate>();

    for (const [normalized, count] of wordCounts) {
      if (count < minCount) {
        continue;
      }

      const forwardProbability = count / maxCount;
      const reverseProbability =
        count / (totalsByForm.get(normalized) ?? count);
      const families = supports.get(strong)?.get(normalized) ?? new Set();
      const independentSupport = Math.min(1, families.size / 2);
      let score =
        forwardProbability * 0.5 +
        reverseProbability * 0.4 +
        independentSupport * 0.1;
      if (reverseProbability < 0.08) score = Math.min(score, 0.24);
      if (score < MIN_SCORE) {
        continue;
      }

      candidates.set(normalized, {
        strong,
        normalized,
        score,
        source: [...families].sort().join("+") || "reference-lexicon",
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

function addSupport(
  supports: Map<string, Map<string, Set<string>>>,
  strong: string,
  normalized: string,
  family: string
): void {
  const forms = supports.get(strong) ?? new Map();
  const families = forms.get(normalized) ?? new Set();
  families.add(family);
  forms.set(normalized, families);
  supports.set(strong, forms);
}

function referenceFamily(name: string): string {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]+/gu, "");
  if (normalized.startsWith("darby")) return "Darby-family";
  return name;
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

  if (candidate.stepStrong) {
    const stepTarget =
      candidate.method === "dictionary-fr-stem" ||
      candidate.method === "learned-translation-stem"
        ? lexicon.stemByStep
        : lexicon.exactByStep;
    if (stepTarget) {
      const stepKey = normalizeStepStrongCode(candidate.stepStrong);
      if (!stepKey) return;
      const stepForms = stepTarget.get(stepKey) ?? new Map();
      const stepExisting = stepForms.get(candidate.normalized);
      if (!stepExisting || candidate.score > stepExisting.score) {
        stepForms.set(candidate.normalized, candidate);
      }
      stepTarget.set(stepKey, stepForms);
    }
  }
}
