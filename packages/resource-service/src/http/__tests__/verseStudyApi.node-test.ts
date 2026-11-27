import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { TIPNR_BOOK_CODES } from '@bible-strong/resource-domain/strong-lexicon'
import { verseStudyStrongCodes } from '@bible-strong/resource-domain/verse-study'
import { Effect } from 'effect'

import { DictionaryEntryNotFound, type DictionaryRepositoryService } from '../../domain/dictionary'
import {
  NaveRepositoryFailure,
  NaveTopicNotFound,
  type NaveRepositoryService,
} from '../../domain/nave'
import {
  ActiveStrongBiblePublicationUnavailable,
  StrongBibleChapterNotFound,
  type ActiveStrongBibleChapter,
  type StrongBibleRepositoryService,
} from '../../domain/strongBible'
import {
  StrongLexiconEntityNotFound,
  StrongLexiconEntryNotFound,
  type StrongLexiconRepositoryService,
} from '../../domain/strongLexicon'
import {
  SupplementaryContentNotFound,
  type SupplementaryRepositoryService,
} from '../../domain/supplementary'
import { makeResourceWebHandler, type ResourceRepositoryOverrides } from '../app'

// John 3:16 in LSG: a plain word, a word tagged with a number and the sense it has there, and
// a compound word tagged with two numbers. John 3:17 has nothing published around it.
const strongResource = {
  versionId: 'LSG',
  datasetId: 'LSG',
  revision: 'strong-lsg-r1',
  textRevision: 'lsg-text-r1',
  textSha256: '1'.repeat(64),
  strongRevision: 'strong-r1',
}
const SPANS = [
  {
    ordinal: 0,
    startOffset: 4,
    length: 4,
    stepTokenIds: [1],
    identities: [{ kind: 'strong' as const, code: 'G2316' }],
  },
  {
    ordinal: 1,
    startOffset: 9,
    length: 5,
    identities: [
      { kind: 'strong' as const, code: 'G0025' },
      { kind: 'dstrong' as const, code: 'G0025G' },
    ],
  },
  {
    ordinal: 2,
    startOffset: 15,
    length: 10,
    identities: [
      { kind: 'strong' as const, code: 'G2889' },
      { kind: 'estrong' as const, code: 'G3779' },
    ],
  },
]

const chapterReads: string[] = []
const strongBible = (withVerseRead: boolean): StrongBibleRepositoryService => {
  const chapterOf = (input: {
    book: number
    chapter: number
  }): Effect.Effect<ActiveStrongBibleChapter, StrongBibleChapterNotFound> =>
    input.book === 43 && input.chapter === 3
      ? Effect.succeed({
          ...strongResource,
          book: 43,
          chapter: 3,
          verses: [
            { number: 16, spans: SPANS },
            { number: 17, spans: [] },
          ],
        })
      : Effect.fail(new StrongBibleChapterNotFound({ versionId: 'LSG', ...input }))
  const unused = () =>
    Effect.fail(new ActiveStrongBiblePublicationUnavailable({ versionId: 'LSG' }))
  return {
    findActiveCoverage: unused,
    findActiveChapter: input => {
      chapterReads.push(`chapter:${input.versionId}:${input.book}-${input.chapter}`)
      return chapterOf(input)
    },
    ...(withVerseRead
      ? {
          findActiveVerse: input => {
            chapterReads.push(
              `verse:${input.versionId}:${input.book}-${input.chapter}-${input.verse}`
            )
            return chapterOf(input).pipe(
              Effect.map(chapter => ({
                ...strongResource,
                spans: chapter.verses.find(verse => verse.number === input.verse)?.spans ?? [],
              }))
            )
          },
        }
      : {}),
    findCountsByBook: unused,
    findCountsByBookOfReferences: unused,
    findOccurrences: unused,
    findLemmaStats: unused,
  }
}

const card = (code: string) => ({
  id: Number(code.replace(/\D/gu, '')),
  selectedIdentity: { kind: 'dstrong' as const, code },
  stepCode: code,
  classicStrong: code.slice(0, 5),
  eStrong: code,
  dStrong: code,
  language: 'greek' as const,
  baseCode: Number(code.replace(/\D/gu, '')),
  original: `original ${code}`,
  transliteration: `translit ${code}`,
  gloss: `gloss ${code}`,
  definitionHtml: '<p>Une longue définition que la page ne lit pas.</p>',
})

