#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sha256 } from './wave-sources.mjs'
import { normalizeLibraryScopes } from './normalize-library-scopes.mjs'

const prototypeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const exportRoot = path.resolve(process.argv[2] ?? path.join(prototypeRoot, '.local/douay-rheims-export'))
const libraryRoot = path.resolve(process.argv[3] ?? path.join(prototypeRoot, '.local/library'))
const readJson = async filePath => JSON.parse(await readFile(filePath, 'utf8'))
const indexPath = path.join(libraryRoot, 'index.json')
const [index, manifest] = await Promise.all([readJson(indexPath), readJson(path.join(exportRoot, 'manifest.json'))])
if (manifest.sourcePolicy !== 'accepted-as-published' || manifest.provider !== 'janvier-s/original-douay-rheims') throw new Error('Manifeste Douay-Rheims invalide')

const raw = await readFile(path.join(exportRoot, manifest.corpus.path), 'utf8')
if (sha256(raw) !== manifest.corpus.sha256) throw new Error('Hash Douay-Rheims invalide')
const entries = JSON.parse(raw)
if (entries.length !== manifest.corpus.entryCount) throw new Error('Compteur Douay-Rheims invalide')

const resourceId = 'douay-rheims-notes'
const additionalBookNames = { 67: 'Tobie', 68: 'Judith', 69: 'Sagesse', 70: 'Siracide', 71: 'Baruch', 72: '1 Maccabées', 73: '2 Maccabées' }
const bookNames = index.chapters.reduce((map, chapter) => map.set(chapter.book, chapter.bookName), new Map())
const chapters = new Map(index.chapters.map(chapter => [`${chapter.book}-${chapter.chapter}`, { ...chapter, passages: new Set(chapter.passages) }]))
for (const chapter of chapters.values()) delete chapter.resources[resourceId]
const groups = new Map()
for (const entry of entries) {
  const key = entry.passage.split('-').slice(0, 2).join('-')
  const group = groups.get(key) ?? []
  group.push(entry)
  groups.set(key, group)
}

for (const [key, chapterEntries] of groups) {
  const [book, chapter] = key.split('-').map(Number)
  const relativePath = `chunks/${book}/${chapter}/${resourceId}.json`
  const payload = JSON.stringify({ schemaVersion: 1, resourceId, entries: chapterEntries })
  await mkdir(path.dirname(path.join(libraryRoot, relativePath)), { recursive: true })
  await writeFile(path.join(libraryRoot, relativePath), payload)
  const record = chapters.get(key) ?? { book, bookName: bookNames.get(book) ?? additionalBookNames[book] ?? `Livre ${book}`, chapter, passages: new Set(), resources: {} }
  for (const entry of chapterEntries) record.passages.add(entry.passage)
  record.resources[resourceId] = { path: relativePath, count: chapterEntries.length, sha256: sha256(payload) }
  chapters.set(key, record)
}

index.resources[resourceId] = {
  entryCount: entries.length,
  translatedCount: 0,
  missingCount: entries.length,
  chapterCount: groups.size,
}
index.generatedAt = new Date().toISOString()
index.sourceRevision.douayRheims = manifest.corpus.sha256
index.chapters = [...chapters.values()]
  .filter(chapter => Object.keys(chapter.resources).length > 0)
  .sort((left, right) => left.book - right.book || left.chapter - right.chapter)
  .map(chapter => ({ ...chapter, passages: [...chapter.passages].sort((left, right) => left.localeCompare(right, 'fr', { numeric: true })) }))
await writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`)
const normalization = await normalizeLibraryScopes(libraryRoot)
process.stdout.write(`${JSON.stringify({ resourceId, entries: entries.length, chunks: groups.size, normalization }, null, 2)}\n`)
