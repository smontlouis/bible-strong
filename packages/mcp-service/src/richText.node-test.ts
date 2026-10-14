import assert from 'node:assert/strict'
import test from 'node:test'

import { articleSlug, createSiteLinks, strongCodeSlug } from './links'
import { findReferences } from './bible/reference'
import {
  blocksToText,
  editorialLinks,
  htmlToBlocks,
  htmlToText,
  truncateText,
  withReferences,
} from './richText'
import { displayedStrongCode, parseStrongCode, sameStrongCode } from './strong/codes'

test('editorial HTML is read into the few blocks a card draws', () => {
  assert.deepEqual(htmlToBlocks('<p>Un <b>mot</b> et <i>un autre</i>.</p><h3>Titre</h3>'), [
    {
      t: 'p',
      c: [
        { t: 'text', text: 'Un ' },
        { t: 'text', text: 'mot', b: true },
        { t: 'text', text: ' et ' },
        { t: 'text', text: 'un autre', i: true },
        { t: 'text', text: '.' },
      ],
    },
    { t: 'h', c: [{ t: 'text', text: 'Titre' }] },
  ])
})

test('a tag it does not know loses its tag and keeps its text; a script loses both', () => {
  assert.equal(htmlToText('<marquee>Bonjour</marquee><script>alert(1)</script> le monde'), 'Bonjour le monde')
  assert.equal(htmlToText('<p onclick="x()">Caf&eacute; &amp; th&#233;</p>'), 'Café & thé')
})

test('a link survives only when it names a passage, an entry or an article', () => {
  const [paragraph] = htmlToBlocks(
    '<p>Voir <a href="bible://Exod.4.14-Exod.4.16">Exode 4.14-16</a>, ' +
      '<a href="strong://H0175">Aaron</a>, <a class="word" href="Lévi" data-entry-id="12">Lévi</a> ' +
      'et <a href="https://example.com">ailleurs</a>.</p>',
    editorialLinks('bost')
  )
  assert.deepEqual(paragraph, {
    t: 'p',
    c: [
      { t: 'text', text: 'Voir ' },
      { t: 'ref', osis: 'Exod.4.14-Exod.4.16', text: 'Exode 4.14-16' },
      { t: 'text', text: ', ' },
      { t: 'strong', code: 'H0175', text: 'Aaron' },
      { t: 'text', text: ', ' },
      { t: 'entry', work: 'bost', id: 12, text: 'Lévi' },
      { t: 'text', text: ' et ailleurs.' },
    ],
  })
  // A book nobody reads is no passage.
  assert.equal(blocksToText(htmlToBlocks('<a href="bible://Foo.1.1">x</a>', editorialLinks())), 'x')
})

test('a passage written in a text becomes a link, and the text reads as before', () => {
  const read = (html: string) =>
    withReferences(htmlToBlocks(html, editorialLinks()), text => findReferences(text, 'fr'))
  const blocks = read(
    '<p>Roi de <b>Salem (Gen.14.18)</b>, voir <a href="bible://Heb.7.1">Hé 7:1</a>, 3.</p>' +
      '<ul><li>Ps 110:4<sup>12</sup></li></ul>'
  )
  assert.deepEqual(blocks, [
    {
      t: 'p',
      c: [
        { t: 'text', text: 'Roi de ' },
        { t: 'text', text: 'Salem (', b: true },
        { t: 'ref', text: 'Gen.14.18', osis: 'Gen.14.18' },
        { t: 'text', text: ')', b: true },
        { t: 'text', text: ', voir ' },
        // A link the resource bears is kept as it is.
        { t: 'ref', osis: 'Heb.7.1', text: 'Hé 7:1' },
        { t: 'text', text: ', 3.' },
      ],
    },
    {
      t: 'list',
      items: [
        [
          {
            t: 'p',
            c: [
              { t: 'ref', text: 'Ps 110:4', osis: 'Ps.110.4' },
              // A raised number is a note mark, never a verse.
              { t: 'text', text: '12', sup: true },
            ],
          },
        ],
      ],
    },
  ])
  assert.equal(blocksToText(blocks), 'Roi de Salem (Gen.14.18), voir Hé 7:1, 3.\n\n- Ps 110:412')
})

