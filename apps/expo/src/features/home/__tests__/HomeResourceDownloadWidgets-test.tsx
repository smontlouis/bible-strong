import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { downloadManager } from '~helpers/downloadManager'
import NaveOfTheDay from '../NaveOfTheDay'
import StrongOfTheDay from '../StrongOfTheDay'
import WordOfTheDay from '../WordOfTheDay'
import { loadDictionaryWidgetEntry, selectDictionaryWidgetWork } from '../dictionaryWidgetEntry'
import { KNOWN_DICTIONARY_WORKS } from '~features/resources/dictionaryAccess'
import { useOfflineResourceRegistry } from '~features/resources/useOfflineResourceRegistry'
jest.mock('react-native', () => ({ Platform: { OS: 'web' } }))
jest.mock('~themes/ThemeProvider', () => ({
  useTheme: () => jest.requireActual('../../../../test/themeFixture').themeFixture,
}))

let mockIsConnected = true
let mockAvailabilityReason: 'offline-copy-required' | 'invalid-offline-copy' =
  'offline-copy-required'
let mockStrongAvailabilityStatus: 'missing' | 'incompatible' | 'corrupt' = 'missing'
let mockAvailabilityError = false
let mockInstalledDictionaryWorks: string[] = []
let mockDictionaryEntry: { id: number; word: string; normalizedWord: string } | undefined
const mockQueryKeys: unknown[][] = []
const mockAvailabilityRefetch = jest.fn()
const mockContentRefetch = jest.fn()

jest.mock('~features/resources/dictionaryAccess', () => ({
  KNOWN_DICTIONARY_WORKS: [
    {
      resource: { work: 'westphal', language: 'fr' },
      resourceId: 'WESTPHAL',
      title: 'Dictionnaire encyclopédique de la Bible',
    },
    { resource: { work: 'bost', language: 'fr' }, resourceId: 'BOST', title: 'Bost' },
    { resource: { work: 'calmet', language: 'fr' }, resourceId: 'CALMET', title: 'Calmet' },
    {
      resource: { work: 'easton-webster', language: 'en' },
      resourceId: 'EASTON_WEBSTER',
      title: 'Easton',
    },
  ],
}))
jest.mock('~features/resources/useOfflineResourceRegistry', () => ({
  useOfflineResourceRegistry: () => ({
    resources: new Map(
      mockInstalledDictionaryWorks.map(work => [
        work,
        {
          resource: { kind: 'dictionary', work, language: 'fr' },
          availability: { status: 'available' },
        },
      ])
    ),
  }),
  getOfflineResourceQuerySignal: () => [],
}))

jest.mock('expo-linear-gradient', () => ({ LinearGradient: () => null }))

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

jest.mock('~common/Link', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return (props: Record<string, unknown>) => ReactModule.createElement('Link', props)
})
jest.mock('~common/NaveIcon', () => () => null)
jest.mock('~common/LexiqueIcon', () => () => null)
jest.mock('~common/icons/ResourceIcon', () => () => null)
jest.mock('~common/DictionnaryIcon', () => () => null)
jest.mock('~common/ui/Icon', () => ({ FeatherIcon: () => null }))
jest.mock('~common/ui/Paragraph', () => () => null)
jest.mock('~common/ui/Text', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    ReactModule.createElement('Text', props, children)
})
jest.mock('~common/ui/Box', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  const AnimatedTouchableBox = ({
    children,
    ...props
  }: React.PropsWithChildren<Record<string, unknown>>) =>
    ReactModule.createElement('AnimatedTouchableBox', props, children)
  return { __esModule: true, default: () => null, AnimatedTouchableBox }
})
jest.mock('~common/ui/Progress', () => () => null)
jest.mock('~features/resources/ResourceUnavailableView', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return (props: Record<string, unknown>) =>
    ReactModule.createElement('ResourceUnavailableView', props)
})
jest.mock('../RandomButton', () => () => null)
jest.mock('../widget', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return {
    itemHeight: 120,
    itemWidth: 180,
    WidgetContainer: ({ children }: React.PropsWithChildren) =>
      ReactModule.createElement('WidgetContainer', null, children),
    WidgetLoading: () => ReactModule.createElement('WidgetLoading'),
  }
})

jest.mock('~helpers/useDownloadQueue', () => ({
  useDownloadItemStatus: () => undefined,
}))

