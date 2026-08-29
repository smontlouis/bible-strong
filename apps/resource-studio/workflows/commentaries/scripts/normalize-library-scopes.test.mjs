import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { sha256 } from './firestore.mjs'
import { normalizeLibraryScopes } from './normalize-library-scopes.mjs'

const source = (id, passage, resourceId, html, extra = {}) => ({
  schemaVersion: 1,
  id,
  passage,
  resource: { id: resourceId },
  source: { language: 'en', html, sha256: sha256(html) },
  translation: null,
  ...extra,
})

test('normalise les chunks, déduplique Barnes et indexe une plage inter-chapitres', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'commentary-scopes-'))
  try {
    const chunks = {
      'chunks/1/1/barnes.json': [
        source('b3', '1-1-3', 'barnes', '<p>Same</p>'),
        source('b4', '1-1-4', 'barnes', '<p>Same</p>'),
      ],
      'chunks/1/1/aquifer-fr.json': [
        source('a31', '1-1-31', 'aquifer-fr', '<p>Across chapters</p>', { passageEnd: '1-2-3' }),
      ],
      'chunks/1/2/aquifer-fr.json': [
        source('a5', '1-2-5', 'aquifer-fr', '<p>Verse five</p>'),
      ],
    }
    const descriptors = {}
    for (const [relativePath, entries] of Object.entries(chunks)) {
      const resourceId = path.basename(relativePath, '.json')
      const payload = JSON.stringify({ schemaVersion: 1, resourceId, entries })
      await mkdir(path.dirname(path.join(root, relativePath)), { recursive: true })
      await writeFile(path.join(root, relativePath), payload)
      descriptors[relativePath] = { path: relativePath, count: entries.length, sha256: sha256(payload) }
    }
    await writeFile(path.join(root, 'index.json'), JSON.stringify({
      schemaVersion: 1,
      format: 'chapter-json-v1',
      resources: { barnes: {}, 'aquifer-fr': {} },
      chapters: [
        { book: 1, bookName: 'Genèse', chapter: 1, passages: ['1-1-3', '1-1-4', '1-1-31'], resources: {
          barnes: descriptors['chunks/1/1/barnes.json'],
          'aquifer-fr': descriptors['chunks/1/1/aquifer-fr.json'],
        } },
        { book: 1, bookName: 'Genèse', chapter: 2, passages: ['1-2-5'], resources: {
          'aquifer-fr': descriptors['chunks/1/2/aquifer-fr.json'],
        } },
      ],
    }))

    const result = await normalizeLibraryScopes(root)
    assert.equal(result.resources, 2)
    assert.equal(result.units, 3)
    assert.equal(result.sourceAnchors, 4)
    assert.equal(result.coverageChunks, 1)
    assert.equal(result.links.chunks, 3)
    const index = JSON.parse(await readFile(path.join(root, 'index.json'), 'utf8'))
    assert.equal(index.format, 'chapter-json-v2')
    assert.deepEqual(index.chapters[1].coverageChunks, [{ resourceId: 'aquifer-fr', path: 'chunks/1/1/aquifer-fr.json' }])
    assert.ok(index.chapters[1].passages.includes('1-2-1'))
    assert.ok(index.chapters[1].passages.includes('1-2-3'))
    const barnes = JSON.parse(await readFile(path.join(root, 'chunks/1/1/barnes.json'), 'utf8'))
    assert.equal(barnes.entries.length, 1)
    assert.equal(barnes.entries[0].sourceAnchors.length, 2)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
