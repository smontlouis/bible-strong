import { normalizeWord, tokenizeText, type TextSegment } from "./tokenize.js";
import {
  parseStrongOccurrences,
  representsOccurrence,
  type StrongToken,
  type StrongVerse
} from "./strongCsv.js";
import { normalizeOriginalStrong } from "./originalSource.js";
import { maximumWeightMatching } from "./maximumWeightMatching.js";
import {
  targetNumberContexts,
  witnessTokenNumberContexts,
  writtenNumbersDiffer,
  type NumberContext
} from "./frenchNumerals.js";
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
  /** Source words (`<ref>#<word number>`) of the supporting witness tags. */
  sourcePositions?: string[];
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
  sourcePositions?: string[];
}

/** A witness clitic matched with a clitic written inside a target word. */
interface GluedCliticCandidate {
  wordIndex: number;
  clitic: string;
  candidate: Candidate;
}

/** A target word carries at most this many Strong numbers with its clitics. */
const MAX_GLUED_STRONGS = 3;

/** Conjunctions that open a verse (« Et », « Or », « Mais ») (K). */
const OPENING_CONJUNCTIONS = new Set([
  "et",
  "or",
  "mais",
  "car",
  "donc",
  "puis"
]);
/** Share of the target verse in which an opening conjunction may be carried. */
const OPENING_SHARE = 0.2;

interface TargetWord {
  wordIndex: number;
  normalized: string;
  /** Clitics written inside the word, in witness spelling (J). */
  clitics: string[];
}

const LOW_CONFIDENCE_THRESHOLD = 0.55;

