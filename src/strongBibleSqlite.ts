import { createHash } from "node:crypto";
import { createReadStream, existsSync, statSync } from "node:fs";
import { mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";
import { DatabaseSync } from "node:sqlite";

import { BOOK_IDS } from "./books.js";

export const STRONG_BIBLE_SQLITE_SCHEMA_VERSION = 3;
export const STRONG_BIBLE_SQLITE_BUILDER_VERSION =
  "strong-bible-jsonl-sqlite@3";

export type StrongIdentityKind = "strong" | "estrong" | "dstrong" | "ustrong";

export interface StrongBibleJsonlVerse {
  ref: string;
  version: string;
  book: number;
  bookId: string;
  chapter: number;
  verse: number;
  text: string;
  headings?: StrongBibleJsonlHeading[];
}

export interface StrongBibleJsonlHeading {
  offset: number;
  order: number;
  kind: "pericope" | "heading" | "parallel";
  type: string;
  text: string;
  markup: string;
  attributes?: Record<string, string>;
}

export interface StrongBibleSqliteSummary {
  schemaVersion: number;
  builderVersion: string;
  datasetId: string;
  version: string;
  sourcePath: string;
  sourceSha256: string;
  outputPath: string;
  outputSha256: string;
  outputBytes: number;
  verseCount: number;
  occurrenceCount: number;
  identityCount: number;
  lexemeAssignmentCount: number;
  lexemeCount: number;
  noteCount: number;
  integrityCheck: "ok";
}

interface ParsedMarkup {
  canonicalText: string;
  layout: MarkupEvent[];
  runs: MarkupEvent[];
  notes: ParsedNote[];
  occurrences: ParsedOccurrence[];
}

interface MarkupEvent {
  offset: number;
  order: number;
  type: "open" | "close" | "self";
  tag: string;
  attributes: Record<string, string>;
}

type StoredMarkupEvent = [
  offset: number,
  order: number,
  type: 0 | 1 | 2,
  tag: number,
  attributes?: Record<string, string>
];

interface ParsedNote {
  offset: number;
  order: number;
  kind: "note" | "reference";
  markup: string;
}

interface ParsedOccurrence {
  ordinal: number;
  startOffset: number;
  endOffset: number;
  openOrder: number;
  closeOrder: number;
  surface: string;
  lexeme?: {
    lemma: string;
    partOfSpeech: string;
  };
  identities: Array<{
    kind: StrongIdentityKind;
    code: string;
    family: "hebrew" | "greek";
  }>;
}

interface OpenOccurrence {
  ordinal: number;
  startOffset: number;
  openOrder: number;
  lexeme?: ParsedOccurrence["lexeme"];
  identities: ParsedOccurrence["identities"];
}

const LAYOUT_TAGS = new Set(["p", "l", "lg", "list", "item"]);
const RUN_TAGS = new Set([
  "i",
  "divinename",
  "small-caps",
  "sup",
  "red",
  "q",
  "span"
]);
const IDENTITY_KINDS: StrongIdentityKind[] = [
  "strong",
  "estrong",
  "dstrong",
  "ustrong"
];
const IDENTITY_KIND_CODES: Record<StrongIdentityKind, number> = {
  strong: 0,
  estrong: 1,
  dstrong: 2,
  ustrong: 3
};
const IDENTITY_CODE_KINDS = [
  "strong",
  "estrong",
  "dstrong",
  "ustrong"
] as const satisfies readonly StrongIdentityKind[];
const MARKUP_TAGS = [
  "p",
  "l",
  "lg",
  "i",
  "divineName",
  "small-caps",
  "sup",
  "red",
  "q",
  "span",
  "list",
  "item"
] as const;

export async function compileStrongBibleJsonlToSqlite(options: {
  inputPath: string;
  outputPath: string;
  datasetId: string;
  expectedVersion: string;
}): Promise<StrongBibleSqliteSummary> {
  const inputPath = path.resolve(options.inputPath);
  const outputPath = path.resolve(options.outputPath);
  if (!existsSync(inputPath)) {
    throw new Error(`strong-bible-jsonl-missing:${inputPath}`);
  }
  await mkdir(path.dirname(outputPath), { recursive: true });
  const temporary = `${outputPath}.tmp-${process.pid}`;
  await rm(temporary, { force: true });

  const sourceSha256 = await sha256File(inputPath);
  const database = new DatabaseSync(temporary);
  let verseCount = 0;
  let occurrenceCount = 0;
  let identityCount = 0;
  let lexemeAssignmentCount = 0;
  let noteCount = 0;
  try {
    createSchema(database);
    const insertVerse = database.prepare(`
      INSERT INTO Verses(
        bookOrder, chapter, verse, canonicalText, markupJson
      ) VALUES (?, ?, ?, ?, ?)
    `);
    const insertOccurrence = database.prepare(`
      INSERT INTO WordSpans(
        verseId, ordinal, startOffset, length, openOrder, closeOrder, lexemeId
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const insertLexeme = database.prepare(`
      INSERT OR IGNORE INTO FrenchLexemes(lemma, partOfSpeech) VALUES (?, ?)
    `);
    const selectLexeme = database.prepare(`
      SELECT id FROM FrenchLexemes WHERE lemma=? AND partOfSpeech=?
    `);
    const insertStrongCode = database.prepare(`
      INSERT INTO StrongCodes(kind, code) VALUES (?, ?)
    `);
    const insertWordStrongCode = database.prepare(`
      INSERT INTO WordStrongCodes(verseId, ordinal, identityOrder, codeId)
      VALUES (?, ?, ?, ?)
    `);
    const insertNote = database.prepare(`
      INSERT INTO VerseNotes(verseId, noteIndex, offset, eventOrder, kind, markup)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const strongCodeIds = new Map<string, number>();

    database.exec("BEGIN IMMEDIATE");
    try {
      let previousOrder = -1;
      for await (const verse of streamStrongBibleJsonl(inputPath)) {
        if (verse.version !== options.expectedVersion) {
          throw new Error(
            `strong-bible-jsonl-version-mismatch:${verse.ref}:${verse.version}:${options.expectedVersion}`
          );
        }
        const bookOrder = BOOK_IDS.indexOf(
          verse.bookId as (typeof BOOK_IDS)[number]
        );
        if (bookOrder < 0 || verse.book !== bookOrder + 1) {
          throw new Error(`strong-bible-jsonl-invalid-book:${verse.ref}`);
        }
        const canonicalOrder =
          bookOrder * 1_000_000 + verse.chapter * 1_000 + verse.verse;
        if (canonicalOrder <= previousOrder) {
          throw new Error(`strong-bible-jsonl-noncanonical-order:${verse.ref}`);
        }
        previousOrder = canonicalOrder;

        const parsed = parseStrongBibleMarkup(verse.text);
        const verseResult = insertVerse.run(
          bookOrder + 1,
          verse.chapter,
          verse.verse,
          parsed.canonicalText,
          JSON.stringify(
            [...parsed.layout, ...parsed.runs]
              .sort((left, right) => left.order - right.order)
              .map(storeMarkupEvent)
          )
        );
        const verseId = Number(verseResult.lastInsertRowid);
        verseCount += 1;

        for (const occurrence of parsed.occurrences) {
          let lexemeId: number | null = null;
          if (occurrence.lexeme) {
            insertLexeme.run(
              occurrence.lexeme.lemma,
              occurrence.lexeme.partOfSpeech
            );
            lexemeId = Number(
              (
                selectLexeme.get(
                  occurrence.lexeme.lemma,
                  occurrence.lexeme.partOfSpeech
                ) as { id: number }
              ).id
            );
            lexemeAssignmentCount += 1;
          }
          insertOccurrence.run(
            verseId,
            occurrence.ordinal,
            occurrence.startOffset,
            occurrence.endOffset - occurrence.startOffset,
            occurrence.openOrder,
            occurrence.closeOrder,
            lexemeId
          );
          occurrenceCount += 1;
          for (const [
            identityOrder,
            identity
          ] of occurrence.identities.entries()) {
            const cacheKey = `${identity.kind}\u0000${identity.code}`;
            let codeId = strongCodeIds.get(cacheKey);
            if (codeId === undefined) {
              codeId = Number(
                insertStrongCode.run(
                  IDENTITY_KIND_CODES[identity.kind],
                  identity.code
                ).lastInsertRowid
              );
              strongCodeIds.set(cacheKey, codeId);
            }
            insertWordStrongCode.run(
              verseId,
              occurrence.ordinal,
              identityOrder,
              codeId
            );
            identityCount += 1;
          }
        }
        for (const [index, note] of parsed.notes.entries()) {
          insertNote.run(
            verseId,
            index,
            note.offset,
            note.order,
            note.kind === "note" ? 0 : 1,
            note.markup
          );
          noteCount += 1;
        }
      }

      writeMetadata(database, {
        datasetId: options.datasetId,
        version: options.expectedVersion,
        sourcePath: path.relative(process.cwd(), inputPath),
        sourceSha256,
        verseCount,
        occurrenceCount,
        identityCount,
        lexemeAssignmentCount,
        lexemeCount: Number(
          (
            database
              .prepare("SELECT COUNT(*) AS count FROM FrenchLexemes")
              .get() as { count: number }
          ).count
        ),
        noteCount
      });
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
    database.exec("ANALYZE");
    database.exec("VACUUM");
  } finally {
    database.close();
  }

  const verification = verifyStrongBibleSqlite({
    sqlitePath: temporary,
    expectedDatasetId: options.datasetId,
    expectedVersion: options.expectedVersion,
    expectedSourceSha256: sourceSha256
  });
  await rm(outputPath, { force: true });
  await rename(temporary, outputPath);
  return {
    schemaVersion: STRONG_BIBLE_SQLITE_SCHEMA_VERSION,
    builderVersion: STRONG_BIBLE_SQLITE_BUILDER_VERSION,
    datasetId: options.datasetId,
    version: options.expectedVersion,
    sourcePath: inputPath,
    sourceSha256,
    outputPath,
    outputSha256: await sha256File(outputPath),
    outputBytes: statSync(outputPath).size,
    ...verification
  };
}

export function verifyStrongBibleSqlite(options: {
  sqlitePath: string;
  expectedDatasetId?: string;
  expectedVersion?: string;
  expectedSourceSha256?: string;
}): {
  verseCount: number;
  occurrenceCount: number;
  identityCount: number;
  lexemeAssignmentCount: number;
  lexemeCount: number;
  noteCount: number;
  integrityCheck: "ok";
} {
  const database = new DatabaseSync(options.sqlitePath, {
    readOnly: true
  });
  try {
    const integrity = String(
      (
        database.prepare("PRAGMA integrity_check").get() as Record<
          string,
          unknown
        >
      ).integrity_check
    );
    if (integrity !== "ok") {
      throw new Error(`strong-bible-sqlite-integrity:${integrity}`);
    }
    const metadata = Object.fromEntries(
      (
        database.prepare("SELECT key, value FROM ResourceMetadata").all() as {
          key: string;
          value: string;
        }[]
      ).map(({ key, value }) => [key, value])
    );
    if (Number(metadata.schemaVersion) !== STRONG_BIBLE_SQLITE_SCHEMA_VERSION) {
      throw new Error(
        `strong-bible-sqlite-schema-mismatch:${metadata.schemaVersion}:${STRONG_BIBLE_SQLITE_SCHEMA_VERSION}`
      );
    }
    for (const [key, expected] of [
      ["datasetId", options.expectedDatasetId],
      ["version", options.expectedVersion],
      ["sourceSha256", options.expectedSourceSha256]
    ] as const) {
      if (expected && metadata[key] !== expected) {
        throw new Error(
          `strong-bible-sqlite-metadata-mismatch:${key}:${metadata[key]}:${expected}`
        );
      }
    }
    const counts = database
      .prepare(
        `
        SELECT
          (SELECT COUNT(*) FROM Verses) AS verseCount,
          (SELECT COUNT(*) FROM WordSpans) AS occurrenceCount,
          (SELECT COUNT(*) FROM WordStrongCodes) AS identityCount,
          (SELECT COUNT(*) FROM WordSpans WHERE lexemeId IS NOT NULL)
            AS lexemeAssignmentCount,
          (SELECT COUNT(*) FROM FrenchLexemes) AS lexemeCount,
          (SELECT COUNT(*) FROM VerseNotes) AS noteCount
      `
      )
      .get() as Record<string, number>;
    if (
      counts.verseCount <= 0 ||
      counts.occurrenceCount <= 0 ||
      counts.identityCount <= 0
    ) {
      throw new Error("strong-bible-sqlite-empty");
    }
    const invalidRanges = Number(
      (
        database
          .prepare(
            `
            SELECT COUNT(*) AS count
            FROM WordSpans o
            JOIN Verses v ON v.id=o.verseId
            WHERE o.startOffset < 0
               OR o.length < 0
               OR o.startOffset + o.length > length(v.canonicalText)
          `
          )
          .get() as { count: number }
      ).count
    );
    if (invalidRanges !== 0) {
      throw new Error(`strong-bible-sqlite-invalid-ranges:${invalidRanges}`);
    }
    const invalidIdentities = Number(
      (
        database
          .prepare(
            `
            SELECT COUNT(*) AS count
            FROM WordStrongCodes w
            LEFT JOIN WordSpans o
              ON o.verseId=w.verseId AND o.ordinal=w.ordinal
            LEFT JOIN StrongCodes c ON c.id=w.codeId
            WHERE o.verseId IS NULL OR c.id IS NULL
          `
          )
          .get() as { count: number }
      ).count
    );
    if (invalidIdentities !== 0) {
      throw new Error(
        `strong-bible-sqlite-invalid-identities:${invalidIdentities}`
      );
    }
    const invalidLexemes = Number(
      (
        database
          .prepare(
            `
            SELECT COUNT(*) AS count
            FROM WordSpans o
            LEFT JOIN FrenchLexemes l ON l.id=o.lexemeId
            WHERE o.lexemeId IS NOT NULL AND l.id IS NULL
          `
          )
          .get() as { count: number }
      ).count
    );
    if (invalidLexemes !== 0) {
      throw new Error(`strong-bible-sqlite-invalid-lexemes:${invalidLexemes}`);
    }
    return {
      verseCount: Number(counts.verseCount),
      occurrenceCount: Number(counts.occurrenceCount),
      identityCount: Number(counts.identityCount),
      lexemeAssignmentCount: Number(counts.lexemeAssignmentCount),
      lexemeCount: Number(counts.lexemeCount),
      noteCount: Number(counts.noteCount),
      integrityCheck: "ok"
    };
  } finally {
    database.close();
  }
}

export function readStrongBibleSqliteChapter(options: {
  sqlitePath: string;
  bookId: string;
  chapter: number;
}): StrongBibleJsonlVerse[] {
  const database = new DatabaseSync(options.sqlitePath, { readOnly: true });
  try {
    const bookOrder =
      BOOK_IDS.indexOf(options.bookId as (typeof BOOK_IDS)[number]) + 1;
    if (bookOrder <= 0) return [];
    const version = String(
      (
        database
          .prepare(
            "SELECT value FROM ResourceMetadata WHERE key='version' LIMIT 1"
          )
          .get() as { value: string }
      ).value
    );
    const rows = database
      .prepare(
        `
        SELECT id, bookOrder, chapter, verse, canonicalText, markupJson
        FROM Verses
        WHERE bookOrder=? AND chapter=?
        ORDER BY verse
      `
      )
      .all(bookOrder, options.chapter) as Array<{
      id: number;
      bookOrder: number;
      chapter: number;
      verse: number;
      canonicalText: string;
      markupJson: string;
    }>;
    const occurrenceStatement = database.prepare(`
      SELECT o.ordinal, o.startOffset, o.length, o.openOrder, o.closeOrder,
             l.lemma, l.partOfSpeech,
             w.identityOrder, c.kind, c.code
      FROM WordSpans o
      LEFT JOIN FrenchLexemes l ON l.id=o.lexemeId
      LEFT JOIN WordStrongCodes w
        ON w.verseId=o.verseId AND w.ordinal=o.ordinal
      LEFT JOIN StrongCodes c ON c.id=w.codeId
      WHERE o.verseId=?
      ORDER BY o.ordinal, w.identityOrder
    `);
    const noteStatement = database.prepare(`
      SELECT noteIndex, offset, eventOrder, kind, markup
      FROM VerseNotes WHERE verseId=? ORDER BY noteIndex
    `);
    return rows.map((row) => {
      const occurrenceRows = occurrenceStatement.all(row.id) as Array<{
        ordinal: number;
        startOffset: number;
        length: number;
        openOrder: number;
        closeOrder: number;
        lemma: string | null;
        partOfSpeech: string | null;
        identityOrder: number | null;
        kind: number | null;
        code: string | null;
      }>;
      const occurrenceMap = new Map<
        number,
        {
          ordinal: number;
          startOffset: number;
          endOffset: number;
          openOrder: number;
          closeOrder: number;
          identities: Array<{ kind: StrongIdentityKind; code: string }>;
          lexeme?: { lemma: string; partOfSpeech: string };
        }
      >();
      for (const occurrence of occurrenceRows) {
        let value = occurrenceMap.get(occurrence.ordinal);
        if (!value) {
          value = {
            ordinal: occurrence.ordinal,
            startOffset: occurrence.startOffset,
            endOffset: occurrence.startOffset + occurrence.length,
            openOrder: occurrence.openOrder,
            closeOrder: occurrence.closeOrder,
            ...(occurrence.lemma !== null && occurrence.partOfSpeech !== null
              ? {
                  lexeme: {
                    lemma: occurrence.lemma,
                    partOfSpeech: occurrence.partOfSpeech
                  }
                }
              : {}),
            identities: []
          };
          occurrenceMap.set(occurrence.ordinal, value);
        }
        if (occurrence.kind !== null && occurrence.code !== null) {
          value.identities.push({
            kind: IDENTITY_CODE_KINDS[occurrence.kind]!,
            code: occurrence.code
          });
        }
      }
      const notes = (
        noteStatement.all(row.id) as Array<{
          noteIndex: number;
          offset: number;
          eventOrder: number;
          kind: number;
          markup: string;
        }>
      ).map((note) => ({
        ...note,
        kind: note.kind === 0 ? ("note" as const) : ("reference" as const)
      }));
      const bookId = BOOK_IDS[row.bookOrder - 1]!;
      return {
        ref: `${bookId}.${row.chapter}.${row.verse}`,
        version,
        book: row.bookOrder,
        bookId,
        chapter: row.chapter,
        verse: row.verse,
        text: renderStrongBibleMarkup({
          canonicalText: row.canonicalText,
          events: (JSON.parse(row.markupJson) as StoredMarkupEvent[]).map(
            restoreMarkupEvent
          ),
          notes,
          occurrences: [...occurrenceMap.values()]
        })
      };
    });
  } finally {
    database.close();
  }
}

export function readStrongBibleSqliteInfo(sqlitePath: string): {
  datasetId: string;
  version: string;
  sourceSha256: string;
  verseCount: number;
  occurrenceCount: number;
  identityCount: number;
  lexemeAssignmentCount: number;
  lexemeCount: number;
  lemmaDatasetVersion?: string;
  books: Array<{ bookId: string; chapters: number[]; verseCount: number }>;
} {
  const database = new DatabaseSync(sqlitePath, { readOnly: true });
  try {
    const metadata = Object.fromEntries(
      (
        database.prepare("SELECT key, value FROM ResourceMetadata").all() as {
          key: string;
          value: string;
        }[]
      ).map(({ key, value }) => [key, value])
    );
    const rows = database
      .prepare(
        `
        SELECT bookOrder, chapter, COUNT(*) AS verseCount
        FROM Verses
        GROUP BY bookOrder, chapter
        ORDER BY bookOrder, chapter
      `
      )
      .all() as Array<{
      bookOrder: number;
      chapter: number;
      verseCount: number;
    }>;
    const books = new Map<string, { chapters: number[]; verseCount: number }>();
    for (const row of rows) {
      const bookId = BOOK_IDS[row.bookOrder - 1];
      if (!bookId) continue;
      const book = books.get(bookId) ?? { chapters: [], verseCount: 0 };
      book.chapters.push(row.chapter);
      book.verseCount += Number(row.verseCount);
      books.set(bookId, book);
    }
    return {
      datasetId: metadata.datasetId ?? "",
      version: metadata.version ?? "",
      sourceSha256: metadata.sourceSha256 ?? "",
      verseCount: Number(metadata.verseCount ?? 0),
      occurrenceCount: Number(metadata.occurrenceCount ?? 0),
      identityCount: Number(metadata.identityCount ?? 0),
      lexemeAssignmentCount: Number(metadata.lexemeAssignmentCount ?? 0),
      lexemeCount: Number(
        (
          database
            .prepare("SELECT COUNT(*) AS count FROM FrenchLexemes")
            .get() as { count: number }
        ).count
      ),
      ...(metadata.lemmaDatasetVersion
        ? { lemmaDatasetVersion: metadata.lemmaDatasetVersion }
        : {}),
      books: BOOK_IDS.filter((bookId) => books.has(bookId)).map((bookId) => ({
        bookId,
        ...books.get(bookId)!
      }))
    };
  } finally {
    database.close();
  }
}

export function queryStrongBibleConcordance(options: {
  sqlitePath: string;
  kind: StrongIdentityKind;
  code: string;
  bookId?: string;
  lemma?: string;
  partOfSpeech?: string;
  limit?: number;
  offset?: number;
}): {
  total: number;
  items: Array<{
    ref: string;
    bookId: string;
    chapter: number;
    verse: number;
    surface: string;
    startOffset: number;
    endOffset: number;
    text: string;
  }>;
} {
  const database = new DatabaseSync(options.sqlitePath, { readOnly: true });
  try {
    const kind = IDENTITY_KIND_CODES[options.kind];
    const codeRow = database
      .prepare("SELECT id FROM StrongCodes WHERE kind=? AND code=?")
      .get(kind, options.code) as { id: number } | undefined;
    if (!codeRow) return { total: 0, items: [] };
    const requestedBookOrder = options.bookId
      ? BOOK_IDS.indexOf(options.bookId as (typeof BOOK_IDS)[number]) + 1
      : undefined;
    if (options.bookId && !requestedBookOrder) {
      return { total: 0, items: [] };
    }
    const hasLemmaFilter = options.lemma !== undefined;
    const hasPartOfSpeechFilter =
      hasLemmaFilter && options.partOfSpeech !== undefined;
    const joinLexeme = hasLemmaFilter
      ? " JOIN FrenchLexemes l ON l.id=o.lexemeId"
      : "";
    const whereBook = requestedBookOrder ? " AND v.bookOrder=?" : "";
    const whereLexeme = hasLemmaFilter
      ? ` AND l.lemma=?${hasPartOfSpeechFilter ? " AND l.partOfSpeech=?" : ""}`
      : "";
    const parameters: Array<string | number> = [codeRow.id];
    if (requestedBookOrder) parameters.push(requestedBookOrder);
    if (hasLemmaFilter) {
      parameters.push(options.lemma!);
      if (hasPartOfSpeechFilter) parameters.push(options.partOfSpeech!);
    }
    const total = Number(
      (
        database
          .prepare(
            `
            SELECT COUNT(*) AS count
            FROM WordStrongCodes w
            JOIN WordSpans o
              ON o.verseId=w.verseId AND o.ordinal=w.ordinal
            JOIN Verses v ON v.id=o.verseId
            ${joinLexeme}
            WHERE w.codeId=?${whereBook}${whereLexeme}
          `
          )
          .get(...parameters) as { count: number }
      ).count
    );
    const rows = database
      .prepare(
        `
        SELECT v.bookOrder, v.chapter, v.verse, v.canonicalText,
               o.startOffset, o.length
        FROM WordStrongCodes w
        JOIN WordSpans o
          ON o.verseId=w.verseId AND o.ordinal=w.ordinal
        JOIN Verses v ON v.id=o.verseId
        ${joinLexeme}
        WHERE w.codeId=?${whereBook}${whereLexeme}
        ORDER BY v.bookOrder, v.chapter, v.verse, o.ordinal
        LIMIT ? OFFSET ?
      `
      )
      .all(
        ...parameters,
        Math.min(Math.max(options.limit ?? 20, 1), 100),
        Math.max(options.offset ?? 0, 0)
      ) as Array<{
      bookOrder: number;
      chapter: number;
      verse: number;
      canonicalText: string;
      startOffset: number;
      length: number;
    }>;
    return {
      total,
      items: rows.map(
        ({ canonicalText, bookOrder, startOffset, length, ...row }) => {
          const bookId = BOOK_IDS[bookOrder - 1]!;
          return {
            ...row,
            ref: `${bookId}.${row.chapter}.${row.verse}`,
            bookId,
            surface: canonicalText.slice(startOffset, startOffset + length),
            startOffset,
            endOffset: startOffset + length,
            text: canonicalText
          };
        }
      )
    };
  } finally {
    database.close();
  }
}

export function queryStrongBibleLemmaStats(options: {
  sqlitePath: string;
  kind: StrongIdentityKind;
  code: string;
}): {
  matchedCode: string;
  matchedKind: StrongIdentityKind;
  total: number;
  resolved: number;
  lemmas: Array<{
    lemma: string;
    partOfSpeech: string;
    occurrences: number;
  }>;
} {
  const database = new DatabaseSync(options.sqlitePath, { readOnly: true });
  try {
    const codeRow = database
      .prepare("SELECT id FROM StrongCodes WHERE kind=? AND code=?")
      .get(IDENTITY_KIND_CODES[options.kind], options.code) as
      | { id: number }
      | undefined;
    if (!codeRow) {
      return {
        matchedCode: options.code,
        matchedKind: options.kind,
        total: 0,
        resolved: 0,
        lemmas: []
      };
    }
    const counts = database
      .prepare(
        `
        SELECT COUNT(*) AS total,
               SUM(CASE WHEN o.lexemeId IS NOT NULL THEN 1 ELSE 0 END)
                 AS resolved
        FROM WordStrongCodes w
        JOIN WordSpans o
          ON o.verseId=w.verseId AND o.ordinal=w.ordinal
        WHERE w.codeId=?
      `
      )
      .get(codeRow.id) as { total: number; resolved: number | null };
    const lemmas = database
      .prepare(
        `
        SELECT l.lemma, l.partOfSpeech, COUNT(*) AS occurrences
        FROM WordStrongCodes w
        JOIN WordSpans o
          ON o.verseId=w.verseId AND o.ordinal=w.ordinal
        JOIN FrenchLexemes l ON l.id=o.lexemeId
        WHERE w.codeId=?
        GROUP BY l.id
        ORDER BY occurrences DESC, l.lemma, l.partOfSpeech
      `
      )
      .all(codeRow.id) as Array<{
      lemma: string;
      partOfSpeech: string;
      occurrences: number;
    }>;
    return {
      matchedCode: options.code,
      matchedKind: options.kind,
      total: Number(counts.total),
      resolved: Number(counts.resolved ?? 0),
      lemmas: lemmas.map((lemma) => ({
        ...lemma,
        occurrences: Number(lemma.occurrences)
      }))
    };
  } finally {
    database.close();
  }
}

export function parseStrongBibleMarkup(source: string): ParsedMarkup {
  let canonicalText = "";
  let order = 0;
  let occurrenceOrdinal = 0;
  let openOccurrence: OpenOccurrence | undefined;
  let excluded:
    | {
        tag: "note" | "ref";
        depth: number;
        offset: number;
        order: number;
        markup: string;
      }
    | undefined;
  const layout: MarkupEvent[] = [];
  const runs: MarkupEvent[] = [];
  const notes: ParsedNote[] = [];
  const occurrences: ParsedOccurrence[] = [];

  for (const token of source.match(/<[^>]*>|[^<]+/gu) ?? []) {
    const tokenOrder = order++;
    if (excluded) {
      excluded.markup += token;
      if (token.startsWith("<")) {
        const parsed = parseTag(token);
        if (parsed?.name === excluded.tag) {
          if (parsed.type === "open") excluded.depth += 1;
          if (parsed.type === "close") excluded.depth -= 1;
        }
      }
      if (excluded.depth === 0) {
        notes.push({
          offset: excluded.offset,
          order: excluded.order,
          kind: excluded.tag === "note" ? "note" : "reference",
          markup: excluded.markup
        });
        excluded = undefined;
      }
      continue;
    }

    if (!token.startsWith("<")) {
      canonicalText += decodeEntities(token);
      continue;
    }
    const tag = parseTag(token);
    if (!tag) throw new Error(`strong-bible-markup-invalid-tag:${token}`);
    if ((tag.name === "note" || tag.name === "ref") && tag.type === "open") {
      excluded = {
        tag: tag.name,
        depth: 1,
        offset: canonicalText.length,
        order: tokenOrder,
        markup: token
      };
      continue;
    }
    if (tag.name === "w") {
      if (tag.type === "open") {
        if (openOccurrence) {
          throw new Error("strong-bible-markup-nested-word");
        }
        openOccurrence = {
          ordinal: occurrenceOrdinal++,
          startOffset: canonicalText.length,
          openOrder: tokenOrder,
          lexeme: parseLexeme(tag.attributes),
          identities: parseIdentities(tag.attributes)
        };
      } else if (tag.type === "close") {
        if (!openOccurrence) {
          throw new Error("strong-bible-markup-unmatched-word-close");
        }
        occurrences.push({
          ...openOccurrence,
          endOffset: canonicalText.length,
          closeOrder: tokenOrder,
          surface: canonicalText.slice(openOccurrence.startOffset)
        });
        openOccurrence = undefined;
      } else {
        throw new Error("strong-bible-markup-self-closing-word");
      }
      continue;
    }
    const event: MarkupEvent = {
      offset: canonicalText.length,
      order: tokenOrder,
      type: tag.type,
      tag: tag.rawName,
      attributes: tag.attributes
    };
    if (LAYOUT_TAGS.has(tag.name)) layout.push(event);
    else if (RUN_TAGS.has(tag.name)) runs.push(event);
    else throw new Error(`strong-bible-markup-unsupported-tag:${tag.rawName}`);
  }
  if (excluded) {
    throw new Error(`strong-bible-markup-unclosed-${excluded.tag}`);
  }
  if (openOccurrence) {
    throw new Error("strong-bible-markup-unclosed-word");
  }
  return { canonicalText, layout, runs, notes, occurrences };
}

interface ParsedNoteRow {
  noteIndex: number;
  offset: number;
  eventOrder: number;
  kind: "note" | "reference";
  markup: string;
}

function renderStrongBibleMarkup(input: {
  canonicalText: string;
  events: MarkupEvent[];
  notes: ParsedNoteRow[];
  occurrences: Array<{
    ordinal: number;
    startOffset: number;
    endOffset: number;
    openOrder: number;
    closeOrder: number;
    identities: Array<{ kind: StrongIdentityKind; code: string }>;
    lexeme?: { lemma: string; partOfSpeech: string };
  }>;
}): string {
  const events: Array<{ offset: number; order: number; markup: string }> = [];
  for (const event of input.events) {
    events.push({
      offset: event.offset,
      order: event.order,
      markup: renderTag(event)
    });
  }
  for (const note of input.notes) {
    events.push({
      offset: note.offset,
      order: note.eventOrder,
      markup: note.markup
    });
  }
  for (const occurrence of input.occurrences) {
    const identityAttributes = IDENTITY_KINDS.map((kind) => {
      const values = occurrence.identities
        .filter((identity) => identity.kind === kind)
        .map((identity) => identity.code);
      return values.length
        ? ` ${kind}="${escapeAttribute(values.join(" "))}"`
        : "";
    }).join("");
    const lexemeAttributes = occurrence.lexeme
      ? ` lemma="${escapeAttribute(occurrence.lexeme.lemma)}"` +
        ` pos="${escapeAttribute(occurrence.lexeme.partOfSpeech)}"`
      : "";
    events.push({
      offset: occurrence.startOffset,
      order: occurrence.openOrder,
      markup: `<w${identityAttributes}${lexemeAttributes}>`
    });
    events.push({
      offset: occurrence.endOffset,
      order: occurrence.closeOrder,
      markup: "</w>"
    });
  }
  events.sort(
    (left, right) => left.offset - right.offset || left.order - right.order
  );
  let cursor = 0;
  let result = "";
  for (const event of events) {
    result += escapeText(input.canonicalText.slice(cursor, event.offset));
    result += event.markup;
    cursor = event.offset;
  }
  result += escapeText(input.canonicalText.slice(cursor));
  return result;
}

function storeMarkupEvent(event: MarkupEvent): StoredMarkupEvent {
  const type = event.type === "open" ? 0 : event.type === "close" ? 1 : 2;
  const tag = MARKUP_TAGS.indexOf(event.tag as (typeof MARKUP_TAGS)[number]);
  if (tag < 0) {
    throw new Error(`strong-bible-markup-unsupported-storage-tag:${event.tag}`);
  }
  return Object.keys(event.attributes).length > 0
    ? [event.offset, event.order, type, tag, event.attributes]
    : [event.offset, event.order, type, tag];
}

function restoreMarkupEvent(event: StoredMarkupEvent): MarkupEvent {
  const tag = MARKUP_TAGS[event[3]];
  if (!tag) {
    throw new Error(`strong-bible-markup-invalid-storage-tag:${event[3]}`);
  }
  return {
    offset: event[0],
    order: event[1],
    type: event[2] === 0 ? "open" : event[2] === 1 ? "close" : "self",
    tag,
    attributes: event[4] ?? {}
  };
}

function createSchema(database: DatabaseSync): void {
  database.exec(`
    PRAGMA foreign_keys=ON;
    PRAGMA journal_mode=OFF;
    PRAGMA synchronous=OFF;
    PRAGMA temp_store=MEMORY;

    CREATE TABLE ResourceMetadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    ) WITHOUT ROWID;

    CREATE TABLE Verses (
      id INTEGER PRIMARY KEY,
      bookOrder INTEGER NOT NULL,
      chapter INTEGER NOT NULL,
      verse INTEGER NOT NULL,
      canonicalText TEXT NOT NULL,
      markupJson TEXT NOT NULL,
      UNIQUE(bookOrder, chapter, verse)
    );

    CREATE TABLE FrenchLexemes (
      id INTEGER PRIMARY KEY,
      lemma TEXT NOT NULL,
      partOfSpeech TEXT NOT NULL,
      UNIQUE(lemma, partOfSpeech)
    );

    CREATE TABLE WordSpans (
      verseId INTEGER NOT NULL REFERENCES Verses(id) ON DELETE CASCADE,
      ordinal INTEGER NOT NULL,
      startOffset INTEGER NOT NULL,
      length INTEGER NOT NULL,
      openOrder INTEGER NOT NULL,
      closeOrder INTEGER NOT NULL,
      lexemeId INTEGER REFERENCES FrenchLexemes(id),
      PRIMARY KEY(verseId, ordinal)
    ) WITHOUT ROWID;

    CREATE TABLE StrongCodes (
      id INTEGER PRIMARY KEY,
      kind INTEGER NOT NULL CHECK(kind BETWEEN 0 AND 3),
      code TEXT NOT NULL,
      UNIQUE(kind, code)
    );

    CREATE TABLE WordStrongCodes (
      verseId INTEGER NOT NULL,
      ordinal INTEGER NOT NULL,
      identityOrder INTEGER NOT NULL,
      codeId INTEGER NOT NULL REFERENCES StrongCodes(id),
      PRIMARY KEY(verseId, ordinal, identityOrder),
      FOREIGN KEY(verseId, ordinal)
        REFERENCES WordSpans(verseId, ordinal) ON DELETE CASCADE
    ) WITHOUT ROWID;
    CREATE INDEX idx_WordStrongCodes_lookup
      ON WordStrongCodes(codeId, verseId, ordinal, identityOrder);

    CREATE TABLE VerseNotes (
      verseId INTEGER NOT NULL REFERENCES Verses(id) ON DELETE CASCADE,
      noteIndex INTEGER NOT NULL,
      offset INTEGER NOT NULL,
      eventOrder INTEGER NOT NULL,
      kind INTEGER NOT NULL CHECK(kind IN (0, 1)),
      markup TEXT NOT NULL,
      PRIMARY KEY(verseId, noteIndex)
    ) WITHOUT ROWID;
  `);
}

function writeMetadata(
  database: DatabaseSync,
  values: {
    datasetId: string;
    version: string;
    sourcePath: string;
    sourceSha256: string;
    verseCount: number;
    occurrenceCount: number;
    identityCount: number;
    lexemeAssignmentCount: number;
    lexemeCount: number;
    noteCount: number;
  }
): void {
  const insert = database.prepare(
    "INSERT INTO ResourceMetadata(key, value) VALUES (?, ?)"
  );
  const metadata = {
    schemaVersion: String(STRONG_BIBLE_SQLITE_SCHEMA_VERSION),
    builderVersion: STRONG_BIBLE_SQLITE_BUILDER_VERSION,
    ...values
  };
  for (const [key, value] of Object.entries(metadata)) {
    insert.run(key, String(value));
  }
}

async function* streamStrongBibleJsonl(
  inputPath: string
): AsyncGenerator<StrongBibleJsonlVerse> {
  const lines = createInterface({
    input: createReadStream(inputPath, { encoding: "utf8" }),
    crlfDelay: Infinity
  });
  let lineNumber = 0;
  for await (const line of lines) {
    lineNumber += 1;
    if (!line.trim()) continue;
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      throw new Error(`strong-bible-jsonl-invalid-json:${lineNumber}`);
    }
    if (!isStrongBibleJsonlVerse(value)) {
      throw new Error(`strong-bible-jsonl-invalid-verse:${lineNumber}`);
    }
    yield value;
  }
}

function isStrongBibleJsonlVerse(
  value: unknown
): value is StrongBibleJsonlVerse {
  if (!value || typeof value !== "object") return false;
  const verse = value as Partial<StrongBibleJsonlVerse>;
  return (
    typeof verse.ref === "string" &&
    typeof verse.version === "string" &&
    Number.isSafeInteger(verse.book) &&
    typeof verse.bookId === "string" &&
    Number.isSafeInteger(verse.chapter) &&
    Number.isSafeInteger(verse.verse) &&
    typeof verse.text === "string"
  );
}

function parseTag(source: string): {
  name: string;
  rawName: string;
  type: "open" | "close" | "self";
  attributes: Record<string, string>;
} | null {
  const match = source.match(
    /^<\s*(\/)?\s*([A-Za-z][\w-]*)([\s\S]*?)(\/)?\s*>$/u
  );
  if (!match) return null;
  const closing = Boolean(match[1]);
  const rawName = match[2]!;
  return {
    name: rawName.toLowerCase(),
    rawName,
    type: closing ? "close" : match[4] ? "self" : "open",
    attributes: closing ? {} : parseAttributes(match[3] ?? "")
  };
}

function parseAttributes(source: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const pattern = /([:\w-]+)\s*=\s*(["'])([\s\S]*?)\2/gu;
  for (const match of source.matchAll(pattern)) {
    attributes[match[1]!.toLowerCase()] = decodeEntities(match[3] ?? "");
  }
  return attributes;
}

function parseLexeme(
  attributes: Record<string, string>
): ParsedOccurrence["lexeme"] {
  const lemma = attributes.lemma?.trim().normalize("NFC");
  const partOfSpeech = attributes.pos?.trim().normalize("NFC");
  if (!lemma && !partOfSpeech) return undefined;
  if (!lemma || !partOfSpeech) {
    throw new Error("strong-bible-markup-incomplete-lexeme");
  }
  return { lemma, partOfSpeech };
}

function parseIdentities(
  attributes: Record<string, string>
): ParsedOccurrence["identities"] {
  const identities: ParsedOccurrence["identities"] = [];
  for (const kind of IDENTITY_KINDS) {
    for (const code of (attributes[kind] ?? "").split(/\s+/u).filter(Boolean)) {
      if (!/^[GH]\d{1,5}[A-Za-z]*$/u.test(code)) {
        throw new Error(`strong-bible-markup-invalid-${kind}:${code}`);
      }
      identities.push({
        kind,
        code,
        family: code.startsWith("H") ? "hebrew" : "greek"
      });
    }
  }
  if (!identities.some((identity) => identity.kind === "strong")) {
    throw new Error("strong-bible-markup-word-without-strong");
  }
  return identities;
}

function renderTag(event: MarkupEvent): string {
  if (event.type === "close") return `</${event.tag}>`;
  const attributes = Object.entries(event.attributes)
    .map(([key, value]) => ` ${key}="${escapeAttribute(value)}"`)
    .join("");
  return `<${event.tag}${attributes}${event.type === "self" ? "/" : ""}>`;
}

function decodeEntities(value: string): string {
  return value.replace(
    /&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/giu,
    (_, entity: string) => {
      const normalized = entity.toLowerCase();
      if (normalized === "amp") return "&";
      if (normalized === "lt") return "<";
      if (normalized === "gt") return ">";
      if (normalized === "quot") return '"';
      if (normalized === "apos") return "'";
      if (normalized === "nbsp") return "\u00a0";
      const codePoint = normalized.startsWith("#x")
        ? Number.parseInt(normalized.slice(2), 16)
        : Number.parseInt(normalized.slice(1), 10);
      return Number.isSafeInteger(codePoint)
        ? String.fromCodePoint(codePoint)
        : `&${entity};`;
    }
  );
}

function escapeText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttribute(value: string): string {
  return escapeText(value).replaceAll('"', "&quot;");
}

async function sha256File(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}
