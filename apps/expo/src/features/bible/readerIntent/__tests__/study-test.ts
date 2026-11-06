/* eslint-disable import/first */
import { atom, createStore } from 'jotai/vanilla'

jest.mock('~helpers/agentObservability', () => ({
  appLogger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), captureError: jest.fn() },
}))
jest.mock('~state/app', () => ({
  isFullScreenBibleAtom: jest.requireActual('jotai/vanilla').atom(false),
}))
jest.mock('~state/tabs', () => ({
  savedParallelVersionsAtom: jest.requireActual('jotai/vanilla').atom([]),
}))
jest.mock('~helpers/bibleVersions', () => ({ getBibleVersionCanonId: () => 'protestant-66' }))
jest.mock('~helpers/biblesDb', () => ({ getChapterVerseCount: jest.fn() }))
jest.mock('~helpers/firebase', () => ({
  cdnUrl: (path: string) => `https://assets.example/${path}`,
}))
jest.mock('~features/resources/dictionaryAccess', () => ({
  getDefaultDictionaryWork: () => 'westphal',
}))
jest.mock('~state/resourcesLanguage', () => ({
  resourcesLanguageAtom: jest
    .requireActual('jotai/vanilla')
    .atom({ NAVE: 'fr', DICTIONNAIRE: 'fr' }),
}))
jest.mock('~i18n', () => ({
  __esModule: true,
  getLanguage: () => 'fr',
  default: { t: (key: string) => key },
}))

import { previewHistoryAtom } from '~features/bibleReferencePreview/previewHistory'
import { createStrongDetailRoute } from '~features/lexique/strongDetailRoutes'
import type { RelationEndpoint } from '~features/studyRelations/domain'
import { getBook } from '~helpers/bibleBookCatalog'
import type { BibleTab } from '~state/tabs'
import { INITIAL_ANNOTATION_SESSION_STATE } from '../../hooks/annotationSession'
import { handleReaderIntent } from '..'
import type {
  OpenTarget,
  Reader,
  ReaderPresentation,
  ReaderRoute,
  ReaderSnapshot,
  ReaderWorld,
} from '..'

const john = getBook(43)!

const tab: BibleTab = {
  id: 'tab-1',
  title: 'Jean 11',
  isRemovable: true,
  type: 'bible',
  data: {
    selectedVersion: 'LSG',
    selectedBook: john,
    selectedChapter: 11,
    selectedVerse: 35,
    parallelVersions: [],
    temp: { selectedBook: john, selectedChapter: 11, selectedVerse: 35 },
    selectedVerses: {},
    selectionMode: 'grid',
    isSelectionMode: undefined,
    contextDisplayMode: 'focused',
    focusVerses: [35, 36],
  },
}

const setup = ({
  platform = 'ios',
  reader: snapshot = {},
}: {
  platform?: ReaderWorld['platform']
  reader?: Partial<Omit<ReaderSnapshot, 'tabAtom'>>
} = {}) => {
  const store = createStore()
  const routes: ReaderRoute[] = []
  const studyObjects: RelationEndpoint[] = []
  const presentations: ReaderPresentation[] = []
  const world: ReaderWorld = {
    platform,
    store,
    dispatch: jest.fn() as unknown as ReaderWorld['dispatch'],
    getState: jest.fn() as unknown as ReaderWorld['getState'],
    openVersionSelector: jest.fn(),
    navigate: route => void routes.push(route),
    openStudyObject: endpoint => void studyObjects.push(endpoint),
    openUrl: jest.fn(async () => undefined),
    notify: jest.fn(),
    openTags: jest.fn(),
    haptic: jest.fn(),
    confirm: jest.fn(async () => false),
    queueOfflineCopy: jest.fn(),
    refetch: jest.fn(async () => undefined),
    repairBibleDatabase: jest.fn(async () => undefined),
    t: key => key,
  }
  const reader: Reader = {
    now: () => ({
      tabId: 'tab-1',
      tabAtom: atom(tab),
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
      biblicalEntitiesStatus: null,
      ...snapshot,
    }),
    surface: presentation => void presentations.push(presentation),
  }
  const send = (intent: unknown) => handleReaderIntent({ tabId: 'tab-1', intent }, reader, world)
  /** What the study sends for a door it opens, as the page builds it. */
  const open = (target: OpenTarget) =>
    send({ kind: 'open', origin: 'focus-study', target, verseKey: '43-11-35', version: 'LSG' })
  return {
    send,
    open,
    routes,
    studyObjects,
    presentations,
    preview: () => store.get(previewHistoryAtom),
  }
}

