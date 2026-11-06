/* eslint-disable import/first */
import { atom, createStore } from 'jotai/vanilla'

jest.mock('~helpers/agentObservability', () => ({
  appLogger: { debug: jest.fn(), info: jest.fn(), captureError: jest.fn() },
}))
jest.mock('~state/app', () => ({
  isFullScreenBibleAtom: jest.requireActual('jotai/vanilla').atom(false),
}))
jest.mock('~state/tabs', () => ({
  savedParallelVersionsAtom: jest.requireActual('jotai/vanilla').atom([]),
}))
jest.mock('~state/resourcesLanguage', () => ({
  resourcesLanguageAtom: jest
    .requireActual('jotai/vanilla')
    .atom({ NAVE: 'en', DICTIONNAIRE: 'fr' }),
}))
jest.mock('~helpers/bibleVersions', () => ({ getBibleVersionCanonId: () => 'protestant-66' }))
jest.mock('~helpers/biblesDb', () => ({ getChapterVerseCount: jest.fn() }))
jest.mock('~helpers/firebase', () => ({
  cdnUrl: (path: string) => `https://assets.example/${path}`,
}))
jest.mock('~features/resources/dictionaryAccess', () => ({
  getDefaultDictionaryWork: () => 'westphal',
}))
jest.mock('~i18n', () => ({
  __esModule: true,
  getLanguage: () => 'fr',
  default: { t: (key: string) => key },
}))
jest.mock('@bible-strong/resource-catalog/commentaries', () => ({
  getCommentaryByPublicationId: (resourceId: string) =>
    resourceId === 'matthew-henry' ? { id: 'mhy', shortName: 'Matthew Henry' } : undefined,
}))

import { previewHistoryAtom } from '~features/bibleReferencePreview/previewHistory'
import type { InlineCommentaryChip } from '~features/commentaries/inlineCommentaryPlacement'
import type { ReadingIndex } from '~features/resources/commentaryReadingAccess'
import type { RelationEndpoint } from '~features/studyRelations/domain'
import { appLogger } from '~helpers/agentObservability'
import { getBook } from '~helpers/bibleBookCatalog'
import type { BibleTab } from '~state/tabs'
import { INITIAL_ANNOTATION_SESSION_STATE } from '../../hooks/annotationSession'
import { handleReaderIntent } from '..'
import type {
  OpenIntent,
  Reader,
  ReaderPresentation,
  ReaderRoute,
  ReaderSnapshot,
  ReaderWorld,
} from '..'

const genesis = getBook(1)!

const createTab = (data: Partial<BibleTab['data']> = {}): BibleTab => ({
  id: 'tab-1',
  title: 'Genèse 1',
  isRemovable: true,
  type: 'bible',
  data: {
    selectedVersion: 'LSG',
    selectedBook: genesis,
    selectedChapter: 1,
    selectedVerse: 1,
    parallelVersions: [],
    temp: { selectedBook: genesis, selectedChapter: 1, selectedVerse: 1 },
    selectedVerses: {},
    selectionMode: 'grid',
    isSelectionMode: undefined,
    ...data,
  },
})

const commentaryChip: InlineCommentaryChip = {
  resourceId: 'matthew-henry',
  language: 'en',
  revision: 'r2',
  sectionId: 'gen-1-1',
  rangeStartVerse: 1,
  rangeEndVerse: 2,
  excerpt: 'In the beginning',
  sections: [{ sectionId: 'gen-1-1', rangeStartVerse: 1, rangeEndVerse: 2, excerpt: 'In the' }],
}

