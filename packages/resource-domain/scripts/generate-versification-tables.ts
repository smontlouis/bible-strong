// Compiles the `.vrs` tables of src/versification into the JSON the versification module reads,
// so that the app bundles plain data and parses nothing at run time.
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { readVersificationSources } from '../src/versification/versificationSources'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/versification')
const output = path.join(root, 'tables.json')

const tables = await readVersificationSources(file => readFile(path.join(root, file), 'utf8'))
await writeFile(output, `${JSON.stringify(tables)}\n`)
console.log(`Wrote ${path.relative(process.cwd(), output)}`)
