import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'

import { strToU8, zipSync } from 'fflate'

import {
  countCanonicalContent,
  decodePublicationBundleManifest,
  validatePublicationBundle,
  type BiblePublicationBundleManifest,
  type CanonicalBiblePublication,
} from '../publicationBundle'

const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex')
const canonicalVerse = {
  text: 'Au commencement',
  startTags: [],
  layout: [],
  notes: [],
  headings: [],
}
const canonicalTextSha256 = sha256(`${JSON.stringify([1, 1, 1, canonicalVerse])}\n`)
const canonicalTextRevision = `lsg-${canonicalTextSha256.slice(0, 20)}`

const makeManifest = (overrides: Partial<BiblePublicationBundleManifest> = {}) =>
  ({
    format: 'bible-strong-resource-publication',
    schemaVersion: 1,
    identity: { kind: 'bible-text', versionId: 'LSG', language: 'fr' },
    revision: canonicalTextRevision,
    canonical: {
      path: 'canonical/bible-lsg.json',
      mediaType: 'application/json',
      schemaVersion: 4,
      sha256: '0'.repeat(64),
      bytes: 1,
    },
    offlineArtifact: {
      path: 'offline/bible-lsg.json.zip',
      mediaType: 'application/zip',
      entry: 'bible-lsg.json',
      sha256: '1'.repeat(64),
      bytes: 1,
      contentSha256: '0'.repeat(64),
    },
    provenance: {
      generator: 'bible-lexicon-maker',
      sourceVersion: 'SG1910',
      sourceSha256: '2'.repeat(64),
      generatedAt: '2026-08-16T00:00:00.000Z',
    },
    rights: {
      holder: 'Public domain',
      termsReference: 'Segond 1910',
      attribution: 'Louis Segond',
      online: true,
      offline: true,
    },
    deliveryCapabilities: { onlineAccess: true, offlineDownload: true },
    canon: { id: 'protestant-66', orderedBooks: [1] },
    versification: 'kjv',
    coverage: { chaptersByBook: { 1: [1] }, verseCountByBookChapter: { '1-1': 1 } },
    counts: { books: 1, chapters: 1, verses: 1, notes: 0, headings: 0 },
    ...overrides,
  }) satisfies BiblePublicationBundleManifest

