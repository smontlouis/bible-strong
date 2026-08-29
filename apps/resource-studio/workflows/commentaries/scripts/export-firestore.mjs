#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createFirestoreReader, sha256 } from './firestore.mjs'
import { inspectTranslation } from './quality.mjs'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const prototypeRoot = path.resolve(scriptDirectory, '..')

const parseArguments = argv => {
  const values = {
    output: path.join(prototypeRoot, '.local', 'firestore-export'),
    codes: ['acbc', 'barnes'],
    concurrency: 80,
    verses: null,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--output') values.output = path.resolve(argv[++index])
    else if (argument === '--codes') values.codes = argv[++index].split(',').filter(Boolean)
    else if (argument === '--concurrency') values.concurrency = Number(argv[++index])
    else if (argument === '--verses') values.verses = argv[++index].split(',').filter(Boolean)
    else if (argument === '--help') values.help = true
    else throw new Error(`Argument inconnu : ${argument}`)
  }
  return values
}

const usage = `Usage: node scripts/export-firestore.mjs [options]

Options:
  --output <dossier>       Dossier JSON local (défaut: .local/firestore-export)
  --codes acbc,barnes      Codes des commentaires à exporter
  --concurrency <nombre>   Lectures Firestore parallèles (défaut: 80)
  --verses 1-1-1,43-3-16  Limiter à une liste de passages pour un échantillon
  --help                   Afficher cette aide
`

const chunk = (values, size) => {
  const chunks = []
  for (let index = 0; index < values.length; index += size) chunks.push(values.slice(index, index + size))
  return chunks
}

const runPool = async (items, concurrency, task, onProgress) => {
  let cursor = 0
  let completed = 0
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++]
      await task(item)
      completed += 1
      onProgress?.(completed, items.length)
    }
  })
  await Promise.all(workers)
}

const writeJson = async (filePath, value) => {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

const main = async () => {
  const options = parseArguments(process.argv.slice(2))
  if (options.help) {
    process.stdout.write(usage)
    return
  }
  if (!Number.isInteger(options.concurrency) || options.concurrency < 1 || options.concurrency > 200) {
    throw new Error('--concurrency doit être compris entre 1 et 200')
  }

  const reader = createFirestoreReader()
  const verseIds = options.verses ?? (await reader.listDocumentIds('verse-commentaries'))
  const comments = []
  const startedAt = new Date().toISOString()
  process.stderr.write(`Export de ${verseIds.length} passages pour ${options.codes.join(', ')}…\n`)

  await runPool(
    verseIds,
    options.concurrency,
    async verseId => {
      for (const comment of await reader.queryCommentaries(verseId, options.codes)) {
        comments.push({ ...comment, verseId })
      }
    },
    (done, total) => {
      if (done % 2000 === 0 || done === total) process.stderr.write(`  ${done}/${total} passages\n`)
    }
  )

  comments.sort((left, right) =>
    left.verseId.localeCompare(right.verseId, 'en', { numeric: true }) || left.id - right.id
  )

  const translations = new Map()
  const batches = chunk(comments.map(comment => String(comment.id)), 250)
  process.stderr.write(`Lecture de ${comments.length} traductions potentielles…\n`)
  await runPool(batches, 8, async ids => {
    for (const [id, value] of await reader.batchGetFrench(ids)) translations.set(id, value)
  })

  const byCode = Object.fromEntries(options.codes.map(code => [code, []]))
  for (const comment of comments) {
    const code = comment.resource?.code
    if (!byCode[code]) continue
    const french = translations.get(String(comment.id)) ?? { exists: false, content: '' }
    const quality = french.exists
      ? inspectTranslation({ sourceHtml: comment.content ?? '', translationHtml: french.content })
      : null
    byCode[code].push({
      schemaVersion: 1,
      id: String(comment.id),
      passage: comment.verseId,
      resource: {
        id: code,
        name: comment.resource?.name ?? code,
        author: comment.resource?.author ?? null,
        sourceLanguage: 'en',
        license: 'PublicDomain',
      },
      source: {
        language: 'en',
        html: comment.content ?? '',
        sha256: sha256(comment.content ?? ''),
        provenance: 'Firestore verse-commentaries snapshot',
      },
      translation: french.exists
        ? {
            language: 'fr',
            html: french.content,
            sha256: quality.translationSha256,
            provenance: 'Firestore commentaries-FR snapshot; generation method unknown',
            quality,
          }
        : null,
    })
  }

  const manifest = {
    schemaVersion: 1,
    projectId: 'bible-strong-app',
    startedAt,
    completedAt: new Date().toISOString(),
    mode: options.verses ? 'sample' : 'complete',
    passagesVisited: verseIds.length,
    outputContainsRemoteSnapshot: true,
    remoteWrites: false,
    resources: {},
  }

  for (const [code, entries] of Object.entries(byCode)) {
    const missing = entries
      .filter(entry => !entry.translation)
      .map(entry => ({ id: entry.id, passage: entry.passage, sourceSha256: entry.source.sha256, sourceHtml: entry.source.html }))
    const issues = entries
      .filter(entry => entry.translation?.quality.issues.length)
      .map(entry => ({ id: entry.id, passage: entry.passage, ...entry.translation.quality }))
    const duplicateTranslations = Object.entries(
      entries.reduce((groups, entry) => {
        const hash = entry.translation?.sha256
        if (hash) (groups[hash] ??= []).push(entry.id)
        return groups
      }, {})
    )
      .filter(([, ids]) => ids.length > 1)
      .map(([translationSha256, ids]) => ({ translationSha256, ids }))

    manifest.resources[code] = {
      sourceCount: entries.length,
      translatedCount: entries.length - missing.length,
      missingCount: missing.length,
      coveragePercent: entries.length
        ? Number((((entries.length - missing.length) / entries.length) * 100).toFixed(2))
        : 0,
      issueCount: issues.length,
      duplicateTranslationGroups: duplicateTranslations.length,
      contentSha256: sha256(JSON.stringify(entries)),
    }

    await writeJson(path.join(options.output, 'comments', `${code}.json`), entries)
    await writeJson(path.join(options.output, 'missing', `${code}.json`), missing)
    await writeJson(path.join(options.output, 'quality', `${code}.json`), {
      issues,
      duplicateTranslations,
    })
  }

  await writeJson(path.join(options.output, 'manifest.json'), manifest)
  process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`)
}

main().catch(error => {
  process.stderr.write(`${error.stack ?? error.message}\n`)
  process.exitCode = 1
})
