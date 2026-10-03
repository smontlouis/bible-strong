/**
 * Numbers matched by value (O). A number is the same number however a Bible
 * writes it: Segond 1910 « quatre mille six cents » (four tags) and Darby
 * « 4 600 » (one tag) are S21 « 4600 »; Segond « trente-trois » (two tags
 * joined by a hyphen) is NEG « trente-trois » (one word); « vingt-quatrième »
 * and « 24e » are the same ordinal. The witnesses' numeral, read as a whole
 * with a French number grammar, gives all its source words to the one target
 * word (or digit group « 4 600 ») that writes the same value.
 *
 * The match is narrow. The value occurs once in the target and once in the
 * witness (repeated digit values pair in order when both sides count them
 * alike); every number word of the witness numeral is tagged, by numeral
 * Strong numbers; a cardinal « un/une » is an article too often to count;
 * numbers next to a modern unit (« 25 mètres ») or to an ancient measure the
 * target drops (« vingt coudées ») are left alone, as S21 converts them; and
 * a target word or witness word already carried elsewhere is never moved.
 *
 * The carrier shows numbers as option N does: each Strong number once (the
 * second « six » of « 666 » stays without a carrier, or shares N's hidden
 * duplicate), and no more numbers than the profile allows on a word, a digit
 * group included (« 6800 » shows its first numbers, the ones its word already
 * shows kept first); the source words left out stay as they were.
 */
import {
  isConfirmedByOriginal,
  scoreWithOriginal,
  sourceWithOriginal,
  type AlignmentResult,
  type AssignedStrong,
  type OriginalConstraint,
  type ReferenceSource
} from "./align.js";
import type { OriginalStrongOccurrence } from "./completeAlignment.js";
import {
  ANCIENT_MEASURES,
  MODERN_UNITS,
  numeralKey,
  numeralRuns,
  textWords,
  witnessText,
  type FrenchNumeral,
  type TextWord,
  type WitnessTag
} from "./frenchNumerals.js";
import { normalizeOriginalStrong } from "./originalSource.js";

/** English glosses (STEP) that name a number. */
const NUMERAL_GLOSS_WORDS = new Set([
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
  // « eight- teen » (H8083 H6240)
  "teen",
  "teenth",
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
  "hundred",
  "hundreds",
  "thousand",
  "thousands",
  "myriad",
  "myriads",
  "first",
  "second",
  "third",
  "fourth",
  "fifth",
  "sixth",
  "seventh",
  "eighth",
  "ninth",
  "tenth",
  "eleventh",
  "twelfth",
  "twentieth",
  "thirtieth",
  "fortieth",
  "fiftieth",
  "hundredth",
  "thousandth"
]);

