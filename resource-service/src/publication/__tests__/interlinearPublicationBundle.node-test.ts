import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { validatePublicationBundle } from '../publicationBundle'
import { writeInterlinearPublicationFixture } from './interlinearPublicationFixture'

test('validates French and English interlinear bundle/archive parity', async () => {
  for (const language of ['fr', 'en'] as const) {
    const root = await mkdtemp(path.join(os.tmpdir(), `interlinear-${language}-`))
    const expected = await writeInterlinearPublicationFixture(root, { language })
    const validated = await validatePublicationBundle(root)

    assert.equal(validated.manifest.identity.kind, 'interlinear-index')
    assert.equal(validated.manifest.identity.language, language)
    assert.deepEqual(validated.canonical, expected.canonical)
  }
})

test('rejects a canonical locale that does not match the publication identity', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'interlinear-locale-'))
  await writeInterlinearPublicationFixture(root, { language: 'fr', canonicalLanguage: 'en' })

  await assert.rejects(validatePublicationBundle(root), /PUBLICATION_BUNDLE_IDENTITY_MISMATCH/)
})

test('rejects Offline-copy archive entries outside the declared parity artifact', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'interlinear-archive-'))
  await writeInterlinearPublicationFixture(root, { extraOfflineEntry: true })

  await assert.rejects(validatePublicationBundle(root), /OFFLINE_ARTIFACT_INVALID/)
})

test('rejects a manifest count that differs from canonical content', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'interlinear-count-'))
  await writeInterlinearPublicationFixture(root)
  const manifestPath = path.join(root, 'manifest.json')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  manifest.counts.tokens = 2
  await writeFile(manifestPath, `${JSON.stringify(manifest)}\n`)

  await assert.rejects(validatePublicationBundle(root), /PUBLICATION_BUNDLE_COUNT_MISMATCH/)
})

test('rejects an Offline copy whose schema is not the required V5 contract', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'interlinear-schema-'))
  await writeInterlinearPublicationFixture(root, { offlineSchemaVersion: 4 })

  await assert.rejects(validatePublicationBundle(root), /OFFLINE_ARTIFACT_CONTENT_MISMATCH/)
})

test('rejects an Offline copy without its exact Resource revision', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'interlinear-revision-'))
  await writeInterlinearPublicationFixture(root, { omitOfflineIndexRevision: true })

  await assert.rejects(validatePublicationBundle(root), /OFFLINE_ARTIFACT_CONTENT_MISMATCH/)
})

test('rejects an Offline Strong verse index that is not derived from canonical identities', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'interlinear-strong-index-'))
  await writeInterlinearPublicationFixture(root, { mismatchedStrongVerseIndex: true })

  await assert.rejects(validatePublicationBundle(root), /OFFLINE_ARTIFACT_CONTENT_MISMATCH/)
})
