import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { Effect } from 'effect'

import { makeResourceWebHandler, type ResourceRepositoryOverrides } from '../app'

const resource = {
  versionId: 'LSG',
  datasetId: 'LSG',
  revision: 'strong-publication-v1',
  textRevision: 'lsg-text-v1',
  textSha256: '1'.repeat(64),
  strongRevision: 'strong-content-v1',
}

const span = {
  ordinal: 0,
  startOffset: 0,
  length: 4,
  stepTokenIds: [7],
  identities: [{ kind: 'strong' as const, code: 'H0430' }],
}

const repositories: ResourceRepositoryOverrides = {
  strongBible: {
    findActiveCoverage: () =>
      Effect.succeed({
        ...resource,
        books: [1],
        chaptersByBook: { 1: [1] },
        verseCountByBookChapter: { '1-1': 1 },
      }),
    findActiveChapter: () =>
      Effect.succeed({
        ...resource,
        book: 1,
        chapter: 1,
        verses: [{ number: 1, spans: [span] }],
      }),
    findCountsByBook: () =>
      Effect.succeed({
        ...resource,
        identity: { id: 1, kind: 'strong' as const, code: 'H0430' },
        counts: [{ book: 1, verseCount: 1 }],
      }),
    findOccurrences: input => {
      assert.equal(input.cursor, 'strong:v1:1:1:0')
      return Effect.succeed({
        ...resource,
        identity: { id: 1, kind: 'strong' as const, code: 'H0430' },
        verses: [{ book: 1, chapter: 1, verse: 1, spans: [span] }],
        nextCursor: 'strong:v1:1:1:1',
      })
    },
    findLemmaStats: () =>
      Effect.succeed({
        ...resource,
        identity: { id: 1, kind: 'strong' as const, code: 'H0430' },
        lemmas: [{ id: 1, lemma: 'Dieu', partOfSpeech: 'N', occurrenceCount: 1 }],
      }),
  },
}

describe('Strong Bible API', () => {
  it('serves a typed Strong chapter without duplicating Bible text', async () => {
    const web = makeResourceWebHandler(undefined, undefined, repositories)
    try {
      const response = await web.handler(
        new Request('http://localhost/v1/strong-bibles/LSG/books/1/chapters/1')
      )

      assert.equal(response.status, 200)
      assert.deepEqual(await response.json(), {
        resource: {
          kind: 'strong-bible-index',
          ...resource,
        },
        book: 1,
        chapter: 1,
        verses: [{ number: 1, spans: [span] }],
      })
    } finally {
      await web.dispose()
    }
  })

  it('serves paginated concordance occurrences with their aligned spans', async () => {
    const web = makeResourceWebHandler(undefined, undefined, repositories)
    try {
      const response = await web.handler(
        new Request(
          'http://localhost/v1/strong-bibles/LSG/books/1/identities/H0430/occurrences?limit=1&cursor=strong%3Av1%3A1%3A1%3A0&allBooks=true'
        )
      )

      assert.equal(response.status, 200)
      assert.deepEqual(await response.json(), {
        resource: {
          kind: 'strong-bible-index',
          ...resource,
        },
        identity: { id: 1, kind: 'strong', code: 'H0430' },
        verses: [{ book: 1, chapter: 1, verse: 1, spans: [span] }],
        nextCursor: 'strong:v1:1:1:1',
      })
    } finally {
      await web.dispose()
    }
  })
})
