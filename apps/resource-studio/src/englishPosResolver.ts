import { createRequire } from "node:module";

export const ENGLISH_POS_RESOLVER_POLICY = "english-wordnet-context-pos@8";

export type EnglishDictionaryPartOfSpeech = "noun" | "verb" | "adj" | "adv";

export interface EnglishWordToken {
  value: string;
  normalized: string;
  startOffset: number;
  endOffset: number;
}

export interface EnglishSpanAnalysis {
  surface: string;
  head?: EnglishWordToken;
  previous?: EnglishWordToken;
  next?: EnglishWordToken;
  candidates: EnglishDictionaryPartOfSpeech[];
  contextualPartOfSpeech?: string;
  evidence: string[];
}

export interface EnglishPosResolution extends EnglishSpanAnalysis {
  partOfSpeech: string;
  method: "dictionary-single-pos" | "dictionary-context" | "contextual-tagger";
  confidence: number;
  margin: number;
  lowMargin: boolean;
}

interface WinkLexicon {
  wnWords: Record<string, number | undefined>;
  wnWordSenses: Record<number, number[] | undefined>;
}

interface WinkLemmatizer {
  noun(value: string): string;
  verb(value: string): string;
  adjective(value: string): string;
}

interface WinkTaggedToken {
  value: string;
  normal: string;
  pos: string;
}

interface WinkPosTagger {
  tagSentence(value: string): WinkTaggedToken[];
}

const require = createRequire(import.meta.url);
const winkLexicon = require("wink-lexicon") as WinkLexicon;
const lemmatize = require("wink-lemmatizer") as WinkLemmatizer;
const posTagger = (require("wink-pos-tagger") as () => WinkPosTagger)();
let lastTaggedVerse:
  | {
      text: string;
      tokens: Array<
        WinkTaggedToken & { startOffset: number; endOffset: number }
      >;
    }
  | undefined;

const DETERMINERS = new Set([
  "a",
  "an",
  "another",
  "any",
  "each",
  "either",
  "every",
  "few",
  "many",
  "much",
  "neither",
  "no",
  "some",
  "the",
  "these",
  "this",
  "those"
]);
const POSSESSIVES = new Set([
  "her",
  "his",
  "its",
  "mine",
  "my",
  "our",
  "ours",
  "their",
  "theirs",
  "thine",
  "thy",
  "your",
  "yours"
]);
const SUBJECT_PRONOUNS = new Set([
  "he",
  "i",
  "it",
  "she",
  "they",
  "thou",
  "we",
  "ye",
  "you"
]);
const MODALS_AND_AUXILIARIES = new Set([
  "am",
  "are",
  "be",
  "been",
  "being",
  "can",
  "could",
  "did",
  "do",
  "does",
  "had",
  "has",
  "have",
  "is",
  "may",
  "might",
  "must",
  "shall",
  "should",
  "was",
  "were",
  "will",
  "would"
]);
const OPEN_CLASS_PARTS_OF_SPEECH = new Set([
  "adj",
  "adv",
  "name",
  "noun",
  "verb"
]);

