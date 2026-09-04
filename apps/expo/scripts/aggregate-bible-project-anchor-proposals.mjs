#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const ROOT = process.cwd()
const DATA_DIR = path.join(ROOT, 'docs/research/data/bible-project')
const INDEX_PATH = path.join(DATA_DIR, 'anchor-dossier-index.json')
const REVIEW_DIR = path.join(DATA_DIR, 'anchor-agent-reviews')
const OUTPUT_PATH = path.join(DATA_DIR, 'anchor-proposals.json')
const CURATION_PATH = path.join(DATA_DIR, 'curation-decisions.json')
const CATALOG_PATH = path.join(DATA_DIR, 'catalog.json')
const BATCHES = ['podcasts', 'series', 'other']
const KINDS = new Set(['passage', 'book', 'testament', 'strong', 'library'])
const PLACEMENTS = new Set([
  'after-range',
  'introduction',
  'chapter-resources',
  'strong-resource',
  'library',
])
const CONFIDENCES = new Set(['high', 'medium', 'low'])
const BOOK_CHAPTER_COUNTS = [
  50, 40, 27, 36, 34, 24, 21, 4, 31, 24, 22, 25, 29, 36, 10, 13, 10, 42, 150, 31, 12, 8, 66, 52, 5,
  48, 12, 14, 3, 9, 1, 4, 7, 3, 3, 3, 2, 14, 4, 28, 16, 24, 21, 28, 16, 16, 13, 6, 6, 4, 4, 5, 3, 6,
  4, 3, 1, 13, 5, 5, 3, 5, 1, 1, 1, 22,
]
const PLACEMENTS_BY_KIND = {
  passage: new Set(['introduction', 'after-range', 'chapter-resources']),
  book: new Set(['introduction']),
  testament: new Set(['library']),
  strong: new Set(['strong-resource']),
  library: new Set(['library']),
}

const readJson = async filename => JSON.parse(await readFile(filename, 'utf8'))

const validateAnchor = (anchor, providerId, label) => {
  if (!anchor || !KINDS.has(anchor.kind)) throw new Error(`${providerId} has invalid ${label} kind`)
  if (!PLACEMENTS.has(anchor.placement))
    throw new Error(`${providerId} has invalid ${label} placement`)
  if (!PLACEMENTS_BY_KIND[anchor.kind].has(anchor.placement))
    throw new Error(`${providerId} has incompatible ${label} kind and placement`)
  if (['passage', 'book'].includes(anchor.kind)) {
    if (!Number.isInteger(anchor.book) || anchor.book < 1 || anchor.book > 66)
      throw new Error(`${providerId} has invalid ${label} book`)
  }
  if (anchor.kind === 'passage') {
    if (!Number.isInteger(anchor.chapterStart) || anchor.chapterStart < 1)
      throw new Error(`${providerId} has invalid ${label} chapterStart`)
    if (
      anchor.chapterEnd !== undefined &&
      (!Number.isInteger(anchor.chapterEnd) || anchor.chapterEnd < anchor.chapterStart)
    )
      throw new Error(`${providerId} has reversed ${label} chapter range`)
    for (const field of ['verseStart', 'verseEnd']) {
      if (anchor[field] !== undefined && (!Number.isInteger(anchor[field]) || anchor[field] < 1))
        throw new Error(`${providerId} has invalid ${label} ${field}`)
    }
    if (anchor.verseEnd !== undefined && anchor.verseStart === undefined)
      throw new Error(`${providerId} has ${label} verseEnd without verseStart`)
    if (
      anchor.verseStart !== undefined &&
      anchor.verseEnd !== undefined &&
      (anchor.chapterEnd || anchor.chapterStart) === anchor.chapterStart &&
      anchor.verseEnd < anchor.verseStart
    )
      throw new Error(`${providerId} has reversed ${label} verse range`)
  }
  if (anchor.kind === 'testament' && !['old', 'new'].includes(anchor.testament))
    throw new Error(`${providerId} has invalid ${label} testament`)
  if (anchor.kind === 'strong' && !/^[HG]\d{4}$/u.test(anchor.code || ''))
    throw new Error(`${providerId} has invalid ${label} Strong code`)
}

