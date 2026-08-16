import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { downloadManager } from '~helpers/downloadManager'

import NaveOfTheDay from '../NaveOfTheDay'
import StrongOfTheDay from '../StrongOfTheDay'
import WordOfTheDay from '../WordOfTheDay'

let mockIsConnected = true

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
          availability: { status: 'unavailable' },
          recoveries: ['acquire-offline-copy'],
        },
        isPending: false,
        isError: false,
        isSuccess: true,
      }
    }
    return serializedKey.includes('availability')
      ? {
          data: { status: 'unavailable', recoveries: ['acquire-offline-copy'] },
          isPending: false,
          isError: false,
          isSuccess: true,
        }
      : { data: undefined, error: undefined, isPending: true, isError: false, isSuccess: false }
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
    expect(JSON.stringify(renderer.toJSON())).toContain('resource.nave.offlineCopyNeeded')
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
    expect(JSON.stringify(renderer.toJSON())).toContain('resource.dictionary.offlineCopyNeeded')
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
    expect(JSON.stringify(renderer.toJSON())).toContain('resource.strong.offlineCopyNeeded')
    act(() => recovery.props.onPress())
    expect(downloadManager.enqueue).toHaveBeenCalledWith([
      {
        id: 'offline-copy-id',
        identity: { kind: 'strong-lexicon-module', moduleId: 'core' },
      },
    ])
  })

  it('keeps a missing resource visible without attempting an impossible Offline download', () => {
    mockIsConnected = false
    act(() => {
      renderer = create(<NaveOfTheDay />)
    })

    const recovery = renderer.root.find(node => String(node.type) === 'AnimatedTouchableBox')
    expect(recovery.props.accessibilityState).toEqual({ disabled: true })
    expect(JSON.stringify(renderer.toJSON())).toContain('resource.action.connectionRequired')

    act(() => recovery.props.onPress?.())

    expect(downloadManager.enqueue).not.toHaveBeenCalled()
  })
})
