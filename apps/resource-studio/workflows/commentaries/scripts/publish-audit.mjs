#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const exportRoot = path.resolve(process.argv[2] ?? path.join(root, '.local', 'full-export'))
const outputRoot = path.join(root, 'data', 'audit')
const readJson = async relativePath => JSON.parse(await readFile(path.join(exportRoot, relativePath), 'utf8'))
const writeJson = async (name, value) => writeFile(path.join(outputRoot, name), `${JSON.stringify(value, null, 2)}\n`)

await mkdir(outputRoot, { recursive: true })
const manifest = await readJson('manifest.json')
const publishedResources = {}

for (const code of ['acbc', 'barnes']) {
  const [comments, missing, quality] = await Promise.all([
    readJson(`comments/${code}.json`),
    readJson(`missing/${code}.json`),
    readJson(`quality/${code}.json`),
  ])
  const compactMissing = missing.map(({ id, passage, sourceSha256 }) => ({ id, passage, sourceSha256 }))
  const issueCounts = Object.entries(
    quality.issues.flatMap(issue => issue.issues).reduce((counts, issue) => {
      counts[issue] = (counts[issue] ?? 0) + 1
      return counts
    }, {})
  ).map(([issue, count]) => ({ issue, count }))
  const ids = comments.reduce((counts, entry) => {
    counts[entry.id] = (counts[entry.id] ?? 0) + 1
    return counts
  }, {})
  const duplicateSourceIds = Object.entries(ids)
    .filter(([, count]) => count > 1)
    .map(([id, count]) => ({ id, count }))
  const invalidIdentities = comments
    .filter(entry => !/^\d+$/.test(entry.id) || !/^\d+-\d+-\d+$/.test(entry.passage))
    .map(entry => ({ id: entry.id, passage: entry.passage }))

  await writeJson(`missing-${code}.json`, {
    schemaVersion: 1,
    resourceId: code,
    generatedAt: manifest.completedAt,
    count: compactMissing.length,
    entries: compactMissing,
  })
  await writeJson(`quality-${code}.json`, {
    schemaVersion: 1,
    resourceId: code,
    generatedAt: manifest.completedAt,
    issueCounts,
    entries: quality.issues,
    repeatedTranslationBodyGroups: quality.duplicateTranslations.length,
    duplicateSourceIds,
    invalidIdentities,
    note: 'Les corps répétés peuvent être éditorialement légitimes; ils ne sont pas classés comme erreurs sans revue.',
  })
  publishedResources[code] = {
    ...manifest.resources[code],
    issueCounts,
    duplicateSourceIdCount: duplicateSourceIds.length,
    invalidIdentityCount: invalidIdentities.length,
    missingManifest: `missing-${code}.json`,
    qualityManifest: `quality-${code}.json`,
  }
}

await writeJson('summary.json', {
  schemaVersion: 1,
  generatedAt: manifest.completedAt,
  methodology: 'Requête Firestore filtrée resource.code sur chaque document verse-commentaries, puis batchGet exact de commentaries-FR par identifiant.',
  passagesVisited: manifest.passagesVisited,
  remoteWrites: false,
  resources: publishedResources,
  translationReadyBatches: '.local/full-export/missing/*.json (non versionnés car ils contiennent les textes sources complets)',
})

process.stdout.write(`Manifestes publiés dans ${outputRoot}\n`)
