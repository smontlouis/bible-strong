import mobileResourceCatalog from '../../../src/assets/mobile-resource-catalog.json'

export const R2_ARTIFACT_ROUTE_PREFIX = '/v1/offline-artifacts/'

export type ArtifactRange =
  | { offset: number; length?: number }
  | { offset?: number; length: number }
  | { suffix: number }

type R2ArtifactObject = {
  readonly size: number
  readonly httpEtag: string
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

const mobileArtifactKeys = new Set(
  Object.values(mobileResourceCatalog.resources).map(resource => resource.file)
)

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

const failedPreconditionStatus = (request: Request): number =>
  request.headers.has('if-none-match') ? 304 : 412

export const routeR2ArtifactRequest = async ({
  request,
  bucket,
  authorize,
}: {
  request: Request
  bucket: R2ArtifactBucket
  authorize: ArtifactRequestAuthorizer
}): Promise<Response | undefined> => {
  const pathname = new URL(request.url).pathname
  if (!pathname.startsWith(R2_ARTIFACT_ROUTE_PREFIX)) return undefined

  const key = pathname.slice(R2_ARTIFACT_ROUTE_PREFIX.length)
  if (!mobileArtifactKeys.has(key)) return new Response(null, { status: 404 })
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response(null, { status: 405, headers: { allow: 'GET, HEAD' } })
  }
  if (!(await authorize(request))) return new Response(null, { status: 401 })

  if (request.method === 'HEAD') {
    const object = await bucket.head(key)
    return object
      ? new Response(null, { status: 200, headers: artifactHeaders(object) })
      : new Response(null, { status: 404 })
  }

  const object = await bucket.get(key, {
    onlyIf: request.headers,
    range: request.headers,
  })
  if (!object) return new Response(null, { status: 404 })
  const headers = artifactHeaders(object)
  if (!('body' in object)) {
    return new Response(null, { status: failedPreconditionStatus(request), headers })
  }
  return new Response(object.body, {
    status: object.range ? 206 : 200,
    headers,
  })
}