export function resolveEnglishPartOfSpeech(options: {
  verseText: string;
  startOffset: number;
  length: number;
  lemma: string;
  currentPartOfSpeech: string;
  sourcePartOfSpeech?: string;
}): EnglishPosResolution {
  const analysis = analyzeEnglishSpan(options);
  const scores = new Map<string, number>(
    analysis.candidates.map((partOfSpeech) => [partOfSpeech, 1])
  );
  const evidence = [...analysis.evidence];
  if (!OPEN_CLASS_PARTS_OF_SPEECH.has(options.currentPartOfSpeech)) {
    evidence.push(`closed-class-retain:${options.currentPartOfSpeech}`);
    return {
      ...analysis,
      evidence,
      partOfSpeech: options.currentPartOfSpeech,
      method: "contextual-tagger",
      confidence: 1,
      margin: 10,
      lowMargin: false
    };
  }
  if (
    options.currentPartOfSpeech !== "name" &&
    analysis.contextualPartOfSpeech === options.currentPartOfSpeech
  ) {
    evidence.push(`contextual-tagger-retain:${options.currentPartOfSpeech}`);
    return {
      ...analysis,
      evidence,
      partOfSpeech: options.currentPartOfSpeech,
      method: "contextual-tagger",
      confidence: 1,
      margin: 10,
      lowMargin: false
    };
  }
  if (
    options.currentPartOfSpeech === "name" &&
    normalizeEnglishWord(options.lemma) === "s"
  ) {
    evidence.push("possessive-clitic:particle");
    return {
      ...analysis,
      evidence,
      partOfSpeech: "particle",
      method: "contextual-tagger",
      confidence: 1,
      margin: 10,
      lowMargin: false
    };
  }
  const lowercaseCurrentName =
    options.currentPartOfSpeech === "name" &&
    analysis.head !== undefined &&
    !isCapitalizedLemmaHead(analysis, options.lemma);
  if (lowercaseCurrentName) {
    const curatedFallback = classifyArchaicLowercaseName(
      normalizeEnglishWord(options.lemma)
    );
    const sourceFallback =
      options.sourcePartOfSpeech && options.sourcePartOfSpeech !== "name"
        ? options.sourcePartOfSpeech
        : undefined;
    const partOfSpeech =
      curatedFallback ??
      sourceFallback ??
      (analysis.candidates.length === 0 ? "noun" : undefined);
    if (partOfSpeech) {
      evidence.push(
        curatedFallback
          ? `lowercase-name-curated-fallback:${partOfSpeech}`
          : sourceFallback
            ? `lowercase-name-source-fallback:${sourceFallback}`
            : `lowercase-name-default-fallback:${partOfSpeech}`
      );
      return {
        ...analysis,
        evidence,
        partOfSpeech,
        method: "contextual-tagger",
        confidence: sourceFallback || curatedFallback ? 0.95 : 0.5,
        margin: sourceFallback || curatedFallback ? 5 : 0,
        lowMargin: !sourceFallback && !curatedFallback
      };
    }
  }
  if (analysis.candidates.length === 0) {
    return {
      ...analysis,
      partOfSpeech: options.currentPartOfSpeech,
      method: "contextual-tagger",
      confidence: 0.5,
      margin: 0,
      lowMargin: true
    };
  }
  if (
    options.currentPartOfSpeech === "name" &&
    analysis.head &&
    isCapitalizedLemmaHead(analysis, options.lemma) &&
    (options.sourcePartOfSpeech === "name" ||
      analysis.candidates.includes("noun") ||
      isCapitalizedHyphenatedSurface(analysis))
  ) {
    evidence.push("capitalized-name-retain");
    return {
      ...analysis,
      evidence,
      partOfSpeech: "name",
      method: "contextual-tagger",
      confidence: 1,
      margin: 10,
      lowMargin: false
    };
  }
  if (
    options.currentPartOfSpeech === "name" &&
    analysis.head &&
    !/^[\p{Lu}]/u.test(analysis.head.value) &&
    options.sourcePartOfSpeech &&
    analysis.candidates.includes(
      options.sourcePartOfSpeech as EnglishDictionaryPartOfSpeech
    )
  ) {
    evidence.push(`lowercase-name-step-pos:${options.sourcePartOfSpeech}`);
    return {
      ...analysis,
      evidence,
      partOfSpeech: options.sourcePartOfSpeech,
      method: "dictionary-context",
      confidence: 0.95,
      margin: 5,
      lowMargin: false
    };
  }
  if (analysis.candidates.length === 1) {
    const partOfSpeech = analysis.candidates[0]!;
    if (
      analysis.contextualPartOfSpeech &&
      analysis.contextualPartOfSpeech !== partOfSpeech &&
      options.currentPartOfSpeech !== "name"
    ) {
      evidence.push(
        `single-pos-tagger-conflict-retain:${partOfSpeech}:${analysis.contextualPartOfSpeech}`
      );
      return {
        ...analysis,
        evidence,
        partOfSpeech: options.currentPartOfSpeech,
        method: "contextual-tagger",
        confidence: 0.5,
        margin: 0,
        lowMargin: true
      };
    }
    evidence.push(`wordnet-single-pos:${partOfSpeech}`);
    return {
      ...analysis,
      evidence,
      partOfSpeech,
      method: "dictionary-single-pos",
      confidence: 1,
      margin: 10,
      lowMargin: false
    };
  }
  if (
    options.currentPartOfSpeech === "name" &&
    analysis.head &&
    !/^[\p{Lu}]/u.test(analysis.head.value) &&
    scores.has("noun")
  ) {
    addScore(scores, "noun", 4);
    evidence.push("lowercase-name-common-noun");
  }

  if (scores.has(options.currentPartOfSpeech)) {
    addScore(scores, options.currentPartOfSpeech, 2);
    evidence.push(`current-pos:${options.currentPartOfSpeech}`);
  }
  if (options.sourcePartOfSpeech && scores.has(options.sourcePartOfSpeech)) {
    addScore(scores, options.sourcePartOfSpeech, 4);
    evidence.push(`step-pos:${options.sourcePartOfSpeech}`);
  }
  if (
    analysis.contextualPartOfSpeech &&
    scores.has(analysis.contextualPartOfSpeech)
  ) {
    addScore(scores, analysis.contextualPartOfSpeech, 6);
    evidence.push(`contextual-tagger-pos:${analysis.contextualPartOfSpeech}`);
  }

  const previous = analysis.previous?.normalized;
  const next = analysis.next?.normalized;
  const head = analysis.head?.normalized;
  if (previous && (DETERMINERS.has(previous) || POSSESSIVES.has(previous))) {
    if (scores.has("noun")) {
      addScore(scores, "noun", 5);
      evidence.push(`previous-nominal-marker:${previous}`);
    }
  }
  if (previous === "to" && scores.has("verb")) {
    addScore(scores, "verb", 5);
    evidence.push("previous-infinitive-marker:to");
  }
  if (
    previous &&
    (MODALS_AND_AUXILIARIES.has(previous) || SUBJECT_PRONOUNS.has(previous)) &&
    scores.has("verb")
  ) {
    addScore(scores, "verb", 5);
    evidence.push(`previous-verbal-marker:${previous}`);
  }
  if (head && /(?:ed|eth|est|ing)$/u.test(head) && scores.has("verb")) {
    addScore(scores, "verb", 3);
    evidence.push(`verbal-inflection:${head}`);
  }
  if (
    head &&
    isNounPlural(head, options.lemma) &&
    scores.has("noun") &&
    !(previous && SUBJECT_PRONOUNS.has(previous))
  ) {
    addScore(scores, "noun", 3);
    evidence.push(`nominal-plural:${head}`);
  }
  if (
    scores.has("adj") &&
    next &&
    !DETERMINERS.has(next) &&
    analysis.next &&
    /^[\p{L}\p{M}]/u.test(analysis.next.value)
  ) {
    addScore(scores, "adj", 1);
    evidence.push(`possible-attributive-adjective-before:${next}`);
  }

  const ranked = [...scores.entries()].sort(
    ([leftPos, leftScore], [rightPos, rightScore]) =>
      rightScore - leftScore || leftPos.localeCompare(rightPos)
  );
  const winner = ranked[0]!;
  const runnerUp = ranked[1];
  const margin = winner[1] - (runnerUp?.[1] ?? 0);
  if (margin < 4 && scores.has(options.currentPartOfSpeech)) {
    evidence.push(`low-margin-retain-current:${margin}`);
    return {
      ...analysis,
      evidence,
      partOfSpeech: options.currentPartOfSpeech,
      method: "contextual-tagger",
      confidence: 0.5,
      margin,
      lowMargin: true
    };
  }
  evidence.push(`dictionary-context-winner:${winner[0]}:${margin}`);
  return {
    ...analysis,
    evidence,
    partOfSpeech: winner[0],
    method: "dictionary-context",
    confidence: margin >= 5 ? 1 : 0.95,
    margin,
    lowMargin: margin < 4
  };
}

