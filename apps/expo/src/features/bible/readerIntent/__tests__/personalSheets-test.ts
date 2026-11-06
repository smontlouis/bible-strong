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

import type { Bookmark } from '~common/types'
import { createVerseEndpoint } from '~features/studyRelations/domain'
import { getEntityRelationsRoute } from '~features/studyRelations/routeParams'
import { getBook } from '~helpers/bibleBookCatalog'
import type { WordAnnotation } from '~redux/modules/user/wordAnnotations'
import type { BibleTab } from '~state/tabs'
import { INITIAL_ANNOTATION_SESSION_STATE } from '../../hooks/annotationSession'
import { handleReaderIntent } from '..'
import type {
  PersonalSheetIntent,
  Reader,
  ReaderPresentation,
  ReaderRoute,
  ReaderSnapshot,
  ReaderTagsSheet,
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

const bookmark: Bookmark = {
  id: 'bookmark-1',
  name: 'Création',
  color: 'blue',
  book: 1,
  chapter: 1,
  verse: 3,
  date: 1,
  version: 'LSG',
}

const annotation: WordAnnotation = {
  id: 'annotation-1',
  version: 'LSG',
  ranges: [
    { verseKey: '1-1-1', startWordIndex: 0, endWordIndex: 1, text: 'Au commencement' },
    { verseKey: '1-1-3', startWordIndex: 2, endWordIndex: 2, text: 'Que' },
  ],
  color: 'yellow',
  type: 'background',
  date: 1,
}

/** What a chapter of the reader shows of the user's data: Word annotations without their words. */
const personalData = {
  bookmarks: { 3: bookmark },
  wordAnnotations: {
    [annotation.id]: {
      ...annotation,
      ranges: annotation.ranges.map(range => ({ ...range, text: '' })),
    },
  },
  wordAnnotationsInOtherVersions: { '1-1-2': [{ version: 'KJV', count: 2 }] },
}

const setup = ({
  platform = 'ios',
  tab = createTab(),
  reader: snapshot = {},
}: {
  platform?: ReaderWorld['platform']
  tab?: BibleTab
  reader?: Partial<Omit<ReaderSnapshot, 'tabAtom'>>
} = {}) => {
  const store = createStore()
  const tabAtom = atom(tab)
  const routes: ReaderRoute[] = []
  const tagsSheets: ReaderTagsSheet[] = []
  const surfaced: ReaderPresentation[] = []
  const world: ReaderWorld = {
    platform,
    store,
    dispatch: jest.fn() as unknown as ReaderWorld['dispatch'],
    getState: () =>
      ({
        user: { bible: { wordAnnotations: { [annotation.id]: annotation } } },
      }) as unknown as ReturnType<ReaderWorld['getState']>,
    openVersionSelector: jest.fn(),
    navigate: route => void routes.push(route),
    openStudyObject: jest.fn(),
    openUrl: jest.fn(async () => undefined),
    notify: jest.fn(),
    openTags: sheet => void tagsSheets.push(sheet),
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
      biblicalEntitiesStatus: null,
      ...personalData,
      ...snapshot,
    }),
    surface: presentation => void surfaced.push(presentation),
  }
  const send = (intent: unknown) => handleReaderIntent({ tabId: 'tab-1', intent }, reader, world)
  return { send, routes, tagsSheets, surfaced }
}

const EVERY_SHEET: PersonalSheetIntent[] = [
  { kind: 'open-highlight-tags', verseIds: ['1-1-1'] },
  { kind: 'open-annotation-tags', annotationId: 'annotation-1' },
  { kind: 'open-verse-tags', verseKey: '1-1-1' },
  { kind: 'open-bookmark', bookmarkId: 'bookmark-1' },
  { kind: 'open-cross-version-annotations', verseKey: '1-1-2' },
  { kind: 'open-verse-relations', verseKey: '1-1-1' },
]

