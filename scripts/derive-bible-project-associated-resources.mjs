#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises'

const DATA_DIR = 'docs/research/data/bible-project'
const OUTPUT_PATH = `${DATA_DIR}/associated-resource-manifest.json`
const LOCALIZED_ASSOCIATED_PAIRS = [
  ['XX-aAg4_U2Q', 'IT3LVWWuDDo'],
  ['Sew1kBIe-W0', 'eFx-W3P6MeY'],
  ['UNDX4tUdj1Y', 'Tn09RdxfqbM'],
  ['L0-8nUbfW5w', 'xrzq_X1NNaA'],
  ['j3rlwb50pHo', 'GZuceW7eh5M'],
  ['dBXtH8uE_ig', 'ZPZ2uABVMKA'],
  ['0EQDGax19xk', '9_2HEqFsIoI'],
  ['7FuT8WtoAK0', 'vRkq3_M6uMs'],
  ['7_CGP-12AE0', 'gWJaxlYRSc0'],
  ['dLFCE8z__hw', 'FqXKc81z7Oc'],
  ['q9yp1ZXbsEg', 'IQhUpoYAnKQ'],
  ['L9W5afjndtU', 'U7wdHldVoqg'],
  ['edcqUu_BtN0', 'QmrpB52gWwM'],
  ['VhmlJBUIoLk', 'sIOnEbHB4Fk'],
  ['ak06MSETeo4', 'pYYIYRhlVoI'],
  ['dpny22k_7uk', 'u893rxHGrWU'],
  ['oUXJ8Owes8E', 'ebI_4ZxcAMk'],
  ['rkqsQpck8YU', 'j5qdaWO9wp8'],
  ['WJgt1vRkPbI', 'YEv5AkBF56c'],
]
const MULTI_TARGET_PROVIDER_IDS = new Set([
  'XX-aAg4_U2Q',
  'IT3LVWWuDDo',
  'Sew1kBIe-W0',
  'eFx-W3P6MeY',
  'edcqUu_BtN0',
  'QmrpB52gWwM',
  'L0-8nUbfW5w',
  'xrzq_X1NNaA',
  'j3rlwb50pHo',
  'GZuceW7eh5M',
  'dBXtH8uE_ig',
  'ZPZ2uABVMKA',
  'WJgt1vRkPbI',
  'YEv5AkBF56c',
])
const ACTIVE_STRONG_PROVIDER_IDS = new Set([
  'FL-n3dnClY8',
  'VZxb06PVFAE',
  'YMTR7M33eIQ',
  'YoOgGeDfXDk',
  'aLvcF1NLwYU',
  'hhkafDU0XF0',
  'mz0tAI2SdPk',
  'tlwz151z_80',
])
const HOW_TO_READ_LIBRARY_PROVIDER_IDS = new Set(['WJgt1vRkPbI', 'YEv5AkBF56c'])

const readJson = async filename => JSON.parse(await readFile(`${DATA_DIR}/${filename}`, 'utf8'))

const anchorSignature = proposal =>
  JSON.stringify({
    primaryAnchor: proposal.primaryAnchor,
    relatedAnchors: proposal.relatedAnchors || [],
  })

const editionFromVideo = (video, workId) => ({
  id: `${workId}:${video.language}`,
  language: video.language,
  provider: video.provider,
  providerId: video.providerId,
  sourceUrl: video.sourceUrl,
  title: video.title,
  description: video.description,
  thumbnailUrl: video.thumbnailUrl,
  durationSeconds: video.durationSeconds,
  publishedAt: video.publishedAt,
  embeddable: video.embeddable,
  madeForKids: video.madeForKids,
  captionsAvailable: video.captionsAvailable,
})

const reviewedAnchor = (anchor, relevance) => ({
  ...anchor,
  relevance,
  reviewStatus: 'reviewed',
  provenance: 'human-editorial-curation',
})

