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
for (const marker of [
  '/__study-world/',
  'diagnostic-filters',
  'zone-editor',
  'world-state',
  'bible-strong-game-lab',
  'bible-strong-question-review-v1',
  'bible-strong-who-review-v1',
  'who-person-109',
  'catalogue_questions',
  'catalogue_history',
]) {
  assert(!scripts.includes(marker), `Development capability leaked into production: ${marker}`)
}
assert(
  !(await readdir(new URL('../dist/', import.meta.url))).includes('game-lab.html'),
  'Game Lab page in production'
)
assert(
  !(await readdir(new URL('../dist/', import.meta.url))).includes('question-lab.html'),
  'Question review page in production'
)
console.log('Production artifact: no editor chunks, save URLs or diagnostic controls')

assert(
  !(await readdir(new URL('../dist/', import.meta.url))).includes('who-lab.html'),
  'Who review page in production'
)