export function analyzeEnglishSpan(options: {
  verseText: string;
  startOffset: number;
  length: number;
  lemma: string;
}): EnglishSpanAnalysis {
  const tokens = tokenizeEnglishWords(options.verseText);
  const spanEnd = options.startOffset + options.length;
  const surface = options.verseText.slice(options.startOffset, spanEnd);
  const overlapping = tokens.filter(
    (token) =>
      token.startOffset < spanEnd && token.endOffset > options.startOffset
  );
  const normalizedLemma = normalizeEnglishWord(options.lemma);
  const surfaceTokens = tokenizeEnglishWords(surface).map((token) => ({
    ...token,
    startOffset: token.startOffset + options.startOffset,
    endOffset: token.endOffset + options.startOffset
  }));
  const head =
    overlapping.find((token) =>
      tokenMatchesLemma(token.normalized, normalizedLemma)
    ) ??
    surfaceTokens.find((token) =>
      tokenMatchesLemma(token.normalized, normalizedLemma)
    ) ??
    overlapping.at(-1);
  const headIndex = head
    ? tokens.findIndex(
        (token) =>
          token.startOffset === head.startOffset &&
          token.endOffset === head.endOffset
      )
    : -1;
  const previous = headIndex > 0 ? tokens[headIndex - 1] : undefined;
  const next =
    headIndex >= 0 && headIndex + 1 < tokens.length
      ? tokens[headIndex + 1]
      : undefined;
  const candidates = dictionaryCandidates(
    head?.normalized ?? normalizedLemma,
    normalizedLemma
  );
  const contextualPartOfSpeech = head
    ? contextualTaggerPartOfSpeech(
        options.verseText,
        options.startOffset,
        spanEnd,
        head
      )
    : undefined;
  return {
    surface,
    ...(head ? { head } : {}),
    ...(previous ? { previous } : {}),
    ...(next ? { next } : {}),
    candidates,
    ...(contextualPartOfSpeech ? { contextualPartOfSpeech } : {}),
    evidence: [
      `surface:${surface}`,
      ...(head ? [`head:${head.value}`] : ["head:missing"]),
      `wordnet-candidates:${candidates.join(",") || "none"}`,
      ...(contextualPartOfSpeech
        ? [`contextual-tagger:${contextualPartOfSpeech}`]
        : [])
    ]
  };
}

