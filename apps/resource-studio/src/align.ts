import { tokenizeText, type TextSegment } from "./tokenize.js";
import {
  parseStrongOccurrences,
  representsOccurrence,
  type StrongToken,
  type StrongVerse
} from "./strongCsv.js";
import { normalizeOriginalStrong } from "./originalSource.js";
import { maximumWeightMatching } from "./maximumWeightMatching.js";
import type { TransferMatchingPolicy } from "./translationProfiles.js";

export interface ReferenceSource {
  name: string;
  /** Correlated editions share a family and count as one consensus witness. */
  family?: string;
  verse?: StrongVerse;
}

export interface StrongLexiconEntry {
  strong: string[];
  confidence: number;
  source: string;
}

export interface StrongLexicon {
  exact: Map<string, StrongLexiconEntry>;
  stem: Map<string, StrongLexiconEntry>;
}

export interface OriginalConstraint {
  strongSet: Set<string>;
  source: string;
}

export interface AssignedStrong {
  strong: string[];
  confidence: number;
  source: string;
  method:
    | "exact"
    | "stem"
    | "window"
    | "lexicon"
    | "source-lexicon"
    | "learned-translation"
    | "learned-translation-stem"
    | "dictionary-fr-exact"
    | "dictionary-fr-stem"
    | "learned-phrase"
    | "llm-arbiter"
    | "curated-llm-transfer";
  originalConfirmed: boolean;
  /** Witness locution tags (`<reference>#<element>`) that support this word. */
  locutions?: string[];
  /** Supported only by secondary words of witness locutions. */
  locutionMemberOnly?: boolean;
}

/** Consecutive target words carrying one witness locution as one occurrence. */
export interface LocutionAssignment {
  startWordIndex: number;
  endWordIndex: number;
  assignment: AssignedStrong;
}

export interface AlignmentResult {
  segments: TextSegment[];
  assignments: Map<number, AssignedStrong>;
  /** Present when witness locutions are enabled; their words left `assignments`. */
  locutions?: LocutionAssignment[];
  wordCount: number;
  taggedWordCount: number;
  lowConfidenceWordCount: number;
}

interface Candidate {
  strong: string[];
  score: number;
  source: string;
  witnessFamily: string;
  method: AssignedStrong["method"];
  locution?: string;
  /** Matched through a locution word other than its head. */
  locutionMember?: boolean;
}

interface TargetWord {
  wordIndex: number;
  normalized: string;
}

const LOW_CONFIDENCE_THRESHOLD = 0.55;

export function alignVerse(
  targetText: string,
  references: ReferenceSource[],
  lexicon?: StrongLexicon,
  original?: OriginalConstraint,
  matching?: TransferMatchingPolicy
): AlignmentResult {
  const segments = tokenizeText(targetText);
  const assignments = new Map<number, AssignedStrong>();
  const words = getTargetWords(segments);
  const matchedByReference = references.map((reference) =>
    matchReferenceOccurrences(words, reference, matching)
  );

  for (const word of words) {
    const candidates: Candidate[] = [];

    for (const matched of matchedByReference) {
      const candidate = matched.get(word.wordIndex);
      if (candidate) {
        candidates.push(candidate);
      }
    }

    const chosen = chooseCandidate(candidates);

    if (chosen) {
      const originalConfirmed = isConfirmedByOriginal(chosen.strong, original);
      const agreeing = candidates.filter(
        (candidate) => candidate.strong.join(" ") === chosen.strong.join(" ")
      );
      const locutions = agreeing.flatMap((candidate) =>
        candidate.locution ? [candidate.locution] : []
      );
      assignments.set(word.wordIndex, {
        strong: chosen.strong,
        confidence: scoreWithOriginal(chosen.score, chosen.strong, original),
        source: sourceWithOriginal(chosen.source, chosen.strong, original),
        method: chosen.method,
        originalConfirmed,
        ...(matching?.witnessLocutions && locutions.length
          ? { locutions }
          : {}),
        ...(agreeing.every((candidate) => candidate.locutionMember)
          ? { locutionMemberOnly: true }
          : {})
      });
      continue;
    }

    const lexiconCandidate = findLexiconCandidate(
      word.normalized,
      lexicon,
      original
    );

    if (lexiconCandidate) {
      assignments.set(word.wordIndex, {
        strong: lexiconCandidate.strong,
        confidence: lexiconCandidate.confidence,
        source: lexiconCandidate.source,
        method: lexiconCandidate.source.includes("original")
          ? "source-lexicon"
          : "lexicon",
        originalConfirmed: isConfirmedByOriginal(
          lexiconCandidate.strong,
          original
        )
      });
    }
  }

  const locutions = matching?.witnessLocutions
    ? collectLocutions(assignments)
    : undefined;
  // Outside a reassembled locution, its secondary words carry nothing: the
  // occurrence stays with the head word, as with a single-word witness tag.
  for (const [wordIndex, assignment] of assignments)
    if (assignment.locutionMemberOnly) assignments.delete(wordIndex);
  const wordCount = segments.filter(
    (segment) => segment.kind === "word"
  ).length;
  const taggedWordCount =
    assignments.size +
    (locutions ?? []).reduce(
      (sum, locution) =>
        sum + locution.endWordIndex - locution.startWordIndex + 1,
      0
    );
  const lowConfidenceWordCount = [...assignments.values()].filter(
    (assignment) => assignment.confidence < LOW_CONFIDENCE_THRESHOLD
  ).length;

  return {
    segments,
    assignments,
    ...(locutions ? { locutions } : {}),
    wordCount,
    taggedWordCount,
    lowConfidenceWordCount
  };
}

