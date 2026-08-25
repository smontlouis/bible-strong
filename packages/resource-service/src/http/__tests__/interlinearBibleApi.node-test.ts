import assert from 'node:assert/strict'
import test from 'node:test'

import { Effect } from 'effect'

import {
  ActiveInterlinearBiblePublicationUnavailable,
  InterlinearBibleChapterNotFound,
  type InterlinearBibleRepositoryService,
} from '../../domain/interlinearBible'
import { makeResourceWebHandler } from '../app'

const resource = {
  versionId: 'BHG' as const,
  datasetId: 'STEP' as const,
  language: 'fr' as const,
  revision: 'bhg-interlinear-fr-v1',
  textRevision: 'bhg-text-v1',
  textSha256: '1'.repeat(64),
}

const repository: InterlinearBibleRepositoryService = {
  findActiveCoverage: input =>
    input.language === 'fr'
      ? Effect.succeed({
          ...resource,
          books: [1],
          chaptersByBook: { 1: [1] },
          verseCountByBookChapter: { '1-1': 1 },
        })
      : Effect.fail(
          new ActiveInterlinearBiblePublicationUnavailable({
            versionId: input.versionId,
            language: input.language,
          })
        ),
  findActiveChapter: input =>
    input.language === 'fr' && input.book === 1 && input.chapter === 1
      ? Effect.succeed({
          ...resource,
          book: 1,
          chapter: 1,
          verses: [
            {
              number: 1,
              tokens: [
                {
                  id: 7,
                  ordinal: 0,
                  startOffset: 0,
                  length: 8,
                  segments: [
                    {
                      ordinal: 0,
                      startOffset: 0,
                      length: 8,
                      transliteration: 'bereshit',
                      lemma: 'רֵאשִׁית',
                      morphology: 'HNcfsa',
                      gloss: 'commencement',
                      identities: [{ kind: 'strong' as const, code: 'H07225' }],
                    },
                  ],
                },
              ],
            },
          ],
        })
      : Effect.fail(new InterlinearBibleChapterNotFound(input)),
}

test('serves the typed localized interlinear coverage and chapter contract', async () => {
  const { handler } = makeResourceWebHandler(undefined, undefined, {
    interlinearBible: repository,
  })

  const coverage = await handler(
    new Request('http://resource.local/v1/interlinear-bibles/BHG/languages/fr/coverage')
  )
  assert.equal(coverage.status, 200)
  assert.deepEqual(await coverage.json(), {
    resource: {
      kind: 'interlinear-index',
      ...resource,
    },
    books: [1],
    chaptersByBook: { 1: [1] },
    verseCountByBookChapter: { '1-1': 1 },
  })

  const chapter = await handler(
    new Request('http://resource.local/v1/interlinear-bibles/BHG/languages/fr/books/1/chapters/1')
  )
  assert.equal(chapter.status, 200)
  assert.deepEqual(await chapter.json(), {
    resource: { kind: 'interlinear-index', ...resource },
    book: 1,
    chapter: 1,
    verses: [
      {
        number: 1,
        tokens: [
          {
            id: 7,
            ordinal: 0,
            startOffset: 0,
            length: 8,
            segments: [
              {
                ordinal: 0,
                startOffset: 0,
                length: 8,
                transliteration: 'bereshit',
                lemma: 'רֵאשִׁית',
                morphology: 'HNcfsa',
                gloss: 'commencement',
                identities: [{ kind: 'strong', code: 'H07225' }],
              },
            ],
          },
        ],
      },
    ],
  })
  assert.equal(chapter.headers.get('x-resource-revision'), resource.revision)
})

test('maps inactive and missing interlinear content to actionable problems', async () => {
  const { handler } = makeResourceWebHandler(undefined, undefined, {
    interlinearBible: repository,
  })
  const inactive = await handler(
    new Request('http://resource.local/v1/interlinear-bibles/BHG/languages/en/coverage')
  )
  assert.equal(inactive.status, 503)
  assert.equal((await inactive.json()).code, 'INTERLINEAR_PUBLICATION_INACTIVE')

  const missing = await handler(
    new Request('http://resource.local/v1/interlinear-bibles/BHG/languages/fr/books/1/chapters/2')
  )
  assert.equal(missing.status, 404)
  assert.equal((await missing.json()).code, 'INTERLINEAR_CHAPTER_NOT_FOUND')
})