function contextualTaggerPartOfSpeech(
  verseText: string,
  startOffset: number,
  endOffset: number,
  head: EnglishWordToken
): string | undefined {
  if (lastTaggedVerse?.text !== verseText) {
    let cursor = 0;
    const tokens = posTagger.tagSentence(verseText).map((token) => {
      const located = verseText.indexOf(token.value, cursor);
      const tokenStart = located >= 0 ? located : cursor;
      const tokenEnd = tokenStart + token.value.length;
      cursor = tokenEnd;
      return {
        ...token,
        startOffset: tokenStart,
        endOffset: tokenEnd
      };
    });
    lastTaggedVerse = { text: verseText, tokens };
  }
  const taggedIndex = lastTaggedVerse.tokens.findIndex(
    (token) =>
      token.startOffset < endOffset &&
      token.endOffset > startOffset &&
      normalizeEnglishWord(token.normal) === head.normalized
  );
  const tagged =
    taggedIndex >= 0 ? lastTaggedVerse.tokens[taggedIndex] : undefined;
  if (!tagged) return undefined;
  if (/^NNP/u.test(tagged.pos)) return "name";
  if (/^NN/u.test(tagged.pos)) return "noun";
  if (
    /^(?:VBN|VBG)$/u.test(tagged.pos) &&
    /^(?:DT|PRP\\$)$/u.test(lastTaggedVerse.tokens[taggedIndex - 1]?.pos ?? "")
  ) {
    return "adj";
  }
  if (/^(?:VB|MD)/u.test(tagged.pos)) return "verb";
  if (/^JJ/u.test(tagged.pos)) return "adj";
  if (/^(?:RB|WRB)/u.test(tagged.pos)) return "adv";
  return undefined;
}

function classifyArchaicLowercaseName(lemma: string): string | undefined {
  if (new Set(["thee", "thine", "thou", "thy", "thyself", "ye"]).has(lemma)) {
    return "pron";
  }
  if (new Set(["thereinto", "thereunto", "unto", "whereunto"]).has(lemma)) {
    return "prep";
  }
  if (
    new Set([
      "alway",
      "forasmuch",
      "fro",
      "thereat",
      "throughly",
      "whereby",
      "wherein",
      "whereof",
      "wherewith",
      "whilst"
    ]).has(lemma)
  ) {
    return "adv";
  }
  if (lemma === "lest") return "conj";
  if (lemma === "whosoever") return "pron";
  if (lemma === "lo") return "interj";
  if (lemma === "s") return "particle";
  if (
    /(?:eth|edst|est)$/u.test(lemma) ||
    new Set([
      "cannot",
      "doth",
      "fetcht",
      "hast",
      "hath",
      "holden",
      "saith",
      "shalt",
      "spake",
      "stablished",
      "wist",
      "wot",
      "wotteth"
    ]).has(lemma)
  ) {
    return "verb";
  }
  return undefined;
}

