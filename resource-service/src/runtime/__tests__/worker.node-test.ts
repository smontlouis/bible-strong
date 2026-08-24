import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { makeHyperdriveDatabase } from '../../database/hyperdriveDatabase'
import { makeKyselyBibleChapterRepository } from '../../repositories/bibleChapterRepository'
import {
  enforceResourceApiAppCheck,
  makeResourceWorkerHandler,
  routeResourceApiRequest,
} from '../worker'
import { resourceApiCacheEpochFrom, resourceApiCacheRevisionFrom } from '../resourceApiCache'

class MemoryEdgeCache {
  readonly entries = new Map<string, Response>()

  async match(request: Request): Promise<Response | undefined> {
    return this.entries.get(request.url)?.clone()
  }

  async put(request: Request, response: Response): Promise<void> {
    this.entries.set(request.url, response.clone())
  }
}

describe('Resource Worker binding', () => {
  it('reuses one authenticated deterministic response without sharing App Check tokens', async () => {
    const cache = new MemoryEdgeCache()
    const backgroundWrites: Promise<unknown>[] = []
    let originReads = 0
    const request = (token: string, requestId: string) =>
      new Request('https://api.bible-strong.app/v1/bibles/LSG/books/1/chapters/1', {
        headers: { 'x-firebase-appcheck': token, 'x-request-id': requestId },
      })
    const route = (token: string, requestId: string) =>
      routeResourceApiRequest({
        request: request(token, requestId),
        authorize: async () => true,
        cache,
        cacheEpoch: 'catalog-release-1',
        waitUntil: promise => backgroundWrites.push(promise),
        load: async () => {
          originReads += 1
          return Response.json(
            { resource: { revision: 'lsg-r1' }, verses: [{ verse: 1, text: 'Au commencement' }] },
            { headers: { etag: '"chapter-r1"', 'x-request-id': requestId } }
          )
        },
      })

    const first = await route('debug-token-a', 'request-a')
    await Promise.all(backgroundWrites)
    const second = await route('debug-token-b', 'request-b')

    assert.equal(originReads, 1)
    assert.equal(first.headers.get('x-resource-cache'), 'MISS')
    assert.equal(second.headers.get('x-resource-cache'), 'HIT')
    assert.equal(second.headers.get('cache-control'), 'private, no-store')
    assert.equal(second.headers.get('x-request-id'), 'request-b')
    assert.equal(await second.json().then(body => body.resource.revision), 'lsg-r1')
    assert.equal(
      [...cache.entries.keys()].some(key => key.includes('debug-token')),
      false
    )
  })

  it('caches published lexicon entries at the same protected edge boundary', async () => {
    const cache = new MemoryEdgeCache()
    const backgroundWrites: Promise<unknown>[] = []
    let originReads = 0
    const route = () =>
      routeResourceApiRequest({
        request: new Request(
          'https://api.bible-strong.app/v1/strong-lexicon/entries/G3056?language=fr'
        ),
        authorize: async () => true,
        cache,
        cacheEpoch: 'catalog-release-1',
        waitUntil: promise => backgroundWrites.push(promise),
        load: async () => {
          originReads += 1
          return Response.json({ resource: { revision: 'strong-core-r1' }, reference: 'G3056' })
        },
      })

    await route()
    await Promise.all(backgroundWrites)
    const second = await route()

    assert.equal(originReads, 1)
    assert.equal(second.headers.get('x-resource-cache'), 'HIT')
  })

  it('preserves conditional GET semantics for cached representations', async () => {
    const cache = new MemoryEdgeCache()
    const backgroundWrites: Promise<unknown>[] = []
    const route = (ifNoneMatch?: string) =>
      routeResourceApiRequest({
        request: new Request('https://api.bible-strong.app/v1/bibles/LSG/books/1/chapters/1', {
          headers: ifNoneMatch ? { 'if-none-match': ifNoneMatch } : undefined,
        }),
        authorize: async () => true,
        cache,
        cacheEpoch: 'catalog-release-1',
        waitUntil: promise => backgroundWrites.push(promise),
        load: async () =>
          Response.json(
            { resource: { revision: 'lsg-r1' } },
            { headers: { etag: '"chapter-r1"' } }
          ),
      })

    await route()
    await Promise.all(backgroundWrites)
    const conditional = await route('W/"chapter-r1"')

    assert.equal(conditional.status, 304)
    assert.equal(conditional.headers.get('x-resource-cache'), 'HIT')
    assert.equal(await conditional.text(), '')
  })

  it('falls back to the database when the edge cache is unavailable', async () => {
    const failures: string[] = []
    let originReads = 0
    const response = await routeResourceApiRequest({
      request: new Request('https://api.bible-strong.app/v1/bibles/LSG/books/1/chapters/1'),
      authorize: async () => true,
      cache: {
        match: async () => {
          throw new Error('EDGE_CACHE_UNAVAILABLE')
        },
        put: async () => undefined,
      },
      cacheEpoch: 'catalog-release-1',
      waitUntil: () => undefined,
      reportCacheFailure: operation => failures.push(operation),
      load: async () => {
        originReads += 1
        return Response.json({ resource: { revision: 'lsg-r1' } })
      },
    })

    assert.equal(response.status, 200)
    assert.equal(originReads, 1)
    assert.deepEqual(failures, ['match'])
  })

  it('caches identical authenticated search requests for 24 hours without token-specific keys', async () => {
    const cache = new MemoryEdgeCache()
    const backgroundWrites: Promise<unknown>[] = []
    let originReads = 0
    const route = () =>
      routeResourceApiRequest({
        request: new Request('https://api.bible-strong.app/v1/bibles/LSG/search?q=grace'),
        authorize: async () => true,
        cache,
        cacheEpoch: 'catalog-release-1',
        waitUntil: promise => backgroundWrites.push(promise),
        load: async () => {
          originReads += 1
          return Response.json({ results: [] })
        },
      })

    const first = await route()
    await Promise.all(backgroundWrites)
    const second = await route()

    assert.equal(originReads, 1)
    assert.equal(cache.entries.size, 1)
    assert.equal(
      [...cache.entries.values()][0]?.headers.get('cache-control'),
      'public, max-age=86400'
    )
    assert.equal(first.headers.get('x-resource-cache'), 'MISS')
    assert.equal(second.headers.get('x-resource-cache'), 'HIT')
    assert.equal(first.headers.get('cache-control'), 'private, no-store')
    assert.equal(second.headers.get('cache-control'), 'private, no-store')
  })

  it('does not cache random resource selection', async () => {
    const cache = new MemoryEdgeCache()
    let originReads = 0
    const route = () =>
      routeResourceApiRequest({
        request: new Request('https://api.bible-strong.app/v1/timelines/fr/events/random'),
        authorize: async () => true,
        cache,
        cacheEpoch: 'catalog-release-1',
        waitUntil: () => undefined,
        load: async () => {
          originReads += 1
          return Response.json({ id: originReads })
        },
      })

    await route()
    await route()

    assert.equal(originReads, 2)
    assert.equal(cache.entries.size, 0)
  })

  it('rejects unauthenticated requests before cache and database access', async () => {
    let cacheReads = 0
    let originReads = 0
    const response = await routeResourceApiRequest({
      request: new Request('https://api.bible-strong.app/v1/bibles/LSG/books/1/chapters/1', {
        headers: { 'x-request-id': 'unauthorized_request' },
      }),
      authorize: async () => false,
      cache: {
        match: async () => {
          cacheReads += 1
          return undefined
        },
        put: async () => undefined,
      },
      cacheEpoch: 'catalog-release-1',
      waitUntil: () => undefined,
      load: async () => {
        originReads += 1
        return Response.json({})
      },
    })

    assert.equal(response.status, 401)
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
    assert.equal(response.headers.get('x-request-id'), 'unauthorized_request')
    assert.equal(cacheReads, 0)
    assert.equal(originReads, 0)
  })

  it('invalidates deterministic responses when the publication catalog changes', async () => {
    const cache = new MemoryEdgeCache()
    const backgroundWrites: Promise<unknown>[] = []
    let originReads = 0
    const route = (cacheEpoch: string) =>
      routeResourceApiRequest({
        request: new Request('https://api.bible-strong.app/v1/bibles/LSG/books/1/chapters/1'),
        authorize: async () => true,
        cache,
        cacheEpoch,
        waitUntil: promise => backgroundWrites.push(promise),
        load: async () => {
          originReads += 1
          return Response.json({ resource: { revision: `lsg-r${originReads}` } })
        },
      })

    await route('catalog-release-1')
    await Promise.all(backgroundWrites.splice(0))
    const nextRelease = await route('catalog-release-2')

    assert.equal(originReads, 2)
    assert.equal(nextRelease.headers.get('x-resource-cache'), 'MISS')
    assert.equal(cache.entries.size, 2)
  })

  it('derives the cache epoch from catalog content rather than its publication date alone', async () => {
    const first = await resourceApiCacheEpochFrom({
      generatedAt: '2026-08-20T00:00:00.000Z',
      resources: { 'bible:LSG': { archiveSha256: 'first' } },
    })
    const changedContent = await resourceApiCacheEpochFrom({
      generatedAt: '2026-08-20T00:00:00.000Z',
      resources: { 'bible:LSG': { archiveSha256: 'second' } },
    })

    assert.match(first, /^[a-f0-9]{64}$/)
    assert.notEqual(first, changedContent)
  })

  it('invalidates a Bible cache key only when that Bible publication changes', async () => {
    const request = new Request('https://api.bible-strong.app/v1/bibles/LSG/books/1/chapters/1')
    const catalog = (lsg: string, dby: string) => ({
      resources: {
        'bible:LSG': { contentSha256: lsg },
        'bible:DBY': { contentSha256: dby },
      },
    })

    const first = await resourceApiCacheRevisionFrom(request, catalog('lsg-r1', 'dby-r1'))
    const unrelatedChange = await resourceApiCacheRevisionFrom(request, catalog('lsg-r1', 'dby-r2'))
    const relevantChange = await resourceApiCacheRevisionFrom(request, catalog('lsg-r2', 'dby-r2'))

    assert.equal(first, unrelatedChange)
    assert.notEqual(first, relevantChange)
  })

  it('invalidates search only when its Bible publication or search revision changes', async () => {
    const searchRequest = new Request('https://api.bible-strong.app/v1/bibles/LSG/search?q=amour')
    const chapterRequest = new Request(
      'https://api.bible-strong.app/v1/bibles/LSG/books/1/chapters/1'
    )
    const catalog = {
      resources: {
        'bible:LSG': { contentSha256: 'lsg-r1' },
      },
    }

    const firstSearch = await resourceApiCacheRevisionFrom(searchRequest, catalog, 'search-r1')
    const changedSearch = await resourceApiCacheRevisionFrom(searchRequest, catalog, 'search-r2')
    const firstChapter = await resourceApiCacheRevisionFrom(chapterRequest, catalog, 'search-r1')
    const unchangedChapter = await resourceApiCacheRevisionFrom(
      chapterRequest,
      catalog,
      'search-r2'
    )

    assert.notEqual(firstSearch, changedSearch)
    assert.equal(firstChapter, unchangedChapter)
  })

  it('does not cache unsuccessful origin responses', async () => {
    const cache = new MemoryEdgeCache()
    let originReads = 0
    const route = () =>
      routeResourceApiRequest({
        request: new Request('https://api.bible-strong.app/v1/bibles/UNKNOWN/books/1/chapters/1'),
        authorize: async () => true,
        cache,
        cacheEpoch: 'catalog-release-1',
        waitUntil: () => undefined,
        load: async () => {
          originReads += 1
          return Response.json({ code: 'BIBLE_UNSUPPORTED' }, { status: 404 })
        },
      })

    const first = await route()
    const second = await route()

    assert.equal(originReads, 2)
    assert.equal(cache.entries.size, 0)
    assert.equal(first.headers.get('cache-control'), 'private, no-store')
    assert.equal(second.headers.get('cache-control'), 'private, no-store')
  })

  it('constructs the HTTP application with the shared Hyperdrive database without connecting', async () => {
    const database = makeHyperdriveDatabase('postgresql://user:password@example.neon.tech/database')
    const web = makeResourceWorkerHandler(makeKyselyBibleChapterRepository(database))

    assert.equal(typeof web.handler, 'function')
    await database.destroy()
  })

  it('requires App Check for every v1 database route before Hyperdrive access', async () => {
    const authorize = async () => false

    const bible = await enforceResourceApiAppCheck(
      new Request('https://api.bible-strong.app/v1/bibles/LSG/books/1/chapters/1'),
      authorize
    )
    const lexicon = await enforceResourceApiAppCheck(
      new Request('https://api.bible-strong.app/v1/strong/lexicon/G0001'),
      authorize
    )

    assert.equal(bible?.status, 401)
    assert.equal(lexicon?.status, 401)
  })

  it('does not require App Check for non-v1 operational routes', async () => {
    let authorizationCalls = 0
    const response = await enforceResourceApiAppCheck(
      new Request('https://api.bible-strong.app/health'),
      async () => {
        authorizationCalls += 1
        return false
      }
    )

    assert.equal(response, undefined)
    assert.equal(authorizationCalls, 0)
  })
})
