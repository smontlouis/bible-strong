#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  EGW_COMMENTARY_VOLUMES,
  EGW_SCRIPTURE_INDEX,
  isChapterAssociationMarker,
  isIndexedSectionAnchor,
  mergeEgwLayers,
  plainText,
  parseBookTocSectionPages,
  parseCommentaryPage,
  parseCommentaryToc,
  parseIndexedParagraphContext,
  parseIndexedHeadingSectionPage,
  parseIndexedParagraphPage,
  parseIndexedSectionPage,
  parseScriptureIndexPage,
  parseScriptureIndexToc,
  parseChapterAssociationScriptureScope,
  scriptureScopeCoversPassage,
} from './egw-sources.mjs'
import { sha256 } from './wave-sources.mjs'
import { COMMENTARY_BCV_PARSER_VERSION, COMMENTARY_LINK_NORMALIZATION_REVISION } from './commentary-links.mjs'

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

  const indexedParagraphIds = new Set(scriptureIndex.flatMap(entry => entry.citations.map(citation => citation.paragraphId)))
  const unresolvedParagraphIds = new Set(indexedParagraphIds)
  const indexedParagraphsById = new Map()
  const unavailableIndexedParagraphs = []
  const chapterExpansions = new Map()
  const headingSectionExpansions = new Map()
  const citationCoverage = new Map()
  for (const entry of scriptureIndex) {
    for (const citation of entry.citations) {
      const coverage = citationCoverage.get(citation.paragraphId) ?? []
      coverage.push(entry)
      citationCoverage.set(citation.paragraphId, coverage)
    }
  }
  const bookTocPromises = new Map()
  const loadBookToc = bookId => {
    if (!bookTocPromises.has(bookId)) {
      bookTocPromises.set(bookId, (async () => {
        const url = `https://text.egwwritings.org/book/b${bookId}`
        const cachePath = path.join(options.cache, 'indexed-books', `b${bookId}.html`)
        const fetched = await fetchCached({ url, cachePath })
        fetched.cacheHit ? cacheHits++ : downloads++
        sourcePages.push({ kind: 'indexed-book-toc', bookId, url, sha256: sha256(fetched.bytes), byteLength: fetched.bytes.length })
        return fetched.bytes.toString('utf8')
      })())
    }
    return bookTocPromises.get(bookId)
  }
  const expandChapterMarker = async paragraph => {
    const context = { book: paragraph.book, section: paragraph.section }
    if (!context.section.pageId) throw new Error(`Section du marqueur EGW introuvable : ${paragraph.id}`)
    const toc = await loadBookToc(context.book.id)
    const pageIds = parseBookTocSectionPages({ html: toc, sectionPageId: context.section.pageId })
    const expandedById = new Map()
    for (const pageId of pageIds) {
      const url = `https://text.egwwritings.org/read/${pageId}`
      const cachePath = path.join(options.cache, 'indexed-sections', context.book.id, `${pageId}.html`)
      const fetched = await fetchCached({ url, cachePath })
      fetched.cacheHit ? cacheHits++ : downloads++
      const expanded = parseIndexedSectionPage({
        html: fetched.bytes.toString('utf8'),
        context,
        markerParagraphId: paragraph.id,
        markerText: paragraph.source.html,
      })
      for (const item of expanded) expandedById.set(item.id, item)
      sourcePages.push({
        kind: 'indexed-chapter-section',
        markerParagraphId: paragraph.id,
        pageId,
        url,
        sha256: sha256(fetched.bytes),
        byteLength: fetched.bytes.length,
        extractedParagraphCount: expanded.length,
      })
    }
    if (expandedById.size === 0) throw new Error(`Chapitre EGW sans contenu pour le marqueur ${paragraph.id}`)
    const expanded = [...expandedById.values()]
    chapterExpansions.set(paragraph.id, {
      markerText: plainText(paragraph.source.html),
      section: paragraph.section,
      paragraphIds: expanded.map(item => item.id),
      scriptureScope: parseChapterAssociationScriptureScope(paragraph.source.html),
    })
    return expanded
  }
  let paragraphPagesDone = 0
  process.stderr.write(`EGW : extraction de ${indexedParagraphIds.size} paragraphes ciblés par ECSI…\n`)
  await runPool({
    items: [...indexedParagraphIds],
    concurrency: options.concurrency,
    worker: async paragraphId => {
      if (!unresolvedParagraphIds.has(paragraphId)) return
      const url = `https://text.egwwritings.org/read/${paragraphId}`
      const cachePath = path.join(options.cache, 'indexed-paragraphs', `${paragraphId}.html`)
      const fetched = await fetchCached({ url, cachePath })
      fetched.cacheHit ? cacheHits++ : downloads++
      const pageHtml = fetched.bytes.toString('utf8')
      const paragraphs = parseIndexedParagraphPage({
        html: pageHtml,
        targetParagraphIds: unresolvedParagraphIds,
      })
      for (const paragraph of paragraphs) {
        if (isChapterAssociationMarker(paragraph.source.html)) {
          const expanded = await expandChapterMarker(paragraph)
          for (const item of expanded) indexedParagraphsById.set(item.id, item)
        } else if (isIndexedSectionAnchor({ html: pageHtml, targetParagraphId: paragraph.id })) {
          const expanded = parseIndexedHeadingSectionPage({
            html: pageHtml,
            context: { book: paragraph.book, section: paragraph.section },
            anchorParagraphId: paragraph.id,
          })
          if (expanded.length === 0) throw new Error(`Section EGW sans contenu pour l’ancre ${paragraph.id}`)
          for (const item of expanded) indexedParagraphsById.set(item.id, item)
          const coverage = [...(citationCoverage.get(paragraph.id) ?? [])]
            .sort((left, right) => left.passage.localeCompare(right.passage, 'en', { numeric: true }))
          const first = coverage[0]
          const last = coverage.at(-1)
          const lastEnd = last && Number(last.passageEndVerse) > Number(last.passage.split('-')[2])
            ? `${last.passage.split('-').slice(0, 2).join('-')}-${last.passageEndVerse}`
            : last?.passage
          headingSectionExpansions.set(paragraph.id, {
            anchorText: plainText(paragraph.source.html),
            section: paragraph.section,
            paragraphIds: expanded.map(item => item.id),
            scriptureScope: first && last ? {
              source: 'index-coverage',
              start: first.passage,
              end: lastEnd,
              label: first === last
                ? first.referenceLabel
                : `${first.referenceLabel}–${last.referenceLabel}`,
            } : null,
          })
        } else {
          indexedParagraphsById.set(paragraph.id, paragraph)
        }
        unresolvedParagraphIds.delete(paragraph.id)
      }
      if (unresolvedParagraphIds.has(paragraphId)) {
        const context = parseIndexedParagraphContext({ html: pageHtml, paragraphId })
        const unavailable = {
          schemaVersion: 1,
          id: paragraphId,
          resource: {
            id: 'egw-indexed-writings',
            name: 'EGW Writings',
            author: 'Ellen G. White',
            sourceLanguage: 'en',
            license: 'CustomPermission',
          },
          ...context,
          sourceReference: null,
          source: null,
          availability: 'source-target-unavailable',
        }
        indexedParagraphsById.set(paragraphId, unavailable)
        unavailableIndexedParagraphs.push(paragraphId)
        unresolvedParagraphIds.delete(paragraphId)
      }
      sourcePages.push({
        kind: 'indexed-paragraph-context',
        paragraphId,
        url,
        sha256: sha256(fetched.bytes),
        byteLength: fetched.bytes.length,
        extractedParagraphCount: paragraphs.length,
      })
      paragraphPagesDone++
      if (paragraphPagesDone % 100 === 0 && typeof global.gc === 'function') global.gc()
      if (paragraphPagesDone % 100 === 0 || unresolvedParagraphIds.size === 0) {
        process.stderr.write(`  paragraphes ${indexedParagraphsById.size}/${indexedParagraphIds.size}\n`)
      }
    },
  })
  if (unresolvedParagraphIds.size > 0) {
    throw new Error(`Paragraphes EGW non résolus : ${[...unresolvedParagraphIds].slice(0, 20).join(', ')}`)
  }
  for (const entry of scriptureIndex) {
    entry.citations = entry.citations.flatMap(citation => {
      const expansion = chapterExpansions.get(citation.paragraphId)
      if (expansion) {
        return {
          ...citation,
          associatedParagraphIds: expansion.paragraphIds,
          association: {
            kind: 'chapter',
            markerParagraphId: citation.paragraphId,
            markerText: expansion.markerText,
            sectionTitle: expansion.section.title,
            contextUrl: `https://text.egwwritings.org/read/${expansion.section.pageId}`,
            scriptureScope: expansion.scriptureScope,
          },
        }
      }
      const headingExpansion = headingSectionExpansions.get(citation.paragraphId)
      if (!headingExpansion) return citation
      return {
        ...citation,
        associatedParagraphIds: headingExpansion.paragraphIds,
        association: {
          kind: 'section',
          anchorParagraphId: citation.paragraphId,
          anchorText: headingExpansion.anchorText,
          sectionTitle: headingExpansion.section.title,
          contextUrl: `https://text.egwwritings.org/read/${headingExpansion.section.pageId}`,
          scriptureScope: headingExpansion.scriptureScope,
        },
      }
    })
    entry.citations = [...new Map(entry.citations.map(citation => [citation.paragraphId, citation])).values()]
  }
  const chapterAssociations = new Map()
  for (const entry of scriptureIndex) {
    for (const citation of entry.citations) {
      if (citation.association?.kind === 'chapter' && citation.association.scriptureScope?.osis) {
        chapterAssociations.set(citation.paragraphId, citation)
      }
    }
  }
  for (const citation of chapterAssociations.values()) {
    for (const entry of scriptureIndex) {
      if (!scriptureScopeCoversPassage(citation.association.scriptureScope.osis, entry.passage)) continue
      if (entry.citations.some(candidate => candidate.paragraphId === citation.paragraphId)) continue
      entry.citations.push({ ...citation, association: { ...citation.association, propagatedFromDeclaredScope: true } })
    }
  }
  const indexedParagraphs = [...indexedParagraphsById.values()].sort((left, right) =>
    left.id.localeCompare(right.id, 'en', { numeric: true })
  )

  commentary.sort((left, right) => left.passage.localeCompare(right.passage, 'en', { numeric: true }) || left.id.localeCompare(right.id))
  scriptureIndex.sort((left, right) => left.passage.localeCompare(right.passage, 'en', { numeric: true }) || left.id.localeCompare(right.id))
  const merged = mergeEgwLayers({ commentary, scriptureIndex })
  const citations = scriptureIndex.reduce((sum, entry) => sum + entry.citations.length, 0)
  const uniqueCitationTargets = new Set(scriptureIndex.flatMap(entry => entry.citations.flatMap(citation => citation.associatedParagraphIds ?? [citation.paragraphId]))).size
  const indexedBibleReferences = indexedParagraphs.reduce((sum, paragraph) => sum + (paragraph.source?.references?.length ?? 0), 0)
  const indexedParagraphsWithBibleReferences = indexedParagraphs.filter(paragraph => paragraph.source?.references?.length).length
  const books = new Set([...commentary, ...scriptureIndex].map(entry => entry.passage.split('-')[0])).size
  const artifacts = {
    commentary: await writeJson(options.output, 'egw-sda-bible-commentary-1-7.json', commentary),
    scriptureIndex: await writeJson(options.output, 'egw-complete-scripture-index.json', scriptureIndex),
    indexedParagraphs: await writeJson(options.output, 'egw-indexed-writings.json', indexedParagraphs),
    merged: await writeJson(options.output, 'egw-merged.json', merged),
  }
  sourcePages.sort((left, right) => left.url.localeCompare(right.url))
  const manifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    provider: 'Ellen G. White Estate · EGW Writings',
    authorization: { status: 'confirmed-by-project-owner', confirmedAt: '2026-08-28', scope: 'Extraction, transformation et usage dans Bible Strong confirmés par le responsable du projet ; pièces d’approbation à archiver dans le registre de provenance.' },
    linkContract: { representation: 'html-reference-id-plus-references', canonicalTarget: 'OSIS', parser: '@bible-strong/bible-reference-parser', parserVersion: COMMENTARY_BCV_PARSER_VERSION, normalizationRevision: COMMENTARY_LINK_NORMALIZATION_REVISION, runtimeParsingRequired: false },
    scope: { included: ['EGW SDA Bible Commentary 1BC–7BC', 'EGW Complete Scripture Index', 'Paragraphes explicitement ciblés par EGW Complete Scripture Index', 'Chapitre complet lorsqu’une cible éditoriale déclare “This chapter is based on…”', 'Section complète lorsqu’une cible ECSI est son titre structurel'], excluded: ['SDA Bible Commentary général hors extraits EGW', 'Paragraphes voisins des cibles ECSI ordinaires'] },
    semantics: { curatedCommentary: 'Texte éditorial EGW des volumes 1BC–7BC.', scriptureIndex: 'Associations exhaustives vers des paragraphes EGW ; une association n’est pas automatiquement un commentaire exégétique. Les marqueurs “This chapter is based on…” portent une association explicite au niveau du chapitre. Une cible qui est le titre structurel d’une section porte une association de section dont la portée biblique est déduite de sa couverture ECSI.', indexedParagraphs: 'Corpus dédupliqué limité aux paragraphes exactement ciblés par ECSI, sauf lorsqu’une cible représente une unité documentaire : un marqueur éditorial “This chapter is based on…” est remplacé par tous les paragraphes réels de son chapitre, et un titre structurel par tous les paragraphes réels de sa section. Le titre du livre, la section et le lien de contexte restent des métadonnées. Une cible historique que le site ne matérialise plus exactement reste inventoriée sans texte et n’est jamais remplacée par un voisin.' },
    counts: { books, commentaryPages: commentaryPages.length, commentaryEntries: commentary.length, scriptureIndexPages: indexPages.length, scriptureIndexEntries: scriptureIndex.length, citations, originalCitationTargets: indexedParagraphIds.size, chapterAssociationMarkers: chapterExpansions.size, indexedSectionAnchors: headingSectionExpansions.size, uniqueCitationTargets, indexedParagraphs: indexedParagraphs.length, indexedParagraphsWithBibleReferences, indexedBibleReferences, availableIndexedParagraphs: indexedParagraphs.length - unavailableIndexedParagraphs.length, unavailableIndexedParagraphs: unavailableIndexedParagraphs.length, mergedPassageAnchors: merged.length },
    unavailableIndexedParagraphIds: unavailableIndexedParagraphs.sort((left, right) => left.localeCompare(right, 'en', { numeric: true })),
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