const validateProposal = proposal => {
  if (!proposal?.providerId) throw new Error('Proposal is missing providerId')
  validateAnchor(proposal.primaryAnchor, proposal.providerId, 'primary anchor')
  for (const anchor of proposal.relatedAnchors || [])
    validateAnchor(anchor, proposal.providerId, 'related anchor')
  if (!CONFIDENCES.has(proposal.confidence))
    throw new Error(`${proposal.providerId} has invalid confidence`)
  if (proposal.reviewStatus !== 'agent-proposed')
    throw new Error(`${proposal.providerId} has invalid reviewStatus`)
  if (!proposal.rationale?.trim()) throw new Error(`${proposal.providerId} has no rationale`)
  for (const evidence of proposal.evidence || []) {
    if (!['transcript', 'metadata', 'title', 'description', 'playlist'].includes(evidence.source))
      throw new Error(`${proposal.providerId} has invalid evidence source`)
    if ((evidence.excerpt || '').length > 500)
      throw new Error(`${proposal.providerId} has an overlong evidence excerpt`)
  }
}

const countBy = (items, selector) => {
  const counts = {}
  for (const item of items) {
    const key = selector(item)
    counts[key] = (counts[key] || 0) + 1
  }
  return Object.fromEntries(
    Object.entries(counts).sort(([left], [right]) => left.localeCompare(right))
  )
}

const anchorSignature = proposal =>
  JSON.stringify({
    primaryAnchor: proposal?.primaryAnchor,
    relatedAnchors: proposal?.relatedAnchors || [],
  })
const proposalSetHash = proposals =>
  `sha256:${createHash('sha256')
    .update(
      JSON.stringify(
        proposals
          .map(proposal => [proposal.providerId, anchorSignature(proposal)])
          .sort(([left], [right]) => left.localeCompare(right))
      )
    )
    .digest('hex')}`

const normalizePlacement = anchor => {
  if (['book-intro', 'before-range'].includes(anchor.placement))
    return { ...anchor, placement: 'introduction' }
  if (
    anchor.kind === 'passage' &&
    anchor.placement === 'after-range' &&
    ((anchor.chapterEnd || anchor.chapterStart) > anchor.chapterStart ||
      anchor.verseStart === undefined)
  )
    return { ...anchor, placement: 'chapter-resources' }
  return anchor
}

const normalizeCategoryAnchor = (category, anchor) => {
  const normalized = normalizePlacement(anchor)
  if (category !== 'book-collection') return normalized
  if (normalized.kind === 'book') {
    return {
      kind: 'passage',
      book: normalized.book,
      chapterStart: 1,
      chapterEnd: BOOK_CHAPTER_COUNTS[normalized.book - 1],
      placement: 'chapter-resources',
    }
  }
  return { ...normalized, placement: 'chapter-resources' }
}

const deduplicateRelatedAnchors = (primaryAnchor, relatedAnchors) => {
  const seen = new Set([JSON.stringify(primaryAnchor)])
  return relatedAnchors.filter(anchor => {
    const signature = JSON.stringify(anchor)
    if (seen.has(signature)) return false
    seen.add(signature)
    return true
  })
}

