#!/usr/bin/env node

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sha256 } from './firestore.mjs'
import { comparePassages } from './commentary-scope.mjs'
import { COMMENTARY_LINK_NORMALIZATION_REVISION, isValidCommentaryReference } from './commentary-links.mjs'

const prototypeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const libraryRoot = path.resolve(process.argv[2] ?? path.join(prototypeRoot, '.local', 'library'))
const readJson = async filePath => JSON.parse(await readFile(filePath, 'utf8'))
const index = await readJson(path.join(libraryRoot, 'index.json'))
const expectedCounts = {
  acbc: 20794,
  barnes: 24224,
  'mhy-fr': 4145,
  'aquifer-fr': 16923,
  mhcc: 4059,
  jfb: 16945,
  wesley: 16930,
  'fre-aug': 1726,
  'fre-chry': 693,
  calvin: 11063,
  'treasury-david': 151,
  'rashi-en': 28060,
  'bible-annotee': 23320,
  abbott: 3367,
  burkitt: 3276,
  'catena-aurea': 821,
  'darby-notes': 8873,
  'family-notes': 5306,
  'geneva-notes': 14713,
  kd: 8806,
  'king-comments': 7590,
  lightfoot: 853,
  luther: 754,
  mhc: 5360,
  pnt: 6084,
  rwp: 7228,
  scofield: 3214,
  'fourfold-gospel': 4229,
  mhm: 21367,
  sdabc: 42768,
  'douay-rheims-notes': 1659,
}
const observed = Object.fromEntries(Object.keys(expectedCounts).map(resourceId => [resourceId, {
  entries: 0,
  anchors: 0,
  translated: 0,
  missing: 0,
  translatedAnchors: 0,
  chapters: 0,
}]))
const paths = new Set()
const coveragePaths = []

if (index.schemaVersion !== 2 || index.format !== 'chapter-json-v2') throw new Error('Index de bibliothèque v2 invalide')
if (index.linkNormalizationRevision !== COMMENTARY_LINK_NORMALIZATION_REVISION || index.linkContract?.runtimeParsingRequired !== false) {
  throw new Error('Contrat de références OSIS absent ou invalide')
}
if (index.chapters.length !== 1273) throw new Error(`1273 chapitres attendus, ${index.chapters.length} trouvés`)

const validateContent = (content, location) => {
  if (!content?.html) return
  if ('status' in content) throw new Error(`Statut éditorial obsolète dans ${location}`)
  if (/\b(?:machine-draft|human review|unreviewed|needs-review|review_level)\b|révision humaine|relecture humaine|à réviser/iu.test(content.provenance ?? '')) {
    throw new Error(`Mention de revue obsolète dans ${location}`)
  }
  if (/<a\b|\bhref\s*=/iu.test(content.html)) throw new Error(`Lien HTML inline interdit dans ${location}`)
  const references = content.references ?? []
  if (new Set(references.map(reference => reference.id)).size !== references.length || !references.every(isValidCommentaryReference)) {
    throw new Error(`Références OSIS invalides dans ${location}`)
  }
  const markerIds = [...content.html.matchAll(/\bdata-reference-id=["']([^"']+)["']/giu)].map(match => match[1])
  if (markerIds.length !== references.length || markerIds.some(id => !references.some(reference => reference.id === id))) {
    throw new Error(`Marqueurs/références incohérents dans ${location}`)
  }
  for (const source of content.externalSources ?? []) {
    if (source.policy !== 'metadata-only' || !source.label || !/^https?:\/\//iu.test(source.url)) {
      throw new Error(`Source externe invalide dans ${location}`)
    }
  }
}

