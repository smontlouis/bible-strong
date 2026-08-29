#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sha256 } from './wave-sources.mjs'
import { normalizeLibraryScopes } from './normalize-library-scopes.mjs'

const prototypeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const exportRoot = path.resolve(process.argv[2] ?? path.join(prototypeRoot, '.local/bible-annotee-export'))
const libraryRoot = path.resolve(process.argv[3] ?? path.join(prototypeRoot, '.local/library'))
const readJson = async filePath => JSON.parse(await readFile(filePath, 'utf8'))
const indexPath = path.join(libraryRoot, 'index.json')
const [index, manifest, entries] = await Promise.all([
  readJson(indexPath),
  readJson(path.join(exportRoot, 'manifest.json')),
  readJson(path.join(exportRoot, 'bible-annotee.json')),
])

if (manifest.resourceId !== 'bible-annotee' || manifest.authorization?.status !== 'confirmed-by-project-owner') {
  throw new Error('Manifeste Bible Annotée non autorisé ou invalide')
}
const corpusRaw = await readFile(path.join(exportRoot, 'bible-annotee.json'), 'utf8')
if (sha256(corpusRaw) !== manifest.corpus.sha256 || entries.length !== manifest.counts.entries) {
  throw new Error('Le corpus Bible Annotée ne correspond pas à son manifeste')
}

const bookNames = index.chapters.reduce((map, chapter) => map.set(chapter.book, chapter.bookName), new Map())
const chapters = new Map(index.chapters.map(chapter => [`${chapter.book}-${chapter.chapter}`, { ...chapter, passages: new Set(chapter.passages) }]))
const groups = new Map()
for (const entry of entries) {
  const key = entry.passage.split('-').slice(0, 2).join('-')
  const group = groups.get(key) ?? []
  group.push(entry)
  groups.set(key, group)
}

for (const chapter of chapters.values()) delete chapter.resources['bible-annotee']
for (const [key, chapterEntries] of groups) {
  chapterEntries.sort((left, right) => left.passage.localeCompare(right.passage, 'fr', { numeric: true }) || left.id.localeCompare(right.id, 'fr', { numeric: true }))
  const [book, chapter] = key.split('-').map(Number)
  const relativePath = `chunks/${book}/${chapter}/bible-annotee.json`
  const payload = JSON.stringify({ schemaVersion: 1, resourceId: 'bible-annotee', entries: chapterEntries })
  await mkdir(path.dirname(path.join(libraryRoot, relativePath)), { recursive: true })
  await writeFile(path.join(libraryRoot, relativePath), payload)
  const record = chapters.get(key) ?? {
    book,
    bookName: bookNames.get(book) ?? `Livre ${book}`,
    chapter,
    passages: new Set(),
    resources: {},
  }
  for (const entry of chapterEntries) record.passages.add(entry.passage)
  record.resources['bible-annotee'] = { path: relativePath, count: chapterEntries.length, sha256: sha256(payload) }
  chapters.set(key, record)
}

index.generatedAt = new Date().toISOString()
index.sourceRevision.bibleAnnotee = manifest.corpus.sha256
index.resources['bible-annotee'] = {
  entryCount: entries.length,
  translatedCount: entries.length,
  missingCount: 0,
  chapterCount: groups.size,
}
index.chapters = [...chapters.values()]
  .filter(chapter => Object.keys(chapter.resources).length > 0)
  .sort((left, right) => left.book - right.book || left.chapter - right.chapter)
  .map(chapter => ({ ...chapter, passages: [...chapter.passages].sort((left, right) => left.localeCompare(right, 'fr', { numeric: true })) }))

await writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`)
const normalization = await normalizeLibraryScopes(libraryRoot)
process.stdout.write(`${JSON.stringify({ resourceId: 'bible-annotee', entries: entries.length, chunks: groups.size, library: libraryRoot, normalization }, null, 2)}\n`)
