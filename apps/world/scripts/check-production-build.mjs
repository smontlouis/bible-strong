import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'

const directory = new URL('../dist/assets/', import.meta.url)
const names = await readdir(directory)
assert(
  names.some(name => name.endsWith('.js')),
  'Build World before checking production'
)
assert(
  !names.some(name => /ZoneEditor|WorldEditor|ShoreEditor/.test(name)),
  'Editor chunk in production'
)
const scripts = (
  await Promise.all(
    names
      .filter(name => name.endsWith('.js'))
      .map(name => readFile(new URL(name, directory), 'utf8'))
  )
).join('\n')
for (const marker of ['/__study-world/', 'diagnostic-filters', 'zone-editor', 'world-state']) {
  assert(!scripts.includes(marker), `Development capability leaked into production: ${marker}`)
}
console.log('Production artifact: no editor chunks, save URLs or diagnostic controls')