for (const chapter of index.chapters) {
  if (!chapter.bookName || !Number.isInteger(chapter.book) || !Number.isInteger(chapter.chapter)) throw new Error('Chapitre invalide dans l’index')
  for (const [resourceId, descriptor] of Object.entries(chapter.resources)) {
    if (!observed[resourceId]) throw new Error(`Ressource inattendue : ${resourceId}`)
    if (paths.has(descriptor.path)) throw new Error(`Chemin de chunk dupliqué : ${descriptor.path}`)
    paths.add(descriptor.path)
    const raw = await readFile(path.join(libraryRoot, descriptor.path), 'utf8')
    if (sha256(raw) !== descriptor.sha256) throw new Error(`Hash de chunk invalide : ${descriptor.path}`)
    const payload = JSON.parse(raw)
    if (payload.schemaVersion !== 2 || payload.resourceId !== resourceId || payload.entries.length !== descriptor.count) {
      throw new Error(`Contrat de chunk invalide : ${descriptor.path}`)
    }
    observed[resourceId].chapters += 1
    for (const entry of payload.entries) {
      if (!/^\d+-\d+-\d+$/.test(entry.passage) || entry.resource.id !== resourceId) throw new Error(`Entrée invalide dans ${descriptor.path}`)
      if (entry.schemaVersion !== 2 || !entry.scope?.kind || entry.anchor !== entry.passage) throw new Error(`Portée ou ancre absente dans ${descriptor.path}/${entry.id}`)
      if (entry.scope.end && comparePassages(entry.scope.end, entry.scope.start) <= 0) throw new Error(`Portée inversée dans ${descriptor.path}/${entry.id}`)
      if (entry.scope.end && (comparePassages(entry.passage, entry.scope.start) < 0 || comparePassages(entry.passage, entry.scope.end) > 0)) throw new Error(`Ancre hors portée dans ${descriptor.path}/${entry.id}`)
      validateContent(entry.source, `${descriptor.path}/${entry.id}/source`)
      validateContent(entry.translation, `${descriptor.path}/${entry.id}/translation`)
      for (const [variantIndex, variant] of (entry.translationVariants ?? []).entries()) {
        validateContent(variant.translation, `${descriptor.path}/${entry.id}/translationVariants/${variantIndex}`)
      }
      observed[resourceId].entries += 1
      entry.translation ? observed[resourceId].translated++ : observed[resourceId].missing++
      const anchors = entry.sourceAnchors?.length ?? 1
      observed[resourceId].anchors += anchors
      if (entry.sourceAnchors?.length) {
        if (new Set(entry.sourceAnchors.map(anchor => anchor.id)).size !== anchors) throw new Error(`Ancres dédupliquées invalides dans ${descriptor.path}/${entry.id}`)
        const variants = new Map((entry.translationVariants ?? []).map(variant => [variant.id, variant.translation]))
        observed[resourceId].translatedAnchors += entry.translation ? 1 : 0
        for (const anchor of entry.sourceAnchors.slice(1)) if (variants.get(anchor.id)) observed[resourceId].translatedAnchors += 1
      } else if (entry.translation) observed[resourceId].translatedAnchors += 1
    }
  }
  for (const coverage of chapter.coverageChunks ?? []) coveragePaths.push(coverage.path)
}

for (const coveragePath of coveragePaths) if (!paths.has(coveragePath)) throw new Error(`Chunk de couverture inconnu : ${coveragePath}`)

for (const [resourceId, expected] of Object.entries(expectedCounts)) {
  const actual = observed[resourceId]
  if (actual.anchors !== expected) throw new Error(`${resourceId}: ${expected} ancres source attendues, ${actual.anchors} trouvées`)
  const declared = index.resources[resourceId]
  if (actual.entries !== declared.entryCount || actual.anchors !== declared.sourceAnchorCount || actual.translated !== declared.translatedCount || actual.missing !== declared.missingCount || actual.translatedAnchors !== declared.translatedAnchorCount || actual.chapters !== declared.chapterCount) {
    throw new Error(`${resourceId}: compteurs index/chunks incohérents`)
  }
}

const units = Object.values(observed).reduce((sum, resource) => sum + resource.entries, 0)
const anchors = Object.values(observed).reduce((sum, resource) => sum + resource.anchors, 0)
process.stdout.write(`Bibliothèque valide : ${units.toLocaleString('fr-FR')} unités éditoriales, ${anchors.toLocaleString('fr-FR')} ancres source, ${index.chapters.length} chapitres, ${paths.size} chunks JSON.\n`)
