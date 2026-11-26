/**
 * Applies config/strong-transliteration-corrections.json to the Strong lexicon source database
 * (StepEntries.classicTransliteration), before the Strong lexicon publications are rebuilt.
 *
 * The source database is not tracked by Git and nothing in this repository regenerates it, so the
 * corrections are kept here and applied by id. A row whose current value is neither the recorded
 * "from" nor the "to" is reported and left untouched.
 *
 * Usage: tsx src/applyStrongTransliterationCorrections.ts [--database <path>] [--dry-run]
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

interface Correction {
  id: number
  eStrong: string
  dStrong: string
  from: string
  to: string
}

const args = process.argv.slice(2)
const option = (name: string) => {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}
const databasePath = resolve(
  option('--database') ?? 'data/dictionaries/strong_lexicon.en-fr.full.production.sqlite'
)
const dryRun = args.includes('--dry-run')
const { corrections } = JSON.parse(
  readFileSync(resolve('config/strong-transliteration-corrections.json'), 'utf8')
) as { corrections: Correction[] }

const database = new DatabaseSync(databasePath)
const read = database.prepare('SELECT classicTransliteration AS value FROM StepEntries WHERE id = ?')
const write = database.prepare('UPDATE StepEntries SET classicTransliteration = ? WHERE id = ?')

let applied = 0
let already = 0
const conflicts: string[] = []
database.exec('BEGIN')
for (const correction of corrections) {
  const row = read.get(correction.id) as { value: string } | undefined
  if (row?.value === correction.to) {
    already += 1
  } else if (row?.value === correction.from) {
    if (!dryRun) write.run(correction.to, correction.id)
    applied += 1
  } else {
    conflicts.push(`${correction.id} ${correction.dStrong}: found ${JSON.stringify(row?.value)}`)
  }
}
database.exec(dryRun ? 'ROLLBACK' : 'COMMIT')
database.close()

console.log(
  `${dryRun ? 'Would apply' : 'Applied'} ${applied}, already correct ${already}, conflicts ${conflicts.length} (${databasePath})`
)
for (const conflict of conflicts) console.log(`  conflict ${conflict}`)
if (conflicts.length) process.exitCode = 1
