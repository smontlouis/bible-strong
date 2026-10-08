import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'

import { makeHyperdriveDatabase } from '../../database/hyperdriveDatabase'
import { STRONG_LEXICON_ENTRY_RESPONSE_REVISION } from '../../domain/strongLexicon'
import { makeResourceWebHandler } from '../../http/app'
import { makeKyselyBibleChapterRepository } from '../../repositories/bibleChapterRepository'
import {
  enforceResourceApiAppCheck,
  makeResourceHealthResponse,
  makeResourceWorker,
  routeResourceApiRequest,
} from '../worker'
import {
  RESOURCE_API_ANSWER_REVISION,
  resourceApiCacheEpochFor,
  resourceApiCacheEpochFrom,
  resourceApiCacheRevisionFrom,
  resourceApiCacheTtlSeconds,
  resourceApiFallbackEpochFor,
  resourceApiFallbackTakesPart,
  STRONG_LEXICON_ENTRY_CACHE_REVISION,
} from '../resourceApiCache'

class MemoryEdgeCache {
  readonly entries = new Map<string, Response>()
  /** The clock of the cache, in seconds: an entry is gone once its `max-age` has passed. */
  now = 0
  private readonly storedAt = new Map<string, number>()

  async match(request: Request): Promise<Response | undefined> {
    const entry = this.entries.get(request.url)
    const maxAge = entry?.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1]
    if (maxAge && this.now - (this.storedAt.get(request.url) ?? 0) >= Number(maxAge)) {
      this.entries.delete(request.url)
      return undefined
    }
    return entry?.clone()
  }

  async put(request: Request, response: Response): Promise<void> {
    this.entries.set(request.url, response.clone())
    this.storedAt.set(request.url, this.now)
  }
}

