import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'

import {
  assertCatalogMatchesOfflineArtifact,
  publishR2PublicationCatalog,
  publishR2PublicationBundle,
  type R2ArtifactStore,
} from '../r2ArtifactPublisher'
import type { MobileResourceCatalogEntry } from '../mobileResourceCatalog'
import type { StrongLexiconPublicationBundleManifest } from '../publicationBundle'
import { writeStrongPublicationFixture } from './strongPublicationFixture'

const writeMobileCatalog = async (
  catalogPath: string,
  entries: Record<
    string,
    {
      file: string
      archiveSha256: string
      archiveBytes: number
      contentSha256: string
      entry?: string
    }
  >
) =>
  writeFile(
    catalogPath,
    `${JSON.stringify({
      format: 'bible-strong-mobile-resource-catalog',
      schemaVersion: 1,
      resourceCount: Object.keys(entries).length,
      resources: Object.fromEntries(
        Object.entries(entries).map(([id, entry]) => [
          id,
          {
            id,
            ...entry,
            entry: entry.entry ?? 'bible-lsg-strong.sqlite',
            entries: {
              canonical: {
                entry: entry.entry ?? 'bible-lsg-strong.sqlite',
                sha256: entry.contentSha256,
                bytes: 1,
              },
            },
          },
        ])
      ),
    })}\n`
  )

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

const strongLexiconManifest = (
  moduleId: 'core' | 'entities',
  revision: string,
  coreRevision?: string
): StrongLexiconPublicationBundleManifest => ({
  format: 'bible-strong-resource-publication',
  schemaVersion: 1,
  identity: {
    kind: 'strong-lexicon-module',
    moduleId,
    resourceId: `strong-lexicon:${moduleId}`,
    language: 'mul',
  },
  revision,
  canonical: {
    path: `canonical/${moduleId}.json`,
    mediaType: 'application/json',
    schemaVersion: 1,
    sha256: '1'.repeat(64),
    bytes: 1,
  },
  offlineArtifact: {
    path: `offline/${moduleId}.sqlite.zip`,
    mediaType: 'application/zip',
    entry: moduleId === 'core' ? 'strong_lexicon.core.sqlite' : 'bible_entities.production.sqlite',
    sha256: '2'.repeat(64),
    bytes: 2,
    contentSha256: '3'.repeat(64),
  },
  provenance: {
    generator: 'bible-lexicon-maker',
    sourceVersion: 'fixture',
    sourceSha256: '4'.repeat(64),
    generatedAt: '2026-08-19T00:00:00.000Z',
  },
  rights: {
    holder: 'fixture',
    termsReference: 'fixture',
    attribution: 'fixture',
    online: true,
    offline: true,
  },
  deliveryCapabilities: {
    onlineAccess: true,
    offlineDownload: true,
    localDevelopmentAccess: true,
  },
  dependencies:
    moduleId === 'core'
      ? []
      : [
          {
            resourceIdentity: 'strong-lexicon:core',
            revision: coreRevision ?? 'missing-core-revision',
          },
        ],
  counts: {},
})

const strongLexiconCatalogEntry = (
  manifest: StrongLexiconPublicationBundleManifest,
  resourceRevision = manifest.revision,
  coreRevision?: string
): MobileResourceCatalogEntry => {
  const entry = manifest.offlineArtifact.entry
  return {
    id: manifest.identity.resourceId,
    file: 'databases/module.sqlite.zip',
    entry,
    entries: {
      canonical: {
        entry,
        sha256: '3'.repeat(64),
        bytes: 1,
      },
    },
    archiveSha256: '2'.repeat(64),
    archiveBytes: 2,
    contentSha256: '3'.repeat(64),
    resourceRevision,
    coreRevision,
  }
}

