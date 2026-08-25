import { Effect } from 'effect'
import { type Kysely } from 'kysely'

import { tryDatabasePromise } from '../database/databaseEffect'
import { makeNeonDatabase, type NeonDatabaseConfig } from '../database/neonDatabase'
import type { ResourceDatabase } from '../database/types'
import {
  decodeNavePageCursor,
  encodeNavePageCursor,
} from '../../../src/features/resources/naveContract'
import {
  ActiveNavePublicationUnavailable,
  NaveRepositoryFailure,
  NaveTopicNotFound,
  type NaveRepositoryService,
  type NaveTopic,
} from '../domain/nave'

const mapTopic = (row: {
  normalized_name: string
  name: string
  initial: string
  description: string
}): NaveTopic => ({
  normalizedName: row.normalized_name,
  name: row.name,
  initial: row.initial,
  description: row.description,
})

export const makeKyselyNaveRepository = (
  database: Kysely<ResourceDatabase>
): NaveRepositoryService => {
  const findActivePublication = (language: 'fr' | 'en') =>
    tryDatabasePromise('nave.publication.read-active', () =>
      database
        .selectFrom('resource_publications')
        .select(['id', 'revision'])
        .where('resource_identity', '=', `nave:${language}`)
        .where('status', '=', 'active')
        .executeTakeFirst()
    ).pipe(Effect.mapError(cause => new NaveRepositoryFailure({ cause })))

  return {
    findTopic: input =>
      Effect.gen(function* () {
        const publication = yield* findActivePublication(input.language)
        if (!publication) {
          return yield* new ActiveNavePublicationUnavailable({ language: input.language })
        }
        const row = yield* tryDatabasePromise('nave.topic.read', () =>
          database
            .selectFrom('nave_topics')
            .select(['normalized_name', 'name', 'initial', 'description'])
            .where('publication_id', '=', publication.id)
            .where('normalized_name', '=', input.normalizedName)
            .executeTakeFirst()
        ).pipe(Effect.mapError(cause => new NaveRepositoryFailure({ cause })))
        if (!row) return yield* new NaveTopicNotFound(input)
        return { language: input.language, revision: publication.revision, topic: mapTopic(row) }
      }),
    listTopics: input =>
      Effect.gen(function* () {
        const limit = input.limit ?? 50
        const cursor = decodeNavePageCursor(input.cursor)
        const publication = yield* findActivePublication(input.language)
        if (!publication) {
          return yield* new ActiveNavePublicationUnavailable({ language: input.language })
        }
        let query = database
          .selectFrom('nave_topics')
          .select(['normalized_name', 'name', 'initial', 'description'])
          .where('publication_id', '=', publication.id)
        if (input.initial) query = query.where('initial', '=', input.initial)
        if (input.search) query = query.where('name', 'ilike', `%${input.search.trim()}%`)
        if (cursor) {
          query = query.where(eb =>
            eb.or([
              eb('name', '>', cursor[0]),
              eb.and([eb('name', '=', cursor[0]), eb('normalized_name', '>', cursor[1])]),
            ])
          )
        }
        const rows = yield* tryDatabasePromise('nave.topics.browse', () =>
          query
            .orderBy('name')
            .orderBy('normalized_name')
            .limit(limit + 1)
            .execute()
        ).pipe(Effect.mapError(cause => new NaveRepositoryFailure({ cause })))
        return {
          language: input.language,
          revision: publication.revision,
          topics: rows.slice(0, limit).map(mapTopic),
          limit,
          ...(rows.length > limit && rows[limit - 1]
            ? {
                nextCursor: encodeNavePageCursor([
                  rows[limit - 1].name,
                  rows[limit - 1].normalized_name,
                ]),
              }
            : {}),
        }
      }),
    findVerseTopics: input =>
      Effect.gen(function* () {
        const publication = yield* findActivePublication(input.language)
        if (!publication) {
          return yield* new ActiveNavePublicationUnavailable({ language: input.language })
        }
        const chapterKey = input.verseKey.split('-').slice(0, 2).join('-')
        const rows = yield* tryDatabasePromise('nave.verse-topics.read', () =>
          database
            .selectFrom('nave_verse_links')
            .innerJoin('nave_topics', join =>
              join
                .onRef('nave_topics.publication_id', '=', 'nave_verse_links.publication_id')
                .onRef('nave_topics.normalized_name', '=', 'nave_verse_links.normalized_name')
            )
            .select([
              'nave_verse_links.verse_key',
              'nave_topics.normalized_name',
              'nave_topics.name',
              'nave_topics.initial',
              'nave_topics.description',
            ])
            .where('nave_verse_links.publication_id', '=', publication.id)
            .where('nave_verse_links.verse_key', 'in', [input.verseKey, chapterKey])
            .orderBy('nave_topics.name')
            .execute()
        ).pipe(Effect.mapError(cause => new NaveRepositoryFailure({ cause })))
        return {
          language: input.language,
          revision: publication.revision,
          verseKey: input.verseKey,
          verseTopics: rows.filter(row => row.verse_key === input.verseKey).map(mapTopic),
          chapterTopics: rows.filter(row => row.verse_key === chapterKey).map(mapTopic),
        }
      }),
    findRandomTopic: language =>
      Effect.gen(function* () {
        const publication = yield* findActivePublication(language)
        if (!publication) return yield* new ActiveNavePublicationUnavailable({ language })
        const threshold = Math.random()
        let row = yield* tryDatabasePromise('nave.topic.random', () =>
          database
            .selectFrom('nave_topics')
            .select(['normalized_name', 'name', 'initial', 'description'])
            .where('publication_id', '=', publication.id)
            .where('random_key', '>=', threshold)
            .orderBy('random_key')
            .limit(1)
            .executeTakeFirst()
        ).pipe(Effect.mapError(cause => new NaveRepositoryFailure({ cause })))
        if (!row) {
          row = yield* tryDatabasePromise('nave.topic.random-wrap', () =>
            database
              .selectFrom('nave_topics')
              .select(['normalized_name', 'name', 'initial', 'description'])
              .where('publication_id', '=', publication.id)
              .orderBy('random_key')
              .limit(1)
              .executeTakeFirst()
          ).pipe(Effect.mapError(cause => new NaveRepositoryFailure({ cause })))
        }
        if (!row) return yield* new ActiveNavePublicationUnavailable({ language })
        return { language, revision: publication.revision, topic: mapTopic(row) }
      }),
  }
}

export const makeNeonNaveRepository = (config: NeonDatabaseConfig) => {
  const database = makeNeonDatabase(config)
  return { repository: makeKyselyNaveRepository(database), dispose: () => database.destroy() }
}
