/**
 * French numbers as written in Bibles (O): « 4600 », « 180'000 », « 4 600 »,
 * « cent quatre-vingt mille », « trente-trois », « vingt-quatrième », « 24e ».
 * A strict grammar reads a written number as one value; consecutive number
 * words joined by spaces, hyphens or « et » (« mille et cent ») form one
 * written number, and a word belongs to the number it is written in: the
 * « dix » of « dix mille » is not the number 10.
 */
import { stripTags, tokenizeText, type TextSegment } from "./tokenize.js";

export interface FrenchNumeral {
  value: number;
  ordinal: boolean;
  /** Written in digits (« 4600 », « 180'000 », « 4 600 », « 24e »). */
  digits: boolean;
}

const UNIT_WORDS: Record<string, number> = {
  un: 1,
  une: 1,
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
  six: 6,
  sept: 7,
  huit: 8,
  neuf: 9,
  dix: 10,
  onze: 11,
  douze: 12,
  treize: 13,
  quatorze: 14,
  quinze: 15,
  seize: 16
};
const TENS_WORDS: Record<string, number> = {
  vingt: 20,
  trente: 30,
  quarante: 40,
  cinquante: 50,
  soixante: 60
};
/** « -ième » ordinals and the cardinal word they are built on. */
const ORDINAL_WORDS: Record<string, string> = {
  unieme: "un",
  deuxieme: "deux",
  troisieme: "trois",
  quatrieme: "quatre",
  cinquieme: "cinq",
  sixieme: "six",
  septieme: "sept",
  huitieme: "huit",
  neuvieme: "neuf",
  dixieme: "dix",
  onzieme: "onze",
  douzieme: "douze",
  treizieme: "treize",
  quatorzieme: "quatorze",
  quinzieme: "quinze",
  seizieme: "seize",
  vingtieme: "vingt",
  trentieme: "trente",
  quarantieme: "quarante",
  cinquantieme: "cinquante",
  soixantieme: "soixante",
  centieme: "cent",
  millieme: "mille",
  millionieme: "million"
};
const STANDALONE_ORDINALS: Record<string, number> = {
  premier: 1,
  premiere: 1,
  second: 2,
  seconde: 2
};
const SCALE_WORDS = new Set(["cent", "cents", "mille", "million", "millions"]);

/** Every spelling of 1–99 in traditional French, as space-joined words. */
const BELOW_HUNDRED = (() => {
  const forms = new Map<string, number>();
  const units = Object.entries(UNIT_WORDS);
  for (const [word, value] of units) forms.set(word, value);
  for (const unit of ["sept", "huit", "neuf"])
    forms.set(`dix ${unit}`, 10 + UNIT_WORDS[unit]!);
  for (const [tens, value] of Object.entries(TENS_WORDS)) {
    forms.set(tens, value);
    forms.set(`${tens} et un`, value + 1);
    forms.set(`${tens} et une`, value + 1);
    for (const [unit, unitValue] of units)
      if (unitValue >= 2 && unitValue <= 9)
        forms.set(`${tens} ${unit}`, value + unitValue);
  }
  // soixante-dix … soixante-dix-neuf
  forms.set("soixante dix", 70);
  forms.set("soixante et onze", 71);
  for (const [unit, unitValue] of units)
    if (unitValue >= 12 && unitValue <= 16)
      forms.set(`soixante ${unit}`, 60 + unitValue);
  for (const unit of ["sept", "huit", "neuf"])
    forms.set(`soixante dix ${unit}`, 70 + UNIT_WORDS[unit]!);
  // quatre-vingt(s) … quatre-vingt-dix-neuf
  forms.set("quatre vingts", 80);
  forms.set("quatre vingt", 80);
  for (const [unit, unitValue] of units)
    forms.set(`quatre vingt ${unit}`, 80 + unitValue);
  forms.set("quatre vingt dix", 90);
  for (const unit of ["sept", "huit", "neuf"])
    forms.set(`quatre vingt dix ${unit}`, 90 + UNIT_WORDS[unit]!);
  return forms;
})();