describe('R2 artifact publisher', () => {
  it('rejects Strong lexicon resource and core revision drift', () => {
    const coreManifest = strongLexiconManifest('core', 'core-r1')
    assert.doesNotThrow(() =>
      assertCatalogMatchesOfflineArtifact(
        coreManifest,
        strongLexiconCatalogEntry(coreManifest),
        'strong-lexicon:core'
      )
    )
    assert.throws(
      () =>
        assertCatalogMatchesOfflineArtifact(
          coreManifest,
          strongLexiconCatalogEntry(coreManifest, 'core-r2'),
          'strong-lexicon:core'
        ),
      /R2_PUBLICATION_CATALOG_INTEGRITY_MISMATCH:strong-lexicon:core/
    )

    const entitiesManifest = strongLexiconManifest('entities', 'entities-r1', 'core-r1')
    assert.throws(
      () =>
        assertCatalogMatchesOfflineArtifact(
          entitiesManifest,
          strongLexiconCatalogEntry(entitiesManifest, 'entities-r1', 'core-r2'),
          'strong-lexicon:entities'
        ),
      /R2_PUBLICATION_CATALOG_INTEGRITY_MISMATCH:strong-lexicon:entities/
    )
  })

  it('publishes a validated Offline-copy artifact and its integrity metadata', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'r2-artifact-publication-'))
    const store = new MemoryR2ArtifactStore()

    try {
      const { manifest } = await writeStrongPublicationFixture(root)
      const result = await publishR2PublicationBundle(
        root,
        'bibles/bible-lsg-strong.sqlite.zip',
        store
      )

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
        assert.deepEqual(
          await publishR2PublicationBundle(root, 'bibles/bible-lsg-strong.sqlite.zip', store),
          {
            status: 'skipped',
            resourceIdentity: 'strong-bible-index:LSG',
            revision: manifest.revision,
            reason: 'offline-download-not-authorized',
          }
        )
      })
      assert.deepEqual(store.puts, [])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('rejects an Offline-copy-unauthorized exhaustive catalog before writing', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'r2-artifact-catalog-rights-'))
    const store = new MemoryR2ArtifactStore()

    try {
      const bundle = path.join(root, 'bundle')
      const { manifest } = await writeStrongPublicationFixture(bundle, { offlineAccess: false })
      const catalogPath = path.join(root, 'mobile-resource-catalog.json')
      await writeMobileCatalog(catalogPath, {
        'bible-strong:LSG': {
          file: 'bibles/bible-lsg-strong.sqlite.zip',
          archiveSha256: manifest.offlineArtifact.sha256,
          archiveBytes: manifest.offlineArtifact.bytes,
          contentSha256: manifest.offlineArtifact.contentSha256,
        },
      })

      await assert.rejects(
        publishR2PublicationCatalog([bundle], catalogPath, store),
        /R2_PUBLICATION_CATALOG_OFFLINE_NOT_AUTHORIZED:bible-strong:LSG/
      )
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
      await publishR2PublicationBundle(root, 'bibles/bible-lsg-strong.sqlite.zip', store)
      const putCount = store.puts.length

      assert.deepEqual(
        await publishR2PublicationBundle(root, 'bibles/bible-lsg-strong.sqlite.zip', store),
        {
          status: 'unchanged',
          resourceIdentity: 'strong-bible-index:LSG',
          revision: manifest.revision,
          key: 'bibles/bible-lsg-strong.sqlite.zip',
          bytes: manifest.offlineArtifact.bytes,
          sha256: manifest.offlineArtifact.sha256,
        }
      )
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
      const { manifest } = await writeStrongPublicationFixture(validBundle)
      await writeStrongPublicationFixture(invalidBundle)
      await writeFile(path.join(invalidBundle, 'offline/bible-lsg-strong.sqlite.zip'), 'corrupt')
      const catalogPath = path.join(root, 'mobile-resource-catalog.json')
      await writeMobileCatalog(catalogPath, {
        'bible-strong:LSG': {
          file: 'bibles/bible-lsg-strong.sqlite.zip',
          archiveSha256: manifest.offlineArtifact.sha256,
          archiveBytes: manifest.offlineArtifact.bytes,
          contentSha256: manifest.offlineArtifact.contentSha256,
        },
      })

      await assert.rejects(
        publishR2PublicationCatalog([validBundle, invalidBundle], catalogPath, store),
        /OFFLINE_ARTIFACT_(SIZE|SHA256)_MISMATCH/
      )
      assert.deepEqual(store.puts, [])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('publishes to the stable path declared by the exhaustive mobile catalog', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'r2-artifact-stable-path-'))
    const store = new MemoryR2ArtifactStore()

    try {
      const bundle = path.join(root, 'bundle')
      const { manifest } = await writeStrongPublicationFixture(bundle)
      const catalogPath = path.join(root, 'mobile-resource-catalog.json')
      await writeMobileCatalog(catalogPath, {
        'bible-strong:LSG': {
          file: 'canonical/bible-lsg-strong.sqlite.zip',
          archiveSha256: manifest.offlineArtifact.sha256,
          archiveBytes: manifest.offlineArtifact.bytes,
          contentSha256: manifest.offlineArtifact.contentSha256,
        },
      })

      const [result] = await publishR2PublicationCatalog([bundle], catalogPath, store)

      assert.equal(result?.status, 'uploaded')
      assert.equal(
        result?.status === 'uploaded' ? result.key : undefined,
        'canonical/bible-lsg-strong.sqlite.zip'
      )
      assert.ok(store.objects.has('canonical/bible-lsg-strong.sqlite.zip'))
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('rejects a catalog whose artifact integrity differs from its publication bundle', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'r2-artifact-catalog-integrity-'))
    const store = new MemoryR2ArtifactStore()

    try {
      const bundle = path.join(root, 'bundle')
      const { manifest } = await writeStrongPublicationFixture(bundle)
      const catalogPath = path.join(root, 'mobile-resource-catalog.json')
      await writeMobileCatalog(catalogPath, {
        'bible-strong:LSG': {
          file: 'bibles/bible-lsg-strong.sqlite.zip',
          archiveSha256: '0'.repeat(64),
          archiveBytes: manifest.offlineArtifact.bytes,
          contentSha256: manifest.offlineArtifact.contentSha256,
        },
      })

      await assert.rejects(
        publishR2PublicationCatalog([bundle], catalogPath, store),
        /R2_PUBLICATION_CATALOG_INTEGRITY_MISMATCH:bible-strong:LSG/
      )
      assert.deepEqual(store.puts, [])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('rejects duplicate identities and an incomplete mobile catalog before writing', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'r2-artifact-exhaustive-'))
    const store = new MemoryR2ArtifactStore()

    try {
      const firstBundle = path.join(root, 'first')
      const secondBundle = path.join(root, 'second')
      const { manifest } = await writeStrongPublicationFixture(firstBundle)
      await writeStrongPublicationFixture(secondBundle)
      const catalogPath = path.join(root, 'mobile-resource-catalog.json')
      await writeMobileCatalog(catalogPath, {
        'bible-strong:LSG': {
          file: 'bibles/bible-lsg-strong.sqlite.zip',
          archiveSha256: manifest.offlineArtifact.sha256,
          archiveBytes: manifest.offlineArtifact.bytes,
          contentSha256: manifest.offlineArtifact.contentSha256,
        },
      })

      await assert.rejects(
        publishR2PublicationCatalog([firstBundle, secondBundle], catalogPath, store),
        /R2_PUBLICATION_CATALOG_DUPLICATE_RESOURCE:bible-strong:LSG/
      )
      assert.deepEqual(store.puts, [])

      await assert.rejects(
        publishR2PublicationCatalog([firstBundle], catalogPath, store, {
          expectedCatalogResourceCount: 72,
        }),
        /R2_PUBLICATION_CATALOG_EXPECTED_COUNT_MISMATCH:1:72/
      )
      assert.deepEqual(store.puts, [])

      await writeMobileCatalog(catalogPath, {
        'bible-strong:LSG': {
          file: 'bibles/bible-lsg-strong.sqlite.zip',
          archiveSha256: manifest.offlineArtifact.sha256,
          archiveBytes: manifest.offlineArtifact.bytes,
          contentSha256: manifest.offlineArtifact.contentSha256,
        },
        'bible:EXTRA': {
          file: 'bibles/extra.zip',
          archiveSha256: '0'.repeat(64),
          archiveBytes: 1,
          contentSha256: '1'.repeat(64),
        },
      })
      await assert.rejects(
        publishR2PublicationCatalog([firstBundle], catalogPath, store),
        /R2_PUBLICATION_CATALOG_INCOMPLETE:bible:EXTRA/
      )
      assert.deepEqual(store.puts, [])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
