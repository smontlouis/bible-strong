import mobileResourceCatalog from '@bible-strong/resource-catalog/catalog'
import { resourceRequestIdFrom } from '../http/requestId'

export const R2_ARTIFACT_ROUTE_PREFIX = '/v1/offline-artifacts/'
export const MOBILE_RESOURCE_CATALOG_ROUTE = '/v1/offline-catalog'

export type ArtifactRange =
  | { offset: number; length?: number }
  | { offset?: number; length: number }
  | { suffix: number }

type R2ArtifactObject = {
  readonly size: number
  readonly httpEtag: string
  readonly uploaded: Date
  readonly range?: ArtifactRange
  writeHttpMetadata(headers: Headers): void
}

type R2ArtifactObjectBody = R2ArtifactObject & {
  readonly body: ReadableStream
}

export type R2ArtifactBucket = {
  head(key: string): Promise<R2ArtifactObject | null>
  get(
    key: string,
    options: { onlyIf: Headers; range: Headers }
  ): Promise<R2ArtifactObject | R2ArtifactObjectBody | null>
}

export type ArtifactRequestAuthorizer = (request: Request) => Promise<boolean>

export type ArtifactEdgeCache = {
  match(request: Request): Promise<Response | undefined>
  put(request: Request, response: Response): Promise<void>
}

const mobileArtifacts = new Map(
  Object.values(mobileResourceCatalog.resources).map(resource => [
    resource.file,
    resource.archiveSha256,
  ])
)

const mobileResourceCatalogJson = JSON.stringify(mobileResourceCatalog)

const mobileResourceCatalogSha256 = async (): Promise<string> => {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(mobileResourceCatalogJson)
  )
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

const mobileResourceCatalogCacheRequest = async (request: Request): Promise<Request> => {
  const url = new URL(request.url)
  url.pathname = `/__mobile-resource-catalog/${await mobileResourceCatalogSha256()}`
  url.search = ''
  return new Request(url, { method: 'GET' })
}

const mobileResourceCatalogResponse = async (): Promise<Response> => {
  const bytes = new TextEncoder().encode(mobileResourceCatalogJson)
  return new Response(bytes, {
    status: 200,
    headers: {
      'cache-control': 'public, max-age=300',
      'content-length': String(bytes.byteLength),
      'content-type': 'application/json; charset=utf-8',
      etag: `"${await mobileResourceCatalogSha256()}"`,
    },
  })
}

const mobileResourceCatalogResponseForClient = (
  response: Response,
  request: Request,
  cacheStatus?: 'HIT' | 'MISS'
): Response => {
  const headers = new Headers(response.headers)
  if (cacheStatus) headers.set('x-resource-cache', cacheStatus)
  const conditionalStatus = preconditionStatus(request, headers)
  if (conditionalStatus) headers.delete('content-length')
  return new Response(request.method === 'HEAD' || conditionalStatus ? null : response.body, {
    status: conditionalStatus ?? response.status,
    statusText: conditionalStatus ? undefined : response.statusText,
    headers,
  })
}

const r2KeyForRequest = (url: URL): string | undefined => {
  const stableKey = url.pathname.slice(R2_ARTIFACT_ROUTE_PREFIX.length)
  if (!mobileArtifacts.has(stableKey)) return undefined
  const requestedSha256 = url.searchParams.get('sha256')
  if (!requestedSha256) return stableKey
  if (!/^[a-f0-9]{64}$/.test(requestedSha256)) return undefined
  return `revisions/${requestedSha256}/${stableKey}`
}

const contentRangeFrom = (range: ArtifactRange, totalSize: number): string | undefined => {
  if ('suffix' in range) {
    const length = Math.min(range.suffix, totalSize)
    return `bytes ${totalSize - length}-${totalSize - 1}/${totalSize}`
  }
  const offset = range.offset ?? 0
  const length = range.length ?? totalSize - offset
  if (length <= 0 || offset < 0 || offset + length > totalSize) return undefined
  return `bytes ${offset}-${offset + length - 1}/${totalSize}`
}

const artifactHeaders = (object: R2ArtifactObject): Headers => {
  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('accept-ranges', 'bytes')
  headers.set('cache-control', 'private, no-store')
  headers.set('etag', object.httpEtag)
  headers.set('last-modified', object.uploaded.toUTCString())
  headers.set('x-content-type-options', 'nosniff')
  if (object.range) {
    const contentRange = contentRangeFrom(object.range, object.size)
    if (contentRange) {
      headers.set('content-range', contentRange)
      const match = /^bytes \d+-\d+\/(\d+)$/.exec(contentRange)
      const [start, end] = contentRange
        .slice('bytes '.length, contentRange.indexOf('/'))
        .split('-')
        .map(Number)
      if (match && Number.isSafeInteger(start) && Number.isSafeInteger(end)) {
        headers.set('content-length', String(end - start + 1))
      }
    }
  } else {
    headers.set('content-length', String(object.size))
  }
  return headers
}

