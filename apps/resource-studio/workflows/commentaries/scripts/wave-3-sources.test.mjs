import assert from 'node:assert/strict'
import test from 'node:test'
import { MHM_CHAPTERS, parseMhmChapter } from './wave-3-sources.mjs'

test('inventorie les 1 189 chapitres du canon protestant pour MHM', () => {
  assert.equal(MHM_CHAPTERS.length, 1189)
  assert.deepEqual(MHM_CHAPTERS[0], { book: 1, chapter: 1, osisReference: 'Gen.1' })
  assert.deepEqual(MHM_CHAPTERS.at(-1), { book: 66, chapter: 22, osisReference: 'Rev.22' })
})

test('extrait les unités verset par verset du HTML STEP MHM', () => {
  const value = `<div><span class='verse ltrDirection'><strong>Genesis 1:1-2</strong><p></p><strong>v. 1</strong>: Première note.</span>
    <span class='verse ltrDirection'><strong>v. 2-4</strong>: Seconde <em>note</em>.</span></div>`
  const entries = parseMhmChapter({ value, book: 1, chapter: 1, sourceUrl: 'https://example.test/Gen.1' })
  assert.deepEqual(entries.map(entry => entry.passage), ['1-1-1', '1-1-2'])
  assert.match(entries[0].source.html, /Première note/)
  assert.equal(entries[1].translation, null)
})
