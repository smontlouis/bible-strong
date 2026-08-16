import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { PublicationBundleManifest } from '../../publication/publicationBundle'
import { createDevelopmentArtifact, respondWithDevelopmentArtifact } from '../developmentArtifacts'

const manifest = {
  identity: { kind: 'bible-text', versionId: 'LSG', language: 'fr' },
  revision: 'lsg-r1',
  offlineArtifact: {
    path: 'offline/bible-lsg.json.zip',
    mediaType: 'application/zip',
    sha256: 'a'.repeat(64),
  },
  deliveryCapabilities: { offlineDownload: true },
} as PublicationBundleManifest

describe('development artifact server', () => {
  it('serves the bundle bytes at the mobile catalog path with integrity headers', async () => {
    const bytes = Buffer.from('immutable LSG bundle')
    const artifact = createDevelopmentArtifact(manifest, bytes)
    const response = respondWithDevelopmentArtifact(
      new Request('http://10.0.2.2:8788/bibles/bible-lsg.json.zip'),
      artifact
    )

    assert.equal(artifact.route, '/bibles/bible-lsg.json.zip')
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('x-goog-generation'), 'lsg-r1')
    assert.match(response.headers.get('x-goog-hash') ?? '', /^md5=/)
    assert.equal(response.headers.get('etag'), 'a'.repeat(64))
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes)
  })

  it('supports metadata checks and rejects other routes or methods', async () => {
    const artifact = createDevelopmentArtifact(manifest, Buffer.from('bundle'))
    const head = respondWithDevelopmentArtifact(
      new Request('http://localhost/bibles/bible-lsg.json.zip', { method: 'HEAD' }),
      artifact
    )
    assert.equal(head.status, 200)
    assert.equal((await head.arrayBuffer()).byteLength, 0)
    assert.equal(
      respondWithDevelopmentArtifact(new Request('http://localhost/other.zip'), artifact).status,
      404
    )
    assert.equal(
      respondWithDevelopmentArtifact(
        new Request('http://localhost/bibles/bible-lsg.json.zip', { method: 'POST' }),
        artifact
      ).status,
      405
    )
  })
})
