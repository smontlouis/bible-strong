import { verseStudyStrongCodes } from '@bible-strong/resource-domain/verse-study'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listCommentaries } from '../commentary/commentaryCatalog'
import { readResource } from '../resources/resourceApi'
import { createPageReads, PAGE_READ_CONCURRENCY } from '../resources/pageReads'
import { bibleStrongLinks } from './bibleStrongLinks'
import { loadVerseStudy } from './bibleVerseStudy'

vi.mock('../resources/resourceApi', () => ({ readResource: vi.fn() }))
// The portraits come from the media host, which a test does not reach.
vi.mock('../atlas/atlas.functions', () => ({
  readAtlasPortraitCatalog: vi.fn(async () => undefined),
}))

type Query = Record<string, string | number | undefined>
type Answer = (path: string, query: Query) => unknown

const verse = { book: 43, chapter: 3, verse: 16 }
const carrying = ['BDS', 'BHG', 'DBY', 'LSG', 'NEG79', 'S21']

/** What the API answers; a path it does not know is a resource that does not exist. */
const answerWith = (answer: Answer) => {
  vi.mocked(readResource).mockImplementation(
    async (path, query = {}) => answer(path, query) as never
  )
}

const chapterOf = (versionId: string) => ({
  resource: { versionId },
  book: 43,
  chapter: 3,
  verses: [
    { number: 15, text: `${versionId} 15` },
    { number: 16, text: `${versionId}  16\n` },
  ],
})

const study = (reads = createPageReads(), versionId = 'LSG') =>
  loadVerseStudy({
    reads,
    language: 'fr',
    versionId,
    verse,
    verseText: Promise.resolve('Car Dieu a tant aimé le monde'),
    carrying: Promise.resolve(carrying),
    commenting: Promise.resolve([]),
  })

const pathsRead = () => vi.mocked(readResource).mock.calls.map(([path]) => path)

beforeEach(() => {
  vi.mocked(readResource).mockReset()
})

