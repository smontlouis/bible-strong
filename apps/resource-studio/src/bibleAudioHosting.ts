import { BOOK_CHAPTER_COUNTS } from "./bibleAudioPlaces.js";

/**
 * Plans the hosting of a recording a publisher lent with leave to host it (ADR-0117): its files,
 * named as the publisher named them, become one address per chapter on the media host. Every
 * chapter it covers (the whole Bible, or the books of `covers`) must be found exactly once; for a
 * whole Bible, a file the plan does not name is reported.
 */

export type HostedRecordingConfig = {
  /** The recording of the catalog these files are heard as. */
  recording: string;
  /** Where the chapters go in the bucket: `bible-audio/<recording>/v1`. */
  prefix: string;
  logo?: { file: string; key: string };
  /** The publisher's name of each book's files, without the chapter: `bible_jms_exode`. */
  books: Record<string, number>;
  /** The publisher's files left out on purpose, with why. */
  leftOut?: Record<string, string>;
  /**
   * The books of a partial recording, as the catalog lists them: only their chapters must be
   * found, and the other files, which belong to other recordings, are not reported.
   */
  covers?: number[];
};

export type HostedChapter = {
  book: number;
  chapter: number;
  key: string;
  file: string;
};

const FILE_PATTERN = /^(.*?)(?:_(\d+))?\.mp3$/i;

const pad = (value: number, width: number) =>
  String(value).padStart(width, "0");

/** The bucket key of a chapter: `<prefix>/01_001.mp3`, as `{book:2}_{chapter:3}` asks. */
export const hostedChapterKey = (
  prefix: string,
  book: number,
  chapter: number
) => `${prefix}/${pad(book, 2)}_${pad(chapter, 3)}.mp3`;

/** The address template the catalog gives the recording. */
export const hostedTemplate = (mediaOrigin: string, prefix: string) =>
  `${mediaOrigin}/${prefix}/{book:2}_{chapter:3}.mp3`;

/**
 * The chapter of each file, by the plan's book names; the same chapter found twice must be the
 * same bytes (`sameBytes`), as when an archive repeats a folder.
 */
export const planHostedChapters = (
  config: HostedRecordingConfig,
  files: string[],
  sameBytes: (a: string, b: string) => boolean
): { chapters: HostedChapter[]; unknown: string[] } => {
  const leftOut = new Set(Object.keys(config.leftOut ?? {}));
  const byKey = new Map<string, HostedChapter>();
  const unknown: string[] = [];
  for (const file of files) {
    const name = file.split("/").at(-1) ?? file;
    const match = FILE_PATTERN.exec(name);
    if (!match) continue;
    // A one-chapter book's file is named for the book alone, even when the name ends in a number.
    const whole = name.replace(/\.mp3$/i, "");
    const isWholeBook = whole in config.books || leftOut.has(whole);
    const bookName = isWholeBook ? whole : match[1]!;
    const book = config.books[bookName];
    if (!book) {
      if (!leftOut.has(bookName) && !config.covers) unknown.push(file);
      continue;
    }
    const chapter = isWholeBook ? 1 : Number(match[2] ?? 1);
    const count = BOOK_CHAPTER_COUNTS[book - 1] ?? 0;
    if (chapter < 1 || chapter > count)
      throw new Error(
        `BIBLE_AUDIO_HOSTED_CHAPTER: ${file} is chapter ${chapter} of book ${book}, which has ${count}.`
      );
    const key = hostedChapterKey(config.prefix, book, chapter);
    const seen = byKey.get(key);
    if (seen && !sameBytes(seen.file, file))
      throw new Error(
        `BIBLE_AUDIO_HOSTED_TWICE: ${seen.file} and ${file} are both book ${book} chapter ${chapter}.`
      );
    if (!seen) byKey.set(key, { book, chapter, key, file });
  }

  const missing: string[] = [];
  BOOK_CHAPTER_COUNTS.forEach((count, index) => {
    if (config.covers && !config.covers.includes(index + 1)) return;
    for (let chapter = 1; chapter <= count; chapter++)
      if (!byKey.has(hostedChapterKey(config.prefix, index + 1, chapter)))
        missing.push(`${index + 1}:${chapter}`);
  });
  if (missing.length)
    throw new Error(
      `BIBLE_AUDIO_HOSTED_MISSING: no file for ${missing.slice(0, 20).join(", ")}${missing.length > 20 ? ` and ${missing.length - 20} more` : ""}.`
    );

  const chapters = [...byKey.values()].sort(
    (a, b) => a.book - b.book || a.chapter - b.chapter
  );
  return { chapters, unknown };
};
