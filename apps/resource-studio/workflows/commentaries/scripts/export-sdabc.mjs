#!/usr/bin/env node

import { execFile } from 'node:child_process'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import {
  BIBLE_BOOKS,
  BIBLE_CHAPTER_COUNTS,
  SDABC_ITEM_URL,
  SDABC_METADATA_URL,
  parseBookIntroduction,
  parseChapterCommentary,
  selectBiblePdfs,
  sha256,
  splitBookChapters,
  splitCombinedJohn,
} from './sdabc-sources.mjs'

const execFileAsync = promisify(execFile)
const prototypeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceRoot = path.resolve(process.argv[2] ?? path.join(prototypeRoot, '.local/sources/sdabc-1978'))
const outputRoot = path.resolve(process.argv[3] ?? path.join(prototypeRoot, '.local/sdabc-export'))
const libraryIndexPath = path.join(prototypeRoot, '.local/library/index.json')

const fetchJson = async url => {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${response.status} en lisant ${url}`)
  return response.json()
}

const download = async source => {
  const target = path.join(sourceRoot, source.name)
  try {
    if ((await stat(target)).size === source.size) return target
  } catch {}
  await execFileAsync('curl', ['-L', '--fail', '--retry', '4', '--retry-delay', '2', '-o', `${target}.part`, source.url], { maxBuffer: 1024 * 1024 })
  if ((await stat(`${target}.part`)).size !== source.size) throw new Error(`Taille inattendue pour ${source.name}`)
  await execFileAsync('mv', [`${target}.part`, target])
  return target
}

const pool = async (items, concurrency, task) => {
  const results = new Array(items.length)
  let cursor = 0
  const workers = Array.from({ length: concurrency }, async () => {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await task(items[index], index)
    }
  })
  await Promise.all(workers)
  return results
}

await mkdir(sourceRoot, { recursive: true })
await mkdir(outputRoot, { recursive: true })

const metadata = await fetchJson(SDABC_METADATA_URL)
const sources = selectBiblePdfs(metadata)
process.stdout.write(`Téléchargement/vérification de ${sources.length} PDF SDABC…\n`)
await pool(sources, 4, async (source, index) => {
  await download(source)
  process.stdout.write(`[${index + 1}/${sources.length}] ${source.name}\n`)
})

const libraryIndex = JSON.parse(await readFile(libraryIndexPath, 'utf8'))
const canonical = new Map()
for (const chapter of libraryIndex.chapters) {
  if (chapter.book < 1 || chapter.book > 66) continue
  const verses = chapter.passages
    .map(passage => Number(passage.split('-')[2]))
    .filter(verse => Number.isInteger(verse) && verse > 0)
  if (verses.length) canonical.set(`${chapter.book}-${chapter.chapter}`, Math.max(...verses))
}

const entries = []
const audit = []
const sourceRecords = []
for (const source of sources) {
  const pdfPath = path.join(sourceRoot, source.name)
  const textPath = `${pdfPath}.txt`
  await execFileAsync('pdftotext', ['-layout', '-enc', 'UTF-8', pdfPath, textPath], { maxBuffer: 1024 * 1024 })
  const pdf = await readFile(pdfPath)
  const text = await readFile(textPath, 'utf8')
  sourceRecords.push({ ...source, sha256: sha256(pdf) })
  const bookTexts = source.firstBook === 63 && source.lastBook === 64
    ? splitCombinedJohn(text)
    : { [source.firstBook]: text }

  for (const [bookKey, bookText] of Object.entries(bookTexts)) {
    const book = Number(bookKey)
    const chapterCount = BIBLE_CHAPTER_COUNTS[book - 1]
    if (!chapterCount) throw new Error(`Métadonnées canoniques absentes pour ${book}`)
    let normalizedBookText = bookText
    if (book === 62 && !/^\s*CHAPTER\s+2\s*$/im.test(normalizedBookText)) {
      const firstSupplement = /^\s*ELLEN G\. WHITE COMMENTS\s*$/im.exec(normalizedBookText)
      const firstVerseAfterSupplement = firstSupplement
        ? /^ {0,16}1\.\s+\S.*$/m.exec(normalizedBookText.slice(firstSupplement.index + firstSupplement[0].length))
        : null
      if (!firstVerseAfterSupplement) throw new Error('Point de départ de 1 Jean 2 introuvable')
      const insertion = firstSupplement.index + firstSupplement[0].length + firstVerseAfterSupplement.index
      normalizedBookText = `${normalizedBookText.slice(0, insertion)}\nCHAPTER 2\n${normalizedBookText.slice(insertion)}`
    }
    const chapters = splitBookChapters({ text: normalizedBookText, chapterCount })
    const introduction = parseBookIntroduction({ text: chapters[0].introduction, book })
    if (introduction) entries.push(introduction)
    for (const chapterBlock of chapters) {
      const maxVerse = canonical.get(`${book}-${chapterBlock.chapter}`)
      const parsed = parseChapterCommentary({
        text: chapterBlock.text,
        book,
        chapter: chapterBlock.chapter,
        maxVerse,
        singleChapterBook: chapterCount === 1,
      })
      for (const entry of parsed) {
        entry.resource = {
          id: 'sdabc',
          name: 'Seventh-day Adventist Bible Commentary',
          author: 'Francis D. Nichol, editor',
          sourceLanguage: 'en',
          license: 'CustomPermission',
        }
        entry.volume = source.volume
        entry.source.provenance = `${source.name} · ${entry.referenceLabel}`
        entry.source.url = source.url
      }
      entries.push(...parsed)
      const covered = new Set(parsed.flatMap(entry => Array.from(
        { length: entry.passageEndVerse - Number(entry.passage.split('-')[2]) + 1 },
        (_, index) => Number(entry.passage.split('-')[2]) + index,
      )))
      audit.push({
        book,
        bookName: BIBLE_BOOKS[book - 1],
        chapter: chapterBlock.chapter,
        maxVerse,
        entries: parsed.length,
        coveredVerses: covered.size,
        missingVerses: Array.from({ length: maxVerse }, (_, index) => index + 1).filter(verse => !covered.has(verse)),
      })
    }
    process.stdout.write(`Extrait : ${BIBLE_BOOKS[book - 1]} (${chapterCount} chapitres)\n`)
  }
}

entries.sort((left, right) => left.passage.localeCompare(right.passage, 'en', { numeric: true }) || left.id.localeCompare(right.id))
const artifactRaw = JSON.stringify(entries)
const auditRaw = JSON.stringify(audit, null, 2) + '\n'
await writeFile(path.join(outputRoot, 'sdabc.json'), artifactRaw)
await writeFile(path.join(outputRoot, 'coverage.json'), auditRaw)

const missingChapterComments = audit.filter(chapter => chapter.entries === 0)
const missingVerseCount = audit.reduce((sum, chapter) => sum + chapter.missingVerses.length, 0)
const manifest = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  resource: 'sdabc',
  authorization: {
    status: 'confirmed-by-project-owner',
    scope: 'use, extraction, transformation and redistribution of the full SDA Bible Commentary',
    confirmedAt: '2026-08-28',
  },
  source: {
    title: metadata.metadata?.title,
    creator: metadata.metadata?.creator,
    date: metadata.metadata?.date,
    itemUrl: SDABC_ITEM_URL,
    metadataUrl: SDABC_METADATA_URL,
    files: sourceRecords,
  },
  counts: {
    books: 66,
    chapters: audit.length,
    entries: entries.length,
    introductions: entries.filter(entry => entry.editorialKind === 'book-introduction').length,
    missingChapterComments: missingChapterComments.length,
    missingVerseAnchors: missingVerseCount,
  },
  artifacts: {
    commentary: { path: 'sdabc.json', sha256: sha256(artifactRaw) },
    coverage: { path: 'coverage.json', sha256: sha256(auditRaw) },
  },
}
await writeFile(path.join(outputRoot, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
process.stdout.write(JSON.stringify(manifest.counts, null, 2) + '\n')
