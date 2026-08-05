#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises'

import { BIBLE_PROJECT_BOOK_OVERVIEW_WORKS } from './data/bibleProjectBookOverviewWorks.mjs'

const DATA_DIR = 'docs/research/data/bible-project'
const CATALOG_PATH = `${DATA_DIR}/catalog.json`
const MANIFEST_PATH = `${DATA_DIR}/book-overview-manifest.json`
const MANIFEST_AUDIT_PATH = `${DATA_DIR}/book-overview-audit.json`
const CORPUS_AUDIT_PATH = `${DATA_DIR}/audit.json`

const BOOK_CHAPTER_COUNTS = [
  50, 40, 27, 36, 34, 24, 21, 4, 31, 24, 22, 25, 29, 36, 10, 13, 10, 42, 150, 31, 12, 8, 66, 52, 5,
  48, 12, 14, 3, 9, 1, 4, 7, 3, 3, 3, 2, 14, 4, 28, 16, 24, 21, 28, 16, 16, 13, 6, 6, 4, 4, 5, 3, 6,
  4, 3, 1, 13, 5, 5, 3, 5, 1, 1, 1, 22,
]

const LANGUAGES = ['fr', 'en']

const anchorScope = scope => {
  if (scope.kind === 'testament') {
    return [
      {
        kind: 'testament',
        testament: scope.testament,
        placement: 'library',
        relevance: 'related',
        reviewStatus: 'reviewed',
        provenance: 'publisher-title-and-official-playlist',
      },
    ]
  }
  if (scope.kind === 'book') {
    return scope.books.map(book => ({
      kind: 'book',
      book,
      placement: 'book-intro',
      relevance: 'primary',
      reviewStatus: 'reviewed',
      provenance: 'publisher-title-and-official-playlist',
    }))
  }
  return [
    {
      kind: 'passage',
      book: scope.book,
      chapterStart: scope.chapterStart,
      chapterEnd: scope.chapterEnd,
      placement: scope.chapterStart === 1 ? 'book-intro' : 'before-range',
      relevance: 'primary',
      reviewStatus: 'reviewed',
      provenance: 'publisher-title-and-localized-edition-range',
    },
  ]
}

const entryPointAnchor = entryPoint => ({
  kind: 'passage',
  book: entryPoint.book,
  chapterStart: entryPoint.chapter,
  chapterEnd: entryPoint.chapter,
  placement: 'chapter-resources',
  relevance: 'primary',
  reviewStatus: 'reviewed',
  provenance: 'editorial-review',
})

const editionFromVideo = (workId, video, language) => ({
  id: `${workId}:${language}`,
  language,
  provider: 'youtube',
  providerId: video.id,
  sourceUrl: video.sourceUrl,
  title: video.title,
  description: video.description,
  thumbnailUrl: video.thumbnailUrl,
  durationSeconds: video.durationSeconds,
  publishedAt: video.publishedAt,
  embeddable: video.embeddable,
  madeForKids: video.madeForKids,
  captionsAvailable: video.captionsAvailable,
  regionRestriction: video.regionRestriction,
})

