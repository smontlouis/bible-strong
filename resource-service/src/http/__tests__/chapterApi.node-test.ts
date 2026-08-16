import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { Effect } from 'effect'

import {
  ActiveBiblePublicationUnavailable,
  BibleChapterNotFound,
  BibleChapterRepositoryFailure,
  type BibleChapterRepositoryService,
} from '../../domain/bibleChapter'
import { makeResourceWebHandler } from '../app'

const chapter = {
  versionId: 'LSG',
  revision: 'lsg-test-revision',
  book: 1,
  chapter: 1,
  verses: [
    {
      number: 1,
      text: 'Au commencement',
      presentation: { startTags: [], layout: [], notes: [], headings: [] },
    },
    {
      number: 2,
      text: 'La terre était informe',
      presentation: { startTags: [], layout: [], notes: [], headings: [] },
    },
  ],
} as const

const repository: BibleChapterRepositoryService = {
  findActiveChapter: input => {
    if (input.chapter === 2) {
      return Effect.fail(new BibleChapterNotFound(input))
    }
    if (input.chapter === 3) {
      return Effect.fail(new ActiveBiblePublicationUnavailable({ versionId: input.versionId }))
    }
    if (input.chapter === 4) {
      return Effect.fail(new BibleChapterRepositoryFailure({ cause: new Error('password=secret') }))
    }
    return Effect.succeed(chapter)
  },
  findActiveCoverage: versionId =>
    Effect.succeed({
      versionId,
      revision: chapter.revision,
      books: [1],
      chaptersByBook: { 1: [1, 2, 3, 4] },
      verseCountByBookChapter: { '1-1': 2 },
    }),
}

const request = (path: string, headers?: HeadersInit) =>
  new Request(`http://localhost${path}`, {
    headers: { 'x-request-id': 'request-test-123', ...headers },
  })

describe('v1 Bible chapter API', () => {
  it('returns the canonical DTO in verse order with the active revision and ETag', async () => {
    const web = makeResourceWebHandler(repository)
    try {
      const response = await web.handler(request('/v1/bibles/LSG/books/1/chapters/1'))

      assert.equal(response.status, 200)
      assert.equal(response.headers.get('x-resource-revision'), 'lsg-test-revision')
      assert.equal(response.headers.get('x-request-id'), 'request-test-123')
      assert.match(response.headers.get('etag') ?? '', /^"[a-f0-9]{64}"$/)
      assert.deepEqual(await response.json(), {
        resource: { kind: 'bible-text', versionId: 'LSG', revision: 'lsg-test-revision' },
        book: 1,
        chapter: 1,
        verses: chapter.verses,
      })
    } finally {
      await web.dispose()
    }
  })

  it('returns 304 when If-None-Match accepts the current representation ETag', async () => {
    const web = makeResourceWebHandler(repository)
    try {
      const first = await web.handler(request('/v1/bibles/LSG/books/1/chapters/1'))
      const etag = first.headers.get('etag')!
      const conditional = await web.handler(
        request('/v1/bibles/LSG/books/1/chapters/1', { 'if-none-match': `"other", W/${etag}` })
      )

      assert.equal(conditional.status, 304)
      assert.equal(conditional.headers.get('etag'), etag)
      assert.equal(await conditional.text(), '')
    } finally {
      await web.dispose()
    }
  })

  it('returns the active publication coverage for zero-copy navigation', async () => {
    const web = makeResourceWebHandler(repository)
    try {
      const response = await web.handler(request('/v1/bibles/LSG/coverage'))
      assert.equal(response.status, 200)
      assert.deepEqual(await response.json(), {
        resource: { kind: 'bible-text', versionId: 'LSG', revision: chapter.revision },
        books: [1],
        chaptersByBook: { 1: [1, 2, 3, 4] },
        verseCountByBookChapter: { '1-1': 2 },
      })
    } finally {
      await web.dispose()
    }
  })

  it('maps unsupported, invalid, absent, inactive, and internal outcomes to safe problems', async () => {
    const web = makeResourceWebHandler(repository)
    try {
      const cases = [
        ['/v1/bibles/KJV/books/1/chapters/1', 404, 'BIBLE_UNSUPPORTED'],
        ['/v1/bibles/LSG/books/0/chapters/1', 400, 'INVALID_RESOURCE_REQUEST'],
        ['/v1/bibles/LSG/books/1/chapters/2', 404, 'BIBLE_CHAPTER_NOT_FOUND'],
        ['/v1/bibles/LSG/books/1/chapters/3', 503, 'BIBLE_PUBLICATION_INACTIVE'],
        ['/v1/bibles/LSG/books/1/chapters/4', 500, 'RESOURCE_INTERNAL_FAILURE'],
      ] as const

      for (const [path, status, code] of cases) {
        const response = await web.handler(request(path))
        const body = (await response.json()) as Record<string, unknown>
        assert.equal(response.status, status)
        assert.equal(body.code, code)
        assert.equal(body.requestId, 'request-test-123')
        if (status === 503) assert.equal(body.retryAfterSeconds, 30)
        if (status === 503) assert.equal(response.headers.get('retry-after'), '30')
        assert.equal(JSON.stringify(body).includes('password=secret'), false)
      }
    } finally {
      await web.dispose()
    }
  })
})
