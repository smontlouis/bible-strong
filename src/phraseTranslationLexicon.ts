import { type StrongVerseMap } from "./strongCsv.js";

export interface StrongPhraseCandidate {
  strong: string;
  phrase: string[];
  offset: number;
  score: number;
  source: string;
  method: "learned-phrase";
}

export interface StrongPhraseLexicon {
  byStrong: Map<string, StrongPhraseCandidate[]>;
  byStrongFirst?: Map<string, Map<string, StrongPhraseCandidate[]>>;
}

export interface StrongPhraseMatch extends StrongPhraseCandidate {
  wordIndex: number;
  startWordIndex: number;
  endWordIndex: number;
  targetRatio: number;
}

interface PhraseCount {
  strong: string;
  phraseKey: string;
  offset: number;
  count: number;
  families: Set<string>;
}

interface PhraseObservation {
  strong: string;
  phraseKey: string;
  offset: number;
  count: number;
}

const MIN_PHRASE_COUNT = 2;
const MAX_PHRASE_LENGTH = 4;
const MAX_CANDIDATES_PER_STRONG = 24;

export function buildStrongPhraseLexicon(
  references: Array<{ name: string; map: StrongVerseMap }>
): StrongPhraseLexicon {
  const counts = new Map<string, PhraseCount>();

  for (const [family, familyReferences] of groupReferencesByFamily(
    references
  )) {
    for (const verseRef of collectVerseRefs(familyReferences)) {
      const familyVerseCounts = new Map<string, PhraseObservation>();

      for (const reference of familyReferences) {
        const verse = reference.map.get(verseRef);
        if (!verse) continue;
        const editionVerseCounts = new Map<string, PhraseObservation>();
        const tokens = verse.tokens;

        for (let index = 0; index < tokens.length; index += 1) {
          const token = tokens[index];
          if (!token || token.strong.length === 0) continue;

          for (const strong of token.strong) {
            for (let length = 2; length <= MAX_PHRASE_LENGTH; length += 1) {
              for (
                let start = Math.max(0, index - length + 1);
                start <= index && start + length <= tokens.length;
                start += 1
              ) {
                if (!isUsefulPhraseSpan(tokens, start, length)) {
                  continue;
                }

                incrementPhraseObservation(editionVerseCounts, {
                  strong,
                  phraseKey: phraseKeyForSpan(tokens, start, length),
                  offset: index - start
                });
              }
            }
          }
        }

        mergeMaximumPhraseCounts(familyVerseCounts, editionVerseCounts);
      }

      addEffectiveFamilyPhraseCounts(counts, family, familyVerseCounts);
    }
  }

  const byStrong = normalizePhraseCounts(counts);
  return createStrongPhraseLexicon(byStrong);
}

export function createStrongPhraseLexicon(
  byStrong: Map<string, StrongPhraseCandidate[]>
): StrongPhraseLexicon {
  return {
    byStrong,
    byStrongFirst: indexByStrongFirst(byStrong)
  };
}

export function buildPhraseMatchIndex(options: {
  lexicon: StrongPhraseLexicon;
  words: Array<{ wordIndex: number; normalized: string }>;
  existingStrongByWord: Map<number, string[]>;
  allowedStrong?: Set<string>;
}): Map<string, StrongPhraseMatch[]> {
  const matches = new Map<string, StrongPhraseMatch[]>();
  const strongValues =
    options.allowedStrong && options.allowedStrong.size > 0
      ? [...options.allowedStrong]
      : [...options.lexicon.byStrong.keys()];

  for (const strong of strongValues) {
    const byFirst = options.lexicon.byStrongFirst?.get(strong);
    const fallbackCandidates = options.lexicon.byStrong.get(strong) ?? [];
    if (!byFirst && fallbackCandidates.length === 0) continue;

    for (let start = 0; start < options.words.length; start += 1) {
      const firstWord = options.words[start]?.normalized;
      if (!firstWord) continue;
      const candidates = byFirst?.get(firstWord) ?? fallbackCandidates;

      for (const candidate of candidates) {
        if (candidate.strong !== strong) continue;
        if (candidate.phrase[0] !== firstWord) continue;
        if (start + candidate.phrase.length > options.words.length) continue;
        const slice = options.words.slice(
          start,
          start + candidate.phrase.length
        );
        if (!phraseEquals(slice, candidate.phrase)) continue;
        if (
          slice.some((word) =>
            options.existingStrongByWord
              .get(word.wordIndex)
              ?.includes(candidate.strong)
          )
        ) {
          continue;
        }

        const target = slice[candidate.offset];
        if (!target) continue;
        const entries = matches.get(candidate.strong) ?? [];
        entries.push({
          ...candidate,
          wordIndex: target.wordIndex,
          startWordIndex: slice[0]?.wordIndex ?? target.wordIndex,
          endWordIndex: slice[slice.length - 1]?.wordIndex ?? target.wordIndex,
          targetRatio:
            options.words.length <= 1
              ? 1
              : target.wordIndex / (options.words.length - 1)
        });
        matches.set(candidate.strong, entries);
      }
    }
  }

  return matches;
}