const setup = ({
  platform = 'ios',
  tab = createTab(),
  reader: snapshot = {},
  openUrl,
}: {
  platform?: ReaderWorld['platform']
  tab?: BibleTab
  reader?: Partial<Omit<ReaderSnapshot, 'tabAtom'>>
  openUrl?: ReaderWorld['openUrl']
} = {}) => {
  const store = createStore()
  const tabAtom = atom(tab)
  const surfaced: ReaderPresentation[] = []
  const routes: ReaderRoute[] = []
  const studyObjects: RelationEndpoint[] = []
  const urls: string[] = []
  const notices: Parameters<ReaderWorld['notify']>[0][] = []
  const world: ReaderWorld = {
    platform,
    store,
    dispatch: jest.fn() as unknown as ReaderWorld['dispatch'],
    openVersionSelector: jest.fn(),
    navigate: route => void routes.push(route),
    openStudyObject: endpoint => void studyObjects.push(endpoint),
    openUrl: openUrl ?? (async url => void urls.push(url)),
    notify: notice => void notices.push(notice),
    openTags: jest.fn(),
    haptic: jest.fn(),
    t: key => key,
  }
  const reader: Reader = {
    now: () => ({
      tabId: 'tab-1',
      tabAtom,
      annotationMode: false,
      annotationSession: atom(INITIAL_ANNOTATION_SESSION_STATE),
      versesByVersion: {},
      isFormSheet: false,
      keepControlsVisible: false,
      hasPlanDayStep: false,
      hidesPersonalData: false,
      interlinearReadingVersions: [],
      parallelColumnVersions: [],
      inlineCommentaries: { chips: [], indexes: [] },
      bookmarks: {},
      wordAnnotations: {},
      wordAnnotationsInOtherVersions: {},
      ...snapshot,
    }),
    surface: presentation => void surfaced.push(presentation),
  }
  return {
    surfaced,
    routes,
    studyObjects,
    urls,
    notices,
    preview: () => store.get(previewHistoryAtom),
    send: (intent: unknown) => handleReaderIntent({ tabId: 'tab-1', intent }, reader, world),
  }
}

const noteEndpoint: RelationEndpoint = { type: 'note', key: 'note:note-1', noteId: 'note-1' }
const linkEndpoint: RelationEndpoint = {
  type: 'externalLink',
  linkId: 'link-1',
  sourceKey: 'link-1',
  url: 'https://example.com',
  labelFallback: 'Exemple',
}
const verseEndpoint: RelationEndpoint = { type: 'verse', key: 'verse:1-1-1', verseKeys: ['1-1-1'] }

/** An item of a Relation beside Genesis 1:1, toward the endpoint given. */
const openRelation = (endpoint: RelationEndpoint, targetExists = true): OpenIntent => ({
  kind: 'open',
  origin: 'relation',
  verseKey: '1-1-1',
  target: {
    kind: 'endpoint',
    endpoint,
    relation: { activeEndpoint: verseEndpoint, verseIds: ['1-1-1'], targetExists },
  },
})

