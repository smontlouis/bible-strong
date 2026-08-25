import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { downloadManager } from '~helpers/downloadManager'

import NaveOfTheDay from '../NaveOfTheDay'
import StrongOfTheDay from '../StrongOfTheDay'
import WordOfTheDay from '../WordOfTheDay'

let mockIsConnected = true
let mockAvailabilityReason: 'offline-copy-required' | 'invalid-offline-copy' =
  'offline-copy-required'
let mockStrongAvailabilityStatus: 'missing' | 'incompatible' | 'corrupt' = 'missing'
let mockAvailabilityError = false
const mockAvailabilityRefetch = jest.fn()
const mockContentRefetch = jest.fn()

jest.mock('expo-linear-gradient', () => ({ LinearGradient: () => null }))

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

jest.mock('~common/Link', () => () => null)
jest.mock('~common/NaveIcon', () => () => null)
jest.mock('~common/LexiqueIcon', () => () => null)
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
    const serializedKey = queryKey.join(':')
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

  it('offers to download Nave when its offline copy is absent', () => {
    act(() => {
      renderer = create(<NaveOfTheDay />)
    })

    const recovery = renderer.root.find(node => String(node.type) === 'AnimatedTouchableBox')
    expect(recovery.props).toMatchObject({
      accessibilityRole: 'button',
      borderStyle: 'dashed',
    })
    expect(
      renderer.root.findAll(
        node =>
          String(node.type) === 'AnimatedTouchableBox' && typeof node.props.onPress === 'function'
      )
    ).toHaveLength(1)
    expect(JSON.stringify(renderer.toJSON())).toContain('Thématique Nave')
    expect(JSON.stringify(renderer.toJSON())).toContain('"color":"tertiary"')
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
      borderStyle: 'dashed',
    })
    expect(
      renderer.root.findAll(
        node =>
          String(node.type) === 'AnimatedTouchableBox' && typeof node.props.onPress === 'function'
      )
    ).toHaveLength(1)
    expect(JSON.stringify(renderer.toJSON())).toContain('Dictionnaire Westphal')
    expect(JSON.stringify(renderer.toJSON())).toContain('"color":"tertiary"')
    expect(JSON.stringify(renderer.toJSON())).not.toContain('Télécharger')

    act(() => recovery.props.onPress())

    expect(downloadManager.enqueue).toHaveBeenCalledWith([
      {
        id: 'offline-copy-id',
        identity: { kind: 'database', databaseId: 'DICTIONNAIRE', language: 'fr' },
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
    ['Dictionary', 'Dictionnaire Westphal', <WordOfTheDay key="dictionary" />],
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
    ['Dictionary', 'Dictionnaire Westphal', <WordOfTheDay key="dictionary" />],
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
