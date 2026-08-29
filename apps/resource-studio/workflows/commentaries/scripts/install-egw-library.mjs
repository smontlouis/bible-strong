#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sha256 } from './wave-sources.mjs'
import { normalizeLibraryScopes } from './normalize-library-scopes.mjs'

const prototypeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const exportRoot = path.resolve(process.argv[2] ?? path.join(prototypeRoot, '.local/egw-export'))
const libraryRoot = path.resolve(process.argv[3] ?? path.join(prototypeRoot, '.local/library'))
const readJson = async filePath => JSON.parse(await readFile(filePath, 'utf8'))
const indexPath = path.join(libraryRoot, 'index.json')

const [index, manifest] = await Promise.all([
  readJson(indexPath),
  readJson(path.join(exportRoot, 'manifest.json')),
])

if (manifest.authorization?.status !== 'confirmed-by-project-owner') {
  throw new Error('Manifeste EGW non autorisé ou invalide')
}

const readArtifact = async artifactName => {
  const artifact = manifest.artifacts?.[artifactName]
  if (!artifact) throw new Error('Artefact EGW absent : ' + artifactName)
  const raw = await readFile(path.join(exportRoot, artifact.path), 'utf8')
  if (sha256(raw) !== artifact.sha256) throw new Error('Hash EGW invalide : ' + artifact.path)
  return JSON.parse(raw)
}

const [commentarySource, scriptureIndexSource] = await Promise.all([
  readArtifact('commentary'),
  readArtifact('scriptureIndex'),
])

if (commentarySource.length !== manifest.counts.commentaryEntries || scriptureIndexSource.length !== manifest.counts.scriptureIndexEntries) {
  throw new Error('Les comptes EGW ne correspondent pas au manifeste')
}

const commentaryResource = {
  id: 'egw-sda-bc',
  name: 'EGW SDA Bible Commentary 1–7',
  author: 'Ellen G. White',
  sourceLanguage: 'en',
  license: 'CustomPermission',
}
const indexResource = {
  id: 'egw-ecsi',
  name: 'EGW Complete Scripture Index',
  author: 'Ellen G. White Estate',
  sourceLanguage: 'en',
  license: 'CustomPermission',
}

const commentary = commentarySource.map(entry => ({
  ...entry,
  resource: commentaryResource,
  volumeCode: entry.resource.id.replace('egw-', '').toUpperCase(),
}))
const scriptureIndex = scriptureIndexSource.map(entry => ({
  ...entry,
  resource: indexResource,
  source: {
    language: 'en',
    html: '',
    sha256: null,
    provenance: 'EGW Complete Scripture Index · ' + entry.indexParagraphId,
    url: entry.sourceUrl,
  },
  translation: null,
  editorialKind: 'scripture-index',
}))

const bookNames = index.chapters.reduce((map, chapter) => map.set(chapter.book, chapter.bookName), new Map())
const chapters = new Map(index.chapters.map(chapter => [
  chapter.book + '-' + chapter.chapter,
  { ...chapter, passages: new Set(chapter.passages) },
]))

const install = async (resourceId, entries) => {
  for (const chapter of chapters.values()) delete chapter.resources[resourceId]
  const groups = new Map()
  for (const entry of entries) {
    const key = entry.passage.split('-').slice(0, 2).join('-')
    const group = groups.get(key) ?? []
    group.push(entry)
    groups.set(key, group)
  }

  for (const [key, chapterEntries] of groups) {
    chapterEntries.sort((left, right) =>
      left.passage.localeCompare(right.passage, 'fr', { numeric: true }) ||
      left.id.localeCompare(right.id, 'fr', { numeric: true })
    )
    const [book, chapter] = key.split('-').map(Number)
    const relativePath = 'chunks/' + book + '/' + chapter + '/' + resourceId + '.json'
    const payload = JSON.stringify({ schemaVersion: 1, resourceId, entries: chapterEntries })
    await mkdir(path.dirname(path.join(libraryRoot, relativePath)), { recursive: true })
    await writeFile(path.join(libraryRoot, relativePath), payload)
    const record = chapters.get(key) ?? {
      book,
      bookName: bookNames.get(book) ?? 'Livre ' + book,
      chapter,
      passages: new Set(),
      resources: {},
    }
    for (const entry of chapterEntries) record.passages.add(entry.passage)
    record.resources[resourceId] = {
      path: relativePath,
      count: chapterEntries.length,
      sha256: sha256(payload),
    }
    chapters.set(key, record)
  }

  index.resources[resourceId] = {
    entryCount: entries.length,
    translatedCount: 0,
    missingCount: entries.length,
    chapterCount: groups.size,
  }
  return groups.size
}

const commentaryChapters = await install(commentaryResource.id, commentary)
const indexChapters = await install(indexResource.id, scriptureIndex)
index.generatedAt = new Date().toISOString()
index.sourceRevision.egw = manifest.artifacts.merged.sha256
index.chapters = [...chapters.values()]
  .filter(chapter => Object.keys(chapter.resources).length > 0)
  .sort((left, right) => left.book - right.book || left.chapter - right.chapter)
  .map(chapter => ({
    ...chapter,
    passages: [...chapter.passages].sort((left, right) => left.localeCompare(right, 'fr', { numeric: true })),
  }))

await writeFile(indexPath, JSON.stringify(index, null, 2) + '\n')
const normalization = await normalizeLibraryScopes(libraryRoot)
process.stdout.write(JSON.stringify({
  resources: {
    [commentaryResource.id]: { entries: commentary.length, chapters: commentaryChapters },
    [indexResource.id]: { entries: scriptureIndex.length, chapters: indexChapters },
  },
  library: libraryRoot,
  normalization,
}, null, 2) + '\n')
