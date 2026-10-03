/**
 * Compound target words (engine option N, `compoundTargetWords`).
 *
 * One witness word can render several source words at once: tags glued by a
 * hyphen (« <w H0884 pos="3">Beer</w>-<w H0884 pos="4">Schéba</w> »,
 * « <w G2424>Jésus</w>-<w G5547>Christ</w> »), or one tag naming several
 * source positions (« <w H1008 pos="6+7">Béthel</w> ») or several numbers
 * (« <w H8147 H6240 pos="5+6">douze</w> »). The witness transfer compares
 * the text of each tag, so « Beer » never meets the target's « Beer-Shéba »,
 * and a word carries a number only once, so the second half of « Béthel »
 * stays without a carrier.
 *
 * This pass compares whole witness words instead. When the target writes a
 * witness word that renders several source words, as often as the witness
 * does (« Béthel » for « Béthel »; « Beer-Shéba » for « Beër-Shéba »; a number
 * in digits whatever its grouping, « 3000 » for « 3 000 »; a proper name may
 * differ by spelling only, « Beer-Schéba »), each source word that word
 * renders and that has no carrier yet is carried by it. A word the witness
 * repeats more often than the target is the one already carrying another of
 * its source words, or none. A source word whose number the target word
 * already shows shares that carrier instead of repeating the number
 * (`shared`, a hidden duplicate the resolver counts as a placement): the
 * reader sees one « H1008 » on « Béthel », as the witnesses tag it, and both
 * source words are placed. A word never shows more numbers than the profile
 * allows, a number in digits included (« 6800 »).
 *
 * Only content words are placed (nouns, names, adjectives and numerals,
 * verbs): an article, pronoun, particle or conjunction pooled into one French
 * word (« mon » for ὁ + μου, « lui-même » with δέ) is not rendered by that word
 * as a whole, and neither is a content word one tag pools with them (« leur »
 * for ὁ + ἴδιος). Function words never anchor a repeated word either. A source
 * word whose reading is open, that already has a carrier, that a witness
 * leaves untranslated or that two witnesses point to different words keeps
 * its state; a failed match never establishes anything.
 */
import type { StrongLedgerAnnotation } from "./strongLedger.js";
import { withoutPublisherNotes } from "./strongReaderText.js";
import { normalizeWord, stripTags, tokenizeText } from "./tokenize.js";

export const COMPOUND_TARGET_WORD_METHOD = "compound-target-word";

export interface CompoundUnit {
  id: string;
  readingUnresolved: boolean;
  /** STEP morphology of the source word (`HR/Npl`, `N-GSM-T`). */
  morphology: string;
  occurrences: Array<{ occurrenceId: string; strong: string }>;
}

/** A reader carrier of the target verse (any owner). */
export interface CompoundCarrier {
  strong: string;
  kind: "word" | "phrase" | "empty";
  originalOccurrenceId?: string;
  startWordIndex?: number;
  endWordIndex?: number;
}

export interface CompoundWitness {
  name: string;
  /** Witness verse reference (`Gen.28.19`): its positions name STEP words of that verse. */
  ref: string;
  /** Tagged witness text, notes included. */
  taggedText: string;
}

export interface CompoundTargetProposal {
  sourceUnitId: string;
  occurrenceId: string;
  strong: string;
  wordIndex: number;
  /** `shared`: the target word already shows this number for another source word. */
  carrier: "new" | "shared";
  /** `name-spelling`: matched by the spelling key of a proper name. */
  match: "word" | "name-spelling";
  witnesses: string[];
  witnessWord: string;
}

export interface WitnessCompoundWord {
  wordIndex: number;
  text: string;
  members: Array<{ strong: string; position: number }>;
  /** One tag of the word names several numbers (« leur » for ὁ + ἴδιος). */
  pooled: boolean;
}

export interface WitnessCompoundReading {
  /** Witness words; a number written in digit groups (« 3 000 ») is one word. */
  words: string[];
  compounds: WitnessCompoundWord[];
  /** Every source position the witness names, by Strong (loose form). */
  positionsByStrong: Map<string, number[]>;
  /** Strongs of tags pooling unequal lists: their positions are incomplete. */
  unpairedStrongs: Set<string>;
  /** Source words the witness leaves untranslated (`H0834#6`, loose Strong). */
  untranslated: Set<string>;
}