describe('open intents, the same on every platform', () => {
  describe.each(['ios', 'web'] as const)('%s', platform => {
    it('opens the Strong sheet for a word of the text, in its verse and version', async () => {
      const reader = setup({ platform })

      await expect(
        reader.send({
          kind: 'open',
          origin: 'text',
          verseKey: '18-3-2',
          version: 'BHG',
          target: {
            kind: 'strong-word',
            identities: [{ kind: 'strong', code: 'H0347' }],
            word: 'Job',
            occurrenceId: 'occurrence-1',
          },
        })
      ).resolves.toEqual({ status: 'done' })
      expect(reader.surfaced).toEqual([
        {
          kind: 'strong-selection',
          selection: expect.objectContaining({
            book: 18,
            chapter: 3,
            verse: 2,
            reference: '347',
            version: 'BHG',
            word: 'Job',
            occurrenceId: 'occurrence-1',
          }),
        },
      ])
    })

    it('opens the Strong sheet for a Strong relation, in the version of the reading', async () => {
      const reader = setup({ platform })

      await reader.send(openRelation({ type: 'strong', language: 'hebrew', code: '3068' }))
      expect(reader.surfaced).toEqual([
        {
          kind: 'strong-selection',
          selection: {
            book: 1,
            reference: '3068',
            identities: [{ kind: 'strong', code: 'H3068' }],
            version: 'LSG',
          },
        },
      ])
    })

    it('opens the Strong page for a Strong code of the passage media', async () => {
      const reader = setup({ platform })

      await expect(
        reader.send({
          kind: 'open',
          origin: 'passage-media',
          target: {
            kind: 'endpoint',
            endpoint: { type: 'strong', language: 'greek', code: 'G26' },
          },
        })
      ).resolves.toEqual({ status: 'done' })
      expect(reader.surfaced).toEqual([])
      expect(reader.routes).toEqual([
        { pathname: '/strong/g0026', params: { bibleVersion: 'LSG', bibleChapter: '1' } },
      ])
    })

    it('opens the resources of a verse in a column on screen, the main one otherwise', async () => {
      const reader = setup({ platform, reader: { parallelColumnVersions: ['KJV'] } })
      const open = (version: string) =>
        reader.send({
          kind: 'open',
          origin: 'verse',
          verseKey: '1-1-3',
          version,
          target: { kind: 'verse-resource', resource: 'strong' },
        })

      await open('KJV')
      await open('DBY')
      expect(reader.surfaced).toEqual([
        { kind: 'verse-resource', resource: 'strong', verseKey: '1-1-3', version: 'KJV' },
        { kind: 'verse-resource', resource: 'strong', verseKey: '1-1-3', version: 'LSG' },
      ])
    })

    it('opens a biblical entity, the map of the chapter, a tag and the pericopes', async () => {
      const reader = setup({ platform })

      await reader.send({
        kind: 'open',
        origin: 'chapter-entities',
        target: { kind: 'biblical-entity', entityKey: 'adam' },
      })
      await reader.send({
        kind: 'open',
        origin: 'chapter-entities',
        target: { kind: 'map', places: ['eden', 'havilah'] },
      })
      await reader.send({ kind: 'open', origin: 'tag', target: { kind: 'tag', tagId: 'tag-1' } })
      await reader.send({ kind: 'open', origin: 'heading', target: { kind: 'pericopes' } })

      expect(reader.routes).toHaveLength(4)
      expect(JSON.stringify(reader.routes[0])).toContain('adam')
      expect(reader.routes.slice(1)).toEqual([
        { pathname: '/strong/map', params: { places: 'eden,havilah', title: 'Genèse 1' } },
        { pathname: '/tag', params: { tagId: 'tag-1' } },
        { pathname: '/pericope', params: { book: '1', version: 'LSG' } },
      ])
    })

    it('opens a note of the version’s own text in its sheet', async () => {
      const reader = setup({ platform })
      const note = {
        offset: 4,
        order: 1,
        kind: 'note' as const,
        markup: '<note n="a">le vide</note>',
      }

      await reader.send({
        kind: 'open',
        origin: 'text',
        verseKey: '1-1-2',
        target: { kind: 'canonical-note', note },
      })
      expect(reader.surfaced).toEqual([{ kind: 'canonical-note', note }])
    })

    it('leaves for the YouTube page of a passage media, and for no other address', async () => {
      const reader = setup({ platform })
      const open = (url: string) =>
        reader.send({
          kind: 'open',
          origin: 'passage-media',
          target: { kind: 'media-source', url },
        })

      await expect(open('https://www.youtube.com/watch?v=abc')).resolves.toEqual({
        status: 'done',
      })
      await expect(open('https://example.com/video')).resolves.toEqual({
        status: 'refused',
        rule: 'unknown-media-source',
      })
      expect(reader.urls).toEqual(['https://www.youtube.com/watch?v=abc'])
    })

    it('tells the reader when the media source cannot open', async () => {
      const reader = setup({
        platform,
        openUrl: async () => {
          throw new Error('no browser')
        },
      })

      await reader.send({
        kind: 'open',
        origin: 'passage-media',
        target: { kind: 'media-source', url: 'https://youtu.be/abc' },
      })
      expect(reader.notices).toEqual([{ type: 'error', message: 'bible.passageMedia.openFailed' }])
    })

    it('falls back on the Relations of the verse when the note of a Relation is gone', async () => {
      const reader = setup({ platform })

      await reader.send(openRelation(noteEndpoint, false))
      expect(reader.notices).toEqual([
        {
          type: 'warning',
          message: "Cette note n'existe plus. Vous pouvez supprimer la relation.",
        },
      ])
      expect(reader.routes).toEqual([
        { pathname: '/entity-relations', params: { endpoint: JSON.stringify(verseEndpoint) } },
      ])
      expect(reader.preview()).toEqual([])
    })

    it('falls back on the Relations when an annotation of a Relation is gone', async () => {
      const reader = setup({ platform })

      await reader.send(openRelation({ type: 'annotation', annotationId: 'annotation-1' }, false))
      expect(reader.notices).toEqual([])
      expect(reader.routes).toEqual([
        { pathname: '/entity-relations', params: { endpoint: JSON.stringify(verseEndpoint) } },
      ])
    })
  })
})

