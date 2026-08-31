import { Effect } from 'effect'
import { sql, type Kysely } from 'kysely'

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
  decodeDictionaryDirectoryPageCursor,
  encodeDictionaryDirectoryPageCursor,
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
    browseDirectory: input =>
      tryDatabasePromise('dictionary.directory.browse', async () => {
        const limit = input.limit ?? 100
        const cursor = decodeDictionaryDirectoryPageCursor(input.cursor)
        const initial = input.initial?.trim().toLocaleLowerCase()
        const search = input.search?.trim()
        const result = await sql<{
          group_key: string
          label: string
          normalized_label: string
          correspondence_id: string | null
          sources: Array<{
            work: string
            language: DictionaryLanguage
            revision: string
            resourceId: string
            title: string
            abbreviation: string
            id: number
            word: string
            normalizedWord: string
          }>
        }>`
          WITH active_entries AS (
            SELECT
              CASE
                WHEN entry.correspondence_id IS NOT NULL
                  THEN 'c:' || entry.correspondence_id
                ELSE 'e:' || publication.id::text || ':' || entry.entry_id::text
              END AS group_key,
              entry.correspondence_id,
              publication.resource_identity,
              publication.revision,
              publication.language,
              publication.metadata,
              entry.entry_id,
              entry.word,
              entry.normalized_word
            FROM dictionary_entries entry
            JOIN resource_publications publication ON publication.id = entry.publication_id
            WHERE publication.resource_kind = 'dictionary'
              AND publication.status = 'active'
              AND publication.resource_identity ~ '^dictionary:[a-z0-9]+(?:-[a-z0-9]+)*:(?:fr|en)$'
              AND coalesce(publication.metadata->>'resource_id', '') <> ''
              AND coalesce(publication.metadata->>'title', '') <> ''
              AND coalesce(publication.metadata->>'abbreviation', '') <> ''
          ),
          directory_keys AS (
            SELECT
              group_key,
              (array_agg(word ORDER BY (language = ${input.language}) DESC, normalized_word, resource_identity, entry_id))[1] AS label,
              (array_agg(normalized_word ORDER BY (language = ${input.language}) DESC, normalized_word, resource_identity, entry_id))[1] AS normalized_label,
              max(correspondence_id) AS correspondence_id,
              bool_or(${search ?? null}::text IS NULL OR word ILIKE ${search ? `%${search}%` : null} OR normalized_word ILIKE ${search ? `%${search}%` : null}) AS matches_search
            FROM active_entries
            GROUP BY group_key
            HAVING bool_or(language = ${input.language})
          ),
          page_keys AS (
            SELECT group_key, label, normalized_label, correspondence_id
            FROM directory_keys
            WHERE matches_search
              AND (${initial ?? null}::text IS NULL OR normalized_label ILIKE ${initial ? `${initial}%` : null})
              AND (
                ${cursor?.[0] ?? null}::text IS NULL
                OR normalized_label > ${cursor?.[0] ?? null}
                OR (normalized_label = ${cursor?.[0] ?? null} AND group_key > ${cursor?.[1] ?? null})
              )
            ORDER BY normalized_label, group_key
            LIMIT ${limit + 1}
          )
          SELECT
            key.group_key,
            key.label,
            key.normalized_label,
            key.correspondence_id,
            jsonb_agg(
              jsonb_build_object(
                'work', split_part(entry.resource_identity, ':', 2),
                'language', entry.language,
                'revision', entry.revision,
                'resourceId', entry.metadata->>'resource_id',
                'title', entry.metadata->>'title',
                'abbreviation', entry.metadata->>'abbreviation',
                'id', entry.entry_id,
                'word', entry.word,
                'normalizedWord', entry.normalized_word
              ) ORDER BY entry.language, entry.resource_identity, entry.entry_id
            ) AS sources
          FROM page_keys key
          JOIN active_entries entry ON entry.group_key = key.group_key
          GROUP BY key.group_key, key.label, key.normalized_label, key.correspondence_id
          ORDER BY key.normalized_label, key.group_key
        `.execute(database)
        const rows = result.rows
        const pageRows = rows.slice(0, limit)
        return {
          items: pageRows.map(row => ({
            key: row.group_key,
            label: row.label,
            normalizedLabel: row.normalized_label,
            ...(row.correspondence_id ? { correspondenceId: row.correspondence_id } : {}),
            sources: row.sources,
          })),
          limit,
          ...(rows.length > limit && pageRows.length > 0
            ? {
                nextCursor: encodeDictionaryDirectoryPageCursor([
                  pageRows.at(-1)!.normalized_label,
                  pageRows.at(-1)!.group_key,
                ]),
              }
            : {}),
        }
      }).pipe(Effect.mapError(cause => new DictionaryRepositoryFailure({ cause }))),
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
    findPassageAnchors: input =>
      Effect.gen(function* () {
        const publication = yield* requirePublication(input.work, input.language)
        const rows = yield* tryDatabasePromise('dictionary.verse.read-anchors', () =>
          database
            .selectFrom('dictionary_verse_links as link')
            .innerJoin('dictionary_entries as entry', join =>
              join
                .onRef('entry.publication_id', '=', 'link.publication_id')
                .onRef('entry.entry_id', '=', 'link.entry_id')
            )
            .select([
              'entry.entry_id as entry_id',
              'entry.word as word',
              'entry.normalized_word as normalized_word',
              'link.evidence_kind as evidence_kind',
            ])
            .where('link.publication_id', '=', publication.id)
            .where('link.verse_key', '=', input.verseKey)
            .where('link.entry_id', 'is not', null)
            .where('link.evidence_kind', '=', 'source-citation')
            .orderBy('link.ordinal')
            .execute()
        ).pipe(Effect.mapError(cause => new DictionaryRepositoryFailure({ cause })))
        return {
          work: input.work,
          language: input.language,
          revision: publication.revision,
          verseKey: input.verseKey,
          entries: rows.map(row => ({
            id: row.entry_id,
            word: row.word,
            normalizedWord: row.normalized_word,
            evidenceKind: row.evidence_kind as 'source-citation',
          })),
        }
      }),
    discoverPassageEntries: input =>
      tryDatabasePromise('dictionary.passage.discover', async () => {
        let query = database
          .selectFrom('dictionary_verse_links as link')
          .innerJoin('resource_publications as publication', 'publication.id', 'link.publication_id')
          .innerJoin('dictionary_entries as entry', join =>
            join
              .onRef('entry.publication_id', '=', 'link.publication_id')
              .onRef('entry.entry_id', '=', 'link.entry_id')
          )
          .select([
            'publication.resource_identity',
            'publication.revision',
            'publication.language',
            'publication.metadata',
            'entry.entry_id',
            'entry.word',
            'entry.normalized_word',
            'entry.correspondence_id',
            'link.evidence_kind',
            'link.ordinal',
          ])
          .where('publication.resource_kind', '=', 'dictionary')
          .where('publication.status', '=', 'active')
          .where('link.verse_key', '=', input.verseKey)
          .where('link.entry_id', 'is not', null)
          .where('link.evidence_kind', '=', 'source-citation')
        if (input.language) query = query.where('publication.language', '=', input.language)
        const rows = await query
          .orderBy('publication.language')
          .orderBy('publication.resource_identity')
          .orderBy('link.ordinal')
          .orderBy('entry.entry_id')
          .execute()
        return rows.map(row => {
          const work = row.resource_identity.split(':')[1] ?? ''
          const language: DictionaryLanguage = row.language === 'en' ? 'en' : 'fr'
          return {
            work,
            language,
            revision: row.revision,
            resourceId: metadataString(row.metadata, 'resource_id'),
            title: metadataString(row.metadata, 'title'),
            abbreviation: metadataString(row.metadata, 'abbreviation'),
            id: row.entry_id,
            word: row.word,
            normalizedWord: row.normalized_word,
            evidenceKind: 'source-citation' as const,
            ...(row.correspondence_id ? { correspondenceId: row.correspondence_id } : {}),
          }
        })
      }).pipe(Effect.mapError(cause => new DictionaryRepositoryFailure({ cause }))),
  }
}

export const makeNeonDictionaryRepository = (config: NeonDatabaseConfig) => {
  const database = makeNeonDatabase(config)
  return { repository: makeKyselyDictionaryRepository(database), dispose: () => database.destroy() }
}
