import { createHash } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";
import { DatabaseSync } from "node:sqlite";

import { BOOK_IDS } from "./books.js";
import {
  parseStrongBibleMarkup,
  type StrongBibleJsonlVerse,
  type StrongBibleJsonlHeading,
  type StrongIdentityKind
} from "./strongBibleSqlite.js";

export const CANONICAL_BIBLE_SCHEMA_VERSION = 4;
export const MOBILE_STRONG_SQLITE_SCHEMA_VERSION = 2;
export const MOBILE_STRONG_BUILDER_VERSION =
  "strong-bible-mobile-publication@2";

const IDENTITY_KIND_CODES: Record<StrongIdentityKind, number> = {
  strong: 0,
  estrong: 1,
  dstrong: 2,
  ustrong: 3
};

export interface CanonicalBibleLayoutEvent {
  offset: number;
  order: number;
  type: "open" | "close" | "self";
  tag: string;
  attributes?: Record<string, string>;
}

export interface CanonicalBibleVerse {
  text: string;
  startTags: CanonicalBibleActiveTag[];
  layout: CanonicalBibleLayoutEvent[];
  notes: CanonicalBibleNote[];
  headings: StrongBibleJsonlHeading[];
}

export interface CanonicalBibleNote {
  offset: number;
  order: number;
  kind: "note" | "reference";
  markup: string;
}

export interface CanonicalBibleActiveTag {
  tag: string;
  attributes?: Record<string, string>;
}

export interface CanonicalBiblePublication {
  format: "bible-strong-canonical-bible";
  schemaVersion: number;
  applicationVersionId: string;
  datasetId: string;
  sourceVersion: string;
  textRevision: string;
  textSha256: string;
  sourceSha256: string;
  verseCount: number;
  noteCount: number;
  headingCount: number;
  verses: Record<string, Record<string, Record<string, CanonicalBibleVerse>>>;
}

export interface StrongBibleMobilePublicationSummary {
  applicationVersionId: string;
  datasetId: string;
  sourceVersion: string;
  sourceSha256: string;
  textRevision: string;
  textSha256: string;
  canonicalJsonPath: string;
  canonicalJsonSha256: string;
  canonicalJsonBytes: number;
  strongRevision: string;
  strongSqlitePath: string;
  strongSha256: string;
  strongBytes: number;
  verseCount: number;
  occurrenceCount: number;
  unalignedOccurrenceCount: number;
  identityCount: number;
  lexemeAssignmentCount: number;
  lexemeCount: number;
  noteCount: number;
  headingCount: number;
  integrityCheck: "ok";
}

function applyPresentationEvents(
  current: CanonicalBibleActiveTag[],
  events: CanonicalBibleLayoutEvent[]
): CanonicalBibleActiveTag[] {
  const next = current.map((tag) => ({
    ...tag,
    ...(tag.attributes ? { attributes: { ...tag.attributes } } : {})
  }));
  for (const event of events) {
    if (event.type === "self") continue;
    if (event.type === "open") {
      next.push({
        tag: event.tag,
        ...(event.attributes ? { attributes: { ...event.attributes } } : {})
      });
      continue;
    }
    const normalizedTag = event.tag.toLocaleLowerCase();
    let matchingIndex = -1;
    for (let index = next.length - 1; index >= 0; index -= 1) {
      if (next[index]?.tag.toLocaleLowerCase() === normalizedTag) {
        matchingIndex = index;
        break;
      }
    }
    if (matchingIndex >= 0) next.splice(matchingIndex, 1);
  }
  return next;
}

