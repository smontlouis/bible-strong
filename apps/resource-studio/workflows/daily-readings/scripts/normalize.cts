// Runs the application's own projection of a meditation book (dates, audited corrections, added
// days) over the Firestore export, so that a book file dates each day as the app does.
// CommonJS like the app's code under tsx. Run from apps/expo, whose tsconfig resolves the app's imports: yarn resources:daily-readings:normalize
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { normalizeMeditationCollection } from '../../../../expo/src/features/plans/readingCalendar'
const here = join(__dirname, '../../../outputs/daily-readings/')
const books = JSON.parse(readFileSync(here + 'books.json', 'utf8'))
const out: Record<string, unknown> = {}
for (const [id, doc] of Object.entries<any>(books)) {
  const sections = JSON.parse(readFileSync(`${here}raw/${id}.json`, 'utf8'))
  const plan = { ...doc, id, sections }
  const normalized = normalizeMeditationCollection(plan as any)
  const readings = normalized.sections.flatMap((s: any) => s.readingSlices.map((r: any) => ({ ...r, section: s.title })))
  out[id] = { lang: doc.lang, title: doc.title, readings }
  const dated = readings.filter((r: any) => r.calendarDate)
  console.log(id, readings.length, 'dated', dated.length, 'unique', new Set(dated.map((r: any) => r.calendarDate)).size)
}
writeFileSync(here + 'normalized.json', JSON.stringify(out))
