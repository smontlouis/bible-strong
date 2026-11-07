import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  commentaryPassages,
  dictionaryPassages,
  dictionaryWorkFromIdentity,
  entityPassages,
  passageReference,
  timelinePassages,
} from '../libraryDocuments'
import { libraryEmbeddingQuery, makeLibraryEmbeddingProvider } from '../libraryEmbedding'
import { parseLibrarySearchInput } from '../librarySearchInput'
import { LIBRARY_PASSAGE_MAX_CHARACTERS, htmlToPlainText, splitIntoPassages } from '../libraryText'

describe('library text', () => {
  it('turns published HTML into readable text', () => {
    assert.equal(
      htmlToPlainText(
        '<p><a class="word" href="Hébreu">H&#xE9;breu</a> <em>berith</em>&nbsp;: pacte.</p><p>Voir&#160;aussi<br>Testament &amp; loi.</p>'
      ),
      'Hébreu berith : pacte.\n\nVoir aussi\nTestament & loi.'
    )
    assert.equal(
      htmlToPlainText('<strong>1.</strong> Though Paul &laquo;has&raquo; proved'),
      '1. Though Paul «has» proved'
    )
    assert.equal(htmlToPlainText('<script>alert(1)</script>Texte &unknown;'), 'Texte &unknown;')
    // Henry (CLÉ) encodes twice; Clarke writes Greek with named entities.
    assert.equal(
      htmlToPlainText('Dieu dit&amp;nbsp;: &#xAB;&amp;nbsp;Que la lumi&#xE8;re'),
      'Dieu dit : « Que la lumière'
    )
    assert.equal(
      htmlToPlainText('&Pi;&epsilon;&rho;&iota; &sigma;&omega;&sigmaf; &Omega; &oacute;&Ntilde;'),
      'Περι σως Ω óÑ'
    )
  })

  it('cuts long text at paragraphs, then sentences, never above the maximum', () => {
    const paragraph = (n: number) => `${'Phrase longue qui développe une idée. '.repeat(n)}`.trim()
    const passages = splitIntoPassages([paragraph(30), paragraph(5), paragraph(90)].join('\n'))
    assert.equal(passages.length, 3)
    for (const passage of passages)
      assert.ok(passage.length <= LIBRARY_PASSAGE_MAX_CHARACTERS, String(passage.length))
    assert.equal(
      passages.join(' ').replace(/\s+/g, ' ').length,
      [paragraph(30), paragraph(5), paragraph(90)].join(' ').length
    )
    assert.deepEqual(splitIntoPassages('Court.'), ['Court.'])
    assert.deepEqual(splitIntoPassages(''), [])
    const word = 'x'.repeat(5000)
    assert.ok(
      splitIntoPassages(word).every(passage => passage.length <= LIBRARY_PASSAGE_MAX_CHARACTERS)
    )
  })

  it('joins a short last piece to the previous passage', () => {
    const long = 'a'.repeat(1500)
    assert.deepEqual(splitIntoPassages(`${long}\nFin.`), [`${long}\nFin.`])
  })
})

