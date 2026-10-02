import { readFile } from "node:fs/promises";

import { stripTags, tokenizeText } from "./tokenize.js";

export interface StrongRow {
  bookId: string;
  chapter: number;
  verse: number;
  text: string;
}

export interface StrongToken {
  text: string;
  normalized: string;
  strong: string[];
  /**
   * Ordinal of the `<w>` element in the verse when that element spans several
   * words: a whole locution carries one occurrence.
   */
  element?: number;
  /** The word of a locution element that represents its occurrence. */
  elementHead?: boolean;
}

/**
 * Whether a witness token stands for its occurrence when words are counted or
 * learned one by one: a locution counts once, through its head word.
 */
export const representsOccurrence = (token: StrongToken): boolean =>
  token.element === undefined || token.elementHead === true;

export interface StrongVerse {
  row: StrongRow;
  tokens: StrongToken[];
}

export type StrongVerseMap = Map<string, StrongVerse>;

export function referenceKey(
  bookId: string,
  chapter: number | string,
  verse: number | string
): string {
  return `${bookId}.${chapter}.${verse}`;
}

export async function readStrongCsv(path: string): Promise<StrongRow[]> {
  const content = await readFile(path, "utf8");
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const header = lines.shift();

  if (header !== "book_id\tnum_chapter\tnum_verse\ttext") {
    throw new Error(`Unexpected Strong CSV header in ${path}: ${header}`);
  }

  return lines.map((line, lineIndex) => {
    const [bookId, chapter, verse, ...textParts] = line.split("\t");
    const text = textParts.join("\t");

    if (!bookId || !chapter || !verse) {
      throw new Error(`Invalid Strong CSV line ${lineIndex + 2} in ${path}`);
    }

    return {
      bookId,
      chapter: Number.parseInt(chapter, 10),
      verse: Number.parseInt(verse, 10),
      text
    };
  });
}

export function parseStrongTokens(text: string): StrongToken[] {
  const tokens: StrongToken[] = [];
  const wordTagPattern = /<w\b([^>]*)>([\s\S]*?)<\/w>/giu;
  let cursor = 0;
  let element = 0;

  for (const match of text.matchAll(wordTagPattern)) {
    const index = match.index ?? 0;

    if (index > cursor) {
      addPlainTokens(tokens, text.slice(cursor, index));
    }

    const attributes = match[1] ?? "";
    const innerText = stripTags(match[2] ?? "");
    const strong = parseStrongAttribute(attributes);
    const words = tokenizeText(innerText).flatMap((segment) =>
      segment.kind === "word" && segment.normalized ? [segment] : []
    );

    // The word the CSV export tagged, or the first word without that mark.
    const head = /\bhead="([^"]*)"/u.exec(attributes)?.[1];
    const headWord =
      head === undefined
        ? undefined
        : tokenizeText(head).flatMap((segment) =>
            segment.kind === "word" ? [segment.normalized] : []
          )[0];
    const headIndex = Math.max(
      0,
      words.findIndex((segment) => segment.normalized === headWord)
    );
    for (const [index, segment] of words.entries()) {
      tokens.push({
        text: segment.text,
        normalized: segment.normalized,
        strong,
        ...(words.length > 1
          ? { element, ...(index === headIndex ? { elementHead: true } : {}) }
          : {})
      });
    }

    element += 1;
    cursor = index + match[0].length;
  }

  if (cursor < text.length) {
    addPlainTokens(tokens, text.slice(cursor));
  }

  return tokens;
}

export function parseStrongOccurrences(text: string): string[] {
  const occurrences: string[] = [];
  const wordTagPattern = /<w\b([^>]*)>([\s\S]*?)<\/w>/giu;

  for (const match of text.matchAll(wordTagPattern)) {
    const attributes = match[1] ?? "";
    occurrences.push(...parseStrongAttribute(attributes));
  }

  return occurrences;
}

export function buildStrongVerseMap(rows: StrongRow[]): StrongVerseMap {
  const map: StrongVerseMap = new Map();

  for (const row of rows) {
    map.set(referenceKey(row.bookId, row.chapter, row.verse), {
      row,
      tokens: parseStrongTokens(row.text)
    });
  }

  return map;
}

function addPlainTokens(tokens: StrongToken[], text: string): void {
  const plainText = stripTags(text);

  for (const segment of tokenizeText(plainText)) {
    if (segment.kind === "word" && segment.normalized) {
      tokens.push({
        text: segment.text,
        normalized: segment.normalized,
        strong: []
      });
    }
  }
}

function parseStrongAttribute(attributes: string): string[] {
  const match = attributes.match(/\bstrong=(["'])(.*?)\1/i);
  const value = match?.[2] ?? "";

  return value
    .split(/\s+/)
    .map((strong) => strong.trim())
    .filter(Boolean);
}