describe('Resource publication bundle', () => {
  it('rejects malformed editorial presentation before import', () => {
    const canonical = {
      format: 'bible-strong-canonical-bible',
      schemaVersion: 4,
      applicationVersionId: 'LSG',
      textRevision: canonicalTextRevision,
      textSha256: canonicalTextSha256,
      sourceVersion: 'SG1910',
      sourceSha256: '2'.repeat(64),
      verseCount: 1,
      noteCount: 0,
      headingCount: 0,
      verses: {
        1: {
          1: {
            1: {
              text: 'Au commencement',
              startTags: 'invalid',
              layout: [],
              notes: [],
              headings: [],
            },
          },
        },
      },
    } as unknown as CanonicalBiblePublication

    assert.throws(() => countCanonicalContent(canonical), /CANONICAL_VERSE_INVALID/)
  })

  it('decodes the versioned manifest as the handoff source of truth', () => {
    const manifest = makeManifest()

    assert.deepEqual(decodePublicationBundleManifest(manifest), manifest)
    assert.throws(
      () =>
        decodePublicationBundleManifest({
          ...manifest,
          publicationRevision: 'lsg-arbitrary-publication',
        }),
      /PUBLICATION_BUNDLE_REVISION_INVALID/
    )
  })

  it('rejects unknown bundle schema versions and unsafe artifact paths', () => {
    assert.throws(
      () => decodePublicationBundleManifest({ ...makeManifest(), schemaVersion: 2 }),
      /PUBLICATION_BUNDLE_MANIFEST_INVALID/
    )
    assert.throws(
      () =>
        decodePublicationBundleManifest({
          ...makeManifest(),
          canonical: { ...makeManifest().canonical, path: '../private.json' },
        }),
      /PUBLICATION_BUNDLE_PATH_INVALID/
    )
  })

  it('validates canonical counts, revision, and both artifact checksums from an explicit path', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'resource-publication-'))
    const canonical = `${JSON.stringify({
      format: 'bible-strong-canonical-bible',
      schemaVersion: 4,
      applicationVersionId: 'LSG',
      textRevision: canonicalTextRevision,
      textSha256: canonicalTextSha256,
      sourceVersion: 'SG1910',
      sourceSha256: '2'.repeat(64),
      verseCount: 1,
      noteCount: 0,
      headingCount: 0,
      verses: {
        1: {
          1: { 1: { text: 'Au commencement', startTags: [], layout: [], notes: [], headings: [] } },
        },
      },
    })}\n`
    const offline = Buffer.from(zipSync({ 'bible-lsg.json': strToU8(canonical) }))

    try {
      await mkdir(path.join(root, 'canonical'), { recursive: true })
      await mkdir(path.join(root, 'offline'), { recursive: true })
      await writeFile(path.join(root, 'canonical/bible-lsg.json'), canonical)
      await writeFile(path.join(root, 'offline/bible-lsg.json.zip'), offline)
      const manifest = makeManifest({
        canonical: {
          ...makeManifest().canonical,
          sha256: sha256(canonical),
          bytes: Buffer.byteLength(canonical),
        },
        offlineArtifact: {
          ...makeManifest().offlineArtifact,
          sha256: sha256(offline),
          bytes: offline.byteLength,
          contentSha256: sha256(canonical),
        },
      })
      await writeFile(path.join(root, 'manifest.json'), `${JSON.stringify(manifest)}\n`)

      const validated = await validatePublicationBundle(root)

      assert.equal(validated.manifest.revision, canonicalTextRevision)
      assert.equal(validated.canonical.format, 'bible-strong-canonical-bible')
      if (validated.canonical.format !== 'bible-strong-canonical-bible') {
        assert.fail('Expected a Bible canonical publication')
      }
      assert.equal(validated.canonical.verses['1']?.['1']?.['1']?.text, 'Au commencement')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('rejects an archive whose declared entry does not contain the canonical artifact', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'resource-publication-'))
    const canonical = '{}\n'
    const offline = Buffer.from(zipSync({ 'another.json': strToU8(canonical) }))

    try {
      await mkdir(path.join(root, 'canonical'), { recursive: true })
      await mkdir(path.join(root, 'offline'), { recursive: true })
      await writeFile(path.join(root, 'canonical/bible-lsg.json'), canonical)
      await writeFile(path.join(root, 'offline/bible-lsg.json.zip'), offline)
      const manifest = makeManifest({
        canonical: {
          ...makeManifest().canonical,
          sha256: sha256(canonical),
          bytes: Buffer.byteLength(canonical),
        },
        offlineArtifact: {
          ...makeManifest().offlineArtifact,
          sha256: sha256(offline),
          bytes: offline.byteLength,
          contentSha256: sha256(canonical),
        },
      })
      await writeFile(path.join(root, 'manifest.json'), `${JSON.stringify(manifest)}\n`)

      await assert.rejects(validatePublicationBundle(root), /OFFLINE_ARTIFACT_INVALID/)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('rejects a bundle that declares a delivery mode forbidden by its rights', () => {
    assert.throws(
      () =>
        decodePublicationBundleManifest({
          ...makeManifest(),
          rights: { ...makeManifest().rights, online: false },
        }),
      /PUBLICATION_BUNDLE_RIGHTS_MISMATCH/
    )
  })

  it('allows independent online-only and download-only delivery declarations', () => {
    const onlineOnly = makeManifest({
      rights: { ...makeManifest().rights, offline: false },
      deliveryCapabilities: { onlineAccess: true, offlineDownload: false },
    })
    const downloadOnly = makeManifest({
      rights: { ...makeManifest().rights, online: false },
      deliveryCapabilities: { onlineAccess: false, offlineDownload: true },
    })
    assert.deepEqual(decodePublicationBundleManifest(onlineOnly), onlineOnly)
    assert.deepEqual(decodePublicationBundleManifest(downloadOnly), downloadOnly)
  })

  it('allows a validated publication to remain inactive for both delivery modes', () => {
    const inactive = makeManifest({
      rights: { ...makeManifest().rights, online: false, offline: false },
      deliveryCapabilities: { onlineAccess: false, offlineDownload: false },
    })
    assert.deepEqual(decodePublicationBundleManifest(inactive), inactive)
  })

  it('rejects declared canon coverage that differs from canonical content', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'resource-publication-'))
    const canonical = `${JSON.stringify({
      format: 'bible-strong-canonical-bible',
      schemaVersion: 4,
      applicationVersionId: 'LSG',
      textRevision: canonicalTextRevision,
      textSha256: canonicalTextSha256,
      sourceVersion: 'SG1910',
      sourceSha256: '2'.repeat(64),
      verseCount: 1,
      noteCount: 0,
      headingCount: 0,
      verses: {
        1: {
          1: { 1: { text: 'Au commencement', startTags: [], layout: [], notes: [], headings: [] } },
        },
      },
    })}\n`
    const offline = Buffer.from(zipSync({ 'bible-lsg.json': strToU8(canonical) }))
    try {
      await mkdir(path.join(root, 'canonical'), { recursive: true })
      await mkdir(path.join(root, 'offline'), { recursive: true })
      await writeFile(path.join(root, 'canonical/bible-lsg.json'), canonical)
      await writeFile(path.join(root, 'offline/bible-lsg.json.zip'), offline)
      const manifest = makeManifest({
        canonical: {
          ...makeManifest().canonical,
          sha256: sha256(canonical),
          bytes: Buffer.byteLength(canonical),
        },
        offlineArtifact: {
          ...makeManifest().offlineArtifact,
          sha256: sha256(offline),
          bytes: offline.byteLength,
          contentSha256: sha256(canonical),
        },
        canon: { id: 'protestant-66', orderedBooks: [2] },
      })
      await writeFile(path.join(root, 'manifest.json'), `${JSON.stringify(manifest)}\n`)
      await assert.rejects(validatePublicationBundle(root), /PUBLICATION_BUNDLE_COVERAGE_MISMATCH/)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
