import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
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
})
