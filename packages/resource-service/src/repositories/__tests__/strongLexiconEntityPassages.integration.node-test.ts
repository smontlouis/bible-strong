import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { Effect, Exit } from 'effect'
import type { Kysely } from 'kysely'

import { createIsolatedPostgres } from '../../database/__tests__/isolatedPostgresTestSupport'
import type { ResourceDatabase } from '../../database/types'
import { makeKyselyStrongLexiconRepository } from '../strongLexiconRepository'

const runIntegration = process.env.RESOURCE_INTEGRATION === '1'
const connectionString =
  process.env.RESOURCE_DATABASE_URL ??
  'postgresql://bible_strong:bible_strong@127.0.0.1:54329/bible_strong'

type Database = Kysely<ResourceDatabase>

const insertPublication = async (database: Database, moduleId: 'core' | 'entities') =>
  (
    await database
      .insertInto('resource_publications')
      .values({
        resource_identity: `strong-lexicon:${moduleId}`,
        resource_kind: 'strong-lexicon',
        revision: `${moduleId}-r1`,
        language: 'mul',
        status: 'active',
        canonical_sha256: '1'.repeat(64),
        offline_artifact_sha256: '2'.repeat(64),
        provenance: { source: 'integration-test', imported_at: new Date(0).toISOString() },
        rights: { holder: 'integration-test', online: true, offline: true },
        metadata:
          moduleId === 'core'
            ? { resource_revision: 'core-r1' }
            : { dependencies: [{ revision: 'core-r1' }] },
      })
      .returning('id')
      .executeTakeFirstOrThrow()
  ).id

describe('Strong lexicon entity passages', { skip: !runIntegration }, () => {
  it('finds an entity and its passages, or an entity named nowhere, in one statement', async () => {
    const isolated = await createIsolatedPostgres(connectionString, 'strong_entity_passages', 1)
    const { database } = isolated
    try {
      await insertPublication(database, 'core')
      const publicationId = await insertPublication(database, 'entities')
      await database
        .insertInto('strong_lexicon_entities')
        .values(
          [
            { id: 1, uniqueName: 'Abraham@Gen.11.26-Heb', uStrong: 'H0085' },
            { id: 2, uniqueName: 'Nobody@Gen.1.1', uStrong: 'H9999' },
          ].map(payload => ({
            publication_id: publicationId,
            entity_id: payload.id,
            unique_name: payload.uniqueName,
            u_strong: payload.uStrong,
            payload,
          }))
        )
        .execute()
      await database
        .insertInto('strong_lexicon_entity_refs')
        .values(
          (
            [
              ['Heb', 11, 8, ''],
              ['Gen', 12, 1, ''],
              ['Gen', 11, 26, ''],
              ['Gen', 11, 27, ''],
              ['Gen', 11, 26, 'a'],
              // A chapter named as a whole.
              ['Gen', 17, 0, ''],
            ] as const
          ).map(([book, chapter, verse, suffix]) => ({
            publication_id: publicationId,
            entity_id: 1,
            book,
            chapter,
            verse,
            suffix,
            payload: {},
          }))
        )
        .execute()

      const repository = makeKyselyStrongLexiconRepository(database)
      const passages = async (uniqueName: string) =>
        Effect.runPromiseExit(repository.findEntityPassages({ uniqueName }))

      const abraham = await passages('Abraham@Gen.11.26-Heb')
      assert.ok(Exit.isSuccess(abraham))
      assert.deepEqual(abraham.value.value, [
        { book: 'Gen', chapter: 11, verses: [26, 27] },
        { book: 'Gen', chapter: 12, verses: [1] },
        { book: 'Gen', chapter: 17, verses: [] },
        { book: 'Heb', chapter: 11, verses: [8] },
      ])

      const nobody = await passages('Nobody@Gen.1.1')
      assert.ok(Exit.isSuccess(nobody))
      assert.deepEqual(nobody.value.value, [])

      assert.ok(Exit.isFailure(await passages('Unknown@Gen.1.1')))
    } finally {
      await isolated.dispose()
    }
  })
})
