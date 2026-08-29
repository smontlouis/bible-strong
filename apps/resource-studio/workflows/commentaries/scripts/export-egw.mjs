#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  EGW_COMMENTARY_VOLUMES,
  EGW_SCRIPTURE_INDEX,
  mergeEgwLayers,
  parseCommentaryPage,
  parseCommentaryToc,
  parseScriptureIndexPage,
  parseScriptureIndexToc,
} from './egw-sources.mjs'
import { sha256 } from './wave-sources.mjs'

const prototypeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const parseArguments = argv => {
  const options = {
    cache: path.join(prototypeRoot, '.local/sources/egw-writings'),
    output: path.join(prototypeRoot, '.local/egw-export'),
    concurrency: 6,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--cache') options.cache = path.resolve(argv[++index])
    else if (argument === '--output') options.output = path.resolve(argv[++index])
    else if (argument === '--concurrency') options.concurrency = Number(argv[++index])
    else throw new Error(`Argument inconnu : ${argument}`)
  }
  if (!Number.isInteger(options.concurrency) || options.concurrency < 1 || options.concurrency > 10) throw new Error('--concurrency doit être compris entre 1 et 10')
  return options
}

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))

const fetchCached = async ({ url, cachePath }) => {
  try {
    return { bytes: await readFile(cachePath), cacheHit: true }
  } catch {}
  let lastError
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { 'user-agent': 'BibleStrongEGWImporter/1.0 (+https://bible-strong.app)' } })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const bytes = Buffer.from(await response.arrayBuffer())
      await mkdir(path.dirname(cachePath), { recursive: true })
      await writeFile(cachePath, bytes)
      return { bytes, cacheHit: false }
    } catch (error) {
      lastError = error
      if (attempt < 5) await delay(attempt * 800)
    }
  }
  throw new Error(`Téléchargement impossible : ${url} (${lastError?.message})`)
}

const runPool = async ({ items, concurrency, worker }) => {
  let cursor = 0
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++
      await worker(items[index], index)
    }
  }))
}

const writeJson = async (output, filename, value) => {
  const payload = `${JSON.stringify(value)}\n`
  await writeFile(path.join(output, filename), payload)
  return { path: filename, sha256: sha256(payload), byteLength: Buffer.byteLength(payload) }
}

