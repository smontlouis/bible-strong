import { Effect } from 'effect'
import { sql, type Kysely } from 'kysely'

import { tryDatabasePromise } from '../database/databaseEffect'
import { makeNeonDatabase, type NeonDatabaseConfig } from '../database/neonDatabase'
import type { ResourceDatabase } from '../database/types'
import {
  ActiveSupplementaryPublicationUnavailable,
  SupplementaryContentNotFound,
  SupplementaryRepositoryFailure,
  type SupplementaryRepositoryService,
} from '../domain/supplementary'

const crossReferenceIdentity = 'cross-references:fr'
const commentaryIdentity = (collection: string, language: string) =>
  `commentary:${collection}:${language}`

export const buildCommentaryCoverage = (verseKeys: readonly string[]) => {
  const chapters = new Map<number, Set<number>>()
  for (const verseKey of verseKeys) {
    const [book, chapter] = verseKey.split('-', 3).map(Number)
    if (!Number.isSafeInteger(book) || book < 1 || !Number.isSafeInteger(chapter) || chapter < 1) {
      continue
    }
    const bookChapters = chapters.get(book) ?? new Set<number>()
    bookChapters.add(chapter)
    chapters.set(book, bookChapters)
  }
  const books = [...chapters.keys()].sort((left, right) => left - right)
  return {
    books,
    chaptersByBook: Object.fromEntries(
      books.map(book => [
        String(book),
        [...chapters.get(book)!].sort((left, right) => left - right),
      ])
    ),
  }
}

