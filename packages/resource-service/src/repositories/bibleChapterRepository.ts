import { Effect } from 'effect'
import { sql, type Kysely } from 'kysely'

import type {
  ActiveBibleChapter,
  ActiveBibleVerseTexts,
  BibleChapterRepositoryService,
} from '../domain/bibleChapter'
import {
  ActiveBiblePublicationUnavailable,
  BibleChapterNotFound,
  BibleChapterRepositoryFailure,
  BibleVerseSelectionNotFound,
} from '../domain/bibleChapter'
import { makeNeonDatabase, type NeonDatabaseConfig } from '../database/neonDatabase'
import { tryDatabasePromise } from '../database/databaseEffect'
import type { ResourceDatabase } from '../database/types'

type BiblePublicationMetadata = {
  canon: { id: string; orderedBooks: number[] }
  versification: string
  resource_revision?: string
  text_revision?: string
  text_sha256?: string
}

const bibleMetadata = (value: Record<string, unknown>): BiblePublicationMetadata =>
  value as BiblePublicationMetadata

// White space and punctuation marks. A Bible may keep a verse its manuscripts omit as a row
// that is empty, or that only holds a line break or the bracket that closed the omitted
// words: a verse has text when something else remains.
const BLANK_VERSE_CHARACTERS = ' \t\n\r\u00a0\u2009\u202f\u200b\ufeff[]()«»“”".,;:!?…-–—'
// Trimming reads the whole verse. Nearly every verse starts with something else than these
// characters, which is enough to know it has text: the others are trimmed.
const verseHasText = sql<boolean>`(
  strpos(${BLANK_VERSE_CHARACTERS}, left(text, 1)) = 0
  OR btrim(text, ${BLANK_VERSE_CHARACTERS}) <> ''
)`

type CoverageRows = {
  revision: string
  metadata: Record<string, unknown>
  chapters: { book: number; chapter: number; verseCount: number; verseNumbers: number[] | null }[]
}