export function alignVerse(
  targetText: string,
  references: ReferenceSource[],
  lexicon?: StrongLexicon,
  original?: OriginalConstraint,
  matching?: TransferMatchingPolicy
): AlignmentResult {
  const segments = matching?.typographicApostrophes
    ? withTypographicApostrophes(tokenizeText(targetText))
    : tokenizeText(targetText);
  const assignments = new Map<number, AssignedStrong>();
  const words = getTargetWords(segments);
  // A number word matches only inside the same written number (O).
  const numbers = matching?.numeralValues
    ? {
        target: targetNumberContexts(segments),
        words: new Set(words.map((word) => word.normalized))
      }
    : undefined;
  const matchedByReference = references.map((reference) =>
    matchReferenceOccurrences(words, reference, matching, numbers)
  );

  for (const word of words) {
    const candidates: Candidate[] = [];

    for (const { byWord: matched } of matchedByReference) {
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
      const sourcePositions = [
        ...new Set(
          agreeing.flatMap((candidate) => candidate.sourcePositions ?? [])
        )
      ];
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
          : {}),
        ...(sourcePositions.length ? { sourcePositions } : {})
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

  if (matching?.cliticHosts)
    addGluedClitics({
      assignments,
      clitics: matchedByReference.flatMap(({ clitics }) => clitics),
      original,
      witnessLocutions: matching.witnessLocutions === true
    });
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
          ...(members.some((member) => member.sourcePositions)
            ? {
                sourcePositions: [
                  ...new Set(
                    members.flatMap((member) => member.sourcePositions ?? [])
                  )
                ]
              }
            : {}),
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
  matching?: TransferMatchingPolicy,
  numbers?: { target: Array<NumberContext | undefined>; words: Set<string> }
): { byWord: Map<number, Candidate>; clitics: GluedCliticCandidate[] } {
  const tokens = reference.verse?.tokens ?? [];
  const witnessNumbers =
    numbers && reference.verse
      ? witnessTokenNumberContexts(reference.verse.row.text)
      : undefined;
  const numbersDiffer = (sourceIndex: number, wordIndex: number) =>
    numbers !== undefined &&
    witnessNumbers?.length === tokens.length &&
    writtenNumbersDiffer(
      numbers.target[wordIndex],
      witnessNumbers[sourceIndex],
      numbers.words
    );
  const row = reference.verse?.row;
  const sourcePositionsOf = (token: StrongToken) =>
    matching?.witnessPositions && row && token.positions
      ? token.positions.map(
          (position) => `${row.bookId}.${row.chapter}.${row.verse}#${position}`
        )
      : undefined;
  // Without locution transfer, a locution is matched through its head word
  // only, exactly as when the witness tagged that word alone.
  const strongTokens = referenceStrongTokens(reference).filter(
    ({ token }) => matching?.witnessLocutions || representsOccurrence(token)
  );
  const withWitnessFields = (
    candidate: Candidate,
    token: StrongToken
  ): Candidate => {
    const sourcePositions = sourcePositionsOf(token);
    return {
      ...candidate,
      ...(sourcePositions ? { sourcePositions } : {}),
      ...(token.element === undefined
        ? {}
        : {
            locution: `${reference.name}#${token.element}`,
            ...(token.elementHead ? {} : { locutionMember: true })
          })
    };
  };
  // A conjunction opening the witness verse (« Et », « Or ») renders the source
  // word that opens it, not a conjunction the target adds further on (K).
  const opensVerse = (token: StrongToken, sourceIndex: number) =>
    matching?.openingConjunctions === true &&
    sourceIndex === 0 &&
    OPENING_CONJUNCTIONS.has(token.normalized);
  const edges = strongTokens.flatMap(({ token, sourceIndex }, left) =>
    words.flatMap((word) => {
      if (
        opensVerse(token, sourceIndex) &&
        word.wordIndex > OPENING_SHARE * (words.length - 1)
      )
        return [];
      if (numbersDiffer(sourceIndex, word.wordIndex)) return [];
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
          value: withWitnessFields(candidate, token)
        }
      ];
    })
  );

  const matches = maximumWeightMatching({
    leftCount: strongTokens.length,
    rightCount: words.length,
    edges
  });
  const byWord = new Map(matches.map((match) => [match.right, match.value]));
  if (!matching?.cliticHosts) return { byWord, clitics: [] };

  // A witness clitic left over by the word matching (« m’ », « qu’ », « -le »)
  // may be carried by the target word it is glued to: one clitic per slot.
  const used = new Set(matches.map((match) => match.left));
  const slots = words.flatMap((word) =>
    word.clitics.map((clitic) => ({ word, clitic }))
  );
  const cliticEdges = strongTokens.flatMap(({ token, sourceIndex }, left) =>
    used.has(left)
      ? []
      : slots.flatMap(({ word, clitic }, right) =>
          clitic === token.normalized
            ? [
                {
                  left,
                  right,
                  weight:
                    0.9 +
                    positionSimilarity(
                      sourceIndex,
                      tokens.length,
                      word.wordIndex,
                      words.length
                    ) *
                      0.03,
                  value: withWitnessFields(
                    {
                      strong: token.strong,
                      score: 0.9,
                      source: `${reference.name}~glued-clitic`,
                      witnessFamily:
                        reference.family ?? inferWitnessFamily(reference.name),
                      method: "exact"
                    },
                    token
                  )
                }
              ]
            : []
        )
  );
  return {
    byWord,
    clitics: maximumWeightMatching({
      leftCount: strongTokens.length,
      rightCount: slots.length,
      edges: cliticEdges
    }).map((match) => ({
      wordIndex: slots[match.right]!.word.wordIndex,
      clitic: slots[match.right]!.clitic,
      candidate: match.value
    }))
  };
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