const cardReads: string[][] = []
// Only what a verse study reads; the rest of the lexicon is not reached by these tests.
const strongLexicon = {
  findEntryCards: (input: { identities: { reference: string; kind: string }[] }) => {
    cardReads.push(input.identities.map(identity => `${identity.kind}:${identity.reference}`))
    return Effect.succeed(
      input.identities
        .filter(identity => identity.reference !== 'G3779')
        .map(identity => ({ revision: 'simple-fr-r1', value: card(identity.reference) }))
    )
  },
  findChapterEntities: (input: { bookCode: string; chapter: number }) =>
    input.bookCode === TIPNR_BOOK_CODES[18] && input.chapter === 51
      ? Effect.succeed({
          revision: 'entities-r1',
          // The title of the Psalm is in verse 1, as in the KJV.
          value: [
            {
              uniqueName: 'Bathsheba@2Sa.11.3',
              name: 'Bathsheba',
              category: 'person' as const,
              type: 'Female',
              verses: [1],
            },
          ],
        })
      : Effect.succeed({
      revision: 'entities-r1',
      value:
        input.bookCode === TIPNR_BOOK_CODES[42] && input.chapter === 3
          ? [
              {
                uniqueName: 'God@Gen.1.1',
                name: 'Dieu',
                category: 'supernatural' as const,
                type: 'Deity',
                verses: [16, 17],
              },
              {
                uniqueName: 'Nicodemus@Jhn.3.1',
                name: 'Nicodème',
                category: 'person' as const,
                type: 'Male',
                verses: [1, 4, 9],
              },
            ]
          : [],
    }),
} as unknown as StrongLexiconRepositoryService

const notFound = (verseKey: string) =>
  Effect.fail(new SupplementaryContentNotFound({ resourceIdentity: 'fixture', verseKey }))

// The keys each part was read at, for the studies in the pivot numbering.
const partReads: string[] = []

const supplementary = {
  findCrossReferences: (input: { verseKey: string }) =>
    (partReads.push(`cross-references:${input.verseKey}`), input.verseKey) === '39-4-5'
      ? Effect.succeed({
          language: 'fr' as const,
          verseKey: '39-4-5',
          revision: 'tresor-r1',
          // The Trésor numbers as the KJV: Psalm 38:18 of the KJV is LSG 38:19.
          references: ['Elijah.', '40-11-14', '19-38-18'],
        })
      : input.verseKey === '43-3-16'
        ? Effect.succeed({
            language: 'fr' as const,
            verseKey: '43-3-16',
            revision: 'tresor-r1',
            references: ['God.', '45-5-8', '62-4-9'],
          })
        : notFound(input.verseKey),
  findCommentaryVerseSections: (input: {
    collections: readonly string[]
    book: number
    chapter: number
    verse: number
  }) =>
    (partReads.push(
      `commentaries:${input.collections.join('+')}:${input.book}-${input.chapter}-${input.verse}`
    ),
    input.book === 39)
      ? Effect.succeed(
          input.collections.map(collection => ({
            collection,
            revision: `${collection}-r1`,
            section: {
              slug: '5-6',
              startVerse: 5,
              endVerse: 6,
              content: `<p>${collection} sur Malachie 4.5</p>`,
            },
          }))
        )
      : Effect.succeed(
          input.collections.flatMap(collection =>
            collection === 'jfb'
              ? []
              : [
                  {
                    collection,
                    revision: `${collection}-r1`,
                    ...(input.verse === 16
                      ? {
                          section: {
                            slug: '16-17',
                            startVerse: 16,
                            endVerse: 17,
                            content: `<p>${collection} sur Jean 3.16</p>`,
                          },
                        }
                      : {}),
                  },
                ]
          )
        ),
} as unknown as SupplementaryRepositoryService

