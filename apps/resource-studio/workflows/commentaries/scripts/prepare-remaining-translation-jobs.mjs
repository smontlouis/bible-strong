#!/usr/bin/env node

import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadPublishedTranslations } from './published-translations.mjs'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const prototypeRoot = path.resolve(scriptDirectory, '..')
const sourceRoot = path.join(prototypeRoot, '.local/full-export/missing')
const translationsRoot = path.join(prototypeRoot, 'data/translations/published')
const jobsRoot = path.join(prototypeRoot, '.local/translation-jobs')
const maxSourceChars = Number(process.argv[2] ?? 18_000)

const readJson = async file => JSON.parse(await readFile(file, 'utf8'))
const sanitizeTranslationSourceHtml = html => {
  const withoutStudyLightChrome = html.replace(
    /<div\b[^>]*\bclass=["'][^"']*\btopline\b[^"']*["'][^>]*>[\s\S]*$/iu,
    '',
  )

  return withoutStudyLightChrome
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/giu, '')
    .replace(/<(iframe|object|embed|applet)\b[^>]*>[\s\S]*?<\/\1\s*>/giu, '')
    .replace(/<(iframe|object|embed|applet)\b[^>]*\/?>/giu, '')
    .replace(/<div\b[^>]*\bid=["']ld-[^"']+["'][^>]*>\s*<\/div>/giu, '')
}
const filesIn = async directory => {
  try {
    return (await readdir(directory)).filter(name => name.endsWith('.json')).sort()
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
}

for (const resourceId of ['acbc', 'barnes']) {
  const sourceEntries = await readJson(path.join(sourceRoot, `${resourceId}.json`))
  const { translationsBySourceSha256 } = await loadPublishedTranslations(translationsRoot, resourceId)
  const groups = new Map()
  for (const entry of sourceEntries) {
    const group = groups.get(entry.sourceSha256) ?? []
    group.push(entry)
    groups.set(entry.sourceSha256, group)
  }

  const directory = path.join(jobsRoot, resourceId)
  await mkdir(directory, { recursive: true })

  const publishedFilenames = new Set(await filesIn(path.join(translationsRoot, resourceId)))
  for (const filename of await filesIn(directory)) {
    if (filename.startsWith(`${resourceId}-high-`) && !publishedFilenames.has(filename)) {
      await unlink(path.join(directory, filename))
    }
  }

  // A job is the immutable evidence used to validate a published translation. Reconstruct
  // existing jobs first so preparing a later wave can never invalidate them.
  for (const filename of await filesIn(path.join(translationsRoot, resourceId))) {
    const publication = await readJson(path.join(translationsRoot, resourceId, filename))
    const entries = publication.entries.map(translated => {
      const group = groups.get(translated.sourceSha256)
      const source = group?.find(entry => entry.id === translated.id) ?? group?.[0]
      if (!source || source.sourceSha256 !== translated.sourceSha256) {
        throw new Error(`Source introuvable pour la traduction ${resourceId}/${translated.id}`)
      }
      return {
        ...source,
        sourceHtml: sanitizeTranslationSourceHtml(source.sourceHtml),
        id: translated.id,
        passage: translated.passage,
        targets: group.map(({ id, passage }) => ({ id, passage })),
      }
    })
    const payload = {
      schemaVersion: 1,
      resourceId,
      batchId: publication.batchId,
      requestedTranslator: publication.translator,
      deduplicatedBy: 'sourceSha256',
      sourceCharacters: entries.reduce((total, entry) => total + entry.sourceHtml.length, 0),
      targetCount: entries.reduce((total, entry) => total + entry.targets.length, 0),
      entries,
    }
    await writeFile(path.join(directory, filename), `${JSON.stringify(payload, null, 2)}\n`)
  }

  const uniqueEntries = [...groups.values()]
    .filter(group => !translationsBySourceSha256.has(group[0].sourceSha256))
    .map(group => ({
      ...group[0],
      sourceHtml: sanitizeTranslationSourceHtml(group[0].sourceHtml),
      targets: group.map(({ id, passage }) => ({ id, passage })),
    }))

  const batches = []
  let current = []
  let currentCharacters = 0
  for (const entry of uniqueEntries) {
    const characters = entry.sourceHtml.length
    if (current.length && currentCharacters + characters > maxSourceChars) {
      batches.push(current)
      current = []
      currentCharacters = 0
    }
    current.push(entry)
    currentCharacters += characters
  }
  if (current.length) batches.push(current)

  for (const entries of batches) {
    const batchId = `${resourceId}-high-${entries[0].sourceSha256.slice(0, 12)}`
    const payload = {
      schemaVersion: 1,
      resourceId,
      batchId,
      requestedTranslator: {
        provider: 'OpenAI',
        model: 'gpt-5.6-luna',
        reasoningEffort: 'high',
      },
      deduplicatedBy: 'sourceSha256',
      sourceCharacters: entries.reduce((total, entry) => total + entry.sourceHtml.length, 0),
      targetCount: entries.reduce((total, entry) => total + entry.targets.length, 0),
      entries,
    }
    await writeFile(path.join(directory, `${batchId}.json`), `${JSON.stringify(payload, null, 2)}\n`)
  }
  process.stdout.write(`${resourceId}: ${uniqueEntries.length} textes uniques restants / ${batches.length} lots / ${sourceEntries.length} rattachements initiaux\n`)
}
