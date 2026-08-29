#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { sha256 } from './firestore.mjs'
import {
  addStats,
  COMMENTARY_BCV_PARSER_VERSION,
  COMMENTARY_LINK_NORMALIZATION_REVISION,
  emptyStats,
  normalizeEntryLinks,
} from './commentary-links.mjs'

const prototypeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const defaultLibraryRoot = path.join(prototypeRoot, '.local', 'library')
const readJson = async filePath => JSON.parse(await readFile(filePath, 'utf8'))

export const normalizeLibraryLinks = async (libraryRoot = defaultLibraryRoot) => {
  const indexPath = path.join(libraryRoot, 'index.json')
  const index = await readJson(indexPath)
  const previousNormalization = index.linkNormalizationRevision === COMMENTARY_LINK_NORMALIZATION_REVISION
    ? index.linkNormalization
    : null
  const descriptors = new Map()
  for (const chapter of index.chapters) {
    for (const descriptor of Object.values(chapter.resources)) descriptors.set(descriptor.path, descriptor)
  }

  const totals = emptyStats()
  const byResource = {}
  for (const [relativePath, descriptor] of descriptors) {
    const filePath = path.join(libraryRoot, relativePath)
    const payload = await readJson(filePath)
    const resourceStats = byResource[payload.resourceId] ??= emptyStats()
    const entries = payload.entries.map(entry => {
      const normalized = normalizeEntryLinks(entry)
      addStats(totals, normalized.stats)
      addStats(resourceStats, normalized.stats)
      return normalized.entry
    })
    const serialized = JSON.stringify({ ...payload, entries })
    await writeFile(filePath, serialized)
    descriptor.sha256 = sha256(serialized)
    descriptor.count = entries.length
  }

  index.generatedAt = new Date().toISOString()
  index.linkNormalizationRevision = COMMENTARY_LINK_NORMALIZATION_REVISION
  index.linkContract = {
    version: 1,
    representation: 'html-reference-id-plus-references',
    canonicalTarget: 'OSIS',
    parser: '@bible-strong/bible-reference-parser',
    parserVersion: COMMENTARY_BCV_PARSER_VERSION,
    inlineExternalLinks: false,
    runtimeParsingRequired: false,
  }
  if (previousNormalization) {
    totals.anchorsRemoved = previousNormalization.totals?.anchorsRemoved ?? totals.anchorsRemoved
    totals.discardedLinks = previousNormalization.totals?.discardedLinks ?? totals.discardedLinks
    for (const [resourceId, stats] of Object.entries(byResource)) {
      stats.anchorsRemoved = previousNormalization.byResource?.[resourceId]?.anchorsRemoved ?? stats.anchorsRemoved
      stats.discardedLinks = previousNormalization.byResource?.[resourceId]?.discardedLinks ?? stats.discardedLinks
    }
  }
  index.linkNormalization = { totals, byResource }
  await writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`)
  return { chunks: descriptors.size, ...totals, byResource }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
if (isMain) {
  const libraryRoot = path.resolve(process.argv[2] ?? defaultLibraryRoot)
  normalizeLibraryLinks(libraryRoot)
    .then(result => process.stdout.write(`${JSON.stringify({ libraryRoot, ...result }, null, 2)}\n`))
    .catch(error => {
      process.stderr.write(`${error.stack ?? error.message}\n`)
      process.exitCode = 1
    })
}