const nave = (failing = false) =>
  ({
    findVerseTopics: (input: { language: 'fr' | 'en'; verseKey: string }) =>
      (partReads.push(`nave:${input.verseKey}`), failing)
        ? Effect.fail(new NaveRepositoryFailure({ cause: new Error('password=x') }))
        : input.verseKey === '43-3-16'
          ? Effect.succeed({
              language: input.language,
              revision: 'nave-r1',
              verseKey: input.verseKey,
              verseTopics: [{ normalizedName: 'amour', name: 'Amour', initial: 'a' }],
              chapterTopics: [{ normalizedName: 'nicodeme', name: 'Nicodème', initial: 'n' }],
            })
          : Effect.fail(
              new NaveTopicNotFound({ language: input.language, normalizedName: input.verseKey })
            ),
  }) as unknown as NaveRepositoryService

const dictionary = {
  discoverPassageEntries: (input: { verseKey: string; language?: 'fr' | 'en' }) => (
    partReads.push(`dictionary:${input.verseKey}`),
    Effect.succeed(
      input.verseKey === '43-3-16'
        ? [
            {
              work: 'westphal',
              language: input.language ?? 'fr',
              revision: 'westphal-r1',
              resourceId: 'WESTPHAL',
              title: 'Dictionnaire encyclopédique de la Bible',
              abbreviation: 'Westphal',
              id: 12,
              word: 'Amour',
              normalizedWord: 'amour',
              evidenceKind: 'verse-name' as const,
              correspondenceId: 'love',
            },
          ]
        : []
    )
  ),
} as unknown as DictionaryRepositoryService

const overrides = (withVerseRead = true): ResourceRepositoryOverrides => ({
  strongBible: strongBible(withVerseRead),
  strongLexicon,
  supplementary,
  dictionary,
})

const read = async (path: string, options: { failingNave?: boolean; verseRead?: boolean } = {}) => {
  const web = makeResourceWebHandler(
    undefined,
    nave(options.failingNave),
    overrides(options.verseRead ?? true)
  )
  try {
    const response = await web.handler(new Request(`http://localhost${path}`))
    return { status: response.status, body: (await response.json()) as Record<string, any> }
  } finally {
    await web.dispose()
  }
}

