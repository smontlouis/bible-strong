#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises'

import {
  BIBLE_PROJECT_VISUAL_COMMENTARY_EXCLUSIONS,
  BIBLE_PROJECT_VISUAL_COMMENTARY_WORKS,
} from './data/bibleProjectVisualCommentaryWorks.mjs'

const DATA_DIR = 'docs/research/data/bible-project'
const CATALOG_PATH = `${DATA_DIR}/catalog.json`
const MANIFEST_PATH = `${DATA_DIR}/visual-commentary-manifest.json`
const MANIFEST_AUDIT_PATH = `${DATA_DIR}/visual-commentary-audit.json`
const CORPUS_AUDIT_PATH = `${DATA_DIR}/audit.json`
const LANGUAGES = ['fr', 'en']

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

const reviewedAnchor = (anchor, defaultEvidenceUrl) => {
  const { evidenceUrl, ...range } = anchor
  return {
    ...range,
    relevance: 'primary',
    reviewStatus: 'reviewed',
    provenance: evidenceUrl ? 'publisher-script' : 'publisher-page-or-official-collection',
    evidenceUrl: evidenceUrl || defaultEvidenceUrl,
  }
}

const validateRegistry = catalogVideos => {
  const works = BIBLE_PROJECT_VISUAL_COMMENTARY_WORKS
  const exclusions = BIBLE_PROJECT_VISUAL_COMMENTARY_EXCLUSIONS
  if (works.length !== 24)
    throw new Error(`Expected 24 visual commentary works, received ${works.length}`)
  if (exclusions.length !== 1)
    throw new Error(`Expected one visual commentary exclusion, received ${exclusions.length}`)

  const workIds = works.map(work => work.id)
  if (new Set(workIds).size !== workIds.length)
    throw new Error('Duplicate visual commentary work IDs')

  const editionProviderIds = works.flatMap(work => Object.values(work.editions))
  const excludedProviderIds = exclusions.map(exclusion => exclusion.providerId)
  if (new Set(editionProviderIds).size !== editionProviderIds.length)
    throw new Error('A provider video is assigned to multiple visual commentary works')
  if (editionProviderIds.some(id => excludedProviderIds.includes(id)))
    throw new Error('A visual commentary provider video is both assigned and excluded')
  if (editionProviderIds.length !== 43)
    throw new Error(`Expected 43 visual commentary editions, received ${editionProviderIds.length}`)

  const categoryVideos = catalogVideos.filter(video => video.category === 'visual-commentary')
  if (categoryVideos.length !== 44)
    throw new Error(
      `Expected 44 visual commentary source records, received ${categoryVideos.length}`
    )
  if (new Set(categoryVideos.map(video => video.id)).size !== categoryVideos.length)
    throw new Error('Visual commentary source provider IDs must be unique')
  const accountedProviderIds = [...editionProviderIds, ...excludedProviderIds]
  const unassignedProviderIds = categoryVideos
    .map(video => video.id)
    .filter(id => !accountedProviderIds.includes(id))
  const missingProviderIds = accountedProviderIds.filter(
    id => !categoryVideos.some(video => video.id === id)
  )
  if (unassignedProviderIds.length || missingProviderIds.length) {
    throw new Error(
      `Visual commentary registry mismatch: unassigned=${unassignedProviderIds.join(',') || 'none'} missing=${missingProviderIds.join(',') || 'none'}`
    )
  }

  const catalogById = new Map(catalogVideos.map(video => [video.id, video]))
  for (const work of works) {
    if (!work.sourceUrl.startsWith('https://bibleproject.com/'))
      throw new Error(`${work.id} has no first-party BibleProject source URL`)
    if (!work.anchors.length) throw new Error(`${work.id} has no reviewed passage anchor`)
    for (const anchor of work.anchors) {
      if (anchor.kind !== 'passage' || !anchor.book || !anchor.chapterStart)
        throw new Error(`${work.id} has an invalid passage anchor`)
      if (anchor.chapterEnd && anchor.chapterEnd < anchor.chapterStart)
        throw new Error(`${work.id} has a reversed chapter range`)
      if (anchor.verseEnd && !anchor.verseStart)
        throw new Error(`${work.id} has a verse end without a verse start`)
    }
    for (const [language, providerId] of Object.entries(work.editions)) {
      if (!LANGUAGES.includes(language))
        throw new Error(`${work.id} has unsupported language ${language}`)
      const video = catalogById.get(providerId)
      if (!video) throw new Error(`Unknown provider ID ${providerId} for ${work.id}`)
      if (video.language !== language)
        throw new Error(`${providerId} has language ${video.language}, expected ${language}`)
      if (!video.embeddable || video.metadataStatus !== 'complete')
        throw new Error(`${providerId} is not a verified embeddable edition`)
    }
  }
  const religiousPractices = works.find(
    work => work.id === 'sermon-on-mount-series-religious-practices'
  )
  if (religiousPractices?.anchors.length !== 2)
    throw new Error('Religious practices work must preserve its two discontiguous anchors')
}

const addUnique = (values, value) => {
  if (!values.includes(value)) values.push(value)
}

