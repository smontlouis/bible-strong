/**
 * Proper names under another spelling (engine policy P, `properNameVariants`).
 *
 * Witnesses and target often spell one name differently: Segond 1910 writes
 * « Schuach », Darby « Shuakh », the target « Shuach »; Darby writes
 * « Micaël », STEP glosses « Michael », the target writes « Michel ». A source
 * word that STEP's lexicon types as a name (`N:`), and that nothing carries
 * yet, is placed on the only free target word that is
 *   - capitalised and the same name under a spelling key (« sch »/« sh »,
 *     « ph »/« f », « th »/« t », « kh »/« ch »/« k », doubled letters, « h »
 *     and accents ignored), or within a third of the key by edit distance
 *     (same initial, five letters or more), or its plural (« Hittite » →
 *     « Hittites »);
 *   - or a gentilic of it (« Lévi » → « Lévites », « Canaan » →
 *     « Cananéennes », and in lower case « cananéenne » for a name of four
 *     letters or more),
 * where the name is what a witness writes for that very source word or a
 * single-word STEP gloss of the name. The source word must be the only one of
 * its number in the verse, so that a repeated name is never paired by guess,
 * and two source words claiming the same target word are both left uncertain.
 *
 * Then « fils de Lévi » → « Lévites »: when the target renders « sons of
 * <Name> » (H1121 then the name) by the one gentilic word already carrying the
 * name, that word also carries « sons », provided the witnesses tag both
 * source words and the word begins as the witnesses write the name.
 *
 * A failed search proves nothing: the source word simply stays uncertain.
 */
import { readFileSync } from "node:fs";
import type { ReferenceSource } from "./align.js";
import type {
  StrongLedgerAnnotation,
  StrongLedgerToken
} from "./strongLedger.js";
import type { ResolutionUnit } from "./strongResolution.js";
import { withoutPublisherNotes } from "./strongReaderText.js";
import { stripTags } from "./tokenize.js";

/** STEP lexicon of names: the first entry's type and the one-word glosses. */
export interface ProperNameEntry {
  /** TBESH/TBESG type of the Strong's first entry (`N:N-M-P`, `N:N--LG`…). */
  type: string;
  /** Capitalised single-word English glosses of every entry (« Michael »). */
  glosses: string[];
}

/** Keyed by base Strong (`H7744`, `G2424`). */
export type ProperNameLexicon = ReadonlyMap<string, ProperNameEntry>;

export const PROPER_NAME_LEXICON_SOURCES = [
  "data/external/stepbible/TBESH.txt",
  "data/external/stepbible/TBESG.txt"
];

export function parseProperNameLexicon(
  texts: Iterable<string>
): ProperNameLexicon {
  const lexicon = new Map<string, ProperNameEntry>();
  for (const text of texts)
    for (const line of text.split(/\r?\n/u)) {
      const columns = line.split("\t");
      if (columns.length < 7 || !/^[HG]\d{4}/u.test(columns[0]!)) continue;
      const base = columns[0]!.slice(0, 5).toUpperCase();
      let entry = lexicon.get(base);
      if (!entry) {
        entry = { type: columns[5]!.trim(), glosses: [] };
        lexicon.set(base, entry);
      }
      const gloss = columns[6]!.trim();
      if (/^\p{Lu}/u.test(gloss) && !/\s/u.test(gloss))
        if (!entry.glosses.includes(gloss)) entry.glosses.push(gloss);
    }
  return lexicon;
}

let defaultLexicon: ProperNameLexicon | undefined;

/** The STEP lexicons of the repository, read once. */
export function loadProperNameLexicon(
  files: string[] = PROPER_NAME_LEXICON_SOURCES
): ProperNameLexicon {
  if (files === PROPER_NAME_LEXICON_SOURCES && defaultLexicon)
    return defaultLexicon;
  const lexicon = parseProperNameLexicon(
    files.map((file) => readFileSync(file, "utf8"))
  );
  if (files === PROPER_NAME_LEXICON_SOURCES) defaultLexicon = lexicon;
  return lexicon;
}

const baseStrong = (code: string) => {
  const match = /^([GH])0*(\d{1,4})/iu.exec(code.trim());
  return match
    ? `${match[1]!.toUpperCase()}${match[2]!.padStart(4, "0")}`
    : code.toUpperCase();
};

