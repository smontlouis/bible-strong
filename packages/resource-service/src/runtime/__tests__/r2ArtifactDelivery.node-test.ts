import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  MOBILE_RESOURCE_CATALOG_ROUTE,
  R2_ARTIFACT_ROUTE_PREFIX,
  routeR2ArtifactRequest,
  type ArtifactRange,
  type R2ArtifactBucket,
} from '../r2ArtifactDelivery'
import mobileResourceCatalog from '@bible-strong/mobile/src/assets/mobile-resource-catalog.json'

const artifactKey = 'bibles/bible-lsg.json.zip'
const artifactSha256 = mobileResourceCatalog.resources['bible:LSG'].archiveSha256

const makeObject = ({
  body = 'archive',
  range,
}: {
  body?: string
  range?: ArtifactRange
} = {}) => ({
  body: new Blob([body]).stream(),
  size: 7,
  httpEtag: '"r2-etag"',
  uploaded: new Date('2025-08-20T12:00:00.000Z'),
  range,
  writeHttpMetadata(headers: Headers) {
    headers.set('content-type', 'application/zip')
  },
})

const makeMetadataObject = () => {
  const { body: _body, ...metadata } = makeObject()
  return metadata
}

const makeBucket = (
  object: Exclude<Awaited<ReturnType<R2ArtifactBucket['get']>>, null> = makeObject()
) => {
  const reads: { operation: 'get' | 'head'; key: string }[] = []
  const bucket: R2ArtifactBucket = {
    async get(key) {
      reads.push({ operation: 'get', key })
      return object
    },
    async head(key) {
      reads.push({ operation: 'head', key })
      return object
    },
  }
  return { bucket, reads }
}

const artifactRequest = (path = artifactKey, init?: RequestInit) =>
  new Request(`https://api.bible-strong.app${R2_ARTIFACT_ROUTE_PREFIX}${path}`, init)

class MemoryArtifactCache {
  readonly entries = new Map<string, Response>()
  matchCalls = 0

  async match(request: Request): Promise<Response | undefined> {
    this.matchCalls += 1
    const stored = this.entries.get(request.url)
    if (!stored) return undefined
    const ifNoneMatch = request.headers.get('if-none-match')
    if (ifNoneMatch === stored.headers.get('etag')) {
      const headers = new Headers(stored.headers)
      headers.delete('content-length')
      return new Response(null, { status: 304, headers })
    }
    const range = request.headers.get('range')
    if (!range) return stored.clone()
    const match = /^bytes=(\d+)-(\d+)$/.exec(range)
    if (!match) return undefined
    const bytes = new Uint8Array(await stored.clone().arrayBuffer())
    const start = Number(match[1])
    const end = Number(match[2])
    const headers = new Headers(stored.headers)
    headers.set('content-range', `bytes ${start}-${end}/${bytes.byteLength}`)
    headers.set('content-length', String(end - start + 1))
    return new Response(bytes.slice(start, end + 1), { status: 206, headers })
  }

  async put(request: Request, response: Response): Promise<void> {
    this.entries.set(request.url, response.clone())
  }
}

