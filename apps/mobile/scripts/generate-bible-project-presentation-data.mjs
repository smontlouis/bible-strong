#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises'

const DATA_DIR = 'docs/research/data/bible-project'
const OUTPUT_PATH = `${DATA_DIR}/presentation-data.js`

const readJson = async filename => JSON.parse(await readFile(`${DATA_DIR}/${filename}`, 'utf8'))

const compactEdition = edition => ({
  id: edition.id,
  language: edition.language,
  providerId: edition.providerId,
  sourceUrl: edition.sourceUrl,
  title: edition.title,
  description: edition.description?.replace(/\s+/gu, ' ').trim().slice(0, 420) || '',
  thumbnailUrl: edition.thumbnailUrl,
  durationSeconds: edition.durationSeconds,
  publishedAt: edition.publishedAt,
  captionsAvailable: edition.captionsAvailable,
})

const compactAnchor = anchor => ({
  kind: anchor.kind,
  ...(anchor.testament ? { testament: anchor.testament } : {}),
  ...(anchor.book ? { book: anchor.book } : {}),
  ...(anchor.chapterStart ? { chapterStart: anchor.chapterStart } : {}),
  ...(anchor.verseStart ? { verseStart: anchor.verseStart } : {}),
  ...(anchor.chapterEnd ? { chapterEnd: anchor.chapterEnd } : {}),
  ...(anchor.verseEnd ? { verseEnd: anchor.verseEnd } : {}),
  ...(anchor.code ? { code: anchor.code } : {}),
  ...(anchor.language ? { language: anchor.language } : {}),
  ...(anchor.lemma ? { lemma: anchor.lemma } : {}),
  ...(anchor.transliteration ? { transliteration: anchor.transliteration } : {}),
  ...(anchor.relationship ? { relationship: anchor.relationship } : {}),
  placement: anchor.placement,
  relevance: anchor.relevance,
  reviewStatus: anchor.reviewStatus,
  provenance: anchor.provenance,
  ...(anchor.evidenceUrl ? { evidenceUrl: anchor.evidenceUrl } : {}),
})

const compactWork = work => ({
  id: work.id,
  categories: [work.category],
  ...(work.series ? { series: work.series } : {}),
  ...(work.sourceUrl ? { sourceUrl: work.sourceUrl } : {}),
  ...(work.strongBinding ? { strongBinding: work.strongBinding } : {}),
  editions: work.editions.map(compactEdition),
  anchors: work.anchors.map(compactAnchor),
})

const mergeProjection = (worksById, workId, category, projection = {}) => {
  const work = worksById.get(workId)
  if (!work) throw new Error(`Projection ${category} references unknown work ${workId}`)
  if (!work.categories.includes(category)) work.categories.push(category)
  Object.assign(work, projection)
}

