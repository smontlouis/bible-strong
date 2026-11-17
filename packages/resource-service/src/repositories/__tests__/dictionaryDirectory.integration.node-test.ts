import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { dictionaryTermSlug } from '@bible-strong/resource-domain/contracts/dictionaryContract'
import { Effect } from 'effect'
import { sql } from 'kysely'

import { createIsolatedPostgres } from '../../database/__tests__/isolatedPostgresTestSupport'
import { dictionaryTermSlugSql } from '../../database/dictionaryTermSlug'
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

  it('finds a term by the slug of its label, through the index on the slug of the headings', async () => {
    const isolated = await createIsolatedPostgres(connectionString, 'dictionary_term', 1)
    const { database } = isolated

    try {
      // The rule of the site and its SQL agree on awkward headings.
      const headings = [
        'Ésaïe',
        'Cœur',
        'Æthiopie',
        'Straße',
        'İsrael',
        "L'Éternel",
        'Ephèse (ville)',
        '  Alpha et Oméga  ',
        'אֱלֹהִים',
        'ΚΥΡΙΟΣ',
        'Ñuño',
        'Noël',
        'Zoroastre-2',
        '---',
      ]
      const { rows } = await sql<{ heading: string; slug: string }>`
        SELECT heading, ${sql.raw(dictionaryTermSlugSql('heading'))} AS slug
        FROM unnest(${headings}::text[]) heading
      `.execute(database)
      assert.deepEqual(
        rows.map(row => [row.heading, row.slug]),
        headings.map(heading => [heading, dictionaryTermSlug(heading)])
      )

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
      const smith = await publish('smith', 'fr', 'staged')
      const entry = (
        publication_id: number,
        entry_id: number,
        word: string,
        normalized_word: string,
        correspondence_id: string | null
      ) => ({ publication_id, entry_id, word, normalized_word, correspondence_id })
      await database
        .insertInto('dictionary_entries')
        .values(
          [
            // A notion whose French label is another heading than the English one.
            entry(westphal, 1, 'Éphèse', 'ephese', 'ephesus'),
            entry(matthew, 1, 'Ephese', 'ephese', 'ephesus'),
            entry(easton, 1, 'Ephesus', 'ephesus', 'ephesus'),
            // Two articles filed under no notion share a heading: two notions, one slug.
            entry(westphal, 2, 'Éphod', 'ephod', null),
            entry(matthew, 2, 'Éphod', 'ephod', null),
            // A notion only an English dictionary holds is no French term.
            entry(easton, 2, 'Ephah', 'ephah', 'ephah'),
            // A heading whose normalized form keeps its accents: the search by its first word
            // never found it.
            entry(westphal, 3, 'Ésaïe', 'ésaïe', null),
            // A staged dictionary is no term.
            entry(smith, 1, 'Éphraïm', 'ephraim', null),
          ].map(row => ({ ...row, definition: '', payload: {} }))
        )
        .execute()

      const repository = makeKyselyDictionaryRepository(database)
      const term = (language: 'fr' | 'en', slug: string) =>
        Effect.runPromise(repository.findDirectoryTerm({ language, slug }))
      // How the site found a term before: by the first word of its slug, in the directory.
      const searched = async (language: 'fr' | 'en', slug: string) =>
        (
          await Effect.runPromise(
            repository.browseDirectory({ language, search: slug.split('-')[0], limit: 100 })
          )
        ).items.find(item => dictionaryTermSlug(item.label) === slug)

      for (const [language, slug] of [
        ['fr', 'ephese'],
        ['en', 'ephesus'],
        ['fr', 'ephod'],
        ['en', 'ephah'],
      ] as const) {
        const found = await term(language, slug)
        assert.ok(found, `${language}:${slug}`)
        assert.deepEqual(found, await searched(language, slug))
      }
      assert.equal((await term('fr', 'ephod'))?.sources[0]?.work, 'westphal')
      // The English heading of a French notion is not its French label.
      assert.equal(await term('fr', 'ephesus'), undefined)
      assert.equal(await term('fr', 'ephah'), undefined)
      assert.equal(await term('fr', 'ephraim'), undefined)
      assert.equal(await term('fr', 'nothing'), undefined)
      // Found now, where the search by its first word did not find it.
      assert.equal(await searched('fr', 'esaie'), undefined)
      assert.deepEqual(
        (await term('fr', 'esaie'))?.sources.map(source => source.id),
        [3]
      )

      // The headings are found through the index on their slug.
      const plan = await database.transaction().execute(async transaction => {
        await sql`SET LOCAL enable_seqscan = off`.execute(transaction)
        return sql<{ 'QUERY PLAN': string }>`
          EXPLAIN SELECT entry_id FROM dictionary_entries entry
          WHERE ${sql.raw(dictionaryTermSlugSql('entry.word'))} = ${'ephod'}
        `.execute(transaction)
      })
      assert.match(
        plan.rows.map(row => row['QUERY PLAN']).join('\n'),
        /dictionary_entries_term_slug/u
      )
    } finally {
      await isolated.dispose()
    }
  })
})
