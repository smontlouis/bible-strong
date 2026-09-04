#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const ROOT = process.cwd()
const DATA_DIR = path.join(ROOT, 'docs/research/data/bible-project')
const INPUT_PATH = path.join(DATA_DIR, 'anchor-dossier-index.json')
const OUTPUT_DIR = path.join(ROOT, '.scratch/generated/bible-project-anchor-agent-batches')

const readJson = async filename => JSON.parse(await readFile(filename, 'utf8'))

const batchFor = entry => {
  if (entry.category === 'podcast') return 'podcasts'
  if (['book-collection', 'how-to-read'].includes(entry.category)) return 'series'
  return 'other'
}

const compactBrief = dossier => ({
  providerId: dossier.providerId,
  language: dossier.language,
  title: dossier.title,
  category: dossier.category,
  durationSeconds: dossier.durationSeconds,
  description: dossier.description.slice(0, 2_500),
  playlists: dossier.playlists.map(playlist => playlist.title),
  localizedCounterpartIds: dossier.localizedCounterpartIds,
  metadataSignals: dossier.metadataSignals,
  transcriptStatus: dossier.transcript.status,
  introExcerpt: dossier.extractedSignals.introExcerpt.slice(0, 2_500),
  conclusionExcerpt: dossier.extractedSignals.conclusionExcerpt.slice(-1_000),
  transcriptReferences: dossier.extractedSignals.transcriptReferences.slice(0, 10),
  lexicalSignals: dossier.extractedSignals.lexicalSignals.slice(0, 8),
})

const main = async () => {
  await mkdir(OUTPUT_DIR, { recursive: true })
  const index = await readJson(INPUT_PATH)
  const batches = new Map([
    ['podcasts', []],
    ['series', []],
    ['other', []],
  ])
  for (const entry of index.entries) {
    const dossier = await readJson(path.join(ROOT, entry.dossierPath))
    const brief = compactBrief(dossier)
    brief.fullDossierPath = entry.dossierPath
    batches.get(batchFor(entry)).push(brief)
  }
  for (const [name, briefs] of batches) {
    const output = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      instructionsPath: 'docs/research/bible-project-anchor-agent-instructions.md',
      batch: name,
      count: briefs.length,
      briefs,
    }
    const outputPath = path.join(OUTPUT_DIR, `${name}.json`)
    await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`)
    process.stderr.write(
      `${name}: ${briefs.length} candidates, ${JSON.stringify(output).length} compact chars\n`
    )
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
