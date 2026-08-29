#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  BIBLE_ANNOTEE_NEW_TESTAMENT,
  BIBLE_ANNOTEE_OLD_TESTAMENT,
  decodeTheotex,
  extractNewTestamentPageLinks,
  parseNewTestamentCommentary,
  parseNewTestamentIntroduction,
  parseOldTestamentCommentary,
} from './bible-annotee-sources.mjs'
import { sha256 } from './wave-sources.mjs'

const prototypeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const parseArguments = argv => {
  const options = {
    cache: path.join(prototypeRoot, '.local/sources/theotex-bible-annotee'),
    output: path.join(prototypeRoot, '.local/bible-annotee-export'),
    concurrency: 8,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--cache') options.cache = path.resolve(argv[++index])
    else if (argument === '--output') options.output = path.resolve(argv[++index])
    else if (argument === '--concurrency') options.concurrency = Number(argv[++index])
    else throw new Error(`Argument inconnu : ${argument}`)
  }
  if (!Number.isInteger(options.concurrency) || options.concurrency < 1 || options.concurrency > 16) {
    throw new Error('--concurrency doit être compris entre 1 et 16')
  }
  return options
}

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))

const fetchCached = async ({ url, cachePath }) => {
  try {
    const bytes = await readFile(cachePath)
    return { bytes, cacheHit: true }
  } catch {}

  let lastError
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { 'user-agent': 'BibleStrongCommentaryAudit/1.0 (+https://bible-strong.app)' } })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const bytes = Buffer.from(await response.arrayBuffer())
      await mkdir(path.dirname(cachePath), { recursive: true })
      await writeFile(cachePath, bytes)
      return { bytes, cacheHit: false }
    } catch (error) {
      lastError = error
      if (attempt < 4) await delay(attempt * 500)
    }
  }
  throw new Error(`Téléchargement impossible après 4 essais : ${url} (${lastError?.message})`)
}

const runPool = async ({ items, concurrency, worker }) => {
  let cursor = 0
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++
      await worker(items[index], index)
    }
  })
  await Promise.all(runners)
}

