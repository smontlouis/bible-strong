import type { StrongToken } from "./strongCsv.js";

/** A locution that the witnesses tag as one element somewhere in the Bible. */
export interface WitnessLocution {
  /** Normalized words, apostrophes written « ’ » as in the witnesses. */
  words: string[];
  strongs: ReadonlySet<string>;
  count: number;
}

/** Witness locutions by first word, longest first. */
export type WitnessLocutionLexicon = ReadonlyMap<string, WitnessLocution[]>;

/** Witness spelling of a normalized word (« jusqu'a » → « jusqu’a »). */
export const witnessForm = (normalized: string) =>
  normalized.replace(/'/gu, "’");

/**
 * Multi-word witness tags of the whole Bible (« jusqu’à ce que », « en
 * effet », « fleur de farine »), kept when the witnesses use them at least
 * `minCount` times.
 */
export function buildWitnessLocutionLexicon(
  verses: Iterable<{ tokens: StrongToken[] }>,
  minCount = 3
): WitnessLocutionLexicon {
  const byKey = new Map<
    string,
    { words: string[]; strongs: Set<string>; count: number }
  >();
  for (const verse of verses) {
    const elements = new Map<number, { words: string[]; strong: string[] }>();
    for (const token of verse.tokens) {
      if (token.element === undefined || !token.strong.length) continue;
      const element = elements.get(token.element) ?? {
        words: [],
        strong: token.strong
      };
      element.words.push(witnessForm(token.normalized));
      elements.set(token.element, element);
    }
    for (const { words, strong } of elements.values()) {
      if (words.length < 2 || words.some((word) => !word)) continue;
      const key = words.join(" ");
      const entry = byKey.get(key) ?? {
        words,
        strongs: new Set<string>(),
        count: 0
      };
      entry.count += 1;
      for (const code of strong) entry.strongs.add(code.toUpperCase());
      byKey.set(key, entry);
    }
  }
  const lexicon = new Map<string, WitnessLocution[]>();
  for (const entry of byKey.values()) {
    if (entry.count < minCount) continue;
    lexicon.set(entry.words[0]!, [
      ...(lexicon.get(entry.words[0]!) ?? []),
      entry
    ]);
  }
  for (const locutions of lexicon.values())
    locutions.sort(
      (left, right) =>
        right.words.length - left.words.length ||
        left.words.join(" ").localeCompare(right.words.join(" "))
    );
  return lexicon;
}