describe.each(['ios', 'web'] as const)('the study of a verse in focus, %s', platform => {
  it('studies another verse of the focus', async () => {
    const { send, presentations } = setup({ platform })

    await expect(send({ kind: 'study-verse', verse: 36 })).resolves.toEqual({ status: 'done' })
    expect(presentations).toEqual([{ kind: 'studied-verse', verse: 36 }])
  })

  it('opens a resource of the verse studied, in the version of the reading', async () => {
    const { send, presentations } = setup({ platform })

    await expect(
      send({ kind: 'open-resource', resource: 'commentary', verseKey: '43-11-35' })
    ).resolves.toEqual({ status: 'done' })
    expect(presentations).toEqual([
      { kind: 'verse-resource', resource: 'commentary', verseKey: '43-11-35', version: 'LSG' },
    ])
  })

  it('opens the Strong page of a word, never the sheet', async () => {
    const { open, routes, presentations } = setup({ platform })

    await expect(
      open({ kind: 'strong-word', identities: [{ kind: 'strong', code: 'G1145' }] })
    ).resolves.toEqual({ status: 'done' })
    expect(presentations).toEqual([])
    expect(routes).toEqual([
      createStrongDetailRoute('index', {
        book: 43,
        reference: 'G1145',
        identityKind: 'strong',
        identityCode: 'G1145',
        bibleVersion: 'LSG',
        bibleChapter: 11,
      }),
    ])
  })

  it('opens a cross reference on its verse', async () => {
    const { open, routes, preview } = setup({ platform })

    await expect(
      open({ kind: 'endpoint', endpoint: { type: 'verse', verseKeys: ['19-56-9'] } })
    ).resolves.toEqual({ status: 'done' })
    expect(preview()).toEqual([])
    expect(routes).toEqual([
      {
        pathname: '/bible-view',
        params: { contextDisplayMode: 'focused', book: '19', chapter: '56', verse: '9' },
      },
    ])
  })

  it('opens the page of a topic, without a preview', async () => {
    const { open, studyObjects, preview } = setup({ platform })
    const endpoint: RelationEndpoint = {
      type: 'nave',
      nameLower: 'larmes',
      labelFallback: 'Larmes',
    }

    await expect(open({ kind: 'endpoint', endpoint })).resolves.toEqual({ status: 'done' })
    expect(preview()).toEqual([])
    expect(studyObjects).toEqual([endpoint])
  })

  it('opens an article of a dictionary', async () => {
    const { open, routes } = setup({ platform })

    await expect(
      open({
        kind: 'dictionary-article',
        word: 'Lazare',
        entryId: 812,
        work: 'westphal',
        resourceId: 'dictionary-westphal',
        title: 'Westphal',
        language: 'fr',
      })
    ).resolves.toEqual({ status: 'done' })
    expect(routes).toEqual([
      {
        pathname: '/dictionnary-detail',
        params: {
          word: 'Lazare',
          entryId: '812',
          work: 'westphal',
          resourceId: 'dictionary-westphal',
          dictionaryTitle: 'Westphal',
          language: 'fr',
        },
      },
    ])
  })

  it('keeps the correspondence of a dictionary article', async () => {
    const { open, routes } = setup({ platform })

    await open({
      kind: 'dictionary-article',
      word: 'Béthanie',
      entryId: 40,
      work: 'smith',
      resourceId: 'dictionary-smith',
      title: 'Smith',
      language: 'en',
      correspondenceId: 'bethany',
    })
    expect(routes[0]?.params).toMatchObject({ correspondenceId: 'bethany' })
  })

  it('opens a biblical entity of the verse', async () => {
    const { open, routes } = setup({ platform })

    await expect(open({ kind: 'biblical-entity', entityKey: 'Lazare' })).resolves.toEqual({
      status: 'done',
    })
    expect(routes).toEqual([
      createStrongDetailRoute(
        'entity',
        { book: 43, bibleVersion: 'LSG', bibleChapter: 11 },
        { entityKey: 'Lazare' }
      ),
    ])
  })

  it('studies and opens while the reader hides personal Bible data', async () => {
    const { send, open, presentations, studyObjects } = setup({
      platform,
      reader: { hidesPersonalData: true },
    })

    await expect(send({ kind: 'study-verse', verse: 36 })).resolves.toEqual({ status: 'done' })
    await expect(
      send({ kind: 'open-resource', resource: 'compare', verseKey: '43-11-35' })
    ).resolves.toEqual({ status: 'done' })
    await expect(
      open({ kind: 'endpoint', endpoint: { type: 'nave', nameLower: 'larmes' } })
    ).resolves.toEqual({ status: 'done' })
    expect(presentations).toHaveLength(2)
    expect(studyObjects).toHaveLength(1)
  })

  it('rejects what the study cannot ask', async () => {
    const { send, open, routes, presentations } = setup({ platform })

    await expect(send({ kind: 'study-verse', verse: '36' })).resolves.toEqual({
      status: 'rejected',
    })
    await expect(
      send({ kind: 'open-resource', resource: 'timeline', verseKey: '43-11-35' })
    ).resolves.toEqual({ status: 'rejected' })
    await expect(
      send({ kind: 'open-resource', resource: 'compare', verseKey: 'Jean 11:35' })
    ).resolves.toEqual({ status: 'rejected' })
    await expect(
      open({ kind: 'dictionary-article', word: 'Lazare' } as unknown as OpenTarget)
    ).resolves.toEqual({ status: 'rejected' })
    expect(routes).toEqual([])
    expect(presentations).toEqual([])
  })

  it('refuses a study intent sent for another Tab', async () => {
    const { send, presentations } = setup({ platform, reader: { tabId: 'tab-2' } })

    await expect(send({ kind: 'study-verse', verse: 36 })).resolves.toEqual({
      status: 'refused',
      rule: 'stale-tab',
    })
    expect(presentations).toEqual([])
  })
})
