import { readFile } from "node:fs/promises";

import { bookNumberToId } from "./books.js";

export interface BibleVerse {
  bookNumber: string;
  bookId: string;
  chapter: number;
  verse: number;
  text: string;
}

type BibleJson = Record<string, Record<string, Record<string, string>>>;

export async function readBibleJson(path: string): Promise<BibleVerse[]> {
  const content = await readFile(path, "utf8");
  const bible = JSON.parse(content) as BibleJson;
  const verses: BibleVerse[] = [];

  for (const bookNumber of numericKeys(bible)) {
    const bookId = bookNumberToId(bookNumber);
    const book = bible[bookNumber];

    if (!book) {
      continue;
    }

    for (const chapterKey of numericKeys(book)) {
      const chapter = book[chapterKey];

      if (!chapter) {
        continue;
      }

      for (const verseKey of numericKeys(chapter)) {
        const text = chapter[verseKey];

        if (typeof text === "string") {
          verses.push({
            bookNumber,
            bookId,
            chapter: Number.parseInt(chapterKey, 10),
            verse: Number.parseInt(verseKey, 10),
            text
          });
        }
      }
    }
  }

  return verses;
}

function numericKeys<T>(record: Record<string, T>): string[] {
  return Object.keys(record).sort(
    (a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10)
  );
}
