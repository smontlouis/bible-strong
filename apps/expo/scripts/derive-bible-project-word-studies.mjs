#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises'

import {
  BIBLE_PROJECT_WORD_STUDY_SHARED_WORKS,
  BIBLE_PROJECT_WORD_STUDY_WORKS,
} from './data/bibleProjectWordStudyWorks.mjs'

const DATA_DIR = 'docs/research/data/bible-project'
const CATALOG_PATH = `${DATA_DIR}/catalog.json`
const MANIFEST_PATH = `${DATA_DIR}/word-study-manifest.json`
const MANIFEST_AUDIT_PATH = `${DATA_DIR}/word-study-audit.json`
const CORPUS_AUDIT_PATH = `${DATA_DIR}/audit.json`
const VISUAL_MANIFEST_PATH = `${DATA_DIR}/visual-commentary-manifest.json`
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

const reviewedStrongAnchor = (anchor, evidenceUrl) => ({
  ...anchor,
  placement: 'strong-resource',
  relevance: anchor.relationship === 'primary' ? 'primary' : 'related',
  reviewStatus: 'reviewed',
  provenance: 'publisher-lexeme-and-bible-strong-core-lexicon',
  evidenceUrl,
})

const reviewedPassageAnchor = (anchor, evidenceUrl) => ({
  ...anchor,
  placement: 'after-range',
  relevance: 'primary',
  reviewStatus: 'reviewed',
  provenance: 'publisher-video-page-or-script',
  evidenceUrl,
})

const validateStrongBinding = work => {
  const primaryCount = work.strongs.filter(anchor => anchor.relationship === 'primary').length
  if (work.strongBinding === 'direct' && (work.strongs.length !== 1 || primaryCount !== 1))
    throw new Error(`${work.id} must have one direct primary Strong`)
  if (work.strongBinding === 'family' && (work.strongs.length < 2 || primaryCount !== 1))
    throw new Error(`${work.id} must have one primary Strong and related family members`)
  if (
    work.strongBinding === 'composite' &&
    (work.strongs.length < 2 || work.strongs.some(anchor => anchor.relationship !== 'component'))
  )
    throw new Error(`${work.id} must contain only explicit composite components`)
}

const validateRegistry = (catalogVideos, sharedWorks) => {
  const works = BIBLE_PROJECT_WORD_STUDY_WORKS
  if (works.length !== 20)
    throw new Error(`Expected 20 local word-study works, received ${works.length}`)
  if (sharedWorks.length !== 1) throw new Error('Expected one shared Character of God overview')

  const allWorkIds = [...works.map(work => work.id), ...sharedWorks.map(work => work.id)]
  if (new Set(allWorkIds).size !== allWorkIds.length) throw new Error('Duplicate lexical work IDs')

  const directEditionProviderIds = works.flatMap(work => Object.values(work.editions))
  const sharedEditionProviderIds = sharedWorks.flatMap(work =>
    work.canonicalWork.editions.map(edition => edition.providerId)
  )
  const corpusProviderIds = [...directEditionProviderIds, ...sharedEditionProviderIds]
  if (corpusProviderIds.length !== 42 || new Set(corpusProviderIds).size !== 42)
    throw new Error('The lexical corpus must contain exactly 42 unique provider editions')

  const categoryVideos = catalogVideos.filter(video => video.category === 'word-study')
  if (categoryVideos.length !== 41)
    throw new Error(`Expected 41 word-study category records, received ${categoryVideos.length}`)
  if (new Set(categoryVideos.map(video => video.id)).size !== categoryVideos.length)
    throw new Error('Word-study category provider IDs must be unique')
  const categoryProviderIds = new Set(categoryVideos.map(video => video.id))
  const unassignedCategoryProviderIds = [...categoryProviderIds].filter(
    id => !corpusProviderIds.includes(id)
  )
  if (unassignedCategoryProviderIds.length)
    throw new Error(
      `Unassigned word-study category IDs: ${unassignedCategoryProviderIds.join(',')}`
    )
  const crossCategoryProviderIds = corpusProviderIds.filter(id => !categoryProviderIds.has(id))
  if (JSON.stringify(crossCategoryProviderIds) !== JSON.stringify(['nxwzq1PJImM']))
    throw new Error(
      `Unexpected cross-category lexical editions: ${crossCategoryProviderIds.join(',') || 'none'}`
    )

  const catalogById = new Map(catalogVideos.map(video => [video.id, video]))
  for (const work of works) {
    if (!work.sourceUrl.startsWith('https://bibleproject.com/'))
      throw new Error(`${work.id} has no first-party BibleProject source URL`)
    if (Object.keys(work.editions).length !== 2 || !work.editions.fr || !work.editions.en)
      throw new Error(`${work.id} must have exactly one French and one English edition`)
    if (work.passages.length !== 1) throw new Error(`${work.id} must have one primary passage`)
    validateStrongBinding(work)
    const codes = work.strongs.map(anchor => anchor.code)
    if (new Set(codes).size !== codes.length) throw new Error(`${work.id} repeats a Strong code`)
    for (const anchor of work.strongs) {
      if (!/^[HG]\d{4}$/u.test(anchor.code))
        throw new Error(`${work.id} has invalid Strong code ${anchor.code}`)
      if (!anchor.lemma || !anchor.transliteration)
        throw new Error(`${work.id} has incomplete lexical identity ${anchor.code}`)
    }
    for (const [language, providerId] of Object.entries(work.editions)) {
      const video = catalogById.get(providerId)
      if (!video) throw new Error(`Unknown provider ID ${providerId} for ${work.id}`)
      if (video.language !== language)
        throw new Error(`${providerId} has language ${video.language}, expected ${language}`)
      if (!video.embeddable || video.metadataStatus !== 'complete')
        throw new Error(`${providerId} is not a verified embeddable edition`)
    }
  }

  for (const sharedWork of sharedWorks) {
    if (sharedWork.canonicalWork.id !== sharedWork.id)
      throw new Error(`Shared lexical work ${sharedWork.id} resolved to the wrong canonical work`)
    if (sharedWork.canonicalWork.editions.length !== 2)
      throw new Error(`${sharedWork.id} must resolve to two canonical localized editions`)
    for (const edition of sharedWork.canonicalWork.editions) {
      const video = catalogById.get(edition.providerId)
      if (!video || video.language !== edition.language)
        throw new Error(`${sharedWork.id} has an invalid canonical ${edition.language} edition`)
    }
    if (
      sharedWork.canonicalWork.anchors.length !== 1 ||
      sharedWork.canonicalWork.anchors[0].kind !== 'passage'
    )
      throw new Error(`${sharedWork.id} must resolve to one canonical passage anchor`)
  }

  const slowToAnger = works.find(work => work.id === 'bp-word-character-slow-to-anger')
  if (
    slowToAnger?.strongBinding !== 'composite' ||
    JSON.stringify(slowToAnger.strongs.map(anchor => anchor.code).sort()) !==
      JSON.stringify(['H0639', 'H0750'])
  )
    throw new Error('Slow to Anger must remain the H0750 + H0639 composite')
  if (sharedWorks[0].strongBinding !== 'none')
    throw new Error('The Character of God overview must not receive a synthetic Strong')
}

