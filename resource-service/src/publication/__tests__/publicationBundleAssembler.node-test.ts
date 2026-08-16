import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'

import { strToU8, zipSync } from 'fflate'

import { assembleBiblePublicationBundle } from '../publicationBundleAssembler'

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

describe('Bible publication bundle assembler', () => {
  it('turns an explicitly selected Bible Lexicon Maker artifact into a validated bundle', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'publication-assembler-'))
    const artifactPath = path.join(root, 'input.zip')
    const outputPath = path.join(root, 'bundle')
    const canonical = `${JSON.stringify({
      format: 'bible-strong-canonical-bible',
      schemaVersion: 4,
      applicationVersionId: 'LSG',
      textRevision: 'lsg-test-revision',
      textSha256: sha256('Au commencement'),
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
              startTags: [],
              layout: [],
              notes: [],
              headings: [],
            },
          },
        },
      },
    })}\n`

    try {
      await writeFile(artifactPath, Buffer.from(zipSync({ 'bible-lsg.json': strToU8(canonical) })))

      const result = await assembleBiblePublicationBundle({
        artifactPath,
        entry: 'bible-lsg.json',
        outputPath,
        language: 'fr',
        canon: 'protestant-66',
        versification: 'kjv',
        generatedAt: '2026-08-16T00:00:00.000Z',
        rights: {
          holder: 'Public domain',
          termsReference: 'Louis Segond 1910',
          attribution: 'Louis Segond 1910',
          online: true,
          offline: true,
        },
      })

      assert.equal(result.manifest.identity.language, 'fr')
      assert.equal(result.manifest.counts.verses, 1)
      assert.equal(
        JSON.parse(await readFile(path.join(outputPath, 'manifest.json'), 'utf8')).revision,
        'lsg-test-revision'
      )
      await assert.rejects(
        assembleBiblePublicationBundle({
          artifactPath,
          entry: 'bible-lsg.json',
          outputPath,
          language: 'fr',
          canon: 'protestant-66',
          versification: 'kjv',
          rights: result.manifest.rights,
        }),
        /PUBLICATION_BUNDLE_OUTPUT_EXISTS/
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