const main = async () => {
  const [catalog, proposals, visualCommentaries, themes] = await Promise.all([
    readJson('catalog.json'),
    readJson('anchor-proposals.json'),
    readJson('visual-commentary-manifest.json'),
    readJson('theme-manifest.json'),
  ])
  const canonicalProviderIds = new Set(
    [visualCommentaries, themes].flatMap(manifest =>
      manifest.works.flatMap(work => work.editions.map(edition => edition.providerId))
    )
  )
  const accepted = proposals.records.filter(
    record =>
      record.reviewStatus === 'human-accepted' && !canonicalProviderIds.has(record.providerId)
  )
  const acceptedById = new Map(accepted.map(record => [record.providerId, record]))
  const videoById = new Map(catalog.videos.map(video => [video.id, video]))
  const adjacency = new Map(accepted.map(record => [record.providerId, new Set()]))

  for (const record of accepted) {
    const video = videoById.get(record.providerId)
    if (!video) throw new Error(`Accepted proposal references unknown video ${record.providerId}`)
    for (const counterpartId of video.localizedCounterpartIds || []) {
      if (!acceptedById.has(counterpartId)) continue
      adjacency.get(record.providerId).add(counterpartId)
      adjacency.get(counterpartId).add(record.providerId)
    }
  }

  for (const [leftId, rightId] of LOCALIZED_ASSOCIATED_PAIRS) {
    if (!acceptedById.has(leftId) || !acceptedById.has(rightId)) continue
    adjacency.get(leftId).add(rightId)
    adjacency.get(rightId).add(leftId)
  }

  const bookCollectionsByAnchor = Map.groupBy(
    accepted.filter(record => record.category === 'book-collection'),
    anchorSignature
  )
  for (const records of bookCollectionsByAnchor.values()) {
    for (const record of records) {
      for (const counterpart of records) {
        if (record.language === counterpart.language) continue
        adjacency.get(record.providerId).add(counterpart.providerId)
      }
    }
  }

  const components = []
  const visited = new Set()
  for (const providerId of [...acceptedById.keys()].sort()) {
    if (visited.has(providerId)) continue
    const component = []
    const queue = [providerId]
    visited.add(providerId)
    while (queue.length) {
      const current = queue.shift()
      component.push(current)
      for (const neighbor of adjacency.get(current)) {
        if (visited.has(neighbor)) continue
        visited.add(neighbor)
        queue.push(neighbor)
      }
    }
    components.push(component.sort())
  }

  const works = components.map(providerIds => {
    const records = providerIds.map(providerId => acceptedById.get(providerId))
    const videos = providerIds.map(providerId => videoById.get(providerId))
    const languages = videos.map(video => video.language)
    if (new Set(languages).size !== languages.length)
      throw new Error(`Associated resource has duplicate languages: ${providerIds.join(', ')}`)
    const signatures = new Set(records.map(anchorSignature))
    if (signatures.size !== 1)
      throw new Error(`Localized editions disagree on anchors: ${providerIds.join(', ')}`)

    const canonicalId = providerIds[0]
    const workId = `associated-resource-${canonicalId}`
    const proposal = records[0]
    const hasMultiplePlacementTargets = providerIds.some(providerId =>
      MULTI_TARGET_PROVIDER_IDS.has(providerId)
    )
    const hasActiveStrongTarget = providerIds.some(providerId =>
      ACTIVE_STRONG_PROVIDER_IDS.has(providerId)
    )
    const isHowToReadLibraryWork = providerIds.some(providerId =>
      HOW_TO_READ_LIBRARY_PROVIDER_IDS.has(providerId)
    )
    const categories = videos.map(video => video.category)
    const category = categories.find(value => value !== 'uncategorized') || categories[0]
    return {
      id: workId,
      category,
      ...(isHowToReadLibraryWork ? { categories: [category, 'how-to-read'] } : {}),
      reviewStatus: 'reviewed',
      editions: videos
        .map(video => editionFromVideo(video, workId))
        .sort((left, right) => left.language.localeCompare(right.language)),
      anchors: [
        reviewedAnchor(proposal.primaryAnchor, 'primary'),
        ...(proposal.relatedAnchors || []).map(anchor =>
          reviewedAnchor(
            anchor,
            (hasMultiplePlacementTargets && ['book', 'passage'].includes(anchor.kind)) ||
              (hasActiveStrongTarget && anchor.kind === 'strong')
              ? 'primary'
              : 'related'
          )
        ),
        ...(isHowToReadLibraryWork
          ? [reviewedAnchor({ kind: 'library', placement: 'library' }, 'primary')]
          : []),
      ],
    }
  })

  const editions = works.flatMap(work => work.editions)
  if (works.length !== 110)
    throw new Error(`Expected 110 associated resources, got ${works.length}`)
  if (editions.length !== 149)
    throw new Error(`Expected 149 associated editions, got ${editions.length}`)
  if (new Set(editions.map(edition => edition.providerId)).size !== accepted.length)
    throw new Error('Associated manifest does not own every accepted video exactly once')

  const output = {
    schemaVersion: 1,
    generatedAt: catalog.generatedAt,
    refreshDueAt: catalog.refreshDueAt,
    languagePolicy: {
      selection: 'strict-route-language',
      fallbackAcrossLanguages: false,
    },
    attribution: catalog.attribution,
    totals: {
      works: works.length,
      editions: editions.length,
      localizedWorks: works.filter(work => work.editions.length > 1).length,
    },
    works,
  }
  await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`)
  process.stderr.write(`Wrote ${OUTPUT_PATH}\n`)
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