export async function compileStrongBibleMobilePublication(options: {
  inputPath: string;
  canonicalJsonPath: string;
  strongSqlitePath: string;
  applicationVersionId: string;
  datasetId: string;
  expectedVersion: string;
}): Promise<StrongBibleMobilePublicationSummary> {
  const inputPath = path.resolve(options.inputPath);
  const canonicalJsonPath = path.resolve(options.canonicalJsonPath);
  const strongSqlitePath = path.resolve(options.strongSqlitePath);
  if (!existsSync(inputPath)) {
    throw new Error(`strong-bible-jsonl-missing:${inputPath}`);
  }

  await Promise.all([
    mkdir(path.dirname(canonicalJsonPath), { recursive: true }),
    mkdir(path.dirname(strongSqlitePath), { recursive: true })
  ]);
  const temporaryJson = `${canonicalJsonPath}.tmp-${process.pid}`;
  const temporarySqlite = `${strongSqlitePath}.tmp-${process.pid}`;
  await Promise.all([
    rm(temporaryJson, { force: true }),
    rm(temporarySqlite, { force: true })
  ]);

  const database = new DatabaseSync(temporarySqlite);
  const verses: CanonicalBiblePublication["verses"] = {};
  const textHash = createHash("sha256");
  let sourceSha256 = "";
  let verseCount = 0;
  let occurrenceCount = 0;
  let unalignedOccurrenceCount = 0;
  let identityCount = 0;
  let lexemeAssignmentCount = 0;
  let noteCount = 0;
  let headingCount = 0;
  let activePresentationTags: CanonicalBibleActiveTag[] = [];
  let activePresentationChapter = "";

  try {
    createMobileSchema(database);
    const insertVerse = database.prepare(`
      INSERT INTO Verses(bookOrder, chapter, verse) VALUES (?, ?, ?)
    `);
    const insertOccurrence = database.prepare(`
      INSERT INTO WordSpans(
        verseId, ordinal, startOffset, length, isAligned,
        openOrder, closeOrder, lexemeId
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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
    const strongCodeIds = new Map<string, number>();

    database.exec("BEGIN IMMEDIATE");
    try {
      let previousOrder = -1;
      const stream = streamStrongBibleJsonlWithHash(inputPath);
      for await (const verse of stream.verses) {
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
        const layout = [...parsed.layout, ...parsed.runs]
          .sort((left, right) => left.order - right.order)
          .map((event) => ({
            offset: event.offset,
            order: event.order,
            type: event.type,
            tag: event.tag,
            ...(Object.keys(event.attributes).length > 0
              ? { attributes: event.attributes }
              : {})
          }));
        const presentationChapter = `${verse.book}:${verse.chapter}`;
        if (presentationChapter !== activePresentationChapter) {
          activePresentationTags = [];
          activePresentationChapter = presentationChapter;
        }
        const canonicalVerse: CanonicalBibleVerse = {
          text: parsed.canonicalText,
          startTags: activePresentationTags.map((tag) => ({
            ...tag,
            ...(tag.attributes ? { attributes: { ...tag.attributes } } : {})
          })),
          layout,
          notes: parsed.notes.map((note) => ({
            offset: note.offset,
            order: note.order,
            kind: note.kind,
            markup: note.markup
          })),
          headings: (verse.headings ?? []).map((heading) => ({
            ...heading,
            ...(heading.attributes
              ? { attributes: { ...heading.attributes } }
              : {})
          }))
        };
        noteCount += canonicalVerse.notes.length;
        headingCount += canonicalVerse.headings.length;
        activePresentationTags = applyPresentationEvents(
          activePresentationTags,
          layout
        );
        const bookKey = String(verse.book);
        const chapterKey = String(verse.chapter);
        const verseKey = String(verse.verse);
        verses[bookKey] ??= {};
        verses[bookKey]![chapterKey] ??= {};
        verses[bookKey]![chapterKey]![verseKey] = canonicalVerse;
        textHash.update(
          `${JSON.stringify([
            verse.book,
            verse.chapter,
            verse.verse,
            canonicalVerse
          ])}\n`
        );

        const verseId = Number(
          insertVerse.run(verse.book, verse.chapter, verse.verse)
            .lastInsertRowid
        );
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
          const length = occurrence.endOffset - occurrence.startOffset;
          const isAligned = length > 0;
          insertOccurrence.run(
            verseId,
            occurrence.ordinal,
            occurrence.startOffset,
            length,
            isAligned ? 1 : 0,
            occurrence.openOrder,
            occurrence.closeOrder,
            lexemeId
          );
          occurrenceCount += 1;
          if (!isAligned) unalignedOccurrenceCount += 1;

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
      }
      sourceSha256 = await stream.sourceSha256;
      const textSha256 = textHash.digest("hex");
      const textRevision = buildTextRevision(
        options.applicationVersionId,
        textSha256
      );
      const strongRevision = createHash("sha256")
        .update(MOBILE_STRONG_BUILDER_VERSION)
        .update("\u0000")
        .update(sourceSha256)
        .update("\u0000")
        .update(textSha256)
        .digest("hex");
      const lexemeCount = Number(
        (
          database
            .prepare("SELECT COUNT(*) AS count FROM FrenchLexemes")
            .get() as { count: number }
        ).count
      );
      writeMobileMetadata(database, {
        applicationVersionId: options.applicationVersionId,
        datasetId: options.datasetId,
        sourceVersion: options.expectedVersion,
        sourceSha256,
        textRevision,
        textSha256,
        strongRevision,
        verseCount,
        occurrenceCount,
        unalignedOccurrenceCount,
        identityCount,
        lexemeAssignmentCount,
        lexemeCount
      });
      database.exec("COMMIT");

      const publication: CanonicalBiblePublication = {
        format: "bible-strong-canonical-bible",
        schemaVersion: CANONICAL_BIBLE_SCHEMA_VERSION,
        applicationVersionId: options.applicationVersionId,
        datasetId: options.datasetId,
        sourceVersion: options.expectedVersion,
        textRevision,
        textSha256,
        sourceSha256,
        verseCount,
        noteCount,
        headingCount,
        verses
      };
      await writeFile(
        temporaryJson,
        `${JSON.stringify(publication)}\n`,
        "utf8"
      );
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
    database.exec("ANALYZE");
    database.exec("VACUUM");
  } catch (error) {
    await Promise.all([
      rm(temporaryJson, { force: true }),
      rm(temporarySqlite, { force: true })
    ]);
    throw error;
  } finally {
    database.close();
  }

  const verification = await verifyStrongBibleMobilePublication({
    canonicalJsonPath: temporaryJson,
    strongSqlitePath: temporarySqlite
  });
  await Promise.all([
    rm(canonicalJsonPath, { force: true }),
    rm(strongSqlitePath, { force: true })
  ]);
  await Promise.all([
    rename(temporaryJson, canonicalJsonPath),
    rename(temporarySqlite, strongSqlitePath)
  ]);
  const [canonicalJsonStats, strongStats] = await Promise.all([
    stat(canonicalJsonPath),
    stat(strongSqlitePath)
  ]);

  return {
    applicationVersionId: options.applicationVersionId,
    datasetId: options.datasetId,
    sourceVersion: options.expectedVersion,
    sourceSha256,
    textRevision: verification.textRevision,
    textSha256: verification.textSha256,
    canonicalJsonPath,
    canonicalJsonSha256: await sha256File(canonicalJsonPath),
    canonicalJsonBytes: canonicalJsonStats.size,
    strongRevision: verification.strongRevision,
    strongSqlitePath,
    strongSha256: await sha256File(strongSqlitePath),
    strongBytes: strongStats.size,
    verseCount: verification.verseCount,
    occurrenceCount: verification.occurrenceCount,
    unalignedOccurrenceCount: verification.unalignedOccurrenceCount,
    identityCount: verification.identityCount,
    lexemeAssignmentCount: verification.lexemeAssignmentCount,
    lexemeCount: verification.lexemeCount,
    noteCount: verification.noteCount,
    headingCount: verification.headingCount,
    integrityCheck: verification.integrityCheck
  };
}

export function verifyCanonicalBiblePublication(
  publication: CanonicalBiblePublication
): {
  textRevision: string;
  textSha256: string;
  verseCount: number;
  noteCount: number;
  headingCount: number;
  invalidNoteRangeCount: number;
} {
  if (
    publication.format !== "bible-strong-canonical-bible" ||
    publication.schemaVersion !== CANONICAL_BIBLE_SCHEMA_VERSION ||
    typeof publication.applicationVersionId !== "string" ||
    publication.applicationVersionId.length === 0 ||
    typeof publication.sourceVersion !== "string" ||
    publication.sourceVersion.length === 0 ||
    !/^[a-f0-9]{64}$/.test(publication.sourceSha256) ||
    !publication.verses ||
    typeof publication.verses !== "object" ||
    !Number.isSafeInteger(publication.verseCount) ||
    publication.verseCount <= 0 ||
    !Number.isSafeInteger(publication.noteCount) ||
    publication.noteCount < 0 ||
    !Number.isSafeInteger(publication.headingCount) ||
    publication.headingCount < 0
  ) {
    throw new Error("strong-bible-mobile-invalid-canonical-publication");
  }
  const expectedTextSha256 = hashCanonicalVerses(publication.verses);
  if (publication.textSha256 !== expectedTextSha256) {
    throw new Error(
      `strong-bible-mobile-text-checksum-mismatch:${publication.textSha256}:${expectedTextSha256}`
    );
  }
  const expectedTextRevision = buildTextRevision(
    publication.applicationVersionId,
    expectedTextSha256
  );
  if (publication.textRevision !== expectedTextRevision) {
    throw new Error(
      `strong-bible-mobile-text-revision-mismatch:${publication.textRevision}:${expectedTextRevision}`
    );
  }

  let verseCount = 0;
  let noteCount = 0;
  let headingCount = 0;
  let invalidNoteRangeCount = 0;
  let invalidHeadingCount = 0;
  for (const chapters of Object.values(publication.verses)) {
    for (const chapter of Object.values(chapters)) {
      for (const verse of Object.values(chapter)) {
        verseCount += 1;
        if (
          typeof verse.text !== "string" ||
          !Array.isArray(verse.startTags) ||
          !Array.isArray(verse.layout) ||
          !Array.isArray(verse.notes) ||
          !Array.isArray(verse.headings)
        ) {
          throw new Error("strong-bible-mobile-canonical-verse-invalid");
        }
        for (const heading of verse.headings) {
          headingCount += 1;
          if (
            !Number.isSafeInteger(heading.offset) ||
            heading.offset < 0 ||
            heading.offset > verse.text.length ||
            !Number.isSafeInteger(heading.order) ||
            heading.order < 0 ||
            !["pericope", "heading", "parallel"].includes(heading.kind) ||
            typeof heading.type !== "string" ||
            typeof heading.text !== "string" ||
            typeof heading.markup !== "string" ||
            heading.markup.length === 0 ||
            /<w\b|(?:^|\s)(?:strong|estrong|dstrong|ustrong|lemma|morph)=/iu.test(
              heading.markup
            )
          ) {
            invalidHeadingCount += 1;
          }
        }
        for (const note of verse.notes) {
          noteCount += 1;
          if (
            !Number.isSafeInteger(note.offset) ||
            note.offset < 0 ||
            note.offset > verse.text.length ||
            !Number.isSafeInteger(note.order) ||
            note.order < 0 ||
            (note.kind !== "note" && note.kind !== "reference") ||
            typeof note.markup !== "string" ||
            note.markup.length === 0 ||
            /<w\b|(?:^|\s)(?:strong|estrong|dstrong|ustrong|lemma|morph)=/iu.test(
              note.markup
            )
          ) {
            invalidNoteRangeCount += 1;
          }
        }
      }
    }
  }
  if (
    verseCount !== publication.verseCount ||
    noteCount !== publication.noteCount ||
    invalidNoteRangeCount > 0
  ) {
    throw new Error(
      `strong-bible-mobile-invalid-canonical-counts:${verseCount}:${publication.verseCount}:${noteCount}:${publication.noteCount}:${invalidNoteRangeCount}`
    );
  }
  if (headingCount !== publication.headingCount || invalidHeadingCount > 0) {
    throw new Error(
      `strong-bible-mobile-invalid-canonical-headings:${headingCount}:${publication.headingCount}:${invalidHeadingCount}`
    );
  }
  return {
    textRevision: publication.textRevision,
    textSha256: publication.textSha256,
    verseCount,
    noteCount,
    headingCount,
    invalidNoteRangeCount
  };
}

export async function verifyStrongBibleMobilePublication(options: {
  canonicalJsonPath: string;
  strongSqlitePath: string;
}): Promise<{
  textRevision: string;
  textSha256: string;
  strongRevision: string;
  verseCount: number;
  occurrenceCount: number;
  unalignedOccurrenceCount: number;
  identityCount: number;
  lexemeAssignmentCount: number;
  lexemeCount: number;
  noteCount: number;
  headingCount: number;
  invalidRangeCount: number;
  invalidNoteRangeCount: number;
  integrityCheck: "ok";
}> {
  const publication = JSON.parse(
    await readFile(options.canonicalJsonPath, "utf8")
  ) as CanonicalBiblePublication;
  const canonicalVerification = verifyCanonicalBiblePublication(publication);

  const database = new DatabaseSync(options.strongSqlitePath, {
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
      throw new Error(`strong-bible-mobile-sqlite-integrity:${integrity}`);
    }
    const metadata = Object.fromEntries(
      (
        database.prepare("SELECT key, value FROM ResourceMetadata").all() as {
          key: string;
          value: string;
        }[]
      ).map(({ key, value }) => [key, value])
    );
    for (const [key, expected] of [
      ["applicationVersionId", publication.applicationVersionId],
      ["datasetId", publication.datasetId],
      ["sourceVersion", publication.sourceVersion],
      ["sourceSha256", publication.sourceSha256],
      ["textRevision", publication.textRevision],
      ["textSha256", publication.textSha256]
    ] as const) {
      if (metadata[key] !== expected) {
        throw new Error(
          `strong-bible-mobile-pair-mismatch:${key}:${metadata[key]}:${expected}`
        );
      }
    }
    if (
      Number(metadata.schemaVersion) !== MOBILE_STRONG_SQLITE_SCHEMA_VERSION
    ) {
      throw new Error(
        `strong-bible-mobile-schema-mismatch:${metadata.schemaVersion}:${MOBILE_STRONG_SQLITE_SCHEMA_VERSION}`
      );
    }
    if (metadata.noteCount !== undefined) {
      throw new Error("strong-bible-mobile-notes-leaked-into-strong-metadata");
    }
    const noteTableCount = Number(
      (
        database
          .prepare(
            "SELECT COUNT(*) AS count FROM sqlite_schema WHERE type='table' AND name='VerseNotes'"
          )
          .get() as { count: number }
      ).count
    );
    if (noteTableCount !== 0) {
      throw new Error("strong-bible-mobile-notes-leaked-into-strong-sqlite");
    }

    const rows = database
      .prepare(
        `
        SELECT v.bookOrder, v.chapter, v.verse,
               o.startOffset, o.length, o.isAligned
        FROM WordSpans o
        JOIN Verses v ON v.id=o.verseId
        ORDER BY v.bookOrder, v.chapter, v.verse, o.ordinal
      `
      )
      .all() as Array<{
      bookOrder: number;
      chapter: number;
      verse: number;
      startOffset: number;
      length: number;
      isAligned: number;
    }>;
    let invalidRangeCount = 0;
    for (const row of rows) {
      const canonicalVerse =
        publication.verses[String(row.bookOrder)]?.[String(row.chapter)]?.[
          String(row.verse)
        ];
      if (
        !canonicalVerse ||
        row.startOffset < 0 ||
        (row.isAligned === 1 &&
          (row.length <= 0 ||
            row.startOffset + row.length > canonicalVerse.text.length)) ||
        (row.isAligned === 0 && row.length !== 0)
      ) {
        invalidRangeCount += 1;
      }
    }
    if (invalidRangeCount > 0) {
      throw new Error(
        `strong-bible-mobile-invalid-ranges:${invalidRangeCount}`
      );
    }
    const counts = database
      .prepare(
        `
        SELECT
          (SELECT COUNT(*) FROM Verses) AS verseCount,
          (SELECT COUNT(*) FROM WordSpans) AS occurrenceCount,
          (SELECT COUNT(*) FROM WordSpans WHERE isAligned=0)
            AS unalignedOccurrenceCount,
          (SELECT COUNT(*) FROM WordStrongCodes) AS identityCount,
          (SELECT COUNT(*) FROM WordSpans WHERE lexemeId IS NOT NULL)
            AS lexemeAssignmentCount,
          (SELECT COUNT(*) FROM FrenchLexemes) AS lexemeCount
      `
      )
      .get() as Record<string, number>;
    if (
      Number(counts.verseCount) !== publication.verseCount ||
      Number(counts.verseCount) <= 0 ||
      Number(counts.occurrenceCount) <= 0 ||
      Number(counts.identityCount) <= 0
    ) {
      throw new Error("strong-bible-mobile-invalid-counts");
    }

    return {
      textRevision: metadata.textRevision!,
      textSha256: metadata.textSha256!,
      strongRevision: metadata.strongRevision!,
      verseCount: Number(counts.verseCount),
      occurrenceCount: Number(counts.occurrenceCount),
      unalignedOccurrenceCount: Number(counts.unalignedOccurrenceCount),
      identityCount: Number(counts.identityCount),
      lexemeAssignmentCount: Number(counts.lexemeAssignmentCount),
      lexemeCount: Number(counts.lexemeCount),
      noteCount: canonicalVerification.noteCount,
      headingCount: canonicalVerification.headingCount,
      invalidRangeCount,
      invalidNoteRangeCount: canonicalVerification.invalidNoteRangeCount,
      integrityCheck: "ok"
    };
  } finally {
    database.close();
  }
}

function buildTextRevision(
  applicationVersionId: string,
  textSha256: string
): string {
  return `${applicationVersionId.toLowerCase()}-${textSha256.slice(0, 20)}`;
}

function hashCanonicalVerses(
  verses: CanonicalBiblePublication["verses"]
): string {
  const hash = createHash("sha256");
  for (const bookKey of Object.keys(verses).sort(numericKeyCompare)) {
    const chapters = verses[bookKey]!;
    for (const chapterKey of Object.keys(chapters).sort(numericKeyCompare)) {
      const chapter = chapters[chapterKey]!;
      for (const verseKey of Object.keys(chapter).sort(numericKeyCompare)) {
        hash.update(
          `${JSON.stringify([
            Number(bookKey),
            Number(chapterKey),
            Number(verseKey),
            chapter[verseKey]
          ])}\n`
        );
      }
    }
  }
  return hash.digest("hex");
}

function numericKeyCompare(left: string, right: string): number {
  return Number(left) - Number(right);
}

function createMobileSchema(database: DatabaseSync): void {
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
      startOffset INTEGER NOT NULL CHECK(startOffset >= 0),
      length INTEGER NOT NULL CHECK(length >= 0),
      isAligned INTEGER NOT NULL CHECK(isAligned IN (0, 1)),
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

  `);
}

function writeMobileMetadata(
  database: DatabaseSync,
  values: Record<string, string | number>
): void {
  const insert = database.prepare(
    "INSERT INTO ResourceMetadata(key, value) VALUES (?, ?)"
  );
  const metadata = {
    schemaVersion: MOBILE_STRONG_SQLITE_SCHEMA_VERSION,
    builderVersion: MOBILE_STRONG_BUILDER_VERSION,
    ...values
  };
  for (const [key, value] of Object.entries(metadata)) {
    insert.run(key, String(value));
  }
}

function streamStrongBibleJsonlWithHash(inputPath: string): {
  verses: AsyncGenerator<StrongBibleJsonlVerse>;
  sourceSha256: Promise<string>;
} {
  const input = createReadStream(inputPath);
  const sourceHash = createHash("sha256");
  input.on("data", (chunk) => sourceHash.update(chunk));
  let resolveHash!: (value: string) => void;
  let rejectHash!: (reason: unknown) => void;
  const sourceSha256 = new Promise<string>((resolve, reject) => {
    resolveHash = resolve;
    rejectHash = reject;
  });
  input.once("end", () => resolveHash(sourceHash.digest("hex")));
  input.once("error", rejectHash);

  async function* readVerses(): AsyncGenerator<StrongBibleJsonlVerse> {
    const lines = createInterface({ input, crlfDelay: Infinity });
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

  return { verses: readVerses(), sourceSha256 };
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

async function sha256File(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}
