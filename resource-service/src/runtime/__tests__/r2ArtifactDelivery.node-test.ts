import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  R2_ARTIFACT_ROUTE_PREFIX,
  routeR2ArtifactRequest,
  type ArtifactRange,
  type R2ArtifactBucket,
} from '../r2ArtifactDelivery'

const artifactKey = 'bibles/bible-lsg.json.zip'

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
  range,
  writeHttpMetadata(headers: Headers) {
    headers.set('content-type', 'application/zip')
  },
})

const makeBucket = (object = makeObject()) => {
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

describe('R2 artifact delivery', () => {
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

    const response = await routeR2ArtifactRequest({
      request: artifactRequest(),
      bucket,
      authorize: async () => false,
    })

    assert.equal(response?.status, 401)
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
