#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises'

import {
  BIBLE_PROJECT_THEME_EXCLUSIONS,
  BIBLE_PROJECT_THEME_WORKS,
} from './data/bibleProjectThemeWorks.mjs'

const DATA_DIR = 'docs/research/data/bible-project'
const CATALOG_PATH = `${DATA_DIR}/catalog.json`
const MANIFEST_PATH = `${DATA_DIR}/theme-manifest.json`
const MANIFEST_AUDIT_PATH = `${DATA_DIR}/theme-audit.json`
const CORPUS_AUDIT_PATH = `${DATA_DIR}/audit.json`
const LANGUAGES = ['fr', 'en']
const NOISE_TITLE =
  /(?:behind the scenes|\bbts\b|coming soon|in the studio|question and response|\bq\+r\b|reading plan|with your group|coulisses?|en studio)/iu

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
  const { evidenceUrl, relevance = 'primary', provenance, ...range } = anchor
  return {
    ...range,
    placement: relevance === 'primary' ? 'after-range' : 'related-resource',
    relevance,
    reviewStatus: 'reviewed',
    provenance,
    evidenceUrl: evidenceUrl || defaultEvidenceUrl,
  }
}

const validatePassageAnchor = (work, anchor) => {
  if (anchor.kind !== 'passage' || !anchor.book || !anchor.chapterStart)
    throw new Error(`${work.id} has an invalid passage anchor`)
  if (anchor.book < 1 || anchor.book > 66)
    throw new Error(`${work.id} has an invalid canonical book ${anchor.book}`)
  if (anchor.chapterEnd && anchor.chapterEnd < anchor.chapterStart)
    throw new Error(`${work.id} has a reversed chapter range`)
  if (anchor.verseEnd && !anchor.verseStart)
    throw new Error(`${work.id} has a verse end without a verse start`)
  if (!['primary', 'related'].includes(anchor.relevance || 'primary'))
    throw new Error(`${work.id} has an invalid anchor relevance`)
  if (!['publisher-passage', 'editorial-review'].includes(anchor.provenance))
    throw new Error(`${work.id} has an invalid anchor provenance`)
}

const validateRegistry = catalogVideos => {
  const works = BIBLE_PROJECT_THEME_WORKS
  const exclusions = BIBLE_PROJECT_THEME_EXCLUSIONS
  if (!works.length) throw new Error('The reviewed theme registry must not be empty')

  const workIds = works.map(work => work.id)
  if (new Set(workIds).size !== workIds.length) throw new Error('Duplicate theme work IDs')

  const editionProviderIds = works.flatMap(work => Object.values(work.editions))
  const excludedProviderIds = exclusions.map(exclusion => exclusion.providerId)
  if (new Set(editionProviderIds).size !== editionProviderIds.length)
    throw new Error('A provider video is assigned to multiple theme works')
  if (new Set(excludedProviderIds).size !== excludedProviderIds.length)
    throw new Error('A provider video is excluded more than once')
  if (editionProviderIds.some(id => excludedProviderIds.includes(id)))
    throw new Error('A theme provider video is both assigned and excluded')

  const categoryVideos = catalogVideos.filter(video => video.category === 'theme')
  if (new Set(categoryVideos.map(video => video.id)).size !== categoryVideos.length)
    throw new Error('Theme category provider IDs must be unique')
  const categoryProviderIds = new Set(categoryVideos.map(video => video.id))
  const accountedCategoryProviderIds = new Set(
    [...editionProviderIds, ...excludedProviderIds].filter(id => categoryProviderIds.has(id))
  )
  const unassignedProviderIds = categoryVideos
    .map(video => video.id)
    .filter(id => !accountedCategoryProviderIds.has(id))
  if (unassignedProviderIds.length)
    throw new Error(`Unassigned theme category IDs: ${unassignedProviderIds.join(',')}`)
  const invalidExclusions = exclusions.filter(
    exclusion => !categoryProviderIds.has(exclusion.providerId)
  )
  if (invalidExclusions.length)
    throw new Error(
      `Theme exclusions must belong to the source category: ${invalidExclusions
        .map(exclusion => exclusion.providerId)
        .join(',')}`
    )

  const catalogById = new Map(catalogVideos.map(video => [video.id, video]))
  for (const work of works) {
    if (
      !work.sourceUrl.startsWith('https://bibleproject.com/') &&
      !work.sourceUrl.startsWith('https://www.youtube.com/watch?v=')
    )
      throw new Error(`${work.id} has no first-party BibleProject or provider source URL`)
    if (!work.series) throw new Error(`${work.id} has no reviewed series identity`)
    if (!work.anchors.length) throw new Error(`${work.id} has no reviewed passage anchor`)
    work.anchors.forEach(anchor => validatePassageAnchor(work, anchor))
    if (work.anchors.filter(anchor => (anchor.relevance || 'primary') === 'primary').length !== 1)
      throw new Error(`${work.id} must have exactly one primary Bible View anchor`)
    if (!Object.keys(work.editions).length) throw new Error(`${work.id} has no localized edition`)
    for (const [language, providerId] of Object.entries(work.editions)) {
      if (!LANGUAGES.includes(language))
        throw new Error(`${work.id} has unsupported language ${language}`)
      const video = catalogById.get(providerId)
      if (!video) throw new Error(`Unknown provider ID ${providerId} for ${work.id}`)
      if (video.language !== language)
        throw new Error(`${providerId} has language ${video.language}, expected ${language}`)
      if (!video.embeddable || video.metadataStatus !== 'complete')
        throw new Error(`${providerId} is not a verified embeddable edition`)
      if (NOISE_TITLE.test(video.title))
        throw new Error(`${providerId} matches the editorial noise policy: ${video.title}`)
    }
  }

  for (const exclusion of exclusions) {
    const video = catalogById.get(exclusion.providerId)
    if (!video) throw new Error(`Unknown excluded provider ID ${exclusion.providerId}`)
    if (video.language !== exclusion.language)
      throw new Error(`${exclusion.providerId} exclusion language does not match the catalog`)
    if (!exclusion.reason || !exclusion.evidenceUrl)
      throw new Error(`${exclusion.providerId} has an incomplete exclusion decision`)
  }
}

