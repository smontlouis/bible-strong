/**
 * Lexical gap fill (engine policy Q, `lexicalGapFill`).
 *
 * A source word that every earlier step left without a carrier, and whose
 * absence nothing establishes, goes on a free word of the target when three
 * conditions meet:
 *
 * - position: the word lies between the target carriers of the nearest placed
 *   source words before and after it (one of them at least, never crossed);
 * - lexicon: the word is a known French rendering of the Strong — a lemma the
 *   witnesses give it over the whole Bible (inflections through Kaikki), a
 *   French gloss of the Strong dictionary, or an OpenOffice synonym of one of
 *   its main witness renderings;
 * - uniqueness: it is the only free content word of that interval with such
 *   evidence, no other free word there has any, no other source word of the
 *   verse picks it, is known to render it or carries a copy of it.
 *
 * « il les mit dans la grotte » : the witnesses render the word « caverne »,
 * the dictionary glosses it « grotte » ; « grotte » is the only free content
 * word between the placed neighbours, so it carries the Strong.
 *
 * Tiers, in order; a word taken by one tier leaves the pool of the next:
 * W. the witnesses' own word for this very source word (its tag carries the
 *    source position) is an inflection or a derivation of the target word
 *    (« priai » / « priant », two witnesses for « expliquer » /
 *    « explication »), the only such free word up to three words beyond the
 *    neighbours, while no carried word relates to it;
 * A. witness lemma or dictionary gloss, alone in the interval (two free
 *    content words at most);
 * B. synonym of a main witness rendering, confirmed by the dictionary;
 * C. synonym of a main witness rendering, when it is the only free word of an
 *    interval placed on both sides.
 *
 * Only content source words (noun, verb, adjective, name) are filled, tiers
 * A–C only for a Strong of limited vocabulary; the others, and every failed
 * search, stay uncertain: a failed search never proves an absence.
 */
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";

import { encliticHost } from "./align.js";
import { isGenericFrenchCarrier } from "./frenchLexicalSafety.js";
import { representsOccurrence, type StrongToken } from "./strongCsv.js";
import type {
  StrongLedgerAnnotation,
  StrongLedgerVerse
} from "./strongLedger.js";
import { normalizeWord } from "./tokenize.js";

/** Function words of the reader alignment: never a lexical carrier. */
export const LEXICAL_GAP_FUNCTION_WORDS: ReadonlySet<string> = new Set(
  "a au aux avec ce ces cet cette de des du en et il ils la le les leur leurs lui nous on ou par pour qu que qui sa se ses son sur un une y".split(
    " "
  )
);

/**
 * Further closed-class French words (pronouns, negation, conjunctions,
 * auxiliaries, quantifiers, grammatical adverbs): a source content word is not
 * carried by them alone, and their Kaikki lemmas (« vous » → « tu ») would
 * otherwise link them to pronoun Strongs.
 */
export const LEXICAL_GAP_EXTRA_FUNCTION_WORDS: ReadonlySet<string> = new Set(
  "ne n pas plus point je tu me te moi toi vous elle elles eux ton ta tes mon ma mes notre nos votre vos dont mais car donc si comme sans dans sous vers chez contre entre ni or puis alors aussi tout tous toute toutes celui celle ceux celles cela ceci ca c est sont ete etait etre avoir a ai as avons avez ont avait eu fut furent fait faire voici voila quand lorsque afin parce quoi quel quelle quels quelles tres bien".split(
    " "
  )
);

/** Thresholds of the lexicon, fixed before the reserve is opened. */
export const LEXICAL_GAP_THRESHOLDS = {
  /** A Strong with this many distinct witness lemmas or more is too light. */
  lightStrongLemmas: 200,
  /** P(Strong | lemma) over the witnesses' tagged words. */
  strongGivenLemma: 0.02,
  /** P(lemma | Strong). */
  lemmaGivenStrong: 0.003,
  /** A main witness rendering: count, P(lemma | Strong), P(Strong | lemma). */
  mainCount: 3,
  mainLemmaGivenStrong: 0.02,
  mainStrongGivenLemma: 0.05
} as const;

export type LexicalGapTier = "W" | "A" | "B" | "C";

/** Whole-Bible lexical evidence, built once per run. */
export interface LexicalGapLexicon {
  /** Kaikki lemmas of a form (« enlevera » → « enlever »). */
  formLemmas: ReadonlyMap<string, readonly string[]>;
  /** Kaikki lemmas themselves (words with forms of their own). */
  headwords: ReadonlySet<string>;
  /** Strong → witness lemma → tagged words. */
  witnessLemmaCounts: ReadonlyMap<string, ReadonlyMap<string, number>>;
  /** Strong → tagged words. */
  witnessStrongTotals: ReadonlyMap<string, number>;
  /** Witness lemma → tagged words (any Strong). */
  witnessLemmaTotals: ReadonlyMap<string, number>;
  /** Strong → forms and lemmas of its single-word French glosses. */
  dictionaryGlosses: ReadonlyMap<string, ReadonlySet<string>>;
  /** Strong → forms and lemmas of every French gloss or meaning word. */
  dictionaryWords: ReadonlyMap<string, ReadonlySet<string>>;
  /** Strong → its main witness lemmas. */
  mainLemmas: ReadonlyMap<string, ReadonlySet<string>>;
  /** Word → the main witness lemmas it is a synonym of. */
  synonymsOfMain: ReadonlyMap<string, ReadonlySet<string>>;
}

