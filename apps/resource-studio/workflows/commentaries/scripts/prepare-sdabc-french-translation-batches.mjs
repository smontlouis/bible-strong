#!/usr/bin/env node

import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildSdabcTranslationPlan,
  canonicalJson,
  sha256,
} from './sdabc-french-translation-pipeline.mjs'

const workflowRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const parseArguments = argv => {
  const options = {
    libraryRoot: path.join(workflowRoot, '.local/library'),
    outputRoot: path.join(workflowRoot, '.local/sdabc-french-translation-plan'),
    maxSourceCharacters: 5_000,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--library') options.libraryRoot = path.resolve(argv[++index])
    else if (argument === '--output') options.outputRoot = path.resolve(argv[++index])
    else if (argument === '--max-source-characters') options.maxSourceCharacters = Number(argv[++index])
    else if (argument === '--help') options.help = true
    else throw new Error(`Argument inconnu : ${argument}`)
  }
  return options
}

const readJson = async filePath => JSON.parse(await readFile(filePath, 'utf8'))

const loadCanonicalEntries = async libraryRoot => {
  const index = await readJson(path.join(libraryRoot, 'index.json'))
  const entries = []
  for (const chapter of index.chapters) {
    const descriptor = chapter.resources.sdabc
    if (!descriptor) continue
    const serialized = await readFile(path.join(libraryRoot, descriptor.path), 'utf8')
    if (sha256(serialized) !== descriptor.sha256) throw new Error(`Hash de chunk invalide : ${descriptor.path}`)
    entries.push(...JSON.parse(serialized).entries)
  }
  return entries
}

const writeAtomically = async (filePath, text) => {
  await mkdir(path.dirname(filePath), { recursive: true })
  const temporary = `${filePath}.tmp-${process.pid}-${Date.now()}`
  try {
    await writeFile(temporary, text)
    await rename(temporary, filePath)
  } finally {
    await rm(temporary, { force: true })
  }
}

export const writeSdabcTranslationPlan = async (outputRoot, plan) => {
  const batchRoot = path.join(outputRoot, 'batches')
  await mkdir(batchRoot, { recursive: true })
  const expected = new Set(plan.batches.map(batch => `${batch.batchId}.json`))
  // Batch files are immutable/content-addressed. Stale files are harmless and deliberately retained
  // so an interrupted run can still be audited; the manifest selects the active set.
  for (const batch of plan.batches) {
    const filePath = path.join(batchRoot, `${batch.batchId}.json`)
    await writeAtomically(filePath, `${JSON.stringify(batch, null, 2)}\n`)
  }
  await writeAtomically(path.join(outputRoot, 'manifest.json'), `${JSON.stringify(plan.manifest, null, 2)}\n`)
  return { activeBatchFiles: expected.size }
}

const usage = `Usage: node prepare-sdabc-french-translation-batches.mjs [options]\n\n` +
  `  --library <dossier>                 Bibliothèque canonique locale\n` +
  `  --output <dossier>                  Plan local content-addressed\n` +
  `  --max-source-characters <nombre>    5000 par défaut\n`

const run = async () => {
  const options = parseArguments(process.argv.slice(2))
  if (options.help) return process.stdout.write(usage)
  const entries = await loadCanonicalEntries(options.libraryRoot)
  const plan = buildSdabcTranslationPlan(entries, { maxSourceCharacters: options.maxSourceCharacters })
  await writeSdabcTranslationPlan(options.outputRoot, plan)
  process.stdout.write(`${JSON.stringify({
    outputRoot: options.outputRoot,
    manifestHash: plan.manifest.manifestHash,
    counts: plan.manifest.counts,
    policyHash: sha256(canonicalJson(plan.manifest.policy)),
  }, null, 2)}\n`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run().catch(error => {
    process.stderr.write(`${error.stack ?? error.message}\n`)
    process.exitCode = 1
  })
}
