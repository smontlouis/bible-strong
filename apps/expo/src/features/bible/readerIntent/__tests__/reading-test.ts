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
import type { BibleVersionCoverage } from '~helpers/biblesDb'
import { appLogger } from '~helpers/agentObservability'
import type { BibleRouteNavigationAdapter } from '~state/bibleRouteNavigation'
import { isFullScreenBibleAtom } from '~state/app'
import { savedParallelVersionsAtom, type BibleTab } from '~state/tabs'
import { INITIAL_ANNOTATION_SESSION_STATE } from '../../hooks/annotationSession'
import { handleReaderIntent } from '..'
import type { Reader, ReaderPresentation, ReaderSnapshot, ReaderWorld } from '..'

const genesis = getBook(1)!
const exodus = getBook(2)!

const createTab = (data: Partial<BibleTab['data']> = {}): BibleTab => ({
  id: 'tab-1',
  title: 'Genèse 1',
  isRemovable: true,
  type: 'bible',
  data: {
    selectedVersion: 'LSG',
    selectedBook: genesis,
    selectedChapter: 1,
    selectedVerse: 4,
    parallelVersions: [],
    temp: { selectedBook: genesis, selectedChapter: 1, selectedVerse: 4 },
    selectedVerses: {},
    selectionMode: 'grid',
    isSelectionMode: undefined,
    ...data,
  },
})

type VersionSelectorRequest = Parameters<ReaderWorld['openVersionSelector']>[0]

const setup = ({
  platform = 'ios',
  tab = createTab(),
  reader: snapshot = {},
  routes,
  openVersionSelector,
}: {
  platform?: ReaderWorld['platform']
  tab?: BibleTab
  reader?: Partial<Omit<ReaderSnapshot, 'tabAtom'>>
  routes?: BibleRouteNavigationAdapter
  openVersionSelector?: (request: VersionSelectorRequest) => void
} = {}) => {
  const store = createStore()
  const tabAtom = atom(tab)
  const surfaced: ReaderPresentation[] = []
  const versionSelectors: VersionSelectorRequest[] = []
  const world: ReaderWorld = {
    platform,
    store,
    dispatch: jest.fn() as unknown as ReaderWorld['dispatch'],
    routes,
    openVersionSelector: openVersionSelector ?? (request => void versionSelectors.push(request)),
    navigate: jest.fn(),
    openStudyObject: jest.fn(),
    openUrl: jest.fn(async () => undefined),
    notify: jest.fn(),
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
    store,
    tab: () => store.get(tabAtom),
    surfaced,
    versionSelectors,
    send: (intent: unknown, tabId = 'tab-1') =>
      handleReaderIntent({ tabId, intent }, reader, world),
    sendMessage: (message: unknown) => handleReaderIntent(message, reader, world),
  }
}

const createRoutes = () =>
  ({
    openChapter: jest.fn(),
    replaceWithChapter: jest.fn(),
    changeVersion: jest.fn(),
    changeStrongMode: jest.fn(),
  }) satisfies BibleRouteNavigationAdapter