describe('loadVerseStudy', () => {
  it('reads the verse in the other Bibles and in the original language in one read', async () => {
    answerWith((path, query) =>
      path === '/v1/bibles/chapters'
        ? { chapters: String(query.versions).split(',').map(chapterOf) }
        : undefined
    )
    const found = await study()

    expect(vi.mocked(readResource).mock.calls).toContainEqual([
      '/v1/bibles/chapters',
      { versions: 'BDS,BHG,DBY,LSG,NEG79,S21', book: 43, chapter: 3 },
    ])
    expect(pathsRead().filter(path => path.endsWith('/verses'))).toEqual([])
    expect(found.versions.map(quote => [quote.label, quote.text, quote.path])).toEqual([
      ['Bible Segond 21 (S21)', 'S21 16', '/bible/s21/john/3/16'],
      ['Bible du Semeur (BDS)', 'BDS 16', '/bible/bds/john/3/16'],
      ['Nouvelle Edition de Genève 1979 (NEG79)', 'NEG79 16', '/bible/neg79/john/3/16'],
      ['Bible Darby (DBY)', 'DBY 16', '/bible/dby/john/3/16'],
    ])
    expect(found.original?.text).toBe('BHG 16')
  })

  it('reads the comments of the verse in one read, in the order of the commentaries', async () => {
    const section = (resourceId: string, slug: string, startVerse: number, endVerse: number) => ({
      resource: { kind: 'commentary', resourceId, language: 'fr', revision: 'r1' },
      slug,
      startVerse,
      endVerse,
      content: `<p>Commentaire de ${resourceId}.</p>`,
    })
    answerWith(path =>
      path === '/v1/commentaries/verses/43-3-16/sections'
        ? // The API answers in the order asked and leaves out a commentary with no section.
          { verseKey: '43-3-16', sections: [section('MHY', '14-18', 14, 18)], unavailable: [] }
        : undefined
    )
    const found = await loadVerseStudy({
      reads: createPageReads(),
      language: 'fr',
      versionId: 'LSG',
      verse,
      verseText: Promise.resolve(''),
      carrying: Promise.resolve(carrying),
      commenting: Promise.resolve(
        ['barnes', 'mhy-fr'].map(id => ({ id, title: id, path: `/commentary/fr/${id}/john/3` }))
      ),
    })

    const reads = vi
      .mocked(readResource)
      .mock.calls.filter(([path]) => path.startsWith('/v1/commentaries/'))
    expect(reads).toEqual([
      ['/v1/commentaries/verses/43-3-16/sections', { language: 'fr', commentaries: 'barnes,MHY' }],
    ])
    expect(found.comments).toHaveLength(1)
    expect(found.comments[0]).toMatchObject({
      commentary: 'mhy-fr',
      section: '14-18',
      path: '/commentary/fr/mhy-fr/john/3/14-18',
      excerpt: 'Commentaire de MHY.',
    })
  })

  it('asks for no comment where no commentary comments the chapter', async () => {
    answerWith(() => undefined)
    await study()

    expect(pathsRead().filter(path => path.startsWith('/v1/commentaries/'))).toEqual([])
  })

  it('asks the same read whatever Bible of the language is being read', async () => {
    answerWith(() => undefined)
    await study(createPageReads(), 'S21')
    await study(createPageReads(), 'OST')

    const together = vi
      .mocked(readResource)
      .mock.calls.filter(([path]) => path === '/v1/bibles/chapters')
      .map(([, query]) => query?.versions)
    expect(together).toEqual(['BDS,BHG,DBY,LSG,NEG79,S21', 'BDS,BHG,DBY,LSG,NEG79,S21'])
  })

  it('asks each Bible for the verse when their chapters are not answered together', async () => {
    answerWith(path => {
      const versionId = /^\/v1\/bibles\/([^/]+)\/verses$/u.exec(path)?.[1]
      return versionId && versionId !== 'BDS'
        ? { verses: [{ book: 43, chapter: 3, number: 16, text: `${versionId} alone` }] }
        : undefined
    })
    const reads = createPageReads()
    const found = await study(reads)

    expect(found.versions.map(quote => quote.text)).toEqual([
      'S21 alone',
      'NEG79 alone',
      'DBY alone',
    ])
    expect(found.original?.text).toBe('BHG alone')
    expect(reads.incomplete).toBe(false)
  })

  it('does not quote a Bible that numbers the verse and leaves it blank', async () => {
    answerWith((path, query) =>
      path === '/v1/bibles/chapters'
        ? {
            chapters: String(query.versions)
              .split(',')
              .map(versionId =>
                versionId === 'S21'
                  ? { ...chapterOf(versionId), verses: [{ number: 16, text: '\n ' }] }
                  : chapterOf(versionId)
              ),
          }
        : undefined
    )
    const reads = createPageReads()
    const found = await study(reads)

    expect(found.versions.map(quote => quote.text)).toEqual(['BDS 16', 'NEG79 16', 'DBY 16'])
    expect(reads.incomplete).toBe(false)
  })

  it('does not quote a cross-reference to a verse the Bible leaves blank', async () => {
    answerWith(path => {
      if (path.startsWith('/v1/cross-references/')) return { references: ['40-17-21', '45-5-8'] }
      if (path === '/v1/bibles/LSG/verses') {
        return {
          verses: [
            { book: 40, chapter: 17, number: 21, text: '' },
            { book: 45, chapter: 5, number: 8, text: 'Mais Dieu prouve son amour' },
          ],
        }
      }
      return undefined
    })
    const found = await study()

    expect(found.crossReferences.map(quote => quote.path)).toEqual(['/bible/lsg/rom/5/8'])
  })

  it('shows what it could read and knows the page is incomplete when a read fails', async () => {
    answerWith((path, query) => {
      if (path === '/v1/bibles/chapters') {
        return { chapters: String(query.versions).split(',').map(chapterOf) }
      }
      if (path.startsWith('/v1/naves/')) throw new Error('Resource API responded 429')
      return undefined
    })
    const reads = createPageReads()
    const found = await study(reads)

    expect(found.versions).toHaveLength(4)
    expect(found.topics).toEqual([])
    expect(reads.incomplete).toBe(true)
  })

  it('is whole when what it did not find does not exist', async () => {
    answerWith(() => undefined)
    const reads = createPageReads()
    const found = await study(reads)

    expect(found).toEqual({
      versions: [],
      original: undefined,
      words: [],
      crossReferences: [],
      comments: [],
      topics: [],
      dictionary: [],
      entities: [],
    })
    expect(reads.incomplete).toBe(false)
  })

  it('keeps to the reads a page may have in flight', async () => {
    let inFlight = 0
    let most = 0
    vi.mocked(readResource).mockImplementation(async path => {
      inFlight += 1
      most = Math.max(most, inFlight)
      await new Promise(resolve => setTimeout(resolve, 0))
      inFlight -= 1
      // The cross-references and the verses they name: two reads, one after the other.
      return (
        path.startsWith('/v1/cross-references/') ? { references: ['45-5-8', '62-4-9'] } : undefined
      ) as never
    })
    const commentaries = ['acbc', 'barnes', 'mhy-fr', 'aquifer-fr', 'fre-aug'].map(id => ({
      id,
      title: id,
      path: `/commentary/fr/${id}/john/3`,
    }))
    await loadVerseStudy({
      reads: createPageReads(),
      language: 'fr',
      versionId: 'LSG',
      verse,
      verseText: Promise.resolve(''),
      carrying: Promise.resolve(carrying),
      commenting: Promise.resolve(commentaries),
    })

    expect(pathsRead().length).toBeGreaterThan(PAGE_READ_CONCURRENCY)
    expect(most).toBe(PAGE_READ_CONCURRENCY)
  })
})