const validateRegistry = (catalogVideos, works) => {
  const workIds = works.map(work => work.id)
  if (new Set(workIds).size !== workIds.length) throw new Error('Duplicate overview work IDs')
  if (works.length !== 73) throw new Error(`Expected 73 overview works, received ${works.length}`)

  const editionIds = works.flatMap(work => Object.values(work.editions))
  if (new Set(editionIds).size !== editionIds.length)
    throw new Error('A provider video is assigned to multiple overview works')
  if (editionIds.length !== 145)
    throw new Error(`Expected 145 overview editions, received ${editionIds.length}`)

  const catalogOverviewIds = catalogVideos
    .filter(video => video.category === 'book-overview')
    .map(video => video.id)
  const missingFromRegistry = catalogOverviewIds.filter(id => !editionIds.includes(id))
  const missingFromCatalog = editionIds.filter(id => !catalogOverviewIds.includes(id))
  if (missingFromRegistry.length || missingFromCatalog.length) {
    throw new Error(
      `Overview registry mismatch: unassigned=${missingFromRegistry.join(',') || 'none'} missing=${missingFromCatalog.join(',') || 'none'}`
    )
  }

  const catalogById = new Map(catalogVideos.map(video => [video.id, video]))
  for (const work of works) {
    if (!work.editions.en) throw new Error(`${work.id} has no English edition`)
    for (const [language, providerId] of Object.entries(work.editions)) {
      const video = catalogById.get(providerId)
      if (!video) throw new Error(`Unknown provider ID ${providerId} for ${work.id}`)
      if (video.language !== language)
        throw new Error(`${providerId} has language ${video.language}, expected ${language}`)
      if (!video.embeddable || video.metadataStatus !== 'complete')
        throw new Error(`${providerId} is not a verified embeddable edition`)
    }
  }
}

const coverageForLanguage = (works, language) => {
  const rangesByBook = new Map()
  for (const work of works) {
    if (!work.editions[language] || work.scope.kind === 'testament') continue
    const scopes =
      work.scope.kind === 'book'
        ? work.scope.books.map(book => ({ book, start: 1, end: BOOK_CHAPTER_COUNTS[book - 1] }))
        : [
            {
              book: work.scope.book,
              start: work.scope.chapterStart,
              end: work.scope.chapterEnd,
            },
          ]
    for (const scope of scopes) {
      const values = rangesByBook.get(scope.book) || []
      values.push([scope.start, scope.end])
      rangesByBook.set(scope.book, values)
    }
  }

  const completeBooks = []
  const partialBooks = []
  for (let book = 1; book <= 66; book++) {
    const ranges = (rangesByBook.get(book) || []).sort((a, b) => a[0] - b[0])
    let expectedChapter = 1
    for (const [start, end] of ranges) {
      if (start !== expectedChapter || end < start || end > BOOK_CHAPTER_COUNTS[book - 1]) break
      expectedChapter = end + 1
    }
    if (expectedChapter === BOOK_CHAPTER_COUNTS[book - 1] + 1) completeBooks.push(book)
    else if (ranges.length) partialBooks.push(book)
  }
  return {
    completeBooks,
    partialBooks,
    missingBooks: Array.from({ length: 66 }, (_, index) => index + 1).filter(
      book => !rangesByBook.has(book)
    ),
  }
}

const languageIndex = (works, language) => {
  const books = Object.fromEntries(
    Array.from({ length: 66 }, (_, index) => [String(index + 1), []])
  )
  const testaments = { old: [], new: [] }
  for (const work of works) {
    if (!work.editions.some(edition => edition.language === language)) continue
    for (const anchor of work.anchors) {
      if (anchor.kind === 'testament') testaments[anchor.testament].push(work.id)
      else books[String(anchor.book)].push(work.id)
    }
  }
  return { books, testaments }
}

