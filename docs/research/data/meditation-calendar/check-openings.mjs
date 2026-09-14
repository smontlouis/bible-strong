import { readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { createBibleReferenceParser } from '../../../../packages/bible-reference-parser/src/referenceParser.js'

const sourceDirectory = process.argv[2]
if (!sourceDirectory) throw new Error('Usage: node check-openings.mjs <downloaded-source-directory>')
const parsers = { fr: createBibleReferenceParser('fr'), en: createBibleReferenceParser('en') }
const results = []
for (const name of (await readdir(sourceDirectory)).filter(name => name.endsWith('.json')).sort()) {
  const raw = await readFile(join(sourceDirectory, name), 'utf8')
  const collection = JSON.parse(raw)
  if (collection.id.startsWith('bible-project-plan')) continue
  const result = { id: collection.id, sourceSha256: createHash('sha256').update(raw).digest('hex'), entries: 0, oneOpeningFirst: 0, publisherLocators: {}, singleTrailingReference: 0, otherReferenceShapes: [], noRecognizedReference: [] }
  for (const section of collection.sections) {
    for (const entry of section.readingSlices) {
      result.entries++
      const openings = entry.slices.filter(block => block.type === 'Text' && block.subType === 'devotional')
      if (openings.length !== 1 || openings[0] !== entry.slices[0]) continue
      result.oneOpeningFirst++
      const lines = openings[0].description.trim().split(/\r?\n/)
      const citations = lines.filter(line => /^(?:AD|CTr|CC|AG|LVH|PG|FLB|VRP)\s+\d+\.\d+\s*$/.test(line.trim()))
      for (const citation of citations) {
        const prefix = citation.trim().split(/\s+/)[0]
        result.publisherLocators[prefix] = (result.publisherLocators[prefix] ?? 0) + 1
      }
      const text = lines.filter(line => !citations.includes(line)).join('\n').trim()
      const references = parsers[collection.lang].parse(text).osis_and_indices()
      if (references.length === 1 && references[0].indices[0] > 0 && /^[\s.)\]}]*$/.test(text.slice(references[0].indices[1]))) result.singleTrailingReference++
      else if (!references.length) result.noRecognizedReference.push(entry.id)
      else result.otherReferenceShapes.push(entry.id)
    }
  }
  results.push(result)
}
const audit = { auditedAt: new Date().toISOString(), scope: 'Opening-block roles, known publisher locator lines and raw reference-parser shapes. Not editorial calendar validation. Multi-reference and unrecognized forms retain their full original text in the application.', collections: results }
await writeFile(new URL('./opening-audit.json', import.meta.url), JSON.stringify(audit, null, 2) + '\n')
for (const result of results) console.log(`${result.id}: ${result.entries} entries; ${result.oneOpeningFirst} opening blocks; ${result.singleTrailingReference} single trailing references; ${result.otherReferenceShapes.length} other shapes; ${result.noRecognizedReference.length} unrecognized references`)