describe('library passages', () => {
  it('attributes a commentary passage to its work and tradition and keeps what opens it', () => {
    const [passage, ...rest] = commentaryPassages(
      { collection: 'barnes', language: 'fr' },
      {
        id: 'barnes-fr-45-3-21',
        book: 45,
        chapter: 3,
        range_start_verse: 21,
        range_end_verse: 26,
        content: '<p>La justice de Dieu.</p>',
      }
    )
    assert.equal(rest.length, 0)
    assert.equal(
      passage.heading,
      'Barnes (Protestantisme, Réformé, Presbytérien), commentaire sur Romains 3:21-26'
    )
    assert.equal(passage.tradition, 'Protestantisme')
    assert.deepEqual(passage.tags, ['Réformé', 'Presbytérien'])
    assert.deepEqual(passage.target, {
      kind: 'commentary',
      resourceId: 'barnes',
      language: 'fr',
      sectionId: 'barnes-fr-45-3-21',
      book: 45,
      chapter: 3,
    })
    assert.equal(passage.passageKey, 'barnes-fr-45-3-21#0')
    assert.equal(passage.content, 'La justice de Dieu.')
  })

  it('indexes each dictionary work once, not the legacy aggregates', () => {
    assert.equal(dictionaryWorkFromIdentity('dictionary:westphal:fr'), 'westphal')
    assert.equal(
      dictionaryWorkFromIdentity('dictionary:unfoldingword-translation-words:en'),
      'unfoldingword-translation-words'
    )
    assert.equal(dictionaryWorkFromIdentity('dictionary:fr'), undefined)
    assert.equal(dictionaryWorkFromIdentity('dictionary-directory'), undefined)
    const [passage] = dictionaryPassages('westphal', 'fr', {
      entry_id: 10139,
      word: 'Alliance',
      definition: '<p>Pacte.</p>',
    })
    assert.equal(passage.heading, 'Dictionnaire Westphal, Alliance')
    assert.deepEqual(passage.target, {
      kind: 'dictionary',
      work: 'westphal',
      language: 'fr',
      entryId: 10139,
    })
  })

  it('dates timeline passages and skips empty profiles', () => {
    const [event] = timelinePassages('fr', {
      slug: 'exile',
      title: 'L’exil',
      description: 'Déportation.',
      article: '<p>Récit.</p>',
      period: '10',
      dates: '586 av. J.-C.',
    })
    assert.equal(event.heading, 'chronologie biblique, L’exil (586 av. J.-C.)')
    assert.equal(event.content, 'Déportation.\nRécit.')
    assert.deepEqual(entityPassages({ unique_name: 'X', language: 'fr', payload: {} }), [])
    const [profile] = entityPassages({
      unique_name: 'Abraham@Gen',
      language: 'fr',
      payload: {
        displayName: 'Abraham',
        shortDescription: 'Patriarche.',
        articleHtml: 'Père des croyants.',
      },
    })
    assert.equal(profile.title, 'Abraham')
    assert.equal(profile.content, 'Patriarche.\nPère des croyants.')
  })

  it('names references in the passage language', () => {
    assert.equal(passageReference('fr', 66, 20, 1, 6), 'Apocalypse 20:1-6')
    assert.equal(passageReference('en', 43, 3, 16, 16), 'John 3:16')
    assert.equal(passageReference('fr', 19, 23), 'Psaumes 23')
  })
})

describe('library embedding and search input', () => {
  it('embeds queries with the retrieval instruction and checks every vector', async () => {
    const calls: unknown[] = []
    const provider = makeLibraryEmbeddingProvider({
      run: async (_model, input) => {
        calls.push(input)
        return { data: input.text.map(() => Array(1024).fill(0.1)) }
      },
    })
    await provider.embedQuery('  le   pardon ')
    assert.deepEqual(calls[0], { text: [libraryEmbeddingQuery('le pardon')] })
    assert.match(libraryEmbeddingQuery('x'), /^Instruct: .+\nQuery: x$/u)
    const broken = makeLibraryEmbeddingProvider({ run: async () => ({ data: [[1, 2]] }) })
    await assert.rejects(() => broken.embedDocuments(['a']), /LIBRARY_EMBEDDING_INVALID_RESPONSE/)
  })

  it('accepts only known, bounded arguments', () => {
    assert.deepEqual(
      parseLibrarySearchInput({
        query: 'millénium',
        corpora: ['commentary'],
        traditions: ['Adventiste'],
        book: 66,
        limit: 5,
      }),
      {
        query: 'millénium',
        languages: undefined,
        corpora: ['commentary'],
        traditions: ['Adventiste'],
        works: undefined,
        book: 66,
        chapter: undefined,
        limit: 5,
        perspectives: undefined,
      }
    )
    for (const invalid of [
      null,
      { query: 'x' },
      { query: 'pardon', extra: 1 },
      { query: 'pardon', corpora: ['web'] },
      { query: 'pardon', languages: ['de'] },
      { query: 'pardon', traditions: ["x'; drop"] },
      { query: 'pardon', book: 67 },
      { query: 'pardon', limit: 50 },
    ])
      assert.throws(() => parseLibrarySearchInput(invalid), /LIBRARY_SEARCH_INVALID_INPUT/)
  })
})