const languageIndex = (works, language) => {
  const books = Object.fromEntries(
    Array.from({ length: 66 }, (_, index) => [String(index + 1), []])
  )
  const chapters = {}
  for (const work of works) {
    if (!work.editions.some(edition => edition.language === language)) continue
    for (const anchor of work.anchors) {
      addUnique(books[String(anchor.book)], work.id)
      const chapterEnd = anchor.chapterEnd || anchor.chapterStart
      for (let chapter = anchor.chapterStart; chapter <= chapterEnd; chapter++) {
        const key = `${anchor.book}:${chapter}`
        chapters[key] ||= []
        addUnique(chapters[key], work.id)
      }
    }
  }
  return { books, chapters }
}

const main = async () => {
  const catalog = JSON.parse(await readFile(CATALOG_PATH, 'utf8'))
  validateRegistry(catalog.videos)

  const catalogById = new Map(catalog.videos.map(video => [video.id, video]))
  const works = BIBLE_PROJECT_VISUAL_COMMENTARY_WORKS.map(definition => ({
    id: definition.id,
    category: 'visual-commentary',
    reviewStatus: 'reviewed',
    sourceUrl: definition.sourceUrl,
    editions: LANGUAGES.filter(language => definition.editions[language]).map(language =>
      editionFromVideo(definition.id, catalogById.get(definition.editions[language]), language)
    ),
    anchors: definition.anchors.map(anchor => reviewedAnchor(anchor, definition.sourceUrl)),
  }))

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
  const editionIds = works.flatMap(work => work.editions.map(edition => edition.id))
  if (new Set(editionIds).size !== editionIds.length)
    throw new Error('Visual commentary edition IDs must be unique')
  if (manifest.languageIndexes.fr.books['2'].length)
    throw new Error('French index must not expose the English-only Exodus work')
  if (manifest.languageIndexes.fr.books['19'].includes('psalm-8-visual-commentary'))
    throw new Error('French index must not expose the English-only Psalm 8 work')
  if (manifest.languageIndexes.en.books['40'].includes('sermon-on-mount-visual-generosity'))
    throw new Error('English index must not expose French-only Sermon works')
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`)

  const categoryVideos = catalog.videos.filter(video => video.category === 'visual-commentary')
  const includedProviderIds = works.flatMap(work =>
    work.editions.map(edition => edition.providerId)
  )
  const audit = {
    schemaVersion: 1,
    generatedAt: catalog.generatedAt,
    totals: {
      works: works.length,
      editions: includedProviderIds.length,
      englishEditions: includedProviderIds.filter(id => catalogById.get(id).language === 'en')
        .length,
      frenchEditions: includedProviderIds.filter(id => catalogById.get(id).language === 'fr')
        .length,
      bilingualWorks: works.filter(work => work.editions.length === 2).length,
      englishOnlyWorks: works.filter(
        work => work.editions.length === 1 && work.editions[0].language === 'en'
      ).length,
      frenchOnlyWorks: works.filter(
        work => work.editions.length === 1 && work.editions[0].language === 'fr'
      ).length,
      reviewedAnchors: works.reduce((sum, work) => sum + work.anchors.length, 0),
      excludedSourceRecords: BIBLE_PROJECT_VISUAL_COMMENTARY_EXCLUSIONS.length,
    },
    canonicalBookCoverage: Object.fromEntries(
      LANGUAGES.map(language => [
        language,
        Object.entries(manifest.languageIndexes[language].books)
          .filter(([, workIds]) => workIds.length)
          .map(([book]) => Number(book)),
      ])
    ),
    missingEditions: {
      fr: works
        .filter(work => !work.editions.some(edition => edition.language === 'fr'))
        .map(work => work.id),
      en: works
        .filter(work => !work.editions.some(edition => edition.language === 'en'))
        .map(work => work.id),
    },
    exclusions: BIBLE_PROJECT_VISUAL_COMMENTARY_EXCLUSIONS,
    sourceCoverage: {
      expectedCategoryRecords: categoryVideos.length,
      assignedCategoryRecords: includedProviderIds.length,
      excludedCategoryRecords: BIBLE_PROJECT_VISUAL_COMMENTARY_EXCLUSIONS.length,
      unassignedProviderIds: [],
    },
  }
  if (
    audit.totals.bilingualWorks !== 19 ||
    audit.totals.frenchOnlyWorks !== 3 ||
    audit.totals.englishOnlyWorks !== 2
  )
    throw new Error('Unexpected visual commentary localization topology')
  await writeFile(MANIFEST_AUDIT_PATH, `${JSON.stringify(audit, null, 2)}\n`)

  const corpusAudit = JSON.parse(await readFile(CORPUS_AUDIT_PATH, 'utf8'))
  corpusAudit.visualCommentaryManifest = {
    works: audit.totals.works,
    editions: audit.totals.editions,
    englishEditions: audit.totals.englishEditions,
    frenchEditions: audit.totals.frenchEditions,
    excludedSourceRecords: audit.totals.excludedSourceRecords,
    strictLanguageSelection: true,
  }
  await writeFile(CORPUS_AUDIT_PATH, `${JSON.stringify(corpusAudit, null, 2)}\n`)

  process.stderr.write(`Wrote ${MANIFEST_PATH}\nWrote ${MANIFEST_AUDIT_PATH}\n`)
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