const main = async () => {
  const options = parseArguments(process.argv.slice(2))
  await mkdir(options.output, { recursive: true })
  let cacheHits = 0
  let downloads = 0
  const sourcePages = []
  const commentaryPages = []

  process.stderr.write('EGW : lecture des tables des matières 1BC–7BC…\n')
  for (const volume of EGW_COMMENTARY_VOLUMES) {
    const url = `https://text.egwwritings.org/book/b${volume.bookId}`
    const cachePath = path.join(options.cache, 'toc', `b${volume.bookId}.html`)
    const fetched = await fetchCached({ url, cachePath })
    fetched.cacheHit ? cacheHits++ : downloads++
    const pages = parseCommentaryToc({ html: fetched.bytes.toString('utf8'), ...volume })
    if (pages.length === 0) throw new Error(`Table des matières vide pour ${volume.code}`)
    commentaryPages.push(...pages)
    sourcePages.push({ kind: 'toc', code: volume.code, url, sha256: sha256(fetched.bytes), byteLength: fetched.bytes.length, pageCount: pages.length })
  }

  const commentary = []
  process.stderr.write(`EGW : extraction de ${commentaryPages.length} chapitres 1BC–7BC…\n`)
  let commentaryDone = 0
  await runPool({
    items: commentaryPages,
    concurrency: options.concurrency,
    worker: async page => {
      const url = `https://text.egwwritings.org/read/${page.pageId}`
      const cachePath = path.join(options.cache, 'commentary', page.code, `${page.pageId}.html`)
      const fetched = await fetchCached({ url, cachePath })
      fetched.cacheHit ? cacheHits++ : downloads++
      const entries = parseCommentaryPage({ html: fetched.bytes.toString('utf8'), page })
      commentary.push(...entries)
      sourcePages.push({ kind: 'commentary', code: page.code, pageId: page.pageId, bookName: page.bookName, chapter: page.chapter, url, sha256: sha256(fetched.bytes), byteLength: fetched.bytes.length, entryCount: entries.length })
      commentaryDone++
      if (commentaryDone % 100 === 0 || commentaryDone === commentaryPages.length) process.stderr.write(`  BC ${commentaryDone}/${commentaryPages.length}\n`)
    },
  })

  process.stderr.write('EGW : lecture de la table des matières ECSI…\n')
  const indexTocUrl = `https://text.egwwritings.org/book/b${EGW_SCRIPTURE_INDEX.bookId}`
  const indexTocPath = path.join(options.cache, 'toc', `b${EGW_SCRIPTURE_INDEX.bookId}.html`)
  const indexToc = await fetchCached({ url: indexTocUrl, cachePath: indexTocPath })
  indexToc.cacheHit ? cacheHits++ : downloads++
  const indexPages = parseScriptureIndexToc(indexToc.bytes.toString('utf8'))
  if (indexPages.length === 0) throw new Error('Table des matières ECSI vide')
  sourcePages.push({ kind: 'toc', code: 'ECSI', url: indexTocUrl, sha256: sha256(indexToc.bytes), byteLength: indexToc.bytes.length, pageCount: indexPages.length })

  const scriptureIndex = []
  process.stderr.write(`EGW : extraction de ${indexPages.length} chapitres ECSI…\n`)
  let indexDone = 0
  await runPool({
    items: indexPages,
    concurrency: options.concurrency,
    worker: async page => {
      const url = `https://text.egwwritings.org/read/${page.pageId}`
      const cachePath = path.join(options.cache, 'scripture-index', `${page.pageId}.html`)
      const fetched = await fetchCached({ url, cachePath })
      fetched.cacheHit ? cacheHits++ : downloads++
      const entries = parseScriptureIndexPage({ html: fetched.bytes.toString('utf8'), page })
      scriptureIndex.push(...entries)
      sourcePages.push({ kind: 'scripture-index', pageId: page.pageId, bookName: page.bookName, chapter: page.chapter, url, sha256: sha256(fetched.bytes), byteLength: fetched.bytes.length, entryCount: entries.length, citationCount: entries.reduce((sum, entry) => sum + entry.citations.length, 0) })
      indexDone++
      if (indexDone % 100 === 0 || indexDone === indexPages.length) process.stderr.write(`  ECSI ${indexDone}/${indexPages.length}\n`)
    },
  })

  commentary.sort((left, right) => left.passage.localeCompare(right.passage, 'en', { numeric: true }) || left.id.localeCompare(right.id))
  scriptureIndex.sort((left, right) => left.passage.localeCompare(right.passage, 'en', { numeric: true }) || left.id.localeCompare(right.id))
  const merged = mergeEgwLayers({ commentary, scriptureIndex })
  const citations = scriptureIndex.reduce((sum, entry) => sum + entry.citations.length, 0)
  const uniqueCitationTargets = new Set(scriptureIndex.flatMap(entry => entry.citations.map(citation => citation.paragraphId))).size
  const books = new Set([...commentary, ...scriptureIndex].map(entry => entry.passage.split('-')[0])).size
  const artifacts = {
    commentary: await writeJson(options.output, 'egw-sda-bible-commentary-1-7.json', commentary),
    scriptureIndex: await writeJson(options.output, 'egw-complete-scripture-index.json', scriptureIndex),
    merged: await writeJson(options.output, 'egw-merged.json', merged),
  }
  sourcePages.sort((left, right) => left.url.localeCompare(right.url))
  const manifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    provider: 'Ellen G. White Estate · EGW Writings',
    authorization: { status: 'confirmed-by-project-owner', confirmedAt: '2026-08-28', scope: 'Extraction, transformation et usage dans Bible Strong confirmés par le responsable du projet ; pièces d’approbation à archiver dans le registre de provenance.' },
    scope: { included: ['EGW SDA Bible Commentary 1BC–7BC', 'EGW Complete Scripture Index'], excluded: ['SDA Bible Commentary général hors extraits EGW'] },
    semantics: { curatedCommentary: 'Texte éditorial EGW des volumes 1BC–7BC.', scriptureIndex: 'Associations exhaustives vers des paragraphes EGW ; une association n’est pas automatiquement un commentaire exégétique.' },
    counts: { books, commentaryPages: commentaryPages.length, commentaryEntries: commentary.length, scriptureIndexPages: indexPages.length, scriptureIndexEntries: scriptureIndex.length, citations, uniqueCitationTargets, mergedPassageAnchors: merged.length },
    artifacts,
    cache: { hits: cacheHits, downloads },
    sourcePages,
  }
  await writeFile(path.join(options.output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  process.stdout.write(`${JSON.stringify({ output: options.output, counts: manifest.counts, cache: manifest.cache, artifacts }, null, 2)}\n`)
}

main().catch(error => {
  process.stderr.write(`${error.stack ?? error.message}\n`)
  process.exitCode = 1
})
