import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'

import BibleOfflineDetailsSheet from '../VersionSelectorSheet/BibleOfflineDetailsSheet'

const mockLocalAvailability = jest.fn()
const mockHybridStrongAvailability = jest.fn()

jest.mock('@tanstack/react-query', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return {
    useQuery: ({
      queryFn,
      queryKey,
    }: {
      queryFn: () => Promise<unknown>
      queryKey: readonly unknown[]
    }) => {
      const [data, setData] = ReactModule.useState<unknown>()
      const stableQueryKey = JSON.stringify(queryKey)
      ReactModule.useEffect(() => {
        void queryFn().then(setData)
        // The test query client reruns only when the public query identity changes.
      }, [stableQueryKey])
      return { data, isError: false, refetch: jest.fn() }
    },
  }
})

jest.mock('@emotion/react', () => ({
  useTheme: () => ({
    colors: { reverse: 'white', border: 'grey', primary: 'blue' },
  }),
}))

jest.mock('jotai/react', () => ({ useAtomValue: () => 0 }))
jest.mock('jotai/vanilla', () => ({ getDefaultStore: () => ({ set: jest.fn() }) }))

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'fr' },
  }),
}))

jest.mock('react-native', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return {
    Alert: { alert: jest.fn() },
    Platform: { OS: 'ios' },
    Switch: (props: Record<string, unknown>) => ReactModule.createElement('Switch', props),
  }
})

jest.mock('~common/sheet', () => ({
  Sheet: ({ children }: React.PropsWithChildren) => children,
  SheetScrollView: ({ children }: React.PropsWithChildren) => children,
}))

jest.mock('~common/ui/Box', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return {
    __esModule: true,
    default: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      ReactModule.createElement('Box', props, children),
    TouchableBox: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      ReactModule.createElement('TouchableBox', props, children),
  }
})

jest.mock('~common/ui/Button', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    ReactModule.createElement('Button', props, children)
})

jest.mock('~common/ui/Icon', () => ({ FeatherIcon: () => null }))
jest.mock('~common/ui/Progress', () => () => null)
jest.mock('~common/ui/Text', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    ReactModule.createElement('Text', props, children)
})

jest.mock('~features/resources/resourceAccess', () => ({
  useResourceAccess: () => ({
    offlineCopies: {
      isAvailable: async () => true,
      getStrongBibleAvailability: mockLocalAvailability,
    },
    strongBible: { getAvailability: mockHybridStrongAvailability },
  }),
}))

jest.mock('~helpers/bibleBookCatalog', () => ({ getBooksForCanon: () => [] }))
jest.mock('~helpers/downloadItemFactory', () => ({
  createBibleDownloadItem: () => ({ id: 'bible:LSG' }),
  createInterlinearSidecarDownloadPlan: jest.fn(),
  createStrongSidecarDownloadPlan: jest.fn(),
}))
jest.mock('~helpers/deleteDownloadedItem', () => ({
  createDownloadedItemDeletionPlan: jest.fn(),
  deleteDownloadedItem: jest.fn(),
}))
jest.mock('~helpers/downloadManager', () => ({
  downloadManager: { enqueue: jest.fn(), cancel: jest.fn(), retry: jest.fn() },
}))
jest.mock('~helpers/mobileResourceCatalog', () => ({
  resourceArtifactUrl: (path: string) => path,
  getMobileResourceCatalogEntry: (id: string) => ({
    archiveBytes: id === 'strong-bible-index:LSG' ? 500 : 1_000,
    installedBytes: id === 'strong-bible-index:LSG' ? 1_000 : 2_000,
  }),
}))
jest.mock('~helpers/useConnection', () => ({ __esModule: true, default: () => true }))
jest.mock('~helpers/useDownloadQueue', () => ({ useDownloadItemStatus: () => undefined }))
jest.mock('~i18n', () => ({ getLanguage: () => 'fr' }))
jest.mock('~state/app', () => ({
  bibleDataRefreshSignalAtom: Symbol('bibleDataRefreshSignalAtom'),
  installedVersionsSignalAtom: Symbol('installedVersionsSignalAtom'),
}))
jest.mock('~state/downloadQueue', () => ({
  downloadCompletionSignalAtom: Symbol('downloadCompletionSignalAtom'),
  getDownloadItemProgress: () => 0,
}))

describe('BibleOfflineDetailsSheet', () => {
  let renderer: ReactTestRenderer
  let consoleError: jest.SpyInstance

  beforeEach(() => {
    ;(
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true
    consoleError = jest.spyOn(console, 'error').mockImplementation((message, ...args) => {
      if (typeof message === 'string' && message.startsWith('react-test-renderer is deprecated')) {
        return
      }
      console.warn(message, ...args)
    })
    mockLocalAvailability.mockReset().mockResolvedValue({
      status: 'missing',
      resource: { kind: 'strong-bible-index', versionId: 'LSG' },
    })
    mockHybridStrongAvailability.mockReset().mockResolvedValue({ status: 'available' })
  })

  afterEach(() => {
    act(() => renderer?.unmount())
    consoleError.mockRestore()
  })

  it('offers the Strong index when it is readable online but absent from the device', async () => {
    await act(async () => {
      renderer = create(
        <BibleOfflineDetailsSheet
          sheetRef={{ current: null }}
          version={{
            id: 'LSG',
            name: 'Louis Segond',
            language: 'fr',
            readingProfile: 'word-for-word',
          }}
        />
      )
    })

    expect(renderer.root.findByType('Switch' as never)).toBeTruthy()
    expect(mockLocalAvailability).toHaveBeenCalledWith('LSG')
  })
})