// ---------- The verse study the Resource API gathers (ADR-0115) ----------

type Language = 'fr' | 'en'

// John 3:16 as the Resource API holds it: the tagged words of each Strong Bible, a word tagged
// with the sense it has there, a compound word, and an entry the lexicon does not have.
const SPANS: Record<
  string,
  { startOffset: number; length: number; identities: { kind: string; code: string }[] }[]
> = {
  LSG: [
    { startOffset: 4, length: 4, identities: [{ kind: 'strong', code: 'G2316' }] },
    {
      startOffset: 9,
      length: 6,
      identities: [
        { kind: 'strong', code: 'G0025' },
        { kind: 'dstrong', code: 'G0025G' },
      ],
    },
    {
      startOffset: 16,
      length: 9,
      identities: [
        { kind: 'strong', code: 'G2889' },
        { kind: 'estrong', code: 'G3779' },
      ],
    },
    { startOffset: 26, length: 3, identities: [{ kind: 'strong', code: 'G9999' }] },
  ],
  DBY: [{ startOffset: 0, length: 4, identities: [{ kind: 'strong', code: 'G1063' }] }],
  KJV: [
    { startOffset: 4, length: 3, identities: [{ kind: 'strong', code: 'G2316' }] },
    { startOffset: 8, length: 2, identities: [{ kind: 'strong', code: 'G3779' }] },
  ],
}
const MISSING_ENTRY = 'G9999'
const REFERENCES = ['God.', '45-5-8', '62-4-9', '43-3-16', '40-17-21']
const ENTITIES = [
  {
    uniqueName: 'God@Gen.1.1',
    name: 'Dieu',
    category: 'supernatural',
    type: 'Deity',
    verses: [16],
  },
  {
    uniqueName: 'Nicodemus@Jhn.3.1',
    name: 'Nicodème',
    category: 'person',
    type: 'Male',
    verses: [1],
  },
]
const DICTIONARY = [
  {
    resource: { work: 'westphal' },
    id: 12,
    word: 'Amour',
    normalizedWord: 'amour',
    evidenceKind: 'verse-name',
    correspondenceId: 'love',
  },
  {
    resource: { work: 'bost' },
    id: 7,
    word: 'Monde',
    normalizedWord: 'monde',
    evidenceKind: 'source-citation',
  },
]
const TOPICS = [{ normalizedName: 'amour', name: 'Amour' }]

const verseTextOf = (versionId: string, key: string) =>
  key === '40-17-21' ? '' : `${versionId} ${key} Car Dieu a tant aimé le monde`
