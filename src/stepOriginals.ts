import { readFile } from "node:fs/promises";

import {
  type OriginalToken,
  type OriginalVerse,
  type OriginalVerseMap
} from "./originalSource.js";
import { referenceKey } from "./strongCsv.js";
import { normalizeStepStrongCode } from "./lexiconV3/identity.js";

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

export interface StepStrongEvidence {
  baseStrong: string;
  stepStrong: string;
  source: "TAHOT" | "TAGNT";
  tokenIndex: number;
  type: string;
  surface: string;
  transliteration: string;
  gloss: string;
  morphology: string;
  editions: string;
  /** Physical STEP token identity; stable across main/alternate ref aliases. */
  stepSourceIdentity?: string;
  stepMainRef?: string;
  stepAlternateRefs?: string[];
}

export type StepOriginalEvidenceIndex = Map<
  string,
  Map<string, StepStrongEvidence[]>
>;

export interface StepOriginalData {
  verseMap: OriginalVerseMap;
  evidenceIndex: StepOriginalEvidenceIndex;
}

export type StepReferenceRole = "main" | "alt";

export interface StepReferenceProvenance {
  ref: string;
  role: StepReferenceRole;
}

export type StepBackedOriginalToken = OriginalToken & {
  /** Native 1-based `#NN` position from TAHOT/TAGNT. */
  sourceTokenIndex: number;
  /** Stable identity of the physical STEP token, independent of ref aliases. */
  stepSourceIdentity: string;
  /** Canonical ref written before parentheses in the STEP source. */
  stepMainRef: string;
  /** Alternate refs written between parentheses in the STEP source. */
  stepAlternateRefs: string[];
  /** Complete source provenance; aliases are not additional occurrences. */
  stepReferenceProvenance: StepReferenceProvenance[];
};

export interface StepOriginalReferenceSelection {
  refs: string[];
  tokens: StepBackedOriginalToken[];
  strongSet: Set<string>;
}

/**
 * Return the source-native STEP token position without confusing it with the
 * contiguous array ordinal used by alignment scoring. The id fallback keeps
 * the position available after an OriginalToken has been projected or cloned.
 */
