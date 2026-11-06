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

import type { Verse } from '~common/types'
import { getBook } from '~helpers/bibleBookCatalog'
import {
  addWordAnnotationAction,
  removeWordAnnotationsInRangeAction,
  type WordAnnotation,
} from '~redux/modules/user/wordAnnotations'
import type { BibleTab } from '~state/tabs'
import {
  INITIAL_ANNOTATION_SESSION_STATE,
  enterAnnotationSession,
  type AnnotationSessionState,
} from '../../hooks/annotationSession'
import { handleReaderIntent } from '..'
import type { Reader, ReaderSnapshot, ReaderWorld } from '..'

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

const verse = (Verset: number, Texte: string, TextRevision?: string): Verse =>
  ({ Livre: 1, Chapitre: 1, Verset, Texte, ...(TextRevision && { TextRevision }) }) as Verse

const LSG = [
  verse(1, 'Au commencement, Dieu créa les cieux et la terre.', 'lsg-r1'),
  // A line break between two words of the text
  verse(2, 'La terre était informe et vide:\nil y avait des ténèbres', 'lsg-r1'),
  verse(3, 'Dieu dit: Que la lumière soit!', 'lsg-r1'),
]
const DBY = [
  verse(1, 'Au commencement Dieu créa les cieux et la terre.'),
  verse(2, 'Et la terre était désolation et vide,'),
]

/** Genesis 1 read in LSG beside DBY. */
const parallelReading = {
  tab: createTab({ parallelVersions: ['DBY'] }),
  reader: { parallelColumnVersions: ['DBY'], versesByVersion: { LSG, DBY } },
}

type Recorded = { type: string; payload: unknown }

const setup = ({
  platform = 'ios',
  tab = createTab(),
  session = INITIAL_ANNOTATION_SESSION_STATE,
  reader: snapshot = {},
}: {
  platform?: ReaderWorld['platform']
  tab?: BibleTab
  session?: AnnotationSessionState
  reader?: Partial<Omit<ReaderSnapshot, 'tabAtom' | 'annotationSession'>>
} = {}) => {
  const store = createStore()
  const tabAtom = atom(tab)
  const sessionAtom = atom(session)
  const actions: Recorded[] = []
  const dispatch = ((action: unknown) => {
    if (typeof action === 'function') return action(dispatch)
    actions.push(action as Recorded)
    return action
  }) as ReaderWorld['dispatch']
  const world: ReaderWorld = {
    platform,
    store,
    dispatch,
    getState: jest.fn() as unknown as ReaderWorld['getState'],
    openVersionSelector: jest.fn(),
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
      annotationMode: store.get(sessionAtom).enabled,
      annotationSession: sessionAtom,
      versesByVersion: { LSG },
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
    surface: jest.fn(),
  }
  return {
    tab: () => store.get(tabAtom),
    session: () => store.get(sessionAtom),
    actions,
    /** The Word annotations saved, as the user's data receives them. */
    annotations: () =>
      actions
        .filter(action => action.type === addWordAnnotationAction.type)
        .map(action => (action.payload as { annotation: WordAnnotation }).annotation),
    surface: reader.surface,
    send: (intent: unknown) => handleReaderIntent({ tabId: 'tab-1', intent }, reader, world),
  }
}

const create = (
  ranges: { verseKey: string; startWordIndex: number; endWordIndex: number }[],
  version?: string
) => ({
  kind: 'create-word-annotation',
  ranges,
  color: 'color2',
  type: 'underline',
  ...(version && { version }),
})

const selection = (version?: string) => ({
  start: { verseKey: '1-1-1', wordIndex: 1 },
  end: { verseKey: '1-1-1', wordIndex: 3 },
  ...(version && { version }),
})