jest.mock('~helpers/offlineCopyId', () => ({
  createOfflineCopyId: () => 'offline-copy-id',
}))

jest.mock('~helpers/downloadItemFactory', () => ({
  createOfflineCopyDownloadItem: (identity: unknown) => ({ id: 'offline-copy-id', identity }),
}))

jest.mock('~helpers/downloadManager', () => ({
  downloadManager: { enqueue: jest.fn(), retry: jest.fn() },
}))

jest.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: readonly unknown[] }) => {
    mockQueryKeys.push([...queryKey])
    const serializedKey = queryKey.join(':')
    if (mockDictionaryEntry && serializedKey.includes('home-dictionary-random')) {
      return {
        data: mockDictionaryEntry,
        isPending: false,
        isSuccess: true,
        isError: false,
        refetch: mockContentRefetch,
      }
    }
    if (
      mockDictionaryEntry &&
      serializedKey.includes('availability') &&
      serializedKey.includes('DICTIONNAIRE')
    ) {
      return {
        data: { status: 'available' },
        isPending: false,
        isError: false,
        refetch: mockAvailabilityRefetch,
      }
    }
    if (serializedKey.includes('strong-lexicon:availability')) {
      return {
        data: {
          availability:
            mockStrongAvailabilityStatus === 'corrupt'
              ? { status: 'corrupt', moduleId: 'core', reason: 'checksum mismatch' }
              : { status: mockStrongAvailabilityStatus, moduleId: 'core' },
          recoveries: ['acquire-offline-copy'],
        },
        isPending: false,
        isError: false,
        isSuccess: true,
        refetch: mockAvailabilityRefetch,
      }
    }
    return serializedKey.includes('availability')
      ? {
          data: mockAvailabilityError
            ? undefined
            : {
                status: 'unavailable',
                reason: mockAvailabilityReason,
                recoveries: ['acquire-offline-copy'],
              },
          error: mockAvailabilityError ? new Error('availability failed') : undefined,
          isPending: false,
          isError: mockAvailabilityError,
          isSuccess: !mockAvailabilityError,
          refetch: mockAvailabilityRefetch,
        }
      : {
          data: undefined,
          error: undefined,
          isPending: true,
          isError: false,
          isSuccess: false,
          refetch: mockContentRefetch,
        }
  },
}))

jest.mock('jotai/react', () => ({ useAtomValue: () => ({ STRONG: 'fr' }) }))

jest.mock('~features/resources/resourceAccess', () => ({
  useResourceAccess: () => ({
    nave: { getAvailability: jest.fn(), loadRandom: jest.fn() },
    dictionary: { getAvailability: jest.fn(), loadItemByRowId: jest.fn() },
    strongLexicon: {
      getModuleAvailability: jest.fn(),
      getModuleRecoveryActions: jest.fn(),
      random: jest.fn(),
    },
    capabilities: { getOnlineAccess: () => ({ status: 'unsupported' }) },
  }),
}))

jest.mock('~state/resourcesLanguage', () => ({
  useResourceLanguage: () => ['fr', jest.fn()],
  resourcesLanguageAtom: {},
}))

jest.mock('~helpers/useLanguage', () => ({ __esModule: true, default: () => 'fr' }))
jest.mock('~helpers/useConnection', () => ({
  __esModule: true,
  default: () => mockIsConnected,
}))