const main = async () => {
  const [
    catalog,
    bookOverview,
    visualCommentary,
    wordStudy,
    themes,
    associatedResources,
    visualCommentaryAudit,
    themeAudit,
    anchorProposals,
  ] = await Promise.all([
    readJson('catalog.json'),
    readJson('book-overview-manifest.json'),
    readJson('visual-commentary-manifest.json'),
    readJson('word-study-manifest.json'),
    readJson('theme-manifest.json'),
    readJson('associated-resource-manifest.json'),
    readJson('visual-commentary-audit.json'),
    readJson('theme-audit.json'),
    readJson('anchor-proposals.json'),
  ])

  const worksById = new Map()
  for (const manifest of [bookOverview, visualCommentary, wordStudy, themes, associatedResources]) {
    for (const sourceWork of manifest.works) {
      if (worksById.has(sourceWork.id))
        throw new Error(`Concrete work ${sourceWork.id} is owned by more than one manifest`)
      worksById.set(sourceWork.id, compactWork(sourceWork))
    }
  }
  for (const sharedWork of wordStudy.sharedWorkReferences) {
    mergeProjection(worksById, sharedWork.id, 'word-study', {
      series: sharedWork.series,
      strongBinding: sharedWork.strongBinding,
      sharedProjectionReason: sharedWork.reason,
    })
  }

  const works = [...worksById.values()].sort((left, right) => left.id.localeCompare(right.id))
  const catalogById = new Map(catalog.videos.map(video => [video.id, video]))
  const editions = works.flatMap(work =>
    work.editions.map(edition => ({
      ...edition,
      workId: work.id,
      categories: work.categories,
      series: work.series,
      anchors: work.anchors,
    }))
  )
  const providerIds = editions.map(edition => edition.providerId)
  const workIdsByProviderId = new Map()
  for (const work of works) {
    for (const edition of work.editions) {
      workIdsByProviderId.set(edition.providerId, [
        ...(workIdsByProviderId.get(edition.providerId) || []),
        work.id,
      ])
    }
  }
  if (works.length !== 284) throw new Error(`Expected 284 unique works, received ${works.length}`)
  if (editions.length !== 489)
    throw new Error(`Expected 489 concrete editions, received ${editions.length}`)
  if (new Set(providerIds).size !== providerIds.length)
    throw new Error('A provider video is published by more than one concrete work')
  const unsupportedFormatIds = providerIds.filter(providerId => {
    const video = catalogById.get(providerId)
    return !video?.aspectRatio || video.isVertical9By16
  })
  if (unsupportedFormatIds.length)
    throw new Error(
      `Concrete works contain unsupported vertical or unknown formats: ${unsupportedFormatIds.join(', ')}`
    )

  const exclusions = [...visualCommentaryAudit.exclusions, ...themeAudit.exclusions]
  const exclusionByProviderId = new Map(
    exclusions.map(exclusion => [exclusion.providerId, exclusion])
  )
  if (exclusionByProviderId.size !== exclusions.length)
    throw new Error('A provider video is excluded by more than one editorial audit')

  const allProposalIds = anchorProposals.records.map(proposal => proposal.providerId)
  if (new Set(allProposalIds).size !== allProposalIds.length)
    throw new Error('Anchor proposals contain duplicate provider IDs')
  const associatedProviderIds = new Set(
    associatedResources.works.flatMap(work => work.editions.map(edition => edition.providerId))
  )
  const acceptedAnchorProposals = anchorProposals.records.filter(
    proposal =>
      proposal.reviewStatus === 'human-accepted' && associatedProviderIds.has(proposal.providerId)
  )
  const curatedRejectedIds = new Set(
    anchorProposals.records
      .filter(proposal => proposal.reviewStatus === 'human-rejected')
      .map(proposal => proposal.providerId)
  )
  const unresolvedProposalIds = anchorProposals.records
    .filter(proposal => !['human-accepted', 'human-rejected'].includes(proposal.reviewStatus))
    .map(proposal => proposal.providerId)
  if (unresolvedProposalIds.length)
    throw new Error(`Anchor proposals still need human review: ${unresolvedProposalIds.join(', ')}`)

  const baselineRejectionReasonsFor = video => {
    const explicitReason = exclusionByProviderId.get(video.id)?.reason
    return [
      explicitReason,
      video.isVertical9By16 ? 'vertical-9-16-format' : null,
      video.category === 'studio' ? 'studio-content' : null,
    ].filter((reason, index, reasons) => reason && reasons.indexOf(reason) === index)
  }
  const rejectionReasonsFor = video => [
    ...(curatedRejectedIds.has(video.id) ? ['human-editorial-rejection'] : []),
    ...baselineRejectionReasonsFor(video),
  ]

  const baselineRejectedIds = new Set(
    catalog.videos.filter(video => baselineRejectionReasonsFor(video).length).map(video => video.id)
  )
  if (baselineRejectedIds.size !== 284)
    throw new Error(`Expected 284 baseline rejected videos, received ${baselineRejectedIds.size}`)
  const alreadyRejectedCuratedIds = [...curatedRejectedIds].filter(providerId =>
    baselineRejectedIds.has(providerId)
  )
  if (alreadyRejectedCuratedIds.length)
    throw new Error(
      `Human curation redundantly rejects baseline exclusions: ${alreadyRejectedCuratedIds.join(', ')}`
    )

  const excludedVideos = catalog.videos.flatMap(video => {
    const reasons = rejectionReasonsFor(video)
    if (!reasons.length) return []
    return {
      id: video.id,
      language: video.language,
      title: video.title,
      category: video.category,
      thumbnailUrl: video.thumbnailUrl,
      durationSeconds: video.durationSeconds,
      embedWidth: video.embedWidth,
      embedHeight: video.embedHeight,
      aspectRatio: video.aspectRatio,
      orientation: video.orientation,
      isVertical9By16: video.isVertical9By16,
      sourceUrl: video.sourceUrl,
      reason: reasons[0],
      reasons,
    }
  })
  const rejectedProviderIds = new Set(excludedVideos.map(video => video.id))
  const placedRejectedIds = providerIds.filter(providerId => rejectedProviderIds.has(providerId))
  if (placedRejectedIds.length)
    throw new Error(`Rejected videos are still placed: ${placedRejectedIds.join(', ')}`)

  const proposalIds = acceptedAnchorProposals.map(proposal => proposal.providerId)
  const anchorProposalByProviderId = new Map(
    acceptedAnchorProposals.map(proposal => [proposal.providerId, proposal])
  )
  const expectedProposalIds = associatedProviderIds
  const missingProposalIds = [...expectedProposalIds].filter(
    providerId => !anchorProposalByProviderId.has(providerId)
  )
  const unexpectedProposalIds = proposalIds.filter(
    providerId => !expectedProposalIds.has(providerId)
  )
  if (missingProposalIds.length || unexpectedProposalIds.length)
    throw new Error(
      `Anchor proposal coverage mismatch; missing=${missingProposalIds.join(',')} unexpected=${unexpectedProposalIds.join(',')}`
    )

  const inventory = catalog.videos.map(video => {
    const workIds = workIdsByProviderId.get(video.id) || []
    const exclusionReasons = rejectionReasonsFor(video)
    const disposition = workIds.length
      ? 'placed'
      : exclusionReasons.length
        ? 'rejected-reviewed'
        : anchorProposalByProviderId.has(video.id)
          ? 'associated-placed'
          : video.suitability === 'exclude'
            ? 'classified-out-of-scope'
            : video.suitability === 'inline-primary'
              ? 'inline-candidate'
              : video.suitability === 'related'
                ? 'related-candidate'
                : 'needs-review'
    return {
      id: video.id,
      language: video.language,
      title: video.title,
      category: video.category,
      suitability: video.suitability,
      disposition,
      ...(workIds.length ? { workIds } : {}),
      ...(exclusionReasons.length
        ? { exclusionReason: exclusionReasons[0], exclusionReasons }
        : {}),
      ...(anchorProposalByProviderId.has(video.id) && !workIds.length
        ? { anchorProposal: anchorProposalByProviderId.get(video.id) }
        : {}),
      thumbnailUrl: video.thumbnailUrl,
      durationSeconds: video.durationSeconds,
      embedWidth: video.embedWidth,
      embedHeight: video.embedHeight,
      aspectRatio: video.aspectRatio,
      orientation: video.orientation,
      isVertical9By16: video.isVertical9By16,
      sourceUrl: video.sourceUrl,
      publishedAt: video.publishedAt,
      captionsAvailable: video.captionsAvailable,
      localizedCounterpartIds: video.localizedCounterpartIds,
      bookMentions: video.bookMentions,
      referenceMentions: video.referenceMentions,
    }
  })

  if (inventory.length !== 795)
    throw new Error(`Expected 795 inventory records, received ${inventory.length}`)
  const expectedExclusionCount = baselineRejectedIds.size + curatedRejectedIds.size
  if (excludedVideos.length !== expectedExclusionCount)
    throw new Error(
      `Expected ${expectedExclusionCount} rejected videos, received ${excludedVideos.length}`
    )
  const unownedProviderIds = catalog.videos
    .filter(video => !workIdsByProviderId.has(video.id) && !rejectedProviderIds.has(video.id))
    .map(video => video.id)
  if (unownedProviderIds.length)
    throw new Error(`Published videos are missing a resource: ${unownedProviderIds.join(', ')}`)

  const output = {
    schemaVersion: 5,
    generatedAt: catalog.generatedAt,
    totals: {
      works: works.length,
      editions: editions.length,
      inventory: inventory.length,
      exclusions: excludedVideos.length,
    },
    works,
    inventory,
    excludedVideos,
  }
  await writeFile(
    OUTPUT_PATH,
    `globalThis.BIBLE_PROJECT_PRESENTATION_DATA = ${JSON.stringify(output)}\n`
  )
  process.stderr.write(`Wrote ${OUTPUT_PATH}\n`)
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