const card = (code: string) => ({
  selectedIdentity: { kind: 'dstrong', code },
  original: `original ${code}`,
  transliteration: `translit ${code}`,
  gloss: `gloss ${code}`,
})
const sectionsOf = (commentaries: string, language: Language) =>
  commentaries
    .split(',')
    .filter(Boolean)
    .map(resourceId => ({
      resource: { kind: 'commentary', resourceId, language, revision: 'r1' },
      slug: '16-17',
      startVerse: 16,
      endVerse: 17,
      content: `<p>Commentaire de ${resourceId}.</p>`,
    }))

/**
 * The Resource API over one set of data, its routes one by one, and with or without the
 * verse study that gathers them; `failing` makes the study fail.
 */
const resourceApi =
  (study: 'answered' | 'unknown' | 'failing') =>
  (path: string, query: Query): unknown => {
    const language: Language = path.includes('/en/') || query.language === 'en' ? 'en' : 'fr'
    const studied = /^\/v1\/verse-studies\/(fr|en)\/43-3-16$/u.exec(path)
    if (studied) {
      if (study === 'failing') throw new Error('Resource API responded 500')
      if (study === 'unknown') return undefined
      const studyLanguage = studied[1] as Language
      const versionId = studyLanguage === 'en' ? 'KJV' : 'LSG'
      const spans = SPANS[versionId]!
      return {
        verseKey: '43-3-16',
        language: studyLanguage,
        words: {
          versionId,
          spans,
          entries: verseStudyStrongCodes(spans)
            .filter(code => code !== MISSING_ENTRY)
            .map(card),
        },
        crossReferences: REFERENCES,
        commentaries: sectionsOf(String(query.commentaries ?? ''), studyLanguage),
        topics: TOPICS,
        dictionary: DICTIONARY,
        entities: ENTITIES.filter(entity => entity.verses.includes(16)),
      }
    }
    if (path === '/v1/bibles/chapters') {
      return { chapters: String(query.versions).split(',').map(chapterOf) }
    }
    const verses = /^\/v1\/bibles\/([^/]+)\/verses$/u.exec(path)
    if (verses) {
      return {
        verses: String(query.references)
          .split(',')
          .map(key => {
            const [book, chapter, number] = key.split('-').map(Number)
            return { book, chapter, number, text: verseTextOf(verses[1]!, key) }
          }),
      }
    }
    const strong = /^\/v1\/strong-bibles\/([^/]+)\/books\/43\/chapters\/3$/u.exec(path)
    if (strong) {
      const spans = SPANS[strong[1]!]
      return spans && { verses: [{ number: 16, spans }] }
    }
    if (path === '/v1/strong-lexicon/entries/batch') {
      return {
        entries: String(query.identities)
          .split(',')
          .map(identity => identity.replace(/^dstrong:/u, ''))
          .filter(code => code !== MISSING_ENTRY)
          .map(card),
      }
    }
    if (path === '/v1/cross-references/fr/verses/43-3-16') return { references: REFERENCES }
    if (path === '/v1/commentaries/verses/43-3-16/sections') {
      return { sections: sectionsOf(String(query.commentaries), language) }
    }
    if (path === `/v1/naves/${language}/verses/43-3-16/topics`) {
      return { verseTopics: TOPICS, chapterTopics: [] }
    }
    if (path === '/v1/dictionaries/verses/43-3-16/entries') return { entries: DICTIONARY }
    if (path === '/v1/strong-lexicon/entities/chapters/Jhn/3') return { entities: ENTITIES }
    return undefined
  }

const publicationIdOf = (language: Language, id: string) =>
  listCommentaries(language).find(commentary => commentary.id === id)?.publicationId

const commentingOf = (language: Language) =>
  listCommentaries(language)
    .slice(0, 3)
    .map(commentary => ({
      id: commentary.id,
      title: commentary.title,
      path: `/c/${commentary.id}`,
    }))

const studyIn = (versionId: string, language: Language, reads = createPageReads()) =>
  loadVerseStudy({
    reads,
    language,
    versionId,
    verse,
    verseText: Promise.resolve(verseTextOf(versionId, '43-3-16')),
    carrying: Promise.resolve(
      language === 'en' ? ['BHG', 'ESV', 'KJV', 'NIV', 'NKJV', 'NLT'] : carrying
    ),
    commenting: Promise.resolve(commentingOf(language)),
  })

