import { createRequire } from "node:module";

import { parseStrongBibleMarkup } from "./strongBibleSqlite.js";

interface WinkTaggedToken {
  value: string;
  normal: string;
  pos: string;
  lemma?: string;
}

interface WinkPosTagger {
  tagSentence(source: string): WinkTaggedToken[];
}

interface WinkLemmatizer {
  noun(source: string): string;
}

interface PositionedToken extends WinkTaggedToken {
  startOffset: number;
  endOffset: number;
  partOfSpeech?: string;
}

export interface EnglishStrongLemmaProjection {
  text: string;
  occurrenceCount: number;
  lexemeAssignmentCount: number;
  lexemes: ReadonlySet<string>;
}

const require = createRequire(import.meta.url);
const createPosTagger = require("wink-pos-tagger") as () => WinkPosTagger;
const lemmatize = require("wink-lemmatizer") as WinkLemmatizer;
const posTagger = createPosTagger();

const AUXILIARY_LEMMAS = new Set([
  "be",
  "can",
  "do",
  "have",
  "may",
  "must",
  "shall",
  "will"
]);

export function enrichEnglishStrongMarkup(
  source: string
): EnglishStrongLemmaProjection {
  const parsed = parseStrongBibleMarkup(source);
  if (parsed.occurrences.length === 0) {
    return {
      text: source,
      occurrenceCount: 0,
      lexemeAssignmentCount: 0,
      lexemes: new Set()
    };
  }

  const tokens = positionTokens(
    parsed.canonicalText,
    posTagger.tagSentence(parsed.canonicalText)
  );
  const lexemes = new Set<string>();
  const assignments = parsed.occurrences.map((occurrence) => {
    if (occurrence.startOffset === occurrence.endOffset) return undefined;
    let overlapping = tokens.filter(
      (token) =>
        token.partOfSpeech &&
        token.startOffset < occurrence.endOffset &&
        token.endOffset > occurrence.startOffset
    );
    if (
      overlapping.some(
        (token) =>
          token.startOffset < occurrence.startOffset ||
          token.endOffset > occurrence.endOffset
      )
    ) {
      const occurrenceText = parsed.canonicalText.slice(
        occurrence.startOffset,
        occurrence.endOffset
      );
      overlapping = positionTokens(
        occurrenceText,
        posTagger.tagSentence(occurrenceText)
      );
    }
    const head = chooseHead(overlapping);
    if (!head?.partOfSpeech) return undefined;
    const lemma = normalizeLemma(head.lemma ?? head.normal ?? head.value);
    if (!lemma) return undefined;
    lexemes.add(`${lemma}\u0000${head.partOfSpeech}`);
    return { lemma, partOfSpeech: head.partOfSpeech };
  });

  let occurrenceOrdinal = 0;
  const text = source.replace(/<w\b([^>]*)>/gu, (openingTag, attributes) => {
    const assignment = assignments[occurrenceOrdinal++];
    if (!assignment) return openingTag;
    if (/\s(?:lemma|pos)\s*=/iu.test(attributes)) {
      throw new Error("english-strong-lexeme-already-present");
    }
    return `<w${attributes} lemma="${escapeAttribute(
      assignment.lemma
    )}" pos="${escapeAttribute(assignment.partOfSpeech)}">`;
  });
  if (occurrenceOrdinal !== parsed.occurrences.length) {
    throw new Error("english-strong-lexeme-occurrence-count-mismatch");
  }

  return {
    text,
    occurrenceCount: parsed.occurrences.length,
    lexemeAssignmentCount: assignments.filter(Boolean).length,
    lexemes
  };
}

function positionTokens(
  source: string,
  tokens: WinkTaggedToken[]
): PositionedToken[] {
  const positioned: PositionedToken[] = [];
  let cursor = 0;
  for (const token of tokens) {
    const startOffset = source.indexOf(token.value, cursor);
    if (startOffset < 0) {
      throw new Error(
        `english-strong-token-alignment-failed:${JSON.stringify(
          token.value
        )}:${JSON.stringify(source.slice(cursor, cursor + 80))}`
      );
    }
    const endOffset = startOffset + token.value.length;
    positioned.push({
      ...token,
      startOffset,
      endOffset,
      partOfSpeech: mapPartOfSpeech(token.pos)
    });
    cursor = endOffset;
  }
  return positioned;
}

function chooseHead(tokens: PositionedToken[]): PositionedToken | undefined {
  if (tokens.length <= 1) return tokens[0];

  const nominalized = nominalizedHead(tokens);
  if (nominalized) return nominalized;

  const verbs = tokens.filter((token, index) => {
    if (token.partOfSpeech !== "verb") return false;
    if (isAttributiveParticiple(tokens, index)) return false;
    return !AUXILIARY_LEMMAS.has(normalizeLemma(token.lemma ?? token.normal));
  });
  if (verbs.length > 0) return verbs.at(-1);

  for (const partOfSpeech of [
    "noun",
    "name",
    "verb",
    "adj",
    "adv",
    "pron",
    "num",
    "intj",
    "prep",
    "particle",
    "conj",
    "det"
  ]) {
    const candidates = tokens.filter(
      (token) => token.partOfSpeech === partOfSpeech
    );
    if (candidates.length > 0) return candidates.at(-1);
  }
  return tokens.at(-1);
}

function isAttributiveParticiple(
  tokens: PositionedToken[],
  index: number
): boolean {
  const token = tokens[index]!;
  return (
    (token.pos === "VBG" || token.pos === "VBN") &&
    tokens
      .slice(index + 1)
      .some(
        (candidate) =>
          candidate.partOfSpeech === "noun" || candidate.partOfSpeech === "name"
      )
  );
}

function nominalizedHead(
  tokens: PositionedToken[]
): PositionedToken | undefined {
  const last = tokens.at(-1);
  if (!last) return undefined;
  const hasDeterminer = tokens
    .slice(0, -1)
    .some((token) => token.partOfSpeech === "det");
  if (!hasDeterminer) return undefined;
  if (last.pos === "VBG" || last.pos === "VBN") {
    return {
      ...last,
      lemma: lemmatize.noun(last.value),
      partOfSpeech: "noun"
    };
  }
  if (last.partOfSpeech === "adj") {
    return { ...last, lemma: last.normal, partOfSpeech: "noun" };
  }
  return undefined;
}

function mapPartOfSpeech(pos: string): string | undefined {
  if (pos === "CC") return "conj";
  if (pos === "CD") return "num";
  if (pos === "DT" || pos === "PDT" || pos === "WDT") return "det";
  if (pos === "EX") return "particle";
  if (pos === "FW") return "foreign";
  if (pos === "IN") return "prep";
  if (pos.startsWith("JJ")) return "adj";
  if (pos === "LS") return "num";
  if (pos === "MD" || pos.startsWith("VB")) return "verb";
  if (pos === "NNP" || pos === "NNPS") return "name";
  if (pos === "NN" || pos === "NNS") return "noun";
  if (pos === "POS" || pos === "RP" || pos === "TO") return "particle";
  if (pos === "PRP" || pos === "PRP$" || pos === "WP" || pos === "WP$") {
    return "pron";
  }
  if (pos.startsWith("RB") || pos === "WRB") return "adv";
  if (pos === "UH") return "intj";
  return undefined;
}

function normalizeLemma(value: string): string {
  return value.trim().toLocaleLowerCase("en").normalize("NFC");
}

function escapeAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