describe.each(['ios', 'web'] as const)('reading intents (%s)', platform => {
  describe('chapter', () => {
    it('opens the next chapter at its first verse, out of any focus', async () => {
      const reader = setup({ platform })

      await expect(reader.send({ kind: 'next-chapter' })).resolves.toEqual({ status: 'done' })
      expect(reader.tab().data).toMatchObject({
        selectedBook: genesis,
        selectedChapter: 2,
        selectedVerse: 1,
        focusVerses: undefined,
        temp: { selectedBook: genesis, selectedChapter: 2, selectedVerse: 1 },
      })
    })

    it('opens the previous chapter, across books', async () => {
      const reader = setup({
        platform,
        tab: createTab({ selectedBook: exodus, selectedChapter: 1 }),
      })

      await expect(reader.send({ kind: 'previous-chapter' })).resolves.toEqual({ status: 'done' })
      expect(reader.tab().data).toMatchObject({ selectedBook: genesis, selectedChapter: 50 })
    })

    it('follows the chapters the version holds', async () => {
      const coverage: BibleVersionCoverage = {
        books: [1],
        chaptersByBook: { 1: [1, 3] },
        verseCountByBookChapter: {},
      }
      const reader = setup({ platform, reader: { coverage } })

      await expect(reader.send({ kind: 'next-chapter' })).resolves.toEqual({ status: 'done' })
      expect(reader.tab().data.selectedChapter).toBe(3)
    })

    it('refuses a chapter the version does not hold', async () => {
      const tab = createTab()
      const reader = setup({ platform, tab })

      await expect(reader.send({ kind: 'previous-chapter' })).resolves.toEqual({
        status: 'refused',
        rule: 'no-chapter',
      })
      expect(reader.tab()).toBe(tab)
    })

    it('keeps the chapter of a focus', async () => {
      const tab = createTab({ focusVerses: [3], contextDisplayMode: 'focused' })
      const reader = setup({ platform, tab })

      await expect(reader.send({ kind: 'next-chapter' })).resolves.toEqual({
        status: 'refused',
        rule: 'focus',
      })
      expect(reader.tab()).toBe(tab)
    })

    it('keeps the chapter in annotation mode', async () => {
      const tab = createTab()
      const reader = setup({ platform, tab, reader: { annotationMode: true } })

      await expect(reader.send({ kind: 'previous-chapter' })).resolves.toEqual({
        status: 'refused',
        rule: 'annotation-mode',
      })
      expect(reader.tab()).toBe(tab)
    })

    it('keeps the reader within the passage of a plan', async () => {
      const tab = createTab({ planPassage: { book: 1, startChapter: 1, endChapter: 1 } })
      const reader = setup({ platform, tab })

      await expect(reader.send({ kind: 'next-chapter' })).resolves.toEqual({
        status: 'refused',
        rule: 'plan-passage',
      })
      expect(reader.tab()).toBe(tab)
    })

    it('moves within a plan passage of several chapters', async () => {
      const reader = setup({
        platform,
        tab: createTab({ planPassage: { book: 1, startChapter: 1, endChapter: 2 } }),
      })

      await expect(reader.send({ kind: 'next-chapter' })).resolves.toEqual({ status: 'done' })
      expect(reader.tab().data.selectedChapter).toBe(2)
    })

    it('changes the route of a public Bible page instead of the Tab', async () => {
      const routes = createRoutes()
      const tab = createTab()
      const reader = setup({ platform, tab, routes })

      await expect(reader.send({ kind: 'next-chapter' })).resolves.toEqual({ status: 'done' })
      expect(routes.openChapter).toHaveBeenCalledWith(genesis, 2)
      expect(reader.tab()).toBe(tab)
    })
  })

  describe('controls', () => {
    it('hides the controls, then shows them again', async () => {
      const reader = setup({ platform })

      await expect(reader.send({ kind: 'hide-controls' })).resolves.toEqual({ status: 'done' })
      expect(reader.store.get(isFullScreenBibleAtom)).toBe(true)
      await expect(reader.send({ kind: 'show-controls' })).resolves.toEqual({ status: 'done' })
      expect(reader.store.get(isFullScreenBibleAtom)).toBe(false)
    })

    it('leaves the controls of a form sheet alone', async () => {
      const reader = setup({ platform, reader: { isFormSheet: true } })
      reader.store.set(isFullScreenBibleAtom, true)

      await expect(reader.send({ kind: 'show-controls' })).resolves.toEqual({
        status: 'refused',
        rule: 'form-sheet',
      })
      reader.store.set(isFullScreenBibleAtom, false)
      await expect(reader.send({ kind: 'hide-controls' })).resolves.toEqual({
        status: 'refused',
        rule: 'form-sheet',
      })
      expect(reader.store.get(isFullScreenBibleAtom)).toBe(false)
    })

    it('keeps the controls visible on a wide screen, where they can still be shown', async () => {
      const reader = setup({ platform, reader: { keepControlsVisible: true } })

      await expect(reader.send({ kind: 'hide-controls' })).resolves.toEqual({
        status: 'refused',
        rule: 'controls-kept-visible',
      })
      expect(reader.store.get(isFullScreenBibleAtom)).toBe(false)
      await expect(reader.send({ kind: 'show-controls' })).resolves.toEqual({ status: 'done' })
    })
  })

  describe('plan day', () => {
    it('goes on to the next element of the plan day', async () => {
      const reader = setup({ platform, reader: { hasPlanDayStep: true } })

      await expect(reader.send({ kind: 'plan-day-step' })).resolves.toEqual({ status: 'done' })
      expect(reader.surfaced).toEqual([{ kind: 'plan-day-step' }])
    })

    it('refuses a step when the passage leads nowhere', async () => {
      const reader = setup({ platform })

      await expect(reader.send({ kind: 'plan-day-step' })).resolves.toEqual({
        status: 'refused',
        rule: 'no-plan-day-step',
      })
      expect(reader.surfaced).toEqual([])
    })
  })

  describe('columns', () => {
    it('chooses the version of the main column', async () => {
      const reader = setup({ platform, tab: createTab({ parallelVersions: ['KJV'] }) })

      await expect(reader.send({ kind: 'choose-column-version', column: 0 })).resolves.toEqual({
        status: 'done',
      })
      expect(reader.versionSelectors).toHaveLength(1)
      const [{ actions, data, parallelVersionIndex }] = reader.versionSelectors
      expect(parallelVersionIndex).toBeUndefined()
      expect(data).toBe(reader.tab().data)

      actions.setSelectedVersion('NBS')
      expect(reader.tab().data.selectedVersion).toBe('NBS')
    })

    it('chooses the version of a parallel column, which starts without a text mode', async () => {
      const reader = setup({
        platform,
        tab: createTab({
          parallelVersions: ['KJV', 'NBS'],
          parallelTextModes: [
            { version: 'KJV', strongMode: 'hidden' },
            { version: 'NBS', strongMode: 'visible' },
          ],
        }),
      })

      await reader.send({ kind: 'choose-column-version', column: 2 })
      const [{ actions, parallelVersionIndex }] = reader.versionSelectors
      expect(parallelVersionIndex).toBe(1)

      actions.setParallelVersion('DBY', 1)
      expect(reader.tab().data.parallelVersions).toEqual(['KJV', 'DBY'])
      expect(reader.tab().data.parallelTextModes?.[1]).toMatchObject({
        version: 'DBY',
        strongMode: 'hidden',
      })
      expect(reader.store.get(savedParallelVersionsAtom)).toEqual(['KJV', 'DBY'])
    })

    it.each(['strong', 'interlinear'] as const)('opens the %s mode of a column', async mode => {
      const reader = setup({ platform })

      await expect(
        reader.send({ kind: 'open-column-text-mode', mode, column: 1 })
      ).resolves.toEqual({ status: 'done' })
      expect(reader.surfaced).toEqual([{ kind: 'column-text-mode', mode, column: 1 }])
    })
  })
})