/** A read that ends when the test says so. */
const pendingResponse = () => {
  let resolve!: (response: Response) => void
  const promise = new Promise<Response>(onResolve => {
    resolve = onResolve
  })
  return { promise, resolve }
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

  it('adds the current browser origin to a response cached by a native request', async () => {
    const cache = new MemoryEdgeCache()
    const backgroundWrites: Promise<unknown>[] = []
    const route = (request: Request) =>
      routeResourceApiRequest({
        request,
        authorize: async () => true,
        cache,
        cacheEpoch: 'catalog-release-1',
        corsAllowedOrigins: ['http://localhost:9090'],
        waitUntil: promise => backgroundWrites.push(promise),
        load: async () => Response.json({ resource: { revision: 'lsg-r1' } }),
      })

    await route(new Request('https://api.bible-strong.app/v1/bibles/LSG/books/1/chapters/1'))
    await Promise.all(backgroundWrites)
    const browserResponse = await route(
      new Request('https://api.bible-strong.app/v1/bibles/LSG/books/1/chapters/1', {
        headers: { origin: 'http://localhost:9090' },
      })
    )

    assert.equal(browserResponse.headers.get('x-resource-cache'), 'HIT')
    assert.equal(
      browserResponse.headers.get('access-control-allow-origin'),
      'http://localhost:9090'
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

  it('fingerprints a whole catalog once for the routes that name no resource', async () => {
    let serializations = 0
    const catalogOf = (revision: string) => ({
      resources: { 'bible:LSG': { contentSha256: revision } },
      toJSON() {
        serializations += 1
        return { resources: { 'bible:LSG': { contentSha256: revision } } }
      },
    })
    const catalog = catalogOf('lsg-r1')
    const commentary = new Request(
      'https://api.bible-strong.app/v1/commentaries/MHY/fr/verses/1-1-1'
    )
    const crossReferences = new Request(
      'https://api.bible-strong.app/v1/cross-references/fr/verses/1-1-1'
    )

    const first = await resourceApiCacheRevisionFrom(commentary, catalog)
    const second = await resourceApiCacheRevisionFrom(commentary, catalog)
    const third = await resourceApiCacheRevisionFrom(crossReferences, catalog)

    assert.equal(first, await resourceApiCacheEpochFrom(catalogOf('lsg-r1')))
    assert.equal(second, first)
    assert.equal(third, first)
    // One for the catalog under test, one for the expected value just above.
    assert.equal(serializations, 2)
    // Another catalog is another fingerprint, never the remembered one.
    assert.notEqual(await resourceApiCacheRevisionFrom(commentary, catalogOf('lsg-r2')), first)
  })

  it('keeps the Strong entry cache revision equal to the one the repository answers with', () => {
    // The cache module repeats the value so that it does not load Effect with the Worker.
    assert.equal(STRONG_LEXICON_ENTRY_CACHE_REVISION, STRONG_LEXICON_ENTRY_RESPONSE_REVISION)
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

  it('uses a dedicated response revision for Strong lexicon batches', async () => {
    const catalog = {
      resources: {
        'strong-lexicon:core': { contentSha256: 'core-r1' },
        'strong-lexicon:resources': { contentSha256: 'resources-r1' },
        'strong-lexicon:entities': { contentSha256: 'entities-r1' },
      },
    }
    const batch = await resourceApiCacheRevisionFrom(
      new Request(
        'https://api.bible-strong.app/v1/strong-lexicon/entries/batch?language=fr&identities=strong%3AH2332'
      ),
      catalog
    )
    const entry = await resourceApiCacheRevisionFrom(
      new Request('https://api.bible-strong.app/v1/strong-lexicon/entries/H2332?language=fr'),
      catalog
    )
    const module = await resourceApiCacheRevisionFrom(
      new Request('https://api.bible-strong.app/v1/strong-lexicon/modules/core'),
      catalog
    )

    assert.notEqual(batch, entry)
    assert.notEqual(entry, module)
  })

  it('keeps the list of every Strong lexicon entry apart from the gathered list', async () => {
    const catalog = {
      resources: {
        'strong-lexicon:core': { contentSha256: 'core-r1' },
        'strong-lexicon:resources': { contentSha256: 'resources-r1' },
        'strong-lexicon:entities': { contentSha256: 'entities-r1' },
      },
    }
    const revisionOf = (query: string) =>
      resourceApiCacheRevisionFrom(
        new Request(`https://api.bible-strong.app/v1/strong-lexicon/entries?language=fr${query}`),
        catalog
      )
    const gathered = await revisionOf('&prefix=d')

    assert.equal(await revisionOf('&prefix=d&identities=unified'), gathered)
    assert.notEqual(await revisionOf('&prefix=d&identities=all'), gathered)
  })

  it('invalidates a simple lexicon only when its own language publication changes', async () => {
    const catalog = (fr: string, en: string, core: string) => ({
      resources: {
        'strong-lexicon:simple-fr': { contentSha256: fr },
        'strong-lexicon:simple-en': { contentSha256: en },
        'strong-lexicon:core': { contentSha256: core },
      },
    })
    for (const path of [
      'entries/G0026?language=fr&level=simple',
      'entries/batch?language=fr&level=simple&identities=strong%3AG0026',
      'random?language=fr&lexicalLanguage=greek&level=simple',
      'modules/simple-fr',
    ]) {
      const request = new Request(`https://api.bible-strong.app/v1/strong-lexicon/${path}`)
      const initial = await resourceApiCacheRevisionFrom(request, catalog('fr-1', 'en-1', 'core-1'))
      assert.equal(
        initial,
        await resourceApiCacheRevisionFrom(request, catalog('fr-1', 'en-2', 'core-2'))
      )
      assert.notEqual(
        initial,
        await resourceApiCacheRevisionFrom(request, catalog('fr-2', 'en-1', 'core-1'))
      )
    }
  })

  it('invalidates the senses of a number with the three lexicons they are read from', async () => {
    const catalog = (revisions: Partial<Record<string, string>> = {}) => ({
      resources: Object.fromEntries(
        ['simple-fr', 'simple-en', 'core', 'resources', 'entities'].map(moduleId => [
          `strong-lexicon:${moduleId}`,
          { contentSha256: revisions[moduleId] ?? `${moduleId}-r1` },
        ])
      ),
    })
    const revisionOf = (language: string, revisions?: Partial<Record<string, string>>) =>
      resourceApiCacheRevisionFrom(
        new Request(
          `https://api.bible-strong.app/v1/strong-lexicon/numbers/H2148/senses?language=${language}`
        ),
        catalog(revisions)
      )
    const french = await revisionOf('fr')

    // The simple lexicon lists the senses; the detailed one and its entities tell them apart.
    for (const moduleId of ['simple-fr', 'core', 'entities']) {
      assert.notEqual(await revisionOf('fr', { [moduleId]: 'r2' }), french, moduleId)
    }
    // The other language and the dictionary articles are not read.
    for (const moduleId of ['simple-en', 'resources']) {
      assert.equal(await revisionOf('fr', { [moduleId]: 'r2' }), french, moduleId)
    }
    assert.notEqual(await revisionOf('en'), french)
    assert.notEqual(await revisionOf('en', { 'simple-en': 'r2' }), await revisionOf('en'))
  })

  it('invalidates the counts of several references only with their Strong Bible index', async () => {
    const catalog = (lsg: string, kjv: string, lexicon: string) => ({
      resources: {
        'bible-strong:LSG': { archiveSha256: lsg },
        'bible-strong:KJV': { archiveSha256: kjv },
        'strong-lexicon:core': { contentSha256: lexicon },
      },
    })
    const request = (path: string) =>
      new Request(`https://api.bible-strong.app/v1/strong-bibles/LSG/books/1/identities/${path}`)
    const batch = request('batch/counts?references=H2148A,H2148B')
    const initial = await resourceApiCacheRevisionFrom(batch, catalog('lsg-1', 'kjv-1', 'core-1'))

    assert.equal(
      await resourceApiCacheRevisionFrom(batch, catalog('lsg-1', 'kjv-2', 'core-2')),
      initial
    )
    assert.notEqual(
      await resourceApiCacheRevisionFrom(batch, catalog('lsg-2', 'kjv-1', 'core-1')),
      initial
    )
    // The same revision as the counts of one reference: both read the same index.
    assert.equal(
      await resourceApiCacheRevisionFrom(
        request('H2148A/counts'),
        catalog('lsg-1', 'kjv-1', 'core-1')
      ),
      initial
    )
  })

  it('invalidates dictionary passage discovery independently from generic dictionary reads', async () => {
    const catalog = {
      resources: {
        'dictionary-directory': { contentSha256: 'directory-r1' },
      },
    }
    const passage = await resourceApiCacheRevisionFrom(
      new Request('https://api.bible-strong.app/v1/dictionaries/verses/1-1-1/entries?language=fr'),
      catalog
    )
    const directory = await resourceApiCacheRevisionFrom(
      new Request('https://api.bible-strong.app/v1/dictionaries/directory?language=fr'),
      catalog
    )

    assert.notEqual(passage, directory)
  })

  it('keeps revisioned reads for thirty days, lists for an hour and searches for a day', () => {
    const ttl = (path: string) =>
      resourceApiCacheTtlSeconds(new Request(`https://api.bible-strong.app${path}`))
    const hour = 60 * 60
    const thirtyDays = 30 * 24 * hour

    for (const path of [
      '/v1/bibles/LSG/books/1/chapters/1',
      '/v1/bibles/LSG/verses?references=1-1-1',
      '/v1/strong-lexicon/entries/H430?language=fr',
      '/v1/strong-lexicon/numbers/H2148/senses?language=fr',
      '/v1/strong-bibles/LSG/books/1/identities/H2148A/counts',
      '/v1/strong-bibles/LSG/books/1/identities/batch/counts?references=H2148A,H2148B',
      '/v1/naves/fr/topics/aaron',
      '/v1/cross-references/fr/verses/1-1-1',
      '/v1/commentaries/MHY/fr/chapters/1/1',
      '/v1/commentaries/MHY/fr/coverage',
    ]) {
      assert.equal(ttl(path), thirtyDays, path)
    }
    for (const path of [
      '/v1/naves/fr/topics?limit=500',
      '/v1/strong-lexicon/entries?language=fr&level=simple',
      '/v1/timelines/fr/events',
    ]) {
      assert.equal(ttl(path), hour, path)
    }
    assert.equal(ttl('/v1/bibles/LSG/search?q=grace'), 24 * hour)
    assert.equal(ttl('/v1/naves/fr/random'), undefined)
    assert.equal(ttl('/health'), undefined)
  })

  it('caches every dictionary read, whose routes name a work and a language', () => {
    const ttl = (path: string) =>
      resourceApiCacheTtlSeconds(new Request(`https://api.bible-strong.app${path}`))
    const hour = 60 * 60
    const thirtyDays = 30 * 24 * hour

    for (const path of [
      '/v1/dictionaries',
      '/v1/dictionaries/bost/fr/entries/by-id/2',
      '/v1/dictionaries/bost/fr/entries/aaron',
      '/v1/dictionaries/bost/fr/entries/batch?words=aaron',
      '/v1/dictionaries/bost/fr/verses/2-6-20/words',
      '/v1/dictionaries/bost/fr/verses/2-6-20/entries',
      '/v1/dictionaries/verses/2-6-20/entries?language=fr',
    ]) {
      assert.equal(ttl(path), thirtyDays, path)
    }
    for (const path of [
      '/v1/dictionaries/bost/fr/entries?limit=500',
      '/v1/dictionaries/directory?language=fr&limit=500',
    ]) {
      assert.equal(ttl(path), hour, path)
    }
    // A search of the directory is a search like any other.
    assert.equal(ttl('/v1/dictionaries/directory?language=fr&search=aaron'), 24 * hour)
  })

  it('keeps apart what two versions of the Worker cache for the same content', () => {
    const first = resourceApiCacheEpochFor('catalog-release-1', 'worker-version-1')

    assert.notEqual(first, resourceApiCacheEpochFor('catalog-release-1', 'worker-version-2'))
    assert.notEqual(first, resourceApiCacheEpochFor('catalog-release-2', 'worker-version-1'))
    assert.equal(first, resourceApiCacheEpochFor('catalog-release-1', 'worker-version-1'))
    // Outside a deployment there is no version: the content revision alone names the key.
    assert.equal(
      resourceApiCacheEpochFor('catalog-release-1', undefined),
      resourceApiCacheEpochFor('catalog-release-1', '')
    )
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
    const web = makeResourceWebHandler(makeKyselyBibleChapterRepository(database))

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

describe('Resource API fallback across Worker versions', () => {
  const chapterUrl = 'https://api.bible-strong.app/v1/bibles/LSG/books/1/chapters/1'
  const thirtyDays = 30 * 24 * 60 * 60

  // One data center: a cache that outlives the Worker versions deployed over it. Each
  // version answers with its own name, so a test reads who wrote what it is given.
  const dataCenter = () => {
    const cache = new MemoryEdgeCache()
    const background: Promise<unknown>[] = []
    const failures: string[] = []
    const origin = {
      /** Reads a caller waited for. */
      loads: 0,
      /** Reads made after their caller was answered, with the request each was given. */
      refreshes: [] as Request[],
      answer: (workerVersion: string): Promise<Response> | Response =>
        Response.json({ answeredBy: workerVersion }, { headers: { etag: '"chapter-r1"' } }),
    }
    const read = (
      workerVersion: string,
      {
        url = chapterUrl,
        headers,
        answerRevision = RESOURCE_API_ANSWER_REVISION,
      }: { url?: string; headers?: Record<string, string>; answerRevision?: string } = {}
    ) =>
      routeResourceApiRequest({
        request: new Request(url, { headers }),
        authorize: async () => true,
        cache,
        cacheEpoch: resourceApiCacheEpochFor('content-r1', workerVersion),
        fallback: {
          epoch: resourceApiFallbackEpochFor('content-r1', answerRevision),
          refresh: async request => {
            origin.refreshes.push(request)
            return origin.answer(workerVersion)
          },
        },
        waitUntil: promise => background.push(promise),
        reportCacheFailure: operation => failures.push(operation),
        load: async () => {
          origin.loads += 1
          return origin.answer(workerVersion)
        },
      })
    return {
      cache,
      origin,
      failures,
      read,
      /** Waits for what the requests so far left running behind their answers. */
      settled: () => Promise.all(background.splice(0)),
      stored: () => [...cache.entries.keys()].filter(key => !key.includes('.refreshing')),
    }
  }
  const answeredBy = (response: Response): Promise<string> =>
    response.json().then(body => (body as { answeredBy: string }).answeredBy)

  it('stores a read under its version and under the fallback, for as long', async () => {
    const { cache, origin, read, settled, stored } = dataCenter()

    const miss = await read('v1')
    await settled()
    const hit = await read('v1')

    assert.equal(miss.headers.get('x-resource-cache'), 'MISS')
    assert.equal(hit.headers.get('x-resource-cache'), 'HIT')
    assert.equal(await answeredBy(hit), 'v1')
    assert.equal(origin.loads, 1)
    // A cached answer looks for no fallback and refreshes nothing.
    assert.equal(origin.refreshes.length, 0)
    assert.deepEqual(
      stored()
        .map(key => decodeURIComponent(new URL(key).pathname.split('/')[2] ?? ''))
        .sort(),
      ['content-r1.fallback-answers-1', 'content-r1.v1']
    )
    for (const key of stored()) {
      assert.equal(
        cache.entries.get(key)?.headers.get('cache-control'),
        `public, max-age=${thirtyDays}`
      )
    }
  })

  it('answers a new version at once with the fallback, then with its own read', async () => {
    const { origin, read, settled } = dataCenter()
    await read('v1')
    await settled()

    const stale = await read('v2', { headers: { 'x-request-id': 'after_deployment' } })

    assert.equal(stale.status, 200)
    assert.equal(stale.headers.get('x-resource-cache'), 'STALE')
    assert.equal(stale.headers.get('cache-control'), 'private, no-store')
    assert.equal(stale.headers.get('x-request-id'), 'after_deployment')
    assert.equal(await answeredBy(stale), 'v1')
    // The caller waited for no read of the database.
    assert.equal(origin.loads, 1)

    await settled()
    const hit = await read('v2')
    const laterHit = await read('v2')

    assert.equal(origin.refreshes.length, 1)
    assert.equal(hit.headers.get('x-resource-cache'), 'HIT')
    assert.equal(await answeredBy(hit), 'v2')
    assert.equal(laterHit.headers.get('x-resource-cache'), 'HIT')
    assert.equal(origin.loads, 1)

    // The refresh rewrote the fallback too: the next deployment starts from this answer.
    const nextDeployment = await read('v3')
    assert.equal(nextDeployment.headers.get('x-resource-cache'), 'STALE')
    assert.equal(await answeredBy(nextDeployment), 'v2')
    // A deployment that follows at once is not held back by the refresh of the one before.
    await settled()
    assert.equal(origin.refreshes.length, 2)
    assert.equal(await answeredBy(await read('v3')), 'v3')
  })

  it('reads a URL once however many callers miss it together', async () => {
    const { origin, read, settled } = dataCenter()
    await read('v1')
    await settled()
    const refresh = pendingResponse()
    origin.answer = () => refresh.promise

    // Every caller is answered while the one refresh is still reading.
    const stale = await Promise.all(Array.from({ length: 8 }, () => read('v2')))
    const laterStale = await read('v2')

    assert.deepEqual(
      [...stale, laterStale].map(response => response.headers.get('x-resource-cache')),
      Array.from({ length: 9 }, () => 'STALE')
    )
    assert.equal(origin.refreshes.length, 1)
    assert.equal(origin.loads, 1)

    refresh.resolve(Response.json({ answeredBy: 'v2' }))
    await settled()
    const hit = await read('v2')

    assert.equal(hit.headers.get('x-resource-cache'), 'HIT')
    assert.equal(await answeredBy(hit), 'v2')
    assert.equal(origin.refreshes.length, 1)
  })

  it('reads concurrent misses as before when there is no fallback', async () => {
    const { origin, read, settled } = dataCenter()

    const cold = await Promise.all([read('v1'), read('v1'), read('v1')])
    await settled()

    assert.deepEqual(
      cold.map(response => response.headers.get('x-resource-cache')),
      ['MISS', 'MISS', 'MISS']
    )
    assert.equal(origin.loads, 3)
    assert.equal(origin.refreshes.length, 0)
  })

  it('uses no fallback once the answer revision is bumped', async () => {
    const { origin, read, settled } = dataCenter()
    await read('v1')
    await settled()

    const bumped = await read('v2', { answerRevision: 'answers-2' })
    await settled()

    assert.equal(bumped.headers.get('x-resource-cache'), 'MISS')
    assert.equal(await answeredBy(bumped), 'v2')
    assert.equal(origin.loads, 2)
    assert.equal(origin.refreshes.length, 0)
    // The deployment after that one starts from what the bumped revision stored.
    const next = await read('v3', { answerRevision: 'answers-2' })
    assert.equal(next.headers.get('x-resource-cache'), 'STALE')
    assert.equal(await answeredBy(next), 'v2')
  })

  it('keeps the fallback, and stores nothing, when the refresh does not answer 200', async () => {
    for (const failure of [
      () => Response.json({ code: 'INTERNAL' }, { status: 500 }),
      () => Response.json({ code: 'RESOURCE_RATE_LIMITED' }, { status: 429 }),
      () => Promise.reject(new Error('HYPERDRIVE_UNAVAILABLE')),
    ]) {
      const { cache, origin, failures, read, settled, stored } = dataCenter()
      await read('v1')
      await settled()
      const afterFirstVersion = stored()
      const answer = origin.answer
      origin.answer = failure

      const stale = await read('v2')
      await settled()
      // The refresh that stored nothing is not tried again at once, in any isolate.
      const stillStale = await read('v2')
      await settled()

      assert.equal(stale.headers.get('x-resource-cache'), 'STALE')
      assert.equal(stillStale.headers.get('x-resource-cache'), 'STALE')
      assert.equal(await answeredBy(stillStale), 'v1')
      assert.equal(origin.refreshes.length, 1)
      assert.deepEqual(stored(), afterFirstVersion)
      for (const entry of cache.entries.values()) assert.equal(entry.status, 200)

      // Thirty seconds later the claim is gone, and the next caller has the URL read again.
      origin.answer = answer
      cache.now += 30
      const retried = await read('v2')
      await settled()
      const hit = await read('v2')

      assert.equal(retried.headers.get('x-resource-cache'), 'STALE')
      assert.equal(origin.refreshes.length, 2)
      assert.equal(hit.headers.get('x-resource-cache'), 'HIT')
      assert.equal(await answeredBy(hit), 'v2')
      assert.equal(failures.filter(operation => operation !== 'refresh').length, 0)
    }
  })

  it('never stores an answer that is not a 200, under either key', async () => {
    const { cache, origin, read, settled } = dataCenter()
    origin.answer = () => Response.json({ code: 'BIBLE_UNSUPPORTED' }, { status: 404 })

    const first = await read('v1')
    await settled()
    const second = await read('v1')
    await settled()

    assert.equal(first.status, 404)
    assert.equal(first.headers.get('x-resource-cache'), null)
    assert.equal(second.headers.get('x-resource-cache'), null)
    assert.equal(origin.loads, 2)
    assert.equal(cache.entries.size, 0)
  })

  it('says "not modified" for an answer of its own version only', async () => {
    const { origin, read, settled } = dataCenter()
    const conditional = { headers: { 'if-none-match': 'W/"chapter-r1"' } }
    await read('v1')
    await settled()

    const fresh = await read('v1', conditional)
    assert.equal(fresh.status, 304)
    assert.equal(fresh.headers.get('x-resource-cache'), 'HIT')

    // A fallback is sent whole: this version has not read the URL and confirms nothing.
    const stale = await read('v2', conditional)
    assert.equal(stale.status, 200)
    assert.equal(stale.headers.get('x-resource-cache'), 'STALE')
    assert.equal(stale.headers.get('etag'), '"chapter-r1"')
    assert.equal(await answeredBy(stale), 'v1')

    // The refresh asks without the validator: the database would answer 304, stored nowhere.
    await settled()
    assert.equal(origin.refreshes[0]?.headers.get('if-none-match'), null)
    assert.equal(origin.refreshes[0]?.url, chapterUrl)

    const refreshed = await read('v2', conditional)
    assert.equal(refreshed.status, 304)
    assert.equal(refreshed.headers.get('x-resource-cache'), 'HIT')
    assert.equal(await refreshed.text(), '')
    assert.equal(await answeredBy(await read('v2')), 'v2')
  })

  it('keeps a search out of the fallback and a list in it for its hour', async () => {
    const searchUrl = 'https://api.bible-strong.app/v1/bibles/LSG/search?q=grace'
    const listUrl = 'https://api.bible-strong.app/v1/naves/fr/topics?initial=a&limit=500'
    const takesPart = (url: string) => resourceApiFallbackTakesPart(new Request(url))
    assert.equal(takesPart(chapterUrl), true)
    assert.equal(takesPart(listUrl), true)
    assert.equal(takesPart(searchUrl), false)
    assert.equal(
      takesPart('https://api.bible-strong.app/v1/dictionaries/directory?search=a'),
      false
    )
    assert.equal(takesPart('https://api.bible-strong.app/v1/naves/fr/random'), false)

    const { cache, origin, read, settled, stored } = dataCenter()
    await read('v1', { url: searchUrl })
    await read('v1', { url: listUrl })
    await settled()
    assert.equal(stored().filter(key => key.includes('/search')).length, 1)
    assert.equal(stored().filter(key => key.includes('/topics')).length, 2)

    const search = await read('v2', { url: searchUrl })
    const list = await read('v2', { url: listUrl })
    await settled()

    assert.equal(search.headers.get('x-resource-cache'), 'MISS')
    assert.equal(await answeredBy(search), 'v2')
    assert.equal(list.headers.get('x-resource-cache'), 'STALE')
    assert.equal(await answeredBy(list), 'v1')

    // The fallback of a list lasts the hour of the list: past it, a deployment reads again.
    cache.now += 60 * 60
    const loads = origin.loads
    const expired = await read('v3', { url: listUrl })
    assert.equal(expired.headers.get('x-resource-cache'), 'MISS')
    assert.equal(origin.loads, loads + 1)
  })

  it('names the fallback by the content and the answer revision, never by a Worker version', () => {
    const fallback = resourceApiFallbackEpochFor('catalog-release-1')

    assert.equal(
      fallback,
      resourceApiFallbackEpochFor('catalog-release-1', RESOURCE_API_ANSWER_REVISION)
    )
    assert.notEqual(fallback, resourceApiFallbackEpochFor('catalog-release-2'))
    assert.notEqual(fallback, resourceApiFallbackEpochFor('catalog-release-1', 'answers-next'))
    for (const workerVersion of [undefined, '', 'f7a2f1c8-0c5e-4f0b-9a57-2f6f3a5c9a10']) {
      assert.notEqual(fallback, resourceApiCacheEpochFor('catalog-release-1', workerVersion))
    }
  })

  it('reads the database when the cache cannot be asked for the fallback', async () => {
    const failures: string[] = []
    let loads = 0
    const response = await routeResourceApiRequest({
      request: new Request(chapterUrl),
      authorize: async () => true,
      cache: {
        match: async () => {
          throw new Error('EDGE_CACHE_UNAVAILABLE')
        },
        put: async () => undefined,
      },
      cacheEpoch: 'content-r1.v2',
      fallback: { epoch: 'content-r1.fallback-answers-1', refresh: async () => Response.json({}) },
      waitUntil: () => undefined,
      reportCacheFailure: operation => failures.push(operation),
      load: async () => {
        loads += 1
        return Response.json({ answeredBy: 'v2' })
      },
    })

    assert.equal(response.headers.get('x-resource-cache'), 'MISS')
    assert.equal(loads, 1)
    assert.deepEqual(failures, ['match', 'match'])
  })
})

describe('Resource Worker request path', () => {
  const chapterUrl = 'https://api.bible-strong.app/v1/bibles/LSG/books/1/chapters/1'
  const searchUrl = 'https://api.bible-strong.app/v1/bibles/LSG/search?q=grace'
  let cache: MemoryEdgeCache
  let cacheReads: number
  let logs: Record<string, unknown>[]

  beforeEach(() => {
    cache = new MemoryEdgeCache()
    cacheReads = 0
    logs = []
    const match = cache.match.bind(cache)
    cache.match = async request => {
      cacheReads += 1
      return match(request)
    }
    Object.assign(globalThis, { caches: { open: async () => cache } })
    mock.method(console, 'log', (line: string) => logs.push(JSON.parse(line)))
    mock.method(console, 'warn', () => undefined)
  })

  afterEach(() => {
    mock.restoreAll()
    Reflect.deleteProperty(globalThis, 'caches')
  })

  const harness = (rejected: readonly string[] = [], workerVersion = 'worker-version-1') => {
    const counted: string[] = []
    const backgroundWrites: Promise<unknown>[] = []
    let originLoads = 0
    let originReads = 0
    const limiter = (name: string) => ({
      async limit({ key }: { key: string }) {
        counted.push(`${name}:${key}`)
        return { success: !rejected.includes(name) }
      },
    })
    const worker = makeResourceWorker(async () => {
      originLoads += 1
      return {
        readResourceOrigin: async ({
          request,
          onSqlStatement,
          onSqlDuration,
          onDatabaseConnection,
        }) => {
          originReads += 1
          onDatabaseConnection?.(7)
          onSqlStatement()
          onSqlDuration?.(12)
          onSqlStatement()
          onSqlDuration?.(5)
          return Response.json(
            { path: new URL(request.url).pathname, answeredBy: workerVersion },
            { headers: { etag: '"origin-r1"' } }
          )
        },
      }
    })
    const bindings = {
      RESOURCE_WEB_ORIGINS: 'https://bible-strong.app',
      FIREBASE_APP_CHECK_PROJECT_NUMBER: '204116128917',
      FIREBASE_APP_CHECK_ALLOWED_APP_IDS: '1:204116128917:android:3ae4e716f079e5a002579c',
      SEARCH_ANALYTICS_ENABLED: 'false',
      RESOURCE_ENVIRONMENT: 'test',
      AI_GATEWAY_ID: 'default',
      READING_RATE_LIMITER: limiter('reading'),
      ORIGIN_READING_RATE_LIMITER: limiter('origin-reading'),
      SEARCH_RATE_LIMITER: limiter('search'),
      SEMANTIC_SEARCH_RATE_LIMITER: limiter('semantic-search'),
      SEARCH_ANALYTICS_RATE_LIMITER: limiter('search-analytics'),
      ARTIFACT_RATE_LIMITER: limiter('artifact'),
      ENCRYPTED_ARCHIVE_RATE_LIMITER: limiter('encrypted-artifact'),
      CF_VERSION_METADATA: { id: workerVersion },
      HYPERDRIVE: { connectionString: 'postgresql://unused' },
    } as unknown as Env
    const send = async (url: string, init: RequestInit = {}) => {
      const headers = new Headers(init.headers)
      if (!headers.has('cf-connecting-ip')) headers.set('cf-connecting-ip', '203.0.113.7')
      const response = await worker.fetch(new Request(url, { ...init, headers }), bindings, {
        waitUntil: (promise: Promise<unknown>) => backgroundWrites.push(promise),
      } as unknown as ExecutionContext)
      await Promise.all(backgroundWrites.splice(0))
      return response
    }
    return {
      counted,
      send,
      origin: () => ({ loads: originLoads, reads: originReads }),
    }
  }

  it('counts a cached read against the request limit only, and never against the database limit', async () => {
    const { counted, send, origin } = harness()

    const miss = await send(chapterUrl)
    const hit = await send(chapterUrl)
    const laterHit = await send(chapterUrl)

    assert.equal(miss.headers.get('x-resource-cache'), 'MISS')
    assert.equal(hit.headers.get('x-resource-cache'), 'HIT')
    assert.equal(laterHit.headers.get('x-resource-cache'), 'HIT')
    assert.deepEqual(counted, [
      'reading:address:203.0.113.7',
      'origin-reading:address:203.0.113.7',
      'reading:address:203.0.113.7',
      'reading:address:203.0.113.7',
    ])
    assert.deepEqual(origin(), { loads: 1, reads: 1 })
    // A read of the database says where its time went; a cached one opened nothing.
    assert.deepEqual(
      logs.map(log => [
        log.cache,
        log.originRead,
        log.sqlStatements,
        log.sqlMs,
        log.databaseConnectMs,
      ]),
      [
        ['MISS', true, 2, 17, 7],
        ['HIT', false, 0, 0, undefined],
        ['HIT', false, 0, 0, undefined],
      ]
    )
  })

  it('refuses a read at the database limit without opening the database or caching the refusal', async () => {
    const { counted, send, origin } = harness(['origin-reading'])

    const refused = await send(chapterUrl, {
      headers: { 'x-request-id': 'origin_limited', origin: 'https://bible-strong.app' },
    })
    const refusedAgain = await send(chapterUrl)

    assert.equal(refused.status, 429)
    assert.equal(refused.headers.get('retry-after'), '60')
    assert.equal(refused.headers.get('cache-control'), 'private, no-store')
    assert.equal(refused.headers.get('content-type'), 'application/json')
    assert.equal(refused.headers.get('x-request-id'), 'origin_limited')
    assert.equal(refused.headers.get('x-resource-cache'), null)
    assert.equal(refused.headers.get('access-control-allow-origin'), 'https://bible-strong.app')
    assert.deepEqual(await refused.json(), {
      _tag: 'ResourceRateLimitedProblem',
      type: 'https://bible-strong.app/problems/resource-rate-limited',
      title: 'Resource request rate limited',
      detail: 'Too many resource requests. Retry after 60 seconds.',
      requestId: 'origin_limited',
      status: 429,
      code: 'RESOURCE_RATE_LIMITED',
      retryAfterSeconds: 60,
    })
    assert.equal(refusedAgain.status, 429)
    assert.equal(cache.entries.size, 0)
    assert.deepEqual(origin(), { loads: 0, reads: 0 })
    assert.equal(counted.filter(name => name.startsWith('origin-reading:')).length, 2)
    // Reported as a limited request, not as a request the Resource API answered.
    assert.deepEqual(logs, [])
  })

  it('answers a caller refused at the database limit exactly like one refused before the cache', async () => {
    const init = { headers: { 'x-request-id': 'same_refusal', origin: 'https://bible-strong.app' } }
    const atDatabase = await harness(['origin-reading']).send(chapterUrl, init)
    const beforeCache = await harness(['reading']).send(chapterUrl, init)

    assert.equal(atDatabase.status, beforeCache.status)
    assert.deepEqual([...atDatabase.headers], [...beforeCache.headers])
    assert.equal(await atDatabase.text(), await beforeCache.text())
  })

  it('still serves what is cached to a caller over the database limit', async () => {
    const warm = harness()
    await warm.send(chapterUrl)
    const limited = harness(['origin-reading'])

    const cached = await limited.send(chapterUrl)
    const uncached = await limited.send(
      'https://api.bible-strong.app/v1/bibles/LSG/books/1/chapters/2'
    )

    assert.equal(cached.status, 200)
    assert.equal(cached.headers.get('x-resource-cache'), 'HIT')
    assert.equal(uncached.status, 429)
    assert.deepEqual(limited.counted, [
      'reading:address:203.0.113.7',
      'reading:address:203.0.113.7',
      'origin-reading:address:203.0.113.7',
    ])
  })

  it('refuses a caller over the request limit before the cache is read', async () => {
    const warm = harness()
    await warm.send(chapterUrl)
    cacheReads = 0
    const { counted, send, origin } = harness(['reading'])

    const refused = await send(chapterUrl)

    assert.equal(refused.status, 429)
    assert.equal(cacheReads, 0)
    assert.deepEqual(counted, ['reading:address:203.0.113.7'])
    assert.deepEqual(origin(), { loads: 0, reads: 0 })
  })

  it('counts an uncacheable read against both limits', async () => {
    const { counted, send, origin } = harness()

    const response = await send('https://api.bible-strong.app/v1/unknown-future-route')

    assert.equal(response.headers.get('x-resource-cache'), null)
    assert.deepEqual(counted, ['reading:address:203.0.113.7', 'origin-reading:address:203.0.113.7'])
    assert.deepEqual(origin(), { loads: 1, reads: 1 })
  })

  it('keeps counting every search before the cache, cached answers included', async () => {
    const { counted, send, origin } = harness()

    const miss = await send(searchUrl)
    const hit = await send(searchUrl)
    const refused = await harness(['search']).send(searchUrl)

    assert.equal(miss.headers.get('x-resource-cache'), 'MISS')
    assert.equal(hit.headers.get('x-resource-cache'), 'HIT')
    assert.deepEqual(counted, ['search:address:203.0.113.7', 'search:address:203.0.113.7'])
    assert.deepEqual(origin(), { loads: 1, reads: 1 })
    assert.equal(refused.status, 429)
  })

  it('answers a new version from the fallback and counts its refresh against the database limit', async () => {
    await harness().send(chapterUrl)
    logs = []
    const { counted, send, origin } = harness([], 'worker-version-2')

    const stale = await send(chapterUrl, { headers: { 'if-none-match': '"origin-r1"' } })
    const hit = await send(chapterUrl)

    assert.equal(stale.status, 200)
    assert.equal(stale.headers.get('x-resource-cache'), 'STALE')
    assert.equal((await stale.json()).answeredBy, 'worker-version-1')
    assert.equal(hit.headers.get('x-resource-cache'), 'HIT')
    assert.equal((await hit.json()).answeredBy, 'worker-version-2')
    // The refresh is a read of the database its caller caused, and is counted as one.
    assert.deepEqual(counted, [
      'reading:address:203.0.113.7',
      'origin-reading:address:203.0.113.7',
      'reading:address:203.0.113.7',
    ])
    assert.deepEqual(origin(), { loads: 1, reads: 1 })
    // The caller opened no database; the refresh says on its own line what it read.
    assert.deepEqual(
      logs.map(log => [log.message, log.cache, log.originRead, log.stored, log.sqlStatements]),
      [
        ['resource API request', 'STALE', false, undefined, 0],
        ['resource API fallback refresh', undefined, undefined, true, 2],
        ['resource API request', 'HIT', false, undefined, 0],
      ]
    )
  })

  it('still answers a caller over the database limit from the fallback, and reads nothing for it', async () => {
    await harness().send(chapterUrl)
    logs = []
    const limited = harness(['origin-reading'], 'worker-version-2')

    const stale = await limited.send(chapterUrl)
    const staleAgain = await limited.send(chapterUrl)

    assert.equal(stale.status, 200)
    assert.equal(stale.headers.get('x-resource-cache'), 'STALE')
    assert.equal(staleAgain.headers.get('x-resource-cache'), 'STALE')
    assert.deepEqual(limited.origin(), { loads: 0, reads: 0 })
    assert.deepEqual(
      logs.filter(log => log.message === 'resource API fallback refresh').map(log => log.limited),
      [true]
    )
    // Nothing but the claim of the refused refresh is stored in the name of this version.
    assert.deepEqual(
      [...cache.entries.keys()]
        .filter(key => key.includes('worker-version-2'))
        .map(key => key.includes('.refreshing')),
      [true]
    )

    // Once the claim of the refused refresh has passed, a caller under the limit refreshes.
    cache.now += 30
    const allowed = harness([], 'worker-version-2')
    await allowed.send(chapterUrl)
    const hit = await allowed.send(chapterUrl)

    assert.equal(hit.headers.get('x-resource-cache'), 'HIT')
    assert.equal((await hit.json()).answeredBy, 'worker-version-2')
    assert.deepEqual(allowed.origin(), { loads: 1, reads: 1 })
  })

  it('keeps no fallback for a search, which a new version reads again', async () => {
    await harness().send(searchUrl)
    const { counted, send, origin } = harness([], 'worker-version-2')

    const miss = await send(searchUrl)

    assert.equal(miss.headers.get('x-resource-cache'), 'MISS')
    assert.deepEqual(counted, ['search:address:203.0.113.7'])
    assert.deepEqual(origin(), { loads: 1, reads: 1 })
  })

  it('answers a preflight, a health check and a cached read without loading the HTTP application', async () => {
    const warm = harness()
    await warm.send(chapterUrl)
    const { counted, send, origin } = harness()

    const preflight = await send(chapterUrl, {
      method: 'OPTIONS',
      headers: { origin: 'https://bible-strong.app' },
    })
    const health = await send('https://api.bible-strong.app/health')
    const cached = await send(chapterUrl)

    assert.equal(preflight.status, 204)
    assert.equal(health.status, 200)
    assert.deepEqual(await health.json(), { status: 'ok' })
    assert.equal(cached.headers.get('x-resource-cache'), 'HIT')
    assert.deepEqual(origin(), { loads: 0, reads: 0 })
    assert.deepEqual(counted, ['reading:address:203.0.113.7'])
  })

  it('answers the health check with the response of the HTTP application', async () => {
    const web = makeResourceWebHandler()
    const request = () =>
      new Request('https://api.bible-strong.app/health', { headers: { 'x-request-id': 'health' } })

    const fromApplication = await web.handler(request())
    const fromWorker = makeResourceHealthResponse(request())

    assert.equal(fromWorker?.status, fromApplication.status)
    assert.deepEqual([...(fromWorker?.headers ?? [])], [...fromApplication.headers])
    assert.equal(await fromWorker?.text(), await fromApplication.text())
    // Any other spelling of the route is left to the application.
    for (const [method, path] of [
      ['HEAD', '/health'],
      ['POST', '/health'],
      ['GET', '/health/'],
      ['GET', '/v1/health'],
    ]) {
      assert.equal(
        makeResourceHealthResponse(new Request(`https://api.bible-strong.app${path}`, { method })),
        undefined
      )
    }
    await web.dispose()
  })

  it('logs which request of its isolate each answer was', async () => {
    const { send } = harness()

    await send(chapterUrl)
    await send(chapterUrl)

    const [first, second] = logs.map(log => log.isolateRequest as number)
    assert.equal(Number.isInteger(first), true)
    assert.equal(second, first + 1)
  })
})
