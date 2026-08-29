#!/usr/bin/env node

import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readJson } from './published-translations.mjs'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const prototypeRoot = path.resolve(scriptDirectory, '..')
const jobsRoot = path.join(prototypeRoot, '.local/translation-jobs')
const translationsRoot = path.join(prototypeRoot, 'data/translations/published')
const blockedTags = new Set(['applet', 'embed', 'iframe', 'object', 'script', 'style'])

const filesIn = async directory => {
  try {
    return (await readdir(directory)).filter(name => name.endsWith('.json')).sort()
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
}

const tagNames = html => [...html.matchAll(/<\/?([a-z][a-z0-9]*)\b/gi)].map(match => match[1].toLowerCase())

let batchCount = 0
let entryCount = 0
for (const resourceId of await readdir(translationsRoot)) {
  for (const filename of await filesIn(path.join(translationsRoot, resourceId))) {
    const [job, publication] = await Promise.all([
      readJson(path.join(jobsRoot, resourceId, filename)),
      readJson(path.join(translationsRoot, resourceId, filename)),
    ])
    if (publication.schemaVersion !== 1 || publication.resourceId !== resourceId || publication.batchId !== job.batchId) {
      throw new Error(`Métadonnées incohérentes : ${resourceId}/${filename}`)
    }
    const expectedTranslator = job.requestedTranslator ?? {
      provider: 'OpenAI',
      model: 'gpt-5.6-luna',
      reasoningEffort: 'xhigh',
    }
    if (
      publication.translator?.provider !== expectedTranslator.provider ||
      publication.translator?.model !== expectedTranslator.model ||
      publication.translator?.reasoningEffort !== expectedTranslator.reasoningEffort
    ) {
      throw new Error(`Traducteur inattendu : ${resourceId}/${filename}`)
    }
    if ('status' in publication || publication.entries.length !== job.entries.length) {
      throw new Error(`Lot incomplet : ${resourceId}/${filename}`)
    }
    const translationsById = new Map(publication.entries.map(entry => [entry.id, entry]))
    if (translationsById.size !== publication.entries.length) throw new Error(`Identifiants dupliqués : ${resourceId}/${filename}`)

    for (const source of job.entries) {
      const translated = translationsById.get(source.id)
      if (!translated || translated.passage !== source.passage || translated.sourceSha256 !== source.sourceSha256) {
        throw new Error(`Identité source perdue : ${resourceId}/${source.id}`)
      }
      if ('status' in translated || !translated.translatedHtml?.trim()) {
        throw new Error(`Traduction absente : ${resourceId}/${source.id}`)
      }
      const sourceTags = tagNames(source.sourceHtml)
      const translatedTags = tagNames(translated.translatedHtml)
      const invalidTag = translatedTags.find(tag => blockedTags.has(tag))
      if (invalidTag) throw new Error(`Balise HTML non autorisée <${invalidTag}> : ${resourceId}/${source.id}`)
      if (sourceTags.join('\u0000') !== translatedTags.join('\u0000')) {
        throw new Error(`Structure HTML modifiée : ${resourceId}/${source.id}`)
      }
    }
    batchCount += 1
    entryCount += publication.entries.length
  }
}

process.stdout.write(`Traductions publiées valides : ${entryCount} traductions dans ${batchCount} lots Luna traçables.\n`)