const addUnique = (values, value) => {
  if (!values.includes(value)) values.push(value)
}

const languageIndex = (works, language) => {
  const strongs = {}
  const books = Object.fromEntries(
    Array.from({ length: 66 }, (_, index) => [String(index + 1), []])
  )
  const chapters = {}
  for (const work of works) {
    if (!work.editions.some(edition => edition.language === language)) continue
    for (const anchor of work.anchors) {
      if (anchor.kind === 'strong') {
        strongs[anchor.code] ||= []
        addUnique(strongs[anchor.code], work.id)
        continue
      }
      addUnique(books[String(anchor.book)], work.id)
      const chapterEnd = anchor.chapterEnd || anchor.chapterStart
      for (let chapter = anchor.chapterStart; chapter <= chapterEnd; chapter++) {
        const key = `${anchor.book}:${chapter}`
        chapters[key] ||= []
        addUnique(chapters[key], work.id)
      }
    }
  }
  return { strongs, books, chapters }
}

const main = async () => {
  const [catalog, visualManifest] = await Promise.all(
    [CATALOG_PATH, VISUAL_MANIFEST_PATH].map(async path => JSON.parse(await readFile(path, 'utf8')))
  )
  const resolvedSharedWorks = BIBLE_PROJECT_WORD_STUDY_SHARED_WORKS.map(definition => {
    const canonicalWork = visualManifest.works.find(work => work.id === definition.id)
    if (!canonicalWork)
      throw new Error(`${definition.id} is missing from ${definition.sourceManifest}`)
    return { ...definition, canonicalWork }
  })
  validateRegistry(catalog.videos, resolvedSharedWorks)
  const catalogById = new Map(catalog.videos.map(video => [video.id, video]))

  const works = BIBLE_PROJECT_WORD_STUDY_WORKS.map(definition => ({
    id: definition.id,
    category: 'word-study',
    series: definition.series,
    reviewStatus: 'reviewed',
    sourceUrl: definition.sourceUrl,
    strongBinding: definition.strongBinding,
    editions: LANGUAGES.map(language =>
      editionFromVideo(definition.id, catalogById.get(definition.editions[language]), language)
    ),
    anchors: [
      ...definition.strongs.map(anchor =>
        reviewedStrongAnchor(anchor, definition.evidenceUrl || definition.sourceUrl)
      ),
      ...definition.passages.map(anchor =>
        reviewedPassageAnchor(anchor, definition.evidenceUrl || definition.sourceUrl)
      ),
    ],
  }))

  const sharedWorkReferences = resolvedSharedWorks.map(definition => ({
    id: definition.id,
    series: definition.series,
    sourceManifest: definition.sourceManifest,
    strongBinding: definition.strongBinding,
    editionIds: Object.fromEntries(
      definition.canonicalWork.editions.map(edition => [edition.language, edition.id])
    ),
    reason: definition.reason,
  }))
  const manifest = {
    schemaVersion: 1,
    generatedAt: catalog.generatedAt,
    refreshDueAt: catalog.refreshDueAt,
    languagePolicy: {
      selection: 'strict-route-language',
      fallbackAcrossLanguages: false,
    },
    lexiconReview: {
      resource: 'strong-lexicon-core',
      schemaVersion: 2,
      reviewStatus: 'reviewed',
      verifiedFields: ['code', 'language', 'lemma'],
    },
    attribution: catalog.attribution,
    works,
    sharedWorkReferences,
    languageIndexes: Object.fromEntries(
      LANGUAGES.map(language => [
        language,
        languageIndex([...works, ...resolvedSharedWorks.map(work => work.canonicalWork)], language),
      ])
    ),
  }
  if (JSON.stringify(manifest.languageIndexes.fr) !== JSON.stringify(manifest.languageIndexes.en))
    throw new Error('Complete bilingual coverage must produce symmetric strict-language indexes')
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`)

  const directProviderIds = works.flatMap(work => work.editions.map(edition => edition.providerId))
  const sharedProviderIds = resolvedSharedWorks.flatMap(work =>
    work.canonicalWork.editions.map(edition => edition.providerId)
  )
  const categoryProviderIds = new Set(
    catalog.videos.filter(video => video.category === 'word-study').map(video => video.id)
  )
  const allStrongAnchors = works.flatMap(work =>
    work.anchors.filter(anchor => anchor.kind === 'strong')
  )
  const audit = {
    schemaVersion: 1,
    generatedAt: catalog.generatedAt,
    totals: {
      conceptualWorks: works.length + sharedWorkReferences.length,
      localWorks: works.length,
      sharedWorks: sharedWorkReferences.length,
      editions: directProviderIds.length + sharedProviderIds.length,
      localEditions: directProviderIds.length,
      sharedEditions: sharedProviderIds.length,
      englishEditions: works.length + sharedWorkReferences.length,
      frenchEditions: works.length + sharedWorkReferences.length,
      reviewedStrongAnchors: allStrongAnchors.length,
      primaryPassageAnchors:
        works.length +
        resolvedSharedWorks.reduce((sum, work) => sum + work.canonicalWork.anchors.length, 0),
    },
    bindingTypes: {
      direct: works.filter(work => work.strongBinding === 'direct').map(work => work.id),
      family: works.filter(work => work.strongBinding === 'family').map(work => work.id),
      composite: works.filter(work => work.strongBinding === 'composite').map(work => work.id),
      none: sharedWorkReferences.map(work => work.id),
    },
    strongCoverage: {
      uniqueCodes: [...new Set(allStrongAnchors.map(anchor => anchor.code))].sort(),
      hebrewCodes: [
        ...new Set(
          allStrongAnchors.filter(anchor => anchor.language === 'hebrew').map(anchor => anchor.code)
        ),
      ].sort(),
      greekCodes: [
        ...new Set(
          allStrongAnchors.filter(anchor => anchor.language === 'greek').map(anchor => anchor.code)
        ),
      ].sort(),
    },
    sourceCoverage: {
      expectedCategoryRecords: categoryProviderIds.size,
      assignedCategoryRecords: directProviderIds.filter(id => categoryProviderIds.has(id)).length,
      sharedCategoryRecords: sharedProviderIds.filter(id => categoryProviderIds.has(id)).length,
      crossCategoryProviderIds: [...directProviderIds, ...sharedProviderIds].filter(
        id => !categoryProviderIds.has(id)
      ),
      unassignedProviderIds: [],
    },
  }
  if (
    audit.totals.conceptualWorks !== 21 ||
    audit.totals.editions !== 42 ||
    audit.totals.englishEditions !== 21 ||
    audit.totals.frenchEditions !== 21
  )
    throw new Error('Unexpected lexical corpus totals')
  await writeFile(MANIFEST_AUDIT_PATH, `${JSON.stringify(audit, null, 2)}\n`)

  const corpusAudit = JSON.parse(await readFile(CORPUS_AUDIT_PATH, 'utf8'))
  corpusAudit.wordStudyManifest = {
    conceptualWorks: audit.totals.conceptualWorks,
    localWorks: audit.totals.localWorks,
    sharedWorks: audit.totals.sharedWorks,
    editions: audit.totals.editions,
    englishEditions: audit.totals.englishEditions,
    frenchEditions: audit.totals.frenchEditions,
    reviewedStrongAnchors: audit.totals.reviewedStrongAnchors,
    primaryPassageAnchors: audit.totals.primaryPassageAnchors,
    strictLanguageSelection: true,
  }
  await writeFile(CORPUS_AUDIT_PATH, `${JSON.stringify(corpusAudit, null, 2)}\n`)

  process.stderr.write(`Wrote ${MANIFEST_PATH}\nWrote ${MANIFEST_AUDIT_PATH}\n`)
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