const main = async () => {
  const options = parseArguments(process.argv.slice(2))
  await mkdir(options.output, { recursive: true })
  const entries = []
  const sources = []
  let cacheHits = 0
  let downloads = 0
  const sourceGaps = []

  const recordSource = ({ url, cachePath, bytes, entryCount, section, book }) => {
    sources.push({
      section,
      book,
      url,
      cachePath: path.relative(options.cache, cachePath),
      sha256: sha256(bytes),
      byteLength: bytes.length,
      entryCount,
    })
  }

  const oldTestamentPages = BIBLE_ANNOTEE_OLD_TESTAMENT.flatMap(book =>
    Array.from({ length: book.chapters }, (_, index) => {
      const chapter = index + 1
      return {
        ...book,
        chapter,
        url: `https://theotex.org/ba/ba_${book.slug}/${book.slug}${chapter}_c.html`,
        cachePath: path.join(options.cache, 'at', book.slug, `${chapter}_c.html`),
      }
    })
  )
  process.stderr.write(`Bible Annotée AT : ${oldTestamentPages.length} chapitres…\n`)
  let oldDone = 0
  await runPool({
    items: oldTestamentPages,
    concurrency: options.concurrency,
    worker: async page => {
      const fetched = await fetchCached(page)
      fetched.cacheHit ? cacheHits++ : downloads++
      const parsed = parseOldTestamentCommentary({
        html: decodeTheotex(fetched.bytes),
        book: page.book,
        chapter: page.chapter,
        sourceUrl: page.url,
      })
      if (parsed.length === 0) throw new Error(`Aucune note AT extraite : ${page.url}`)
      entries.push(...parsed)
      recordSource({ ...page, bytes: fetched.bytes, entryCount: parsed.length, section: 'OT' })
      oldDone++
      if (oldDone % 100 === 0 || oldDone === oldTestamentPages.length) process.stderr.write(`  AT ${oldDone}/${oldTestamentPages.length}\n`)
    },
  })

  process.stderr.write('Bible Annotée NT : plans et introductions de 27 livres…\n')
  const newTestamentPages = []
  for (const book of BIBLE_ANNOTEE_NEW_TESTAMENT) {
    const planUrl = `https://theotex.org/nta/${book.slug}/${book.slug}_pl.html`
    const planCachePath = path.join(options.cache, 'nt', book.slug, `${book.slug}_pl.html`)
    const plan = await fetchCached({ url: planUrl, cachePath: planCachePath })
    plan.cacheHit ? cacheHits++ : downloads++
    const links = extractNewTestamentPageLinks({ html: decodeTheotex(plan.bytes), slug: book.slug })
    if (links.length === 0) throw new Error(`Aucune page NT trouvée dans ${planUrl}`)
    recordSource({ url: planUrl, cachePath: planCachePath, bytes: plan.bytes, entryCount: 0, section: 'NT-plan', book: book.book })
    for (const link of links) newTestamentPages.push({
      ...book,
      url: `https://theotex.org/nta/${book.slug}/${link}`,
      cachePath: path.join(options.cache, 'nt', book.slug, link),
    })

    const introductionUrl = `https://theotex.org/nta/intros_nta/intro_${book.slug}.html`
    const introductionCachePath = path.join(options.cache, 'nt', 'introductions', `intro_${book.slug}.html`)
    const introduction = await fetchCached({ url: introductionUrl, cachePath: introductionCachePath })
    introduction.cacheHit ? cacheHits++ : downloads++
    const parsedIntroduction = parseNewTestamentIntroduction({ html: decodeTheotex(introduction.bytes), book: book.book, sourceUrl: introductionUrl })
    if (parsedIntroduction.length === 0) throw new Error(`Introduction NT vide : ${introductionUrl}`)
    entries.push(...parsedIntroduction)
    recordSource({ url: introductionUrl, cachePath: introductionCachePath, bytes: introduction.bytes, entryCount: parsedIntroduction.length, section: 'NT-introduction', book: book.book })
  }

  process.stderr.write(`Bible Annotée NT : ${newTestamentPages.length} pages de commentaires…\n`)
  let newDone = 0
  await runPool({
    items: newTestamentPages,
    concurrency: options.concurrency,
    worker: async page => {
      const fetched = await fetchCached(page)
      fetched.cacheHit ? cacheHits++ : downloads++
      const parsed = parseNewTestamentCommentary({ html: decodeTheotex(fetched.bytes), book: page.book, sourceUrl: page.url })
      if (parsed.length === 0) sourceGaps.push({ url: page.url, reason: 'La page ThéoTeX ne contient aucune ligne de note exploitable.' })
      entries.push(...parsed)
      recordSource({ ...page, bytes: fetched.bytes, entryCount: parsed.length, section: 'NT' })
      newDone++
      if (newDone % 100 === 0 || newDone === newTestamentPages.length) process.stderr.write(`  NT ${newDone}/${newTestamentPages.length}\n`)
    },
  })

  const uniqueEntries = [...new Map(entries.map(entry => [`${entry.passage}:${entry.translation.sha256}`, entry])).values()]
  uniqueEntries.sort((left, right) => left.passage.localeCompare(right.passage, 'fr', { numeric: true }) || left.id.localeCompare(right.id, 'fr', { numeric: true }))
  const duplicateIds = uniqueEntries.filter((entry, index) => index > 0 && entry.id === uniqueEntries[index - 1].id)
  if (duplicateIds.length) throw new Error(`${duplicateIds.length} identifiants dupliqués, premier : ${duplicateIds[0].id}`)

  sources.sort((left, right) => left.url.localeCompare(right.url))
  const corpusPayload = `${JSON.stringify(uniqueEntries)}\n`
  const corpusPath = path.join(options.output, 'bible-annotee.json')
  await writeFile(corpusPath, corpusPayload)
  const counts = {
    entries: uniqueEntries.length,
    exactDuplicatesRemoved: entries.length - uniqueEntries.length,
    oldTestamentEntries: uniqueEntries.filter(entry => Number(entry.passage.split('-')[0]) <= 39).length,
    newTestamentEntries: uniqueEntries.filter(entry => Number(entry.passage.split('-')[0]) >= 40).length,
    chapterIntroductions: uniqueEntries.filter(entry => entry.editorialKind === 'chapter-introduction').length,
    bookIntroductions: uniqueEntries.filter(entry => entry.editorialKind === 'book-introduction').length,
    books: new Set(uniqueEntries.map(entry => entry.passage.split('-')[0])).size,
    sourcePages: sources.length,
    sourceGaps: sourceGaps.length,
  }
  const manifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    resourceId: 'bible-annotee',
    provider: 'ThéoTeX',
    authorization: {
      status: 'confirmed-by-project-owner',
      confirmedAt: '2026-08-28',
      scope: 'Usage, transformation et redistribution dans Bible Strong confirmés par le responsable du projet ; pièce d’archive à rattacher au manifeste.',
    },
    format: 'commentary-json-v1',
    counts,
    corpus: { path: 'bible-annotee.json', sha256: sha256(corpusPayload), byteLength: Buffer.byteLength(corpusPayload) },
    sourceRoots: ['https://theotex.org/ba/', 'https://theotex.org/nta/'],
    sourceGaps,
    sourcePages: sources,
  }
  await writeFile(path.join(options.output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  process.stdout.write(`${JSON.stringify({ output: options.output, counts, cacheHits, downloads, corpusSha256: manifest.corpus.sha256 }, null, 2)}\n`)
}

main().catch(error => {
  process.stderr.write(`${error.stack ?? error.message}\n`)
  process.exitCode = 1
})
