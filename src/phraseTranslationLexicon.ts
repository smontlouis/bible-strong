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
}

interface PhraseCount {
  strong: string;
  phrase: string[];
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
  const source = references.map((reference) => reference.name).join("+");

  for (const reference of references) {
    for (const verse of reference.map.values()) {
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
              const phraseTokens = tokens.slice(start, start + length);
              if (
                !isUsefulPhrase(phraseTokens.map((item) => item.normalized))
              ) {
                continue;
              }

              increment(counts, {
                strong,
                phrase: phraseTokens.map((item) => item.normalized),
                offset: index - start
              });
            }
          }
        }
      }
    }
  }

  return { byStrong: normalizePhraseCounts(counts, source) };
}

export function findPhraseCandidate(options: {
  lexicon: StrongPhraseLexicon;
  strong: string;
  words: Array<{ wordIndex: number; normalized: string }>;
  existingStrongByWord: Map<number, string[]>;
  originalRatio: number;
}): (StrongPhraseCandidate & { wordIndex: number }) | undefined {
  const candidates = options.lexicon.byStrong.get(options.strong) ?? [];
  let best:
    | (StrongPhraseCandidate & {
        wordIndex: number;
        rankedScore: number;
      })
    | undefined;

  for (const candidate of candidates) {
    for (
      let start = 0;
      start + candidate.phrase.length <= options.words.length;
      start += 1
    ) {
      const slice = options.words.slice(start, start + candidate.phrase.length);
      if (!phraseEquals(slice, candidate.phrase)) continue;

      const target = slice[candidate.offset];
      if (!target) continue;
      if (
        options.existingStrongByWord
          .get(target.wordIndex)
          ?.includes(options.strong)
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

function increment(
  counts: Map<string, PhraseCount>,
  value: Pick<PhraseCount, "strong" | "phrase" | "offset">
): void {
  const key = `${value.strong}\t${value.offset}\t${value.phrase.join(" ")}`;
  const existing = counts.get(key);

  if (existing) {
    existing.count += 1;
    return;
  }

  counts.set(key, { ...value, count: 1 });
}

function normalizePhraseCounts(
  counts: Map<string, PhraseCount>,
  source: string
): Map<string, StrongPhraseCandidate[]> {
  const grouped = new Map<string, PhraseCount[]>();

  for (const count of counts.values()) {
    if (count.count < MIN_PHRASE_COUNT) continue;
    const entries = grouped.get(count.strong) ?? [];
    entries.push(count);
    grouped.set(count.strong, entries);
  }

  const lexicon = new Map<string, StrongPhraseCandidate[]>();

  for (const [strong, entries] of grouped) {
    const maxCount = Math.max(...entries.map((entry) => entry.count));
    const candidates = entries
      .map((entry) => ({
        strong,
        phrase: entry.phrase,
        offset: entry.offset,
        score: entry.count / maxCount,
        source,
        method: "learned-phrase" as const
      }))
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

function phraseEquals(
  words: Array<{ normalized: string }>,
  phrase: string[]
): boolean {
  return words.every((word, index) => word.normalized === phrase[index]);
}

function isUsefulPhrase(phrase: string[]): boolean {
  if (phrase.some((word) => word.length < 2)) return false;
  return phrase.some((word) => !FRENCH_FUNCTION_WORDS.has(word));
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