describe('the envelope of a reader intent', () => {
  beforeEach(() => jest.clearAllMocks())

  it('refuses an intent sent for a Tab no longer on screen', async () => {
    const tab = createTab()
    const reader = setup({ tab })

    await expect(reader.send({ kind: 'next-chapter' }, 'tab-2')).resolves.toEqual({
      status: 'refused',
      rule: 'stale-tab',
    })
    await expect(reader.send({ kind: 'plan-day-step' }, 'tab-2')).resolves.toEqual({
      status: 'refused',
      rule: 'stale-tab',
    })
    expect(reader.tab()).toBe(tab)
    expect(reader.surfaced).toEqual([])
  })

  it.each([
    ['no message', undefined],
    ['no Tab', { intent: { kind: 'next-chapter' } }],
    ['an unknown kind', { tabId: 'tab-1', intent: { kind: 'execute-arbitrary-code' } }],
    [
      'a column out of range',
      { tabId: 'tab-1', intent: { kind: 'choose-column-version', column: -1 } },
    ],
    [
      'an unknown text mode',
      { tabId: 'tab-1', intent: { kind: 'open-column-text-mode', mode: 'audio', column: 0 } },
    ],
  ])('rejects a message with %s', async (_, message) => {
    const reader = setup()

    await expect(reader.sendMessage(message)).resolves.toEqual({ status: 'rejected' })
    expect(reader.surfaced).toEqual([])
    expect(reader.versionSelectors).toEqual([])
    expect(appLogger.captureError).toHaveBeenCalledWith(
      'webview',
      'reader_intent.rejected',
      expect.any(Error),
      expect.any(Object)
    )
  })

  it('reports an effect that fails, without throwing', async () => {
    const reader = setup({
      openVersionSelector: () => {
        throw new Error('sheet unavailable')
      },
    })

    await expect(reader.send({ kind: 'choose-column-version', column: 0 })).resolves.toEqual({
      status: 'failed',
    })
    expect(appLogger.captureError).toHaveBeenCalledWith(
      'webview',
      'reader_intent.failed',
      expect.any(Error),
      { kind: 'choose-column-version' }
    )
  })
})
