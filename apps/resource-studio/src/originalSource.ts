import { readFile } from "node:fs/promises";

import { bookNumberToId } from "./books.js";
import { referenceKey } from "./strongCsv.js";

export interface OriginalToken {
  id: string;
  text: string;
  strong: string[];
  sourceStrong?: string[];
  gloss: string;
  lemma: string;
  pos: string;
  morph: string;
}

export interface OriginalVerse {
  bookId: string;
  chapter: number;
  verse: number;
  tokens: OriginalToken[];
  strongSet: Set<string>;
}

export type OriginalVerseMap = Map<string, OriginalVerse>;

export interface OriginalSourceSummary {
  name: string;
  path: string;
  license: string;
  url: string;
  verses: number;
  tokens: number;
}

export async function readOriginalSourceTsv(
  path: string
): Promise<OriginalVerseMap> {
  const content = await readFile(path, "utf8");
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const header = lines.shift()?.split("\t") ?? [];
  const indexes = indexHeader(header, path);
  const verses: OriginalVerseMap = new Map();

  for (const line of lines) {
    const columns = line.split("\t");
    const id = columns[indexes.id] ?? "";
    const ref = parseOriginalTokenId(id);

    if (!ref) {
      continue;
    }

    const sourceStrong = parseSourceStrongList(columns[indexes.strongs] ?? "");
    const strong = sourceStrong
      .map(normalizeOriginalStrong)
      .filter((strong): strong is string => Boolean(strong));
    const key = referenceKey(ref.bookId, ref.chapter, ref.verse);
    const existing =
      verses.get(key) ??
      ({
        bookId: ref.bookId,
        chapter: ref.chapter,
        verse: ref.verse,
        tokens: [],
        strongSet: new Set<string>()
      } satisfies OriginalVerse);

    existing.tokens.push({
      id,
      text: columns[indexes.text] ?? "",
      strong,
      sourceStrong,
      gloss: columns[indexes.gloss] ?? "",
      lemma: columns[indexes.lemma] ?? "",
      pos: columns[indexes.pos] ?? "",
      morph: columns[indexes.morph] ?? ""
    });

    for (const strongCode of strong) {
      existing.strongSet.add(strongCode);
    }

    verses.set(key, existing);
  }

  return verses;
}

export function summarizeOriginalSource(
  name: string,
  path: string,
  map: OriginalVerseMap,
  metadata: Pick<OriginalSourceSummary, "license" | "url">
): OriginalSourceSummary {
  return {
    name,
    path,
    ...metadata,
    verses: map.size,
    tokens: [...map.values()].reduce(
      (sum, verse) => sum + verse.tokens.length,
      0
    )
  };
}

function indexHeader(header: string[], path: string): Record<string, number> {
  const required = ["id", "text", "strongs", "gloss", "lemma", "pos", "morph"];
  const indexes: Record<string, number> = {};

  for (const name of required) {
    const index = header.indexOf(name);
    if (index === -1) {
      throw new Error(`Missing column ${name} in original source TSV ${path}`);
    }
    indexes[name] = index;
  }

  return indexes;
}

function parseOriginalTokenId(
  id: string
): { bookId: string; chapter: number; verse: number } | undefined {
  const match = id.match(/^[no](\d{2})(\d{3})(\d{3})/u);
  if (!match) {
    return undefined;
  }

  const [, bookNumber, chapter, verse] = match;

  if (!bookNumber || !chapter || !verse) {
    return undefined;
  }

  return {
    bookId: bookNumberToId(String(Number.parseInt(bookNumber, 10))),
    chapter: Number.parseInt(chapter, 10),
    verse: Number.parseInt(verse, 10)
  };
}

function parseSourceStrongList(value: string): string[] {
  return value.split(/[ ,]+/u).map(normalizeSourceStrong).filter(Boolean);
}

function normalizeSourceStrong(strong: string): string {
  return strong.trim().replace(/^([hg])/u, (prefix) => prefix.toUpperCase());
}

export function normalizeOriginalStrong(strong: string): string | undefined {
  const match = strong
    .trim()
    .toUpperCase()
    .match(/^([HG])0*(\d{1,5})(?:[A-Z])?(?:_[A-Z])?$/u);
  if (!match) return undefined;
  return `${match[1]}${match[2].padStart(4, "0")}`;
}
