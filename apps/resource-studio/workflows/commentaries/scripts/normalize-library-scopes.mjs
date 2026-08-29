#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { sha256 } from './firestore.mjs'
import { comparePassages, normalizeBarnesEntries, normalizeEntryScope, parsePassage } from './commentary-scope.mjs'
import { normalizeLibraryLinks } from './normalize-library-links.mjs'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const prototypeRoot = path.resolve(scriptDirectory, '..')
const defaultLibraryRoot = path.join(prototypeRoot, '.local', 'library')
const readJson = async filePath => JSON.parse(await readFile(filePath, 'utf8'))
const chapterKey = passage => String(passage).split('-').slice(0, 2).join('-')

const coveredPassages = (entry, chaptersByKey) => {
  const start = parsePassage(entry.scope?.start)
  const end = parsePassage(entry.scope?.end)
  if (!start || !end || comparePassages(entry.scope.end, entry.scope.start) <= 0) return []
  const records = [...chaptersByKey.values()]
    .filter(chapter => chapter.book >= start.book && chapter.book <= end.book)
    .filter(chapter => {
      if (chapter.book === start.book && chapter.chapter < start.chapter) return false
      if (chapter.book === end.book && chapter.chapter > end.chapter) return false
      return true
    })
    .sort((left, right) => left.book - right.book || left.chapter - right.chapter)
  const result = []
  for (const chapter of records) {
    const existingMax = Math.max(0, ...[...chapter.passages].map(passage => parsePassage(passage)?.verse ?? 0))
    const firstVerse = chapter.book === start.book && chapter.chapter === start.chapter ? start.verse : 1
    const lastVerse = chapter.book === end.book && chapter.chapter === end.chapter ? end.verse : existingMax
    for (let verse = Math.max(1, firstVerse); verse <= lastVerse; verse += 1) {
      result.push(`${chapter.book}-${chapter.chapter}-${verse}`)
    }
  }
  return result
}

const anchorTranslationCounts = entry => {
  if (!entry.sourceAnchors?.length) return { anchors: 1, translated: entry.translation ? 1 : 0 }
  const variants = new Map((entry.translationVariants ?? []).map(variant => [variant.id, variant.translation]))
  let translated = entry.translation ? 1 : 0
  for (const anchor of entry.sourceAnchors.slice(1)) if (variants.get(anchor.id)) translated += 1
  return { anchors: entry.sourceAnchors.length, translated }
}

export const normalizeLibraryScopes = async (libraryRoot = defaultLibraryRoot) => {
  const indexPath = path.join(libraryRoot, 'index.json')
  const index = await readJson(indexPath)
  const chapters = new Map(index.chapters.map(chapter => [
    `${chapter.book}-${chapter.chapter}`,
    {
      ...chapter,
      passages: new Set(chapter.passages),
      coverageChunks: [],
      resources: { ...chapter.resources },
    },
  ]))
  const normalizedChunks = []

  for (const chapter of chapters.values()) {
    for (const [resourceId, descriptor] of Object.entries(chapter.resources)) {
      const filePath = path.join(libraryRoot, descriptor.path)
      const payload = await readJson(filePath)
      const entries = resourceId === 'barnes'
        ? normalizeBarnesEntries(payload.entries)
        : payload.entries.map(normalizeEntryScope)
      normalizedChunks.push({ chapter, resourceId, descriptor, filePath, entries })
    }
  }

  const counts = new Map()
  for (const chunk of normalizedChunks) {
    const payload = JSON.stringify({ schemaVersion: 2, resourceId: chunk.resourceId, entries: chunk.entries })
    await writeFile(chunk.filePath, payload)
    chunk.descriptor.count = chunk.entries.length
    chunk.descriptor.sha256 = sha256(payload)
    chunk.chapter.resources[chunk.resourceId] = chunk.descriptor
    const resource = counts.get(chunk.resourceId) ?? {
      entryCount: 0,
      translatedCount: 0,
      missingCount: 0,
      chapterCount: 0,
      sourceAnchorCount: 0,
      translatedAnchorCount: 0,
    }
    resource.chapterCount += 1
    resource.entryCount += chunk.entries.length
    resource.translatedCount += chunk.entries.filter(entry => entry.translation).length
    resource.missingCount += chunk.entries.filter(entry => !entry.translation).length
    for (const entry of chunk.entries) {
      const anchorCounts = anchorTranslationCounts(entry)
      resource.sourceAnchorCount += anchorCounts.anchors
      resource.translatedAnchorCount += anchorCounts.translated
    }
    counts.set(chunk.resourceId, resource)
  }

  for (const chunk of normalizedChunks) {
    for (const entry of chunk.entries) {
      const passages = coveredPassages(entry, chapters)
      for (const passage of passages) {
        const target = chapters.get(chapterKey(passage))
        if (!target) continue
        target.passages.add(passage)
        if (target !== chunk.chapter) {
          const key = `${chunk.resourceId}:${chunk.descriptor.path}`
          if (!target.coverageChunks.some(candidate => `${candidate.resourceId}:${candidate.path}` === key)) {
            target.coverageChunks.push({ resourceId: chunk.resourceId, path: chunk.descriptor.path })
          }
        }
      }
    }
  }

  index.schemaVersion = 2
  index.format = 'chapter-json-v2'
  index.generatedAt = new Date().toISOString()
  index.normalizationRevision = 'commentary-scope-v1'
  index.scopeContract = {
    version: 1,
    kinds: ['verse', 'range', 'section', 'chapter', 'book', 'homily'],
    coverage: 'start-inclusive-end-inclusive',
  }
  for (const [resourceId, resource] of counts) {
    index.resources[resourceId] = { ...index.resources[resourceId], ...resource }
  }
  index.chapters = [...chapters.values()]
    .filter(chapter => Object.keys(chapter.resources).length > 0)
    .sort((left, right) => left.book - right.book || left.chapter - right.chapter)
    .map(chapter => ({
      ...chapter,
      passages: [...chapter.passages].sort(comparePassages),
      coverageChunks: chapter.coverageChunks.sort((left, right) => left.path.localeCompare(right.path)),
    }))
  await writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`)
  const links = await normalizeLibraryLinks(libraryRoot)
  return {
    resources: counts.size,
    units: [...counts.values()].reduce((total, resource) => total + resource.entryCount, 0),
    sourceAnchors: [...counts.values()].reduce((total, resource) => total + resource.sourceAnchorCount, 0),
    coverageChunks: index.chapters.reduce((total, chapter) => total + chapter.coverageChunks.length, 0),
    links,
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
if (isMain) {
  const libraryRoot = path.resolve(process.argv[2] ?? defaultLibraryRoot)
  normalizeLibraryScopes(libraryRoot)
    .then(result => process.stdout.write(`${JSON.stringify({ libraryRoot, ...result }, null, 2)}\n`))
    .catch(error => {
      process.stderr.write(`${error.stack ?? error.message}\n`)
      process.exitCode = 1
    })
}