/**
 * Consecutive words that received the same Strong numbers from one witness
 * locution tag become one occurrence; a single matched word stays a word.
 */
function collectLocutions(
  assignments: Map<number, AssignedStrong>
): LocutionAssignment[] {
  const locutions: LocutionAssignment[] = [];
  const indexes = [...assignments.keys()].sort((left, right) => left - right);
  let run: number[] = [];
  const close = () => {
    if (run.length > 1) {
      const members = run.map((index) => assignments.get(index)!);
      const head = members[0]!;
      locutions.push({
        startWordIndex: run[0]!,
        endWordIndex: run.at(-1)!,
        assignment: {
          ...head,
          confidence: Math.min(...members.map((member) => member.confidence)),
          originalConfirmed: members.every((member) => member.originalConfirmed)
        }
      });
      for (const index of run) assignments.delete(index);
    }
    run = [];
  };
  for (const index of indexes) {
    const current = assignments.get(index)!;
    const previous = run.length ? assignments.get(run.at(-1)!) : undefined;
    const joins =
      previous !== undefined &&
      run.at(-1) === index - 1 &&
      previous.strong.join(" ") === current.strong.join(" ") &&
      (current.locutions ?? []).some((key) =>
        (previous.locutions ?? []).includes(key)
      );
    if (!joins) close();
    if (current.locutions?.length) run.push(index);
  }
  close();
  return locutions;
}

function matchReferenceOccurrences(
  words: TargetWord[],
  reference: ReferenceSource,
  matching?: TransferMatchingPolicy
): Map<number, Candidate> {
  const tokens = reference.verse?.tokens ?? [];
  // Without locution transfer, a locution is matched through its head word
  // only, exactly as when the witness tagged that word alone.
  const strongTokens = referenceStrongTokens(reference).filter(
    ({ token }) => matching?.witnessLocutions || representsOccurrence(token)
  );
  const edges = strongTokens.flatMap(({ token, sourceIndex }, left) =>
    words.flatMap((word) => {
      const candidate = candidateForToken(
        word.normalized,
        token,
        reference,
        matching
      );
      if (!candidate) return [];
      const position = positionSimilarity(
        sourceIndex,
        tokens.length,
        word.wordIndex,
        words.length
      );
      return [
        {
          left,
          right: word.wordIndex,
          // Position is used only to resolve the global occurrence mapping;
          // it does not inflate the reported lexical confidence.
          weight: candidate.score + position * 0.03,
          value:
            token.element === undefined
              ? candidate
              : {
                  ...candidate,
                  locution: `${reference.name}#${token.element}`,
                  ...(token.elementHead ? {} : { locutionMember: true })
                }
        }
      ];
    })
  );

  return new Map(
    maximumWeightMatching({
      leftCount: strongTokens.length,
      rightCount: words.length,
      edges
    }).map((match) => [match.right, match.value])
  );
}

function referenceStrongTokens(
  reference: ReferenceSource
): Array<{ token: StrongToken; sourceIndex: number }> {
  const tokens = reference.verse?.tokens ?? [];
  const tagged = tokens
    .map((token, sourceIndex) => ({ token, sourceIndex }))
    .filter(({ token }) => token.strong.length > 0);
  if (!reference.verse) return tagged;

  const totalCounts = countStrings(
    parseStrongOccurrences(reference.verse.row.text)
  );
  const visibleCounts = countStrings(
    tagged.flatMap(({ token }) =>
      representsOccurrence(token) ? token.strong : []
    )
  );

  for (const [strong, total] of totalCounts) {
    const missing = total - (visibleCounts.get(strong) ?? 0);
    if (missing <= 0) continue;
    const carriers = tagged.filter(({ token }) =>
      token.strong.includes(strong)
    );
    const normalized = new Set(
      carriers.map(({ token }) => token.normalized).filter(Boolean)
    );
    // An empty occurrence can borrow a visible lexical carrier only when the
    // same reference uses one unambiguous surface form for this Strong.
    if (normalized.size !== 1 || carriers.length === 0) continue;
    const exemplar = carriers[0]!;
    for (let index = 0; index < missing; index += 1) {
      tagged.push({
        sourceIndex: exemplar.sourceIndex,
        token: {
          text: exemplar.token.text,
          normalized: exemplar.token.normalized,
          strong: [strong]
        }
      });
    }
  }
  return tagged;
}

