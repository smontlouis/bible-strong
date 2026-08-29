#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sha256 } from './firestore.mjs'
import { loadPublishedTranslations } from './published-translations.mjs'
import { expandBarnesEntries } from './commentary-scope.mjs'
import { normalizeLibraryScopes } from './normalize-library-scopes.mjs'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const prototypeRoot = path.resolve(scriptDirectory, '..')
const libraryRoot = path.resolve(process.argv[2] ?? path.join(prototypeRoot, '.local/library'))
const translationsRoot = path.resolve(process.argv[3] ?? path.join(prototypeRoot, 'data/translations/published'))
const indexPath = path.join(libraryRoot, 'index.json')
const index = JSON.parse(await readFile(indexPath, 'utf8'))
const translationRevisions = {}
const results = {}

for (const resourceId of ['acbc', 'barnes', 'aquifer-fr']) {
  const { translations, translationsBySourceSha256, revision } = await loadPublishedTranslations(translationsRoot, resourceId)
  if (!translations.size) continue
  translationRevisions[resourceId] = revision
  const found = new Set()
  let applied = 0
  let updated = 0

  for (const chapter of index.chapters) {
    const descriptor = chapter.resources[resourceId]
    if (!descriptor) continue
    const chunkPath = path.join(libraryRoot, descriptor.path)
    const chunk = JSON.parse(await readFile(chunkPath, 'utf8'))
    if (resourceId === 'barnes') chunk.entries = expandBarnesEntries(chunk.entries)
    let changed = false

    for (const entry of chunk.entries) {
      const published = translations.get(entry.id) ?? (!entry.translation ? translationsBySourceSha256.get(entry.source.sha256) : null)
      if (!published) continue
      if (entry.source.sha256 !== published.sourceSha256) throw new Error(`La source a changé pour ${resourceId}/${entry.id}`)
      found.add(entry.id)
      const translationSha256 = sha256(published.translatedHtml)
      const provenance = `${published.translator.model} (${published.translator.reasoningEffort}); lot ${published.batchId}`
      if (entry.translation) {
        if (entry.translation.provenance?.includes(`lot ${published.batchId}`)) {
          if (entry.translation.sha256 !== translationSha256 || entry.translation.status || entry.translation.provenance !== provenance) {
            entry.translation = {
              language: 'fr',
              html: published.translatedHtml,
              sha256: translationSha256,
              provenance,
            }
            changed = true
            updated += 1
          }
          continue
        }
        if (entry.translation.sha256 !== translationSha256) {
          throw new Error(`Refus d’écraser une traduction différente : ${resourceId}/${entry.id}`)
        }
        continue
      }
      entry.translation = {
        language: 'fr',
        html: published.translatedHtml,
        sha256: translationSha256,
        provenance,
      }
      changed = true
      applied += 1
    }

    if (changed) {
      const serialized = JSON.stringify(chunk)
      await writeFile(chunkPath, serialized)
      descriptor.count = chunk.entries.length
      descriptor.sha256 = sha256(serialized)
    }
  }

  const missing = [...translations.keys()].filter(id => !found.has(id))
  if (missing.length) {
    throw new Error(`Traductions absentes de la bibliothèque ${resourceId} : ${missing.join(', ')}`)
  }
  index.resources[resourceId].translatedCount += applied
  index.resources[resourceId].missingCount -= applied
  results[resourceId] = { translations: translations.size, matchedPassages: found.size, applied, updated }
}

index.generatedAt = new Date().toISOString()
index.sourceRevision.publishedTranslations = translationRevisions
await writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`)
const normalization = await normalizeLibraryScopes(libraryRoot)
process.stdout.write(`${JSON.stringify({ resources: results, normalization }, null, 2)}\n`)