/** `TAHOT.Gen.28.19.7.L.main:0` names word 7 of Gen.28.19. */
export function compoundSourceWord(
  occurrenceId: string
): { ref: string; position: number } | undefined {
  const match = /^TA(?:HOT|GNT)\.([^.]+\.\d+\.\d+)\.(\d+)\./u.exec(
    occurrenceId
  );
  return match ? { ref: match[1]!, position: Number(match[2]) } : undefined;
}

const looseStrong = (code: string) =>
  code.toUpperCase().replace(/^([GH])0*(\d+).*$/u, "$1$2");

/**
 * Witness words that render several source words: tags glued by hyphens
 * inside one word (« Beer-Schéba »), or one tag naming several source words
 * (« Béthel » 6+7, « 3 000 »). Members are (Strong, position) pairs: a tag
 * naming as many numbers as positions pairs them in order; one number with
 * several positions (or the reverse) names each of them; unequal lists name
 * every combination, which only an exact STEP word can confirm. A word holding
 * a tag without positions, a tag spread over several words (other than digit
 * groups), or tags glued otherwise than by a hyphen (an elision,
 * « qu’Ézéchias ») is left out: its members cannot be named reliably.
 */
export function witnessCompoundWords(
  taggedText: string
): WitnessCompoundWord[] {
  return readWitnessCompounds(taggedText).compounds;
}