describe.each(['ios', 'web'] as const)('personal sheets (%s)', platform => {
  it('opens the tags sheet of highlighted verses', async () => {
    const { send, tagsSheets } = setup({ platform })

    await expect(
      send({ kind: 'open-highlight-tags', verseIds: ['1-1-1', '1-1-2'] })
    ).resolves.toEqual({ status: 'done' })
    expect(tagsSheets).toEqual([
      { mode: 'select', entity: 'highlights', ids: { '1-1-1': true, '1-1-2': true } },
    ])
  })

  it('names the tags sheet of a Word annotation after its stored words, which the page lacks', async () => {
    const { send, tagsSheets } = setup({ platform })

    await expect(
      send({ kind: 'open-annotation-tags', annotationId: 'annotation-1' })
    ).resolves.toEqual({ status: 'done' })
    expect(tagsSheets).toEqual([
      {
        mode: 'select',
        entity: 'wordAnnotations',
        id: 'annotation-1',
        title: 'Au commencement … Que',
      },
    ])
  })

  it('opens no tags sheet for a Word annotation the chapter does not show', async () => {
    const { send, tagsSheets } = setup({ platform })

    await expect(
      send({ kind: 'open-annotation-tags', annotationId: 'elsewhere' })
    ).resolves.toEqual({ status: 'done' })
    expect(tagsSheets).toEqual([])
  })

  it('surfaces the tags of a verse', async () => {
    const { send, surfaced } = setup({ platform })

    await send({ kind: 'open-verse-tags', verseKey: '1-1-4' })
    expect(surfaced).toEqual([{ kind: 'verse-tags', verseKey: '1-1-4' }])
  })

  it('surfaces a bookmark of the chapter', async () => {
    const { send, surfaced } = setup({ platform })

    await send({ kind: 'open-bookmark', bookmarkId: 'bookmark-1' })
    await send({ kind: 'open-bookmark', bookmarkId: 'bookmark-elsewhere' })
    expect(surfaced).toEqual([{ kind: 'bookmark', bookmark }])
  })

  it('surfaces the Word annotations of a verse in the versions not on screen', async () => {
    const { send, surfaced } = setup({ platform })

    await send({ kind: 'open-cross-version-annotations', verseKey: '1-1-2' })
    await send({ kind: 'open-cross-version-annotations', verseKey: '1-1-3' })
    expect(surfaced).toEqual([
      {
        kind: 'cross-version-annotations',
        verseKey: '1-1-2',
        versions: [{ version: 'KJV', count: 2 }],
      },
    ])
  })

  it('opens the Relations of a verse in the main version, whatever column it was touched in', async () => {
    const { send, routes } = setup({
      platform,
      tab: createTab({ parallelVersions: ['KJV'] }),
      reader: { parallelColumnVersions: ['KJV'] },
    })

    await send({ kind: 'open-verse-relations', verseKey: '1-1-5' })
    expect(routes).toEqual([
      getEntityRelationsRoute(createVerseEndpoint(['1-1-5'], undefined, 'LSG')),
    ])
  })

  it.each(EVERY_SHEET)('refuses $kind while the reader hides personal data', async intent => {
    const { send, routes, tagsSheets, surfaced } = setup({
      platform,
      reader: { hidesPersonalData: true },
    })

    await expect(send(intent)).resolves.toEqual({ status: 'refused', rule: 'personal-data' })
    expect([...routes, ...tagsSheets, ...surfaced]).toEqual([])
  })

  it('refuses a bookmark of a version shown only as interlinear', async () => {
    const interlinearBookmark = { ...bookmark, id: 'bookmark-bhs', version: 'BHS' }
    const { send, surfaced } = setup({
      platform,
      reader: {
        interlinearReadingVersions: ['BHS'],
        bookmarks: { 3: bookmark, 4: interlinearBookmark },
      },
    })

    await expect(send({ kind: 'open-bookmark', bookmarkId: 'bookmark-bhs' })).resolves.toEqual({
      status: 'refused',
      rule: 'interlinear-column',
    })
    await expect(send({ kind: 'open-bookmark', bookmarkId: 'bookmark-1' })).resolves.toEqual({
      status: 'done',
    })
    expect(surfaced).toEqual([{ kind: 'bookmark', bookmark }])
  })

  it.each([
    { kind: 'open-bookmark' },
    { kind: 'open-verse-tags', verseKey: '' },
    { kind: 'open-annotation-tags', annotationId: 3 },
    { kind: 'open-highlight-tags', verseIds: '1-1-1' },
  ])('rejects $kind without what it names', async intent => {
    const { send } = setup({ platform })

    await expect(send(intent)).resolves.toEqual({ status: 'rejected' })
  })
})
