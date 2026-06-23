import { readFile } from "node:fs/promises";

import { referenceKey } from "./strongCsv.js";

export interface StepOriginalToken {
  ref: string;
  alternateRefs: string[];
  source: "TAHOT" | "TAGNT";
  tokenIndex: number;
  type: string;
  surface: string;
  transliteration: string;
  gloss: string;
  morphology: string;
  editions: string;
  strongByBase: Map<string, Set<string>>;
}

export interface StepStrongCandidates {
  unique: Set<string>;
  occurrences: string[];
}

export type StepOriginalIndex = Map<string, Map<string, StepStrongCandidates>>;

const STEP_TO_OSIS_BOOK = new Map<string, string>([
  ["Gen", "Gen"],
  ["Exo", "Exod"],
  ["Lev", "Lev"],
  ["Num", "Num"],
  ["Deu", "Deut"],
  ["Jos", "Josh"],
  ["Jdg", "Judg"],
  ["Rut", "Ruth"],
  ["1Sa", "1Sam"],
  ["2Sa", "2Sam"],
  ["1Ki", "1Kgs"],
  ["2Ki", "2Kgs"],
  ["1Ch", "1Chr"],
  ["2Ch", "2Chr"],
  ["Ezr", "Ezra"],
  ["Neh", "Neh"],
  ["Est", "Esth"],
  ["Job", "Job"],
  ["Psa", "Ps"],
  ["Pro", "Prov"],
  ["Ecc", "Eccl"],
  ["Sng", "Song"],
  ["Isa", "Isa"],
  ["Jer", "Jer"],
  ["Lam", "Lam"],
  ["Eze", "Ezek"],
  ["Dan", "Dan"],
  ["Hos", "Hos"],
  ["Joe", "Joel"],
  ["Amo", "Amos"],
  ["Oba", "Obad"],
  ["Jon", "Jonah"],
  ["Mic", "Mic"],
  ["Nah", "Nah"],
  ["Hab", "Hab"],
  ["Zep", "Zeph"],
  ["Hag", "Hag"],
  ["Zec", "Zech"],
  ["Mal", "Mal"],
  ["Mat", "Matt"],
  ["Mrk", "Mark"],
  ["Mar", "Mark"],
  ["Luk", "Luke"],
  ["Jhn", "John"],
  ["Joh", "John"],
  ["Act", "Acts"],
  ["Rom", "Rom"],
  ["1Co", "1Cor"],
  ["2Co", "2Cor"],
  ["Gal", "Gal"],
  ["Eph", "Eph"],
  ["Php", "Phil"],
  ["Phi", "Phil"],
  ["Col", "Col"],
  ["1Th", "1Thess"],
  ["2Th", "2Thess"],
  ["1Ti", "1Tim"],
  ["2Ti", "2Tim"],
  ["Tit", "Titus"],
  ["Phm", "Phlm"],
  ["Heb", "Heb"],
  ["Jas", "Jas"],
  ["Jam", "Jas"],
  ["1Pe", "1Pet"],
  ["2Pe", "2Pet"],
  ["1Jn", "1John"],
  ["2Jn", "2John"],
  ["3Jn", "3John"],
  ["Jud", "Jude"],
  ["Rev", "Rev"]
]);

const STEP_CODE_PATTERN = /\b[HG]\d{4,5}[A-Z]?(?:_[A-Z])?\b/gu;

export async function readStepOriginalIndex(
  filePaths: string[]
): Promise<StepOriginalIndex> {
  const index: StepOriginalIndex = new Map();

  for (const filePath of filePaths) {
    const tokens = await readStepOriginalTokens(filePath);
    for (const token of tokens) {
      const verse = getOrInsert(index, token.ref, () => new Map());
      addTokenStrongSets(verse, token);
      for (const alternateRef of token.alternateRefs) {
        addTokenStrongSets(
          getOrInsert(index, alternateRef, () => new Map()),
          token
        );
      }
    }
  }

  return index;
}

export async function readStepOriginalTokens(
  filePath: string
): Promise<StepOriginalToken[]> {
  const content = await readFile(filePath, "utf8");
  const source = filePath.includes("TAGNT") ? "TAGNT" : "TAHOT";
  const tokens: StepOriginalToken[] = [];

  for (const line of content.split(/\r?\n/u)) {
    const parts = line.split("\t");
    const ref = parseStepRef(parts[0] ?? "");
    if (!ref) continue;

    const token =
      source === "TAGNT"
        ? parseTagntToken(ref, parts)
        : parseTahotToken(ref, parts);
    if (token.strongByBase.size > 0) {
      tokens.push(token);
    }
  }

  return tokens;
}

export function normalizeClassicalStrong(strong: string): string | undefined {
  const match = strong
    .toUpperCase()
    .match(/\b([HG])0*(\d{1,5})(?:[A-Z])?(?:_[A-Z])?\b/u);
  if (!match) return undefined;
  return `${match[1]}${match[2].padStart(4, "0")}`;
}

