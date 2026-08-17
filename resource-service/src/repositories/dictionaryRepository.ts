import { Effect } from 'effect'
import type { Kysely } from 'kysely'

import { tryDatabasePromise } from '../database/databaseEffect'
import { makeNeonDatabase, type NeonDatabaseConfig } from '../database/neonDatabase'
import {
  ActiveDictionaryPublicationUnavailable,
  DictionaryEntryNotFound,
  DictionaryRepositoryFailure,
  type DictionaryEntry,
  type DictionaryLanguage,
  type DictionaryRepositoryService,
} from '../domain/dictionary'
import type { ResourceDatabase } from '../database/types'

const mapEntry = (row: {
  entry_id: number
  word: string
  definition: string
}): DictionaryEntry => ({
  id: row.entry_id,
  word: row.word,
  definition: row.definition,
})

export const makeKyselyDictionaryRepository = (
  database: Kysely<ResourceDatabase>
): DictionaryRepositoryService => {
  const findActivePublication = (language: DictionaryLanguage) =>
    tryDatabasePromise('dictionary.publication.read-active', () =>
      database
        .selectFrom('resource_publications')
        .select(['id', 'revision'])
        .where('resource_identity', '=', `dictionary:${language}`)
        .where('status', '=', 'active')
        .executeTakeFirst()
    ).pipe(Effect.mapError(cause => new DictionaryRepositoryFailure({ cause })))

  const requirePublication = (language: DictionaryLanguage) =>
    Effect.gen(function* () {
      const publication = yield* findActivePublication(language)
      if (!publication) {
        return yield* new ActiveDictionaryPublicationUnavailable({ language })
      }
      return publication
    })

  return {
    listEntries: input =>
      Effect.gen(function* () {
        const publication = yield* requirePublication(input.language)
        const limit = input.limit ?? 500
        const offset = input.offset ?? 0
        let query = database
          .selectFrom('dictionary_entries')
          .select(['entry_id', 'word', 'normalized_word'])
          .where('publication_id', '=', publication.id)
        if (input.initial?.trim()) {
          query = query.where(
            'normalized_word',
            'ilike',
            `${input.initial.trim().toLocaleLowerCase()}%`
          )
        }
        if (input.search?.trim()) {
          const search = `%${input.search.trim()}%`
          query = query.where(eb =>
            eb.or([eb('word', 'ilike', search), eb('normalized_word', 'ilike', search)])
          )
        }
        const rows = yield* tryDatabasePromise('dictionary.entries.browse', () =>
          query
            .orderBy('normalized_word')
            .orderBy('entry_id')
            .limit(limit + 1)
            .offset(offset)
            .execute()
        ).pipe(Effect.mapError(cause => new DictionaryRepositoryFailure({ cause })))
        const hasNext = rows.length > limit
        return {
          language: input.language,
          revision: publication.revision,
          entries: rows.slice(0, limit).map(row => ({
            id: row.entry_id,
            word: row.word,
            normalizedWord: row.normalized_word,
          })),
          offset,
          limit,
          ...(hasNext ? { nextOffset: offset + limit } : {}),
        }
      }),
    findEntry: input =>
      Effect.gen(function* () {
        const publication = yield* requirePublication(input.language)
        const normalized = input.word.trim().toLocaleLowerCase()
        const row = yield* tryDatabasePromise('dictionary.entry.read', () =>
          database
            .selectFrom('dictionary_entries')
            .select(['entry_id', 'word', 'definition'])
            .where('publication_id', '=', publication.id)
            .where(eb =>
              eb.or([eb('normalized_word', '=', normalized), eb('word', '=', input.word)])
            )
            .orderBy('entry_id')
            .executeTakeFirst()
        ).pipe(Effect.mapError(cause => new DictionaryRepositoryFailure({ cause })))
        if (!row) return yield* new DictionaryEntryNotFound(input)
        return { language: input.language, revision: publication.revision, entry: mapEntry(row) }
      }),
    findEntryById: input =>
      Effect.gen(function* () {
        const publication = yield* requirePublication(input.language)
        const row = yield* tryDatabasePromise('dictionary.entry.read-by-id', () =>
          database
            .selectFrom('dictionary_entries')
            .select(['entry_id', 'word', 'definition'])
            .where('publication_id', '=', publication.id)
            .where('entry_id', '=', input.id)
            .executeTakeFirst()
        ).pipe(Effect.mapError(cause => new DictionaryRepositoryFailure({ cause })))
        if (!row) return yield* new DictionaryEntryNotFound(input)
        return { language: input.language, revision: publication.revision, entry: mapEntry(row) }
      }),
    findVerseWords: input =>
      Effect.gen(function* () {
        const publication = yield* requirePublication(input.language)
        const rows = yield* tryDatabasePromise('dictionary.verse.read-words', () =>
          database
            .selectFrom('dictionary_verse_links')
            .select(['word'])
            .where('publication_id', '=', publication.id)
            .where('verse_key', '=', input.verseKey)
            .orderBy('ordinal')
            .execute()
        ).pipe(Effect.mapError(cause => new DictionaryRepositoryFailure({ cause })))
        return {
          language: input.language,
          revision: publication.revision,
          verseKey: input.verseKey,
          words: rows.map(row => row.word),
        }
      }),
  }
}

export const makeNeonDictionaryRepository = (config: NeonDatabaseConfig) => {
  const database = makeNeonDatabase(config)
  return { repository: makeKyselyDictionaryRepository(database), dispose: () => database.destroy() }
}