describe('R2 artifact delivery', () => {
  it('serves the provider-neutral mobile catalog without touching R2', async () => {
    const { bucket, reads } = makeBucket()

    const response = await routeR2ArtifactRequest({
      request: new Request(`https://api.bible-strong.app${MOBILE_RESOURCE_CATALOG_ROUTE}`),
      bucket,
      authorize: async () => false,
    })

    assert.equal(response?.status, 200)
    assert.equal(response?.headers.get('content-type'), 'application/json; charset=utf-8')
    const catalog = (await response?.json()) as { resourceCount?: number; resources?: object }
    assert.equal(catalog.resourceCount, 72)
    assert.equal(Object.keys(catalog.resources ?? {}).length, 72)
    assert.deepEqual(reads, [])
  })

  it('stores and reuses the public mobile catalog in the shared edge cache', async () => {
    const { bucket, reads } = makeBucket()
    const cache = new MemoryArtifactCache()
    const pending: Promise<unknown>[] = []
    const request = new Request(`https://api.bible-strong.app${MOBILE_RESOURCE_CATALOG_ROUTE}`)

    const first = await routeR2ArtifactRequest({
      request,
      bucket,
      authorize: async () => false,
      cache,
      waitUntil: promise => pending.push(promise),
    })
    await Promise.all(pending)
    const second = await routeR2ArtifactRequest({
      request,
      bucket,
      authorize: async () => false,
      cache,
    })

    assert.equal(first?.status, 200)
    assert.equal(first?.headers.get('x-resource-cache'), 'MISS')
    assert.equal(second?.status, 200)
    assert.equal(second?.headers.get('x-resource-cache'), 'HIT')
    assert.deepEqual(await second?.json(), mobileResourceCatalog)
    assert.deepEqual(reads, [])
  })

  it('does not handle unrelated Resource API routes', async () => {
    const { bucket, reads } = makeBucket()

    const response = await routeR2ArtifactRequest({
      request: new Request('https://api.bible-strong.app/health'),
      bucket,
      authorize: async () => true,
    })

    assert.equal(response, undefined)
    assert.deepEqual(reads, [])
  })

  it('keeps known artifacts closed until application attestation succeeds', async () => {
    const { bucket, reads } = makeBucket()
    const cache = new MemoryArtifactCache()

    const response = await routeR2ArtifactRequest({
      request: artifactRequest(artifactKey, { headers: { 'x-request-id': 'denied_request' } }),
      bucket,
      authorize: async () => false,
      cache,
    })

    assert.equal(response?.status, 401)
    assert.equal(response?.headers.get('cache-control'), 'private, no-store')
    assert.equal(response?.headers.get('x-request-id'), 'denied_request')
    assert.equal(cache.matchCalls, 0)
    assert.deepEqual(reads, [])
  })

  it('never exposes keys outside the checked-in mobile inventory', async () => {
    const { bucket, reads } = makeBucket()

    const response = await routeR2ArtifactRequest({
      request: artifactRequest(`${artifactKey}.metadata.json`),
      bucket,
      authorize: async () => true,
    })

    assert.equal(response?.status, 404)
    assert.deepEqual(reads, [])
  })

  it('streams an authorized catalog artifact with immutable object metadata', async () => {
    const { bucket, reads } = makeBucket()

    const response = await routeR2ArtifactRequest({
      request: artifactRequest(),
      bucket,
      authorize: async () => true,
    })

    assert.equal(response?.status, 200)
    assert.equal(response?.headers.get('content-type'), 'application/zip')
    assert.equal(response?.headers.get('content-length'), '7')
    assert.equal(response?.headers.get('etag'), '"r2-etag"')
    assert.equal(response?.headers.get('accept-ranges'), 'bytes')
    assert.equal(response?.headers.get('cache-control'), 'private, no-store')
    assert.equal(await response?.text(), 'archive')
    assert.deepEqual(reads, [{ operation: 'get', key: artifactKey }])
  })

  it('reuses a complete authenticated artifact from edge cache without reopening R2', async () => {
    const { bucket, reads } = makeBucket()
    const cache = new MemoryArtifactCache()
    const backgroundWrites: Promise<unknown>[] = []
    const route = () =>
      routeR2ArtifactRequest({
        request: artifactRequest(`${artifactKey}?sha256=${artifactSha256}`),
        bucket,
        authorize: async () => true,
        cache,
        waitUntil: promise => backgroundWrites.push(promise),
      })

    const first = await route()
    await Promise.all(backgroundWrites)
    const second = await route()

    assert.equal(first?.headers.get('x-resource-cache'), 'MISS')
    assert.equal(second?.headers.get('x-resource-cache'), 'HIT')
    assert.equal(second?.headers.get('cache-control'), 'private, no-store')
    assert.equal(await second?.text(), 'archive')
    assert.deepEqual(reads, [
      { operation: 'get', key: `revisions/${artifactSha256}/${artifactKey}` },
    ])
    assert.deepEqual(
      [...cache.entries.keys()],
      [
        `https://api.bible-strong.app${R2_ARTIFACT_ROUTE_PREFIX}${artifactKey}?sha256=${artifactSha256}`,
      ]
    )
  })

  it('serves a resumed byte range from a previously cached complete artifact', async () => {
    const { bucket, reads } = makeBucket()
    const cache = new MemoryArtifactCache()
    const backgroundWrites: Promise<unknown>[] = []
    await routeR2ArtifactRequest({
      request: artifactRequest(`${artifactKey}?sha256=${artifactSha256}`),
      bucket,
      authorize: async () => true,
      cache,
      waitUntil: promise => backgroundWrites.push(promise),
    })
    await Promise.all(backgroundWrites)

    const resumed = await routeR2ArtifactRequest({
      request: artifactRequest(`${artifactKey}?sha256=${artifactSha256}`, {
        headers: { range: 'bytes=2-4' },
      }),
      bucket,
      authorize: async () => true,
      cache,
      waitUntil: () => undefined,
    })

    assert.equal(resumed?.status, 206)
    assert.equal(resumed?.headers.get('content-range'), 'bytes 2-4/7')
    assert.equal(resumed?.headers.get('x-resource-cache'), 'HIT')
    assert.equal(await resumed?.text(), 'chi')
    assert.deepEqual(reads, [
      { operation: 'get', key: `revisions/${artifactSha256}/${artifactKey}` },
    ])
  })

  it('restarts or resumes a cached download according to its If-Range validator', async () => {
    const { bucket, reads } = makeBucket()
    const cache = new MemoryArtifactCache()
    const backgroundWrites: Promise<unknown>[] = []
    await routeR2ArtifactRequest({
      request: artifactRequest(artifactKey),
      bucket,
      authorize: async () => true,
      cache,
      waitUntil: promise => backgroundWrites.push(promise),
    })
    await Promise.all(backgroundWrites)

    const staleResume = await routeR2ArtifactRequest({
      request: artifactRequest(artifactKey, {
        headers: { range: 'bytes=2-4', 'if-range': '"old-etag"' },
      }),
      bucket,
      authorize: async () => true,
      cache,
    })
    const currentResume = await routeR2ArtifactRequest({
      request: artifactRequest(artifactKey, {
        headers: { range: 'bytes=2-4', 'if-range': '"r2-etag"' },
      }),
      bucket,
      authorize: async () => true,
      cache,
    })

    assert.equal(staleResume?.status, 200)
    assert.equal(await staleResume?.text(), 'archive')
    assert.equal(currentResume?.status, 206)
    assert.equal(await currentResume?.text(), 'chi')
    assert.deepEqual(reads, [{ operation: 'get', key: artifactKey }])
  })

  it('does not cache a partial R2 response when no complete artifact is cached yet', async () => {
    const { bucket } = makeBucket(makeObject({ body: 'chi', range: { offset: 2, length: 3 } }))
    const cache = new MemoryArtifactCache()
    const backgroundWrites: Promise<unknown>[] = []

    const response = await routeR2ArtifactRequest({
      request: artifactRequest(artifactKey, { headers: { range: 'bytes=2-4' } }),
      bucket,
      authorize: async () => true,
      cache,
      waitUntil: promise => backgroundWrites.push(promise),
    })

    assert.equal(response?.status, 206)
    assert.equal(response?.headers.get('x-resource-cache'), 'MISS')
    assert.equal(backgroundWrites.length, 0)
    assert.equal(cache.entries.size, 0)
  })

  it('serves HEAD metadata from a cached complete artifact without reopening R2', async () => {
    const { bucket, reads } = makeBucket()
    const cache = new MemoryArtifactCache()
    const backgroundWrites: Promise<unknown>[] = []
    await routeR2ArtifactRequest({
      request: artifactRequest(artifactKey),
      bucket,
      authorize: async () => true,
      cache,
      waitUntil: promise => backgroundWrites.push(promise),
    })
    await Promise.all(backgroundWrites)

    const metadata = await routeR2ArtifactRequest({
      request: artifactRequest(artifactKey, { method: 'HEAD' }),
      bucket,
      authorize: async () => true,
      cache,
    })

    assert.equal(metadata?.status, 200)
    assert.equal(metadata?.headers.get('content-length'), '7')
    assert.equal(metadata?.headers.get('x-resource-cache'), 'HIT')
    assert.equal(await metadata?.text(), '')
    assert.deepEqual(reads, [{ operation: 'get', key: artifactKey }])
  })

  it('preserves conditional GET semantics for a cached artifact', async () => {
    const { bucket, reads } = makeBucket()
    const cache = new MemoryArtifactCache()
    const backgroundWrites: Promise<unknown>[] = []
    await routeR2ArtifactRequest({
      request: artifactRequest(artifactKey),
      bucket,
      authorize: async () => true,
      cache,
      waitUntil: promise => backgroundWrites.push(promise),
    })
    await Promise.all(backgroundWrites)

    const unchanged = await routeR2ArtifactRequest({
      request: artifactRequest(artifactKey, { headers: { 'if-none-match': 'W/"r2-etag"' } }),
      bucket,
      authorize: async () => true,
      cache,
    })

    assert.equal(unchanged?.status, 304)
    assert.equal(unchanged?.headers.get('x-resource-cache'), 'HIT')
    assert.equal(unchanged?.headers.get('content-length'), null)
    assert.deepEqual(reads, [{ operation: 'get', key: artifactKey }])
  })

  it('enforces modifying preconditions before serving a cached artifact', async () => {
    const { bucket, reads } = makeBucket()
    const cache = new MemoryArtifactCache()
    const backgroundWrites: Promise<unknown>[] = []
    await routeR2ArtifactRequest({
      request: artifactRequest(artifactKey),
      bucket,
      authorize: async () => true,
      cache,
      waitUntil: promise => backgroundWrites.push(promise),
    })
    await Promise.all(backgroundWrites)

    const response = await routeR2ArtifactRequest({
      request: artifactRequest(artifactKey, {
        method: 'HEAD',
        headers: { 'if-match': '"stale-etag"' },
      }),
      bucket,
      authorize: async () => true,
      cache,
    })

    assert.equal(response?.status, 412)
    assert.equal(response?.headers.get('content-length'), null)
    assert.equal(response?.headers.get('x-resource-cache'), 'HIT')
    assert.deepEqual(reads, [{ operation: 'get', key: artifactKey }])
  })

  it('preserves conditional HEAD semantics on cache hits and misses', async () => {
    const { bucket, reads } = makeBucket()
    const cache = new MemoryArtifactCache()
    const backgroundWrites: Promise<unknown>[] = []
    await routeR2ArtifactRequest({
      request: artifactRequest(artifactKey),
      bucket,
      authorize: async () => true,
      cache,
      waitUntil: promise => backgroundWrites.push(promise),
    })
    await Promise.all(backgroundWrites)

    const cached = await routeR2ArtifactRequest({
      request: artifactRequest(artifactKey, {
        method: 'HEAD',
        headers: { 'if-none-match': '"r2-etag"' },
      }),
      bucket,
      authorize: async () => true,
      cache,
    })
    const cold = await routeR2ArtifactRequest({
      request: artifactRequest(artifactKey, {
        method: 'HEAD',
        headers: { 'if-modified-since': 'Wed, 20 Aug 2025 12:00:00 GMT' },
      }),
      bucket,
      authorize: async () => true,
    })
    const rejected = await routeR2ArtifactRequest({
      request: artifactRequest(artifactKey, {
        method: 'HEAD',
        headers: { 'if-unmodified-since': 'Tue, 19 Aug 2025 12:00:00 GMT' },
      }),
      bucket,
      authorize: async () => true,
    })

    assert.equal(cached?.status, 304)
    assert.equal(cached?.headers.get('x-resource-cache'), 'HIT')
    assert.equal(cold?.status, 304)
    assert.equal(cold?.headers.get('content-length'), null)
    assert.equal(rejected?.status, 412)
    assert.equal(rejected?.headers.get('content-length'), null)
    assert.deepEqual(reads, [
      { operation: 'get', key: artifactKey },
      { operation: 'head', key: artifactKey },
      { operation: 'head', key: artifactKey },
    ])
  })

  it('maps a failed safe-method R2 validator to 304 on a cold cache', async () => {
    const { bucket } = makeBucket(makeMetadataObject())

    const response = await routeR2ArtifactRequest({
      request: artifactRequest(artifactKey, {
        headers: { 'if-modified-since': 'Wed, 20 Aug 2025 12:00:00 GMT' },
      }),
      bucket,
      authorize: async () => true,
    })

    assert.equal(response?.status, 304)
    assert.equal(response?.headers.get('content-length'), null)
  })

  it('normalizes an impossible cold byte range to a protected 416 response', async () => {
    const bucket: R2ArtifactBucket = {
      async get() {
        throw Object.assign(new Error('The requested range is not satisfiable'), {
          name: 'InvalidRange',
          code: 10039,
          action: 'get',
        })
      },
      async head() {
        return makeMetadataObject()
      },
    }

    const response = await routeR2ArtifactRequest({
      request: artifactRequest(artifactKey, { headers: { range: 'bytes=99-100' } }),
      bucket,
      authorize: async () => true,
      cache: new MemoryArtifactCache(),
    })

    assert.equal(response?.status, 416)
    assert.equal(response?.headers.get('content-range'), 'bytes */7')
    assert.equal(response?.headers.get('accept-ranges'), 'bytes')
    assert.equal(response?.headers.get('cache-control'), 'private, no-store')
    assert.equal(response?.headers.get('x-resource-cache'), 'MISS')
  })

  it('falls back to R2 and reports when the artifact edge cache is unavailable', async () => {
    const { bucket, reads } = makeBucket()
    const failures: string[] = []

    const response = await routeR2ArtifactRequest({
      request: artifactRequest(artifactKey),
      bucket,
      authorize: async () => true,
      cache: {
        match: async () => {
          throw new Error('EDGE_CACHE_UNAVAILABLE')
        },
        put: async () => undefined,
      },
      reportCacheFailure: operation => failures.push(operation),
    })

    assert.equal(response?.status, 200)
    assert.deepEqual(reads, [{ operation: 'get', key: artifactKey }])
    assert.deepEqual(failures, ['match'])
  })

  it('routes a catalog SHA URL to an immutable R2 revision while preserving legacy stable URLs', async () => {
    const { bucket, reads } = makeBucket()

    const response = await routeR2ArtifactRequest({
      request: artifactRequest(`${artifactKey}?sha256=${artifactSha256}`),
      bucket,
      authorize: async () => true,
    })

    assert.equal(response?.status, 200)
    assert.deepEqual(reads, [
      { operation: 'get', key: `revisions/${artifactSha256}/${artifactKey}` },
    ])
  })

  it('keeps retained immutable revisions addressable for older cached catalogs', async () => {
    const { bucket, reads } = makeBucket()
    const previousSha256 = 'b'.repeat(64)

    const response = await routeR2ArtifactRequest({
      request: artifactRequest(`${artifactKey}?sha256=${previousSha256}`),
      bucket,
      authorize: async () => true,
    })

    assert.equal(response?.status, 200)
    assert.deepEqual(reads, [
      { operation: 'get', key: `revisions/${previousSha256}/${artifactKey}` },
    ])
  })

  it('supports resumable range downloads without buffering the archive', async () => {
    const { bucket } = makeBucket(makeObject({ body: 'chi', range: { offset: 2, length: 3 } }))

    const response = await routeR2ArtifactRequest({
      request: artifactRequest(artifactKey, { headers: { range: 'bytes=2-4' } }),
      bucket,
      authorize: async () => true,
    })

    assert.equal(response?.status, 206)
    assert.equal(response?.headers.get('content-range'), 'bytes 2-4/7')
    assert.equal(response?.headers.get('content-length'), '3')
    assert.equal(await response?.text(), 'chi')
  })

  it('uses R2 HEAD metadata without loading the archive body', async () => {
    const { bucket, reads } = makeBucket()

    const response = await routeR2ArtifactRequest({
      request: artifactRequest(artifactKey, { method: 'HEAD' }),
      bucket,
      authorize: async () => true,
    })

    assert.equal(response?.status, 200)
    assert.equal(response?.headers.get('content-length'), '7')
    assert.equal(await response?.text(), '')
    assert.deepEqual(reads, [{ operation: 'head', key: artifactKey }])
  })

  it('rejects write methods before accessing R2', async () => {
    const { bucket, reads } = makeBucket()

    const response = await routeR2ArtifactRequest({
      request: artifactRequest(artifactKey, { method: 'DELETE' }),
      bucket,
      authorize: async () => true,
    })

    assert.equal(response?.status, 405)
    assert.equal(response?.headers.get('allow'), 'GET, HEAD')
    assert.deepEqual(reads, [])
  })
})