describe('Home resource download widgets', () => {
  let renderer: ReactTestRenderer

  beforeEach(() => {
    mockIsConnected = true
    mockInstalledDictionaryWorks = []
    mockDictionaryEntry = undefined
    mockQueryKeys.length = 0
    mockAvailabilityReason = 'offline-copy-required'
    mockStrongAvailabilityStatus = 'missing'
    mockAvailabilityError = false
    mockAvailabilityRefetch.mockClear()
    mockContentRefetch.mockClear()
    jest.mocked(downloadManager.enqueue).mockClear()
    jest.mocked(downloadManager.retry).mockClear()
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    act(() => renderer?.unmount())
    jest.restoreAllMocks()
  })

  it('uses an installed Bost copy for availability and content when Westphal is absent', () => {
    mockInstalledDictionaryWorks = ['bost', 'calmet']
    mockIsConnected = false
    act(() => {
      renderer = create(<WordOfTheDay />)
    })
    expect(mockQueryKeys.find(key => key.includes('availability'))).toContain('bost')
    expect(mockQueryKeys.find(key => key.includes('home-dictionary-random'))).toContain('bost')
  })

  it('opens the exact entry from the installed work shown by the widget', () => {
    mockInstalledDictionaryWorks = ['bost', 'calmet']
    mockIsConnected = false
    mockDictionaryEntry = { id: 42001, word: 'Babel', normalizedWord: 'babel' }
    act(() => {
      renderer = create(<WordOfTheDay />)
    })
    const link = renderer.root.find(node => String(node.type) === 'Link')
    expect(link.props.params).toMatchObject({
      work: 'bost',
      resourceId: 'BOST',
      entryId: '42001',
      word: 'Babel',
      language: 'fr',
    })
  })

  it('offers to download Nave when its offline copy is absent', () => {
    act(() => {
      renderer = create(<NaveOfTheDay />)
    })

    const recovery = renderer.root.find(node => String(node.type) === 'AnimatedTouchableBox')
    expect(recovery.props).toMatchObject({
      accessibilityRole: 'button',
      className: expect.stringContaining('border-dashed'),
    })
    expect(
      renderer.root.findAll(
        node =>
          String(node.type) === 'AnimatedTouchableBox' && typeof node.props.onPress === 'function'
      )
    ).toHaveLength(1)
    expect(JSON.stringify(renderer.toJSON())).toContain('Thématique Nave')
    expect(JSON.stringify(renderer.toJSON())).toContain('text-tertiary')
    expect(JSON.stringify(renderer.toJSON())).not.toContain('Télécharger')

    act(() => recovery.props.onPress())

    expect(downloadManager.enqueue).toHaveBeenCalledWith([
      {
        id: 'offline-copy-id',
        identity: { kind: 'database', databaseId: 'NAVE', language: 'fr' },
      },
    ])
  })

  it('offers to download the dictionary when its offline copy is absent', () => {
    act(() => {
      renderer = create(<WordOfTheDay />)
    })

    const recovery = renderer.root.find(node => String(node.type) === 'AnimatedTouchableBox')
    expect(recovery.props).toMatchObject({
      accessibilityRole: 'button',
      className: expect.stringContaining('border-dashed'),
    })
    expect(
      renderer.root.findAll(
        node =>
          String(node.type) === 'AnimatedTouchableBox' && typeof node.props.onPress === 'function'
      )
    ).toHaveLength(1)
    expect(JSON.stringify(renderer.toJSON())).toContain('Dictionnaire encyclopédique de la Bible')
    expect(JSON.stringify(renderer.toJSON())).toContain('text-tertiary')
    expect(JSON.stringify(renderer.toJSON())).not.toContain('Télécharger')

    act(() => recovery.props.onPress())

    expect(downloadManager.enqueue).toHaveBeenCalledWith([
      {
        id: 'offline-copy-id',
        identity: {
          kind: 'dictionary',
          work: 'westphal',
          resourceId: 'WESTPHAL',
          language: 'fr',
        },
      },
    ])
  })

  it('offers to download Strong instead of hiding its home widget', () => {
    act(() => {
      renderer = create(<StrongOfTheDay type="grec" />)
    })

    const recovery = renderer.root.find(node => String(node.type) === 'AnimatedTouchableBox')
    expect(JSON.stringify(renderer.toJSON())).toContain('Lexique Strong')
    act(() => recovery.props.onPress())
    expect(downloadManager.enqueue).toHaveBeenCalledWith([
      {
        id: 'offline-copy-id',
        identity: { kind: 'strong-lexicon-module', moduleId: 'core' },
      },
    ])
  })

  it.each([
    ['Nave', 'Thématique Nave', <NaveOfTheDay key="nave" />],
    ['Dictionary', 'Dictionnaire encyclopédique de la Bible', <WordOfTheDay key="dictionary" />],
    ['Strong', 'Lexique Strong', <StrongOfTheDay key="strong" type="grec" />],
  ])('uses the same informational offline state for %s', (_label, title, widget) => {
    mockIsConnected = false
    act(() => {
      renderer = create(widget)
    })

    const unavailable = renderer.root.find(node => String(node.type) === 'ResourceUnavailableView')
    expect(unavailable.props).toEqual(
      expect.objectContaining({
        title,
        failure: { cause: 'network-offline', recoveries: ['retry'] },
        size: 'small',
      })
    )
    expect(
      renderer.root.findAll(node => String(node.type) === 'AnimatedTouchableBox')
    ).toHaveLength(0)

    act(() => unavailable.props.onRetry())

    expect(mockAvailabilityRefetch).toHaveBeenCalledTimes(1)
    expect(mockContentRefetch).toHaveBeenCalledTimes(1)
    expect(downloadManager.enqueue).not.toHaveBeenCalled()
  })

  it('presents an invalid Nave copy as repair instead of a normal download', () => {
    mockAvailabilityReason = 'invalid-offline-copy'
    act(() => {
      renderer = create(<NaveOfTheDay />)
    })

    expect(
      renderer.root.find(node => String(node.type) === 'ResourceUnavailableView').props.failure
    ).toEqual({
      cause: 'invalid-offline-copy',
      recoveries: ['repair-offline-copy', 'manage-offline-copies'],
    })
  })

  it('presents a corrupt Strong core as an integrity failure instead of a download', () => {
    mockStrongAvailabilityStatus = 'corrupt'
    act(() => {
      renderer = create(<StrongOfTheDay type="grec" />)
    })

    expect(
      renderer.root.find(node => String(node.type) === 'ResourceUnavailableView').props.failure
    ).toEqual({
      cause: 'integrity-failure',
      recoveries: ['retry', 'repair-offline-copy', 'manage-offline-copies'],
    })
    expect(
      renderer.root.findAll(node => String(node.type) === 'AnimatedTouchableBox')
    ).toHaveLength(0)
  })

  it.each([
    ['Nave', 'Thématique Nave', <NaveOfTheDay key="nave" />],
    ['Dictionary', 'Dictionnaire encyclopédique de la Bible', <WordOfTheDay key="dictionary" />],
  ])('retries both %s availability and content queries', (_label, title, widget) => {
    mockAvailabilityError = true
    act(() => {
      renderer = create(widget)
    })

    const unavailable = renderer.root.find(node => String(node.type) === 'ResourceUnavailableView')
    expect(unavailable.props.title).toBe(title)
    act(() => unavailable.props.onRetry())

    expect(mockAvailabilityRefetch).toHaveBeenCalledTimes(1)
    expect(mockContentRefetch).toHaveBeenCalledTimes(1)
  })
})