describe('open intents on a native platform', () => {
  it('opens the note of a Relation as a page, on the verses of the Relation', async () => {
    const reader = setup()

    await expect(reader.send(openRelation(noteEndpoint))).resolves.toEqual({ status: 'done' })
    expect(reader.routes).toEqual([
      {
        pathname: '/note',
        params: { noteId: 'note-1', verseKeys: JSON.stringify(['1-1-1']), version: 'LSG' },
      },
    ])
  })

  it('opens the link of a Relation as a page', async () => {
    const reader = setup()

    await reader.send(openRelation(linkEndpoint))
    expect(reader.routes).toEqual([{ pathname: '/link', params: { linkId: 'link-1' } }])
  })

  it('opens the study object a Relation leads to, a link of its own when gone', async () => {
    const reader = setup()
    const study: RelationEndpoint = { type: 'study', studyId: 'study-1' }

    await reader.send(openRelation(study))
    await reader.send(openRelation(linkEndpoint, false))
    expect(reader.studyObjects).toEqual([study, linkEndpoint])
  })

  it('opens the verses of a heading reference, focused, in the version of the reading', async () => {
    const reader = setup()

    await reader.send({
      kind: 'open',
      origin: 'heading',
      target: { kind: 'endpoint', endpoint: { type: 'verse', verseKeys: ['1-2-4', '1-2-5'] } },
    })
    expect(reader.routes).toEqual([
      {
        pathname: '/bible-view',
        params: expect.objectContaining({
          contextDisplayMode: 'focused',
          chapter: '2',
          verse: '4',
          focusVerses: JSON.stringify([4, 5]),
          version: 'LSG',
        }),
      },
    ])
    expect(reader.preview()).toEqual([])
  })

  it('opens the section of an inline commentary as a page', async () => {
    const reader = setup({
      reader: { inlineCommentaries: { chips: [commentaryChip], indexes: [] } },
    })

    await reader.send({
      kind: 'open',
      origin: 'inline-commentary',
      target: {
        kind: 'commentary-section',
        resourceId: 'matthew-henry',
        language: 'en',
        revision: 'r2',
        sectionId: 'gen-1-1',
      },
    })
    expect(reader.routes).toEqual([
      {
        pathname: '/commentary-entry',
        params: { projectionId: 'mhy:en', book: '1', chapter: '1', sectionId: 'gen-1-1' },
      },
    ])
    expect(reader.preview()).toEqual([])
  })
})