export function getStepSourceTokenIndex(
  token: OriginalToken
): number | undefined {
  const direct = (token as Partial<StepBackedOriginalToken>).sourceTokenIndex;
  if (Number.isInteger(direct) && direct! > 0) return direct;

  const encoded = token.id.match(
    /^(?:TAHOT|TAGNT)\.[^.]+\.\d+\.\d+\.(\d+)\./u
  )?.[1];
  if (!encoded) return undefined;
  const parsed = Number.parseInt(encoded, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

/**
 * Return the physical STEP token identity shared by its main and alternate-ref
 * projections. Legacy projected tokens fall back to their historical id.
 */
export function getStepSourceIdentity(
  token: OriginalToken
): string | undefined {
  const direct = (token as Partial<StepBackedOriginalToken>).stepSourceIdentity;
  if (direct) return direct;

  const legacy = token.id.match(
    /^((?:TAHOT|TAGNT)\.[^.]+\.\d+\.\d+\.\d+\.[^.]+)\.(?:main|alt)$/u
  )?.[1];
  return legacy;
}

export function selectStepEvidenceForOccurrence(
  evidence: StepStrongEvidence[],
  occurrence: {
    tokenIndex?: number;
    sourceStrong?: string;
    sourceIdentity?: string;
  },
  limit = 4
): StepStrongEvidence[] {
  if (evidence.length === 0 || limit <= 0) return [];
  const sourceStrong = occurrence.sourceStrong
    ? normalizeStepStrongCode(occurrence.sourceStrong)
    : null;
  const sameIdentity = occurrence.sourceIdentity
    ? evidence.filter(
        (item) => item.stepSourceIdentity === occurrence.sourceIdentity
      )
    : [];
  const sameToken = Number.isInteger(occurrence.tokenIndex)
    ? evidence.filter((item) => item.tokenIndex === occurrence.tokenIndex)
    : [];
  const sameSense = sourceStrong
    ? evidence.filter((item) => item.stepStrong === sourceStrong)
    : [];
  const identityAndSense = sameIdentity.filter(
    (item) => item.stepStrong === sourceStrong
  );
  const exact = sameToken.filter((item) => item.stepStrong === sourceStrong);
  const selected =
    identityAndSense.length > 0
      ? identityAndSense
      : sameIdentity.length > 0
        ? sameIdentity
        : exact.length > 0
          ? exact
          : sameToken.length > 0
            ? sameToken
            : sameSense.length > 0
              ? sameSense
              : evidence;

  return [...selected]
    .sort(
      (left, right) =>
        left.tokenIndex - right.tokenIndex ||
        left.stepStrong.localeCompare(right.stepStrong)
    )
    .slice(0, limit);
}

interface StepOriginalReadOptions {
  bookIds?: Set<string>;
}

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
  ["Ezk", "Ezek"],
  ["Dan", "Dan"],
  ["Hos", "Hos"],
  ["Joe", "Joel"],
  ["Jol", "Joel"],
  ["Amo", "Amos"],
  ["Oba", "Obad"],
  ["Jon", "Jonah"],
  ["Mic", "Mic"],
  ["Nah", "Nah"],
  ["Nam", "Nah"],
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

const STEP_CODE_PATTERN = /\b[HG]\d{4,5}[A-Za-z]?(?:_[A-Za-z])?\b/gu;

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

export async function readStepOriginalEvidenceIndex(
  filePaths: string[]
): Promise<StepOriginalEvidenceIndex> {
  const index: StepOriginalEvidenceIndex = new Map();

  for (const filePath of filePaths) {
    const tokens = await readStepOriginalTokens(filePath);
    for (const token of tokens) {
      addTokenEvidence(
        getOrInsert(index, token.ref, () => new Map()),
        token
      );
      for (const alternateRef of token.alternateRefs) {
        addTokenEvidence(
          getOrInsert(index, alternateRef, () => new Map()),
          token
        );
      }
    }
  }

  return index;
}

export async function readStepOriginalVerseMap(
  filePaths: string[]
): Promise<OriginalVerseMap> {
  const map: OriginalVerseMap = new Map();

  for (const filePath of filePaths) {
    const tokens = await readStepOriginalTokens(filePath);
    for (const token of tokens) {
      addTokenToOriginalVerseMap(map, token, token.ref);
      for (const alternateRef of token.alternateRefs) {
        addTokenToOriginalVerseMap(map, token, alternateRef);
      }
    }
  }

  return map;
}

/**
 * Select several reference projections as one logical source span. A STEP
 * token referenced by both `Rom.3.25` and its alias `Rom.3.26` is returned
 * once, while its complete main/alt provenance remains attached to the token.
 */
export function selectStepOriginalTokensForRefs(
  verseMap: OriginalVerseMap,
  refs: Iterable<string>,
  options: {
    requireMainRef?: boolean;
    /**
     * Select the STEP projection used by the French Strong reference space.
     * When an alternate projection exists for one selected ref, exclude a
     * different physical verse whose main ref merely collides with that ref.
     */
    preferAlternateRef?: boolean;
  } = {}
): StepOriginalReferenceSelection {
  const selectedRefs = [...new Set(refs)];
  const tokens: StepBackedOriginalToken[] = [];
  const strongSet = new Set<string>();
  const seenSourceIdentities = new Set<string>();

  for (const ref of selectedRefs) {
    const verse = verseMap.get(ref);
    if (!verse) continue;
    const hasAlternateProjection =
      options.preferAlternateRef &&
      verse.tokens.some((token) =>
        (token as StepBackedOriginalToken).stepAlternateRefs.includes(ref)
      );

    for (const token of verse.tokens) {
      const sourceIdentity = getStepSourceIdentity(token);
      if (!sourceIdentity || seenSourceIdentities.has(sourceIdentity)) continue;
      const stepToken = token as StepBackedOriginalToken;
      if (
        hasAlternateProjection &&
        !stepToken.stepAlternateRefs.includes(ref)
      ) {
        continue;
      }
      if (
        options.requireMainRef &&
        !selectedRefs.includes(stepToken.stepMainRef)
      ) {
        continue;
      }
      seenSourceIdentities.add(sourceIdentity);
      tokens.push(stepToken);
      for (const strong of stepToken.strong) strongSet.add(strong);
    }
  }

  return { refs: selectedRefs, tokens, strongSet };
}

/** Read STEP data and return one deduplicated logical span for a set of refs. */
export async function readStepOriginalTokensForRefs(
  filePaths: string[],
  refs: Iterable<string>,
  options: StepOriginalReadOptions = {}
): Promise<StepOriginalReferenceSelection> {
  const data = await readStepOriginalData(filePaths, options);
  return selectStepOriginalTokensForRefs(data.verseMap, refs);
}

/** Select and deduplicate STEP annotation evidence across a canonical span. */
export function selectStepEvidenceForRefs(
  evidenceIndex: StepOriginalEvidenceIndex,
  refs: Iterable<string>,
  options: { requireMainRef?: boolean; preferAlternateRef?: boolean } = {}
): Map<string, StepStrongEvidence[]> {
  const selected = new Map<string, StepStrongEvidence[]>();
  const seen = new Set<string>();
  const selectedRefs = new Set(refs);
  for (const ref of selectedRefs) {
    const byStrong = evidenceIndex.get(ref);
    if (!byStrong) continue;
    const hasAlternateProjection =
      options.preferAlternateRef &&
      [...byStrong.values()].some((evidence) =>
        evidence.some((item) => item.stepAlternateRefs?.includes(ref))
      );
    for (const [strong, evidence] of byStrong) {
      const target = selected.get(strong) ?? [];
      for (const item of evidence) {
        if (hasAlternateProjection && !item.stepAlternateRefs?.includes(ref)) {
          continue;
        }
        if (
          options.requireMainRef &&
          item.stepMainRef &&
          !selectedRefs.has(item.stepMainRef)
        ) {
          continue;
        }
        const identity =
          item.stepSourceIdentity ??
          `${item.source}.${item.stepMainRef ?? ref}.${item.tokenIndex}.${item.type}`;
        const key = `${identity}:${item.stepStrong}`;
        if (seen.has(key)) continue;
        seen.add(key);
        target.push(item);
      }
      if (target.length > 0) selected.set(strong, target);
    }
  }
  return selected;
}

export async function readStepOriginalData(
  filePaths: string[],
  options: StepOriginalReadOptions = {}
): Promise<StepOriginalData> {
  const verseMap: OriginalVerseMap = new Map();
  const evidenceIndex: StepOriginalEvidenceIndex = new Map();

  for (const filePath of filePaths) {
    const tokens = await readStepOriginalTokens(filePath, options);
    for (const token of tokens) {
      addTokenToOriginalVerseMap(verseMap, token, token.ref);
      addTokenEvidence(
        getOrInsert(evidenceIndex, token.ref, () => new Map()),
        token
      );
      for (const alternateRef of token.alternateRefs) {
        addTokenToOriginalVerseMap(verseMap, token, alternateRef);
        addTokenEvidence(
          getOrInsert(evidenceIndex, alternateRef, () => new Map()),
          token
        );
      }
    }
  }

  return { verseMap, evidenceIndex };
}

export async function readStepOriginalTokens(
  filePath: string,
  options: StepOriginalReadOptions = {}
): Promise<StepOriginalToken[]> {
  const content = await readFile(filePath, "utf8");
  const source = filePath.includes("TAGNT") ? "TAGNT" : "TAHOT";
  const tokens: StepOriginalToken[] = [];

  for (const line of content.split(/\r?\n/u)) {
    const parts = line.split("\t");
    const ref = parseStepRef(parts[0] ?? "");
    if (!ref) continue;
    if (!stepRefMatchesBooks(ref, options.bookIds)) continue;

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

function stepRefMatchesBooks(
  ref: ParsedStepRef,
  bookIds: Set<string> | undefined
): boolean {
  if (!bookIds || bookIds.size === 0) return true;
  if (bookIds.has(bookIdFromReferenceKey(ref.key))) return true;
  return ref.alternateKeys.some((key) =>
    bookIds.has(bookIdFromReferenceKey(key))
  );
}

function bookIdFromReferenceKey(key: string): string {
  return key.split(".")[0] ?? "";
}

function addTokenToOriginalVerseMap(
  map: OriginalVerseMap,
  token: StepOriginalToken,
  key: string
): void {
  const ref = parseReferenceKey(key);
  if (!ref) return;

  const pairs = stepStrongPairs(token);
  if (pairs.length === 0) return;

  const existing =
    map.get(key) ??
    ({
      bookId: ref.bookId,
      chapter: ref.chapter,
      verse: ref.verse,
      tokens: [],
      strongSet: new Set<string>()
    } satisfies OriginalVerse);

  const suffix = key === token.ref ? "main" : "alt";
  const stepSourceIdentity = [
    token.source,
    token.ref,
    token.tokenIndex,
    token.type
  ].join(".");
  const originalToken: StepBackedOriginalToken = {
    id: `${token.source}.${key}.${token.tokenIndex}.${token.type}.${suffix}`,
    sourceTokenIndex: token.tokenIndex,
    stepSourceIdentity,
    stepMainRef: token.ref,
    stepAlternateRefs: [...token.alternateRefs],
    stepReferenceProvenance: [
      { ref: token.ref, role: "main" },
      ...token.alternateRefs.map((ref) => ({
        ref,
        role: "alt" as const
      }))
    ],
    text: token.surface,
    strong: pairs.map((pair) => pair.baseStrong),
    sourceStrong: pairs.map((pair) => pair.stepStrong),
    gloss: token.gloss,
    lemma: token.transliteration,
    pos: token.type,
    morph: token.morphology
  };

  existing.tokens.push(originalToken);
  for (const pair of pairs) {
    existing.strongSet.add(pair.baseStrong);
  }
  map.set(key, existing);
}

function stepStrongPairs(
  token: StepOriginalToken
): Array<{ baseStrong: string; stepStrong: string }> {
  const pairs: Array<{ baseStrong: string; stepStrong: string }> = [];
  const seen = new Set<string>();

  for (const [baseStrong, stepStrongSet] of token.strongByBase) {
    const stepStrongValues = preferDisambiguatedStepStrong([...stepStrongSet]);
    for (const stepStrong of stepStrongValues) {
      const key = `${baseStrong}:${stepStrong}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push({ baseStrong, stepStrong });
    }
  }

  return pairs;
}

function preferDisambiguatedStepStrong(values: string[]): string[] {
  const disambiguated = values.filter((value) =>
    /^[HG]\d{4,5}[A-Za-z]$/u.test(value)
  );
  return disambiguated.length > 0 ? disambiguated : values;
}

function parseReferenceKey(
  key: string
): { bookId: string; chapter: number; verse: number } | undefined {
  const [bookId, chapter, verse] = key.split(".");
  if (!bookId || !chapter || !verse) return undefined;
  return {
    bookId,
    chapter: Number.parseInt(chapter, 10),
    verse: Number.parseInt(verse, 10)
  };
}

export function normalizeClassicalStrong(strong: string): string | undefined {
  const normalized = normalizeStepStrongCode(strong);
  const match = normalized?.match(/^([HG])(\d{4,5})/u);
  if (!match) return undefined;
  return `${match[1]}${match[2]}`;
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

function addTokenEvidence(
  verse: Map<string, StepStrongEvidence[]>,
  token: StepOriginalToken
): void {
  for (const [baseStrong, stepStrongSet] of token.strongByBase) {
    const target = getOrInsert(verse, baseStrong, () => []);
    for (const stepStrong of stepStrongSet) {
      target.push({
        baseStrong,
        stepStrong,
        source: token.source,
        tokenIndex: token.tokenIndex,
        type: token.type,
        surface: token.surface,
        transliteration: token.transliteration,
        gloss: token.gloss,
        morphology: token.morphology,
        editions: token.editions,
        stepSourceIdentity: [
          token.source,
          token.ref,
          token.tokenIndex,
          token.type
        ].join("."),
        stepMainRef: token.ref,
        stepAlternateRefs: [...token.alternateRefs]
      });
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
      const stepStrong = normalizeStepStrongCode(match[0]);
      if (!stepStrong) continue;
      if (isTechnicalHebrewMarker(stepStrong)) continue;
      result.push(stepStrong);
    }
  }
  return result;
}

function isTechnicalHebrewMarker(stepStrong: string): boolean {
  return /^H90\d{2}(?:[A-Za-z]|_[A-Za-z])?$/u.test(stepStrong);
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