export function dictionaryCandidates(
  normalizedSurface: string,
  normalizedLemma: string
): EnglishDictionaryPartOfSpeech[] {
  const surface = normalizeEnglishWord(normalizedSurface);
  const lemma = normalizeEnglishWord(normalizedLemma);
  const forms = new Set([surface, lemma]);
  const candidates = new Set<EnglishDictionaryPartOfSpeech>();
  for (const form of forms) {
    const wordIndex = winkLexicon.wnWords[form];
    if (wordIndex === undefined) continue;
    const senses = winkLexicon.wnWordSenses[wordIndex] ?? [];
    for (const sense of senses) {
      if (sense === 0 || sense === 1 || sense === 44) {
        candidates.add("adj");
      } else if (sense === 2) {
        candidates.add("adv");
      } else if (sense >= 3 && sense <= 28) {
        candidates.add("noun");
      } else if (sense >= 29 && sense <= 43) {
        candidates.add("verb");
      }
    }
  }
  const nounBase = normalizeEnglishWord(lemmatize.noun(surface));
  const verbBase = normalizeEnglishWord(lemmatize.verb(surface));
  const adjectiveBase = normalizeEnglishWord(lemmatize.adjective(surface));
  if (nounBase !== surface) {
    if (nounBase === lemma || wordHasPartOfSpeech(nounBase, "noun")) {
      candidates.add("noun");
    }
  }
  if (verbBase !== surface) {
    if (verbBase === lemma || wordHasPartOfSpeech(verbBase, "verb")) {
      candidates.add("verb");
    }
  }
  if (adjectiveBase !== surface) {
    if (adjectiveBase === lemma || wordHasPartOfSpeech(adjectiveBase, "adj")) {
      candidates.add("adj");
    }
  }
  return [...candidates].sort();
}

function wordHasPartOfSpeech(
  value: string,
  partOfSpeech: EnglishDictionaryPartOfSpeech
): boolean {
  const wordIndex = winkLexicon.wnWords[value];
  if (wordIndex === undefined) return false;
  return (winkLexicon.wnWordSenses[wordIndex] ?? []).some((sense) => {
    if (partOfSpeech === "adj") {
      return sense === 0 || sense === 1 || sense === 44;
    }
    if (partOfSpeech === "adv") return sense === 2;
    if (partOfSpeech === "noun") return sense >= 3 && sense <= 28;
    return sense >= 29 && sense <= 43;
  });
}

export function tokenizeEnglishWords(value: string): EnglishWordToken[] {
  const tokens: EnglishWordToken[] = [];
  const pattern = /\p{L}[\p{L}\p{M}]*(?:[’']\p{L}[\p{L}\p{M}]*)*/gu;
  for (const match of value.matchAll(pattern)) {
    const startOffset = match.index;
    const token = match[0];
    tokens.push({
      value: token,
      normalized: normalizeEnglishWord(token).replace(/[’']s$/u, ""),
      startOffset,
      endOffset: startOffset + token.length
    });
  }
  return tokens;
}

export function isCapitalizedLemmaHead(
  analysis: EnglishSpanAnalysis,
  lemma: string
): boolean {
  if (!analysis.head) return false;
  const normalizedLemma = normalizeEnglishWord(lemma);
  if (
    /^\p{Lu}/u.test(analysis.head.value.normalize("NFC")) &&
    (tokenMatchesLemma(analysis.head.normalized, normalizedLemma) ||
      normalizedLemma.length === 1)
  ) {
    return true;
  }
  return (
    analysis.contextualPartOfSpeech === "name" &&
    isCapitalizedHyphenatedSurface(analysis)
  );
}

function isCapitalizedHyphenatedSurface(
  analysis: EnglishSpanAnalysis
): boolean {
  return /\p{Lu}[\p{L}\p{M}]*(?:[-‑–—]\p{L}[\p{L}\p{M}]*)+/u.test(
    analysis.surface.normalize("NFC")
  );
}

export function normalizeEnglishWord(value: string): string {
  return value.trim().toLocaleLowerCase("en").normalize("NFC");
}

function tokenMatchesLemma(token: string, lemma: string): boolean {
  if (token === lemma) return true;
  return (
    lemmatize.noun(token) === lemma ||
    lemmatize.verb(token) === lemma ||
    lemmatize.adjective(token) === lemma
  );
}

function isNounPlural(surface: string, lemma: string): boolean {
  return surface !== lemma && lemmatize.noun(surface) === lemma;
}

function addScore(
  scores: Map<string, number>,
  partOfSpeech: string,
  amount: number
): void {
  scores.set(partOfSpeech, (scores.get(partOfSpeech) ?? 0) + amount);
}
