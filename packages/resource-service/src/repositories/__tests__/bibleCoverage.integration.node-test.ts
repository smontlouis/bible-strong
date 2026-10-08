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

const insertBible = async (
  database: Database,
  versionId: string,
  status: 'active' | 'staged',
  // The verses of each chapter of Genesis, as `[number, text]`.
  chapters: Record<number, readonly (readonly [number, string])[]>
) => {
  const publication = await database
    .insertInto('resource_publications')
    .values({
      resource_identity: `bible-text:${versionId}`,
      resource_kind: 'bible-text',
      revision: `${versionId}-${status}`,
      language: 'en',
      status,
      canonical_sha256: '1'.repeat(64),
      offline_artifact_sha256: '2'.repeat(64),
      provenance: { source: 'integration-test', imported_at: new Date(0).toISOString() },
      rights: { holder: 'integration-test', online: true, offline: true },
      metadata: {
        canon: { id: 'protestant-66', orderedBooks: [1, 2] },
        versification: 'bible-strong-default',
        resource_revision: `${versionId}-r1`,
      },
    })
    .returning('id')
    .executeTakeFirstOrThrow()
  const verses = Object.entries(chapters).flatMap(([chapter, numbered]) =>
    numbered.map(([verse, text]) => ({
      publication_id: publication.id,
      book: 1,
      chapter: Number(chapter),
      verse,
      text,
    }))
  )
  if (verses.length) await database.insertInto('bible_verses').values(verses).execute()
}

const numbered = (...numbers: number[]) =>
  numbers.map(number => [number, `verse ${number}`] as const)

describe('Bible coverage', { skip: !runIntegration }, () => {
  it('numbers the chapters that do not count from 1, in one statement', async () => {
    const isolated = await createIsolatedPostgres(connectionString, 'bible_coverage', 1)
    const { database } = isolated
    let statements = 0
    const repository = makeKyselyBibleChapterRepository(
      database.withPlugin({
        transformQuery(args) {
          statements += 1
          return args.node
        },
        async transformResult(args) {
          return args.result
        },
      })
    )
    const coverageOf = (versionId: string) =>
      Effect.runPromise(repository.findActiveCoverage(versionId))

    try {
      await insertBible(database, 'IRREGULAR', 'active', {
        // Numbered 1 to its count: the count describes it.
        1: numbered(1, 2, 3),
        // A verse the manuscripts of this Bible do not have.
        2: numbered(1, 2, 4, 5),
        // Verses 4 to 6 translated with verse 3.
        3: numbered(1, 2, 3, 7, 8),
        // The same verse kept as a row without text: empty, a line break, a closing bracket.
        4: [
          [1, 'first'],
          [2, ''],
          [3, 'third'],
        ],
        5: [
          [1, 'first'],
          [2, '\n '],
          [3, 'third'],
          [4, '] »\n'],
        ],
        // Punctuation around words is text.
        6: [
          [1, '[first]'],
          [2, '« second »'],
          [3, '(third)'],
        ],
        // A title numbered 0.
        7: [
          [0, 'title'],
          [1, 'first'],
          [2, 'second'],
        ],
        // Nothing to read.
        8: [
          [1, ''],
          [2, ' '],
        ],
        // A chapter that does not start at 1.
        9: numbered(2, 3),
        // Inserted out of order: numbers are published in ascending order.
        10: numbered(12, 3, 1, 2),
      })
      await insertBible(database, 'REGULAR', 'active', { 1: numbered(1, 2), 2: numbered(1) })
      // A staged publication of the same Bible is not read.
      await insertBible(database, 'REGULAR', 'staged', { 1: numbered(1, 5) })
      await insertBible(database, 'EMPTY', 'active', {})

      statements = 0
      const irregular = await coverageOf('IRREGULAR')
      assert.equal(statements, 1)
      const counts: Record<string, number> = irregular.verseCountByBookChapter
      assert.deepEqual(irregular.verseCountByBookChapter, {
        '1-1': 3,
        '1-2': 4,
        '1-3': 5,
        '1-4': 3,
        '1-5': 4,
        '1-6': 3,
        '1-7': 3,
        '1-8': 2,
        '1-9': 2,
        '1-10': 4,
      })
      assert.deepEqual(irregular.verseNumbersByBookChapter, {
        '1-2': [1, 2, 4, 5],
        '1-3': [1, 2, 3, 7, 8],
        '1-4': [1, 3],
        '1-5': [1, 3],
        '1-7': [0, 1, 2],
        '1-8': [],
        '1-9': [2, 3],
        '1-10': [1, 2, 3, 12],
      })
      assert.deepEqual(irregular.chaptersByBook, { 1: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] })
      assert.deepEqual(irregular.books, [1])
      assert.equal(irregular.revision, 'IRREGULAR-r1')
      // Every published list differs from 1 to the count of its chapter.
      for (const [key, numbers] of Object.entries(irregular.verseNumbersByBookChapter ?? {})) {
        assert.notDeepEqual(
          numbers,
          Array.from({ length: counts[key]! }, (_, index) => index + 1),
          key
        )
      }

      statements = 0
      const regular = await coverageOf('REGULAR')
      assert.equal(statements, 1)
      assert.deepEqual(regular.verseCountByBookChapter, { '1-1': 2, '1-2': 1 })
      assert.deepEqual(regular.verseNumbersByBookChapter, {})

      for (const versionId of ['EMPTY', 'MISSING']) {
        const unavailable = await Effect.runPromise(
          Effect.either(repository.findActiveCoverage(versionId))
        )
        assert.equal(unavailable._tag, 'Left')
        if (unavailable._tag === 'Left') {
          assert.equal(unavailable.left._tag, 'ActiveBiblePublicationUnavailable')
        }
      }
    } finally {
      await isolated.dispose()
    }
  })
})
