import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { Effect } from 'effect'

import {
  ActiveNavePublicationUnavailable,
  NaveRepositoryFailure,
  NaveTopicNotFound,
  type NaveRepositoryService,
} from '../../domain/nave'
import { makeResourceWebHandler } from '../app'

const amour = {
  normalizedName: 'amour',
  name: 'Amour',
  initial: 'a',
  description: '<p>Aimer Dieu.</p>',
} as const

const repository: NaveRepositoryService = {
  findTopic: input =>
    input.normalizedName === 'absent'
      ? Effect.fail(new NaveTopicNotFound(input))
      : Effect.succeed({ language: input.language, revision: 'nave-fr-r1', topic: amour }),
  listTopics: input =>
    Effect.succeed({ language: input.language, revision: 'nave-fr-r1', topics: [amour] }),
  findVerseTopics: input =>
    Effect.succeed({
      language: input.language,
      revision: 'nave-fr-r1',
      verseKey: input.verseKey,
      verseTopics: [amour],
      chapterTopics: [],
    }),
  findRandomTopic: language =>
    language === 'en'
      ? Effect.fail(new ActiveNavePublicationUnavailable({ language }))
      : Effect.succeed({ language, revision: 'nave-fr-r1', topic: amour }),
}

const request = (path: string) =>
  new Request(`http://localhost${path}`, {
    headers: { 'x-request-id': 'nave-request-123' },
  })

describe('v1 Nave API', () => {
  it('serves lookup, alphabetical browse/search, verse-linked topics, and random topic contracts', async () => {
    const web = makeResourceWebHandler(undefined, repository)
    try {
      const cases = [
        [
          '/v1/naves/fr/topics/amour',
          {
            resource: { kind: 'nave', language: 'fr', revision: 'nave-fr-r1' },
            topic: amour,
          },
        ],
        [
          '/v1/naves/fr/topics?initial=a',
          {
            resource: { kind: 'nave', language: 'fr', revision: 'nave-fr-r1' },
            topics: [{ normalizedName: 'amour', name: 'Amour', initial: 'a' }],
          },
        ],
        [
          '/v1/naves/fr/topics?search=amour',
          {
            resource: { kind: 'nave', language: 'fr', revision: 'nave-fr-r1' },
            topics: [{ normalizedName: 'amour', name: 'Amour', initial: 'a' }],
          },
        ],
        [
          '/v1/naves/fr/verses/43-3-16/topics',
          {
            resource: { kind: 'nave', language: 'fr', revision: 'nave-fr-r1' },
            verseKey: '43-3-16',
            verseTopics: [{ normalizedName: 'amour', name: 'Amour' }],
            chapterTopics: [],
          },
        ],
        [
          '/v1/naves/fr/random',
          {
            resource: { kind: 'nave', language: 'fr', revision: 'nave-fr-r1' },
            topic: amour,
          },
        ],
      ] as const

      for (const [path, expected] of cases) {
        const response = await web.handler(request(path))
        assert.equal(response.status, 200, path)
        assert.equal(response.headers.get('x-request-id'), 'nave-request-123')
        assert.equal(response.headers.get('x-resource-revision'), 'nave-fr-r1')
        assert.deepEqual(await response.json(), expected)
      }
    } finally {
      await web.dispose()
    }
  })

  it('maps not-found, inactive, invalid, and internal outcomes to stable problems', async () => {
    const failingRepository: NaveRepositoryService = {
      ...repository,
      listTopics: () => Effect.fail(new NaveRepositoryFailure({ cause: new Error('secret') })),
      findRandomTopic: language => Effect.fail(new ActiveNavePublicationUnavailable({ language })),
    }
    const web = makeResourceWebHandler(undefined, failingRepository)
    try {
      const cases = [
        ['/v1/naves/fr/topics/absent', 404, 'NAVE_TOPIC_NOT_FOUND'],
        ['/v1/naves/en/random', 503, 'NAVE_PUBLICATION_INACTIVE'],
        ['/v1/naves/fr/random', 503, 'NAVE_PUBLICATION_INACTIVE'],
        ['/v1/naves/french/random', 400, 'INVALID_RESOURCE_REQUEST'],
        ['/v1/naves/fr/verses/0-0-0/topics', 400, 'INVALID_RESOURCE_REQUEST'],
        ['/v1/naves/fr/topics?initial=a', 500, 'RESOURCE_INTERNAL_FAILURE'],
      ] as const

      for (const [path, status, code] of cases) {
        const response = await web.handler(request(path))
        assert.equal(response.status, status, `${path}: ${await response.clone().text()}`)
        const body = (await response.json()) as Record<string, unknown>
        assert.equal(body.code, code, path)
        assert.equal(body.requestId, 'nave-request-123', path)
        assert.equal(JSON.stringify(body).includes('secret'), false)
      }
    } finally {
      await web.dispose()
    }
  })

  it('correlates generated request IDs on errors and validates deterministic reads with ETags', async () => {
    const web = makeResourceWebHandler(undefined, repository)
    try {
      const missing = await web.handler(new Request('http://localhost/v1/naves/fr/topics/absent'))
      const missingBody = (await missing.json()) as { requestId: string }
      assert.equal(missing.headers.get('x-request-id'), missingBody.requestId)

      const first = await web.handler(request('/v1/naves/fr/topics/amour'))
      const etag = first.headers.get('etag')
      assert.ok(etag)
      const cached = await web.handler(
        new Request('http://localhost/v1/naves/fr/topics/amour', {
          headers: { 'if-none-match': etag },
        })
      )
      assert.equal(cached.status, 304)
      assert.equal(cached.headers.get('etag'), etag)
      assert.equal(cached.headers.get('x-resource-revision'), 'nave-fr-r1')

      const search = await web.handler(request('/v1/naves/fr/topics?search=amour'))
      const random = await web.handler(request('/v1/naves/fr/random'))
      assert.equal(search.headers.get('etag'), null)
      assert.equal(random.headers.get('etag'), null)
    } finally {
      await web.dispose()
    }
  })
})