function parseTahotToken(
  ref: ParsedStepRef,
  parts: string[]
): StepOriginalToken {
  return {
    ref: ref.key,
    alternateRefs: ref.alternateKeys,
    source: "TAHOT",
    tokenIndex: ref.tokenIndex,
    type: ref.type,
    surface: parts[1] ?? "",
    transliteration: parts[2] ?? "",
    gloss: parts[3] ?? "",
    morphology: parts[5] ?? "",
    editions: "",
    strongByBase: buildStrongByBase({
      dStrongValues: [parts[4] ?? "", parts[11] ?? ""],
      aliasValues: [parts[8] ?? "", parts[9] ?? ""]
    })
  };
}

function parseTagntToken(
  ref: ParsedStepRef,
  parts: string[]
): StepOriginalToken {
  const dStrongAndGrammar = parts[3] ?? "";
  const [dStrong = "", morphology = ""] = dStrongAndGrammar.split("=", 2);

  return {
    ref: ref.key,
    alternateRefs: ref.alternateKeys,
    source: "TAGNT",
    tokenIndex: ref.tokenIndex,
    type: ref.type,
    surface: parts[1] ?? "",
    transliteration: extractTransliteration(parts[1] ?? ""),
    gloss: parts[2] ?? "",
    morphology,
    editions: parts[5] ?? "",
    strongByBase: buildStrongByBase({
      dStrongValues: [dStrong],
      aliasValues: [parts[11] ?? "", parts[12] ?? ""]
    })
  };
}

interface ParsedStepRef {
  key: string;
  alternateKeys: string[];
  tokenIndex: number;
  type: string;
}

function parseStepRef(input: string): ParsedStepRef | undefined {
  const match = input
    .replace(/^\uFEFF/u, "")
    .match(
      /^([1-3]?[A-Za-z]{2,3})\.(\d+)\.(\d+)(?:\((\d+)\.(\d+)\))?#(\d+)=([^\t]+)$/u
    );
  if (!match) return undefined;

  const bookId = STEP_TO_OSIS_BOOK.get(match[1] ?? "");
  if (!bookId) return undefined;

  const alternateKeys =
    match[4] && match[5] ? [referenceKey(bookId, match[4], match[5])] : [];

  return {
    key: referenceKey(bookId, match[2] ?? "", match[3] ?? ""),
    alternateKeys,
    tokenIndex: Number.parseInt(match[6] ?? "0", 10),
    type: match[7] ?? ""
  };
}

function addTokenStrongSets(
  verse: Map<string, StepStrongCandidates>,
  token: StepOriginalToken
): void {
  for (const [baseStrong, stepStrongSet] of token.strongByBase) {
    const target = getOrInsert(verse, baseStrong, () => ({
      unique: new Set<string>(),
      occurrences: []
    }));
    for (const stepStrong of stepStrongSet) {
      target.unique.add(stepStrong);
      target.occurrences.push(stepStrong);
    }
  }
}

function buildStrongByBase(options: {
  dStrongValues: string[];
  aliasValues: string[];
}): Map<string, Set<string>> {
  const result = extractDStrongByBase(options.dStrongValues);
  const dStrongCodes = [...result.values()].flatMap((codes) => [...codes]);

  for (const alias of extractStepStrongCodes(options.aliasValues)) {
    const aliasBase = normalizeClassicalStrong(alias);
    if (!aliasBase || result.has(aliasBase)) continue;

    if (dStrongCodes.length === 1) {
      result.set(aliasBase, new Set(dStrongCodes));
    }
  }

  return result;
}

function extractDStrongByBase(values: string[]): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  for (const stepStrong of extractStepStrongCodes(values)) {
    const baseStrong = normalizeClassicalStrong(stepStrong);
    if (!baseStrong) continue;
    getOrInsert(result, baseStrong, () => new Set()).add(stepStrong);
  }
  return result;
}

function extractStepStrongCodes(values: string[]): string[] {
  const result: string[] = [];
  for (const value of values) {
    for (const match of value.matchAll(STEP_CODE_PATTERN)) {
      const stepStrong = normalizeStepStrong(match[0]);
      if (isTechnicalHebrewMarker(stepStrong)) continue;
      result.push(stepStrong);
    }
  }
  return result;
}

function normalizeStepStrong(strong: string): string {
  return strong
    .replace(/_[A-Z]$/u, "")
    .replace(/^([HG])0*(\d{1,5})/u, (_, prefix, digits) => {
      return `${prefix}${String(digits).padStart(4, "0")}`;
    });
}

function isTechnicalHebrewMarker(stepStrong: string): boolean {
  return /^H90\d{2}$/u.test(stepStrong);
}

function extractTransliteration(surface: string): string {
  return surface.match(/\((.*?)\)/u)?.[1] ?? "";
}

function getOrInsert<K, V>(map: Map<K, V>, key: K, factory: () => V): V {
  const existing = map.get(key);
  if (existing) return existing;
  const next = factory();
  map.set(key, next);
  return next;
}