const nameEntry = (lexicon: ProperNameLexicon, strong: string) => {
  const entry = lexicon.get(baseStrong(strong));
  return entry?.type.startsWith("N:") ? entry : undefined;
};

/** A people's name (`N:N--LG`, « Chaldean »), not a person's or a place's. */
const isGentilicEntry = (entry: ProperNameEntry) => /^N:.*G$/u.test(entry.type);

/* ------------------------------------------------------------------ */
/* Spelling                                                            */
/* ------------------------------------------------------------------ */

// Wider than normalizeWord's set: « Lorsqu'Ephraïm » names Ephraïm.
const ELISIONS = new Set([
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
  "quoiqu",
  "presqu",
  "quelqu"
]);

/** The word without a leading elision, as written (« d'Israël » → « Israël »). */
export function withoutElision(word: string): string {
  const match = /^(\p{L}+)['’](.+)$/u.exec(word);
  return match && ELISIONS.has(match[1]!.toLocaleLowerCase("fr-FR"))
    ? match[2]!
    : word;
}

/** Lower case, no accents, no elision: « Lévites » → « levites ». */
export function foldName(word: string): string {
  return withoutElision(word)
    .toLocaleLowerCase("fr-FR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/œ/gu, "oe")
    .replace(/æ/gu, "ae")
    .replace(/[‐‑‒–—-]/gu, "-")
    .replace(/[^\p{L}\p{N}-]+/gu, "");
}

/**
 * Spelling key of a name: « Schuach », « Shuakh » and « Shuach » are all
 * « suak »; « Héthiens » and « Hittites » differ only by their vowels.
 */
export function nameKey(word: string): string {
  return foldName(word)
    .replace(/-/gu, "")
    .replace(/sch/gu, "sh")
    .replace(/kh/gu, "k")
    .replace(/ch/gu, "k")
    .replace(/ph/gu, "f")
    .replace(/th/gu, "t")
    .replace(/c(?=[aou]|$)/gu, "k")
    .replace(/qu?/gu, "k")
    .replace(/y/gu, "i")
    .replace(/w/gu, "v")
    .replace(/z/gu, "s")
    .replace(/ts/gu, "s")
    .replace(/h/gu, "")
    .replace(/(.)\1+/gu, "$1")
    .replace(/e(?=[aeiou])/gu, "");
}

export function levenshtein(left: string, right: string): number {
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  let previous = Array.from({ length: right.length + 1 }, (_, j) => j);
  for (let i = 1; i <= left.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= right.length; j += 1)
      current[j] = Math.min(
        previous[j]! + 1,
        current[j - 1]! + 1,
        previous[j - 1]! + (left[i - 1] === right[j - 1] ? 0 : 1)
      );
    previous = current;
  }
  return previous[right.length]!;
}

const commonPrefix = (left: string, right: string) => {
  let i = 0;
  while (i < left.length && i < right.length && left[i] === right[i]) i += 1;
  return i;
};

/** French gentilic endings, on folded words (« Judéens » → « judeens »). */
const GENTILIC =
  /(?:ites?|eens?|eennes?|iens?|iennes?|ains?|aines?|ais|aises?)$/u;
/** Gentilic endings of « sons of <Name> » words (« Israélites »). */
const SONS_GENTILIC = /(?:ites?|iens?|eens?|ains?|ois|ais)$/u;

/** Capitalised words that are not names, even at the start of a sentence. */
const FUNCTION_WORDS = new Set(
  (
    "a au aux avec car ce ces cet cette celui celle ceux celles chez comme " +
    "contre dans de des donc dont du elle elles en entre et eux il ils je " +
    "la le les leur leurs lui ma mais me meme mes moi mon ne ni non nos " +
    "notre nous on or ou oui par pas pour puis quand que qui quoi sa sans " +
    "se ses si son sous sur ta te tes toi ton tous tout toute toutes tu un " +
    "une vers voici voila vos votre vous ainsi alors aussi apres avant " +
    "lorsque puisque selon"
  ).split(" ")
);

const capitalised = (word: string) => /^\p{Lu}/u.test(withoutElision(word));

/* ------------------------------------------------------------------ */
/* Witness tags                                                        */
/* ------------------------------------------------------------------ */

export interface WitnessNameTag {
  witness: string;
  /** Reference of the witness row (`Gen.25.2`). */
  ref?: string;
  /** Text inside the tag, as the witness writes it. */
  text: string;
  strongs: string[];
  positions: number[];
}

/** Every `<w>` tag of the witnesses, with its own text and source positions. */
export function witnessNameTags(
  references: ReferenceSource[]
): WitnessNameTag[] {
  return references.flatMap((reference) => {
    const row = reference.verse?.row;
    if (!row) return [];
    const ref = `${row.bookId}.${row.chapter}.${row.verse}`;
    return [
      ...withoutPublisherNotes(row.text).matchAll(
        /<w\b([^>]*)>([\s\S]*?)<\/w>/giu
      )
    ].map((match) => {
      const attributes = match[1] ?? "";
      return {
        witness: reference.name,
        ref,
        text: stripTags(match[2] ?? "").trim(),
        strongs: (/\bstrong=(["'])(.*?)\1/iu.exec(attributes)?.[2] ?? "")
          .split(/\s+/u)
          .filter(Boolean)
          .map(baseStrong),
        positions: (/\bpos="([^"]*)"/u.exec(attributes)?.[1] ?? "")
          .split("+")
          .filter((value) => /^\d+$/u.test(value))
          .map(Number)
      };
    });
  });
}

/** `TAHOT.Gen.25.2.14.L.main:0` is word 14 of Gen.25.2. */
export function sourceWordOf(
  occurrenceId: string
): { ref: string; position: number } | undefined {
  const match = /^TA(?:HOT|GNT)\.([^.]+\.\d+\.\d+)\.(\d+)\./u.exec(
    occurrenceId
  );
  return match ? { ref: match[1]!, position: Number(match[2]) } : undefined;
}

/**
 * What the witnesses write for this source word: their tags naming its
 * position with its number; a witness numbering the verse otherwise is read
 * through its only tag carrying that number.
 */
function witnessRenderings(
  tags: WitnessNameTag[],
  strong: string,
  word: { ref: string; position: number }
): WitnessNameTag[] {
  const byWitness = new Map<string, WitnessNameTag[]>();
  for (const tag of tags)
    if (tag.strongs.includes(strong))
      byWitness.set(tag.witness, [...(byWitness.get(tag.witness) ?? []), tag]);
  return [...byWitness.values()].flatMap((carrying) => {
    const placed = carrying.filter(
      (tag) => tag.ref === word.ref && tag.positions.includes(word.position)
    );
    if (placed.length) return placed;
    return carrying.length === 1 ? carrying : [];
  });
}

/* ------------------------------------------------------------------ */
/* Proposals                                                           */
/* ------------------------------------------------------------------ */

export type ProperNameRelation =
  "name-key" | "name-near-key" | "name-plural" | "name-gentilic";

export interface ProperNameProposal {
  sourceUnitId: string;
  occurrenceId: string;
  strong: string;
  wordIndex: number;
  method: "proper-name-variant" | "sons-of-name-gentilic";
  relation: ProperNameRelation | "sons-gentilic";
  /** Renderings that matched: `Sg1910=Schuach`, `step-gloss=Michael`. */
  evidence: string[];
}

export interface ProperNameVerse {
  words: string[];
  units: ResolutionUnit[];
  /** Reader carriers already placed (word or phrase). */
  carriers: Array<{
    strong: string;
    startWordIndex: number;
    endWordIndex: number;
    originalOccurrenceId?: string;
  }>;
  tags: WitnessNameTag[];
}

function relationOf(
  word: string,
  rendering: string
): ProperNameRelation | undefined {
  const target = nameKey(word);
  const name = nameKey(rendering);
  if (target.length < 3 || name.length < 3) return undefined;
  if (target === name) return "name-key";
  const distance =
    levenshtein(target, name) / Math.max(target.length, name.length);
  if (
    distance <= 0.34 &&
    target.length >= 5 &&
    name.length >= 5 &&
    target[0] === name[0]
  )
    return "name-near-key";
  if (target === `${name}s`) return "name-plural";
  const folded = foldName(word);
  const foldedName = foldName(rendering);
  if (
    GENTILIC.test(folded) &&
    commonPrefix(folded, foldedName) >= Math.max(3, foldedName.length - 2)
  )
    return "name-gentilic";
  return undefined;
}

const RELATION_ORDER: ProperNameRelation[] = [
  "name-key",
  "name-plural",
  "name-near-key",
  "name-gentilic"
];

/**
 * A name of the source placed on the only free target word that spells it
 * otherwise (« Schuach » → « Shuach ») or derives a gentilic from it (« Lévi »
 * → « Lévites », « cananéenne »). Candidate generation only: a source word
 * with no such word, or with two, stays as it was.
 */
export function proposeProperNameVariants(
  verse: ProperNameVerse,
  lexicon: ProperNameLexicon
): ProperNameProposal[] {
  const occupied = new Set<number>();
  for (const carrier of verse.carriers)
    for (let i = carrier.startWordIndex; i <= carrier.endWordIndex; i += 1)
      occupied.add(i);
  const placedStrongs = new Set(
    verse.carriers.flatMap((carrier) =>
      carrier.strong.split(/\s+/u).map(baseStrong)
    )
  );
  // A word the witnesses use for another number names that other word.
  const witnessWords = new Map<string, Set<string>>();
  for (const tag of verse.tags) {
    const key = foldName(tag.text);
    const strongs = witnessWords.get(key) ?? new Set<string>();
    for (const strong of tag.strongs) strongs.add(strong);
    witnessWords.set(key, strongs);
  }
  const owns = (unit: ResolutionUnit) =>
    verse.carriers.some(
      (carrier) =>
        carrier.originalOccurrenceId !== undefined &&
        unit.occurrenceIds.includes(carrier.originalOccurrenceId)
    );
  // A people's name still without a carrier may own any gentilic word.
  const openPeoples = verse.units.filter((unit) => {
    const entry =
      unit.strong.length === 1
        ? nameEntry(lexicon, unit.strong[0]!)
        : undefined;
    return entry && isGentilicEntry(entry) && !owns(unit);
  });
  const proposals: ProperNameProposal[] = [];
  for (const unit of verse.units) {
    const strong = baseStrong(unit.strong[0] ?? "");
    const occurrenceId = unit.occurrenceIds[0]!;
    const word = sourceWordOf(occurrenceId);
    const entry = nameEntry(lexicon, strong);
    if (
      !entry ||
      !word ||
      unit.readingUnresolved ||
      unit.strong.length !== 1 ||
      unit.occurrenceIds.length !== 1 ||
      placedStrongs.has(strong) ||
      verse.units.filter((other) =>
        other.strong.some((code) => baseStrong(code) === strong)
      ).length !== 1 ||
      owns(unit)
    )
      continue;
    // « Babyloniens » may render the Chaldeans of the verse, not Babylon.
    const rivalPeoples =
      !isGentilicEntry(entry) &&
      openPeoples.some((other) => other.id !== unit.id);
    const renderings = [
      ...witnessRenderings(verse.tags, strong, word).map((tag) => ({
        text: tag.text,
        evidence: `${tag.witness}=${tag.text}`
      })),
      ...entry.glosses.map((gloss) => ({
        text: gloss,
        evidence: `step-gloss=${gloss}`
      }))
    ].filter((rendering) => capitalised(rendering.text));
    if (!renderings.length) continue;
    const candidates: Array<{
      wordIndex: number;
      relation: ProperNameRelation;
      evidence: string[];
    }> = [];
    for (const [wordIndex, text] of verse.words.entries()) {
      if (occupied.has(wordIndex)) continue;
      const upper = capitalised(text);
      const folded = foldName(text);
      if (FUNCTION_WORDS.has(folded)) continue;
      const others = witnessWords.get(folded);
      if (others && !others.has(strong)) continue;
      const matches = renderings.flatMap((rendering) => {
        const relation = relationOf(text, rendering.text);
        // An adjective in lower case is only a gentilic (« cananéenne »).
        return relation &&
          (upper ||
            (relation === "name-gentilic" &&
              foldName(rendering.text).length >= 4))
          ? [{ relation, evidence: rendering.evidence }]
          : [];
      });
      if (!matches.length) continue;
      if (
        rivalPeoples &&
        GENTILIC.test(folded) &&
        matches.every((match) => match.relation !== "name-key")
      ) {
        candidates.length = 0;
        break;
      }
      candidates.push({
        wordIndex,
        relation: RELATION_ORDER.find((relation) =>
          matches.some((match) => match.relation === relation)
        )!,
        evidence: [...new Set(matches.map((match) => match.evidence))]
      });
    }
    if (candidates.length !== 1) continue;
    const [candidate] = candidates;
    proposals.push({
      sourceUnitId: unit.id,
      occurrenceId,
      strong,
      wordIndex: candidate!.wordIndex,
      method: "proper-name-variant",
      relation: candidate!.relation,
      evidence: candidate!.evidence
    });
  }
  // Competing proposals are rejected together, never resolved by order.
  return proposals.filter(
    (proposal) =>
      !proposals.some(
        (other) => other !== proposal && other.wordIndex === proposal.wordIndex
      )
  );
}

const SONS = new Set(["H1121"]);

/**
 * « fils de Lévi » rendered « Lévites »: « sons » (H1121) joins the one
 * gentilic word that carries the next source word, a name. The witnesses must
 * tag both source words, must not write that very word for the name, and the
 * target must not keep their « sons » just before it.
 */
export function proposeSonsOfNameGentilics(
  verse: ProperNameVerse,
  lexicon: ProperNameLexicon
): ProperNameProposal[] {
  const unitAt = new Map<string, ResolutionUnit>();
  for (const unit of verse.units) {
    if (unit.occurrenceIds.length !== 1) continue;
    const word = sourceWordOf(unit.occurrenceIds[0]!);
    if (word) unitAt.set(`${word.ref}#${word.position}`, unit);
  }
  const owned = (unit: ResolutionUnit) =>
    verse.carriers.filter(
      (carrier) =>
        carrier.originalOccurrenceId !== undefined &&
        unit.occurrenceIds.includes(carrier.originalOccurrenceId)
    );
  const proposals: ProperNameProposal[] = [];
  for (const unit of verse.units) {
    const strong = baseStrong(unit.strong[0] ?? "");
    const occurrenceId = unit.occurrenceIds[0]!;
    const word = sourceWordOf(occurrenceId);
    if (
      !word ||
      !SONS.has(strong) ||
      unit.readingUnresolved ||
      unit.strong.length !== 1 ||
      unit.occurrenceIds.length !== 1 ||
      owned(unit).length
    )
      continue;
    const name = unitAt.get(`${word.ref}#${word.position + 1}`);
    if (
      !name ||
      name.readingUnresolved ||
      name.strong.length !== 1 ||
      !nameEntry(lexicon, name.strong[0]!)
    )
      continue;
    const nameStrong = baseStrong(name.strong[0]!);
    const nameCarriers = owned(name);
    if (
      nameCarriers.length !== 1 ||
      nameCarriers[0]!.startWordIndex !== nameCarriers[0]!.endWordIndex
    )
      continue;
    const wordIndex = nameCarriers[0]!.startWordIndex;
    // The word carries the name alone.
    if (
      verse.carriers.some(
        (carrier) =>
          carrier !== nameCarriers[0] &&
          carrier.startWordIndex <= wordIndex &&
          carrier.endWordIndex >= wordIndex
      )
    )
      continue;
    const nameWord = sourceWordOf(name.occurrenceIds[0]!)!;
    const nameWords = witnessRenderings(verse.tags, nameStrong, nameWord)
      .filter(
        (tag) =>
          tag.ref === nameWord.ref && tag.positions.includes(nameWord.position)
      )
      .flatMap((tag) => tag.text.split(/\s+/u))
      .map(foldName);
    const sonWords = new Set(
      witnessRenderings(verse.tags, strong, word)
        .filter(
          (tag) => tag.ref === word.ref && tag.positions.includes(word.position)
        )
        .flatMap((tag) => tag.text.split(/\s+/u))
        .map(foldName)
    );
    // Positive witness evidence for both source words.
    if (!nameWords.length || !sonWords.size) continue;
    const target = foldName(verse.words[wordIndex]!);
    if (
      nameWords.includes(target) ||
      !SONS_GENTILIC.test(target) ||
      !nameWords.some(
        (written) =>
          written.length >= 3 && target.startsWith(written.slice(0, 3))
      ) ||
      verse.words
        .slice(Math.max(0, wordIndex - 3), wordIndex)
        .some((before) => sonWords.has(foldName(before)))
    )
      continue;
    proposals.push({
      sourceUnitId: unit.id,
      occurrenceId,
      strong,
      wordIndex,
      method: "sons-of-name-gentilic",
      relation: "sons-gentilic",
      evidence: [
        `name=${nameStrong}`,
        ...[...sonWords].map((written) => `sons=${written}`)
      ]
    });
  }
  return proposals;
}

/* ------------------------------------------------------------------ */
/* Ledger pass                                                         */
/* ------------------------------------------------------------------ */

function readerCarriers(
  annotations: StrongLedgerAnnotation[]
): ProperNameVerse["carriers"] {
  return annotations.flatMap((annotation) => {
    if (annotation.visibility !== "reader") return [];
    const span =
      annotation.placement === "word" && annotation.wordIndex !== undefined
        ? [annotation.wordIndex, annotation.wordIndex]
        : annotation.placement === "phrase" &&
            annotation.startWordIndex !== undefined &&
            annotation.endWordIndex !== undefined
          ? [annotation.startWordIndex, annotation.endWordIndex]
          : undefined;
    return span
      ? [
          {
            strong: annotation.strong,
            startWordIndex: span[0]!,
            endWordIndex: span[1]!,
            originalOccurrenceId: annotation.originalOccurrenceId
          }
        ]
      : [];
  });
}

function placeProposal(
  ref: string,
  tokens: StrongLedgerToken[],
  annotations: StrongLedgerAnnotation[],
  proposal: ProperNameProposal
): void {
  // The STEP occurrence's own complete-alignment annotation becomes its
  // reader carrier, so the source word is still counted once.
  let annotation = annotations.find(
    (candidate) =>
      candidate.originalOccurrenceId === proposal.occurrenceId &&
      candidate.source === "original-complete"
  );
  if (!annotation) {
    annotation = {
      id: `${ref}:${annotations.length}:${proposal.strong}`,
      strong: proposal.strong,
      visibility: "reader",
      placement: "word",
      source: "reference-transfer",
      confidence: 0,
      reason: "",
      diagnostics: [],
      originalOccurrenceId: proposal.occurrenceId
    };
    annotations.push(annotation);
  }
  const witnessed = proposal.evidence.some(
    (evidence) => !evidence.startsWith("step-gloss=")
  );
  annotation.visibility = "reader";
  annotation.placement = "word";
  annotation.source =
    proposal.method === "proper-name-variant" && witnessed
      ? "reference-transfer"
      : "reference-backed-original";
  annotation.confidence =
    proposal.relation === "name-key" || proposal.relation === "name-plural"
      ? 0.9
      : 0.85;
  annotation.reason =
    proposal.method === "proper-name-variant"
      ? "Visible in reader mode because the target writes this source name under another spelling or as its gentilic, on the only free word that does."
      : "Visible in reader mode because the target renders « sons of <name> » by the one gentilic word carrying the name.";
  annotation.diagnostics = [
    proposal.method,
    proposal.relation,
    ...proposal.evidence
  ];
  annotation.wordIndex = proposal.wordIndex;
  annotation.normalizedWord = tokens[proposal.wordIndex]?.normalized;
  annotation.startWordIndex = undefined;
  annotation.endWordIndex = undefined;
  annotation.normalizedPhrase = undefined;
  annotation.insertAfterWordIndex = undefined;
  annotation.emptyEvidence = undefined;
}

/**
 * Engine pass P, on one verse. It runs on the reader carriers once the
 * transfer, the lexical fixed point and the alternative-identifier reduction
 * are done, just before the occurrence decisions: names first, then « sons of
 * <name> » on the words the names now carry. Returns the carriers it placed.
 */
export function applyProperNameVariants(options: {
  verse: {
    ref: string;
    tokens: StrongLedgerToken[];
    annotations: StrongLedgerAnnotation[];
  };
  units: ResolutionUnit[];
  references: ReferenceSource[];
  lexicon: ProperNameLexicon;
}): ProperNameProposal[] {
  const { verse } = options;
  const tags = witnessNameTags(options.references);
  if (!tags.length) return [];
  const words = verse.tokens.map((token) => token.text);
  const names = proposeProperNameVariants(
    {
      words,
      units: options.units,
      carriers: readerCarriers(verse.annotations),
      tags
    },
    options.lexicon
  );
  for (const proposal of names)
    placeProposal(verse.ref, verse.tokens, verse.annotations, proposal);
  const sons = proposeSonsOfNameGentilics(
    {
      words,
      units: options.units,
      carriers: readerCarriers(verse.annotations),
      tags
    },
    options.lexicon
  );
  for (const proposal of sons)
    placeProposal(verse.ref, verse.tokens, verse.annotations, proposal);
  return [...names, ...sons];
}