/** `H0776`, `h776` → `H776`. */
export function lexicalStrongKey(code: string): string {
  const match = /^([HG])0*(\d+)/iu.exec(code.trim());
  return match ? `${match[1]!.toUpperCase()}${match[2]}` : code.toUpperCase();
}

/** Lexicon spelling of a normalized word: apostrophes written « ' ». */
export function lexicalWordKey(word: string): string {
  return word.replace(/’/gu, "'");
}

/** Kaikki form → lemmas, from the repository's SQLite index. */
export function readKaikkiFormLemmas(
  sqlitePath: string
): Map<string, string[]> {
  const lemmas = new Map<string, string[]>();
  const db = new DatabaseSync(sqlitePath, { readOnly: true });
  try {
    for (const row of db
      .prepare("select form, lemma from forms order by form, lemma")
      .all() as Array<{ form: string; lemma: string }>) {
      // Lemmas outside plain French spelling are labels, not words.
      if (!row.form || !row.lemma || /[^a-z'’ -]/u.test(row.lemma)) continue;
      const form = lexicalWordKey(row.form);
      const values = lemmas.get(form) ?? [];
      values.push(lexicalWordKey(row.lemma));
      lemmas.set(form, values);
    }
  } finally {
    db.close();
  }
  return lemmas;
}

/**
 * Single-word OpenOffice synonyms (`dictionary.go`: a `word|n` line followed
 * by n `(POS)|syn|syn…` lines), both directions.
 */
export function readOpenOfficeSynonyms(
  filePath: string
): Map<string, Set<string>> {
  const text = readFileSync(filePath, "utf8");
  const body = text.includes("`")
    ? text.slice(text.indexOf("`") + 1, text.lastIndexOf("`"))
    : text;
  const synonyms = new Map<string, Set<string>>();
  const add = (left: string, right: string) => {
    const values = synonyms.get(left) ?? new Set<string>();
    values.add(right);
    synonyms.set(left, values);
  };
  const lines = body.split(/\r?\n/u);
  for (let index = 1; index < lines.length;) {
    const header = /^(.*)\|(\d+)$/u.exec(lines[index++] ?? "");
    if (!header) continue;
    const headword = header[1]!.trim();
    const count = Number(header[2]);
    for (let offset = 0; offset < count; offset += 1) {
      const parts = (lines[index++] ?? "").split("|").slice(1);
      if (!headword || /\s/u.test(headword)) continue;
      const head = lexicalWordKey(normalizeWord(headword));
      if (!head) continue;
      for (const part of parts) {
        const synonym = part.trim();
        if (!synonym || /\s/u.test(synonym) || synonym.startsWith("("))
          continue;
        const key = lexicalWordKey(normalizeWord(synonym));
        if (!key || key === head) continue;
        add(head, key);
        add(key, head);
      }
    }
  }
  return synonyms;
}

/**
 * Builds the lexicon from the witnesses of the run (whole Bible), Kaikki, the
 * Strong dictionary candidates and the OpenOffice synonyms.
 */
export function buildLexicalGapLexicon(options: {
  /** Every verse of every witness used by the run. */
  witnessVerses: Iterable<{ tokens: StrongToken[] }>;
  formLemmas: ReadonlyMap<string, readonly string[]>;
  dictionary: Iterable<{ strong: string; normalized: string; source: string }>;
  synonyms?: ReadonlyMap<string, ReadonlySet<string>>;
}): LexicalGapLexicon {
  const { formLemmas } = options;
  // A witness word stands for its Kaikki lemmas, or for itself without any.
  const witnessLemmas = (form: string) => {
    const lemmas = formLemmas.get(form);
    return lemmas && lemmas.length ? [...new Set(lemmas)] : [form];
  };
  const witnessLemmaCounts = new Map<string, Map<string, number>>();
  const witnessStrongTotals = new Map<string, number>();
  const witnessLemmaTotals = new Map<string, number>();
  for (const verse of options.witnessVerses)
    for (const token of verse.tokens) {
      if (!token.strong.length || !representsOccurrence(token)) continue;
      const form = lexicalWordKey(token.normalized);
      if (!form) continue;
      const lemmas = witnessLemmas(form);
      for (const lemma of lemmas)
        witnessLemmaTotals.set(lemma, (witnessLemmaTotals.get(lemma) ?? 0) + 1);
      for (const strong of new Set(token.strong.map(lexicalStrongKey))) {
        witnessStrongTotals.set(
          strong,
          (witnessStrongTotals.get(strong) ?? 0) + 1
        );
        const counts = witnessLemmaCounts.get(strong) ?? new Map();
        for (const lemma of lemmas)
          counts.set(lemma, (counts.get(lemma) ?? 0) + 1);
        witnessLemmaCounts.set(strong, counts);
      }
    }

  const dictionaryGlosses = new Map<string, Set<string>>();
  const dictionaryWords = new Map<string, Set<string>>();
  const addForms = (
    map: Map<string, Set<string>>,
    strong: string,
    form: string
  ) => {
    const values = map.get(strong) ?? new Set<string>();
    values.add(form);
    for (const lemma of formLemmas.get(form) ?? []) values.add(lemma);
    map.set(strong, values);
  };
  for (const candidate of options.dictionary) {
    const source = candidate.source.replace(/^strong-lexicon-sqlite:/u, "");
    if (!["fr-gloss", "fr-gloss-token", "fr-meaning"].includes(source))
      continue;
    const strong = lexicalStrongKey(candidate.strong);
    const form = lexicalWordKey(candidate.normalized);
    if (!form) continue;
    if (source === "fr-gloss") addForms(dictionaryGlosses, strong, form);
    addForms(dictionaryWords, strong, form);
  }

  const t = LEXICAL_GAP_THRESHOLDS;
  const mainLemmas = new Map<string, Set<string>>();
  const allMain = new Set<string>();
  for (const [strong, counts] of witnessLemmaCounts) {
    const total = witnessStrongTotals.get(strong) ?? 0;
    for (const [lemma, count] of counts)
      if (
        count >= t.mainCount &&
        count / total >= t.mainLemmaGivenStrong &&
        count / (witnessLemmaTotals.get(lemma) ?? 1) >= t.mainStrongGivenLemma
      ) {
        const values = mainLemmas.get(strong) ?? new Set<string>();
        values.add(lemma);
        mainLemmas.set(strong, values);
        allMain.add(lemma);
      }
  }
  // Only the synonym links that reach a main rendering are ever consulted.
  const synonymsOfMain = new Map<string, Set<string>>();
  for (const main of allMain)
    for (const synonym of options.synonyms?.get(main) ?? []) {
      const values = synonymsOfMain.get(synonym) ?? new Set<string>();
      values.add(main);
      synonymsOfMain.set(synonym, values);
    }

  return {
    formLemmas,
    headwords: new Set([...formLemmas.values()].flat()),
    witnessLemmaCounts,
    witnessStrongTotals,
    witnessLemmaTotals,
    dictionaryGlosses,
    dictionaryWords,
    mainLemmas,
    synonymsOfMain
  };
}

/** Lexical evidence that a target word renders one Strong. */
export interface LexicalGapEvidence {
  /** Witness lemma above both thresholds. */
  witness?: string;
  /** Single-word dictionary gloss. */
  gloss?: string;
  /** Any dictionary gloss or meaning word. */
  dictionary?: string;
  /** Synonym bridge `word~main rendering`. */
  synonym?: string;
  /** Any witness lemma, dictionary word or synonym. */
  any: boolean;
}

/** Whether a Strong renders few enough distinct words to be learned. */
export function isLightStrong(
  lexicon: LexicalGapLexicon,
  strong: string
): boolean {
  return (
    (lexicon.witnessLemmaCounts.get(lexicalStrongKey(strong))?.size ?? 0) <
    LEXICAL_GAP_THRESHOLDS.lightStrongLemmas
  );
}

/** The word and its Kaikki lemmas against the lexicon of one Strong. */
export function lexicalGapEvidence(
  lexicon: LexicalGapLexicon,
  strongCode: string,
  word: string
): LexicalGapEvidence {
  const strong = lexicalStrongKey(strongCode);
  const form = lexicalWordKey(word);
  const lemmas = [...new Set([form, ...(lexicon.formLemmas.get(form) ?? [])])];

  const counts = lexicon.witnessLemmaCounts.get(strong);
  const total = lexicon.witnessStrongTotals.get(strong) ?? 0;
  const main = lexicon.mainLemmas.get(strong);
  const evidence: LexicalGapEvidence = { any: false };
  const t = LEXICAL_GAP_THRESHOLDS;
  for (const lemma of lemmas) {
    const count = counts?.get(lemma) ?? 0;
    if (count > 0) {
      evidence.any = true;
      if (
        !evidence.witness &&
        count / (lexicon.witnessLemmaTotals.get(lemma) ?? 1) >=
          t.strongGivenLemma &&
        count / total >= t.lemmaGivenStrong
      )
        evidence.witness = lemma;
    }
    if (!evidence.gloss && lexicon.dictionaryGlosses.get(strong)?.has(lemma))
      evidence.gloss = lemma;
    if (!evidence.dictionary && lexicon.dictionaryWords.get(strong)?.has(lemma))
      evidence.dictionary = lemma;
    if (!evidence.synonym && main) {
      const bridged = [...(lexicon.synonymsOfMain.get(lemma) ?? [])]
        .filter((candidate) => main.has(candidate))
        .sort()[0];
      if (bridged) evidence.synonym = `${lemma}~${bridged}`;
    }
  }
  if (evidence.dictionary || evidence.synonym) evidence.any = true;
  return evidence;
}

/**
 * STEP morphology of a content word: Hebrew and Aramaic segments starting
 * with N, V or A (« HTd/Ncmsa »); Greek codes N-, V-, A- (« V-AAI-3S »).
 */
export function isContentMorphology(morphology: string): boolean {
  if (!morphology) return false;
  if (/^[NVA]-/u.test(morphology)) return true;
  if (!/^[HA]/u.test(morphology)) return false;
  return morphology
    .slice(1)
    .split("/")
    .some((segment) => /^[NVA]/u.test(segment));
}

export interface LexicalGapUnit {
  id: string;
  /** STEP verse of the word and its word number. */
  ref: string;
  position: number;
  strong: string[];
  morphology: string;
  /** Unresolved for want of a carrier, reading settled, absence not shown. */
  open: boolean;
}

export interface LexicalGapCarrier {
  /** Source word of the carrier (empty when it has none). */
  unitId: string;
  startWordIndex: number;
  endWordIndex: number;
}

export interface LexicalGapFill {
  unitId: string;
  strong: string;
  wordIndex: number;
  tier: LexicalGapTier;
  /** `witness:<lemma>`, `gloss:<lemma>`, `synonym:<word>~<rendering>`… */
  evidence: string;
  /** Free content words of the interval. */
  poolSize: number;
}

export interface LexicalGapOptions {
  /** Largest pool (free content words of the interval) of tiers A and B. */
  maxPool?: number;
  /** Witnesses that must relate a target word to their rendering (tier W). */
  minSurfaceWitnesses?: number;
  /** Abstain when a copy of the word carries another source word. */
  claimedCopies?: boolean;
  /** Abstain when the word is as known a rendering of another source word. */
  rivalRenderings?: boolean;
}

/** One witness verse: its words with their tags (Strong, source positions). */
export interface LexicalGapWitness {
  name: string;
  /** Witness verse (`Gen.3.1`): its positions number that STEP verse. */
  ref: string;
  tokens: StrongToken[];
}

/** Forms of the auxiliaries, whose Kaikki lemmas link anything to anything. */
const AUXILIARY_LEMMAS = new Set(["avoir", "etre"]);
/** Lemmas too general to relate two words (« fit » / « faites »). */
const GENERIC_LEMMAS = new Set([
  "etre",
  "avoir",
  "faire",
  "aller",
  "dire",
  "venir",
  "pouvoir",
  "vouloir",
  "devoir",
  "falloir"
]);

type SurfaceRelation = "exact" | "lemma" | "prefix";

/**
 * How a target word relates to a witness word: the same word, a shared Kaikki
 * lemma (« priant » / « priai » : « prier »), or a common stem of five letters
 * (« explication » / « expliquer »). A shared lemma that is generic, or that
 * links two headwords through a third one (« terrasse » / « terre » :
 * « terrer »), relates nothing.
 */
export function surfaceRelation(
  lexicon: LexicalGapLexicon,
  target: string,
  witness: string
): SurfaceRelation | undefined {
  const forms = [target, encliticHost(target)].filter((form): form is string =>
    Boolean(form)
  );
  if (forms.includes(witness)) return "exact";
  const lemmas = (form: string) => {
    const kaikki = lexicon.formLemmas.get(form) ?? [];
    return kaikki.length > 8 || kaikki.some((l) => AUXILIARY_LEMMAS.has(l))
      ? [form]
      : [form, ...kaikki];
  };
  const headword = (form: string) => lexicon.headwords.has(form);
  const witnessLemmas = new Set(lemmas(witness));
  for (const form of forms) {
    const shared = lemmas(form).filter((lemma) => witnessLemmas.has(lemma));
    if (shared.some((lemma) => GENERIC_LEMMAS.has(lemma))) return undefined;
    if (
      shared.some(
        (lemma) =>
          lemma === form ||
          lemma === witness ||
          !(headword(form) && headword(witness))
      )
    )
      return "lemma";
  }
  if (target.includes("-") || target.length < 6 || witness.length < 6)
    return undefined;
  let common = 0;
  while (common < target.length && target[common] === witness[common])
    common += 1;
  return common >= 5 ? "prefix" : undefined;
}

const isFreeContentWord = (word: string) =>
  Boolean(word) &&
  !LEXICAL_GAP_FUNCTION_WORDS.has(word) &&
  !LEXICAL_GAP_EXTRA_FUNCTION_WORDS.has(word) &&
  !isGenericFrenchCarrier(word);

/**
 * Proposes carriers for the open source words of one verse. `words` are the
 * normalized target words; `carriers` are the reader word and phrase carriers
 * of the verse with the source word they belong to; `witnesses` are the
 * witness verses, when the verse has them.
 */
export function proposeLexicalGapFills(options: {
  words: string[];
  units: LexicalGapUnit[];
  carriers: LexicalGapCarrier[];
  lexicon: LexicalGapLexicon;
  witnesses?: LexicalGapWitness[];
  options?: LexicalGapOptions;
}): LexicalGapFill[] {
  const { units, carriers, lexicon } = options;
  const words = options.words.map(lexicalWordKey);
  const maxPool = options.options?.maxPool ?? 2;
  const minSurfaceWitnesses = options.options?.minSurfaceWitnesses ?? 1;
  const claimedCopies = options.options?.claimedCopies ?? true;
  const rivalRenderings = options.options?.rivalRenderings ?? true;
  // Source order is the STEP word number: one STEP verse only.
  if (new Set(units.map((unit) => unit.ref)).size !== 1) return [];
  const positionOf = new Map(units.map((unit) => [unit.id, unit.position]));
  const strongsOf = new Map(
    units.map((unit) => [unit.id, unit.strong.map(lexicalStrongKey)])
  );
  const covered = new Set<number>();
  const carriedStrongs = new Map<number, Set<string>>();
  const tokensByPosition = new Map<number, number[]>();
  for (const carrier of carriers) {
    const position = positionOf.get(carrier.unitId);
    const tokens = tokensByPosition.get(position ?? -1) ?? [];
    for (let i = carrier.startWordIndex; i <= carrier.endWordIndex; i += 1) {
      covered.add(i);
      tokens.push(i);
      const strongs = carriedStrongs.get(i) ?? new Set<string>();
      for (const strong of strongsOf.get(carrier.unitId) ?? [])
        strongs.add(strong);
      carriedStrongs.set(i, strongs);
    }
    if (position !== undefined) tokensByPosition.set(position, tokens);
  }
  // The same word already carries another source word: which copy renders
  // which source word is not known.
  const claimedElsewhere = (unit: LexicalGapUnit, i: number) =>
    claimedCopies &&
    [...covered].some(
      (j) =>
        words[j] === words[i] &&
        !unit.strong.some((code) =>
          carriedStrongs.get(j)?.has(lexicalStrongKey(code))
        )
    );
  // The lexicon knows the word as a rendering of another source word of the
  // verse too (« crime » for two Strongs side by side): it cannot tell which
  // one the word carries.
  const rivalRendering = (unit: LexicalGapUnit, i: number) => {
    if (!rivalRenderings) return false;
    const own = new Set(unit.strong.map(lexicalStrongKey));
    return units.some(
      (other) =>
        other.id !== unit.id &&
        other.strong.some((code) => {
          if (own.has(lexicalStrongKey(code))) return false;
          const evidence = lexicalGapEvidence(lexicon, code, words[i]!);
          return Boolean(evidence.witness || evidence.gloss);
        })
    );
  };
  const ambiguous = (unit: LexicalGapUnit, i: number) =>
    claimedElsewhere(unit, i) || rivalRendering(unit, i);
  // Identifiers the witnesses of the verse use come first (policy B).
  const attested = new Set(
    (options.witnesses ?? []).flatMap((witness) =>
      witness.tokens.flatMap((token) => token.strong.map(lexicalStrongKey))
    )
  );
  const placed = [...tokensByPosition.keys()];
  const free = (from: number, to: number) => {
    const pool: number[] = [];
    for (let i = Math.max(0, from); i <= Math.min(words.length - 1, to); i += 1)
      if (!covered.has(i) && isFreeContentWord(words[i]!)) pool.push(i);
    return pool;
  };

  interface Candidate {
    unit: LexicalGapUnit;
    /** Free content words strictly between the neighbours (tiers A–C). */
    pool: number[];
    /** Free content words near the neighbours (tier W). */
    nearPool: number[];
    bracketed: boolean;
    evidence: Map<number, Map<string, LexicalGapEvidence>>;
  }
  const candidates: Candidate[] = [];
  for (const unit of units) {
    if (!unit.open || !isContentMorphology(unit.morphology)) continue;
    const before = placed.filter((p) => p < unit.position);
    const after = placed.filter((p) => p > unit.position);
    // A word with no placed neighbour has no interval.
    if (!before.length && !after.length) continue;
    const left = before.length
      ? tokensByPosition.get(Math.max(...before))!
      : undefined;
    const right = after.length
      ? tokensByPosition.get(Math.min(...after))!
      : undefined;
    const lower = left ? Math.max(...left) : -1;
    const upper = right ? Math.min(...right) : words.length;
    const sides = [...(left ?? []), ...(right ?? [])];
    // Near the neighbours, three words either way, open toward a free edge.
    const nearPool = free(
      left ? Math.min(...sides) - 3 : 0,
      right ? Math.max(...sides) + 3 : words.length - 1
    );
    // Crossed neighbours give no ordered interval.
    const pool =
      lower < upper &&
      unit.strong.some((strong) => isLightStrong(lexicon, strong))
        ? free(lower + 1, upper - 1)
        : [];
    if (!pool.length && !nearPool.length) continue;
    const evidence = new Map<number, Map<string, LexicalGapEvidence>>();
    for (const i of pool)
      evidence.set(
        i,
        new Map(
          unit.strong.map((strong) => [
            strong,
            lexicalGapEvidence(lexicon, strong, words[i]!)
          ])
        )
      );
    candidates.push({
      unit,
      pool,
      nearPool,
      bracketed: before.length > 0 && after.length > 0,
      evidence
    });
  }

  // Tier W: the witnesses' own rendering of this very source word.
  const identifiers = (codes: readonly string[]) =>
    new Set(codes.map(lexicalStrongKey));
  const surfacesOf = (unit: LexicalGapUnit) => {
    const mine = identifiers(unit.strong);
    const sharedWithOthers = units.some(
      (other) =>
        other.id !== unit.id &&
        other.strong.some((code) => mine.has(lexicalStrongKey(code)))
    );
    const surfaces: Array<{ witness: string; form: string; strong: string }> =
      [];
    for (const witness of options.witnesses ?? []) {
      if (witness.ref !== unit.ref) continue;
      const heads = witness.tokens.filter(
        (token) => token.strong.length && representsOccurrence(token)
      );
      const tagged = heads.filter((token) =>
        token.strong.some((code) => mine.has(lexicalStrongKey(code)))
      );
      let own = tagged.filter((token) =>
        token.positions?.includes(unit.position)
      );
      // A witness numbering the word otherwise: its only tag of a Strong
      // that no other source word of the verse has, one or two words away.
      if (
        !own.length &&
        !sharedWithOthers &&
        tagged.length === 1 &&
        tagged[0]!.positions?.some((p) => Math.abs(p - unit.position) <= 2)
      )
        own = tagged;
      for (const token of own)
        surfaces.push({
          witness: witness.name,
          form: lexicalWordKey(token.normalized),
          strong:
            unit.strong.find((code) =>
              token.strong.some(
                (tag) => lexicalStrongKey(tag) === lexicalStrongKey(code)
              )
            ) ?? unit.strong[0]!
        });
    }
    return surfaces;
  };
  // Witness words of the other source words of the verse.
  const otherSurfaces = (unit: LexicalGapUnit) => {
    const mine = identifiers(unit.strong);
    return (options.witnesses ?? []).flatMap((witness) =>
      witness.ref !== unit.ref
        ? []
        : witness.tokens.flatMap((token) =>
            token.strong.length &&
            representsOccurrence(token) &&
            !token.positions?.includes(unit.position) &&
            !token.strong.some((code) => mine.has(lexicalStrongKey(code)))
              ? [lexicalWordKey(token.normalized)]
              : []
          )
    );
  };
  const rank: Record<SurfaceRelation, number> = {
    exact: 3,
    lemma: 2,
    prefix: 1
  };
  const chooseSurface = (
    candidate: Candidate,
    pool: number[]
  ): { wordIndex: number; strong: string; evidence: string } | undefined => {
    const surfaces = surfacesOf(candidate.unit);
    if (!surfaces.length) return undefined;
    const relate = (i: number) => {
      let best: SurfaceRelation | undefined;
      const witnesses = new Set<string>();
      let surface: (typeof surfaces)[number] | undefined;
      for (const s of surfaces) {
        const relation = surfaceRelation(lexicon, words[i]!, s.form);
        if (!relation) continue;
        witnesses.add(s.witness);
        if (!best || rank[relation] > rank[best]) {
          best = relation;
          surface = s;
        }
      }
      return best
        ? { relation: best, witnesses, surface: surface! }
        : undefined;
    };
    const related = pool.flatMap((i) => {
      const r = relate(i);
      return r ? [{ i, ...r }] : [];
    });
    if (related.length !== 1) return undefined;
    const [hit] = related as [(typeof related)[number]];
    if (hit.relation === "exact") return undefined;
    if (hit.witnesses.size < minSurfaceWitnesses) return undefined;
    if (hit.relation === "prefix" && hit.witnesses.size < 2) return undefined;
    // The rendering already carried elsewhere: that word may be the one.
    for (const i of covered) {
      const relation = relate(i)?.relation;
      if (relation === "exact" || relation === "lemma") return undefined;
    }
    // The word renders another source word of the witnesses just as well.
    const word = words[hit.i]!;
    if (
      otherSurfaces(candidate.unit).some((form) => {
        const relation = surfaceRelation(lexicon, word, form);
        return relation === "exact" || relation === "lemma";
      })
    )
      return undefined;
    return {
      wordIndex: hit.i,
      strong: hit.surface.strong,
      evidence: `surface-${hit.relation}:${[...hit.witnesses].sort().join("+")}:${hit.surface.form}`
    };
  };

  const hasAny = (candidate: Candidate, i: number) =>
    [...candidate.evidence.get(i)!.values()].some((e) => e.any);
  // The first identifier of the source word with the accepted evidence.
  const accepted = (
    candidate: Candidate,
    i: number,
    accept: (e: LexicalGapEvidence) => string | undefined
  ): { strong: string; evidence: string } | undefined => {
    const ordered = [...candidate.evidence.get(i)!].sort(
      ([left], [right]) =>
        Number(attested.has(lexicalStrongKey(right))) -
        Number(attested.has(lexicalStrongKey(left)))
    );
    for (const [strong, e] of ordered) {
      const reason = accept(e);
      if (reason) return { strong, evidence: reason };
    }
    return undefined;
  };
  // The only pool word with the evidence, when no other has any.
  const unique = (
    candidate: Candidate,
    pool: number[],
    accept: (e: LexicalGapEvidence) => string | undefined
  ) => {
    if (pool.length > maxPool) return undefined;
    const hits = pool.filter((i) => accepted(candidate, i, accept));
    if (hits.length !== 1) return undefined;
    const [i] = hits as [number];
    if (pool.some((j) => j !== i && hasAny(candidate, j))) return undefined;
    if (ambiguous(candidate.unit, i)) return undefined;
    return { wordIndex: i, ...accepted(candidate, i, accept)! };
  };
  const tiers: Array<{
    tier: LexicalGapTier;
    near?: boolean;
    choose: (
      candidate: Candidate,
      pool: number[]
    ) => { wordIndex: number; strong: string; evidence: string } | undefined;
  }> = [
    { tier: "W", near: true, choose: chooseSurface },
    {
      tier: "A",
      choose: (candidate, pool) =>
        unique(candidate, pool, (e) =>
          e.witness
            ? `witness:${e.witness}`
            : e.gloss
              ? `gloss:${e.gloss}`
              : undefined
        )
    },
    {
      tier: "B",
      choose: (candidate, pool) =>
        unique(candidate, pool, (e) =>
          e.synonym && e.dictionary
            ? `synonym:${e.synonym}+dictionary:${e.dictionary}`
            : undefined
        )
    },
    {
      tier: "C",
      choose: (candidate, pool) => {
        if (!candidate.bracketed || pool.length !== 1) return undefined;
        const [i] = pool as [number];
        const chosen = accepted(candidate, i, (e) =>
          e.synonym ? `synonym:${e.synonym}` : undefined
        );
        return chosen && !ambiguous(candidate.unit, i)
          ? { wordIndex: i, ...chosen }
          : undefined;
      }
    }
  ];

  const fills: LexicalGapFill[] = [];
  const taken = new Set<number>();
  const filled = new Set<string>();
  for (const { tier, near, choose } of tiers) {
    const proposals: LexicalGapFill[] = [];
    for (const candidate of candidates) {
      if (filled.has(candidate.unit.id)) continue;
      const pool = (near ? candidate.nearPool : candidate.pool).filter(
        (i) => !taken.has(i)
      );
      if (!pool.length) continue;
      const chosen = choose(candidate, pool);
      if (chosen)
        proposals.push({
          unitId: candidate.unit.id,
          tier,
          poolSize: (near ? candidate.nearPool : candidate.pool).length,
          ...chosen
        });
    }
    // Two source words on one target word: both stay open.
    for (const proposal of proposals) {
      if (
        proposals.some(
          (other) =>
            other !== proposal && other.wordIndex === proposal.wordIndex
        )
      )
        continue;
      fills.push(proposal);
      filled.add(proposal.unitId);
      taken.add(proposal.wordIndex);
    }
  }
  return fills;
}

/** `TAHOT.Gen.3.1.6.L` → `Gen.3.1`, word 6. */
function stepWordOfUnit(
  unitId: string
): { ref: string; position: number } | undefined {
  const match = /^TA(?:HOT|GNT)\.([^.]+\.\d+\.\d+)\.(\d+)\./u.exec(unitId);
  return match ? { ref: match[1]!, position: Number(match[2]) } : undefined;
}

export const LEXICAL_GAP_FILL_REASON =
  "Visible in reader mode because the only free content word between the placed neighbouring source words is a known French rendering of this Strong (an inflection of the witnesses' word for it, a witness lemma, a dictionary gloss or a synonym of a witness rendering).";

/**
 * Turns the source word's own annotation into a reader carrier on the chosen
 * word. Other identifiers of the same source word become hidden duplicates of
 * that carrier. Returns false when the source word has no annotation.
 */
export function applyLexicalGapFill(
  verse: Pick<StrongLedgerVerse, "tokens" | "annotations">,
  occurrenceIds: readonly string[],
  fill: LexicalGapFill
): boolean {
  const owned = verse.annotations.filter(
    (annotation) =>
      annotation.originalOccurrenceId !== undefined &&
      occurrenceIds.includes(annotation.originalOccurrenceId) &&
      annotation.visibility !== "reader"
  );
  const same = (annotation: StrongLedgerAnnotation) =>
    annotation.strong.toUpperCase() === fill.strong.toUpperCase();
  const carrier = owned.find(same);
  if (!carrier) return false;
  const token = verse.tokens[fill.wordIndex];
  const onWord = (annotation: StrongLedgerAnnotation) => {
    annotation.insertAfterWordIndex = undefined;
    annotation.emptyEvidence = undefined;
    annotation.wordIndex = fill.wordIndex;
    annotation.normalizedWord = token?.normalized;
    annotation.startWordIndex = undefined;
    annotation.endWordIndex = undefined;
    annotation.normalizedPhrase = undefined;
  };
  carrier.visibility = "reader";
  carrier.placement = "word";
  carrier.source = "lexical-gap-fill";
  carrier.confidence = Math.max(carrier.confidence, 0.7);
  carrier.reason = LEXICAL_GAP_FILL_REASON;
  carrier.diagnostics = [
    `lexical-gap-fill:${fill.tier}:${fill.evidence}`,
    `lexical-gap-fill-pool:${fill.poolSize}`,
    ...carrier.diagnostics.filter((d) => !d.startsWith("lexical-gap-fill"))
  ];
  onWord(carrier);
  for (const other of owned)
    if (other !== carrier && !same(other)) {
      other.visibility = "hidden";
      other.placement = "duplicate";
      other.reason =
        "Another identifier of the same source word already has the lexical gap-fill carrier.";
      other.diagnostics = [
        ...new Set([...other.diagnostics, "alternative-identifier-demoted"])
      ];
      onWord(other);
    }
  return true;
}

/** The verse view of `proposeLexicalGapFills` built from a resolved verse. */
export function proposeLexicalGapFillsForVerse(
  verse: Pick<StrongLedgerVerse, "tokens" | "annotations" | "resolution">,
  lexicon: LexicalGapLexicon,
  witnesses: LexicalGapWitness[] = [],
  options?: LexicalGapOptions
): LexicalGapFill[] {
  const decisions = verse.resolution?.decisions ?? [];
  const unitOfOccurrence = new Map<string, string>();
  const units: LexicalGapUnit[] = [];
  for (const decision of decisions) {
    const word = stepWordOfUnit(decision.sourceUnitId);
    if (!word) return [];
    for (const id of decision.occurrenceIds)
      unitOfOccurrence.set(id, decision.sourceUnitId);
    units.push({
      id: decision.sourceUnitId,
      ref: word.ref,
      position: word.position,
      strong: decision.strong,
      morphology: decision.source.morphology,
      open:
        decision.state === "unresolved" &&
        !decision.source.readingUnresolved &&
        decision.reasons.includes("missing-carrier-is-not-absent-translation")
    });
  }
  const carriers: LexicalGapCarrier[] = verse.annotations.flatMap(
    (annotation) => {
      if (annotation.visibility !== "reader") return [];
      const start = annotation.startWordIndex ?? annotation.wordIndex;
      const end = annotation.endWordIndex ?? annotation.wordIndex;
      if (
        (annotation.placement !== "word" &&
          annotation.placement !== "phrase") ||
        start === undefined ||
        end === undefined
      )
        return [];
      return [
        {
          unitId:
            unitOfOccurrence.get(annotation.originalOccurrenceId ?? "") ?? "",
          startWordIndex: start,
          endWordIndex: end
        }
      ];
    }
  );
  return proposeLexicalGapFills({
    words: verse.tokens.map((token) => token.normalized),
    units,
    carriers,
    lexicon,
    witnesses,
    options
  });
}

/**
 * Policy Q pass over resolved ledger verses. It runs after canonical
 * resolution (it reads the decisions) and re-resolves every verse it changes
 * through `resolve`, so that the new carriers become visible decisions and
 * the anchors of the words still uncertain account for them.
 */
export function lexicalGapFillPass(options: {
  verses: StrongLedgerVerse[];
  lexicon: LexicalGapLexicon;
  /** Witness verses of a target verse (none when its text spans several). */
  witnessesOf: (verse: StrongLedgerVerse) => LexicalGapWitness[];
  resolve: (verse: StrongLedgerVerse) => void;
}): { placed: number; changedRefs: Set<string> } {
  let placed = 0;
  const changedRefs = new Set<string>();
  for (const verse of options.verses) {
    const resolution = verse.resolution;
    // A verse whose source correspondence is in doubt is left as it is.
    if (!resolution || resolution.issues.length) continue;
    let changed = 0;
    for (const fill of proposeLexicalGapFillsForVerse(
      verse,
      options.lexicon,
      options.witnessesOf(verse)
    )) {
      const decision = resolution.decisions.find(
        (candidate) => candidate.sourceUnitId === fill.unitId
      )!;
      if (applyLexicalGapFill(verse, decision.occurrenceIds, fill))
        changed += 1;
    }
    if (!changed) continue;
    placed += changed;
    changedRefs.add(verse.ref);
    options.resolve(verse);
  }
  return { placed, changedRefs };
}