describe('v1 verse study API', () => {
  it('reads each part of a study in the pivot numbering at its own verse', async () => {
    partReads.length = 0
    chapterReads.length = 0
    // LSG Malachi 3:23 ("Je vous enverrai Élie") is KJV Malachi 4:5.
    const study = await read(
      '/v1/verse-studies/fr/39-3-23?numbering=org&commentaries=barnes,aquifer-fr'
    )
    assert.equal(study.status, 200, JSON.stringify(study.body))
    assert.equal(study.body.verseKey, '39-3-23')
    assert.ok(partReads.includes('cross-references:39-4-5'))
    assert.ok(partReads.includes('nave:39-4-5'))
    // The French dictionaries are found in LSG, which numbers as the pivot.
    assert.ok(partReads.includes('dictionary:39-3-23'))
    // Barnes numbers as the KJV; Aquifer is not measured and is read at the verse as given.
    assert.ok(partReads.includes('commentaries:barnes:39-4-5'))
    assert.ok(partReads.includes('commentaries:aquifer-fr:39-3-23'))
    assert.ok(chapterReads.some(entry => entry.endsWith(':39-3-23') || entry.endsWith(':39-3')))
    // The targets come back in the pivot numbering, the words they bear on kept.
    assert.deepEqual(study.body.crossReferences, ['Elijah.', '40-11-14', '19-38-19'])
    // Barnes on KJV 4:5-6 is org 3:23-24, in the studied chapter.
    const barnes = study.body.commentaries.find(
      (section: { resource: { resourceId: string } }) => section.resource.resourceId === 'barnes'
    )
    assert.deepEqual([barnes.startVerse, barnes.endVerse], [23, 24])
    assert.deepEqual(
      study.body.commentaries.map(
        (section: { resource: { resourceId: string } }) => section.resource.resourceId
      ),
      ['barnes', 'aquifer-fr']
    )
  })

  it('reads an unmeasured resource at the reader verse of a KJV page', async () => {
    partReads.length = 0
    // KJV Psalm 51:1 ("Have mercy upon me", with the title) is org 51:3.
    const study = await read(
      '/v1/verse-studies/en/19-51-3?numbering=org&reader=bs-kjv&commentaries=barnes,mhm'
    )
    assert.equal(study.status, 200, JSON.stringify(study.body))
    assert.ok(partReads.includes('cross-references:19-51-1'))
    assert.ok(partReads.includes('nave:19-51-1'))
    // Barnes is measured; MHM is not, and is read at the reader's verse, as before.
    assert.ok(partReads.includes('commentaries:barnes+mhm:19-51-1'))
    assert.deepEqual(
      study.body.entities.map((entity: { name: string }) => entity.name),
      ['Bathsheba']
    )
  })

  it('reads every part at the verse as given without a numbering', async () => {
    partReads.length = 0
    await read('/v1/verse-studies/fr/39-3-23?commentaries=barnes')
    assert.ok(partReads.includes('cross-references:39-3-23'))
    assert.ok(partReads.includes('nave:39-3-23'))
    assert.ok(partReads.includes('commentaries:barnes:39-3-23'))
  })

  it('answers in one read what each route of its parts answers for the verse', async () => {
    chapterReads.length = 0
    cardReads.length = 0
    const study = await read('/v1/verse-studies/fr/43-3-16?commentaries=barnes,jfb,MHY')
    assert.equal(study.status, 200, JSON.stringify(study.body))

    // The words: the verse of the LSG Strong chapter, and the entries of the codes it names.
    const chapter = await read('/v1/strong-bibles/LSG/books/43/chapters/3')
    const spans = chapter.body.verses.find((verse: { number: number }) => verse.number === 16).spans
    assert.equal(study.body.words.versionId, 'LSG')
    assert.deepEqual(
      study.body.words.spans,
      spans.map(({ startOffset, length, identities }: Record<string, unknown>) => ({
        startOffset,
        length,
        identities,
      }))
    )
    const codes = verseStudyStrongCodes(spans)
    assert.deepEqual(codes, ['G2316', 'G0025G', 'G3779', 'G2889'])
    const cards = await read(
      `/v1/strong-lexicon/entries/batch?language=fr&level=simple&identities=${codes
        .map(code => `dstrong:${code}`)
        .join(',')}`
    )
    assert.deepEqual(
      study.body.words.entries,
      cards.body.entries.map(
        ({ selectedIdentity, original, transliteration, gloss }: Record<string, unknown>) => ({
          selectedIdentity,
          original,
          transliteration,
          gloss,
        })
      )
    )
    // The verse alone was read for the study, not its chapter.
    assert.deepEqual(chapterReads, ['verse:LSG:43-3-16', 'chapter:LSG:43-3'])
    assert.deepEqual(cardReads[0], cardReads[1])

    const crossReferences = await read('/v1/cross-references/fr/verses/43-3-16')
    assert.deepEqual(study.body.crossReferences, crossReferences.body.references)

    const sections = await read(
      '/v1/commentaries/verses/43-3-16/sections?language=fr&commentaries=barnes,jfb,MHY'
    )
    assert.deepEqual(study.body.commentaries, sections.body.sections)
    assert.deepEqual(
      study.body.commentaries.map(
        (section: { resource: { resourceId: string } }) => section.resource.resourceId
      ),
      ['barnes', 'MHY']
    )

    const topics = await read('/v1/naves/fr/verses/43-3-16/topics')
    assert.deepEqual(study.body.topics, topics.body.verseTopics)

    const articles = await read('/v1/dictionaries/verses/43-3-16/entries?language=fr')
    assert.deepEqual(study.body.dictionary, articles.body.entries)

    const entities = await read(
      `/v1/strong-lexicon/entities/chapters/${TIPNR_BOOK_CODES[42]}/3?language=fr`
    )
    assert.deepEqual(
      study.body.entities,
      entities.body.entities.filter((entity: { verses: number[] }) => entity.verses.includes(16))
    )
    assert.deepEqual(
      study.body.entities.map((entity: { name: string }) => entity.name),
      ['Dieu']
    )
  })

  it('reads the words through the chapter of a repository that cannot read a verse alone', async () => {
    chapterReads.length = 0
    const withVerse = await read('/v1/verse-studies/fr/43-3-16', { verseRead: true })
    const withChapter = await read('/v1/verse-studies/fr/43-3-16', { verseRead: false })

    assert.deepEqual(withChapter.body, withVerse.body)
    assert.deepEqual(chapterReads, ['verse:LSG:43-3-16', 'chapter:LSG:43-3'])
  })

  it('answers a verse with nothing around it with empty parts, never as absent', async () => {
    const study = await read('/v1/verse-studies/fr/43-3-17')
    assert.equal(study.status, 200)
    assert.deepEqual(study.body, {
      verseKey: '43-3-17',
      language: 'fr',
      words: { versionId: 'LSG', spans: [], entries: [] },
      crossReferences: [],
      commentaries: [],
      topics: [],
      dictionary: [],
      entities: [
        {
          uniqueName: 'God@Gen.1.1',
          name: 'Dieu',
          category: 'supernatural',
          type: 'Deity',
          verses: [16, 17],
        },
      ],
    })

    // A chapter the Strong Bible does not have leaves the words empty too.
    const elsewhere = await read('/v1/verse-studies/en/1-1-1')
    assert.equal(elsewhere.status, 200)
    assert.deepEqual(elsewhere.body.words, { versionId: 'KJV', spans: [], entries: [] })
  })

  it('is never answered 404, even when every part answers that it has nothing', async () => {
    const nothing = {
      strongBible: {
        ...strongBible(true),
        findActiveVerse: (input: { book: number; chapter: number }) =>
          Effect.fail(new StrongBibleChapterNotFound({ versionId: 'LSG', ...input })),
      },
      strongLexicon: {
        findEntryCards: () => Effect.fail(new StrongLexiconEntryNotFound({ reference: 'G2316' })),
        findChapterEntities: () =>
          Effect.fail(new StrongLexiconEntityNotFound({ uniqueName: 'God@Gen.1.1' })),
      } as unknown as StrongLexiconRepositoryService,
      supplementary: {
        findCrossReferences: () => notFound('43-3-16'),
        findCommentaryVerseSections: () => notFound('43-3-16'),
      } as unknown as SupplementaryRepositoryService,
      dictionary: {
        discoverPassageEntries: () =>
          Effect.fail(new DictionaryEntryNotFound({ work: 'westphal', language: 'fr' })),
      } as unknown as DictionaryRepositoryService,
    } satisfies ResourceRepositoryOverrides
    const naveNotFound = {
      findVerseTopics: (input: { language: 'fr' | 'en'; verseKey: string }) =>
        Effect.fail(
          new NaveTopicNotFound({ language: input.language, normalizedName: input.verseKey })
        ),
    } as unknown as NaveRepositoryService
    const web = makeResourceWebHandler(undefined, naveNotFound, nothing)
    try {
      const response = await web.handler(
        new Request('http://localhost/v1/verse-studies/fr/43-3-16?commentaries=MHY')
      )
      assert.equal(response.status, 200)
      assert.deepEqual(await response.json(), {
        verseKey: '43-3-16',
        language: 'fr',
        words: { versionId: 'LSG', spans: [], entries: [] },
        crossReferences: [],
        commentaries: [],
        topics: [],
        dictionary: [],
        entities: [],
      })
      // The words find nothing to read entries for; with words, entries not found are none.
      const withWords = makeResourceWebHandler(undefined, naveNotFound, {
        ...nothing,
        strongBible: strongBible(true),
      })
      try {
        const words = await withWords.handler(
          new Request('http://localhost/v1/verse-studies/fr/43-3-16')
        )
        assert.equal(words.status, 200)
        const body = (await words.json()) as { words: { spans: unknown[]; entries: unknown[] } }
        assert.equal(body.words.spans.length, SPANS.length)
        assert.deepEqual(body.words.entries, [])
      } finally {
        await withWords.dispose()
      }
    } finally {
      await web.dispose()
    }
  })

  it('fails whole, and is not kept, when a part could not be read', async () => {
    const study = await read('/v1/verse-studies/fr/43-3-16', { failingNave: true })
    assert.equal(study.status, 500)
    assert.equal(study.body.code, 'RESOURCE_INTERNAL_FAILURE')
    assert.doesNotMatch(JSON.stringify(study.body), /password/u)
  })

  it('refuses a verse or a language it does not know', async () => {
    assert.equal((await read('/v1/verse-studies/de/43-3-16')).status, 400)
    assert.equal((await read('/v1/verse-studies/fr/43-3-0')).status, 400)
    assert.equal((await read('/v1/verse-studies/fr/43-3-16?commentaries=a,a')).status, 400)
  })
})