const etagMatches = (value: string, etag: string, weak: boolean): boolean =>
  value.split(',').some(candidate => {
    const trimmed = candidate.trim()
    if (trimmed === '*') return true
    if (weak) return trimmed.replace(/^W\//, '') === etag.replace(/^W\//, '')
    return !trimmed.startsWith('W/') && !etag.startsWith('W/') && trimmed === etag
  })

const preconditionStatus = (request: Request, headers: Headers): 304 | 412 | undefined => {
  const etag = headers.get('etag')
  const lastModified = headers.get('last-modified')
  const ifMatch = request.headers.get('if-match')
  if (ifMatch && (!etag || !etagMatches(ifMatch, etag, false))) return 412

  const ifUnmodifiedSince = request.headers.get('if-unmodified-since')
  if (!ifMatch && ifUnmodifiedSince && lastModified) {
    const conditionTime = Date.parse(ifUnmodifiedSince)
    const modifiedTime = Date.parse(lastModified)
    if (
      Number.isFinite(conditionTime) &&
      Number.isFinite(modifiedTime) &&
      modifiedTime > conditionTime
    ) {
      return 412
    }
  }

  const ifNoneMatch = request.headers.get('if-none-match')
  if (ifNoneMatch && etag && etagMatches(ifNoneMatch, etag, true)) {
    return request.method === 'GET' || request.method === 'HEAD' ? 304 : 412
  }

  const ifModifiedSince = request.headers.get('if-modified-since')
  if (
    !ifNoneMatch &&
    (request.method === 'GET' || request.method === 'HEAD') &&
    ifModifiedSince &&
    lastModified
  ) {
    const conditionTime = Date.parse(ifModifiedSince)
    const modifiedTime = Date.parse(lastModified)
    if (
      Number.isFinite(conditionTime) &&
      Number.isFinite(modifiedTime) &&
      modifiedTime <= conditionTime
    ) {
      return 304
    }
  }
  return undefined
}

const isInvalidRangeError = (cause: unknown): boolean =>
  cause instanceof Error && cause.name === 'InvalidRange'

const artifactCacheRequest = (request: Request, options: { includeRange: boolean }): Request => {
  const url = new URL(request.url)
  const sha256 = url.searchParams.get('sha256')
  url.search = ''
  if (sha256) url.searchParams.set('sha256', sha256)
  const headers = new Headers()
  if (options.includeRange) {
    const range = request.headers.get('range')
    if (range) headers.set('range', range)
  }
  return new Request(url, { method: 'GET', headers })
}

const ifRangeMatches = (validator: string, headers: Headers): boolean => {
  if (validator.startsWith('W/')) return false
  if (validator.startsWith('"')) {
    const etag = headers.get('etag')
    return !!etag && !etag.startsWith('W/') && validator === etag
  }
  return validator === headers.get('last-modified')
}

const artifactResponseForClient = (
  response: Response,
  request: Request,
  cacheStatus?: 'HIT' | 'MISS'
): Response => {
  const headers = new Headers(response.headers)
  headers.set('cache-control', 'private, no-store')
  headers.set(
    'x-request-id',
    resourceRequestIdFrom(request.headers.get('x-request-id') ?? undefined)
  )
  if (cacheStatus) headers.set('x-resource-cache', cacheStatus)
  if (response.status === 304 || response.status === 412) headers.delete('content-length')
  const body =
    request.method === 'HEAD' || response.status === 304 || response.status === 412
      ? null
      : response.body
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

const artifactResponseForCache = (response: Response): Response => {
  const headers = new Headers(response.headers)
  headers.set('cache-control', 'public, max-age=31536000, immutable')
  headers.delete('x-request-id')
  headers.delete('x-resource-cache')
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

export const routeR2ArtifactRequest = async ({
  request,
  bucket,
  authorize,
  cache,
  waitUntil = () => undefined,
  reportCacheFailure = () => undefined,
}: {
  request: Request
  bucket: R2ArtifactBucket
  authorize: ArtifactRequestAuthorizer
  cache?: ArtifactEdgeCache
  waitUntil?: (promise: Promise<unknown>) => void
  reportCacheFailure?: (operation: 'match' | 'put', cause: unknown) => void
}): Promise<Response | undefined> => {
  const url = new URL(request.url)
  const pathname = url.pathname
  if (pathname === MOBILE_RESOURCE_CATALOG_ROUTE) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response(null, { status: 405, headers: { allow: 'GET, HEAD' } })
    }
    const cacheKey = cache ? await mobileResourceCatalogCacheRequest(request) : undefined
    if (cache && cacheKey) {
      try {
        const hit = await cache.match(cacheKey)
        if (hit) return mobileResourceCatalogResponseForClient(hit, request, 'HIT')
      } catch (cause) {
        reportCacheFailure('match', cause)
      }
    }
    const response = await mobileResourceCatalogResponse()
    if (cache && cacheKey) {
      waitUntil(
        cache.put(cacheKey, response.clone()).catch(cause => {
          reportCacheFailure('put', cause)
        })
      )
    }
    return mobileResourceCatalogResponseForClient(response, request, cache ? 'MISS' : undefined)
  }
  if (!pathname.startsWith(R2_ARTIFACT_ROUTE_PREFIX)) return undefined

  const key = r2KeyForRequest(url)
  if (!key) return artifactResponseForClient(new Response(null, { status: 404 }), request)
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return artifactResponseForClient(
      new Response(null, { status: 405, headers: { allow: 'GET, HEAD' } }),
      request
    )
  }
  if (!(await authorize(request))) {
    return artifactResponseForClient(new Response(null, { status: 401 }), request)
  }

  if (cache) {
    try {
      const range = request.method === 'GET' ? request.headers.get('range') : undefined
      const complete = await cache.match(artifactCacheRequest(request, { includeRange: false }))
      if (complete) {
        const conditionalStatus = preconditionStatus(request, complete.headers)
        if (conditionalStatus) {
          return artifactResponseForClient(
            new Response(null, { status: conditionalStatus, headers: complete.headers }),
            request,
            'HIT'
          )
        }
        const ifRange = range ? request.headers.get('if-range') : undefined
        if (!range || (ifRange && !ifRangeMatches(ifRange, complete.headers))) {
          return artifactResponseForClient(complete, request, 'HIT')
        }
        const partial = await cache.match(artifactCacheRequest(request, { includeRange: true }))
        if (partial) return artifactResponseForClient(partial, request, 'HIT')
      }
    } catch (cause) {
      reportCacheFailure('match', cause)
    }
  }

  if (request.method === 'HEAD') {
    const object = await bucket.head(key)
    const headers = object ? artifactHeaders(object) : undefined
    const conditionalStatus = headers ? preconditionStatus(request, headers) : undefined
    const response = object
      ? new Response(null, {
          status: conditionalStatus ?? 200,
          headers,
        })
      : new Response(null, { status: 404 })
    return artifactResponseForClient(response, request, cache ? 'MISS' : undefined)
  }

  const r2RequestHeaders = new Headers(request.headers)
  const ifRange = r2RequestHeaders.has('range') ? r2RequestHeaders.get('if-range') : undefined
  if (ifRange) {
    const current = await bucket.head(key)
    if (!current) {
      return artifactResponseForClient(
        new Response(null, { status: 404 }),
        request,
        cache ? 'MISS' : undefined
      )
    }
    if (!ifRangeMatches(ifRange, artifactHeaders(current))) {
      r2RequestHeaders.delete('range')
    }
    r2RequestHeaders.delete('if-range')
  }
  let object: Awaited<ReturnType<R2ArtifactBucket['get']>>
  try {
    object = await bucket.get(key, {
      onlyIf: r2RequestHeaders,
      range: r2RequestHeaders,
    })
  } catch (cause) {
    if (!isInvalidRangeError(cause)) throw cause
    const current = await bucket.head(key)
    if (!current) {
      return artifactResponseForClient(
        new Response(null, { status: 404 }),
        request,
        cache ? 'MISS' : undefined
      )
    }
    const headers = artifactHeaders(current)
    headers.set('content-range', `bytes */${current.size}`)
    headers.delete('content-length')
    return artifactResponseForClient(
      new Response(null, { status: 416, headers }),
      request,
      cache ? 'MISS' : undefined
    )
  }
  if (!object) {
    return artifactResponseForClient(
      new Response(null, { status: 404 }),
      request,
      cache ? 'MISS' : undefined
    )
  }
  const headers = artifactHeaders(object)
  if (!('body' in object)) {
    return artifactResponseForClient(
      new Response(null, { status: preconditionStatus(request, headers) ?? 412, headers }),
      request,
      cache ? 'MISS' : undefined
    )
  }
  const response = new Response(object.body, {
    status: object.range ? 206 : 200,
    headers,
  })
  if (cache && response.status === 200) {
    const keyRequest = artifactCacheRequest(request, { includeRange: false })
    const cacheResponse = artifactResponseForCache(response.clone())
    waitUntil(
      cache.put(keyRequest, cacheResponse).catch(cause => {
        reportCacheFailure('put', cause)
      })
    )
  }
  return artifactResponseForClient(response, request, cache ? 'MISS' : undefined)
}
