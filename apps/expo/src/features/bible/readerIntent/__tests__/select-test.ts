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

import { getBook } from '~helpers/bibleBookCatalog'
import type { BibleTab } from '~state/tabs'
import { INITIAL_ANNOTATION_SESSION_STATE } from '../../hooks/annotationSession'
import { handleReaderIntent } from '..'
import type { Reader, ReaderPresentation, ReaderSnapshot, ReaderWorld } from '..'

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

/** Genesis 1 read in LSG beside DBY. */
const parallelReading = {
  tab: createTab({ parallelVersions: ['DBY'] }),
  reader: { parallelColumnVersions: ['DBY'] },
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
  const surfaced: ReaderPresentation[] = []
  const haptics: Parameters<ReaderWorld['haptic']>[0][] = []
  const world: ReaderWorld = {
    platform,
    store,
    dispatch: jest.fn() as unknown as ReaderWorld['dispatch'],
    openVersionSelector: jest.fn(),
    navigate: jest.fn(),
    openStudyObject: jest.fn(),
    openUrl: jest.fn(async () => undefined),
    notify: jest.fn(),
    openTags: jest.fn(),
    haptic: feedback => void haptics.push(feedback),
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
    tab: () => store.get(tabAtom),
    selection: () => {
      const { selectedVerses, selectedVersesVersion } = store.get(tabAtom).data
      return { selectedVerses, selectedVersesVersion }
    },
    haptics,
    surfaced,
    send: (intent: unknown) => handleReaderIntent({ tabId: 'tab-1', intent }, reader, world),
  }
}

const toggle = (verseKey: string, version?: string) => ({
  kind: 'toggle-selected-verse',
  verseKey,
  ...(version && { version }),
})

describe.each(['ios', 'android', 'web'] as const)('select intents (%s)', platform => {
  describe('a verse tapped', () => {
    it('is selected in the main version, then unselected by a second tap', async () => {
      const reader = setup({ platform })

      await expect(reader.send(toggle('1-1-2', 'LSG'))).resolves.toEqual({ status: 'done' })
      expect(reader.selection()).toEqual({
        selectedVerses: { '1-1-2': true },
        selectedVersesVersion: undefined,
      })
      await expect(reader.send(toggle('1-1-3', 'LSG'))).resolves.toEqual({ status: 'done' })
      await expect(reader.send(toggle('1-1-2', 'LSG'))).resolves.toEqual({ status: 'done' })
      expect(reader.selection().selectedVerses).toEqual({ '1-1-3': true })
      expect(reader.surfaced).toEqual([])
    })

    it('is selected in the parallel column it was tapped in', async () => {
      const reader = setup({ platform, ...parallelReading })

      await expect(reader.send(toggle('1-1-2', 'DBY'))).resolves.toEqual({ status: 'done' })
      expect(reader.selection()).toEqual({
        selectedVerses: { '1-1-2': true },
        selectedVersesVersion: 'DBY',
      })
    })

    it('in another version starts a new selection there instead of unselecting the verse', async () => {
      const reader = setup({
        platform,
        tab: createTab({
          parallelVersions: ['DBY'],
          selectedVerses: { '1-1-1': true, '1-1-2': true },
        }),
        reader: parallelReading.reader,
      })

      await expect(reader.send(toggle('1-1-2', 'DBY'))).resolves.toEqual({ status: 'done' })
      expect(reader.selection()).toEqual({
        selectedVerses: { '1-1-2': true },
        selectedVersesVersion: 'DBY',
      })
      await expect(reader.send(toggle('1-1-2', 'LSG'))).resolves.toEqual({ status: 'done' })
      expect(reader.selection()).toEqual({
        selectedVerses: { '1-1-2': true },
        selectedVersesVersion: undefined,
      })
    })

    it('in a version no column shows is selected in the main version', async () => {
      const reader = setup({ platform, ...parallelReading })

      await reader.send(toggle('1-1-2', 'DBY'))
      await expect(reader.send(toggle('1-1-4', 'KJV'))).resolves.toEqual({ status: 'done' })
      expect(reader.selection()).toEqual({
        selectedVerses: { '1-1-4': true },
        selectedVersesVersion: undefined,
      })
      await expect(reader.send(toggle('1-1-4'))).resolves.toEqual({ status: 'done' })
      expect(reader.selection().selectedVerses).toEqual({})
    })

    it('gives a selection feedback under the finger on iOS only', async () => {
      const reader = setup({ platform })

      await reader.send(toggle('1-1-2', 'LSG'))
      await reader.send(toggle('1-1-2', 'LSG'))
      expect(reader.haptics).toEqual(platform === 'ios' ? ['selection', 'selection'] : [])
    })
  })

  describe('a tap away from the text', () => {
    it('clears the selection and its version', async () => {
      const reader = setup({
        platform,
        tab: createTab({
          parallelVersions: ['DBY'],
          selectedVerses: { '1-1-1': true, '1-1-2': true },
          selectedVersesVersion: 'DBY',
        }),
        reader: parallelReading.reader,
      })

      await expect(reader.send({ kind: 'clear-selected-verses' })).resolves.toEqual({
        status: 'done',
      })
      expect(reader.selection()).toEqual({ selectedVerses: {}, selectedVersesVersion: undefined })
      expect(reader.haptics).toEqual([])
    })
  })

  describe('personal Bible data', () => {
    it('selects nothing while every column shows an interlinear presentation', async () => {
      const tab = createTab({ selectedVerses: { '1-1-1': true } })
      const reader = setup({ platform, tab, reader: { hidesPersonalData: true } })

      await expect(reader.send(toggle('1-1-2', 'LSG'))).resolves.toEqual({
        status: 'refused',
        rule: 'personal-data',
      })
      await expect(reader.send({ kind: 'clear-selected-verses' })).resolves.toEqual({
        status: 'refused',
        rule: 'personal-data',
      })
      expect(reader.tab()).toBe(tab)
      expect(reader.haptics).toEqual([])
    })

    it('selects nothing in a version shown only in an interlinear presentation', async () => {
      const tab = createTab({ parallelVersions: ['DBY'] })
      const reader = setup({
        platform,
        tab,
        reader: { parallelColumnVersions: ['DBY'], interlinearReadingVersions: ['DBY'] },
      })

      await expect(reader.send(toggle('1-1-2', 'DBY'))).resolves.toEqual({
        status: 'refused',
        rule: 'interlinear-column',
      })
      expect(reader.tab()).toBe(tab)
      expect(reader.haptics).toEqual([])

      // The column beside it keeps its text, and its verses.
      await expect(reader.send(toggle('1-1-2', 'LSG'))).resolves.toEqual({ status: 'done' })
      expect(reader.selection().selectedVerses).toEqual({ '1-1-2': true })
    })
  })

  it('rejects a verse tapped without its key', async () => {
    const tab = createTab()
    const reader = setup({ platform, tab })

    await expect(reader.send({ kind: 'toggle-selected-verse', version: 'LSG' })).resolves.toEqual({
      status: 'rejected',
    })
    await expect(
      reader.send({ kind: 'toggle-selected-verse', verseKey: '1-1-2', version: 3 })
    ).resolves.toEqual({ status: 'rejected' })
    expect(reader.tab()).toBe(tab)
  })
})