export function foldWord(word: string): string {
  return word
    .toLocaleLowerCase("fr-FR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[‐‑‒–—]/gu, "-");
}

/**
 * Value of a French number written in digits or in words: « 4600 »,
 * « 180'000 », « 4 600 », « 24e », « 1er », « trente-trois »,
 * « cent quatre-vingt mille », « mille et cent », « vingt-quatrième ».
 * Anything else, including two numbers side by side (« deux et deux »), a
 * fraction (« trois dixièmes ») or « second-premier », is undefined.
 */
export function parseFrenchNumeral(text: string): FrenchNumeral | undefined {
  const folded = foldWord(text.trim());
  const digits =
    /^(\d{1,3}(?:[\s\u00a0\u202f\u2009'’]\d{3})+|\d+)(e|eme|er|ere|re)?$/u.exec(
      folded
    );
  if (digits) {
    const value = Number(digits[1]!.replace(/\D/gu, ""));
    if (!Number.isSafeInteger(value) || value <= 0) return undefined;
    // « 1er », « 2e »: « -er » names the first only.
    const suffix = digits[2];
    if (suffix && /^(er|ere|re)$/u.test(suffix) && value !== 1)
      return undefined;
    return { value, ordinal: Boolean(suffix), digits: true };
  }
  const words = folded.split(/[\s\u00a0\u202f\u2009-]+/u).filter(Boolean);
  if (!words.length || words.some((word) => /\d/u.test(word))) return undefined;
  const standalone = STANDALONE_ORDINALS[words[0]!];
  if (words.length === 1 && standalone !== undefined)
    return { value: standalone, ordinal: true, digits: false };
  const ordinalBase = ORDINAL_WORDS[words.at(-1)!];
  // « unième » only ends a compound (« vingt et unième »).
  if (ordinalBase === "un" && words.length === 1) return undefined;
  const value = parseCardinalWords(
    ordinalBase ? [...words.slice(0, -1), ordinalBase] : words
  );
  return value === undefined
    ? undefined
    : { value, ordinal: ordinalBase !== undefined, digits: false };
}

/** Strict French cardinal grammar over folded words; undefined unless every word is used. */
function parseCardinalWords(words: string[]): number | undefined {
  let index = 0;
  const below100 = (): number | undefined => {
    for (
      let length = Math.min(4, words.length - index);
      length > 0;
      length -= 1
    ) {
      const value = BELOW_HUNDRED.get(
        words.slice(index, index + length).join(" ")
      );
      if (value !== undefined) {
        index += length;
        return value;
      }
    }
    return undefined;
  };
  const optionalBelow100 = (): number => {
    const start = index;
    const value = below100();
    if (value === undefined) index = start;
    return value ?? 0;
  };
  const below1000 = (): number | undefined => {
    const multiplier = UNIT_WORDS[words[index] ?? ""];
    if (
      multiplier !== undefined &&
      multiplier >= 2 &&
      multiplier <= 9 &&
      (words[index + 1] === "cent" || words[index + 1] === "cents")
    ) {
      index += 2;
      return multiplier * 100 + optionalBelow100();
    }
    if (words[index] === "cent") {
      index += 1;
      return 100 + optionalBelow100();
    }
    return below100();
  };
  const optionalEt = () => {
    if (words[index] === "et" && index + 1 < words.length) index += 1;
  };

  let total = 0;
  {
    const start = index;
    const count = below1000();
    if (
      count !== undefined &&
      (words[index] === "million" || words[index] === "millions")
    ) {
      index += 1;
      total += count * 1_000_000;
      optionalEt();
    } else index = start;
  }
  {
    // « mille », « deux mille », « cent quatre-vingt mille »
    const start = index;
    const count = words[index] === "mille" ? 1 : below1000();
    if (
      count !== undefined &&
      (count > 1 || words[start] === "mille") &&
      words[index] === "mille"
    ) {
      index += 1;
      total += count * 1000;
      optionalEt();
    } else index = start;
  }
  if (index < words.length) {
    const rest = below1000();
    if (rest === undefined) return undefined;
    total += rest;
  }
  if (index !== words.length || total <= 0) return undefined;
  return total;
}

/** Whether one word (« vingt-quatrième », « 600 », « 180'000 ») may belong to a written number. */
export function isNumberWord(folded: string): boolean {
  if (/^\d+(?:['’]\d{3})*(?:e|eme|er|ere|re)?$/u.test(folded)) return true;
  return folded
    .split("-")
    .every(
      (part) =>
        part in UNIT_WORDS ||
        part in TENS_WORDS ||
        part in ORDINAL_WORDS ||
        part in STANDALONE_ORDINALS ||
        SCALE_WORDS.has(part) ||
        part === "vingts"
    );
}

/** Modern units after which S21 numbers are conversions (« 25 mètres »). */
export const MODERN_UNITS = new Set([
  "m",
  "metre",
  "metres",
  "cm",
  "centimetre",
  "centimetres",
  "mm",
  "millimetre",
  "millimetres",
  "km",
  "kilometre",
  "kilometres",
  "l",
  "litre",
  "litres",
  "dl",
  "cl",
  "ml",
  "hectolitre",
  "hectolitres",
  "kg",
  "kilo",
  "kilos",
  "kilogramme",
  "kilogrammes",
  "g",
  "gramme",
  "grammes",
  "tonne",
  "tonnes",
  "hectare",
  "hectares"
]);
/** Ancient measures that a modern translation may convert (« vingt coudées »). */
export const ANCIENT_MEASURES = new Set([
  "coudee",
  "coudees",
  "epha",
  "ephas",
  "hin",
  "omer",
  "omers",
  "homer",
  "homers",
  "sicle",
  "sicles",
  "talent",
  "talents",
  "mine",
  "mines",
  "stade",
  "stades",
  "dixieme",
  "dixiemes",
  "log",
  "cor",
  "cors",
  "bath",
  "baths",
  "sea",
  "seas",
  "kab",
  "letec",
  "empan",
  "empans",
  "palme",
  "palmes",
  "mesure",
  "mesures",
  "drachme",
  "drachmes",
  "guera",
  "gueras",
  "beka"
]);

export interface TextWord {
  start: number;
  end: number;
  text: string;
  folded: string;
  /** Raw text between the previous word and this one. */
  gap: string;
}

export interface NumeralRun {
  /** First and last indexes in the word list. */
  first: number;
  last: number;
  numeral?: FrenchNumeral;
}

/** Words of a text with their offsets and the text before each one. */
export function textWords(text: string): TextWord[] {
  const words: TextWord[] = [];
  let cursor = 0;
  let gap = "";
  for (const segment of tokenizeText(text)) {
    if (segment.kind === "word") {
      words.push({
        start: cursor,
        end: cursor + segment.text.length,
        text: segment.text,
        folded: foldWord(segment.text),
        gap
      });
      gap = "";
    } else gap += segment.text;
    cursor += segment.text.length;
  }
  return words;
}

/**
 * Maximal written numbers of a word list: number words joined by spaces or
 * hyphens, or by « et » between two of them (« mille et cent »).
 */
export function numeralRuns(words: TextWord[]): NumeralRun[] {
  const runs: NumeralRun[] = [];
  const joins = (gap: string) => /^[\s\u00a0\u202f\u2009-]*$/u.test(gap);
  let index = 0;
  while (index < words.length) {
    if (!isNumberWord(words[index]!.folded)) {
      index += 1;
      continue;
    }
    const first = index;
    let last = index;
    for (;;) {
      const next = words[last + 1];
      if (next && joins(next.gap) && isNumberWord(next.folded)) {
        last += 1;
        continue;
      }
      const after = words[last + 2];
      if (
        next?.folded === "et" &&
        after &&
        joins(next.gap) &&
        joins(after.gap) &&
        isNumberWord(after.folded)
      ) {
        last += 2;
        continue;
      }
      break;
    }
    const text = words
      .slice(first, last + 1)
      .map((word) => word.text)
      .join(" ");
    runs.push({ first, last, numeral: parseFrenchNumeral(text) });
    index = last + 1;
  }
  return runs;
}

export const numeralKey = (numeral: FrenchNumeral) =>
  `${numeral.value}${numeral.ordinal ? "o" : "c"}`;

/** A witness `<w>` tag with its span in the witness text without tags. */
export interface WitnessTag {
  start: number;
  end: number;
  strong: string[];
  positions: number[];
}

/** Witness text without tags, and the spans of its `<w>` tags. */
export function witnessText(tagged: string): {
  text: string;
  tags: WitnessTag[];
} {
  let text = "";
  const tags: WitnessTag[] = [];
  let cursor = 0;
  const pattern = /<w\b([^>]*)>([\s\S]*?)<\/w>|<[^>]+>/giu;
  for (const match of tagged.matchAll(pattern)) {
    text += tagged.slice(cursor, match.index);
    cursor = (match.index ?? 0) + match[0].length;
    if (match[2] === undefined) continue;
    const inner = stripTags(match[2]);
    const attributes = match[1] ?? "";
    tags.push({
      start: text.length,
      end: text.length + inner.length,
      strong: (/\bstrong=(["'])(.*?)\1/iu.exec(attributes)?.[2] ?? "")
        .split(/\s+/u)
        .filter(Boolean)
        .map((strong) => strong.toUpperCase()),
      positions: (/\bpos="([^"]*)"/u.exec(attributes)?.[1] ?? "")
        .split("+")
        .filter((value) => /^\d+$/u.test(value))
        .map(Number)
    });
    text += inner;
  }
  text += tagged.slice(cursor);
  return { text, tags };
}

/** The written number a word belongs to, and what follows that number. */
export interface NumberContext {
  /** Value of the written number; undefined when it does not parse. */
  value?: number;
  /** A modern unit follows (« 25 mètres »). */
  unit: boolean;
  /** An ancient measure follows (« vingt coudées »). */
  measure?: string;
}

function runContexts(words: TextWord[]): Array<NumberContext | undefined> {
  const contexts: Array<NumberContext | undefined> = words.map(() => undefined);
  for (const run of numeralRuns(words)) {
    const following = words.slice(run.last + 1, run.last + 3);
    const measure = following.find((word) =>
      ANCIENT_MEASURES.has(word.folded)
    )?.folded;
    const context: NumberContext = {
      ...(run.numeral ? { value: run.numeral.value } : {}),
      unit: following.some((word) => MODERN_UNITS.has(word.folded)),
      ...(measure ? { measure } : {})
    };
    for (let index = run.first; index <= run.last; index += 1)
      contexts[index] = context;
  }
  return contexts;
}

/** Number contexts of the words of a tokenized text, by word index. */
export function targetNumberContexts(
  segments: TextSegment[]
): Array<NumberContext | undefined> {
  return runContexts(
    textWords(segments.map((segment) => segment.text).join(""))
  );
}

/**
 * Number contexts of the tokens that `parseStrongTokens` reads from a tagged
 * witness verse, by token index: the « dix » tag of
 * « <w>dix</w> <w>mille</w> » belongs to 10 000.
 */
export function witnessTokenNumberContexts(
  tagged: string
): Array<NumberContext | undefined> {
  const words = textWords(witnessText(tagged).text);
  const contexts = runContexts(words);
  const tokens: Array<NumberContext | undefined> = [];
  let offset = 0;
  const read = (chunk: string) => {
    let cursor = 0;
    for (const segment of tokenizeText(chunk)) {
      if (segment.kind === "word" && segment.normalized) {
        const start = offset + cursor;
        const index = words.findIndex(
          (word) => word.start <= start && start < word.end
        );
        tokens.push(index < 0 ? undefined : contexts[index]);
      }
      cursor += segment.text.length;
    }
    offset += chunk.length;
  };
  let cursor = 0;
  for (const match of tagged.matchAll(/<w\b([^>]*)>([\s\S]*?)<\/w>/giu)) {
    read(stripTags(tagged.slice(cursor, match.index)));
    read(stripTags(match[2] ?? ""));
    cursor = (match.index ?? 0) + match[0].length;
  }
  read(stripTags(tagged.slice(cursor)));
  return tokens;
}

/**
 * Whether a target word and a witness word belong to different written
 * numbers: « 10 » and the « dix » of « dix mille »; or to the same value
 * that the target converts (« 25 mètres » and « vingt-cinq coudées »). An
 * ordinal and a cardinal of one value are the same number written two ways
 * (« le troisième jour », « trois jours après »).
 */
export function writtenNumbersDiffer(
  target: NumberContext | undefined,
  witness: NumberContext | undefined,
  targetWords: Set<string>
): boolean {
  if (target?.value === undefined || witness?.value === undefined) return false;
  if (target.value !== witness.value) return true;
  return (
    target.unit &&
    witness.measure !== undefined &&
    !targetWords.has(witness.measure)
  );
}
