import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'

import {
  isStrongBiblePublicationBundleManifest,
  validatePublicationBundle,
} from '../publicationBundle'
import { writeStrongPublicationFixture } from './strongPublicationFixture'

describe('Strong Bible publication bundle', () => {
  it('validates canonical Strong identities, alignment, lexical references, and Offline-copy parity', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'strong-publication-'))
    try {
      await writeStrongPublicationFixture(root)

      const validated = await validatePublicationBundle(root)

      assert.ok(isStrongBiblePublicationBundleManifest(validated.manifest))
      assert.equal(validated.canonical.format, 'bible-strong-canonical-strong-index')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('rejects duplicate semantic Strong identities before PostgreSQL import', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'strong-publication-duplicate-'))
    try {
      await writeStrongPublicationFixture(root, { duplicateIdentityCode: true })

      await assert.rejects(
        validatePublicationBundle(root),
        /CANONICAL_STRONG_BIBLE_IDENTITY_DUPLICATE/
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('rejects a non-content-derived Resource revision', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'strong-publication-revision-'))
    try {
      await writeStrongPublicationFixture(root)
      const manifestPath = path.join(root, 'manifest.json')
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
      manifest.revision = 'lsg-strong-00000000000000000000'
      await writeFile(manifestPath, `${JSON.stringify(manifest)}\n`)
      await assert.rejects(validatePublicationBundle(root), /PUBLICATION_BUNDLE_IDENTITY_MISMATCH/)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('rejects zero verse identities and additional Offline entries', async () => {
    const zeroRoot = await mkdtemp(path.join(tmpdir(), 'strong-publication-zero-'))
    const zipRoot = await mkdtemp(path.join(tmpdir(), 'strong-publication-zip-'))
    try {
      await writeStrongPublicationFixture(zeroRoot, { zeroVerse: true })
      await assert.rejects(
        validatePublicationBundle(zeroRoot),
        /CANONICAL_STRONG_BIBLE_VERSE_INVALID/
      )
      await writeStrongPublicationFixture(zipRoot, { extraOfflineEntry: true })
      await assert.rejects(validatePublicationBundle(zipRoot), /OFFLINE_ARTIFACT_INVALID/)
    } finally {
      await Promise.all([
        rm(zeroRoot, { recursive: true, force: true }),
        rm(zipRoot, { recursive: true, force: true }),
      ])
    }
  })

  it('rejects canonical artifacts replaced by symlinks', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'strong-publication-symlink-'))
    try {
      const result = await writeStrongPublicationFixture(root)
      const canonicalPath = path.join(root, result.manifest.canonical.path)
      const external = path.join(path.dirname(root), `${path.basename(root)}-canonical.json`)
      await writeFile(external, await readFile(canonicalPath))
      await rm(canonicalPath)
      await symlink(external, canonicalPath)
      await assert.rejects(validatePublicationBundle(root), /CANONICAL_ARTIFACT_PATH_INVALID/)
      await rm(external, { force: true })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