export const makeKyselySupplementaryRepository = (
  database: Kysely<ResourceDatabase>
): SupplementaryRepositoryService => {
  const findActivePublication = (resourceIdentity: string) =>
    tryDatabasePromise('supplementary.publication.read-active', () =>
      database
        .selectFrom('resource_publications')
        .select(['id', 'revision'])
        .where('resource_identity', '=', resourceIdentity)
        .where('status', '=', 'active')
        .executeTakeFirst()
    ).pipe(Effect.mapError(cause => new SupplementaryRepositoryFailure({ cause })))

  return {
    findCommentaryReadingIndex: input =>
      Effect.gen(function* () {
        const resourceIdentity = commentaryIdentity(input.collection, input.language)
        const publication = yield* findActivePublication(resourceIdentity)
        if (!publication)
          return yield* new ActiveSupplementaryPublicationUnavailable({ resourceIdentity })
        const sections = yield* tryDatabasePromise('commentary.reading.index', () =>
          database
            .selectFrom('commentary_reading_sections')
            .select(['id', 'range_start_verse', 'range_end_verse', 'excerpt'])
            .where('publication_id', '=', publication.id)
            .where('book', '=', input.book)
            .where('chapter', '=', input.chapter)
            .orderBy('range_start_verse')
            .orderBy('range_end_verse')
            .orderBy('id')
            .execute()
        ).pipe(Effect.mapError(cause => new SupplementaryRepositoryFailure({ cause })))
        if (sections.length === 0) {
          const indexed = yield* tryDatabasePromise('commentary.reading.index-presence', () =>
            database
              .selectFrom('commentary_reading_sections')
              .select('id')
              .where('publication_id', '=', publication.id)
              .limit(1)
              .executeTakeFirst()
          ).pipe(Effect.mapError(cause => new SupplementaryRepositoryFailure({ cause })))
          if (!indexed)
            return yield* new ActiveSupplementaryPublicationUnavailable({ resourceIdentity })
        }
        return {
          revision: publication.revision,
          sections: sections.map(row => ({
            id: row.id,
            rangeStartVerse: row.range_start_verse,
            rangeEndVerse: row.range_end_verse,
            excerpt: row.excerpt,
          })),
        }
      }),
    findCommentaryReadingSection: input =>
      Effect.gen(function* () {
        const resourceIdentity = commentaryIdentity(input.resourceId, input.language)
        const publication = yield* tryDatabasePromise('commentary.reading.revision', () =>
          database
            .selectFrom('resource_publications')
            .select(['id', 'revision'])
            .where('resource_identity', '=', resourceIdentity)
            .where('revision', '=', input.revision)
            .where('activated_at', 'is not', null)
            .executeTakeFirst()
        ).pipe(Effect.mapError(cause => new SupplementaryRepositoryFailure({ cause })))
        if (!publication) return yield* new SupplementaryContentNotFound({ resourceIdentity })
        const section = yield* tryDatabasePromise('commentary.reading.section', () =>
          database
            .selectFrom('commentary_reading_sections')
            .select(['id', 'range_start_verse', 'range_end_verse', 'content'])
            .where('publication_id', '=', publication.id)
            .where('book', '=', input.book)
            .where('chapter', '=', input.chapter)
            .where('id', '=', input.sectionId)
            .executeTakeFirst()
        ).pipe(Effect.mapError(cause => new SupplementaryRepositoryFailure({ cause })))
        if (!section) return yield* new SupplementaryContentNotFound({ resourceIdentity })
        return {
          revision: publication.revision,
          section: {
            id: section.id,
            rangeStartVerse: section.range_start_verse,
            rangeEndVerse: section.range_end_verse,
            content: section.content,
          },
        }
      }),
    findCommentaryVerse: input =>
      Effect.gen(function* () {
        const resourceIdentity = commentaryIdentity(input.collection, input.language)
        const publication = yield* findActivePublication(resourceIdentity)
        if (!publication) {
          return yield* new ActiveSupplementaryPublicationUnavailable({
            resourceIdentity,
          })
        }
        const row = yield* tryDatabasePromise('supplementary.commentary.read-verse', () =>
          database
            .selectFrom('commentary_verses')
            .select(['verse_key', 'content'])
            .where('publication_id', '=', publication.id)
            .where('verse_key', '=', input.verseKey)
            .executeTakeFirst()
        ).pipe(Effect.mapError(cause => new SupplementaryRepositoryFailure({ cause })))
        if (!row) {
          return yield* new SupplementaryContentNotFound({
            resourceIdentity,
            verseKey: input.verseKey,
          })
        }
        return {
          ...input,
          revision: publication.revision,
          verseKey: row.verse_key,
          content: row.content,
        }
      }),
    findCommentaryChapter: input =>
      Effect.gen(function* () {
        const resourceIdentity = commentaryIdentity(input.collection, input.language)
        const publication = yield* findActivePublication(resourceIdentity)
        if (!publication) {
          return yield* new ActiveSupplementaryPublicationUnavailable({
            resourceIdentity,
          })
        }
        const prefix = `${input.book}-${input.chapter}-`
        const rows = yield* tryDatabasePromise('supplementary.commentary.read-chapter', () =>
          database
            .selectFrom('commentary_verses')
            .select(['verse_key', 'content'])
            .where('publication_id', '=', publication.id)
            .where('verse_key', 'like', `${prefix}%`)
            .orderBy('verse_key')
            .execute()
        ).pipe(Effect.mapError(cause => new SupplementaryRepositoryFailure({ cause })))
        if (rows.length === 0) {
          return yield* new SupplementaryContentNotFound({
            resourceIdentity,
          })
        }
        return {
          ...input,
          revision: publication.revision,
          comments: Object.fromEntries(
            rows.map(row => [row.verse_key.slice(prefix.length), row.content])
          ),
        }
      }),
    // The section of each commentary that bears most closely on the verse, as
    // `closestCommentarySection` picks it among the sections of the chapter: of those that
    // cover the verse, the one on the fewest verses, then the one that starts last, then the
    // first in the chapter. A commentary that does not comment the verse still answers with
    // its revision. The sections are written at publication (ADR-0087); a publication that
    // has none was imported before and is refused rather than answered as silent.
    findCommentaryVerseSections: input =>
      Effect.gen(function* () {
        if (input.collections.length === 0) return []
        const rows = yield* tryDatabasePromise('supplementary.commentary.read-verse-sections', () =>
          database
            .selectFrom('resource_publications')
            .leftJoinLateral(
              nested =>
                nested
                  .selectFrom('commentary_chapter_sections')
                  .select(['slug', 'start_verse', 'end_verse', 'content'])
                  .whereRef(
                    'commentary_chapter_sections.publication_id',
                    '=',
                    'resource_publications.id'
                  )
                  .where('commentary_chapter_sections.book', '=', input.book)
                  .where('commentary_chapter_sections.chapter', '=', input.chapter)
                  .where('commentary_chapter_sections.end_verse', '>', 0)
                  .where('commentary_chapter_sections.start_verse', '<=', input.verse)
                  .where('commentary_chapter_sections.end_verse', '>=', input.verse)
                  .orderBy(sql`end_verse - start_verse`)
                  .orderBy('commentary_chapter_sections.start_verse', 'desc')
                  .orderBy('commentary_chapter_sections.ordinal')
                  .limit(1)
                  .as('section'),
              join => join.onTrue()
            )
            .select([
              'resource_publications.resource_identity',
              'resource_publications.revision',
              sql<boolean>`EXISTS (
                SELECT 1 FROM commentary_chapter_sections written
                 WHERE written.publication_id = resource_publications.id
              )`.as('sections_written'),
              'section.slug',
              'section.start_verse',
              'section.end_verse',
              'section.content',
            ])
            .where(
              'resource_publications.resource_identity',
              'in',
              input.collections.map(collection => commentaryIdentity(collection, input.language))
            )
            .where('resource_publications.status', '=', 'active')
            .execute()
        ).pipe(Effect.mapError(cause => new SupplementaryRepositoryFailure({ cause })))
        const unwritten = rows.find(row => !row.sections_written)
        if (unwritten) {
          return yield* new SupplementaryRepositoryFailure({
            cause: new Error(`COMMENTARY_CHAPTER_SECTIONS_MISSING ${unwritten.resource_identity}`),
          })
        }
        return input.collections.flatMap(collection => {
          const row = rows.find(
            candidate =>
              candidate.resource_identity === commentaryIdentity(collection, input.language)
          )
          if (!row) return []
          return [
            {
              collection,
              revision: row.revision,
              ...(row.slug !== null &&
              row.start_verse !== null &&
              row.end_verse !== null &&
              row.content !== null
                ? {
                    section: {
                      slug: row.slug,
                      startVerse: row.start_verse,
                      endVerse: row.end_verse,
                      content: row.content,
                    },
                  }
                : {}),
            },
          ]
        })
      }),
    findCommentaryCoverage: input =>
      Effect.gen(function* () {
        const resourceIdentity = commentaryIdentity(input.collection, input.language)
        const publication = yield* findActivePublication(resourceIdentity)
        if (!publication) {
          return yield* new ActiveSupplementaryPublicationUnavailable({ resourceIdentity })
        }
        const rows = yield* tryDatabasePromise('supplementary.commentary.read-coverage', () =>
          database
            .selectFrom('commentary_verses')
            .select(
              sql<string>`concat(split_part(verse_key, '-', 1), '-', split_part(verse_key, '-', 2))`.as(
                'chapter_key'
              )
            )
            .distinct()
            .where('publication_id', '=', publication.id)
            .execute()
        ).pipe(Effect.mapError(cause => new SupplementaryRepositoryFailure({ cause })))
        return {
          ...input,
          revision: publication.revision,
          ...buildCommentaryCoverage(rows.map(row => row.chapter_key)),
        }
      }),
    findCrossReferences: input =>
      Effect.gen(function* () {
        const publication = yield* findActivePublication(crossReferenceIdentity)
        if (!publication) {
          return yield* new ActiveSupplementaryPublicationUnavailable({
            resourceIdentity: crossReferenceIdentity,
          })
        }
        const rows = yield* tryDatabasePromise('supplementary.cross-references.read-verse', () =>
          database
            .selectFrom('cross_reference_links')
            .select(['reference'])
            .where('publication_id', '=', publication.id)
            .where('verse_key', '=', input.verseKey)
            .orderBy('ordinal')
            .execute()
        ).pipe(Effect.mapError(cause => new SupplementaryRepositoryFailure({ cause })))
        if (rows.length === 0) {
          return yield* new SupplementaryContentNotFound({
            resourceIdentity: crossReferenceIdentity,
            verseKey: input.verseKey,
          })
        }
        return {
          ...input,
          revision: publication.revision,
          references: rows.map(row => row.reference),
        }
      }),
  }
}

export const makeNeonSupplementaryRepository = (config: NeonDatabaseConfig) => {
  const database = makeNeonDatabase(config)
  return {
    repository: makeKyselySupplementaryRepository(database),
    dispose: () => database.destroy(),
  }
}
