import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'

import { Effect } from 'effect'

import { createIsolatedPostgres } from '../../database/__tests__/isolatedPostgresTestSupport'
import { makeKyselyStrongBibleRepository } from '../../repositories/strongBibleRepository'
import { importPublicationBundle } from '../../repositories/publicationImporter'
import { writeStrongPublicationFixture } from './strongPublicationFixture'

const runIntegration = process.env.RESOURCE_INTEGRATION === '1'
const connectionString =
  process.env.RESOURCE_DATABASE_URL ??
  'postgresql://bible_strong:bible_strong@127.0.0.1:54329/bible_strong'

describe('Strong Bible publication import', { skip: !runIntegration }, () => {
  it('atomically imports, idempotently reimports, replaces, and queries the Strong domain', async () => {
    const bundle = await mkdtemp(path.join(tmpdir(), 'strong-publication-import-'))
    const isolated = await createIsolatedPostgres(connectionString, 'strong_publication')
    try {
      await writeStrongPublicationFixture(bundle)
      await isolated.database
        .insertInto('resource_publications')
        .values({
          resource_identity: 'bible-text:LSG',
          resource_kind: 'bible-text',
          revision: 'lsg-text-v1',
          language: 'fr',
          status: 'active',
          canonical_sha256: '4'.repeat(64),
          offline_artifact_sha256: '5'.repeat(64),
          provenance: { source: 'integration-test', imported_at: new Date(0).toISOString() },
          rights: { holder: 'integration-test', online: true, offline: true },
          metadata: { text_revision: 'lsg-text-v1', text_sha256: '1'.repeat(64) },
          activated_at: new Date(0),
        })
        .executeTakeFirstOrThrow()
      const first = await Effect.runPromise(importPublicationBundle(bundle, isolated.database))
      const second = await Effect.runPromise(importPublicationBundle(bundle, isolated.database))

      assert.equal(first.status, 'activated')
      assert.equal(second.status, 'unchanged')
      const repository = makeKyselyStrongBibleRepository(isolated.database)
      const coverage = await Effect.runPromise(repository.findActiveCoverage('LSG'))
      const chapter = await Effect.runPromise(
        repository.findActiveChapter({ versionId: 'LSG', book: 1, chapter: 1 })
      )
      const counts = await Effect.runPromise(
        repository.findCountsByBook({ versionId: 'LSG', book: 1, reference: 'H0430' })
      )
      const occurrences = await Effect.runPromise(
        repository.findOccurrences({
          versionId: 'LSG',
          book: 1,
          reference: 'H0430',
          limit: 1,
          allBooks: true,
        })
      )
      const lemmas = await Effect.runPromise(
        repository.findLemmaStats({ versionId: 'LSG', book: 1, reference: 'H0430' })
      )

      assert.deepEqual(coverage.books, [1])
      assert.deepEqual(chapter.verses[0]?.spans[0], {
        ordinal: 0,
        startOffset: 0,
        length: 4,
        stepTokenIds: [7, 8],
        identities: [{ kind: 'strong', code: 'H0430' }],
      })
      assert.deepEqual(counts.counts, [{ book: 1, verseCount: 1 }])
      assert.deepEqual(
        occurrences.verses.map(verse => [verse.book, verse.chapter, verse.verse]),
        [[1, 1, 1]]
      )
      assert.deepEqual(lemmas.lemmas, [
        { id: 1, lemma: 'Dieu', partOfSpeech: 'N', occurrenceCount: 1 },
      ])

      await isolated.database
        .updateTable('resource_publications')
        .set({
          metadata: {
            text_revision: 'different-bible-revision',
            text_sha256: '1'.repeat(64),
          },
        })
        .where('resource_identity', '=', 'bible-text:LSG')
        .executeTakeFirstOrThrow()
      const mismatchedDependency = await Effect.runPromise(
        Effect.either(repository.findActiveCoverage('LSG'))
      )
      assert.equal(mismatchedDependency._tag, 'Left')
      if (mismatchedDependency._tag === 'Left') {
        assert.equal(mismatchedDependency.left._tag, 'ActiveStrongBiblePublicationUnavailable')
      }

      await isolated.database
        .updateTable('resource_publications')
        .set({ metadata: { text_revision: 'lsg-text-v1', text_sha256: '0'.repeat(64) } })
        .where('resource_identity', '=', 'bible-text:LSG')
        .executeTakeFirstOrThrow()
      const mismatchedHash = await Effect.runPromise(
        Effect.either(repository.findActiveCoverage('LSG'))
      )
      assert.equal(mismatchedHash._tag, 'Left')

      await isolated.database
        .updateTable('resource_publications')
        .set({ metadata: { text_revision: 'lsg-text-v1', text_sha256: '1'.repeat(64) } })
        .where('resource_identity', '=', 'bible-text:LSG')
        .executeTakeFirstOrThrow()
      const replacementFixture = await writeStrongPublicationFixture(bundle, {
        strongRevision: '6'.repeat(64),
      })
      const replacement = await Effect.runPromise(
        importPublicationBundle(bundle, isolated.database)
      )
      const activePublications = await isolated.database
        .selectFrom('resource_publications')
        .select(['revision', 'status'])
        .where('resource_identity', '=', 'strong-bible-index:LSG')
        .execute()

      assert.equal(replacement.status, 'activated')
      assert.deepEqual(activePublications, [
        { revision: replacementFixture.manifest.revision, status: 'active' },
      ])
      const replacementCoverage = await Effect.runPromise(repository.findActiveCoverage('LSG'))
      assert.equal(replacementCoverage.strongRevision, '6'.repeat(64))
    } finally {
      await isolated.dispose()
      await rm(bundle, { recursive: true, force: true })
    }
  })
})