describe('library search by words', () => {
  it('keeps the rarest lexemes within the budget and leaves the frequent ones to meaning', async () => {
    const { rareLexemeQuery, lexicalKeywords } = await import('../../repositories/librarySearchRepository')
    assert.deepEqual(lexicalKeywords('Que dit la Bible à quelqu’un rongé par l’anxiété ?'), ['quelqu', 'ronge', 'anxiete'])
    // « esper » and « fac » hold thousands of passages; « macchabe » is missing, so rarer than 300.
    assert.equal(
      rareLexemeQuery(['esper', 'fac', 'macchabe', 'proch'], { esper: 9053, fac: 6131, proch: 2318 }),
      "'macchabe' | 'proch'"
    )
    assert.equal(rareLexemeQuery(['test', 'testament'], { test: 11700, testament: 12900 }), null)
    assert.equal(rareLexemeQuery(["l'ami"], {}), "'l''ami'")
  })
})

describe('library collections', () => {
  it('reads a BRI article and an English Sabbath School day into attributed passages', async () => {
    const { LIBRARY_COLLECTIONS, documentPassages, verseRange } = await import('../libraryCollections')
    const bri = LIBRARY_COLLECTIONS.bri
    const article = bri.parse(
      {
        url: 'https://adventistbiblicalresearch.org/articles/the-millennium',
        slug: 'the-millennium',
        title: 'The Millennium',
        authors: [{ name: 'Ekkehardt Mueller', bio: null }],
        date: '2026-09-10T21:33:42.949Z',
        text: 'The millennium follows the second coming.\n\n' + 'Revelation 20 describes it. '.repeat(120),
      },
      'en'
    )
    assert.ok(article)
    const passages = documentPassages(bri, 'en', article)
    assert.ok(passages.length >= 2)
    assert.equal(passages[0].passageKey, 'the-millennium#0')
    assert.equal(passages[0].corpus, 'document')
    assert.equal(passages[0].heading, 'Biblical Research Institute (Protestantisme, Adventiste), Ekkehardt Mueller, « The Millennium » (2026)')
    assert.deepEqual(passages[1].target, {
      kind: 'document',
      collection: 'bri',
      language: 'en',
      documentKey: 'the-millennium',
      part: 1,
      url: 'https://adventistbiblicalresearch.org/articles/the-millennium',
    })
    assert.equal(bri.parse({ slug: '../x', title: 'T', text: 'x' }, 'en'), undefined)
    const { documentKeyOf } = await import('../libraryCollections')
    assert.equal(documentKeyOf('the-millennium'), 'the-millennium')
    assert.match(documentKeyOf('the-taken-and-the-left-παραλαμβάνεται-καὶ-ἀφίεται-what-do-they-really-mean'), /^the-taken-and-the-left-what-do-they-really-mean-[0-9a-f]{8}$/u)
    assert.equal(documentKeyOf('george-w.-reid-passes-to-his-rest'), 'george-w.-reid-passes-to-his-rest')
    assert.notEqual(documentKeyOf('église'), documentKeyOf('eglise-x'))
    assert.equal(bri.parse({ slug: 'a', title: 'T', text: 'x', url: 'https://example.com/a' }, 'en')?.url, null)

    const school = LIBRARY_COLLECTIONS['sabbath-school']
    const day = school.parse(
      {
        id: 'sabbath-school/en/2016-04/01/1',
        kind: 'day',
        quarter: '2016-04',
        quarterTitle: 'The Book of Job',
        lesson: 1,
        lessonTitle: 'The End',
        day: 1,
        date: '2016-09-24',
        title: 'The End',
        references: [{ book: 18, chapter: 42, verses: '10-17' }],
        text: 'In writing classes, students are taught the importance of endings.',
      },
      'en'
    )
    assert.ok(day)
    const [lesson] = documentPassages(school, 'en', day)
    assert.equal(lesson.passageKey, '2016-04/01/1#0')
    assert.equal(lesson.heading, 'Adult Sabbath School Bible Study Guide (Protestantisme, Adventiste), The Book of Job (2016-04), lesson 1 « The End », « The End », Job 42:10-17')
    assert.deepEqual([lesson.book, lesson.chapter, lesson.verseStart, lesson.verseEnd], [18, 42, 10, 17])
    assert.equal(school.parse({ id: 'sabbath-school/fr/2016-04/01/1', text: 'x' }, 'en'), undefined, 'the language must match the file')
    assert.deepEqual(verseRange('14,15'), [14, 15])
    assert.deepEqual(verseRange(''), [null, null])
  })

  it('sorts works into perspectives and checks the new arguments', async () => {
    const { perspectiveOf } = await import('../../repositories/librarySearchRepository')
    assert.equal(perspectiveOf('Protestantisme', ['Adventiste']), 'adventist')
    assert.equal(perspectiveOf('Protestantisme', ['Réformé', 'Calviniste']), 'protestant')
    assert.equal(perspectiveOf('Protestantisme', ['Évangélique', 'Dispensationaliste']), 'evangelical')
    assert.equal(perspectiveOf('Catholicisme', ['Patristique', 'Scolastique']), 'catholic')
    assert.equal(perspectiveOf('Christianisme ancien', ['Patristique']), 'patristic')
    assert.equal(perspectiveOf('Judaïsme', ['Rabbinique']), 'jewish')
    assert.equal(perspectiveOf(null, []), 'reference')
    assert.equal(parseLibrarySearchInput({ query: 'les langues', perspectives: true }).perspectives, true)
    assert.throws(() => parseLibrarySearchInput({ query: 'les langues', perspectives: 'yes' }))
    const { parseLibraryDocumentInput } = await import('../librarySearchInput')
    assert.deepEqual(parseLibraryDocumentInput({ collection: 'sabbath-school', language: 'en', documentKey: '2016-04/01/1' }), { collection: 'sabbath-school', language: 'en', documentKey: '2016-04/01/1' })
    for (const bad of [{ collection: 'bri', language: 'de', documentKey: 'a' }, { collection: 'bri', language: 'en', documentKey: '../a' }, { collection: 'bri', language: 'en', documentKey: 'a', extra: 1 }])
      assert.throws(() => parseLibraryDocumentInput(bad))
  })
})

describe('Ellen G. White in the library', () => {
  it('cuts the Ellen G. White comments that close a section of the Adventist commentary', async () => {
    const { indexedSectionContent, LIBRARY_ON_REQUEST_WORKS } = await import('../libraryDocuments')
    const section = '<p>1. In the beginning. The Hebrew is bereshith.</p><br><br><h3>Ellen G. White</h3><br><span>A Reservoir of Means (Letter 131, 1897).</span>'
    assert.equal(htmlToPlainText(indexedSectionContent('sdabc', section)), '1. In the beginning. The Hebrew is bereshith.')
    assert.equal(htmlToPlainText(indexedSectionContent('sdabc', '<br><br><h3>Ellen G. White</h3><p>Only her.</p>')), '')
    assert.equal(indexedSectionContent('barnes', section), section, 'other works keep their text')
    assert.ok(LIBRARY_ON_REQUEST_WORKS.includes('egw-writings'))
  })
})