const main = async () => {
  const [index, curation, catalog] = await Promise.all([
    readJson(INDEX_PATH),
    readJson(CURATION_PATH),
    readJson(CATALOG_PATH),
  ])
  if (curation.schemaVersion !== 1) throw new Error('Unsupported curation decision schema')
  if (curation.placementPolicy?.multiChapterPassages !== 'end-of-each-chapter')
    throw new Error('Unsupported multi-chapter placement policy')
  if (curation.placementPolicy?.wholeChapterPassages !== 'end-of-chapter')
    throw new Error('Unsupported whole-chapter placement policy')
  if (curation.placementPolicy?.introductions !== 'unified')
    throw new Error('Unsupported introduction placement policy')
  if (curation.sourceGeneratedAt !== index.sourceGeneratedAt)
    throw new Error('Curation decisions and anchor dossiers come from different catalog snapshots')
  const sourceById = new Map(index.entries.map(entry => [entry.providerId, entry]))
  const bookCollectionProviderIds = new Set(
    catalog.videos
      .filter(video => video.category === 'book-collection')
      .flatMap(video => [video.id, ...(video.localizedCounterpartIds || [])])
  )
  bookCollectionProviderIds.add('YEv5AkBF56c')
  const batchOutputs = await Promise.all(
    BATCHES.map(batch => readJson(path.join(REVIEW_DIR, `${batch}.json`)))
  )
  const proposals = batchOutputs.flatMap(output => output.proposals)
  for (const proposal of proposals) validateProposal(proposal)
  const ids = proposals.map(proposal => proposal.providerId)
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate provider IDs in proposals')
  const missingIds = [...sourceById.keys()].filter(id => !ids.includes(id))
  const unexpectedIds = ids.filter(id => !sourceById.has(id))
  if (missingIds.length || unexpectedIds.length)
    throw new Error(
      `Proposal coverage mismatch; missing=${missingIds.join(',')} unexpected=${unexpectedIds.join(',')}`
    )
  const acceptedIds = new Set(curation.acceptedProviderIds)
  const rejectedIds = new Set(curation.rejectedProviderIds)
  const curatedIds = [...acceptedIds, ...rejectedIds]
  if (curatedIds.length !== proposals.length || new Set(curatedIds).size !== proposals.length)
    throw new Error('Curation decisions do not partition every anchor proposal exactly once')
  const unknownCuratedIds = curatedIds.filter(providerId => !sourceById.has(providerId))
  if (unknownCuratedIds.length)
    throw new Error(`Curation references unknown provider IDs: ${unknownCuratedIds.join(',')}`)
  const records = proposals
    .map(proposal => {
      const source = sourceById.get(proposal.providerId)
      const effectiveCategory = bookCollectionProviderIds.has(proposal.providerId)
        ? 'book-collection'
        : source.category
      const primaryAnchor = normalizeCategoryAnchor(effectiveCategory, proposal.primaryAnchor)
      const relatedAnchors = (proposal.relatedAnchors || []).map(anchor =>
        normalizeCategoryAnchor(effectiveCategory, anchor)
      )
      const anchors = [primaryAnchor, ...relatedAnchors]
      return {
        providerId: proposal.providerId,
        language: source.language,
        title: source.title,
        category: source.category,
        primaryAnchor,
        relatedAnchors: deduplicateRelatedAnchors(primaryAnchor, [
          ...relatedAnchors,
          ...(effectiveCategory === 'how-to-read' &&
          !anchors.some(anchor => anchor.kind === 'library')
            ? [{ kind: 'library', placement: 'library' }]
            : []),
        ]),
        confidence: proposal.confidence,
        reviewStatus: acceptedIds.has(proposal.providerId) ? 'human-accepted' : 'human-rejected',
        rationale: proposal.rationale,
        evidence: proposal.evidence || [],
      }
    })
    .sort((left, right) => left.providerId.localeCompare(right.providerId))
  const currentProposalSetHash = proposalSetHash(records)
  if (curation.proposalSetHash !== currentProposalSetHash)
    throw new Error(
      `Curation decisions no longer match the current anchor proposals; expected=${curation.proposalSetHash} current=${currentProposalSetHash}`
    )
  const output = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceGeneratedAt: index.sourceGeneratedAt,
    method:
      'Agent proposals from official metadata and cached YouTube transcripts, finalized by human editorial review.',
    totals: {
      records: records.length,
      byKind: countBy(records, record => record.primaryAnchor.kind),
      byConfidence: countBy(records, record => record.confidence),
      byCategory: countBy(records, record => record.category),
      byReviewStatus: countBy(records, record => record.reviewStatus),
    },
    records,
  }
  await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`)
  process.stderr.write(`Wrote ${path.relative(ROOT, OUTPUT_PATH)}\n`)
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