/** Whether a STEP gloss names a number, word by word (« one's own » does not). */
export function isNumeralGloss(gloss: string): boolean {
  return gloss
    .toLowerCase()
    .split(/[^a-z'’]+/u)
    .some((word) => NUMERAL_GLOSS_WORDS.has(word));
}

interface WitnessNumeral {
  numeral?: FrenchNumeral;
  /** Usable for a transfer: wholly tagged, numeral Strong numbers, no dropped measure. */
  usable: boolean;
  tags: WitnessTag[];
  /** Words of the number, with their spans in the witness text. */
  words: TextWord[];
}

function witnessNumerals(options: {
  tagged: string;
  targetFolded: Set<string>;
  numeralStrong?: (strong: string) => boolean;
}): WitnessNumeral[] {
  const { text, tags } = witnessText(options.tagged);
  const words = textWords(text);
  return numeralRuns(words).map((run) => {
    const start = words[run.first]!.start;
    const end = words[run.last]!.end;
    // An empty tag inside the number (« vingt<w></w>-troisième ») is a word
    // the witness leaves untranslated, not part of the number.
    const runTags = tags.filter(
      (tag) => tag.start < tag.end && tag.start < end && start < tag.end
    );
    // Every number word of the run, hyphen part by hyphen part, is inside a
    // tag (« <w>vingt</w>-<w>quatrième</w> »), and no tag reaches outside.
    let covered =
      runTags.length > 0 &&
      runTags.every((tag) => tag.start >= start && tag.end <= end);
    for (let index = run.first; covered && index <= run.last; index += 1) {
      const word = words[index]!;
      if (word.folded === "et") continue;
      let offset = word.start;
      for (const part of word.text.split(/([‐‑‒–—-])/u)) {
        const partEnd = offset + part.length;
        if (
          part &&
          !/^[‐‑‒–—-]$/u.test(part) &&
          !runTags.some(
            (tag) =>
              tag.start <= offset && partEnd <= tag.end && tag.strong.length
          )
        )
          covered = false;
        offset = partEnd;
      }
    }
    // A measure that the target drops may have been converted (« coudées »).
    const measure = words
      .slice(run.last + 1, run.last + 3)
      .find((word) => ANCIENT_MEASURES.has(word.folded));
    const usable =
      run.numeral !== undefined &&
      covered &&
      (!options.numeralStrong ||
        runTags.every((tag) => tag.strong.every(options.numeralStrong!))) &&
      (!measure || options.targetFolded.has(measure.folded));
    return {
      numeral: run.numeral,
      usable,
      tags: runTags,
      words: words.slice(run.first, run.last + 1)
    };
  });
}

interface TargetNumeral {
  startWordIndex: number;
  endWordIndex: number;
  numeral?: FrenchNumeral;
  eligible: boolean;
  /** Folded words of the number. */
  words: string[];
  /** Several words in letters (« cent trente-sept »), carried word by word. */
  spelledWords: boolean;
}

function targetNumerals(
  words: TextWord[],
  phrasesAllowed: boolean
): TargetNumeral[] {
  return numeralRuns(words).map((run) => {
    const numeral = run.numeral;
    const single = run.first === run.last;
    // « 4 600 »: one number in several digit words, carried as one phrase.
    const digitGroup =
      !single &&
      numeral?.digits === true &&
      words
        .slice(run.first + 1, run.last + 1)
        .every((word) => /^[\s\u00a0\u202f\u2009]$/u.test(word.gap));
    const before = words[run.first - 1];
    const after = words[run.last + 1];
    // « 2,5 », « 1.5 »: a fragment of a decimal number.
    const decimal =
      (before !== undefined &&
        /^\d/u.test(before.folded) &&
        /^[.,]$/u.test(words[run.first]!.gap)) ||
      (after !== undefined &&
        /^\d/u.test(after.folded) &&
        /^[.,]$/u.test(after.gap));
    const unit = words
      .slice(run.last + 1, run.last + 3)
      .some((word) => MODERN_UNITS.has(word.folded));
    const spelledWords = !single && numeral?.digits === false;
    return {
      startWordIndex: run.first,
      endWordIndex: run.last,
      numeral,
      eligible:
        numeral !== undefined &&
        (single || (digitGroup && phrasesAllowed) || spelledWords) &&
        !(numeral.value === 1 && !numeral.ordinal) &&
        !decimal &&
        !unit,
      words: words.slice(run.first, run.last + 1).map((word) => word.folded),
      spelledWords
    };
  });
}

interface NumeralVote {
  reference: ReferenceSource;
  witness: WitnessNumeral;
}

function witnessRef(reference: ReferenceSource): string {
  const row = reference.verse!.row;
  return `${row.bookId}.${row.chapter}.${row.verse}`;
}

/** `<Strong>|<ref>#<position>` keys of the source words of a witness numeral. */
function memberKeys(reference: ReferenceSource, witness: WitnessNumeral) {
  const ref = witnessRef(reference);
  return witness.tags.flatMap((tag) =>
    tag.strong.flatMap((strong, index) =>
      (tag.strong.length === tag.positions.length
        ? [tag.positions[index]!]
        : tag.positions
      ).map((position) => `${strong}|${ref}#${position}`)
    )
  );
}

/**
 * Gives the source words of a witness numeral to the target word, or digit
 * group, that writes the same value (O). Runs on the witness transfer of
 * words and locutions (`alignVerse`); never moves an existing carrier.
 */
export function addNumeralValueCarriers(options: {
  result: AlignmentResult;
  references: ReferenceSource[];
  original?: OriginalConstraint;
  /** STEP words of the verse: which Strong numbers are numerals, and how many. */
  originalOccurrences?: OriginalStrongOccurrence[];
  witnessPositions?: boolean;
  /** Numbers a target word (or digit group) may show (translation profile). */
  maxStrongPerWord?: number;
}): void {
  const { result } = options;
  const words = textWords(
    result.segments.map((segment) => segment.text).join("")
  );
  if (words.length !== result.wordCount) return;
  const targets = targetNumerals(words, result.locutions !== undefined);
  if (!targets.some((target) => target.eligible)) return;
  const targetFolded = new Set(words.map((word) => word.folded));

  // A Strong number is a numeral when every source word of the verse that
  // has it is glossed as a number (καί of δεκαοκτώ is still « and »).
  const originalCounts = new Map<string, number>();
  const otherOriginals = new Set<string>();
  for (const occurrence of options.originalOccurrences ?? []) {
    const strong = normalizeOriginalStrong(occurrence.strong);
    if (!strong) continue;
    originalCounts.set(strong, (originalCounts.get(strong) ?? 0) + 1);
    if (!isNumeralGloss(occurrence.gloss)) otherOriginals.add(strong);
  }
  const numeralStrong = options.originalOccurrences
    ? (strong: string) => {
        const normalized = normalizeOriginalStrong(strong) ?? strong;
        return (
          originalCounts.has(normalized) && !otherOriginals.has(normalized)
        );
      }
    : undefined;

  const byValue = <T extends { numeral?: FrenchNumeral }>(items: T[]) => {
    const groups = new Map<string, T[]>();
    for (const item of items)
      if (item.numeral) {
        const key = numeralKey(item.numeral);
        groups.set(key, [...(groups.get(key) ?? []), item]);
      }
    return groups;
  };
  const targetsByValue = byValue(targets);

  // Each witness votes when the value is unique on both sides, or when
  // repeated digit values pair in order because both sides count them alike.
  const votes = new Map<TargetNumeral, NumeralVote[]>();
  const witnessesOfKey = new Map<string, WitnessNumeral[]>();
  for (const reference of options.references) {
    if (!reference.verse) continue;
    const witnesses = witnessNumerals({
      tagged: reference.verse.row.text,
      targetFolded,
      numeralStrong
    });
    for (const witness of witnesses)
      for (const key of memberKeys(reference, witness))
        witnessesOfKey.set(key, [...(witnessesOfKey.get(key) ?? []), witness]);
    const witnessesByValue = byValue(witnesses);
    for (const [value, sameTargets] of targetsByValue) {
      const same = witnessesByValue.get(value) ?? [];
      const paired =
        same.length === sameTargets.length &&
        (same.length === 1 ||
          sameTargets.every((target) => target.numeral!.digits)) &&
        same.every((witness) => witness.usable);
      if (!paired) continue;
      for (const [index, target] of sameTargets.entries())
        if (target.eligible)
          votes.set(target, [
            ...(votes.get(target) ?? []),
            { reference, witness: same[index]! }
          ]);
    }
  }

  // A source word that a witness writes in another value vetoes the match;
  // one source word never goes to two target numerals.
  const vetoed = new Set<TargetNumeral>();
  const targetsOfKey = new Map<string, Set<TargetNumeral>>();
  for (const [target, targetVotes] of votes)
    for (const { reference, witness } of targetVotes)
      for (const key of memberKeys(reference, witness)) {
        if (
          (witnessesOfKey.get(key) ?? []).some(
            (other) =>
              !other.numeral ||
              numeralKey(other.numeral) !== numeralKey(target.numeral!)
          )
        )
          vetoed.add(target);
        targetsOfKey.set(
          key,
          new Set([...(targetsOfKey.get(key) ?? []), target])
        );
      }
  for (const owners of targetsOfKey.values())
    if (owners.size > 1) for (const owner of owners) vetoed.add(owner);

  for (const [target, targetVotes] of votes) {
    if (vetoed.has(target)) continue;
    const strongSets = targetVotes.map(
      (vote) => new Set(vote.witness.tags.flatMap((tag) => tag.strong))
    );
    const strongSet = strongSets[0]!;
    if (
      !strongSet.size ||
      strongSets.some(
        (set) =>
          set.size !== strongSet.size ||
          [...set].some((strong) => !strongSet.has(strong))
      )
    )
      continue;
    const strong = numeralStrongList(targetVotes, originalCounts);
    if (!strong.length) continue;
    const keys = new Set(
      targetVotes.flatMap(({ reference, witness }) =>
        memberKeys(reference, witness)
      )
    );
    if (claimedElsewhere(result, target, keys)) continue;
    const sourcePositions = options.witnessPositions
      ? [
          ...new Set(
            targetVotes.flatMap(({ reference, witness }) =>
              witness.tags.flatMap((tag) =>
                tag.positions.map(
                  (position) => `${witnessRef(reference)}#${position}`
                )
              )
            )
          )
        ]
      : [];
    const label = `${[
      ...new Set(targetVotes.map((vote) => vote.reference.name))
    ].join("+")}~numeral-value`;
    const carrier = (values: string[], positions: string[]) => ({
      strong: values,
      confidence: scoreWithOriginal(0.93, values, options.original),
      source: sourceWithOriginal(label, values, options.original),
      method: "exact" as const,
      originalConfirmed: isConfirmedByOriginal(values, options.original),
      ...(positions.length ? { sourcePositions: positions } : {})
    });
    const shown = (values: string[], span: WordSpan) =>
      shownNumeralStrongs(
        values,
        heldStrongs(result, span),
        options.maxStrongPerWord ?? Infinity
      );
    if (!target.spelledWords) {
      if (placeable(result, target, strongSet))
        placeNumeral(
          result,
          target,
          carrier(shown(strong, target), sourcePositions)
        );
      continue;
    }
    // « cent trente-sept » in the target and in a witness: word by word.
    const words = wordByWordCarriers({
      target,
      votes: targetVotes,
      originalCounts,
      witnessPositions: options.witnessPositions === true
    });
    if (
      words?.every((word) => placeable(result, word.span, new Set(word.strong)))
    )
      for (const word of words)
        placeNumeral(
          result,
          word.span,
          carrier(shown(word.strong, word.span), word.positions)
        );
  }
}

/**
 * Carriers of a number written in several words, word by word, from the
 * witnesses that write it with the same words; the witnesses agree on each
 * word's Strong numbers.
 */
function wordByWordCarriers(options: {
  target: TargetNumeral;
  votes: NumeralVote[];
  originalCounts: Map<string, number>;
  witnessPositions: boolean;
}):
  Array<{ span: WordSpan; strong: string[]; positions: string[] }> | undefined {
  const { target } = options;
  const inside = (tag: WitnessTag, word: TextWord) =>
    word.start <= tag.start && tag.end <= word.end;
  const perVote = options.votes
    .filter(
      ({ witness }) =>
        witness.words.length === target.words.length &&
        witness.words.every(
          (word, index) => word.folded === target.words[index]
        ) &&
        witness.tags.every((tag) =>
          witness.words.some((word) => inside(tag, word))
        )
    )
    .map(({ reference, witness }) =>
      witness.words.map((word) => {
        const tags = witness.tags.filter((tag) => inside(tag, word));
        return {
          strong: tags.flatMap((tag) => tag.strong),
          positions: tags.flatMap((tag) =>
            tag.positions.map(
              (position) => `${witnessRef(reference)}#${position}`
            )
          )
        };
      })
    );
  const first = perVote[0];
  if (!first) return undefined;
  const sameSet = (left: string[], right: string[]) =>
    new Set(left).size === new Set(right).size &&
    left.every((value) => right.includes(value));
  if (
    perVote.some((words) =>
      words.some((word, index) => !sameSet(word.strong, first[index]!.strong))
    )
  )
    return undefined;
  const totals = new Map<string, number>();
  for (const value of first.flatMap((word) => word.strong))
    totals.set(value, (totals.get(value) ?? 0) + 1);
  if (
    options.originalCounts.size &&
    [...totals].some(
      ([value, count]) => count > (options.originalCounts.get(value) ?? 0)
    )
  )
    return undefined;
  return first.flatMap((word, index) =>
    word.strong.length
      ? [
          {
            span: {
              startWordIndex: target.startWordIndex + index,
              endWordIndex: target.startWordIndex + index
            },
            strong: word.strong,
            positions: options.witnessPositions
              ? [
                  ...new Set(
                    perVote.flatMap((words) => words[index]!.positions)
                  )
                ]
              : []
          }
        ]
      : []
  );
}

/**
 * Strong numbers of the numeral: those of the most detailed witness, each as
 * many times as a witness tags it (« sept mille sept cents »: H7651 twice),
 * at most as many times as the source verse has it. The carrier shows each
 * once (`shownNumeralStrongs`).
 */
function numeralStrongList(
  votes: NumeralVote[],
  originalCounts: Map<string, number>
): string[] {
  const lists = votes.map((vote) =>
    vote.witness.tags.flatMap((tag) => tag.strong)
  );
  const counts = (list: string[]) => {
    const map = new Map<string, number>();
    for (const strong of list) map.set(strong, (map.get(strong) ?? 0) + 1);
    return map;
  };
  const base = [...lists].sort((left, right) => right.length - left.length)[0]!;
  const wanted = counts(base);
  for (const list of lists)
    for (const [strong, count] of counts(list))
      wanted.set(strong, Math.max(wanted.get(strong) ?? 0, count));
  const strong: string[] = [];
  const placed = new Map<string, number>();
  const add = (value: string) => {
    const limit = Math.min(
      wanted.get(value) ?? 0,
      originalCounts.size ? (originalCounts.get(value) ?? 0) : Infinity
    );
    if ((placed.get(value) ?? 0) >= limit) return;
    placed.set(value, (placed.get(value) ?? 0) + 1);
    strong.push(value);
  };
  for (const value of base) add(value);
  for (const [value, count] of wanted)
    for (let index = 0; index < count; index += 1) add(value);
  return strong;
}

/** Strong numbers the words of a span already show. */
function heldStrongs(result: AlignmentResult, span: WordSpan): string[] {
  const held: string[] = [];
  for (let index = span.startWordIndex; index <= span.endWordIndex; index += 1)
    held.push(...(result.assignments.get(index)?.strong ?? []));
  return held;
}

/**
 * The numbers a numeral carrier shows, as N shows them: each Strong once, and
 * at most `maxStrongPerWord`: those its words already show first (a carrier
 * is never taken away), then in the witness's order.
 */
export function shownNumeralStrongs(
  strong: readonly string[],
  held: readonly string[],
  maxStrongPerWord: number
): string[] {
  const key = (value: string) => value.toUpperCase();
  const distinct = strong.filter(
    (value, index) =>
      strong.findIndex((other) => key(other) === key(value)) === index
  );
  const heldKeys = new Set(held.map(key));
  const kept = new Set(
    distinct.filter((value) => heldKeys.has(key(value))).map(key)
  );
  for (const value of distinct) {
    if (kept.size >= maxStrongPerWord) break;
    kept.add(key(value));
  }
  return distinct.filter((value) => kept.has(key(value)));
}

/** Whether a source word of the numeral is already carried by another word. */
function claimedElsewhere(
  result: AlignmentResult,
  target: TargetNumeral,
  keys: Set<string>
): boolean {
  const inside = (start: number, end: number) =>
    start >= target.startWordIndex && end <= target.endWordIndex;
  const carriers: AssignedStrong[] = [
    ...[...result.assignments]
      .filter(([wordIndex]) => !inside(wordIndex, wordIndex))
      .map(([, assignment]) => assignment),
    ...(result.locutions ?? [])
      .filter(
        (locution) => !inside(locution.startWordIndex, locution.endWordIndex)
      )
      .map((locution) => locution.assignment)
  ];
  return carriers.some((carrier) =>
    carrier.strong.some((strong) =>
      (carrier.sourcePositions ?? []).some((position) =>
        keys.has(`${strong.toUpperCase()}|${position}`)
      )
    )
  );
}

interface WordSpan {
  startWordIndex: number;
  endWordIndex: number;
}

/**
 * Whether a numeral carrier may go on its words: no locution there, and no
 * word carrying anything but part of the same number (« trente » of
 * « trente-trois »), which the carrier completes.
 */
function placeable(
  result: AlignmentResult,
  span: WordSpan,
  strongSet: Set<string>
): boolean {
  const { startWordIndex: start, endWordIndex: end } = span;
  if (
    (result.locutions ?? []).some(
      (locution) =>
        locution.startWordIndex <= end && start <= locution.endWordIndex
    )
  )
    return false;
  for (let index = start; index <= end; index += 1) {
    const current = result.assignments.get(index);
    if (
      current &&
      (current.locutions?.length ||
        current.locutionMemberOnly ||
        current.strong.some((strong) => !strongSet.has(strong.toUpperCase())))
    )
      return false;
  }
  return true;
}

/**
 * Puts a placeable numeral carrier on its word, or on its digit group as one
 * phrase. A word already carrying the whole number keeps its own carrier.
 */
function placeNumeral(
  result: AlignmentResult,
  span: WordSpan,
  assignment: AssignedStrong
): void {
  const { startWordIndex: start, endWordIndex: end } = span;
  const existing: AssignedStrong[] = [];
  for (let index = start; index <= end; index += 1) {
    const current = result.assignments.get(index);
    if (current) existing.push(current);
  }
  if (start === end && existing.length) {
    const held = existing[0]!.strong.map((strong) => strong.toUpperCase());
    if (
      assignment.strong.every((strong, index) => {
        const needed = assignment.strong
          .slice(0, index + 1)
          .filter((value) => value === strong).length;
        return held.filter((value) => value === strong).length >= needed;
      })
    )
      return;
  }
  const sourcePositions = [
    ...new Set([
      ...(assignment.sourcePositions ?? []),
      ...existing.flatMap((current) => current.sourcePositions ?? [])
    ])
  ];
  const carrier: AssignedStrong = {
    ...assignment,
    confidence: Math.max(
      assignment.confidence,
      ...existing.map((current) => current.confidence)
    ),
    ...(sourcePositions.length ? { sourcePositions } : {})
  };
  if (start === end) {
    result.assignments.set(start, carrier);
    return;
  }
  for (let index = start; index <= end; index += 1)
    result.assignments.delete(index);
  result.locutions!.push({
    startWordIndex: start,
    endWordIndex: end,
    assignment: carrier
  });
}
