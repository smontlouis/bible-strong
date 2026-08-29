import assert from 'node:assert/strict'
import test from 'node:test'
import {
  mergeEgwLayers,
  normalizeEgwMarkup,
  parseCommentaryPage,
  parseCommentaryToc,
  parseScriptureIndexPage,
  parseScriptureIndexToc,
} from './egw-sources.mjs'

test('parse la table des matières biblique d’un volume BC', () => {
  const pages = parseCommentaryToc({
    html: '<a href="/read/90.8" class="book-toc__link js-toc_e">Genesis</a><a href="/read/90.9" class="book-toc__link">Chapter 1</a>',
    bookId: 90,
    code: '1BC',
  })
  assert.deepEqual(pages, [{ bookId: 90, code: '1BC', pageId: '90.9', bookName: 'Genesis', chapter: 1 }])
})

test('parse la table des matières ECSI', () => {
  const pages = parseScriptureIndexToc('<a href="/read/14275.2" class="book-toc__link js-toc_e">Genesis</a><a href="/read/14275.3" class="book-toc__link">Genesis 1</a>')
  assert.deepEqual(pages, [{ bookId: 14275, code: 'ECSI', pageId: '14275.3', bookName: 'Genesis', chapter: 1 }])
})

test('extrait le commentaire EGW et ses sources originales', () => {
  const html = '<p class="para standard-indented" id="90.10"><span><strong><span class="egwlink egwlink_bible" title="Genesis 1:1" data-link="x">1-3</span>. Création</strong>—Texte (<span class="egwlink egwlink_book" title="Lt 131, 1897" data-link="14062.5131001">Letter 131</span>).</span><span class="refCode">1BC 1081.2</span></p>'
  const [entry] = parseCommentaryPage({ html, page: { code: '1BC', bookName: 'Genesis', chapter: 1 } })
  assert.equal(entry.passage, '1-1-1')
  assert.equal(entry.source.html.includes('class="ref"'), true)
  assert.equal(entry.source.html.includes('1BC 1081.2'), false)
  assert.deepEqual(entry.originalSources[0], { label: 'Lt 131, 1897', paragraphId: '14062.5131001', url: 'https://text.egwwritings.org/read/14062.5131001' })
})

test('extrait les associations ECSI et conserve les plages de versets', () => {
  const html = '<p id="14275.14" class="h4">6-9</p><p class="para standard-noindent" id="14275.15"><span><span class="egwlink egwlink_book" title="PP 44" data-link="84.3635">PP 44</span>; <span class="egwlink egwlink_book" title="PP 44" data-link="84.3635">PP 44</span></span></p>'
  const [entry] = parseScriptureIndexPage({ html, page: { pageId: '14275.3', bookName: 'Genesis', chapter: 1 } })
  assert.equal(entry.passage, '1-1-6')
  assert.equal(entry.passageEndVerse, 9)
  assert.equal(entry.citations.length, 1)
})

test('fusionne les deux couches sans confondre index et commentaire', () => {
  const merged = mergeEgwLayers({ commentary: [{ passage: '1-1-1', id: 'c' }], scriptureIndex: [{ passage: '1-1-1', id: 'i' }] })
  assert.equal(merged[0].curatedCommentary[0].id, 'c')
  assert.equal(merged[0].scriptureIndex[0].id, 'i')
})

test('supprime le contenu actif du HTML EGW', () => {
  assert.equal(normalizeEgwMarkup('<span>Bon<script>alert(1)</script><iframe>non</iframe></span>'), '<span>Bon</span>')
})
