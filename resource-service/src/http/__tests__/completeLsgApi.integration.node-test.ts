import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { Effect } from 'effect'

import { makeLocalDatabase } from '../../database/localDatabase'
import {
  isBiblePublicationBundleManifest,
  validatePublicationBundle,
} from '../../publication/publicationBundle'
import { makeKyselyBibleChapterRepository } from '../../repositories/bibleChapterRepository'
import { importPublicationBundle } from '../../repositories/publicationImporter'
import { makeResourceWebHandler } from '../app'
import {
  createHttpBibleChapterAdapter,
  createHybridBibleChapterAdapter,
  type BibleChapterAdapter,
} from '../../../../src/features/resources/bibleChapterSource'

const bundlePath = process.env.RESOURCE_LSG_BUNDLE
const connectionString =
  process.env.RESOURCE_DATABASE_URL ??
  'postgresql://bible_strong:bible_strong@127.0.0.1:54329/bible_strong'

describe('Complete LSG API', { skip: !bundlePath }, () => {
  it('serves every published chapter through the v1 contract', async () => {
    const database = makeLocalDatabase({ connectionString, maxConnections: 4 })
    const web = makeResourceWebHandler(makeKyselyBibleChapterRepository(database))

    try {
      const validated = await validatePublicationBundle(bundlePath!)
      assert.equal(validated.manifest.identity.kind, 'bible-text')
      assert.equal(validated.canonical.format, 'bible-strong-canonical-bible')
      if (
        !isBiblePublicationBundleManifest(validated.manifest) ||
        validated.canonical.format !== 'bible-strong-canonical-bible'
      ) {
        assert.fail('Expected the LSG Bible publication')
      }
      await Effect.runPromise(importPublicationBundle(bundlePath!, database))

      let chapterCount = 0
      let verseCount = 0
      for (const [book, chapters] of Object.entries(validated.canonical.verses)) {
        for (const [chapter, verses] of Object.entries(chapters)) {
          const response = await web.handler(
            new Request(`http://localhost/v1/bibles/LSG/books/${book}/chapters/${chapter}`)
          )
          assert.equal(response.status, 200, `${book}:${chapter}`)
          assert.equal(response.headers.get('x-resource-revision'), validated.manifest.revision)
          const body = (await response.json()) as {
            resource: { revision: string }
            verses: readonly { number: number; text: string; presentation: unknown }[]
          }
          assert.equal(body.resource.revision, validated.manifest.revision)
          assert.deepEqual(
            body.verses,
            Object.entries(verses).map(([number, verse]) => ({
              number: Number(number),
              text: verse.text,
              presentation: {
                startTags: verse.startTags,
                layout: verse.layout,
                notes: verse.notes,
                headings: verse.headings,
              },
            }))
          )
          chapterCount += 1
          verseCount += body.verses.length
        }
      }

      assert.equal(chapterCount, 1_189)
      assert.equal(verseCount, 31_171)

      const mobileHttp = createHttpBibleChapterAdapter({
        baseUrl: 'http://local-resource-service',
        fetcher: (input, init) => web.handler(new Request(input, init)),
        isOnline: async () => true,
      })
      const mobileChapter = await mobileHttp.loadChapter('LSG', 1, 1)
      assert.equal(mobileChapter.status, 'available')
      if (mobileChapter.status === 'available') {
        assert.equal(mobileChapter.verses.length, 31)
        assert.equal(
          mobileChapter.verses[0]?.Texte,
          validated.canonical.verses['1']?.['1']?.['1']?.text
        )
        assert.equal(mobileChapter.verses[0]?.TextRevision, validated.manifest.revision)
      }
      const mobileCoverage = await mobileHttp.loadCoverage('LSG')
      assert.equal(mobileCoverage.status, 'available')
      if (mobileCoverage.status === 'available') {
        assert.deepEqual(mobileCoverage.coverage.books, validated.manifest.canon.orderedBooks)
        assert.deepEqual(
          mobileCoverage.coverage.chaptersByBook,
          validated.manifest.coverage.chaptersByBook
        )
        assert.deepEqual(
          mobileCoverage.coverage.verseCountByBookChapter,
          validated.manifest.coverage.verseCountByBookChapter
        )
      }
    } finally {
      await web.dispose()
      await database.destroy()
    }
  })

  it('exercises the complete mobile source-selection journey against the real API', async () => {
    const database = makeLocalDatabase({ connectionString, maxConnections: 4 })
    const web = makeResourceWebHandler(makeKyselyBibleChapterRepository(database))
    let activePublicationId: number | undefined

    try {
      const validated = await validatePublicationBundle(bundlePath!)
      await Effect.runPromise(importPublicationBundle(bundlePath!, database))
      activePublicationId = (
        await database
          .selectFrom('resource_publications')
          .select('id')
          .where('resource_identity', '=', 'bible-text:LSG')
          .where('status', '=', 'active')
          .executeTakeFirstOrThrow()
      ).id

      let localState: 'installed' | 'missing' | 'corrupt' | 'not-found' = 'installed'
      let networkAvailable = false
      let remoteCalls = 0
      const localVerse = {
        Livre: 1,
        Chapitre: 1,
        Verset: 1,
        Texte: 'local installed copy',
        TextRevision: 'local-copy-r1',
      }
      const offline: BibleChapterAdapter = {
        loadChapter: async () => {
          if (localState === 'installed') return { status: 'available', verses: [localVerse] }
          if (localState === 'not-found') {
            return { status: 'unavailable', reason: 'chapter-not-available' }
          }
          if (localState === 'corrupt') {
            return { status: 'unavailable', reason: 'offline-copy-invalid' }
          }
          return { status: 'unavailable', reason: 'publication-not-available' }
        },
        loadCoverage: async () =>
          localState === 'installed'
            ? {
                status: 'available',
                coverage: {
                  books: [1],
                  chaptersByBook: { 1: [1] },
                  verseCountByBookChapter: { '1-1': 1 },
                },
              }
            : { status: 'unavailable', reason: 'publication-not-available' },
      }
      const online = createHttpBibleChapterAdapter({
        baseUrl: 'http://local-resource-service',
        fetcher: async (input, init) => {
          remoteCalls += 1
          if (!networkAvailable) throw new TypeError('Network request failed')
          return web.handler(new Request(input, init))
        },
        isOnline: async () => networkAvailable,
      })
      const hybrid = createHybridBibleChapterAdapter({ offline, online })

      // No-network reading keeps using the installed copy and never contacts HTTP.
      assert.deepEqual(await hybrid.loadChapter('LSG', 1, 1), {
        status: 'available',
        verses: [localVerse],
      })
      assert.equal(remoteCalls, 0)

      // Removing the Offline copy preserves logical access by resolving through the real API.
      localState = 'missing'
      networkAvailable = true
      const afterRemoval = await hybrid.loadChapter('LSG', 1, 1)
      assert.equal(afterRemoval.status, 'available')
      if (afterRemoval.status === 'available') {
        assert.equal(afterRemoval.verses[0]?.TextRevision, validated.manifest.revision)
      }

      // A recoverably corrupt local copy uses the same real HTTP fallback.
      localState = 'corrupt'
      const afterCorruption = await hybrid.loadChapter('LSG', 1, 1)
      assert.equal(afterCorruption.status, 'available')

      // A genuine local domain absence never source-hops.
      localState = 'not-found'
      const callsBeforeNotFound = remoteCalls
      assert.deepEqual(await hybrid.loadChapter('LSG', 1, 200), {
        status: 'unavailable',
        reason: 'chapter-not-available',
      })
      assert.equal(remoteCalls, callsBeforeNotFound)

      // A genuine remote absence remains distinct from transport and publication failures.
      localState = 'missing'
      assert.deepEqual(await hybrid.loadChapter('LSG', 1, 200), {
        status: 'unavailable',
        reason: 'chapter-not-available',
      })

      networkAvailable = false
      assert.deepEqual(await hybrid.loadChapter('LSG', 1, 1), {
        status: 'unavailable',
        reason: 'network-offline',
      })
      networkAvailable = true

      await database
        .updateTable('resource_publications')
        .set({ status: 'staged', activated_at: null })
        .where('id', '=', activePublicationId)
        .execute()
      assert.deepEqual(await hybrid.loadChapter('LSG', 1, 1), {
        status: 'unavailable',
        reason: 'temporary-unavailable',
      })
    } finally {
      if (activePublicationId !== undefined) {
        await database
          .updateTable('resource_publications')
          .set({ status: 'active', activated_at: new Date() })
          .where('id', '=', activePublicationId)
          .where('status', '=', 'staged')
          .execute()
          .catch(() => undefined)
      }
      await web.dispose()
      await database.destroy()
    }
  })
})
