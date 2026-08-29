#!/usr/bin/env node

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sha256 } from './wave-sources.mjs'
import { normalizeLibraryScopes } from './normalize-library-scopes.mjs'

const prototypeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const exportRoot = path.resolve(process.argv[2] ?? path.join(prototypeRoot, '.local/wave-3-export'))
const libraryRoot = path.resolve(process.argv[3] ?? path.join(prototypeRoot, '.local/library'))
const readJson = async filePath => JSON.parse(await readFile(filePath, 'utf8'))
const indexPath = path.join(libraryRoot, 'index.json')
const [index, manifest] = await Promise.all([readJson(indexPath), readJson(path.join(exportRoot, 'manifest.json'))])
if (manifest.wave !== 3 || manifest.authorization?.status !== 'confirmed-by-project-owner' || Object.keys(manifest.resources ?? {}).length !== 17) {
  throw new Error('Manifeste vague 3 incomplet ou non autorisé')
}

const bookNames = index.chapters.reduce((map, chapter) => map.set(chapter.book, chapter.bookName), new Map())
const chapters = new Map(index.chapters.map(chapter => [`${chapter.book}-${chapter.chapter}`, { ...chapter, passages: new Set(chapter.passages) }]))
const results = {}

for (const chapter of chapters.values()) {
  const retired = chapter.resources.tsk
  if (retired) {
    if (!/^chunks\/\d+\/\d+\/tsk\.json$/.test(retired.path)) throw new Error(`Chemin TSK inattendu : ${retired.path}`)
    await rm(path.join(libraryRoot, retired.path), { force: true })
    delete chapter.resources.tsk
  }
}
delete index.resources.tsk

for (const [resourceId, resourceManifest] of Object.entries(manifest.resources).filter(([id]) => id !== 'tsk')) {
  const raw = await readFile(path.join(exportRoot, `${resourceId}.json`), 'utf8')
  if (sha256(raw) !== resourceManifest.outputSha256) throw new Error(`Hash vague 3 invalide : ${resourceId}`)
  const entries = JSON.parse(raw)
  if (entries.length !== resourceManifest.entryCount) throw new Error(`Compteur vague 3 invalide : ${resourceId}`)
  for (const chapter of chapters.values()) delete chapter.resources[resourceId]
  const groups = new Map()
  for (const entry of entries) {
    const key = entry.passage.split('-').slice(0, 2).join('-')
    const group = groups.get(key) ?? []
    group.push(entry)
    groups.set(key, group)
  }
  for (const [key, chapterEntries] of groups) {
    chapterEntries.sort((left, right) => left.passage.localeCompare(right.passage, 'en', { numeric: true }) || left.id.localeCompare(right.id, 'en', { numeric: true }))
    const [book, chapter] = key.split('-').map(Number)
    const relativePath = `chunks/${book}/${chapter}/${resourceId}.json`
    const payload = JSON.stringify({ schemaVersion: 1, resourceId, entries: chapterEntries })
    await mkdir(path.dirname(path.join(libraryRoot, relativePath)), { recursive: true })
    await writeFile(path.join(libraryRoot, relativePath), payload)
    const record = chapters.get(key) ?? { book, bookName: bookNames.get(book) ?? `Livre ${book}`, chapter, passages: new Set(), resources: {} }
    for (const entry of chapterEntries) record.passages.add(entry.passage)
    record.resources[resourceId] = { path: relativePath, count: chapterEntries.length, sha256: sha256(payload) }
    chapters.set(key, record)
  }
  index.resources[resourceId] = {
    entryCount: entries.length,
    translatedCount: entries.filter(entry => entry.translation).length,
    missingCount: entries.filter(entry => !entry.translation).length,
    chapterCount: groups.size,
  }
  results[resourceId] = { entries: entries.length, chunks: groups.size }
}

index.generatedAt = new Date().toISOString()
index.sourceRevision.wave3 = sha256(JSON.stringify(Object.fromEntries(Object.entries(manifest.resources).map(([id, resource]) => [id, resource.outputSha256]))))
index.chapters = [...chapters.values()]
  .filter(chapter => Object.keys(chapter.resources).length > 0)
  .sort((left, right) => left.book - right.book || left.chapter - right.chapter)
  .map(chapter => ({ ...chapter, passages: [...chapter.passages].sort((left, right) => left.localeCompare(right, 'fr', { numeric: true })) }))
await writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`)
const normalization = await normalizeLibraryScopes(libraryRoot)
process.stdout.write(`${JSON.stringify({ resources: results, normalization }, null, 2)}\n`)
