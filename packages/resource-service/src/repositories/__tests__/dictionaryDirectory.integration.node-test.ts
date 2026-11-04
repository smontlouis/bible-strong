import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { Effect } from 'effect'

import { createIsolatedPostgres } from '../../database/__tests__/isolatedPostgresTestSupport'
import { makeKyselyDictionaryRepository } from '../dictionaryRepository'

const runIntegration = process.env.RESOURCE_INTEGRATION === '1'
const connectionString =
  process.env.RESOURCE_DATABASE_URL ??
  'postgresql://bible_strong:bible_strong@127.0.0.1:54329/bible_strong'

describe('Dictionary directory PostgreSQL repository', { skip: !runIntegration }, () => {
  it('finds the notions holding a heading with every article filed under them', async () => {
    const isolated = await createIsolatedPostgres(connectionString, 'dictionary_directory', 1)
    const { database } = isolated

    try {
      const publish = async (
        work: string,
        language: 'fr' | 'en',
        status: 'active' | 'staged' = 'active'
      ) =>
        (
          await database
            .insertInto('resource_publications')
            .values({
              resource_identity: `dictionary:${work}:${language}`,
              resource_kind: 'dictionary',
              revision: `${work}-${language}-r1`,
              language,
              status,
              canonical_sha256: '1'.repeat(64),
              offline_artifact_sha256: '2'.repeat(64),
              provenance: { source: 'integration-test', imported_at: new Date(0).toISOString() },
              rights: { holder: 'integration-test', online: true, offline: true },
              metadata: {
                resource_id: `${work}-${language}`,
                title: work.toUpperCase(),
                abbreviation: work.slice(0, 3).toUpperCase(),
              },
            })
            .returning('id')
            .executeTakeFirstOrThrow()
        ).id
      const westphal = await publish('westphal', 'fr')
      const matthew = await publish('matthew', 'fr')
      const easton = await publish('easton', 'en')
      const entries = [
        // One notion across three dictionaries, its headings spelled differently.
        {
          publication_id: westphal,
          entry_id: 1,
          word: 'Éphèse',
          normalized_word: 'ephese',
          correspondence_id: 'ephesus',
        },
        {
          publication_id: matthew,
          entry_id: 1,
          word: 'Ephese',
          normalized_word: 'ephese',
          correspondence_id: 'ephesus',
        },
        {
          publication_id: easton,
          entry_id: 1,
          word: 'Ephesus',
          normalized_word: 'ephesus',
          correspondence_id: 'ephesus',
        },
        // Articles filed under no notion stand alone.
        {
          publication_id: westphal,
          entry_id: 2,
          word: 'Éphod',
          normalized_word: 'ephod',
          correspondence_id: null,
        },
        {
          publication_id: matthew,
          entry_id: 2,
          word: 'Éphod',
          normalized_word: 'ephod',
          correspondence_id: null,
        },
        // A notion only English dictionaries hold is no French notion.
        {
          publication_id: easton,
          entry_id: 2,
          word: 'Ephah',
          normalized_word: 'ephah',
          correspondence_id: 'ephah',
        },
        {
          publication_id: westphal,
          entry_id: 3,
          word: 'Jean',
          normalized_word: 'jean',
          correspondence_id: 'john',
        },
      ]
      await database
        .insertInto('dictionary_entries')
        .values(entries.map(entry => ({ ...entry, definition: '', payload: {} })))
        .execute()

      const repository = makeKyselyDictionaryRepository(database)
      const browse = async (input: Parameters<typeof repository.browseDirectory>[0]) =>
        (await Effect.runPromise(repository.browseDirectory(input))).items.map(item => ({
          label: item.label,
          sources: item.sources.map(source => `${source.work}:${source.language}:${source.id}`),
        }))

      // The English heading alone matches, and the notion brings its French articles along.
      assert.deepEqual(await browse({ language: 'fr', search: 'ephesus' }), [
        {
          label: 'Ephese',
          sources: ['easton:en:1', 'matthew:fr:1', 'westphal:fr:1'],
        },
      ])
      assert.deepEqual(await browse({ language: 'fr', search: 'EPH' }), [
        { label: 'Ephese', sources: ['easton:en:1', 'matthew:fr:1', 'westphal:fr:1'] },
        { label: 'Éphod', sources: ['westphal:fr:2'] },
        { label: 'Éphod', sources: ['matthew:fr:2'] },
      ])
      assert.deepEqual(await browse({ language: 'en', search: 'eph' }), [
        { label: 'Ephah', sources: ['easton:en:2'] },
        { label: 'Ephesus', sources: ['easton:en:1', 'matthew:fr:1', 'westphal:fr:1'] },
      ])
      assert.deepEqual(await browse({ language: 'fr', search: 'eph', initial: 'ephe' }), [
        { label: 'Ephese', sources: ['easton:en:1', 'matthew:fr:1', 'westphal:fr:1'] },
      ])
      assert.deepEqual(await browse({ language: 'fr', search: '%' }), [])

      // A search pages the way a browse does.
      const first = await Effect.runPromise(
        repository.browseDirectory({ language: 'fr', search: 'eph', limit: 2 })
      )
      assert.equal(first.items.length, 2)
      const second = await Effect.runPromise(
        repository.browseDirectory({
          language: 'fr',
          search: 'eph',
          limit: 2,
          cursor: first.nextCursor,
        })
      )
      assert.deepEqual(
        second.items.map(item => item.sources.map(source => `${source.work}:${source.id}`)),
        [['matthew:2']]
      )
      assert.equal(second.nextCursor, undefined)

      // A staged publication is left out of the notions it shares, even when it alone matches.
      const smith = await publish('smith', 'fr', 'staged')
      await database
        .insertInto('dictionary_entries')
        .values({
          publication_id: smith,
          entry_id: 1,
          word: 'Ephesos',
          normalized_word: 'ephesos',
          correspondence_id: 'ephesus',
          definition: '',
          payload: {},
        })
        .execute()
      assert.deepEqual(await browse({ language: 'fr', search: 'ephesos' }), [])
      assert.deepEqual(await browse({ language: 'fr', search: 'ephesus' }), [
        { label: 'Ephese', sources: ['easton:en:1', 'matthew:fr:1', 'westphal:fr:1'] },
      ])
      assert.deepEqual(
        (await browse({ language: 'fr' })).map(item => item.label),
        ['Ephese', 'Éphod', 'Éphod', 'Jean']
      )
    } finally {
      await isolated.dispose()
    }
  })
})
