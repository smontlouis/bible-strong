import assert from 'node:assert/strict'
import test from 'node:test'

import { ORDINARY_BIBLE_VERSION_IDS } from '@bible-strong/resource-catalog/ordinary-bibles'
import type { BibleChapterDto } from '@bible-strong/resource-domain/contracts/bibleChapterContract'
import { readVerses } from './layout'
import {
  findReferences,
  formatPassage,
  formatPassages,
  parsePassages,
  parseVerseKey,
  passageOsis,
  verseKey,
} from './reference'
import { BIBLE_VERSIONS, findVersion, versionDirection } from './versions'

test('a reference is read as people write it, in French or in English', () => {
  assert.deepEqual(parsePassages('Jean 3:16-18', 'fr'), [
    { book: 43, chapter: 3, startVerse: 16, endVerse: 18, wholeChapter: false },
  ])
  assert.deepEqual(parsePassages('John 3:16', 'en'), [
    { book: 43, chapter: 3, startVerse: 16, endVerse: 16, wholeChapter: false },
  ])
  // A name of the other language is read too: the model does not always say which it is.
  assert.equal(parsePassages('John 3:16', 'fr')[0]?.book, 43)
  assert.equal(parsePassages('Jean 3:16', 'en')[0]?.book, 43)
  assert.deepEqual(parsePassages('n’importe quoi', 'fr'), [])
  assert.deepEqual(parsePassages('Jean 99:1', 'fr'), [])
})

test('a chapter is read whole, and a range across chapters one chapter at a time', () => {
  const [psalm] = parsePassages('Ps 23', 'fr')
  assert.deepEqual(psalm, { book: 19, chapter: 23, startVerse: 1, endVerse: 6, wholeChapter: true })

  const across = parsePassages('Genèse 1:31-2:3', 'fr')
  assert.deepEqual(across, [
    { book: 1, chapter: 1, startVerse: 31, endVerse: 31, wholeChapter: false },
    { book: 1, chapter: 2, startVerse: 1, endVerse: 3, wholeChapter: false },
  ])
})

test('a reference returned by a tool is read back', () => {
  for (const passage of [
    ...parsePassages('Jean 3:16-18', 'fr'),
    ...parsePassages('1 Cor 13', 'fr'),
    ...parsePassages('Tobie 1:1', 'fr'),
  ]) {
    assert.deepEqual(parsePassages(passageOsis(passage), 'en'), [passage], passageOsis(passage))
  }
  // The short range the resources link, with the book named once.
  assert.deepEqual(parsePassages('John.3.16-18', 'fr'), parsePassages('Jean 3:16-18', 'fr'))
  assert.deepEqual(parsePassages('Rev.1.8,Rev.1.11', 'fr').map(passageOsis), ['Rev.1.8', 'Rev.1.11'])
})

test('a reference is printed as a page prints it', () => {
  const passages = parsePassages('Jean 3:16-18', 'fr')
  assert.equal(formatPassage(passages[0]!, 'fr'), 'Jean 3:16-18')
  assert.equal(formatPassage(passages[0]!, 'en'), 'John 3:16-18')
  assert.equal(formatPassage(parsePassages('Ps 23', 'fr')[0]!, 'fr'), 'Psaumes 23')
  assert.equal(
    formatPassages(parsePassages('Jean 3:16; Romains 8:28', 'fr'), 'fr'),
    'Jean 3:16 ; Romains 8:28'
  )
})

const written = (text: string, language: 'fr' | 'en') =>
  findReferences(text, language).map(({ start, end, osis }) => [text.slice(start, end), osis])

test('the passages a sentence writes are found, however a resource spells them', () => {
  assert.deepEqual(written('Voir Ge 14:18-20 ; Hé 7:1 et 1 Co 13.4, puis Jean 3.', 'fr'), [
    ['Ge 14:18-20', 'Gen.14.18-Gen.14.20'],
    ['Hé 7:1', 'Heb.7.1'],
    ['1 Co 13.4', '1Cor.13.4'],
    ['Jean 3', 'John.3'],
  ])
  // The spelling resources keep for machines, and a book named in the other language.
  assert.deepEqual(written('roi de Salem (Gen.14.18), voir Jhn.1:1 et 1Ki.18', 'fr'), [
    ['Gen.14.18', 'Gen.14.18'],
    ['Jhn.1:1', 'John.1.1'],
    ['1Ki.18', '1Kgs.18'],
  ])
  assert.deepEqual(written('See Gen 14:18-20; Psalm 110:4 and I Jhn.1:10.', 'en'), [
    ['Gen 14:18-20', 'Gen.14.18-Gen.14.20'],
    ['Psalm 110:4', 'Ps.110.4'],
    ['I Jhn.1:10', '1John.1.10'],
  ])
})