export function findBestPhraseMatch(options: {
  matches: Map<string, StrongPhraseMatch[]>;
  strong: string;
  originalRatio: number;
}): (StrongPhraseMatch & { rankedScore: number }) | undefined {
  let best: (StrongPhraseMatch & { rankedScore: number }) | undefined;

  for (const match of options.matches.get(options.strong) ?? []) {
    const positionScore = Math.max(
      0,
      1 - Math.abs(options.originalRatio - match.targetRatio)
    );
    const rankedScore = match.score * 0.72 + positionScore * 0.28;
    if (!best || rankedScore > best.rankedScore) {
      best = { ...match, rankedScore };
    }
  }

  if (!best || best.rankedScore < 0.42) return undefined;
  return best;
}

export function findPhraseCandidate(options: {
  lexicon: StrongPhraseLexicon;
  strong: string;
  words: Array<{ wordIndex: number; normalized: string }>;
  existingStrongByWord: Map<number, string[]>;
  originalRatio: number;
}):
  | (StrongPhraseCandidate & {
      wordIndex: number;
      startWordIndex: number;
      endWordIndex: number;
    })
  | undefined {
  const byFirst = options.lexicon.byStrongFirst?.get(options.strong);
  const fallbackCandidates = options.lexicon.byStrong.get(options.strong) ?? [];
  let best:
    | (StrongPhraseCandidate & {
        wordIndex: number;
        startWordIndex: number;
        endWordIndex: number;
        rankedScore: number;
      })
    | undefined;

  for (let start = 0; start < options.words.length; start += 1) {
    const firstWord = options.words[start]?.normalized;
    if (!firstWord) continue;
    const candidates = byFirst?.get(firstWord) ?? fallbackCandidates;

    for (const candidate of candidates) {
      if (candidate.phrase[0] !== firstWord) continue;
      if (start + candidate.phrase.length > options.words.length) continue;
      const slice = options.words.slice(start, start + candidate.phrase.length);
      if (!phraseEquals(slice, candidate.phrase)) continue;

      const target = slice[candidate.offset];
      if (!target) continue;
      if (
        slice.some((word) =>
          options.existingStrongByWord
            .get(word.wordIndex)
            ?.includes(options.strong)
        )
      ) {
        continue;
      }

      const targetRatio =
        options.words.length <= 1
          ? 1
          : target.wordIndex / (options.words.length - 1);
      const positionScore = Math.max(
        0,
        1 - Math.abs(options.originalRatio - targetRatio)
      );
      const rankedScore = candidate.score * 0.72 + positionScore * 0.28;

      if (!best || rankedScore > best.rankedScore) {
        best = {
          ...candidate,
          wordIndex: target.wordIndex,
          startWordIndex: slice[0]?.wordIndex ?? target.wordIndex,
          endWordIndex: slice[slice.length - 1]?.wordIndex ?? target.wordIndex,
          rankedScore
        };
      }
    }
  }

  if (!best || best.rankedScore < 0.42) {
    return undefined;
  }

  return best;
}

function indexByStrongFirst(
  byStrong: Map<string, StrongPhraseCandidate[]>
): Map<string, Map<string, StrongPhraseCandidate[]>> {
  const indexed = new Map<string, Map<string, StrongPhraseCandidate[]>>();

  for (const [strong, candidates] of byStrong) {
    const byFirst = new Map<string, StrongPhraseCandidate[]>();
    for (const candidate of candidates) {
      const first = candidate.phrase[0];
      if (!first) continue;
      const entries = byFirst.get(first) ?? [];
      entries.push(candidate);
      byFirst.set(first, entries);
    }
    indexed.set(strong, byFirst);
  }

  return indexed;
}

function incrementPhraseObservation(
  counts: Map<string, PhraseObservation>,
  value: Pick<PhraseObservation, "strong" | "phraseKey" | "offset">
): void {
  const key = `${value.strong}\t${value.offset}\t${value.phraseKey}`;
  const existing = counts.get(key);

  if (existing) {
    existing.count += 1;
    return;
  }

  counts.set(key, {
    strong: value.strong,
    phraseKey: value.phraseKey,
    offset: value.offset,
    count: 1
  });
}

