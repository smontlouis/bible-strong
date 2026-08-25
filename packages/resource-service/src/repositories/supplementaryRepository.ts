import { Effect } from 'effect'
import { type Kysely } from 'kysely'

import { tryDatabasePromise } from '../database/databaseEffect'
import { makeNeonDatabase, type NeonDatabaseConfig } from '../database/neonDatabase'
import type { ResourceDatabase } from '../database/types'
import {
  ActiveSupplementaryPublicationUnavailable,
  SupplementaryContentNotFound,
  SupplementaryRepositoryFailure,
  type SupplementaryRepositoryService,
} from '../domain/supplementary'

const commentaryIdentity = 'commentary:MHY:fr'
const crossReferenceIdentity = 'cross-references:fr'

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
        const publication = yield* findActivePublication(commentaryIdentity)
        if (!publication) {
          return yield* new ActiveSupplementaryPublicationUnavailable({
            resourceIdentity: commentaryIdentity,
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
            resourceIdentity: commentaryIdentity,
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
        const publication = yield* findActivePublication(commentaryIdentity)
        if (!publication) {
          return yield* new ActiveSupplementaryPublicationUnavailable({
            resourceIdentity: commentaryIdentity,
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
            resourceIdentity: commentaryIdentity,
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
