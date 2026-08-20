import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { Effect } from 'effect'

import { createIsolatedPostgres } from '../../database/__tests__/isolatedPostgresTestSupport'
import { makeKyselyBibleSearchRepository } from '../bibleSearchRepository'
import { makeKyselyBibleChapterRepository } from '../bibleChapterRepository'

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
})
