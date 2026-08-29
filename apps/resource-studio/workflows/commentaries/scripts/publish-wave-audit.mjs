#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const prototypeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const input = path.resolve(process.argv[2] ?? path.join(prototypeRoot, '.local/wave-export/manifest.json'))
const output = path.resolve(process.argv[3] ?? path.join(prototypeRoot, 'data/audit/waves-1-2.json'))
const manifest = JSON.parse(await readFile(input, 'utf8'))

if (manifest.schemaVersion !== 1 || Object.keys(manifest.resources ?? {}).length !== 8) {
  throw new Error('Le manifeste des vagues 1 et 2 est incomplet')
}

await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`)
process.stdout.write(`Audit compact publié : ${output}\n`)
