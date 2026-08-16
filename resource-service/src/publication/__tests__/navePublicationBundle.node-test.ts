import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'

import { strToU8, zipSync } from 'fflate'

import {
  decodePublicationBundleManifest,
  validatePublicationBundle,
  type CanonicalNavePublication,
  type NavePublicationBundleManifest,
} from '../publicationBundle'
import { makeNaveSqliteFixture } from './naveSqliteFixture'

const sha256 = (value: string | Buffer | Uint8Array) =>
  createHash('sha256').update(value).digest('hex')

const makeCanonicalNave = (
  canonicalOverrides: Partial<CanonicalNavePublication> = {}
): CanonicalNavePublication => {
  const sourceSha256 = '2'.repeat(64)
  return {
    format: 'bible-strong-canonical-nave',
    schemaVersion: 1,
    resourceId: 'NAVE_FR',
    revision: 'nave-fr-test-revision',
    sourceVersion: 'nave-fr-test-source',
    sourceSha256,
    topics: [
      {
        normalizedName: 'amour',
        name: 'Amour',
        initial: 'a',
        description: '<p>Aimer Dieu.</p>',
      },
      {
        normalizedName: 'bapteme',
        name: 'Baptême',
        initial: 'b',
        description: '<p>Le baptême.</p>',
      },
    ],
    verseAnchors: [
      { verseKey: '43-3-16', topicNormalizedNames: ['amour'] },
      { verseKey: '40-3', topicNormalizedNames: ['bapteme'] },
    ],
    ...canonicalOverrides,
  }
}

const writeNaveBundle = async (
  root: string,
  canonicalOverrides: Partial<CanonicalNavePublication> = {},
  offlineContent?: Uint8Array
) => {
  const sourceSha256 = '2'.repeat(64)
  const canonicalValue = makeCanonicalNave(canonicalOverrides)
  const canonical = `${JSON.stringify(canonicalValue)}\n`
  const resolvedOfflineContent = offlineContent ?? (await makeNaveSqliteFixture(canonicalValue))
  const offline = Buffer.from(zipSync({ 'nave-fr.sqlite': resolvedOfflineContent }))

  await mkdir(path.join(root, 'canonical'), { recursive: true })
  await mkdir(path.join(root, 'offline'), { recursive: true })
  await writeFile(path.join(root, 'canonical/nave-fr.json'), canonical)
  await writeFile(path.join(root, 'offline/nave-fr.sqlite.zip'), offline)

  const manifest: NavePublicationBundleManifest = {
    format: 'bible-strong-resource-publication',
    schemaVersion: 1,
    identity: { kind: 'nave', resourceId: 'NAVE_FR', language: 'fr' },
    revision: canonicalValue.revision,
    canonical: {
      path: 'canonical/nave-fr.json',
      mediaType: 'application/json',
      schemaVersion: 1,
      sha256: sha256(canonical),
      bytes: Buffer.byteLength(canonical),
    },
    offlineArtifact: {
      path: 'offline/nave-fr.sqlite.zip',
      mediaType: 'application/zip',
      entry: 'nave-fr.sqlite',
      sha256: sha256(offline),
      bytes: offline.byteLength,
      contentSha256: sha256(resolvedOfflineContent),
    },
    provenance: {
      generator: 'bible-lexicon-maker',
      sourceVersion: canonicalValue.sourceVersion,
      sourceSha256,
      generatedAt: '2026-08-16T00:00:00.000Z',
    },
    rights: {
      holder: 'Public domain',
      termsReference: 'Nave topical Bible',
      attribution: 'Orville J. Nave; French editorial source',
      online: true,
      offline: true,
    },
    deliveryCapabilities: { onlineAccess: true, offlineDownload: true },
    alphabeticalBrowse: { initials: ['a', 'b'], topicCountByInitial: { a: 1, b: 1 } },
    counts: { topics: 2, verseAnchors: 2, topicReferences: 2 },
  }
  await writeFile(path.join(root, 'manifest.json'), `${JSON.stringify(manifest)}\n`)
  return manifest
}