/** Witness words, compound words and named positions of one witness verse. */
export function readWitnessCompounds(
  taggedText: string
): WitnessCompoundReading {
  const tagged = withoutPublisherNotes(taggedText);
  const plain = stripTags(tagged);
  const ranges: Array<{ start: number; end: number; text: string }> = [];
  let offset = 0;
  for (const segment of tokenizeText(plain)) {
    const start = offset;
    offset += segment.text.length;
    if (segment.kind === "word")
      ranges.push({ start, end: offset, text: segment.text });
  }
  const tagsByWord = new Map<
    number,
    Array<{
      start: number;
      end: number;
      pairs: Array<{ strong: string; position: number }>;
    }>
  >();
  const unusable = new Set<number>();
  const words = ranges.map((range) => range.text);
  const positionsByStrong = new Map<string, number[]>();
  const ambiguous = new Set<string>();
  const untranslated = new Set<string>();
  let taggedCursor = 0;
  let plainOffset = 0;
  for (const match of tagged.matchAll(/<w\b([^>]*)>([\s\S]*?)<\/w>/giu)) {
    const index = match.index ?? 0;
    plainOffset += stripTags(tagged.slice(taggedCursor, index)).length;
    const attributes = match[1] ?? "";
    const inner = stripTags(match[2] ?? "");
    const start = plainOffset;
    const end = start + inner.length;
    plainOffset = end;
    taggedCursor = index + match[0].length;
    const strongs = (/\bstrong=(["'])(.*?)\1/iu.exec(attributes)?.[2] ?? "")
      .split(/\s+/u)
      .filter(Boolean)
      .map((code) => code.toUpperCase());
    const positions = (/\bpos="([^"]*)"/u.exec(attributes)?.[1] ?? "")
      .split("+")
      .filter((value) => /^\d+$/u.test(value))
      .map(Number);
    let pairs: Array<{ strong: string; position: number }> = [];
    if (!positions.length || !strongs.length) pairs = [];
    else if (strongs.length === positions.length)
      pairs = strongs.map((strong, i) => ({ strong, position: positions[i]! }));
    else if (strongs.length === 1)
      pairs = positions.map((position) => ({ strong: strongs[0]!, position }));
    else if (positions.length === 1)
      pairs = strongs.map((strong) => ({ strong, position: positions[0]! }));
    else {
      // « 7 700 » H7651 H0505 H3967 for positions 14 to 17: which number
      // goes with which position is left to STEP (an exact match only).
      pairs = strongs.flatMap((strong) =>
        positions.map((position) => ({ strong, position }))
      );
      for (const strong of strongs) ambiguous.add(looseStrong(strong));
    }
    if (
      strongs.length === positions.length ||
      strongs.length === 1 ||
      positions.length === 1
    )
      for (const pair of pairs) {
        const named = positionsByStrong.get(looseStrong(pair.strong)) ?? [];
        if (!named.includes(pair.position)) named.push(pair.position);
        positionsByStrong.set(looseStrong(pair.strong), named);
      }
    // An empty tag marks an untranslated word: it covers no witness word.
    const covered = inner.length
      ? ranges.flatMap((range, wordIndex) =>
          start < range.end && range.start < end ? [wordIndex] : []
        )
      : [];
    if (!inner.trim())
      for (const pair of pairs)
        untranslated.add(`${looseStrong(pair.strong)}#${pair.position}`);
    if (covered.length === 0 || !strongs.length) continue;
    // « 3 000 » is one number: its digit groups form one word.
    const digitGroups =
      covered.length > 1 &&
      /^\d{1,3}(?:[ \u00a0\u202f]\d{3})+$/u.test(inner.trim()) &&
      covered.every((wordIndex) => /^\d+$/u.test(ranges[wordIndex]!.text));
    if (covered.length > 1 && !digitGroups) {
      for (const wordIndex of covered) unusable.add(wordIndex);
      continue;
    }
    const wordIndex = covered[0]!;
    if (digitGroups) {
      words[wordIndex] = covered.map((i) => ranges[i]!.text).join("");
      for (const i of covered.slice(1)) {
        words[i] = "";
        unusable.add(i);
      }
    }
    if (!pairs.length) unusable.add(wordIndex);
    const tags = tagsByWord.get(wordIndex) ?? [];
    // An elided word glued in front (« d’Ében-Ézer ») is not part of the
    // compound: it is carried as a clitic (J).
    if (!(
      tags.length === 0 &&
      /[’']$/u.test(inner) &&
      start === ranges[wordIndex]!.start
    ))
      tags.push({ start, end, pairs });
    tagsByWord.set(wordIndex, tags);
  }
  for (const named of positionsByStrong.values()) named.sort((a, b) => a - b);
  const compounds: WitnessCompoundWord[] = [];
  for (const [wordIndex, tags] of tagsByWord) {
    if (unusable.has(wordIndex)) continue;
    // Several tags in one word are glued by hyphens only.
    if (
      tags.some(
        (tag, i) =>
          i > 0 && !/^[‐‑‒–—-]$/u.test(plain.slice(tags[i - 1]!.end, tag.start))
      )
    )
      continue;
    const members = new Map<string, { strong: string; position: number }>();
    for (const tag of tags)
      for (const pair of tag.pairs)
        members.set(`${looseStrong(pair.strong)}#${pair.position}`, pair);
    if (members.size >= 2)
      compounds.push({
        wordIndex,
        text: words[wordIndex]!,
        members: [...members.values()],
        pooled: tags.some(
          (tag) =>
            new Set(tag.pairs.map((pair) => looseStrong(pair.strong))).size > 1
        )
      });
  }
  return {
    words,
    positionsByStrong,
    unpairedStrongs: ambiguous,
    untranslated,
    compounds
  };
}

const hebrewMorphology = (value: string) =>
  /^[HA][A-Z]/u.test(value) && !/^[A-Z]+-/u.test(value);

/**
 * Content words of STEP: nouns, proper names, adjectives (numerals included)
 * and verbs. Articles, pronouns, particles, conjunctions, prepositions and
 * adverbs are left out: a French compound never renders them as a whole.
 */
export function contentMorphology(morphology: string): boolean {
  const value = morphology.trim();
  if (hebrewMorphology(value))
    return value
      .slice(1)
      .split("/")
      .some((part) => /^[NAV]/u.test(part));
  return /^[NAV]-/u.test(value);
}

/** STEP proper names and titles: Hebrew `Np`/`Nt`, Greek `N-…-P/L/T`. */
export function properNameMorphology(morphology: string): boolean {
  const value = morphology.trim();
  if (hebrewMorphology(value))
    return value
      .slice(1)
      .split("/")
      .some((part) => /^N[pt]/u.test(part));
  return /^N-(?:PRI|LI|OI|.*-(?:P|L|LG|PG|T))$/u.test(value);
}

const foldWord = (word: string) => normalizeWord(word.replace(/'/gu, "’"));

/**
 * Spelling key of a proper name: « Beer-Schéba » and « Beër-Shéba » meet.
 * Hyphens and silent letters are dropped, common transcription pairs
 * (sch/sh, ch/k, ph/f, th/t, y/i…) collapse.
 */
export function properNameKey(word: string): string {
  return foldWord(word)
    .replace(/[-’']/gu, "")
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

type MappedOccurrence = {
  unit: CompoundUnit;
  occurrenceId: string;
  strong: string;
};

/**
 * Source occurrences named by a witness, by Strong. A witness names a source
 * word by its verse and position, and only STEP words of that very verse are
 * named (another verse numbering never pairs positions). When one of its
 * positions for a Strong names no STEP word of that Strong (another numbering
 * of the words: « Saint-Esprit » in the Textus Receptus order, a verse STEP
 * divides otherwise), its positions and STEP's occurrences of that Strong in
 * the verse pair in order, provided both count alike.
 */
function witnessOccurrenceMap(
  units: CompoundUnit[],
  witness: CompoundWitness,
  reading: WitnessCompoundReading
): (member: {
  strong: string;
  position: number;
}) => MappedOccurrence | undefined {
  const byStrong = new Map<
    string,
    Array<MappedOccurrence & { position: number }>
  >();
  for (const unit of units)
    for (const occurrence of unit.occurrences) {
      const word = compoundSourceWord(occurrence.occurrenceId);
      if (!word || word.ref !== witness.ref) continue;
      const strong = looseStrong(occurrence.strong);
      const list = byStrong.get(strong) ?? [];
      list.push({
        unit,
        occurrenceId: occurrence.occurrenceId,
        strong: occurrence.strong,
        position: word.position
      });
      byStrong.set(strong, list);
    }
  for (const list of byStrong.values())
    list.sort((left, right) => left.position - right.position);
  const exact = (strong: string, position: number) => {
    const found = (byStrong.get(strong) ?? []).filter(
      (occurrence) => occurrence.position === position
    );
    return found.length === 1 ? found[0] : undefined;
  };
  const ordered = new Map<string, MappedOccurrence>();
  const reordered = new Set<string>();
  for (const [strong, positions] of reading.positionsByStrong) {
    const occurrences = byStrong.get(strong) ?? [];
    if (
      positions.some((position) => !exact(strong, position)) &&
      !reading.unpairedStrongs.has(strong) &&
      positions.length === occurrences.length &&
      new Set(occurrences.map((occurrence) => occurrence.position)).size ===
        occurrences.length
    ) {
      reordered.add(strong);
      positions.forEach((position, index) =>
        ordered.set(`${strong}#${position}`, occurrences[index]!)
      );
    }
  }
  return (member) => {
    const strong = looseStrong(member.strong);
    return reordered.has(strong)
      ? ordered.get(`${strong}#${member.position}`)
      : exact(strong, member.position);
  };
}

/**
 * Proposals of the pass for one target verse. Pure: the caller applies them.
 * Each source word gets at most one target word; nothing is proposed when two
 * witnesses disagree, when the target word would exceed `maxStrongPerWord`
 * numbers, or when it lies inside a phrase carrier.
 */
export function proposeCompoundTargetWords(input: {
  words: string[];
  units: CompoundUnit[];
  carriers: CompoundCarrier[];
  witnesses: CompoundWitness[];
  maxStrongPerWord: number;
  /** Occurrences whose state the ledger fixed (reviewed, not rendered). */
  fixedOccurrences?: ReadonlySet<string>;
}): CompoundTargetProposal[] {
  const target = input.words.map(foldWord);
  const targetKeys = input.words.map(properNameKey);
  const owners = new Map<string, CompoundUnit>();
  for (const unit of input.units)
    for (const occurrence of unit.occurrences)
      owners.set(occurrence.occurrenceId, unit);
  const carried = new Set<string>();
  // Target words already carrying an occurrence, by occurrence.
  const carriedWords = new Map<string, number>();
  for (const carrier of input.carriers) {
    const owner = carrier.originalOccurrenceId
      ? owners.get(carrier.originalOccurrenceId)
      : undefined;
    if (!owner) continue;
    carried.add(owner.id);
    if (
      carrier.kind !== "empty" &&
      carrier.startWordIndex !== undefined &&
      (carrier.endWordIndex ?? carrier.startWordIndex) ===
        carrier.startWordIndex
    )
      carriedWords.set(carrier.originalOccurrenceId!, carrier.startWordIndex);
  }

  const votes = new Map<
    string,
    MappedOccurrence & {
      words: Set<number>;
      witnesses: Set<string>;
      witnessWord: string;
      match: CompoundTargetProposal["match"];
    }
  >();
  const contradicted = new Set<string>();
  for (const witness of input.witnesses) {
    const reading = readWitnessCompounds(witness.taggedText);
    const occurrenceOf = witnessOccurrenceMap(input.units, witness, reading);
    // A witness leaving a source word untranslated contradicts any carrier.
    for (const key of reading.untranslated) {
      const [strong, position] = key.split("#");
      const entry = occurrenceOf({
        strong: strong!,
        position: Number(position)
      });
      if (entry) contradicted.add(entry.unit.id);
    }
    const folded = reading.words.map(foldWord);
    const keys = reading.words.map(properNameKey);
    for (const compound of reading.compounds) {
      const mapped = compound.members.map(occurrenceOf);
      if (!mapped.some(Boolean)) continue;
      // One tag pooling a function word with another (« leur » for the
      // article and ἴδιος) renders them together, not each of them.
      if (
        compound.pooled &&
        mapped.some(
          (entry) => entry && !contentMorphology(entry.unit.morphology)
        )
      )
        continue;
      const names = mapped.every(
        (entry) => !entry || properNameMorphology(entry.unit.morphology)
      );
      const own = folded[compound.wordIndex]!;
      const key = keys[compound.wordIndex]!;
      let match: CompoundTargetProposal["match"] = "word";
      let hits = target.flatMap((word, index) => (word === own ? [index] : []));
      let rank = folded
        .slice(0, compound.wordIndex)
        .filter((word) => word === own).length;
      let repeats = folded.filter((word) => word === own).length;
      if (!hits.length && names && key.length >= 3) {
        match = "name-spelling";
        hits = targetKeys.flatMap((word, index) =>
          word === key ? [index] : []
        );
        rank = keys
          .slice(0, compound.wordIndex)
          .filter((word) => word === key).length;
        repeats = keys.filter((word) => word === key).length;
      }
      if (!hits.length) continue;
      // The word occurs as often in the witness as in the target: occurrences
      // pair in order. Otherwise the only matching target word that already
      // carries one of this word's source words is this word.
      let wordIndex: number | undefined;
      if (hits.length === repeats) wordIndex = hits[rank];
      else {
        // Function words (« là » of « temps-là ») are no anchor: their
        // repeats are the ones most often swapped.
        const anchored = hits.filter((hit) =>
          mapped.some(
            (entry) =>
              entry &&
              contentMorphology(entry.unit.morphology) &&
              carriedWords.get(entry.occurrenceId) === hit
          )
        );
        if (anchored.length === 1) wordIndex = anchored[0];
      }
      if (wordIndex === undefined) continue;
      for (const entry of mapped) {
        if (!entry) continue;
        const vote = votes.get(entry.unit.id) ?? {
          ...entry,
          words: new Set<number>(),
          witnesses: new Set<string>(),
          witnessWord: compound.text,
          match
        };
        if (vote.occurrenceId !== entry.occurrenceId)
          contradicted.add(entry.unit.id);
        vote.words.add(wordIndex);
        vote.witnesses.add(witness.name);
        if (match === "word") vote.match = "word";
        votes.set(entry.unit.id, vote);
      }
    }
  }

  const visibleStrongs = new Map<number, Set<string>>();
  const insidePhrase = new Set<number>();
  for (const carrier of input.carriers) {
    if (carrier.kind === "empty" || carrier.startWordIndex === undefined)
      continue;
    const end = carrier.endWordIndex ?? carrier.startWordIndex;
    if (end !== carrier.startWordIndex)
      for (let i = carrier.startWordIndex; i <= end; i += 1)
        insidePhrase.add(i);
    else {
      const strongs = visibleStrongs.get(carrier.startWordIndex) ?? new Set();
      strongs.add(looseStrong(carrier.strong));
      visibleStrongs.set(carrier.startWordIndex, strongs);
    }
  }
  const proposals: CompoundTargetProposal[] = [];
  for (const unit of input.units) {
    const vote = votes.get(unit.id);
    if (
      !vote ||
      contradicted.has(unit.id) ||
      vote.words.size !== 1 ||
      unit.readingUnresolved ||
      carried.has(unit.id) ||
      !contentMorphology(unit.morphology) ||
      input.fixedOccurrences?.has(vote.occurrenceId)
    )
      continue;
    const wordIndex = [...vote.words][0]!;
    if (insidePhrase.has(wordIndex)) continue;
    const strongs = visibleStrongs.get(wordIndex) ?? new Set<string>();
    const shared = strongs.has(looseStrong(vote.strong));
    // The profile's limit holds for every word, numbers in digits included
    // (« 6800 » shows at most that many of its numbers).
    if (!shared && strongs.size >= input.maxStrongPerWord) continue;
    strongs.add(looseStrong(vote.strong));
    visibleStrongs.set(wordIndex, strongs);
    proposals.push({
      sourceUnitId: unit.id,
      occurrenceId: vote.occurrenceId,
      strong: vote.strong,
      wordIndex,
      carrier: shared ? "shared" : "new",
      match: vote.match,
      witnesses: [...vote.witnesses].sort(),
      witnessWord: vote.witnessWord
    });
  }
  return proposals;
}

/** Diagnostic of a carrier this pass shares with the visible number of its word. */
export const COMPOUND_SHARED_CARRIER = "compound-shared-carrier";

/**
 * A hidden carrier that a source word shares with the reader carrier of the
 * same number on its compound word (the second half of « Béthel »). The
 * resolver counts it as that source word's placement; the reader shows the
 * number once.
 */
export function isCompoundSharedCarrier(
  annotation: StrongLedgerAnnotation
): boolean {
  return (
    annotation.placement === "duplicate" &&
    annotation.wordIndex !== undefined &&
    annotation.diagnostics[0] === COMPOUND_TARGET_WORD_METHOD &&
    annotation.diagnostics.includes(COMPOUND_SHARED_CARRIER)
  );
}

/**
 * Policy N pass over one verse of the ledger. It adds reader carriers, so the
 * ledger runs it before its reader baseline, once the lexical fixed point is
 * reached and alternative identifiers are reduced, with the source readings
 * the resolver will see (`applyCompoundTargetWordsToVerse`). The annotation
 * the alignment kept for the source occurrence (advanced or hidden) becomes
 * its carrier: no occurrence gains a second annotation. A shared carrier is a
 * hidden duplicate, as the engine hides any repeat of a number on its word:
 * reader and advanced views show « H1008 » once on « Béthel ».
 */
export function applyCompoundTargetWords(options: {
  ref: string;
  tokens: Array<{ text: string; normalized: string }>;
  annotations: StrongLedgerAnnotation[];
  units: CompoundUnit[];
  witnesses: CompoundWitness[];
  maxStrongPerWord: number;
}): CompoundTargetProposal[] {
  const carriers: CompoundCarrier[] = options.annotations.flatMap(
    (annotation): CompoundCarrier[] => {
      // A shared carrier of an earlier run carries its source word too.
      if (isCompoundSharedCarrier(annotation))
        return [
          {
            strong: annotation.strong,
            kind: "word",
            originalOccurrenceId: annotation.originalOccurrenceId,
            startWordIndex: annotation.wordIndex,
            endWordIndex: annotation.wordIndex
          }
        ];
      if (annotation.visibility !== "reader") return [];
      if (annotation.placement === "word" && annotation.wordIndex !== undefined)
        return [
          {
            strong: annotation.strong,
            kind: "word",
            originalOccurrenceId: annotation.originalOccurrenceId,
            startWordIndex: annotation.wordIndex,
            endWordIndex: annotation.wordIndex
          }
        ];
      if (
        annotation.placement === "phrase" &&
        annotation.startWordIndex !== undefined
      )
        return [
          {
            strong: annotation.strong,
            kind: "phrase",
            originalOccurrenceId: annotation.originalOccurrenceId,
            startWordIndex: annotation.startWordIndex,
            endWordIndex: annotation.endWordIndex
          }
        ];
      if (annotation.placement === "empty")
        return [
          {
            strong: annotation.strong,
            kind: "empty",
            originalOccurrenceId: annotation.originalOccurrenceId
          }
        ];
      return [];
    }
  );
  // The occurrence's own advanced or hidden annotation becomes its carrier
  // (the alignment's estimate: a word, an empty or a duplicate first, else a
  // phrase). An occurrence in a reviewed state (pending, rejected) or that the
  // ledger does not render (technical, not-rendered) keeps it.
  const convertibleOf = new Map<string, StrongLedgerAnnotation[]>();
  const annotated = new Set<string>();
  for (const annotation of options.annotations) {
    if (!annotation.originalOccurrenceId) continue;
    annotated.add(annotation.originalOccurrenceId);
    if (
      (annotation.visibility === "advanced" ||
        annotation.visibility === "hidden") &&
      ["word", "empty", "duplicate", "phrase"].includes(annotation.placement)
    )
      convertibleOf.set(annotation.originalOccurrenceId, [
        ...(convertibleOf.get(annotation.originalOccurrenceId) ?? []),
        annotation
      ]);
  }
  const proposals = proposeCompoundTargetWords({
    words: options.tokens.map((token) => token.text),
    units: options.units,
    carriers,
    witnesses: options.witnesses,
    maxStrongPerWord: options.maxStrongPerWord,
    fixedOccurrences: new Set(
      [...annotated].filter((id) => !convertibleOf.has(id))
    )
  });
  const ids = new Set(options.annotations.map((annotation) => annotation.id));
  for (const proposal of proposals) {
    const shared = proposal.carrier === "shared";
    const convertible = convertibleOf.get(proposal.occurrenceId) ?? [];
    let annotation =
      convertible.find((candidate) => candidate.placement !== "phrase") ??
      convertible[0];
    if (!annotation) {
      let index = options.annotations.length;
      while (ids.has(`${options.ref}:${index}:${proposal.strong}`)) index += 1;
      annotation = {
        id: `${options.ref}:${index}:${proposal.strong}`,
        strong: proposal.strong,
        visibility: "hidden",
        placement: "duplicate",
        source: "reference-transfer",
        confidence: 0,
        reason: "",
        diagnostics: [],
        originalOccurrenceId: proposal.occurrenceId
      };
      ids.add(annotation.id);
      options.annotations.push(annotation);
    }
    annotation.strong = proposal.strong.toUpperCase();
    annotation.visibility = shared ? "hidden" : "reader";
    annotation.placement = shared ? "duplicate" : "word";
    annotation.source = "reference-transfer";
    annotation.confidence = Math.max(annotation.confidence, 0.9);
    annotation.reason = shared
      ? "Shares the reader carrier of the same number on this word: the witnesses render this source word and another one by this one word."
      : "Visible in reader mode because the target writes, as often as a witness, the word by which that witness renders this source word together with others.";
    annotation.diagnostics = [
      ...new Set([
        COMPOUND_TARGET_WORD_METHOD,
        ...(shared ? [COMPOUND_SHARED_CARRIER] : []),
        ...(proposal.match === "name-spelling" ? ["name-spelling"] : []),
        `witness-word:${proposal.witnessWord}`,
        `witnesses:${proposal.witnesses.join("+")}`,
        ...annotation.diagnostics
      ])
    ];
    annotation.wordIndex = proposal.wordIndex;
    annotation.normalizedWord = options.tokens[proposal.wordIndex]?.normalized;
    annotation.startWordIndex = undefined;
    annotation.endWordIndex = undefined;
    annotation.normalizedPhrase = undefined;
    annotation.insertAfterWordIndex = undefined;
    annotation.emptyEvidence = undefined;
  }
  return proposals;
}