export function isConfirmedByOriginal(
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

export function scoreWithOriginal(
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

export function sourceWithOriginal(
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

/**
 * The witnesses write the apostrophe « ’ »: a target word written with « ' »
 * (« aujourd'hui ») is compared in that form. Only the comparison form changes.
 */
export function withTypographicApostrophes(
  segments: TextSegment[]
): TextSegment[] {
  return segments.map((segment) =>
    segment.kind === "word" && segment.text.includes("'")
      ? {
          ...segment,
          normalized: normalizeWord(segment.text.replace(/'/gu, "’"))
        }
      : segment
  );
}

function getTargetWords(segments: TextSegment[]): TargetWord[] {
  const words: TargetWord[] = [];
  for (const segment of segments) {
    if (segment.kind !== "word") continue;
    words.push({
      wordIndex: words.length,
      normalized: segment.normalized,
      clitics: gluedClitics(segment.text)
    });
  }
  return words;
}

/**
 * Clitics that the witnesses tag apart and the target glues to another word
 * (J): « m’ » of « m’avez », « qu’ » of « qu’il », « les » of
 * « Apportez-les-moi ». The target word carries the clitic's Strong number
 * besides its own; the witnesses of one clitic agree as for a word.
 */
function addGluedClitics(options: {
  assignments: Map<number, AssignedStrong>;
  clitics: GluedCliticCandidate[];
  original?: OriginalConstraint;
  witnessLocutions: boolean;
}): void {
  const bySlot = new Map<
    string,
    { wordIndex: number; candidates: Candidate[] }
  >();
  for (const { wordIndex, clitic, candidate } of options.clitics) {
    const key = `${wordIndex}|${clitic}`;
    const slot = bySlot.get(key) ?? { wordIndex, candidates: [] };
    slot.candidates.push(candidate);
    bySlot.set(key, slot);
  }
  for (const { wordIndex, candidates } of bySlot.values()) {
    const chosen = chooseCandidate(candidates);
    if (!chosen) continue;
    const agreeing = candidates.filter(
      (candidate) => candidate.strong.join(" ") === chosen.strong.join(" ")
    );
    const locutions = options.witnessLocutions
      ? agreeing.flatMap((candidate) =>
          candidate.locution ? [candidate.locution] : []
        )
      : [];
    const sourcePositions = [
      ...new Set(
        agreeing.flatMap((candidate) => candidate.sourcePositions ?? [])
      )
    ];
    const existing = options.assignments.get(wordIndex);
    if (!existing) {
      options.assignments.set(wordIndex, {
        strong: chosen.strong,
        confidence: scoreWithOriginal(
          chosen.score,
          chosen.strong,
          options.original
        ),
        source: sourceWithOriginal(
          chosen.source,
          chosen.strong,
          options.original
        ),
        method: chosen.method,
        originalConfirmed: isConfirmedByOriginal(
          chosen.strong,
          options.original
        ),
        ...(locutions.length ? { locutions } : {}),
        ...(agreeing.every((candidate) => candidate.locutionMember)
          ? { locutionMemberOnly: true }
          : {}),
        ...(sourcePositions.length ? { sourcePositions } : {})
      });
      continue;
    }
    // A word kept only for a locution is removed afterwards with its numbers.
    if (existing.locutionMemberOnly) continue;
    const added = chosen.strong.filter(
      (strong) => !existing.strong.includes(strong)
    );
    if (
      !added.length ||
      existing.strong.length + added.length > MAX_GLUED_STRONGS
    )
      continue;
    existing.strong = [...existing.strong, ...added];
    if (sourcePositions.length)
      existing.sourcePositions = [
        ...new Set([...(existing.sourcePositions ?? []), ...sourcePositions])
      ];
    if (locutions.length)
      existing.locutions = [
        ...new Set([...(existing.locutions ?? []), ...locutions])
      ];
  }
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

/** Elided words written glued to the next one (« qu’il », « m’a », « jusqu’à »). */
const ELIDED_PROCLITICS = new Set([
  "c",
  "d",
  "j",
  "l",
  "m",
  "n",
  "qu",
  "s",
  "t",
  "jusqu",
  "lorsqu",
  "puisqu",
  "quoiqu"
]);

/**
 * Clitics written inside one target word, in witness spelling: an elided word
 * before the apostrophe (« qu’il » → « qu ») and the pronouns joined by
 * hyphens after the host (« apportez-les-moi » → « moi », « les »). The
 * euphonic « t » and « ci » carry nothing.
 */
export function gluedClitics(text: string): string[] {
  const word = text
    .toLocaleLowerCase("fr-FR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[‐‑‒–—]/gu, "-");
  const clitics: string[] = [];
  const elided = /^(\p{L}+)[’'](?=\p{L})/u.exec(word);
  if (elided && ELIDED_PROCLITICS.has(elided[1]!)) clitics.push(elided[1]!);
  const parts = word.split("-");
  for (
    let end = parts.length - 1;
    end > 0 && FRENCH_ENCLITICS.has(parts[end]!);
    end -= 1
  )
    if (parts[end] !== "t" && parts[end] !== "ci") clitics.push(parts[end]!);
  return clitics;
}

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
