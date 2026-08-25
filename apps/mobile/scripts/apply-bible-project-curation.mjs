#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const ROOT = process.cwd()
const DATA_DIR = path.join(ROOT, 'docs/research/data/bible-project')
const PROPOSALS_PATH = path.join(DATA_DIR, 'anchor-proposals.json')
const OUTPUT_PATH = path.join(DATA_DIR, 'curation-decisions.json')

const inputPath = process.argv[2]
if (!inputPath)
  throw new Error('Usage: node scripts/apply-bible-project-curation.mjs <export.json>')

const readJson = async filename => JSON.parse(await readFile(filename, 'utf8'))
const anchorSignature = proposal =>
  JSON.stringify({
    primaryAnchor: proposal?.primaryAnchor,
    relatedAnchors: proposal?.relatedAnchors || [],
  })
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
const normalizeExportedSignature = signature => {
  const proposal = JSON.parse(signature)
  const primaryAnchor = normalizePlacement(proposal.primaryAnchor)
  const seen = new Set([JSON.stringify(primaryAnchor)])
  const relatedAnchors = (proposal.relatedAnchors || []).map(normalizePlacement).filter(anchor => {
    const anchorValue = JSON.stringify(anchor)
    if (seen.has(anchorValue)) return false
    seen.add(anchorValue)
    return true
  })
  return anchorSignature({
    primaryAnchor,
    relatedAnchors,
  })
}
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

const main = async () => {
  const [payload, proposalsOutput] = await Promise.all([
    readJson(path.resolve(inputPath)),
    readJson(PROPOSALS_PATH),
  ])
  if (payload.schemaVersion !== 1) throw new Error('Unsupported curation export schema')
  if (payload.sourceGeneratedAt !== proposalsOutput.sourceGeneratedAt)
    throw new Error('Curation export and anchor proposals come from different catalog snapshots')
  const proposals = proposalsOutput.records
  const proposalById = new Map(proposals.map(proposal => [proposal.providerId, proposal]))
  const acceptedProviderIds = []
  for (const [providerId, review] of Object.entries(payload.anchorReviews?.reviews || {})) {
    const proposal = proposalById.get(providerId)
    if (!proposal) throw new Error(`Review references unknown proposal ${providerId}`)
    if (review.status !== 'accepted')
      throw new Error(`Unresolved review ${providerId} has status ${review.status}`)
    if (normalizeExportedSignature(review.signature) !== anchorSignature(proposal))
      throw new Error(`Review signature no longer matches proposal ${providerId}`)
    acceptedProviderIds.push(providerId)
  }

  const rejectedProviderIds = []
  for (const [providerId, action] of Object.entries(payload.decisions?.overrides || {})) {
    if (!proposalById.has(providerId))
      throw new Error(`Decision references unknown proposal ${providerId}`)
    if (action !== 'reject') throw new Error(`Unsupported final decision ${providerId}: ${action}`)
    rejectedProviderIds.push(providerId)
  }

  const decidedIds = [...acceptedProviderIds, ...rejectedProviderIds]
  if (new Set(decidedIds).size !== decidedIds.length)
    throw new Error('A proposal is both accepted and rejected')
  const missingIds = [...proposalById.keys()].filter(providerId => !decidedIds.includes(providerId))
  if (missingIds.length) throw new Error(`Curation is incomplete: ${missingIds.join(', ')}`)

  acceptedProviderIds.sort()
  rejectedProviderIds.sort()
  const output = {
    schemaVersion: 1,
    exportedAt: payload.exportedAt,
    sourceGeneratedAt: payload.sourceGeneratedAt,
    placementPolicy: {
      multiChapterPassages: 'end-of-each-chapter',
      wholeChapterPassages: 'end-of-chapter',
      introductions: 'unified',
    },
    proposalSetHash: proposalSetHash(proposals),
    totals: {
      proposals: proposals.length,
      accepted: acceptedProviderIds.length,
      rejected: rejectedProviderIds.length,
    },
    acceptedProviderIds,
    rejectedProviderIds,
  }
  await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`)
  process.stderr.write(`Wrote ${path.relative(ROOT, OUTPUT_PATH)}\n`)
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