describe('open intents on the web, which previews in place of a page', () => {
  it('previews the note of a Relation, whose page stays one tap away', async () => {
    const reader = setup({ platform: 'web' })

    await reader.send(openRelation(noteEndpoint))
    expect(reader.routes).toEqual([])
    const [request] = reader.preview()
    expect(request).toMatchObject({ kind: 'note', noteId: 'note-1', title: 'Note' })

    request.open()
    expect(reader.routes).toEqual([
      {
        pathname: '/note',
        params: { noteId: 'note-1', verseKeys: JSON.stringify(['1-1-1']), version: 'LSG' },
      },
    ])
  })

  it('previews the link of a Relation', async () => {
    const reader = setup({ platform: 'web' })

    await reader.send(openRelation(linkEndpoint))
    expect(reader.preview()).toEqual([
      { kind: 'link', linkId: 'link-1', title: 'Lien', open: expect.any(Function) },
    ])
  })

  it('previews a verse a Relation leads to, in the version of the reading', async () => {
    const reader = setup({ platform: 'web' })

    await reader.send(openRelation({ type: 'verse', verseKeys: ['43-3-16'] }))
    expect(reader.preview()).toEqual([
      expect.objectContaining({
        kind: 'bible',
        selections: [{ book: 43, chapter: 3, start: 16, end: 16 }],
        version: 'LSG',
      }),
    ])
    expect(reader.studyObjects).toEqual([])
  })

  it('previews a Nave topic in its resource language', async () => {
    const reader = setup({ platform: 'web' })

    await reader.send(openRelation({ type: 'nave', nameLower: 'love' }))
    expect(reader.preview()).toEqual([
      expect.objectContaining({
        kind: 'nave',
        name: 'love',
        source: { kind: 'nave', language: 'en' },
      }),
    ])
  })

  it('previews the section of an inline commentary with the sections of its index', async () => {
    const index = {
      resource: { resourceId: 'matthew-henry', language: 'en', revision: 'r2' },
      sections: [{ id: 'gen-1-1', rangeStartVerse: 1, rangeEndVerse: 3, excerpt: 'Full' }],
    } as unknown as ReadingIndex
    const reader = setup({
      platform: 'web',
      reader: { inlineCommentaries: { chips: [commentaryChip], indexes: [index] } },
    })

    await reader.send({
      kind: 'open',
      origin: 'inline-commentary',
      target: {
        kind: 'commentary-section',
        resourceId: 'matthew-henry',
        language: 'en',
        revision: 'r2',
        sectionId: 'gen-1-1',
      },
    })
    expect(reader.routes).toEqual([])
    const [request] = reader.preview()
    expect(request).toMatchObject({
      kind: 'commentary',
      title: 'Matthew Henry',
      request: {
        resourceId: 'matthew-henry',
        book: 1,
        chapter: 1,
        sectionId: 'gen-1-1',
        sections: [{ sectionId: 'gen-1-1', rangeStartVerse: 1, rangeEndVerse: 3, excerpt: 'Full' }],
        excerpt: 'In the beginning',
      },
    })
    if (request.kind !== 'commentary') throw new Error('not a commentary')
    request.open('gen-1-2')
    expect(reader.routes).toEqual([
      {
        pathname: '/commentary-entry',
        params: { projectionId: 'mhy:en', book: '1', chapter: '1', sectionId: 'gen-1-2' },
      },
    ])
  })

  it('does nothing for an inline commentary the reader no longer shows', async () => {
    const reader = setup({ platform: 'web' })

    await expect(
      reader.send({
        kind: 'open',
        origin: 'inline-commentary',
        target: {
          kind: 'commentary-section',
          resourceId: 'matthew-henry',
          language: 'en',
          revision: 'r2',
          sectionId: 'gen-1-1',
        },
      })
    ).resolves.toEqual({ status: 'done' })
    expect(reader.preview()).toEqual([])
    expect(reader.routes).toEqual([])
  })
})

