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