const main = async () => {
  const catalog = JSON.parse(await readFile(CATALOG_PATH, 'utf8'))
  validateRegistry(catalog.videos, BIBLE_PROJECT_BOOK_OVERVIEW_WORKS)

  const catalogById = new Map(catalog.videos.map(video => [video.id, video]))
  const works = BIBLE_PROJECT_BOOK_OVERVIEW_WORKS.map(definition => ({
    id: definition.id,
    category: 'book-overview',
    reviewStatus: 'reviewed',
    editions: LANGUAGES.filter(language => definition.editions[language]).map(language =>
      editionFromVideo(definition.id, catalogById.get(definition.editions[language]), language)
    ),
    anchors: [
      ...anchorScope(definition.scope),
      ...(definition.entryPoint ? [entryPointAnchor(definition.entryPoint)] : []),
    ],
  }))

  const coverage = Object.fromEntries(
    LANGUAGES.map(language => [
      language,
      coverageForLanguage(BIBLE_PROJECT_BOOK_OVERVIEW_WORKS, language),
    ])
  )
  if (coverage.en.completeBooks.length !== 66 || coverage.en.partialBooks.length)
    throw new Error('English overview editions do not completely cover all 66 books')
  if (
    coverage.fr.completeBooks.length !== 65 ||
    coverage.fr.partialBooks.length ||
    JSON.stringify(coverage.fr.missingBooks) !== JSON.stringify([50])
  )
    throw new Error('French overview coverage must be complete except for Philippians')

  const manifest = {
    schemaVersion: 1,
    generatedAt: catalog.generatedAt,
    refreshDueAt: catalog.refreshDueAt,
    languagePolicy: {
      selection: 'strict-route-language',
      fallbackAcrossLanguages: false,
    },
    attribution: catalog.attribution,
    works,
    languageIndexes: Object.fromEntries(
      LANGUAGES.map(language => [language, languageIndex(works, language)])
    ),
  }
  if (manifest.languageIndexes.fr.books['50'].length)
    throw new Error('French language index must not expose the English-only Philippians work')
  if (!manifest.languageIndexes.en.books['50'].includes('philippians-overview'))
    throw new Error('English language index must expose the Philippians work')
  const editionIds = manifest.works.flatMap(work => work.editions.map(edition => edition.id))
  if (new Set(editionIds).size !== editionIds.length)
    throw new Error('Passage media edition IDs must be unique')
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`)

  const audit = {
    schemaVersion: 1,
    generatedAt: catalog.generatedAt,
    totals: {
      works: works.length,
      editions: works.reduce((sum, work) => sum + work.editions.length, 0),
      englishEditions: works.filter(work => work.editions.some(item => item.language === 'en'))
        .length,
      frenchEditions: works.filter(work => work.editions.some(item => item.language === 'fr'))
        .length,
      testamentWorks: BIBLE_PROJECT_BOOK_OVERVIEW_WORKS.filter(
        work => work.scope.kind === 'testament'
      ).length,
      sectionWorks: BIBLE_PROJECT_BOOK_OVERVIEW_WORKS.filter(work => work.scope.kind === 'section')
        .length,
      multiBookWorks: BIBLE_PROJECT_BOOK_OVERVIEW_WORKS.filter(
        work => work.scope.kind === 'book' && work.scope.books.length > 1
      ).length,
    },
    coverage,
    missingEditions: {
      fr: works
        .filter(work => !work.editions.some(item => item.language === 'fr'))
        .map(work => work.id),
      en: works
        .filter(work => !work.editions.some(item => item.language === 'en'))
        .map(work => work.id),
    },
    sourceCoverage: {
      expectedCategoryRecords: catalog.videos.filter(video => video.category === 'book-overview')
        .length,
      assignedCategoryRecords: works.reduce((sum, work) => sum + work.editions.length, 0),
      unassignedProviderIds: [],
    },
  }
  await writeFile(MANIFEST_AUDIT_PATH, `${JSON.stringify(audit, null, 2)}\n`)

  const corpusAudit = JSON.parse(await readFile(CORPUS_AUDIT_PATH, 'utf8'))
  corpusAudit.bookOverviewManifest = {
    works: audit.totals.works,
    editions: audit.totals.editions,
    englishBookCoverage: coverage.en.completeBooks.length,
    frenchBookCoverage: coverage.fr.completeBooks.length,
    missingFrenchBooks: coverage.fr.missingBooks,
    strictLanguageSelection: true,
  }
  await writeFile(CORPUS_AUDIT_PATH, `${JSON.stringify(corpusAudit, null, 2)}\n`)

  process.stderr.write(`Wrote ${MANIFEST_PATH}\nWrote ${MANIFEST_AUDIT_PATH}\n`)
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
