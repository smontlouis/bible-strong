import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'

import { Effect } from 'effect'

import { createIsolatedPostgres } from '../../database/__tests__/isolatedPostgresTestSupport'
import { makeKyselyInterlinearBibleRepository } from '../../repositories/interlinearBibleRepository'
import { importPublicationBundle } from '../../repositories/publicationImporter'
import { writeInterlinearPublicationFixture } from './interlinearPublicationFixture'

const runIntegration = process.env.RESOURCE_INTEGRATION === '1'
const connectionString =
  process.env.RESOURCE_DATABASE_URL ??
  'postgresql://bible_strong:bible_strong@127.0.0.1:54329/bible_strong'

describe('interlinear publication import', { skip: !runIntegration }, () => {
  it('imports both locales atomically and serves only indexes matching active BHG', async () => {
    const isolated = await createIsolatedPostgres(connectionString, 'interlinear_publication')
    const bundles: string[] = []
    try {
      await isolated.database
        .insertInto('resource_publications')
        .values({
          resource_identity: 'bible-text:BHG',
          resource_kind: 'bible-text',
          revision: 'bhg-text-v1',
          language: 'he-grc',
          status: 'active',
          canonical_sha256: '3'.repeat(64),
          offline_artifact_sha256: '4'.repeat(64),
          provenance: { source: 'integration-test', imported_at: new Date(0).toISOString() },
          rights: { holder: 'integration-test', online: true, offline: true },
          metadata: { text_revision: 'bhg-text-v1', text_sha256: '1'.repeat(64) },
          activated_at: new Date(0),
        })
        .executeTakeFirstOrThrow()

      for (const language of ['fr', 'en'] as const) {
        const bundle = await mkdtemp(path.join(tmpdir(), `interlinear-${language}-import-`))
        bundles.push(bundle)
        await writeInterlinearPublicationFixture(bundle, { language })
        const first = await Effect.runPromise(importPublicationBundle(bundle, isolated.database))
        const second = await Effect.runPromise(importPublicationBundle(bundle, isolated.database))
        assert.equal(first.status, 'activated')
        assert.equal(second.status, 'unchanged')
      }

      const repository = makeKyselyInterlinearBibleRepository(isolated.database)
      for (const language of ['fr', 'en'] as const) {
        const coverage = await Effect.runPromise(
          repository.findActiveCoverage({ versionId: 'BHG', language })
        )
        const chapter = await Effect.runPromise(
          repository.findActiveChapter({ versionId: 'BHG', language, book: 1, chapter: 1 })
        )
        assert.deepEqual(coverage.books, [1])
        assert.equal(chapter.verses[0]?.tokens[0]?.id, 7)
        assert.deepEqual(chapter.verses[0]?.tokens[0]?.segments[0]?.identities, [
          { kind: 'strong', code: 'H07225' },
        ])
      }

      await isolated.database
        .updateTable('resource_publications')
        .set({ metadata: { text_revision: 'stale', text_sha256: '1'.repeat(64) } })
        .where('resource_identity', '=', 'bible-text:BHG')
        .executeTakeFirstOrThrow()
      const mismatched = await Effect.runPromise(
        Effect.either(repository.findActiveCoverage({ versionId: 'BHG', language: 'fr' }))
      )
      assert.equal(mismatched._tag, 'Left')
      if (mismatched._tag === 'Left') {
        assert.equal(mismatched.left._tag, 'ActiveInterlinearBiblePublicationUnavailable')
      }
    } finally {
      await isolated.dispose()
      await Promise.all(bundles.map(bundle => rm(bundle, { recursive: true, force: true })))
    }
  })
})