// The Bibles a page is read in: the one a language borrows words from, an untagged one, a
// tagged one of its own, in both languages.
const READ_IN: [string, Language][] = [
  ['LSG', 'fr'],
  ['S21', 'fr'],
  ['DBY', 'fr'],
  ['KJV', 'en'],
  ['NIV', 'en'],
]

describe('loadVerseStudy with the verse study of the Resource API', () => {
  it.each(READ_IN)(
    'shows in %s (%s) what it shows reading each part on its own',
    async (versionId, language) => {
      answerWith(resourceApi('unknown'))
      const ownReads = createPageReads()
      const own = await studyIn(versionId, language, ownReads)
      answerWith(resourceApi('answered'))
      const sharedReads = createPageReads()
      const shared = await studyIn(versionId, language, sharedReads)

      expect(shared).toEqual(own)
      expect(sharedReads.incomplete).toBe(false)
      // Every part has something, so the comparison compares something.
      expect(own.words.length).toBeGreaterThan(0)
      expect(own.crossReferences.length).toBeGreaterThan(0)
      expect(own.comments.length).toBeGreaterThan(0)
      expect(own.topics.length).toBeGreaterThan(0)
      expect(own.dictionary.length).toBeGreaterThan(0)
      expect(own.entities.map(entity => entity.name)).toEqual(['Dieu'])
      // A word whose entry the lexicon lacks is left out either way.
      expect(own.words.some(word => word.code === MISSING_ENTRY)).toBe(false)
    }
  )

  it('reads the study, the verse in the other Bibles and the passages it names: three reads', async () => {
    answerWith(resourceApi('answered'))
    await studyIn('S21', 'fr')

    expect(vi.mocked(readResource).mock.calls).toEqual([
      ['/v1/bibles/chapters', { versions: 'BDS,BHG,DBY,LSG,NEG79,S21', book: 43, chapter: 3 }],
      [
        '/v1/verse-studies/fr/43-3-16',
        {
          commentaries: commentingOf('fr')
            .map(link => publicationIdOf('fr', link.id))
            .join(','),
          // S21 numbers as the pivot: the study is asked in it.
          numbering: 'org',
          reader: 'org',
        },
      ],
      ['/v1/bibles/S21/verses', { references: '45-5-8,62-4-9,40-17-21' }],
    ])
  })

  it('asks every Bible of a language the same study', async () => {
    answerWith(resourceApi('answered'))
    for (const [versionId] of READ_IN.filter(([, language]) => language === 'fr')) {
      await studyIn(versionId, 'fr')
    }
    const studies = vi
      .mocked(readResource)
      .mock.calls.filter(([path]) => path.startsWith('/v1/verse-studies/'))
    expect(new Set(studies.map(call => JSON.stringify(call))).size).toBe(1)
    expect(studies).toHaveLength(3)
  })

  it('reads the words of a tagged Bible other than the one its language borrows from', async () => {
    answerWith(resourceApi('answered'))
    const found = await studyIn('DBY', 'fr')

    expect(pathsRead().sort()).toEqual([
      '/v1/bibles/DBY/verses',
      '/v1/bibles/chapters',
      '/v1/strong-bibles/DBY/books/43/chapters/3',
      '/v1/strong-lexicon/entries/batch',
      '/v1/verse-studies/fr/43-3-16',
    ])
    expect(found.words.map(word => word.code)).toEqual(['G1063'])
    expect(found.wordsVersion).toBeUndefined()
  })

  it('borrows the words of an untagged Bible from the study, cut from the text they tag', async () => {
    answerWith(resourceApi('answered'))
    const found = await studyIn('S21', 'fr')
    const borrowedText = chapterOf('LSG').verses[1]!.text

    expect(found.wordsVersion).toBe('LSG')
    expect(found.words.map(word => [word.code, word.word])).toEqual([
      ['G2316', borrowedText.slice(4, 8).trim()],
      ['G0025G', undefined],
      ['G2889', undefined],
      ['G3779', undefined],
    ])
  })

  it('leaves every part out and reads none of them again when the study fails', async () => {
    answerWith(resourceApi('failing'))
    const reads = createPageReads()
    const found = await studyIn('LSG', 'fr', reads)

    expect(reads.incomplete).toBe(true)
    expect(found).toMatchObject({
      words: [],
      crossReferences: [],
      comments: [],
      topics: [],
      dictionary: [],
      entities: [],
    })
    // The verse in the other Bibles does not depend on the study.
    expect(found.versions).toHaveLength(4)
    expect(pathsRead().sort()).toEqual(['/v1/bibles/chapters', '/v1/verse-studies/fr/43-3-16'])
  })

  it('names the same Strong entries as the words it shows', () => {
    for (const spans of Object.values(SPANS)) {
      const shown = spans.flatMap(span =>
        bibleStrongLinks(span.identities, 'fr').map(link => link.code)
      )
      expect(new Set(verseStudyStrongCodes(spans))).toEqual(new Set(shown))
    }
  })
})