describe.each(['ios', 'android', 'web'] as const)('annotate intents (%s)', platform => {
  describe('annotation mode', () => {
    it('is entered on the version and the verse touched, the selected verses let go', async () => {
      const reader = setup({
        platform,
        ...parallelReading,
        tab: createTab({
          parallelVersions: ['DBY'],
          selectedVerses: { '1-1-2': true },
          selectedVersesVersion: 'DBY',
        }),
      })

      await expect(
        reader.send({ kind: 'enter-annotation-mode', version: 'DBY', verseKey: '1-1-2' })
      ).resolves.toEqual({ status: 'done' })
      expect(reader.session()).toEqual({
        ...INITIAL_ANNOTATION_SESSION_STATE,
        enabled: true,
        version: 'DBY',
        entryVerseKey: '1-1-2',
      })
      expect(reader.tab().data.selectedVerses).toEqual({})
      expect(reader.tab().data.selectedVersesVersion).toBeUndefined()
      expect(reader.surface).not.toHaveBeenCalled()
    })

    it('is entered on the main version when the version named is not on screen', async () => {
      const reader = setup({ platform })

      await reader.send({ kind: 'enter-annotation-mode', version: 'DBY' })
      expect(reader.session()).toMatchObject({ enabled: true, version: 'LSG' })
      expect(reader.session().entryVerseKey).toBeUndefined()
    })

    it('is left, the session cleared', async () => {
      const reader = setup({ platform, session: enterAnnotationSession('LSG', '1-1-1') })

      await expect(reader.send({ kind: 'exit-annotation-mode' })).resolves.toEqual({
        status: 'done',
      })
      expect(reader.session()).toEqual(INITIAL_ANNOTATION_SESSION_STATE)
    })
  })

  describe('the words selected', () => {
    it('are kept, and move the session to the version they were selected in', async () => {
      const reader = setup({ platform, ...parallelReading, session: enterAnnotationSession('LSG') })

      await expect(
        reader.send({ kind: 'change-word-selection', selection: selection('DBY') })
      ).resolves.toEqual({ status: 'done' })
      expect(reader.session()).toMatchObject({
        version: 'DBY',
        hasSelection: true,
        selection: selection('DBY'),
      })

      await reader.send({ kind: 'change-word-selection', selection: null })
      expect(reader.session()).toMatchObject({
        version: 'DBY',
        hasSelection: false,
        selection: null,
      })
    })
  })

  describe('a Word annotation created', () => {
    it('reads its words from the verse text, and is picked', async () => {
      const reader = setup({ platform, session: enterAnnotationSession('LSG') })

      await expect(
        reader.send(create([{ verseKey: '1-1-1', startWordIndex: 2, endWordIndex: 4 }], 'LSG'))
      ).resolves.toEqual({ status: 'done' })

      const [annotation] = reader.annotations()
      expect(annotation).toMatchObject({
        version: 'LSG',
        color: 'color2',
        type: 'underline',
        textRevision: 'lsg-r1',
        ranges: [{ verseKey: '1-1-1', startWordIndex: 2, endWordIndex: 4, text: 'Dieu créa les' }],
      })
      expect(reader.session()).toMatchObject({
        selectedAnnotationId: annotation.id,
        hasSelection: false,
        selection: null,
      })
    })

    it('keeps the line break between its words, across two verses', async () => {
      const reader = setup({ platform, session: enterAnnotationSession('LSG') })

      await reader.send(
        create([
          { verseKey: '1-1-1', startWordIndex: 7, endWordIndex: 8 },
          { verseKey: '1-1-2', startWordIndex: 0, endWordIndex: 7 },
        ])
      )

      expect(reader.annotations()[0].ranges).toEqual([
        { verseKey: '1-1-1', startWordIndex: 7, endWordIndex: 8, text: 'la terre.' },
        {
          verseKey: '1-1-2',
          startWordIndex: 0,
          endWordIndex: 7,
          text: 'La terre était informe et vide:\nil y',
        },
      ])
    })

    it('reads its words in the parallel column it was selected in', async () => {
      const reader = setup({ platform, ...parallelReading, session: enterAnnotationSession('DBY') })

      await reader.send(create([{ verseKey: '1-1-2', startWordIndex: 4, endWordIndex: 6 }], 'DBY'))

      const [annotation] = reader.annotations()
      expect(annotation.version).toBe('DBY')
      expect(annotation.textRevision).toBeUndefined()
      expect(annotation.ranges).toEqual([
        { verseKey: '1-1-2', startWordIndex: 4, endWordIndex: 6, text: 'désolation et vide,' },
      ])
    })

    it.each([
      [
        'a verse the reader does not hold',
        { verseKey: '1-1-9', startWordIndex: 0, endWordIndex: 1 },
      ],
      [
        'a word past the end of the verse',
        { verseKey: '1-1-3', startWordIndex: 2, endWordIndex: 9 },
      ],
    ])('is refused over %s, and nothing is saved', async (_, range) => {
      const session = enterAnnotationSession('LSG')
      const reader = setup({ platform, session })

      await expect(
        reader.send(create([{ verseKey: '1-1-1', startWordIndex: 0, endWordIndex: 1 }, range]))
      ).resolves.toEqual({ status: 'refused', rule: 'words-not-on-screen' })
      expect(reader.actions).toEqual([])
      expect(reader.session()).toEqual(session)
    })

    it('is refused when the column of its version holds no verses yet', async () => {
      const reader = setup({
        platform,
        ...parallelReading,
        reader: { parallelColumnVersions: ['DBY'], versesByVersion: { LSG } },
      })

      await expect(
        reader.send(create([{ verseKey: '1-1-1', startWordIndex: 0, endWordIndex: 1 }], 'DBY'))
      ).resolves.toEqual({ status: 'refused', rule: 'words-not-on-screen' })
      expect(reader.actions).toEqual([])
    })

    it('is rejected when its ranges are not word ranges', async () => {
      const reader = setup({ platform })

      await expect(reader.send(create([]))).resolves.toEqual({ status: 'rejected' })
      await expect(
        reader.send(create([{ verseKey: '1-1-1', startWordIndex: 3, endWordIndex: 1 }]))
      ).resolves.toEqual({ status: 'rejected' })
      await expect(
        reader.send({
          ...create([{ verseKey: '1-1-1', startWordIndex: 0, endWordIndex: 1 }]),
          type: 'bold',
        })
      ).resolves.toEqual({ status: 'rejected' })
      expect(reader.actions).toEqual([])
    })
  })

  describe('words erased', () => {
    it('erase the Word annotations over them in the version they were selected in', async () => {
      const reader = setup({
        platform,
        ...parallelReading,
        session: {
          ...enterAnnotationSession('DBY'),
          hasSelection: true,
          selection: selection('DBY'),
        },
      })
      const { start, end } = selection()

      await expect(
        reader.send({ kind: 'erase-word-annotations', start, end, version: 'DBY' })
      ).resolves.toEqual({ status: 'done' })
      expect(reader.actions).toEqual([removeWordAnnotationsInRangeAction('DBY', start, end)])
      expect(reader.session()).toMatchObject({ hasSelection: false, selection: null })
    })
  })

  describe('a Word annotation picked', () => {
    it('becomes the annotation of the session, then none', async () => {
      const reader = setup({
        platform,
        session: { ...enterAnnotationSession('LSG'), hasSelection: true, selection: selection() },
      })

      await reader.send({ kind: 'select-word-annotation', annotationId: 'annotation-1' })
      expect(reader.session()).toMatchObject({
        selectedAnnotationId: 'annotation-1',
        hasSelection: false,
        selection: null,
      })

      await reader.send({ kind: 'select-word-annotation', annotationId: null })
      expect(reader.session().selectedAnnotationId).toBeNull()
    })
  })

  describe('personal Bible data', () => {
    const { start, end } = selection()
    const intents = [
      { kind: 'enter-annotation-mode', version: 'LSG', verseKey: '1-1-1' },
      { kind: 'exit-annotation-mode' },
      { kind: 'change-word-selection', selection: selection('LSG') },
      create([{ verseKey: '1-1-1', startWordIndex: 0, endWordIndex: 1 }], 'LSG'),
      { kind: 'erase-word-annotations', start, end, version: 'LSG' },
      { kind: 'select-word-annotation', annotationId: 'annotation-1' },
    ]

    it.each(intents)('refuses $kind while the reader hides it', async intent => {
      const session = enterAnnotationSession('LSG')
      const reader = setup({ platform, session, reader: { hidesPersonalData: true } })

      await expect(reader.send(intent)).resolves.toEqual({
        status: 'refused',
        rule: 'personal-data',
      })
      expect(reader.session()).toEqual(session)
      expect(reader.actions).toEqual([])
    })

    it.each(
      intents.filter(
        intent => intent.kind !== 'exit-annotation-mode' && intent.kind !== 'select-word-annotation'
      )
    )('refuses $kind in a version shown only in interlinear presentations', async intent => {
      const session = enterAnnotationSession('LSG')
      const reader = setup({
        platform,
        session,
        reader: { interlinearReadingVersions: ['LSG'], parallelColumnVersions: ['DBY'] },
      })

      await expect(reader.send(intent)).resolves.toEqual({
        status: 'refused',
        rule: 'interlinear-column',
      })
      expect(reader.session()).toEqual(session)
      expect(reader.actions).toEqual([])
    })
  })
})