function mergeMaximumPhraseCounts(
  familyCounts: Map<string, PhraseObservation>,
  editionCounts: Map<string, PhraseObservation>
): void {
  for (const value of editionCounts.values()) {
    const key = `${value.strong}\t${value.offset}\t${value.phraseKey}`;
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

function addEffectiveFamilyPhraseCounts(
  counts: Map<string, PhraseCount>,
  family: string,
  familyVerseCounts: Map<string, PhraseObservation>
): void {
  for (const value of familyVerseCounts.values()) {
    const key = `${value.strong}\t${value.offset}\t${value.phraseKey}`;
    const existing = counts.get(key);
    if (existing) {
      existing.count += value.count;
      existing.families.add(family);
      continue;
    }
    counts.set(key, {
      ...value,
      families: new Set([family])
    });
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

function normalizePhraseCounts(
  counts: Map<string, PhraseCount>
): Map<string, StrongPhraseCandidate[]> {
  const grouped = new Map<string, PhraseCount[]>();

  for (const count of counts.values()) {
    if (count.count < MIN_PHRASE_COUNT) continue;
    const entries = grouped.get(count.strong) ?? [];
    entries.push(count);
    grouped.set(count.strong, entries);
  }

  const lexicon = new Map<string, StrongPhraseCandidate[]>();
  const totalsByPhrase = new Map<string, number>();
  for (const entry of counts.values()) {
    totalsByPhrase.set(
      entry.phraseKey,
      (totalsByPhrase.get(entry.phraseKey) ?? 0) + entry.count
    );
  }

  for (const [strong, entries] of grouped) {
    const maxCount = Math.max(...entries.map((entry) => entry.count));
    const candidates = entries
      .map((entry) => {
        const forwardProbability = entry.count / maxCount;
        const reverseProbability =
          entry.count / (totalsByPhrase.get(entry.phraseKey) ?? entry.count);
        const independentSupport = Math.min(1, entry.families.size / 2);
        let score =
          forwardProbability * 0.5 +
          reverseProbability * 0.4 +
          independentSupport * 0.1;
        if (reverseProbability < 0.08) score = Math.min(score, 0.2);
        return {
          strong,
          phrase: entry.phraseKey.split(" "),
          offset: entry.offset,
          score,
          source: [...entry.families].sort().join("+"),
          method: "learned-phrase" as const
        };
      })
      .filter((candidate) => candidate.score >= 0.16)
      .sort(
        (left, right) =>
          right.score - left.score || right.phrase.length - left.phrase.length
      )
      .slice(0, MAX_CANDIDATES_PER_STRONG);

    if (candidates.length > 0) {
      lexicon.set(strong, candidates);
    }
  }

  return lexicon;
}

function referenceFamily(name: string): string {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]+/gu, "");
  if (normalized.startsWith("darby")) return "Darby-family";
  return name;
}

function phraseEquals(
  words: Array<{ normalized: string }>,
  phrase: string[]
): boolean {
  return words.every((word, index) => word.normalized === phrase[index]);
}

function isUsefulPhraseSpan(
  tokens: Array<{ normalized: string }>,
  start: number,
  length: number
): boolean {
  let hasContentWord = false;
  for (let offset = 0; offset < length; offset += 1) {
    const normalized = tokens[start + offset]?.normalized ?? "";
    if (normalized.length < 2) return false;
    if (!FRENCH_FUNCTION_WORDS.has(normalized)) {
      hasContentWord = true;
    }
  }
  return hasContentWord;
}

function phraseKeyForSpan(
  tokens: Array<{ normalized: string }>,
  start: number,
  length: number
): string {
  let phrase = "";
  for (let offset = 0; offset < length; offset += 1) {
    if (offset > 0) phrase += " ";
    phrase += tokens[start + offset]?.normalized ?? "";
  }
  return phrase;
}

const FRENCH_FUNCTION_WORDS = new Set([
  "a",
  "au",
  "aux",
  "ce",
  "ces",
  "cet",
  "cette",
  "de",
  "des",
  "du",
  "en",
  "et",
  "il",
  "ils",
  "la",
  "le",
  "les",
  "leur",
  "leurs",
  "lui",
  "nous",
  "on",
  "ou",
  "par",
  "pour",
  "qu",
  "que",
  "qui",
  "sa",
  "se",
  "ses",
  "son",
  "sur",
  "un",
  "une",
  "y"
]);
