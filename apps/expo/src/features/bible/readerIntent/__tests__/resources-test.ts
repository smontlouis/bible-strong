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

import type { ConfirmDialogOptions } from '~common/ConfirmDialog/types'
import { getBook } from '~helpers/bibleBookCatalog'
import { resourceQueryKeys } from '~helpers/resourceQueryKeys'
import { setSettingsContextualInformationDisplay } from '~redux/modules/user/settings'
import { isRepairingBibleDatabaseAtom } from '~state/bibleDatabaseRepair'
import type { BibleTab } from '~state/tabs'
import { INITIAL_ANNOTATION_SESSION_STATE } from '../../hooks/annotationSession'
import { handleReaderIntent } from '..'
import type {
  Reader,
  ReaderNotice,
  ReaderOfflineCopy,
  ReaderRoute,
  ReaderSnapshot,
  ReaderWorld,
  ResourceIntent,
} from '..'

const genesis = getBook(1)!

const tab: BibleTab = {
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
  },
}

const setup = ({
  platform = 'ios',
  reader: snapshot = {},
  world: worldOverrides = {},
}: {
  platform?: ReaderWorld['platform']
  reader?: Partial<Omit<ReaderSnapshot, 'tabAtom'>>
  world?: Partial<ReaderWorld>
} = {}) => {
  const store = createStore()
  const routes: ReaderRoute[] = []
  const notices: ReaderNotice[] = []
  const copies: ReaderOfflineCopy[] = []
  const refetched: (readonly unknown[])[] = []
  const dialogs: ConfirmDialogOptions[] = []
  const actions: unknown[] = []
  let confirmation = true
  const world: ReaderWorld = {
    platform,
    store,
    dispatch: ((action: unknown) => {
      actions.push(action)
      return action
    }) as ReaderWorld['dispatch'],
    getState: jest.fn() as unknown as ReaderWorld['getState'],
    openVersionSelector: jest.fn(),
    navigate: route => void routes.push(route),
    openStudyObject: jest.fn(),
    openUrl: jest.fn(async () => undefined),
    notify: notice => void notices.push(notice),
    openTags: jest.fn(),
    haptic: jest.fn(),
    confirm: async dialog => {
      dialogs.push(dialog)
      return confirmation
    },
    queueOfflineCopy: copy => void copies.push(copy),
    refetch: async queryKey => void refetched.push(queryKey),
    repairBibleDatabase: jest.fn(async () => undefined),
    t: key => key,
    ...worldOverrides,
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
    surface: jest.fn(),
  }
  const send = (intent: unknown) => handleReaderIntent({ tabId: 'tab-1', intent }, reader, world)
  return {
    send,
    world,
    store,
    routes,
    notices,
    copies,
    refetched,
    dialogs,
    actions,
    answer: (value: boolean) => {
      confirmation = value
    },
  }
}

const bibleContent = resourceQueryKeys.bibleContent()

describe('resources on the device', () => {
  it('queues the Offline copy of a missing Bible version', async () => {
    const { send, copies, refetched } = setup()

    await expect(send({ kind: 'install-bible-version', version: 'KJV' })).resolves.toEqual({
      status: 'done',
    })
    expect(copies).toEqual([{ kind: 'bible', version: 'KJV' }])
    expect(refetched).toEqual([])
  })

  it('tells the reader when the queue refuses a Bible version', async () => {
    const { send, notices } = setup({
      world: {
        queueOfflineCopy: () => {
          throw new Error('Unknown Bible version: XYZ')
        },
      },
    })

    await expect(send({ kind: 'install-bible-version', version: 'XYZ' })).resolves.toEqual({
      status: 'done',
    })
    expect(notices).toEqual([{ type: 'error', message: 'bible.error.unknown' }])
  })

  it('opens the downloads', async () => {
    const { send, routes } = setup()

    await expect(send({ kind: 'open-downloads' })).resolves.toEqual({ status: 'done' })
    expect(routes).toEqual([{ pathname: '/downloads' }])
  })

  it('repairs the Bible database, and says so', async () => {
    let repairingDuringRepair: boolean | undefined
    const { send, store, notices, refetched } = setup({
      world: {
        repairBibleDatabase: async () => {
          repairingDuringRepair = store.get(isRepairingBibleDatabaseAtom)
        },
      },
    })

    await expect(send({ kind: 'repair-bible-database' })).resolves.toEqual({ status: 'done' })
    expect(repairingDuringRepair).toBe(true)
    expect(store.get(isRepairingBibleDatabaseAtom)).toBe(false)
    expect(notices).toEqual([{ type: 'success', message: 'bible.error.databaseRecovered' }])
    expect(refetched).toEqual([])
  })

  it('says when the Bible database could not be repaired', async () => {
    const { send, store, notices } = setup({
      world: {
        repairBibleDatabase: async () => {
          throw new Error('locked')
        },
      },
    })

    await expect(send({ kind: 'repair-bible-database' })).resolves.toEqual({ status: 'done' })
    expect(store.get(isRepairingBibleDatabaseAtom)).toBe(false)
    expect(notices).toEqual([{ type: 'error', message: 'bible.error.databaseOpenFailed' }])
  })

  it('queues the biblical entities while they are not installed', async () => {
    for (const status of ['missing', 'core-missing', 'outdated', 'corrupt'] as const) {
      const { send, copies } = setup({ reader: { biblicalEntitiesStatus: status } })

      await expect(send({ kind: 'install-biblical-entities' })).resolves.toEqual({
        status: 'done',
      })
      expect(copies).toEqual([{ kind: 'biblical-entities' }])
    }
  })

  it('queues nothing once the entities are installed, or while the chapter hides them', async () => {
    for (const biblicalEntitiesStatus of ['available', null] as const) {
      const { send, copies } = setup({ reader: { biblicalEntitiesStatus } })

      await expect(send({ kind: 'install-biblical-entities' })).resolves.toEqual({
        status: 'done',
      })
      expect(copies).toEqual([])
    }
  })
})

