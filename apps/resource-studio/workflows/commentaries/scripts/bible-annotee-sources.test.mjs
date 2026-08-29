import assert from 'node:assert/strict'
import test from 'node:test'
import {
  extractNewTestamentPageLinks,
  normalizeTheotexMarkup,
  parseNewTestamentCommentary,
  parseNewTestamentIntroduction,
  parseOldTestamentCommentary,
} from './bible-annotee-sources.mjs'

test('parse les introductions et notes verset par verset de l’Ancien Testament', () => {
  const html = `<tr><td><div class="num"></div></td><td><div class="def"><p><font class="mul">Introduction</font></p></div></td></tr>
    <tr><td><div class = "num">1</div></td><td><div class = "def"><p>Note <font class="ref">Jean 1.1</font>.</p></div></td></tr>`
  const entries = parseOldTestamentCommentary({ html, book: 1, chapter: 1, sourceUrl: 'https://example.test/gen1_c.html' })
  assert.deepEqual(entries.map(entry => entry.passage), ['1-1-0', '1-1-1'])
  assert.equal(entries[0].editorialKind, 'chapter-introduction')
  assert.match(entries[1].translation.html, /<span class="ref">Jean 1.1<\/span>/)
})

test('extrait et trie les pages du plan du Nouveau Testament', () => {
  const links = extractNewTestamentPageLinks({
    html: '<a href="Matthieu_nta_10.html"></a><a href="Matthieu_nta_2.html"></a><a href="Matthieu_nta_2.html"></a>',
    slug: 'Matthieu',
  })
  assert.deepEqual(links, ['Matthieu_nta_2.html', 'Matthieu_nta_10.html'])
})

test('associe une note NT au verset qui la précède', () => {
  const html = `<tr><td class="nm"><font class="cp">3</font><font class="vs">.1</font></td><td class="tr">Texte</td></tr>
    <tr><td class="nm">&nbsp;</td><td class="nt"><p>Première note.</p></td></tr>
    <tr><td class="nm"><font class="cp">3</font><font class="vs">.2</font></td><td class="tr">Texte</td></tr>
    <tr><td class="nm">&nbsp;</td><td class="nt">Seconde <em>note</em>.</td></tr>`
  const entries = parseNewTestamentCommentary({ html, book: 40, sourceUrl: 'https://example.test/matthieu.html' })
  assert.deepEqual(entries.map(entry => entry.passage), ['40-3-1', '40-3-2'])
  assert.equal(entries[1].translation.html, 'Seconde <em>note</em>.')
})

test('conserve une introduction NT sous le passage livre 0.0', () => {
  const entries = parseNewTestamentIntroduction({
    html: '<table class="intro"><tr><td><h1>Introduction</h1><p>Contenu.</p></td></tr></table>',
    book: 40,
    sourceUrl: 'https://example.test/intro.html',
  })
  assert.equal(entries[0].passage, '40-0-0')
  assert.equal(entries[0].editorialKind, 'book-introduction')
})

test('supprime les éléments actifs du HTML source', () => {
  assert.equal(normalizeTheotexMarkup('<p>Bon<script>alert(1)</script><iframe>non</iframe></p>'), '<p>Bonnon</p>')
})

test('répare le paragraphe ouvrant omis dans certaines notes NT historiques', () => {
  assert.equal(normalizeTheotexMarkup('Chapitre 3.</p><p>Suite.</p>'), '<p>Chapitre 3.</p><p>Suite.</p>')
  assert.equal(normalizeTheotexMarkup('</p><font class="bib">Titre</font></p><p>Suite.</p>'), '<p><strong>Titre</strong></p><p>Suite.</p>')
})