test('a number alone goes on from the reference before it, and is named in full', () => {
  assert.deepEqual(findReferences('(Heb.5.6,10 ; 6.20)', 'fr'), [
    { start: 1, end: 8, osis: 'Heb.5.6', label: 'Heb.5.6' },
    { start: 9, end: 11, osis: 'Heb.5.10', label: 'Hébreux 5:10' },
    { start: 14, end: 18, osis: 'Heb.6.20', label: 'Hébreux 6:20' },
  ])
})

test('what reads as a reference by chance is left as text', () => {
  for (const text of [
    'Il est 5 heures, la 3 est bonne et il a job 3 fois.',
    'La 3 est la bonne. Le verset 12 est le diamant du chapitre.',
    'Le no 5, ou No 5, puis est 5.3 fois.',
    'à propos de juges (Psa.81(82):6)',
    'Aucun chiffre ici, même avec Jean et Marc.',
  ]) {
    assert.deepEqual(written(text, 'fr'), [], text)
  }
  assert.deepEqual(written('he is 3 years old; so 2 of them; Is 5 the answer?', 'en'), [])
  // The word after a verse is not the half of it.
  assert.deepEqual(written('Le Samuel de 1 Chroniques 6:33 a vécu avant.', 'fr'), [
    ['1 Chroniques 6:33', '1Chr.6.33'],
  ])
})

test('a passage longer than one reading opens at its first chapter', () => {
  assert.deepEqual(written('les lois du tabernacle (Exode 20-31)', 'fr'), [['Exode 20-31', 'Exod.20']])
  assert.deepEqual(written('la chute (Ésaïe 13-14)', 'fr'), [['Ésaïe 13-14', 'Isa.13,Isa.14']])
})

test('a verse is named to the Resource API by three numbers', () => {
  assert.equal(verseKey({ book: 43, chapter: 3, verse: 16 }), '43-3-16')
  assert.deepEqual(parseVerseKey('43-3-16'), { book: 43, chapter: 3, verse: 16 })
  assert.equal(parseVerseKey('0-3-4'), undefined)
  assert.equal(parseVerseKey('God.'), undefined)
})

test('the versions named here are the ones the catalog publishes', () => {
  assert.deepEqual(BIBLE_VERSIONS.map(version => version.id).sort(), [...ORDINARY_BIBLE_VERSION_IDS].sort())
  assert.equal(findVersion('lxx-fr')?.id, 'LXX_FR')
  assert.equal(findVersion(' lsg ')?.id, 'LSG')
  assert.equal(findVersion('XYZ'), undefined)
  assert.equal(versionDirection(findVersion('BHG')!, 1), 'rtl')
  assert.equal(versionDirection(findVersion('BHG')!, 43), 'ltr')
})

type Verse = BibleChapterDto['verses'][number]

const verse = (number: number, text: string, presentation: Partial<Verse['presentation']> = {}) =>
  ({
    number,
    text,
    presentation: { startTags: [], layout: [], notes: [], headings: [], ...presentation },
  }) as Verse

test('the words of Jesus are cut where they start and end, across verses', () => {
  const verses = readVerses(
    [
      verse(3, 'Jésus répondit : En vérité', {
        layout: [{ offset: 17, order: 0, type: 'open', tag: 'wj' }],
      }),
      verse(4, 'je te le dis. Nicodème dit', {
        layout: [{ offset: 13, order: 0, type: 'close', tag: 'wj' }],
      }),
    ],
    { headings: false }
  )
  assert.deepEqual(verses[0]?.parts, [{ text: 'Jésus répondit : ' }, { text: 'En vérité', wj: true }])
  assert.deepEqual(verses[1]?.parts, [{ text: 'je te le dis.', wj: true }, { text: ' Nicodème dit' }])
})

test('words begun before the first verse read are still the words of Jesus', () => {
  const [only] = readVerses([verse(16, 'Car Dieu a tant aimé', { startTags: [{ tag: 'wj' }] })], {
    headings: false,
  })
  assert.deepEqual(only?.parts, [{ text: 'Car Dieu a tant aimé', wj: true }])
})

test('a version that marks no paragraph is read one verse a line', () => {
  const plain = readVerses([verse(1, 'Un'), verse(2, 'Deux')], { headings: false })
  assert.deepEqual(
    plain.map(item => item.paragraph),
    [true, true]
  )

  const marked = readVerses(
    [
      verse(1, 'Un', { layout: [{ offset: 0, order: 0, type: 'open', tag: 'p' }] }),
      verse(2, 'Deux'),
      verse(3, 'Trois', { layout: [{ offset: 0, order: 0, type: 'open', tag: 'p' }] }),
    ],
    { headings: false }
  )
  assert.deepEqual(
    marked.map(item => item.paragraph),
    [true, undefined, true]
  )
})

test('section titles are read with a chapter, and left out of a quoted passage', () => {
  const titled = verse(1, 'Au commencement', {
    headings: [{ offset: 0, order: 0, kind: 'pericope', type: 'section', text: 'La création', markup: '' }],
  })
  assert.equal(readVerses([titled], { headings: true })[0]?.heading, 'La création')
  assert.equal(readVerses([titled], { headings: false })[0]?.heading, undefined)
})
