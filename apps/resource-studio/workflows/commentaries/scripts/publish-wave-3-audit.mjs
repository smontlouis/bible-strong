#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const prototypeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const input = path.resolve(process.argv[2] ?? path.join(prototypeRoot, '.local/wave-3-export/manifest.json'))
const output = path.resolve(process.argv[3] ?? path.join(prototypeRoot, 'data/audit/wave-3.json'))
const manifest = JSON.parse(await readFile(input, 'utf8'))
if (manifest.wave !== 3 || manifest.authorization?.status !== 'confirmed-by-project-owner' || Object.keys(manifest.resources ?? {}).length !== 17) {
  throw new Error('Le manifeste vague 3 est incomplet')
}
const resources = Object.fromEntries(Object.entries(manifest.resources).map(([id, resource]) => {
  const compact = { ...resource }
  delete compact.sourcePages
  return [id, compact]
}))
await writeFile(output, `${JSON.stringify({ ...manifest, resources }, null, 2)}\n`)
process.stdout.write(`Audit vague 3 publié : ${output}\n`)
