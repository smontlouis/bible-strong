#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sha256 } from './wave-sources.mjs'

const prototypeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const input = path.resolve(process.argv[2] ?? path.join(prototypeRoot, '.local/bible-annotee-export/manifest.json'))
const output = path.resolve(process.argv[3] ?? path.join(prototypeRoot, 'data/audit/bible-annotee.json'))
const manifest = JSON.parse(await readFile(input, 'utf8'))
if (manifest.resourceId !== 'bible-annotee' || manifest.authorization?.status !== 'confirmed-by-project-owner') {
  throw new Error('Le manifeste Bible Annotée est incomplet')
}
const sourceSections = Object.fromEntries(Object.entries(Object.groupBy(manifest.sourcePages, page => page.section)).map(([section, pages]) => [section, {
  pages: pages.length,
  bytes: pages.reduce((sum, page) => sum + page.byteLength, 0),
  extractedEntries: pages.reduce((sum, page) => sum + page.entryCount, 0),
}]))
const audit = {
  schemaVersion: 1,
  generatedAt: manifest.generatedAt,
  resourceId: manifest.resourceId,
  provider: manifest.provider,
  authorization: manifest.authorization,
  format: manifest.format,
  counts: manifest.counts,
  corpus: manifest.corpus,
  sourceRoots: manifest.sourceRoots,
  sourceSections,
  sourcePageInventorySha256: sha256(JSON.stringify(manifest.sourcePages)),
  sourceGaps: manifest.sourceGaps,
}
await writeFile(output, `${JSON.stringify(audit, null, 2)}\n`)
process.stdout.write(`Audit Bible Annotée publié : ${output}\n`)