const addUnique = (values, value) => {
  if (!values.includes(value)) values.push(value)
}

const anchorIndex = (works, language, relevance) => {
  const books = Object.fromEntries(
    Array.from({ length: 66 }, (_, index) => [String(index + 1), []])
  )
  const chapters = {}
  for (const work of works) {
    if (!work.editions.some(edition => edition.language === language)) continue
    for (const anchor of work.anchors.filter(anchor => anchor.relevance === relevance)) {
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

const languageIndex = (works, language) => ({
  primary: anchorIndex(works, language, 'primary'),
  related: anchorIndex(works, language, 'related'),
})

const main = async () => {
  const catalog = JSON.parse(await readFile(CATALOG_PATH, 'utf8'))
  validateRegistry(catalog.videos)
  const catalogById = new Map(catalog.videos.map(video => [video.id, video]))

  const works = BIBLE_PROJECT_THEME_WORKS.map(definition => ({
    id: definition.id,
    category: 'theme',
    series: definition.series,
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
    placementPolicy: {
      surface: 'bible-view',
      placement: 'chapter-resources',
      label: 'Pour aller plus loin',
      automaticIndex: 'primary',
      relatedIndex: 'related',
    },
    attribution: catalog.attribution,
    works,
    languageIndexes: Object.fromEntries(
      LANGUAGES.map(language => [language, languageIndex(works, language)])
    ),
  }
  const editionIds = works.flatMap(work => work.editions.map(edition => edition.id))
  if (new Set(editionIds).size !== editionIds.length)
    throw new Error('Theme edition IDs must be unique')
  if (
    works.length !== 57 ||
    editionIds.length !== 112 ||
    works.filter(work => work.editions.length === 2).length !== 55
  )
    throw new Error('Unexpected reviewed theme corpus topology')
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`)

  const categoryVideos = catalog.videos.filter(video => video.category === 'theme')
  const categoryProviderIds = new Set(categoryVideos.map(video => video.id))
  const includedProviderIds = works.flatMap(work =>
    work.editions.map(edition => edition.providerId)
  )
  const assignedCategoryProviderIds = includedProviderIds.filter(id => categoryProviderIds.has(id))
  const crossCategoryEditionProviderIds = includedProviderIds.filter(
    id => !categoryProviderIds.has(id)
  )
  const reviewedAnchors = works.flatMap(work => work.anchors)
  const exclusionsByReason = Object.fromEntries(
    [...new Set(BIBLE_PROJECT_THEME_EXCLUSIONS.map(exclusion => exclusion.reason))]
      .sort()
      .map(reason => [
        reason,
        BIBLE_PROJECT_THEME_EXCLUSIONS.filter(exclusion => exclusion.reason === reason).length,
      ])
  )
  const audit = {
    schemaVersion: 1,
    generatedAt: catalog.generatedAt,
    totals: {
      works: works.length,
      editions: includedProviderIds.length,
      englishEditions: works.reduce(
        (sum, work) => sum + Number(work.editions.some(edition => edition.language === 'en')),
        0
      ),
      frenchEditions: works.reduce(
        (sum, work) => sum + Number(work.editions.some(edition => edition.language === 'fr')),
        0
      ),
      bilingualWorks: works.filter(work => work.editions.length === 2).length,
      englishOnlyWorks: works.filter(
        work => work.editions.length === 1 && work.editions[0].language === 'en'
      ).length,
      frenchOnlyWorks: works.filter(
        work => work.editions.length === 1 && work.editions[0].language === 'fr'
      ).length,
      reviewedAnchors: reviewedAnchors.length,
      primaryAnchors: reviewedAnchors.filter(anchor => anchor.relevance === 'primary').length,
      relatedAnchors: reviewedAnchors.filter(anchor => anchor.relevance === 'related').length,
      excludedSourceRecords: BIBLE_PROJECT_THEME_EXCLUSIONS.length,
      crossCategoryEditions: crossCategoryEditionProviderIds.length,
    },
    series: Object.fromEntries(
      [...new Set(works.map(work => work.series))]
        .sort()
        .map(series => [series, works.filter(work => work.series === series).length])
    ),
    canonicalBookCoverage: Object.fromEntries(
      LANGUAGES.map(language => [
        language,
        Object.entries(manifest.languageIndexes[language].primary.books)
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
    exclusionsByReason,
    anchorsByProvenance: Object.fromEntries(
      ['publisher-passage', 'editorial-review'].map(provenance => [
        provenance,
        reviewedAnchors.filter(anchor => anchor.provenance === provenance).length,
      ])
    ),
    exclusions: BIBLE_PROJECT_THEME_EXCLUSIONS,
    sourceCoverage: {
      expectedCategoryRecords: categoryVideos.length,
      assignedCategoryRecords: assignedCategoryProviderIds.length,
      excludedCategoryRecords: BIBLE_PROJECT_THEME_EXCLUSIONS.length,
      crossCategoryEditionProviderIds,
      unassignedProviderIds: [],
    },
  }
  if (
    audit.totals.englishEditions !== 57 ||
    audit.totals.frenchEditions !== 55 ||
    audit.totals.englishOnlyWorks !== 2 ||
    audit.totals.frenchOnlyWorks !== 0 ||
    audit.totals.primaryAnchors !== 57 ||
    audit.totals.excludedSourceRecords !== 22 ||
    audit.totals.crossCategoryEditions !== 8 ||
    audit.sourceCoverage.expectedCategoryRecords !== 126 ||
    audit.sourceCoverage.assignedCategoryRecords !== 104
  )
    throw new Error('Unexpected reviewed theme audit totals')
  await writeFile(MANIFEST_AUDIT_PATH, `${JSON.stringify(audit, null, 2)}\n`)

  const corpusAudit = JSON.parse(await readFile(CORPUS_AUDIT_PATH, 'utf8'))
  corpusAudit.themeManifest = {
    works: audit.totals.works,
    editions: audit.totals.editions,
    englishEditions: audit.totals.englishEditions,
    frenchEditions: audit.totals.frenchEditions,
    excludedSourceRecords: audit.totals.excludedSourceRecords,
    crossCategoryEditions: audit.totals.crossCategoryEditions,
    strictLanguageSelection: true,
    bibleViewOnly: true,
  }
  await writeFile(CORPUS_AUDIT_PATH, `${JSON.stringify(corpusAudit, null, 2)}\n`)

  process.stderr.write(`Wrote ${MANIFEST_PATH}\nWrote ${MANIFEST_AUDIT_PATH}\n`)
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