describe('Dictionary home widget entry selection', () => {
  it('prefers installed works in the requested language', () => {
    mockInstalledDictionaryWorks = ['bost', 'calmet']
    const snapshot = useOfflineResourceRegistry()
    expect(selectDictionaryWidgetWork('fr', KNOWN_DICTIONARY_WORKS, snapshot).resource.work).toBe(
      'bost'
    )
    expect(selectDictionaryWidgetWork('en', KNOWN_DICTIONARY_WORKS, snapshot).resource.work).toBe(
      'easton-webster'
    )
    mockInstalledDictionaryWorks = ['westphal', 'bost']
    expect(
      selectDictionaryWidgetWork('fr', KNOWN_DICTIONARY_WORKS, useOfflineResourceRegistry())
        .resource.work
    ).toBe('westphal')
  })

  it('selects a real entry with a sparse id and skips empty letters', async () => {
    const entry = { id: 42001, word: 'Babel', normalizedWord: 'babel' }
    const listByLetterPage = jest
      .fn()
      .mockResolvedValueOnce({ entries: [] })
      .mockResolvedValueOnce({ entries: [entry] })
    await expect(
      loadDictionaryWidgetEntry({ listByLetterPage }, 'fr', 'bost', () => 0)
    ).resolves.toEqual(entry)
    expect(listByLetterPage).toHaveBeenNthCalledWith(1, 'a', { limit: 100 }, 'fr', 'bost')
    expect(listByLetterPage).toHaveBeenNthCalledWith(2, 'b', { limit: 100 }, 'fr', 'bost')
  })

  it('finishes when the selected dictionary has no alphabetical entries', async () => {
    const listByLetterPage = jest.fn().mockResolvedValue({ entries: [] })
    await expect(
      loadDictionaryWidgetEntry({ listByLetterPage }, 'fr', 'calmet', () => 0)
    ).resolves.toBeNull()
    expect(listByLetterPage).toHaveBeenCalledTimes(26)
  })
})
