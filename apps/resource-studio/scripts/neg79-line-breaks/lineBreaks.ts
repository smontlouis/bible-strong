/**
 * The NEG79 source lost the internal line breaks of its poetic and quoted
 * lines when it was converted: « écoutez ma voix!\nFemmes » became
 * « écoutez ma voix!Femmes ». Every poetic line starts with a capital, so a
 * lost break is a capital glued to the preceding word or punctuation; prose
 * resuming after a quotation starts in lower case right after punctuation.
 *
 * The repair restores the separator the other French Bibles use inside a
 * verse ("\n "): the reader shows a line break, and text-only views that drop
 * "\n" keep a space between the words.
 */
export const LINE_BREAK = "\n ";

export type LostLineBreakRule =
  /** « voix!Femmes », « blessure,Et », « malheureux…L'Eternel » */
  | "punctuation-capital"
  /** « cielEt », « EternelQue » */
  | "word-capital"
  /** « Emmanuel,ce qui signifie » : prose resuming after a quotation. */
  | "punctuation-lower";

export interface LostLineBreak {
  /** UTF-16 offset in the source verse where the separator is inserted. */
  offset: number;
  rule: LostLineBreakRule;
}

export interface UnrepairedJoin {
  offset: number;
  reason:
    /** « : …Vaheb » : punctuation opening a quotation, not a line end. */
    | "punctuation-after-space"
    /** A capital glued to another character (« L ‘Eternel »), left for review. */
    | "other-glued-capital";
}

const UPPER = "A-ZÀÂÄÇÉÈÊËÎÏÔÖÛÙÜŸŒÆ";
const LOWER = "a-zàâäçéèêëîïôöûùüÿœæ";
const LINE_END_PUNCTUATION = ",;:.!?…)";
const GLUED_CAPITAL = new RegExp(
  `(?<=[^\\s${UPPER}${LOWER}'’«(\\[-])(?=[${UPPER}])`,
  "gu"
);
const PUNCTUATION_CAPITAL = new RegExp(
  `(?<=[${LINE_END_PUNCTUATION}])(?=[${UPPER}])`,
  "gu"
);
const WORD_CAPITAL = new RegExp(`(?<=[${LOWER}])(?=[${UPPER}])`, "gu");
const PUNCTUATION_LOWER = new RegExp(
  `(?<=[${LINE_END_PUNCTUATION}])(?=[${LOWER}])`,
  "gu"
);

/** Lost line breaks of one verse, in text order, and joins left for review. */
export function findLostLineBreaks(text: string): {
  breaks: LostLineBreak[];
  unrepaired: UnrepairedJoin[];
} {
  const breaks: LostLineBreak[] = [];
  const unrepaired: UnrepairedJoin[] = [];
  const add = (offset: number, rule: LostLineBreakRule) => {
    // The punctuation itself must close a word: « : …Vaheb » opens a quote.
    if (rule !== "word-capital" && /\s/u.test(text[offset - 2] ?? " ")) {
      unrepaired.push({ offset, reason: "punctuation-after-space" });
      return;
    }
    breaks.push({ offset, rule });
  };
  for (const match of text.matchAll(PUNCTUATION_CAPITAL))
    add(match.index, "punctuation-capital");
  for (const match of text.matchAll(WORD_CAPITAL))
    add(match.index, "word-capital");
  for (const match of text.matchAll(PUNCTUATION_LOWER))
    add(match.index, "punctuation-lower");
  const handled = new Set([
    ...breaks.map((entry) => entry.offset),
    ...unrepaired.map((entry) => entry.offset)
  ]);
  for (const match of text.matchAll(GLUED_CAPITAL))
    if (!handled.has(match.index))
      unrepaired.push({ offset: match.index, reason: "other-glued-capital" });
  breaks.sort((left, right) => left.offset - right.offset);
  unrepaired.sort((left, right) => left.offset - right.offset);
  return { breaks, unrepaired };
}

export function restoreLineBreaks(
  text: string,
  breaks: readonly LostLineBreak[]
): string {
  let restored = "";
  let cursor = 0;
  for (const { offset } of breaks) {
    restored += text.slice(cursor, offset) + LINE_BREAK;
    cursor = offset;
  }
  return restored + text.slice(cursor);
}

/**
 * Moves a half-open span of the source verse onto the restored verse. A
 * separator inserted at the span start stays before it; one inserted at the
 * span end stays after it.
 */
export function mapSpanAcrossLineBreaks(
  [start, end]: readonly [number, number],
  breaks: readonly LostLineBreak[]
): [number, number] {
  const before = (limit: number, inclusive: boolean) =>
    breaks.filter(({ offset }) =>
      inclusive ? offset <= limit : offset < limit
    ).length * LINE_BREAK.length;
  return [start + before(start, true), end + before(end, false)];
}
