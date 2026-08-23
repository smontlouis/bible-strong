import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { Effect } from 'effect'

import { createIsolatedPostgres } from '../../database/__tests__/isolatedPostgresTestSupport'
import { makeKyselyBibleSearchRepository } from '../bibleSearchRepository'
import { makeKyselyBibleChapterRepository } from '../bibleChapterRepository'
import type { BibleSearchInput } from '../../domain/bibleSearch'

const runIntegration = process.env.RESOURCE_INTEGRATION === '1'
const connectionString =
  process.env.RESOURCE_DATABASE_URL ??
  'postgresql://bible_strong:bible_strong@127.0.0.1:54329/bible_strong'

describe('Bible search PostgreSQL repository', { skip: !runIntegration }, () => {
  it('searches several active publications with one SQL statement', async () => {
    const isolated = await createIsolatedPostgres(connectionString, 'bible_search_many')
    const { database } = isolated

    try {
      const publications = await database
        .insertInto('resource_publications')
        .values(
          ['LSG', 'DBY'].map(versionId => ({
            resource_identity: `bible-text:${versionId}`,
            resource_kind: 'bible-text',
            revision: `${versionId.toLowerCase()}-r1`,
            language: 'fr',
            status: 'active' as const,
            canonical_sha256: versionId === 'LSG' ? '1'.repeat(64) : '2'.repeat(64),
            offline_artifact_sha256: versionId === 'LSG' ? '3'.repeat(64) : '4'.repeat(64),
            provenance: { source: 'integration-test', imported_at: new Date(0).toISOString() },
            rights: { holder: 'integration-test', online: true, offline: true },
            metadata: {
              resource_revision: `${versionId.toLowerCase()}-r1`,
              text_revision: `${versionId.toLowerCase()}-r1`,
              canon: {
                id: versionId === 'LSG' ? 'protestant-66' : 'catholic-73',
                orderedBooks: [43],
              },
            },
          }))
        )
        .returning(['id', 'resource_identity'])
        .execute()

      await database
        .insertInto('bible_verses')
        .values(
          publications.map(publication => ({
            publication_id: publication.id,
            book: 43,
            chapter: 3,
            verse: 16,
            text: 'Car Dieu a tant aimé le monde',
            presentation: { startTags: [], layout: [], notes: [], headings: [] },
          }))
        )
        .execute()

      let statementCount = 0
      const instrumented = database.withPlugin({
        transformQuery(args) {
          statementCount += 1
          return args.node
        },
        async transformResult(args) {
          return args.result
        },
      })
      const repository = makeKyselyBibleSearchRepository(instrumented)
      const result = await Effect.runPromise(
        repository.searchMany({
          versionIds: ['LSG', 'DBY'],
          query: 'Dieu',
          sortOrder: 'book',
          limit: 20,
        })
      )

      assert.equal(statementCount, 1)
      assert.equal(result.count, 2)
      assert.deepEqual(
        result.resources.map(resource => resource.versionId),
        ['LSG', 'DBY']
      )
      assert.deepEqual(
        result.results.map(item => item.version),
        ['LSG', 'DBY']
      )

      statementCount = 0
      const catholicResult = await Effect.runPromise(
        repository.searchMany({
          versionIds: ['LSG', 'DBY'],
          query: 'Dieu',
          canon: 'catholic-73',
          limit: 20,
        })
      )
      assert.equal(statementCount, 1)
      assert.equal(catholicResult.count, 1)
      assert.deepEqual(
        catholicResult.results.map(item => item.version),
        ['DBY']
      )

      statementCount = 0
      const chapters = await Effect.runPromise(
        makeKyselyBibleChapterRepository(instrumented).findActiveChapters!({
          versionIds: ['LSG', 'DBY'],
          book: 43,
          chapter: 3,
        })
      )
      assert.equal(statementCount, 1)
      assert.deepEqual(
        chapters.map(value => value.versionId),
        ['LSG', 'DBY']
      )
    } finally {
      await isolated.dispose()
    }
  })

  it('supports phrases, natural terms, multilingual folding, fuzzy fallback, and testament filters', async () => {
    const isolated = await createIsolatedPostgres(connectionString, 'bible_search_semantics')
    const { database } = isolated

    try {
      const publication = await database
        .insertInto('resource_publications')
        .values({
          resource_identity: 'bible-text:LSG',
          resource_kind: 'bible-text',
          revision: 'lsg-search-r1',
          language: 'fr',
          status: 'active',
          canonical_sha256: '5'.repeat(64),
          offline_artifact_sha256: '6'.repeat(64),
          provenance: { source: 'integration-test', imported_at: new Date(0).toISOString() },
          rights: { holder: 'integration-test', online: true, offline: true },
          metadata: {
            resource_revision: 'lsg-search-r1',
            text_revision: 'lsg-search-r1',
            canon: { id: 'catholic-73', orderedBooks: [1, 67, 40, 43] },
          },
        })
        .returning('id')
        .executeTakeFirstOrThrow()

      const presentation = { startTags: [], layout: [], notes: [], headings: [] }
      await database
        .insertInto('bible_verses')
        .values([
          {
            publication_id: publication.id,
            book: 43,
            chapter: 3,
            verse: 16,
            text: 'Car Dieu a tant aimé le monde',
            presentation,
          },
          {
            publication_id: publication.id,
            book: 43,
            chapter: 3,
            verse: 17,
            text: 'Dieu a aimé le monde',
            presentation,
          },
          {
            publication_id: publication.id,
            book: 1,
            chapter: 1,
            verse: 1,
            text: 'Ἀγάπη Λόγος',
            presentation,
          },
          {
            publication_id: publication.id,
            book: 1,
            chapter: 1,
            verse: 2,
            text: 'אֱלֹהִים בָּרָא',
            presentation,
          },
          {
            publication_id: publication.id,
            book: 43,
            chapter: 11,
            verse: 25,
            text: 'Je suis la résurrection et la vie',
            presentation,
          },
          {
            publication_id: publication.id,
            book: 67,
            chapter: 1,
            verse: 1,
            text: 'Dieu deutérocanonique',
            presentation,
          },
          {
            publication_id: publication.id,
            book: 40,
            chapter: 1,
            verse: 1,
            text: 'Dieu nouveau',
            presentation,
          },
          {
            publication_id: publication.id,
            book: 40,
            chapter: 1,
            verse: 2,
            text: 'Ils furent condamnés',
            presentation,
          },
        ])
        .execute()

      const repository = makeKyselyBibleSearchRepository(database)
      const search = (
        query: string,
        options: Partial<Omit<BibleSearchInput, 'versionId' | 'query'>> = {}
      ) => Effect.runPromise(repository.search({ versionId: 'LSG', query, limit: 20, ...options }))

      const phrase = await search('"Dieu a aimé"')
      assert.deepEqual(
        phrase.results.map(result => result.verse),
        [17]
      )

      const terms = await search('monde dieu')
      assert.equal(terms.count, 2)

      assert.equal((await search('αγαπη')).results[0]?.text, 'Ἀγάπη Λόγος')
      assert.equal((await search('אלהים')).results[0]?.text, 'אֱלֹהִים בָּרָא')

      const typo = await search('resurection')
      assert.equal(typo.count, 1)
      assert.equal(typo.results[0]?.verse, 25)
      assert.match(typo.results[0]?.highlighted ?? '', /\{\{résurrection\}\}/u)

      const typoWithShortTerm = await search('la resurection')
      assert.equal(typoWithShortTerm.count, 1)
      assert.equal(typoWithShortTerm.results[0]?.verse, 25)

      const inflection = await search('condamner')
      assert.equal(inflection.count, 1)
      assert.equal(inflection.results[0]?.text, 'Ils furent condamnés')
      assert.equal(inflection.results[0]?.highlighted, 'Ils furent {{condamnés}}')

      const canonicalOrder = await search('Dieu', { sortOrder: 'book' })
      assert.deepEqual(
        canonicalOrder.results.map(result => result.book),
        [67, 40, 43, 43]
      )

      const oldTestament = await search('Dieu', { section: 'ot' })
      assert.deepEqual(
        oldTestament.results.map(result => result.book),
        [67]
      )
      const newTestament = await search('Dieu', { section: 'nt', sortOrder: 'book' })
      assert.deepEqual(
        newTestament.results.map(result => result.book),
        [40, 43, 43]
      )
    } finally {
      await isolated.dispose()
    }
  })
})