describe('resources on the web', () => {
  it('reads the Bible text again instead of installing a version', async () => {
    const { send, copies, refetched } = setup({ platform: 'web' })

    await expect(send({ kind: 'install-bible-version', version: 'KJV' })).resolves.toEqual({
      status: 'done',
    })
    expect(refetched).toEqual([bibleContent])
    expect(copies).toEqual([])
  })

  it('reads the Bible text again instead of repairing a database', async () => {
    const { send, world, refetched, notices } = setup({ platform: 'web' })

    await expect(send({ kind: 'repair-bible-database' })).resolves.toEqual({ status: 'done' })
    expect(refetched).toEqual([bibleContent])
    expect(world.repairBibleDatabase).not.toHaveBeenCalled()
    expect(notices).toEqual([])
  })

  it('has no downloads to open and no entities to install', async () => {
    const { send, routes, copies } = setup({
      platform: 'web',
      reader: { biblicalEntitiesStatus: 'missing' },
    })

    await expect(send({ kind: 'open-downloads' })).resolves.toEqual({
      status: 'refused',
      rule: 'no-offline-copies',
    })
    await expect(send({ kind: 'install-biblical-entities' })).resolves.toEqual({
      status: 'refused',
      rule: 'no-offline-copies',
    })
    expect(routes).toEqual([])
    expect(copies).toEqual([])
  })
})

describe.each(['ios', 'android', 'web'] as const)('resources (%s)', platform => {
  it('reads the Bible text again on retry', async () => {
    const { send, refetched, copies } = setup({ platform })

    await expect(send({ kind: 'retry-bible-resource' })).resolves.toEqual({ status: 'done' })
    expect(refetched).toEqual([bibleContent])
    expect(copies).toEqual([])
  })

  it('hides the contextual information once the reader confirms it', async () => {
    const { send, dialogs, actions } = setup({ platform })

    await expect(send({ kind: 'hide-contextual-information' })).resolves.toEqual({
      status: 'done',
    })
    expect(dialogs).toEqual([
      {
        title: 'bible.chapterEntities.dismissTitle',
        message: 'bible.chapterEntities.dismissMessage',
        cancelLabel: 'Annuler',
        confirmLabel: 'bible.chapterEntities.dismissConfirm',
      },
    ])
    expect(actions).toEqual([setSettingsContextualInformationDisplay(false)])
  })

  it('keeps the contextual information when the reader cancels', async () => {
    const { send, dialogs, actions, answer } = setup({ platform })
    answer(false)

    await expect(send({ kind: 'hide-contextual-information' })).resolves.toEqual({
      status: 'done',
    })
    expect(dialogs).toHaveLength(1)
    expect(actions).toEqual([])
  })

  it('fails without throwing when the query cache fails', async () => {
    const { send } = setup({
      platform,
      world: {
        refetch: async () => {
          throw new Error('cache')
        },
      },
    })

    await expect(send({ kind: 'retry-bible-resource' })).resolves.toEqual({ status: 'failed' })
  })

  it('rejects an install that names no version', async () => {
    const { send, copies, refetched } = setup({ platform })

    await expect(send({ kind: 'install-bible-version' })).resolves.toEqual({
      status: 'rejected',
    })
    expect(copies).toEqual([])
    expect(refetched).toEqual([])
  })
})

// Every intent of the family is typed: a kind added to the union without a case fails here
const EVERY_RESOURCE_INTENT: ResourceIntent[] = [
  { kind: 'install-bible-version', version: 'LSG' },
  { kind: 'open-downloads' },
  { kind: 'repair-bible-database' },
  { kind: 'retry-bible-resource' },
  { kind: 'install-biblical-entities' },
  { kind: 'hide-contextual-information' },
]

it('refuses every resource intent sent for another Tab', async () => {
  const { world, copies, refetched, routes, dialogs } = setup()
  const reader: Reader = {
    now: () => ({ tabId: 'tab-2' }) as ReaderSnapshot,
    surface: jest.fn(),
  }
  for (const intent of EVERY_RESOURCE_INTENT) {
    await expect(handleReaderIntent({ tabId: 'tab-1', intent }, reader, world)).resolves.toEqual({
      status: 'refused',
      rule: 'stale-tab',
    })
  }
  expect([copies, refetched, routes, dialogs]).toEqual([[], [], [], []])
})
