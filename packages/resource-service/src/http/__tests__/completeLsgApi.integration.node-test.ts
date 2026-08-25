import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { Effect } from 'effect'

import { createIsolatedPostgres } from '../../database/__tests__/isolatedPostgresTestSupport'
import {
  isBiblePublicationBundleManifest,
  validatePublicationBundle,
} from '../../publication/publicationBundle'
import { makeKyselyBibleChapterRepository } from '../../repositories/bibleChapterRepository'
import { importPublicationBundle } from '../../repositories/publicationImporter'
import { makeResourceWebHandler } from '../app'

const bundlePath = process.env.RESOURCE_LSG_BUNDLE
const connectionString =
  process.env.RESOURCE_DATABASE_URL ??
  'postgresql://bible_strong:bible_strong@127.0.0.1:54329/bible_strong'

describe('Complete LSG API', { skip: !bundlePath }, () => {
  it('serves every published chapter through the v1 contract', async () => {
    const isolated = await createIsolatedPostgres(connectionString, 'lsg_api_chapters')
    const { database } = isolated
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
    } finally {
      await web.dispose()
      await isolated.dispose()
    }
  })
})