test('lists are read nested, closed or not', () => {
  const closed = htmlToBlocks('<ul><li>Un<ul><li>Un a</li></ul></li><li>Deux</li></ul>')
  const open = htmlToBlocks('<ul><li>Un<ul><li>Un a</ul><li>Deux</ul>')
  assert.deepEqual(open, closed)
  assert.equal(blocksToText(closed), '- Un\n  - Un a\n\n- Deux')
  // An entry outside any list is a paragraph like another.
  assert.equal(htmlToText('<li>Seul</li><p>Suite</p>'), 'Seul\n\nSuite')
})

test('line breaks open and close nothing', () => {
  assert.equal(htmlToText('<p><br>Un<br><br>Deux<br></p>'), 'Un\nDeux')
})

test('a long text is cut at the end of a word, and says so', () => {
  assert.equal(truncateText('un deux trois quatre', 12), 'un deux…')
  assert.equal(truncateText('court', 12), 'court')
})

test('a Strong number is read however it is written', () => {
  assert.deepEqual(parseStrongCode('g26'), { code: 'G0026', label: 'G26', lexicon: 'greek' })
  assert.deepEqual(parseStrongCode('H0430G'), { code: 'H0430G', label: 'H430', lexicon: 'hebrew' })
  assert.equal(parseStrongCode("Strong's H 430")?.code, 'H0430')
  assert.equal(parseStrongCode('26'), undefined)
  assert.equal(parseStrongCode('amour'), undefined)
  assert.equal(sameStrongCode('G26', 'G0026'), true)
  // The case of a suffix names a sense.
  assert.equal(sameStrongCode('H1254a', 'H1254A'), false)
})

test('a tagged word opens the most precise entry of its first family', () => {
  assert.equal(
    displayedStrongCode([
      { kind: 'strong', code: 'H0430' },
      { kind: 'dstrong', code: 'H0430G' },
      { kind: 'ustrong', code: 'H3068G' },
    ])?.code,
    'H0430G'
  )
  assert.equal(displayedStrongCode([{ kind: 'strong', code: 'G3779' }])?.label, 'G3779')
  assert.equal(displayedStrongCode([]), undefined)
})

test('each result links to the page of the site that holds it', () => {
  const links = createSiteLinks('https://bible-strong.app/')
  const passage = { book: 43, chapter: 3, startVerse: 16, endVerse: 18, wholeChapter: false }
  assert.equal(links.passage('LSG', passage), 'https://bible-strong.app/bible/lsg/john/3/16-18')
  assert.equal(links.passage('LXX_FR', { ...passage, wholeChapter: true }), 'https://bible-strong.app/bible/lxx-fr/john/3')
  assert.equal(links.verse('en', 43, 3, 16), 'https://bible-strong.app/bible/kjv/john/3/16')
  assert.equal(links.interlinear('fr', 43, 3, 16), 'https://bible-strong.app/bible/bhg/interlinear/fr/john/3/16')
  assert.equal(links.strong('fr', 'G26'), 'https://bible-strong.app/strong/fr/g0026')
  assert.equal(links.strong('en', 'H0430G'), 'https://bible-strong.app/strong/en/h0430G')
  assert.equal(links.concordance('fr', 'G0026'), 'https://bible-strong.app/strong/fr/g0026/concordance')
  assert.equal(
    links.dictionaryEntry('fr', 'bost', 1199, 'Jokébed'),
    'https://bible-strong.app/dictionary/fr/bost/1199/jokebed'
  )
  assert.equal(links.naveTopic('en', 'jesus, the christ'), 'https://bible-strong.app/nave/en/jesus%2C%20the%20christ')
  assert.equal(
    links.commentarySection('fr', 'mhy-fr', 43, 3, '16-21'),
    'https://bible-strong.app/commentary/fr/mhy-fr/john/3/16-21'
  )
  assert.equal(links.timelineEvent('fr', 'conversion-of-paul'), 'https://bible-strong.app/timeline/fr/conversion-of-paul')
  assert.equal(links.timelineEvent('fr', 'Not A Slug'), undefined)
  assert.equal(strongCodeSlug('nope'), undefined)
  assert.equal(articleSlug('«  »'), 'article')
})
