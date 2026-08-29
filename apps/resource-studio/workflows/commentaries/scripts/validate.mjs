#!/usr/bin/env node

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { inspectTranslation } from './quality.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const readJson = async relativePath => JSON.parse(await readFile(path.join(root, relativePath), 'utf8'))
const fail = message => { throw new Error(message) }

const [catalog, dataset, audit] = await Promise.all([
  readJson('data/catalog.json'),
  readJson('data/comments.json'),
  readJson('data/audit/summary.json'),
])
if (catalog.schemaVersion !== 2) fail('schemaVersion 2 requis pour le catalogue')
if (dataset.schemaVersion !== 1) fail('schemaVersion 1 requis pour les commentaires')
if (!Array.isArray(catalog.resources) || catalog.resources.length !== 31) fail('Le catalogue doit contenir les 31 ressources éditoriales')
if (!Array.isArray(dataset.entries) || dataset.entries.length === 0) fail('Le prototype doit contenir des commentaires')

const resourceIds = new Set(catalog.resources.map(resource => resource.id))
if (resourceIds.size !== catalog.resources.length) fail('Identifiant de ressource dupliqué dans le catalogue')
const aquifer = catalog.resources.find(resource => resource.id === 'aquifer-fr')
if (!aquifer || aquifer.shortName !== 'Aquifer' || aquifer.languages.join(',') !== 'en,fr' || resourceIds.has('aquifer-en')) {
  fail('Aquifer doit être une ressource éditoriale bilingue unique')
}
const descriptions = new Set()
const traditions = new Set(['Protestantisme', 'Catholicisme', 'Christianisme ancien', 'Judaïsme', 'Interconfessionnel'])
for (const resource of catalog.resources) {
  if (!resource.title || !resource.author || !resource.rights || !resource.source || !resource.status) {
    fail(`Métadonnées de catalogue incomplètes : ${resource.id}`)
  }
  if (!traditions.has(resource.tradition)) fail(`Tradition inconnue : ${resource.id} (${resource.tradition})`)
  if (!Array.isArray(resource.tags) || resource.tags.length === 0) fail(`Tags absents : ${resource.id}`)
  if (resource.tags.some(tag => typeof tag !== 'string' || !tag.trim())) fail(`Tag invalide : ${resource.id}`)
  if (new Set(resource.tags).size !== resource.tags.length) fail(`Tag dupliqué : ${resource.id}`)
  if (!resource.description || typeof resource.description !== 'object' || Array.isArray(resource.description)) {
    fail(`Descriptions éditoriales absentes : ${resource.id}`)
  }
  const descriptionLanguages = Object.keys(resource.description).sort()
  const resourceLanguages = [...resource.languages].sort()
  if (descriptionLanguages.join(',') !== resourceLanguages.join(',')) {
    fail(`Langues des descriptions incohérentes : ${resource.id} (${descriptionLanguages.join('/')} au lieu de ${resourceLanguages.join('/')})`)
  }
  for (const [language, description] of Object.entries(resource.description)) {
    if (!['en', 'fr'].includes(language) || typeof description !== 'string' || description.trim().length < 140 || description.length > 420) {
      fail(`Description éditoriale ${language} absente ou mal dimensionnée : ${resource.id}`)
    }
    const identity = `${language}:${description}`
    if (descriptions.has(identity)) fail(`Description éditoriale ${language} dupliquée : ${resource.id}`)
    descriptions.add(identity)
  }
}
const identities = new Set()
for (const entry of dataset.entries) {
  if (!entry.id || !entry.passage || !entry.resource?.id || !entry.source) fail('Entrée incomplète')
  if (!/^\d+-\d+-\d+$/.test(entry.passage)) fail(`Passage invalide : ${entry.passage}`)
  if (!resourceIds.has(entry.resource.id)) fail(`Ressource absente du catalogue : ${entry.resource.id}`)
  const identity = `${entry.resource.id}:${entry.id}:${entry.passage}`
  if (identities.has(identity)) fail(`Identité dupliquée : ${identity}`)
  identities.add(identity)
  for (const content of [entry.source, entry.translation].filter(Boolean)) {
    if ('status' in content) fail(`Statut éditorial obsolète : ${identity}`)
    if (/\b(?:machine-draft|human review|unreviewed|needs-review|review_level)\b|révision humaine|relecture humaine|à réviser/iu.test(content.provenance ?? '')) {
      fail(`Mention de revue obsolète : ${identity}`)
    }
  }
  if (entry.translation?.html) inspectTranslation({ sourceHtml: entry.source.html, translationHtml: entry.translation.html })
}

for (const required of ['acbc', 'barnes', 'mhy-fr', 'aquifer-fr']) {
  if (!dataset.entries.some(entry => entry.resource.id === required)) fail(`Échantillon requis absent : ${required}`)
}

if (audit.remoteWrites !== false || audit.passagesVisited !== 30826) fail('Le manifeste doit prouver un audit complet en lecture seule')
for (const code of ['acbc', 'barnes']) {
  const [missing, quality] = await Promise.all([
    readJson(`data/audit/missing-${code}.json`),
    readJson(`data/audit/quality-${code}.json`),
  ])
  const summary = audit.resources[code]
  if (missing.count !== missing.entries.length || missing.count !== summary.missingCount) fail(`Compte des absences incohérent : ${code}`)
  if (quality.entries.length !== summary.issueCount) fail(`Compte QA incohérent : ${code}`)
  if (summary.sourceCount !== summary.translatedCount + summary.missingCount) fail(`Couverture incohérente : ${code}`)
  if (summary.duplicateSourceIdCount !== 0 || summary.invalidIdentityCount !== 0) fail(`Identités source invalides : ${code}`)
}

process.stdout.write(`Workflow des commentaires valide : ${catalog.resources.length} ressources cataloguées, ${dataset.entries.length} unités locales, audit ACBC/Barnes exhaustif.\n`)
