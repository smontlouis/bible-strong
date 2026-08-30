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
  type DictionaryWork,
} from '../domain/dictionary'
import type { ResourceDatabase } from '../database/types'
import {
  decodeDictionaryPageCursor,
  encodeDictionaryPageCursor,
} from '@bible-strong/resource-domain/contracts/dictionaryContract'

const mapEntry = (row: {
  entry_id: number
  word: string
  definition: string
}): DictionaryEntry => ({
  id: row.entry_id,
  word: row.word,
  definition: row.definition,
})

const metadataString = (metadata: Record<string, unknown>, key: string): string =>
  typeof metadata[key] === 'string' ? metadata[key] : ''

const metadataStrings = (metadata: Record<string, unknown>, key: string): string[] =>
  Array.isArray(metadata[key])
    ? metadata[key].filter(
        (value): value is string => typeof value === 'string' && value.length > 0
      )
    : []

const metadataBoolean = (metadata: Record<string, unknown>, key: string): boolean =>
  metadata[key] === true

const mapWork = (row: {
  resource_identity: string
  revision: string
  language: string | null
  metadata: Record<string, unknown>
  provenance: { attribution?: string }
}): DictionaryWork => {
  const work = row.resource_identity.split(':')[1] ?? ''
  const language = row.language === 'en' ? 'en' : 'fr'
  const delivery =
    row.metadata.delivery_capabilities && typeof row.metadata.delivery_capabilities === 'object'
      ? (row.metadata.delivery_capabilities as Record<string, unknown>)
      : {}
  return {
    work,
    language,
    revision: row.revision,
    resourceId: metadataString(row.metadata, 'resource_id'),
    title: metadataString(row.metadata, 'title'),
    abbreviation: metadataString(row.metadata, 'abbreviation'),
    authors: metadataStrings(row.metadata, 'authors'),
    description: metadataString(row.metadata, 'description'),
    edition: metadataString(row.metadata, 'edition'),
    source: metadataString(row.metadata, 'source'),
    attribution: row.provenance.attribution ?? '',
    onlineAccess: metadataBoolean(delivery, 'onlineAccess'),
    offlineDownload: metadataBoolean(delivery, 'offlineDownload'),
  }
}

export const makeKyselyDictionaryRepository = (
  database: Kysely<ResourceDatabase>
): DictionaryRepositoryService => {
  const findActivePublication = (work: string, language: DictionaryLanguage) =>
    tryDatabasePromise('dictionary.publication.read-active', () =>
      database
        .selectFrom('resource_publications')
        .select(['id', 'revision'])
        .where('resource_identity', '=', `dictionary:${work}:${language}`)
        .where('status', '=', 'active')
        .executeTakeFirst()
    ).pipe(Effect.mapError(cause => new DictionaryRepositoryFailure({ cause })))

  const requirePublication = (work: string, language: DictionaryLanguage) =>
    Effect.gen(function* () {
      const publication = yield* findActivePublication(work, language)
      if (!publication) {
        return yield* new ActiveDictionaryPublicationUnavailable({ work, language })
      }
      return publication
    })

  return {
    listWorks: language =>
      tryDatabasePromise('dictionary.publications.list-active', async () => {
        let query = database
          .selectFrom('resource_publications')
          .select(['resource_identity', 'revision', 'language', 'metadata', 'provenance'])
          .where('resource_kind', '=', 'dictionary')
          .where('status', '=', 'active')
        if (language) query = query.where('language', '=', language)
        const rows = await query.orderBy('language').orderBy('resource_identity').execute()
        return rows
          .filter(row =>
            /^dictionary:[a-z0-9]+(?:-[a-z0-9]+)*:(?:fr|en)$/u.test(row.resource_identity)
          )
          .map(mapWork)
      }).pipe(Effect.mapError(cause => new DictionaryRepositoryFailure({ cause }))),
    listEntries: input =>
      Effect.gen(function* () {
        const publication = yield* requirePublication(input.work, input.language)
        const limit = input.limit ?? 500
        const cursor = decodeDictionaryPageCursor(input.cursor)
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
        if (cursor) {
          query = query.where(eb =>
            eb.or([
              eb('normalized_word', '>', cursor[0]),
              eb.and([eb('normalized_word', '=', cursor[0]), eb('entry_id', '>', cursor[1])]),
            ])
          )
        }
        const rows = yield* tryDatabasePromise('dictionary.entries.browse', () =>
          query
            .orderBy('normalized_word')
            .orderBy('entry_id')
            .limit(limit + 1)
            .execute()
        ).pipe(Effect.mapError(cause => new DictionaryRepositoryFailure({ cause })))
        const hasNext = rows.length > limit
        return {
          work: input.work,
          language: input.language,
          revision: publication.revision,
          entries: rows.slice(0, limit).map(row => ({
            id: row.entry_id,
            word: row.word,
            normalizedWord: row.normalized_word,
          })),
          limit,
          ...(hasNext && rows[limit - 1]
            ? {
                nextCursor: encodeDictionaryPageCursor([
                  rows[limit - 1].normalized_word,
                  rows[limit - 1].entry_id,
                ]),
              }
            : {}),
        }
      }),
    findEntry: input =>
      Effect.gen(function* () {
        const publication = yield* requirePublication(input.work, input.language)
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
        return {
          work: input.work,
          language: input.language,
          revision: publication.revision,
          entry: mapEntry(row),
        }
      }),
    findEntryById: input =>
      Effect.gen(function* () {
        const publication = yield* requirePublication(input.work, input.language)
        const row = yield* tryDatabasePromise('dictionary.entry.read-by-id', () =>
          database
            .selectFrom('dictionary_entries')
            .select(['entry_id', 'word', 'definition'])
            .where('publication_id', '=', publication.id)
            .where('entry_id', '=', input.id)
            .executeTakeFirst()
        ).pipe(Effect.mapError(cause => new DictionaryRepositoryFailure({ cause })))
        if (!row) return yield* new DictionaryEntryNotFound(input)
        return {
          work: input.work,
          language: input.language,
          revision: publication.revision,
          entry: mapEntry(row),
        }
      }),
    findEntries: input =>
      Effect.gen(function* () {
        const publication = yield* requirePublication(input.work, input.language)
        const words = [...new Set(input.words.map(word => word.trim().toLocaleLowerCase()))]
        if (words.length === 0) {
          return {
            work: input.work,
            language: input.language,
            revision: publication.revision,
            entries: [],
          }
        }
        const rows = yield* tryDatabasePromise('dictionary.entries.read-batch', () =>
          database
            .selectFrom('dictionary_entries')
            .select(['entry_id', 'word', 'definition', 'normalized_word'])
            .where('publication_id', '=', publication.id)
            .where('normalized_word', 'in', words)
            .orderBy('entry_id')
            .execute()
        ).pipe(Effect.mapError(cause => new DictionaryRepositoryFailure({ cause })))
        const firstByWord = new Map(rows.map(row => [row.normalized_word, row]))
        return {
          work: input.work,
          language: input.language,
          revision: publication.revision,
          entries: words.flatMap(word => {
            const row = firstByWord.get(word)
            return row ? [mapEntry(row)] : []
          }),
        }
      }),
    findVerseWords: input =>
      Effect.gen(function* () {
        const publication = yield* requirePublication(input.work, input.language)
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
          work: input.work,
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