function countStrings(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

function candidateForToken(
  normalizedWord: string,
  token: StrongToken,
  reference: ReferenceSource,
  matching?: TransferMatchingPolicy
): Candidate | undefined {
  const base = {
    strong: token.strong,
    source: reference.name,
    witnessFamily: reference.family ?? inferWitnessFamily(reference.name)
  };
  if (token.normalized === normalizedWord) {
    return { ...base, score: 0.95, method: "exact" };
  }
  // The same word form with an attached clitic pronoun or written in digits:
  // only the spelling of the target token differs from the witness carrier.
  if (
    matching?.encliticHosts &&
    token.normalized &&
    encliticHost(normalizedWord) === token.normalized
  ) {
    return {
      ...base,
      source: `${reference.name}~enclitic-host`,
      score: 0.93,
      method: "exact"
    };
  }
  if (
    matching?.digitNumerals &&
    token.normalized &&
    spelledFrenchNumber(normalizedWord) === token.normalized
  ) {
    return {
      ...base,
      source: `${reference.name}~digit-numeral`,
      score: 0.93,
      method: "exact"
    };
  }

  const stem = stemWord(normalizedWord);
  const tokenStem = stemWord(token.normalized);
  if (stem.length >= 4 && tokenStem.length >= 4 && tokenStem === stem) {
    return { ...base, score: 0.72, method: "stem" };
  }

  if (
    token.normalized.length >= 5 &&
    normalizedWord.length >= 5 &&
    stem.length >= 4 &&
    tokenStem.length >= 4 &&
    (token.normalized.startsWith(stem) || normalizedWord.startsWith(tokenStem))
  ) {
    return { ...base, score: 0.48, method: "window" };
  }

  return undefined;
}

function findLexiconCandidate(
  normalizedWord: string,
  lexicon?: StrongLexicon,
  original?: OriginalConstraint
): StrongLexiconEntry | undefined {
  if (!lexicon) {
    return undefined;
  }

  const exact = lexicon.exact.get(normalizedWord);
  if (exact && isConfirmedByOriginal(exact.strong, original)) {
    return {
      ...exact,
      confidence: Math.min(0.86, exact.confidence + 0.18),
      source: `${exact.source}+${original?.source ?? "original"}`
    };
  }

  if (exact && !original) {
    return exact;
  }

  const stem = stemWord(normalizedWord);
  if (stem.length >= 5) {
    const stemEntry = lexicon.stem.get(stem);
    if (stemEntry && isConfirmedByOriginal(stemEntry.strong, original)) {
      return {
        ...stemEntry,
        confidence: Math.min(0.78, stemEntry.confidence + 0.14),
        source: `${stemEntry.source}+${original?.source ?? "original"}`
      };
    }

    if (stemEntry && !original) {
      return stemEntry;
    }
  }

  return undefined;
}

function isConfirmedByOriginal(
  strong: string[],
  original?: OriginalConstraint
): boolean {
  if (!original) {
    return false;
  }

  const originalStrong = new Set(
    [...original.strongSet]
      .map((strongCode) => normalizeOriginalStrong(strongCode))
      .filter((strongCode): strongCode is string => Boolean(strongCode))
  );

  return strong.some((strongCode) => {
    const normalizedStrong = normalizeOriginalStrong(strongCode);
    return !!normalizedStrong && originalStrong.has(normalizedStrong);
  });
}

function scoreWithOriginal(
  score: number,
  strong: string[],
  original?: OriginalConstraint
): number {
  if (!original) {
    return score;
  }

  if (isConfirmedByOriginal(strong, original)) {
    return Math.min(0.995, score + 0.04);
  }

  return Math.min(score, 0.58);
}

function sourceWithOriginal(
  source: string,
  strong: string[],
  original?: OriginalConstraint
): string {
  if (!original || !isConfirmedByOriginal(strong, original)) {
    return source;
  }

  return `${source}+${original.source}`;
}

function chooseCandidate(candidates: Candidate[]): Candidate | undefined {
  if (candidates.length === 0) {
    return undefined;
  }

  const byStrong = new Map<string, Candidate[]>();

  for (const candidate of candidates) {
    const key = candidate.strong.join(" ");
    const existing = byStrong.get(key) ?? [];
    existing.push(candidate);
    byStrong.set(key, existing);
  }

  const agreed = [...byStrong.values()]
    .map((group) => ({
      group,
      score:
        Math.max(...group.map((candidate) => candidate.score)) +
        Math.min(
          0.2,
          (new Set(group.map((candidate) => candidate.witnessFamily)).size -
            1) *
            0.1
        )
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.group[0]!.strong.join(" ").localeCompare(b.group[0]!.strong.join(" "))
    )[0];

  if (!agreed) {
    return undefined;
  }

  const best = agreed.group.sort((a, b) => b.score - a.score)[0];

  return {
    ...best,
    score: Math.min(0.99, agreed.score),
    source: agreed.group.map((candidate) => candidate.source).join("+")
  };
}

function getTargetWords(segments: TextSegment[]): TargetWord[] {
  const words: TargetWord[] = [];
  for (const segment of segments) {
    if (segment.kind !== "word") continue;
    words.push({ wordIndex: words.length, normalized: segment.normalized });
  }
  return words;
}

function inferWitnessFamily(name: string): string {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]+/gu, "");
  if (normalized.startsWith("darby")) return "darby";
  return normalized || name;
}

function positionSimilarity(
  sourceIndex: number,
  sourceCount: number,
  targetIndex: number,
  targetCount: number
): number {
  if (sourceCount <= 1 || targetCount <= 1) return 1;
  const sourceRatio = sourceIndex / (sourceCount - 1);
  const targetRatio = targetIndex / (targetCount - 1);
  return Math.max(0, 1 - Math.abs(sourceRatio - targetRatio));
}

export function stemWord(word: string): string {
  return word
    .replace(
      /(?:ements|ement|ations|ation|ateur|atrice|iques|ique|ites|ite)$/u,
      ""
    )
    .replace(/(?:eront|erais|erait|aient|asses|ions|iez|ees|ee|es|s)$/u, "");
}

const FRENCH_ENCLITICS = new Set([
  "je",
  "tu",
  "il",
  "elle",
  "on",
  "nous",
  "vous",
  "ils",
  "elles",
  "moi",
  "toi",
  "le",
  "la",
  "les",
  "lui",
  "leur",
  "en",
  "y",
  "ce",
  "ci",
  "t"
]);

/**
 * Host of a hyphenated French enclitic sequence in a normalized token
 * (« dit-il » → « dit », « va-t-il » → « va », « jour-là » → « jour »).
 * Returns undefined when no trailing clitic is attached.
 */
export function encliticHost(normalizedWord: string): string | undefined {
  const parts = normalizedWord.split("-");
  let end = parts.length;
  while (end > 1 && FRENCH_ENCLITICS.has(parts[end - 1]!)) end -= 1;
  if (end === parts.length || end === 0) return undefined;
  const host = parts.slice(0, end).join("-");
  return host || undefined;
}

const UNITS = [
  "zero",
  "un",
  "deux",
  "trois",
  "quatre",
  "cinq",
  "six",
  "sept",
  "huit",
  "neuf",
  "dix",
  "onze",
  "douze",
  "treize",
  "quatorze",
  "quinze",
  "seize"
];
const TENS: Record<number, string> = {
  2: "vingt",
  3: "trente",
  4: "quarante",
  5: "cinquante",
  6: "soixante"
};

/**
 * Traditional French spelling of a number written in digits, only when it is
 * a single hyphenated token (« 3 » → « trois », « 22 » → « vingt-deux »).
 * Forms with « et » or separate words (« vingt et un », « deux cents »)
 * return undefined because they cover several witness tokens.
 */
export function spelledFrenchNumber(
  normalizedWord: string
): string | undefined {
  if (!/^\d{1,4}$/u.test(normalizedWord)) return undefined;
  const value = Number(normalizedWord);
  if (value === 100) return "cent";
  if (value === 1000) return "mille";
  if (value < 1 || value > 99) return undefined;
  if (value <= 16) return UNITS[value];
  if (value < 20) return `dix-${UNITS[value - 10]}`;
  const tens = Math.floor(value / 10);
  const unit = value % 10;
  if (tens <= 6) {
    if (unit === 0) return TENS[tens];
    if (unit === 1) return undefined;
    return `${TENS[tens]}-${UNITS[unit]}`;
  }
  if (tens === 7) {
    if (unit === 1) return undefined;
    return `soixante-${unit === 0 ? "dix" : unit <= 6 ? UNITS[10 + unit] : `dix-${UNITS[unit]}`}`;
  }
  if (value === 80) return "quatre-vingts";
  const rest = value - 80;
  if (rest <= 16) return `quatre-vingt-${UNITS[rest]}`;
  return `quatre-vingt-dix-${UNITS[rest - 10]}`;
}