describe('a verse page of a Bible that numbers differently', () => {
  // KJF numbers as the KJV: its Psalm 51:3 ("Car je reconnais") is LSG 51:5, org 51:5. The
  // Trésor names KJV 38:18, which is LSG 38:19 and KJF 38:18.
  const fakeApi: Answer = (path, query) => {
    if (path === '/v1/verse-studies/fr/19-51-5') {
      return {
        verseKey: '19-51-5',
        language: 'fr',
        words: { versionId: 'LSG', spans: [], entries: [] },
        crossReferences: ['For I', '19-38-19'],
        commentaries: [],
        topics: [],
        dictionary: [],
        entities: [],
      }
    }
    if (path === '/v1/bibles/chapters') {
      return {
        chapters: String(query.versions)
          .split(',')
          .map(versionId => ({
            resource: { versionId },
            book: query.book,
            chapter: query.chapter,
            verses: [1, 3, 5].map(number => ({
              number,
              text: `${versionId} ${query.book}-${query.chapter}-${number}`,
            })),
          })),
      }
    }
    const verses = /^\/v1\/bibles\/([^/]+)\/verses$/u.exec(path)
    if (verses) {
      return {
        verses: String(query.references)
          .split(',')
          .map(key => {
            const [book, chapter, number] = key.split('-').map(Number)
            return { book, chapter, number, text: `${verses[1]} ${key}` }
          }),
      }
    }
    return undefined
  }

  const studyOf = (versionId: string, verse: { book: number; chapter: number; verse: number }) =>
    loadVerseStudy({
      reads: createPageReads(),
      language: 'fr',
      versionId,
      verse,
      verseText: Promise.resolve(''),
      carrying: Promise.resolve([]),
      commenting: Promise.resolve([]),
    })

  it('asks the study at the pivot verse and shows what it names at the page verses', async () => {
    answerWith(fakeApi)
    const found = await studyOf('KJF', { book: 19, chapter: 51, verse: 3 })

    const studyCall = vi
      .mocked(readResource)
      .mock.calls.find(([path]) => path.startsWith('/v1/verse-studies/'))
    expect(studyCall).toEqual([
      '/v1/verse-studies/fr/19-51-5',
      { commentaries: undefined, numbering: 'org', reader: 'bs-kjv' },
    ])
    // The cross-reference is read in KJF at its own number.
    expect(found.crossReferences.map(reference => reference.path)).toEqual(['/bible/kjf/ps/38/18'])
    // LSG gives its verse 51:5, the verse KJF 51:3 stands for.
    expect(found.versions.find(version => version.label.endsWith('(LSG)'))?.path).toBe(
      '/bible/lsg/ps/51/5'
    )
  })

  it('reads another Bible in another chapter when its numbering puts the verse there', async () => {
    answerWith(fakeApi)
    // LSG Malachi 3:23 is Malachi 4:5 in BHG and NEG79, which number Malachi as the KJV.
    await studyOf('LSG', { book: 39, chapter: 3, verse: 23 })
    const chapterReads = vi
      .mocked(readResource)
      .mock.calls.filter(([path]) => path === '/v1/bibles/chapters')
      .map(([, query]) => `${query?.versions}:${query?.book}-${query?.chapter}`)
    expect(chapterReads).toContain('BHG,NEG79:39-4')
  })
})