describe('the personal-data rule of an open', () => {
  beforeEach(() => jest.clearAllMocks())

  it.each([
    ['the note of a Relation', openRelation(noteEndpoint)],
    ['the link of a Relation', openRelation(linkEndpoint)],
    ['the verse of a Relation', openRelation(verseEndpoint)],
    ['a Strong relation', openRelation({ type: 'strong', language: 'hebrew', code: '3068' })],
    [
      'a tag',
      { kind: 'open', origin: 'tag', target: { kind: 'tag', tagId: 'tag-1' } } as OpenIntent,
    ],
  ])('refuses %s when the reader hides personal Bible data', async (_, intent) => {
    const reader = setup({ platform: 'web', reader: { hidesPersonalData: true } })

    await expect(reader.send(intent)).resolves.toEqual({
      status: 'refused',
      rule: 'personal-data',
    })
    expect(reader.routes).toEqual([])
    expect(reader.surfaced).toEqual([])
    expect(reader.preview()).toEqual([])
    expect(appLogger.debug).toHaveBeenCalledWith('webview', 'reader_intent.refused', {
      kind: 'open',
      target: intent.target.kind,
      origin: intent.origin,
      rule: 'personal-data',
    })
  })

  it('keeps the Bible text open when the reader hides personal Bible data', async () => {
    const reader = setup({ reader: { hidesPersonalData: true } })

    await reader.send({
      kind: 'open',
      origin: 'text',
      verseKey: '1-1-1',
      version: 'LSG',
      target: { kind: 'strong-word', identities: [{ kind: 'strong', code: 'H7225' }] },
    })
    await reader.send({ kind: 'open', origin: 'heading', target: { kind: 'pericopes' } })
    await reader.send({
      kind: 'open',
      origin: 'heading',
      target: { kind: 'endpoint', endpoint: { type: 'verse', verseKeys: ['1-2-4'] } },
    })
    expect(reader.surfaced).toHaveLength(1)
    expect(reader.routes).toHaveLength(2)
  })
})

describe('the decoding of an open intent', () => {
  beforeEach(() => jest.clearAllMocks())

  it.each([
    ['an unknown origin', { kind: 'open', origin: 'clipboard', target: { kind: 'pericopes' } }],
    ['an unknown target', { kind: 'open', origin: 'text', target: { kind: 'shell' } }],
    [
      'an endpoint of no known type',
      { kind: 'open', origin: 'relation', target: { kind: 'endpoint', endpoint: { type: 'x' } } },
    ],
    [
      'a note without its identifier',
      {
        kind: 'open',
        origin: 'relation',
        target: { kind: 'endpoint', endpoint: { type: 'note' } },
      },
    ],
    [
      'a Relation without its target state',
      {
        kind: 'open',
        origin: 'relation',
        target: { kind: 'endpoint', endpoint: noteEndpoint, relation: { verseIds: [] } },
      },
    ],
    [
      'a word without a Strong code',
      {
        kind: 'open',
        origin: 'text',
        verseKey: '1-1-1',
        version: 'LSG',
        target: { kind: 'strong-word', identities: [{ kind: 'strong', code: 'abc' }] },
      },
    ],
    [
      'a word without its verse',
      {
        kind: 'open',
        origin: 'text',
        version: 'LSG',
        target: { kind: 'strong-word', identities: [{ kind: 'strong', code: 'H7225' }] },
      },
    ],
    [
      'a verse resource without its verse',
      { kind: 'open', origin: 'verse', target: { kind: 'verse-resource', resource: 'strong' } },
    ],
    [
      'an empty map',
      { kind: 'open', origin: 'chapter-entities', target: { kind: 'map', places: [] } },
    ],
    [
      'a canonical note without its place',
      {
        kind: 'open',
        origin: 'text',
        target: { kind: 'canonical-note', note: { kind: 'note', markup: '<note/>' } },
      },
    ],
  ])('rejects %s', async (_, intent) => {
    const reader = setup()

    await expect(reader.send(intent)).resolves.toEqual({ status: 'rejected' })
    expect(reader.routes).toEqual([])
    expect(reader.surfaced).toEqual([])
    expect(appLogger.captureError).toHaveBeenCalledWith(
      'webview',
      'reader_intent.rejected',
      expect.any(Error),
      { kind: 'open' }
    )
  })
})