export const makeKyselyBibleChapterRepository = (
  database: Kysely<ResourceDatabase>
): BibleChapterRepositoryService => ({
  findActiveChapters: input =>
    Effect.gen(function* () {
      const identities = input.versionIds.map(versionId => `bible-text:${versionId}`)
      const rows = yield* tryDatabasePromise('bible.chapters.read-active', () =>
        database
          .selectFrom('resource_publications')
          .leftJoin('bible_verses', join =>
            join
              .onRef('bible_verses.publication_id', '=', 'resource_publications.id')
              .on('bible_verses.book', '=', input.book)
              .on('bible_verses.chapter', '=', input.chapter)
          )
          .select([
            'resource_publications.resource_identity',
            'resource_publications.revision',
            'resource_publications.metadata',
            'bible_verses.verse',
            'bible_verses.text',
            'bible_verses.presentation',
          ])
          .where('resource_publications.resource_identity', 'in', identities)
          .where('resource_publications.status', '=', 'active')
          .orderBy('resource_publications.resource_identity')
          .orderBy('bible_verses.verse')
          .execute()
      ).pipe(Effect.mapError(cause => new BibleChapterRepositoryFailure({ cause })))

      const rowsByVersion = new Map<string, typeof rows>()
      for (const row of rows) {
        const versionId = row.resource_identity.slice('bible-text:'.length)
        rowsByVersion.set(versionId, [...(rowsByVersion.get(versionId) ?? []), row])
      }
      const chapters: ActiveBibleChapter[] = []
      for (const versionId of input.versionIds) {
        const versionRows = rowsByVersion.get(versionId)
        if (!versionRows) return yield* new ActiveBiblePublicationUnavailable({ versionId })
        if (versionRows[0]?.verse === null) {
          return yield* new BibleChapterNotFound({
            versionId,
            book: input.book,
            chapter: input.chapter,
          })
        }
        const metadata = bibleMetadata(versionRows[0]!.metadata)
        chapters.push({
          versionId,
          book: input.book,
          chapter: input.chapter,
          revision:
            metadata.resource_revision ?? metadata.text_revision ?? versionRows[0]!.revision,
          textRevision:
            metadata.text_revision ?? metadata.resource_revision ?? versionRows[0]!.revision,
          ...(metadata.text_sha256 ? { textSha256: metadata.text_sha256 } : {}),
          verses: versionRows.map(row => ({
            number: row.verse!,
            text: row.text!,
            presentation: row.presentation!,
          })),
        })
      }
      return chapters
    }),
  findActiveVerseTexts: input =>
    Effect.gen(function* () {
      const publication = yield* tryDatabasePromise('bible.verse-texts.read-publication', () =>
        database
          .selectFrom('resource_publications')
          .select(['id', 'revision', 'metadata'])
          .where('resource_publications.resource_identity', '=', `bible-text:${input.versionId}`)
          .where('resource_publications.status', '=', 'active')
          .executeTakeFirst()
      ).pipe(Effect.mapError(cause => new BibleChapterRepositoryFailure({ cause })))

      if (!publication) {
        return yield* new ActiveBiblePublicationUnavailable({ versionId: input.versionId })
      }

      const rows = yield* tryDatabasePromise('bible.verse-texts.read-active', () =>
        database
          .selectFrom('bible_verses')
          .select(['book', 'chapter', 'verse', 'text'])
          .where('publication_id', '=', publication.id)
          .where(expression =>
            expression.or(
              input.locations.map(location =>
                expression.and([
                  expression('book', '=', location.book),
                  expression('chapter', '=', location.chapter),
                  expression('verse', '=', location.verse),
                ])
              )
            )
          )
          .orderBy('book')
          .orderBy('chapter')
          .orderBy('verse')
          .execute()
      ).pipe(Effect.mapError(cause => new BibleChapterRepositoryFailure({ cause })))

      if (rows.length === 0) {
        return yield* new BibleVerseSelectionNotFound(input)
      }

      const metadata = bibleMetadata(publication.metadata)
      return {
        versionId: input.versionId,
        revision: metadata.resource_revision ?? metadata.text_revision ?? publication.revision,
        textRevision: metadata.text_revision ?? metadata.resource_revision ?? publication.revision,
        ...(metadata.text_sha256 ? { textSha256: metadata.text_sha256 } : {}),
        verses: rows.map(row => ({
          book: row.book,
          chapter: row.chapter,
          verse: row.verse,
          text: row.text,
        })),
      } satisfies ActiveBibleVerseTexts
    }),
  findActiveChapter: input =>
    Effect.gen(function* () {
      const rows = yield* tryDatabasePromise('bible.chapter.read-active', () =>
        database
          .selectFrom('resource_publications')
          .leftJoin('bible_verses', join =>
            join
              .onRef('bible_verses.publication_id', '=', 'resource_publications.id')
              .on('bible_verses.book', '=', input.book)
              .on('bible_verses.chapter', '=', input.chapter)
          )
          .select([
            'resource_publications.revision',
            'resource_publications.metadata',
            'bible_verses.verse',
            'bible_verses.text',
            'bible_verses.presentation',
          ])
          .where('resource_publications.resource_identity', '=', `bible-text:${input.versionId}`)
          .where('resource_publications.status', '=', 'active')
          .orderBy('bible_verses.verse')
          .execute()
      ).pipe(Effect.mapError(cause => new BibleChapterRepositoryFailure({ cause })))

      if (rows.length === 0) {
        return yield* new ActiveBiblePublicationUnavailable({ versionId: input.versionId })
      }
      if (rows[0]?.verse === null) return yield* new BibleChapterNotFound(input)

      return {
        ...input,
        revision:
          bibleMetadata(rows[0]!.metadata).resource_revision ??
          bibleMetadata(rows[0]!.metadata).text_revision ??
          rows[0]!.revision,
        textRevision:
          bibleMetadata(rows[0]!.metadata).text_revision ??
          bibleMetadata(rows[0]!.metadata).resource_revision ??
          rows[0]!.revision,
        ...(bibleMetadata(rows[0]!.metadata).text_sha256
          ? { textSha256: bibleMetadata(rows[0]!.metadata).text_sha256 }
          : {}),
        verses: rows.map(row => ({
          number: row.verse!,
          text: row.text!,
          presentation: row.presentation!,
        })),
      } satisfies ActiveBibleChapter
    }),
  // The publication and its chapters are read in one statement, hence one round trip.
  //
  // `verseNumbers` holds the numbers of the verses of a chapter that have text, in ascending
  // order, or NULL when they are exactly 1 to the number of rows of the chapter. A chapter
  // holds one row per verse number, so that is the case when every row has text, the first
  // is numbered 1 and the last is numbered like the count. The numbers are gathered in the
  // aggregation that counts the rows and written out for the other chapters only.
  findActiveCoverage: versionId =>
    Effect.gen(function* () {
      const gathered = yield* tryDatabasePromise('bible.coverage.read-active', () =>
        sql<CoverageRows>`
          WITH publication AS MATERIALIZED (
            SELECT id, revision, metadata
              FROM resource_publications
             WHERE resource_identity = ${`bible-text:${versionId}`}
               AND status = 'active'
          ),
          chapters AS (
            SELECT v.book,
                   v.chapter,
                   count(v.verse) AS verse_count,
                   count(*) FILTER (WHERE v.has_text) AS text_count,
                   min(v.verse) AS first_verse,
                   max(v.verse) AS last_verse,
                   array_agg(v.verse ORDER BY v.verse) FILTER (WHERE v.has_text) AS text_verses
              FROM (
                SELECT book,
                       chapter,
                       verse,
                       ${verseHasText} AS has_text
                  FROM bible_verses
                 WHERE publication_id = (SELECT id FROM publication)
              ) v
             GROUP BY v.book, v.chapter
          )
          SELECT publication.revision,
                 publication.metadata,
                 (SELECT coalesce(
                           jsonb_agg(
                             jsonb_build_object(
                               'book', book,
                               'chapter', chapter,
                               'verseCount', verse_count,
                               'verseNumbers',
                               CASE
                                 WHEN text_count = verse_count
                                  AND first_verse = 1
                                  AND last_verse = verse_count
                                 THEN NULL
                                 ELSE to_jsonb(coalesce(text_verses, '{}'::integer[]))
                               END
                             )
                             ORDER BY book, chapter
                           ),
                           '[]'::jsonb
                         )
                    FROM chapters) AS chapters
            FROM publication
        `.execute(database)
      ).pipe(Effect.mapError(cause => new BibleChapterRepositoryFailure({ cause })))

      const publication = gathered.rows[0]
      if (!publication) return yield* new ActiveBiblePublicationUnavailable({ versionId })
      const rows = publication.chapters
      if (rows.length === 0) {
        return yield* new ActiveBiblePublicationUnavailable({ versionId })
      }
      const chaptersByBook: Record<string, number[]> = {}
      const verseCountByBookChapter: Record<string, number> = {}
      const verseNumbersByBookChapter: Record<string, number[]> = {}
      for (const { book, chapter, verseCount, verseNumbers } of rows) {
        if (!chaptersByBook[book]) {
          chaptersByBook[book] = []
        }
        chaptersByBook[book]!.push(chapter)
        verseCountByBookChapter[`${book}-${chapter}`] = verseCount
        if (verseNumbers) verseNumbersByBookChapter[`${book}-${chapter}`] = verseNumbers
      }
      const metadata = bibleMetadata(publication.metadata)
      const books = metadata.canon.orderedBooks.filter(book => chaptersByBook[book] !== undefined)
      return {
        versionId,
        revision: metadata.resource_revision ?? metadata.text_revision ?? publication.revision,
        textRevision: metadata.resource_revision ?? metadata.text_revision ?? publication.revision,
        ...(metadata.text_sha256 ? { textSha256: metadata.text_sha256 } : {}),
        canon: metadata.canon,
        versification: metadata.versification,
        books,
        chaptersByBook,
        verseCountByBookChapter,
        verseNumbersByBookChapter,
      }
    }),
  findActivePericopes: versionId =>
    Effect.gen(function* () {
      const publication = yield* tryDatabasePromise('bible.pericopes.read-publication', () =>
        database
          .selectFrom('resource_publications')
          .select(['id', 'revision', 'metadata'])
          .where('resource_identity', '=', `bible-text:${versionId}`)
          .where('status', '=', 'active')
          .executeTakeFirst()
      ).pipe(Effect.mapError(cause => new BibleChapterRepositoryFailure({ cause })))

      if (!publication) return yield* new ActiveBiblePublicationUnavailable({ versionId })
      const rows = yield* tryDatabasePromise('bible.pericopes.read-active', () =>
        database
          .selectFrom('bible_verses')
          .select(['book', 'chapter', 'verse', 'presentation'])
          .where('publication_id', '=', publication.id)
          .where(
            sql<boolean>`jsonb_array_length(${sql.ref('bible_verses.presentation')} -> 'headings') > 0`
          )
          .orderBy('bible_verses.book')
          .orderBy('bible_verses.chapter')
          .orderBy('bible_verses.verse')
          .execute()
      ).pipe(Effect.mapError(cause => new BibleChapterRepositoryFailure({ cause })))

      const metadata = bibleMetadata(publication.metadata)
      return {
        versionId,
        revision: metadata.resource_revision ?? metadata.text_revision ?? publication.revision,
        textRevision: metadata.resource_revision ?? metadata.text_revision ?? publication.revision,
        ...(metadata.text_sha256 ? { textSha256: metadata.text_sha256 } : {}),
        verses: rows.flatMap(row =>
          row.presentation!.headings.length > 0
            ? [
                {
                  book: row.book!,
                  chapter: row.chapter!,
                  verse: row.verse!,
                  headings: row.presentation!.headings,
                },
              ]
            : []
        ),
      }
    }),
})

export const makeNeonBibleChapterRepository = (config: NeonDatabaseConfig) => {
  const database = makeNeonDatabase(config)

  return {
    repository: makeKyselyBibleChapterRepository(database),
    dispose: () => database.destroy(),
  }
}
