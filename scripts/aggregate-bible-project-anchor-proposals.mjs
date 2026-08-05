#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const ROOT = process.cwd()
const DATA_DIR = path.join(ROOT, 'docs/research/data/bible-project')
const INDEX_PATH = path.join(DATA_DIR, 'anchor-dossier-index.json')
const REVIEW_DIR = path.join(DATA_DIR, 'anchor-agent-reviews')
const OUTPUT_PATH = path.join(DATA_DIR, 'anchor-proposals.json')
const BATCHES = ['podcasts', 'series', 'other']
const KINDS = new Set(['passage', 'book', 'testament', 'strong', 'library'])
const PLACEMENTS = new Set([
  'after-range',
  'book-intro',
  'chapter-resources',
  'strong-resource',
  'library',
])
const CONFIDENCES = new Set(['high', 'medium', 'low'])
const PLACEMENTS_BY_KIND = {
  passage: new Set(['after-range', 'chapter-resources']),
  book: new Set(['book-intro']),
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

const main = async () => {
  const index = await readJson(INDEX_PATH)
  const sourceById = new Map(index.entries.map(entry => [entry.providerId, entry]))
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
  const records = proposals
    .map(proposal => ({
      providerId: proposal.providerId,
      language: sourceById.get(proposal.providerId).language,
      title: sourceById.get(proposal.providerId).title,
      category: sourceById.get(proposal.providerId).category,
      primaryAnchor: proposal.primaryAnchor,
      relatedAnchors: proposal.relatedAnchors || [],
      confidence: proposal.confidence,
      reviewStatus: proposal.reviewStatus,
      rationale: proposal.rationale,
      evidence: proposal.evidence || [],
    }))
    .sort((left, right) => left.providerId.localeCompare(right.providerId))
  const output = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceGeneratedAt: index.sourceGeneratedAt,
    method:
      'Agent proposals from official metadata and cached YouTube transcripts; every target requires human editorial validation before publication.',
    totals: {
      records: records.length,
      byKind: countBy(records, record => record.primaryAnchor.kind),
      byConfidence: countBy(records, record => record.confidence),
      byCategory: countBy(records, record => record.category),
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
