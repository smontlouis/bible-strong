import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { Effect } from 'effect'
import type { Kysely } from 'kysely'

import { createIsolatedPostgres } from '../../database/__tests__/isolatedPostgresTestSupport'
import type { ResourceDatabase } from '../../database/types'
import { makeKyselyBibleChapterRepository } from '../bibleChapterRepository'

const runIntegration = process.env.RESOURCE_INTEGRATION === '1'
const connectionString =
  process.env.RESOURCE_DATABASE_URL ??
  'postgresql://bible_strong:bible_strong@127.0.0.1:54329/bible_strong'

type Database = Kysely<ResourceDatabase>

// Big enough to see on every row that brought it back.
const COVERAGE = { chaptersByBook: { '1': Array.from({ length: 50 }, (_, index) => index + 1) } }

const HEADING = {
  offset: 0,
  kind: 'section',
  text: 'Heading',
  order: 0,
  type: 'heading',
  markup: 'Heading',
}

const insertBible = async (
  database: Database,
  versionId: string,
  metadata: Record<string, unknown>
) => {
  const publication = await database
    .insertInto('resource_publications')
    .values({
      resource_identity: `bible-text:${versionId}`,
      resource_kind: 'bible-text',
      revision: `${versionId}-publication`,
      language: 'fr',
      status: 'active',
      canonical_sha256: '1'.repeat(64),
      offline_artifact_sha256: '2'.repeat(64),
      provenance: { source: 'integration-test', imported_at: new Date(0).toISOString() },
      rights: { holder: 'integration-test', online: true, offline: true },
      metadata: {
        canon: { id: 'protestant-66', orderedBooks: [1] },
        versification: 'bible-strong-default',
        coverage: COVERAGE,
        ...metadata,
      },
    })
    .returning('id')
    .executeTakeFirstOrThrow()
  await database
    .insertInto('bible_verses')
    .values(
      [1, 2, 3].map(verse => ({
        publication_id: publication.id,
        book: 1,
        chapter: 1,
        verse,
        text: `verse ${verse}`,
        presentation: {
          startTags: [],
          layout: [],
          notes: [],
          headings: verse === 1 ? [HEADING] : [],
        },
      }))
    )
    .execute()
}

describe('Bible reads and the publication metadata', { skip: !runIntegration }, () => {
  it('answer with the revisions of the metadata without reading its coverage', async () => {
    const isolated = await createIsolatedPostgres(connectionString, 'bible_chapter_metadata', 1)
    const { database } = isolated
    const rows: unknown[] = []
    const repository = makeKyselyBibleChapterRepository(
      database.withPlugin({
        transformQuery: args => args.node,
        async transformResult(args) {
          rows.push(...args.result.rows)
          return args.result
        },
      })
    )

    try {
      await insertBible(database, 'FULL', {
        resource_revision: 'FULL-resource',
        text_revision: 'FULL-text',
        text_sha256: 'a'.repeat(64),
      })
      await insertBible(database, 'BARE', {})

      const chapter = await Effect.runPromise(
        repository.findActiveChapter({ versionId: 'FULL', book: 1, chapter: 1 })
      )
      assert.equal(chapter.revision, 'FULL-resource')
      assert.equal(chapter.textRevision, 'FULL-text')
      assert.equal(chapter.textSha256, 'a'.repeat(64))
      assert.deepEqual(
        chapter.verses.map(verse => verse.text),
        ['verse 1', 'verse 2', 'verse 3']
      )

      const bare = await Effect.runPromise(
        repository.findActiveChapter({ versionId: 'BARE', book: 1, chapter: 1 })
      )
      assert.equal(bare.revision, 'BARE-publication')
      assert.equal(bare.textRevision, 'BARE-publication')
      assert.equal('textSha256' in bare, false)

      const [full, other] = await Effect.runPromise(
        repository.findActiveChapters!({ versionIds: ['FULL', 'BARE'], book: 1, chapter: 1 })
      )
      assert.equal(full!.textSha256, 'a'.repeat(64))
      assert.equal(full!.revision, 'FULL-resource')
      assert.equal(other!.revision, 'BARE-publication')
      assert.equal(other!.verses.length, 3)

      const texts = await Effect.runPromise(
        repository.findActiveVerseTexts({
          versionId: 'FULL',
          locations: [{ book: 1, chapter: 1, verse: 2 }],
        })
      )
      assert.equal(texts.textRevision, 'FULL-text')
      assert.equal(texts.textSha256, 'a'.repeat(64))

      const pericopes = await Effect.runPromise(repository.findActivePericopes('FULL'))
      assert.equal(pericopes.revision, 'FULL-resource')
      assert.equal(pericopes.verses.length, 1)

      const coverage = await Effect.runPromise(repository.findActiveCoverage('FULL'))
      assert.deepEqual(coverage.books, [1])
      assert.equal(coverage.versification, 'bible-strong-default')
      assert.equal(coverage.textSha256, 'a'.repeat(64))

      assert.ok(rows.length > 0)
      assert.equal(JSON.stringify(rows).includes('chaptersByBook'), false)
    } finally {
      await isolated.dispose()
    }
  })
})