describe('NAVE_FR publication bundle', () => {
  it('validates identity, alphabetical browsing, verse links, counts, rights, and Offline copy', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'nave-publication-'))
    try {
      const manifest = await writeNaveBundle(root)
      const validated = await validatePublicationBundle(root)

      assert.deepEqual(validated.manifest, manifest)
      assert.equal(validated.canonical.format, 'bible-strong-canonical-nave')
      if (validated.canonical.format !== 'bible-strong-canonical-nave') {
        assert.fail('Expected a Nave canonical publication')
      }
      assert.equal(validated.canonical.topics[0]?.normalizedName, 'amour')
      assert.deepEqual(validated.canonical.verseAnchors[1], {
        verseKey: '40-3',
        topicNormalizedNames: ['bapteme'],
      })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('rejects duplicate topic identities and dangling verse-topic links', async () => {
    const duplicateRoot = await mkdtemp(path.join(tmpdir(), 'nave-publication-'))
    const danglingRoot = await mkdtemp(path.join(tmpdir(), 'nave-publication-'))
    const invalidVerseRoot = await mkdtemp(path.join(tmpdir(), 'nave-publication-'))
    try {
      const validOfflineContent = await makeNaveSqliteFixture(makeCanonicalNave())
      await writeNaveBundle(
        duplicateRoot,
        {
          topics: [
            { normalizedName: 'amour', name: 'Amour', initial: 'a', description: 'Premier' },
            { normalizedName: 'amour', name: 'Amour bis', initial: 'a', description: 'Second' },
          ],
        },
        validOfflineContent
      )
      await writeNaveBundle(
        danglingRoot,
        {
          verseAnchors: [{ verseKey: '43-3-16', topicNormalizedNames: ['absent'] }],
        },
        validOfflineContent
      )
      await writeNaveBundle(
        invalidVerseRoot,
        {
          verseAnchors: [{ verseKey: '0-0-0', topicNormalizedNames: ['amour'] }],
        },
        validOfflineContent
      )

      await assert.rejects(
        validatePublicationBundle(duplicateRoot),
        /CANONICAL_NAVE_TOPIC_DUPLICATE/
      )
      await assert.rejects(validatePublicationBundle(danglingRoot), /CANONICAL_NAVE_LINK_INVALID/)
      await assert.rejects(
        validatePublicationBundle(invalidVerseRoot),
        /CANONICAL_NAVE_LINK_INVALID/
      )
    } finally {
      await Promise.all(
        [duplicateRoot, danglingRoot, invalidVerseRoot].map(directory =>
          rm(directory, { recursive: true, force: true })
        )
      )
    }
  })

  it('accepts only the NAVE_FR identity and a SQLite Offline copy', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'nave-publication-'))
    try {
      const manifest = await writeNaveBundle(root, {}, strToU8('not a sqlite database'))

      assert.throws(
        () =>
          decodePublicationBundleManifest({
            ...manifest,
            identity: { kind: 'nave', resourceId: 'NAVE_EN', language: 'en' },
          }),
        /PUBLICATION_BUNDLE_MANIFEST_INVALID/
      )
      await assert.rejects(validatePublicationBundle(root), /OFFLINE_ARTIFACT_FORMAT_INVALID/)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('rejects a valid SQLite Offline copy whose visible content differs from canonical', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'nave-publication-'))
    try {
      const mismatchedOffline = await makeNaveSqliteFixture(
        makeCanonicalNave({
          topics: [
            {
              normalizedName: 'different',
              name: 'Different',
              initial: 'd',
              description: '<p>Different.</p>',
            },
          ],
          verseAnchors: [],
        })
      )
      await writeNaveBundle(root, {}, mismatchedOffline)

      await assert.rejects(validatePublicationBundle(root), /OFFLINE_ARTIFACT_CONTENT_MISMATCH/)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
