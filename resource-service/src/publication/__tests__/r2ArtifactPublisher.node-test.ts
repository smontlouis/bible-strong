import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'

import {
  publishR2PublicationCatalog,
  publishR2PublicationBundle,
  type R2ArtifactStore,
} from '../r2ArtifactPublisher'
import { writeStrongPublicationFixture } from './strongPublicationFixture'

class MemoryR2ArtifactStore implements R2ArtifactStore {
  readonly objects = new Map<string, Buffer>()
  readonly puts: string[] = []

  async get(key: string) {
    return this.objects.get(key)
  }

  async putFile(key: string, filePath: string) {
    this.puts.push(key)
    this.objects.set(key, await readFile(filePath))
  }

  async putBytes(key: string, bytes: Buffer) {
    this.puts.push(key)
    this.objects.set(key, bytes)
  }
}

describe('R2 artifact publisher', () => {
  it('publishes a validated Offline-copy artifact and its integrity metadata', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'r2-artifact-publication-'))
    const store = new MemoryR2ArtifactStore()

    try {
      const { manifest } = await writeStrongPublicationFixture(root)
      const result = await publishR2PublicationBundle(root, store)

      assert.deepEqual(result, {
        status: 'uploaded',
        resourceIdentity: 'strong-bible-index:LSG',
        revision: manifest.revision,
        key: 'bibles/bible-lsg-strong.sqlite.zip',
        bytes: manifest.offlineArtifact.bytes,
        sha256: manifest.offlineArtifact.sha256,
      })
      assert.deepEqual(store.puts, [
        'bibles/bible-lsg-strong.sqlite.zip',
        'bibles/bible-lsg-strong.sqlite.zip.metadata.json',
      ])
      assert.equal(
        store.objects.get(result.key)?.toString('hex'),
        (await readFile(path.join(root, manifest.offlineArtifact.path))).toString('hex')
      )
      assert.deepEqual(
        JSON.parse(
          store.objects.get('bibles/bible-lsg-strong.sqlite.zip.metadata.json')!.toString('utf8')
        ),
        {
          format: 'bible-strong-r2-artifact-metadata',
          schemaVersion: 1,
          resourceIdentity: 'strong-bible-index:LSG',
          revision: manifest.revision,
          key: 'bibles/bible-lsg-strong.sqlite.zip',
          mediaType: 'application/zip',
          bytes: manifest.offlineArtifact.bytes,
          sha256: manifest.offlineArtifact.sha256,
          contentSha256: manifest.offlineArtifact.contentSha256,
          md5Base64: createHash('md5')
            .update(await readFile(path.join(root, manifest.offlineArtifact.path)))
            .digest('base64'),
        }
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('does not publish a bundle without Offline-copy distribution rights', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'r2-artifact-rights-'))
    const store = new MemoryR2ArtifactStore()

    try {
      const { manifest } = await writeStrongPublicationFixture(root, { offlineAccess: false })

      await assert.doesNotReject(async () => {
        assert.deepEqual(await publishR2PublicationBundle(root, store), {
          status: 'skipped',
          resourceIdentity: 'strong-bible-index:LSG',
          revision: manifest.revision,
          reason: 'offline-download-not-authorized',
        })
      })
      assert.deepEqual(store.puts, [])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('leaves an identical verified R2 publication unchanged', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'r2-artifact-idempotency-'))
    const store = new MemoryR2ArtifactStore()

    try {
      const { manifest } = await writeStrongPublicationFixture(root)
      await publishR2PublicationBundle(root, store)
      const putCount = store.puts.length

      assert.deepEqual(await publishR2PublicationBundle(root, store), {
        status: 'unchanged',
        resourceIdentity: 'strong-bible-index:LSG',
        revision: manifest.revision,
        key: 'bibles/bible-lsg-strong.sqlite.zip',
        bytes: manifest.offlineArtifact.bytes,
        sha256: manifest.offlineArtifact.sha256,
      })
      assert.equal(store.puts.length, putCount)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('validates the complete catalog before uploading any artifact', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'r2-artifact-catalog-'))
    const store = new MemoryR2ArtifactStore()

    try {
      const validBundle = path.join(root, 'valid')
      const invalidBundle = path.join(root, 'invalid')
      await writeStrongPublicationFixture(validBundle)
      await writeStrongPublicationFixture(invalidBundle)
      await writeFile(path.join(invalidBundle, 'offline/bible-lsg-strong.sqlite.zip'), 'corrupt')

      await assert.rejects(
        publishR2PublicationCatalog([validBundle, invalidBundle], store),
        /OFFLINE_ARTIFACT_(SIZE|SHA256)_MISMATCH/
      )
      assert.deepEqual(store.puts, [])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
