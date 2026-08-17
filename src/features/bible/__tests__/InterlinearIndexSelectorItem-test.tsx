import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'

import { downloadManager } from '~helpers/downloadManager'
import InterlinearIndexSelectorItem from '../InterlinearIndexSelectorItem'

const mockGetInterlinearAvailability = jest.fn()
const mockRefetch = jest.fn()
const mockUseDownloadItemStatus = jest.fn()
const mockUseQuery = jest.fn()

jest.mock('@tanstack/react-query', () => ({
  useQuery: (options: unknown) => mockUseQuery(options),
}))

jest.mock('jotai/react', () => ({ useAtomValue: () => 0 }))

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

jest.mock('react-native', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return {
    ActivityIndicator: (props: Record<string, unknown>) =>
      ReactModule.createElement('ActivityIndicator', props),
    TouchableOpacity: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      ReactModule.createElement('TouchableOpacity', props, children),
  }
})

jest.mock('~common/ui/Box', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return {
    __esModule: true,
    default: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      ReactModule.createElement('Box', props, children),
  }
})

jest.mock('~common/ui/Icon', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return {
    FeatherIcon: (props: Record<string, unknown>) => ReactModule.createElement('Icon', props),
  }
})

jest.mock('~common/ui/Progress', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => ReactModule.createElement('Progress', props),
  }
})

jest.mock('~common/ui/Text', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return {
    __esModule: true,
    default: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      ReactModule.createElement('Text', props, children),
  }
})

jest.mock('~features/resources/resourceAccess', () => ({
  useResourceAccess: () => ({
    lexiconBible: { getInterlinearAvailability: mockGetInterlinearAvailability },
  }),
}))

jest.mock('~helpers/downloadItemFactory', () => ({
  createInterlinearSidecarDownloadPlan: (locale: string, status: string) => [
    { id: `interlinear-update:${locale}:${status}` },
  ],
}))

jest.mock('~helpers/downloadManager', () => ({
  downloadManager: { enqueue: jest.fn() },
}))

jest.mock('~helpers/offlineCopyId', () => ({
  createOfflineCopyId: (identity: { kind: string; language?: string }) =>
    `${identity.kind}:${identity.language ?? 'base'}`,
}))

jest.mock('~helpers/useConnection', () => ({ __esModule: true, default: () => true }))
jest.mock('~helpers/useDownloadQueue', () => ({
  useDownloadItemStatus: (...args: unknown[]) => mockUseDownloadItemStatus(...args),
}))

describe('InterlinearIndexSelectorItem', () => {
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
    jest.mocked(downloadManager.enqueue).mockReset()
    mockGetInterlinearAvailability.mockReset()
    mockRefetch.mockReset()
    mockUseDownloadItemStatus.mockReset().mockReturnValue(undefined)
    mockUseQuery.mockReset()
  })

  afterEach(() => {
    act(() => renderer?.unmount())
    consoleError.mockRestore()
  })

  const renderItem = (onAvailabilityChange = jest.fn()) => {
    act(() => {
      renderer = create(
        <InterlinearIndexSelectorItem
          locale="fr"
          expanded
          onAvailabilityChange={onAvailabilityChange}
        />
      )
    })
    return onAvailabilityChange
  }

  it('marks a zero-copy HTTP index as selectable without offering a download', () => {
    mockUseQuery.mockReturnValue({
      data: { status: 'available', locale: 'fr', textRevision: 'bhg-r1' },
      isPending: false,
      isFetching: false,
      isError: false,
      refetch: mockRefetch,
    })
    const onAvailabilityChange = renderItem()

    expect(onAvailabilityChange).toHaveBeenLastCalledWith(true)
    expect(renderer.root.findAll(node => String(node.type) === 'TouchableOpacity')).toHaveLength(0)
    expect(renderer.root.findByProps({ name: 'check' })).toBeTruthy()
    expect(downloadManager.enqueue).not.toHaveBeenCalled()
  })

  it('offers the dependency-aware update plan for an incompatible installed index', async () => {
    mockUseQuery.mockReturnValue({
      data: { status: 'base-incompatible' },
      isPending: false,
      isFetching: false,
      isError: false,
      refetch: mockRefetch,
    })
    renderItem()

    await act(async () => {
      await renderer.root.find(node => String(node.type) === 'TouchableOpacity').props.onPress()
    })

    expect(downloadManager.enqueue).toHaveBeenCalledWith([
      { id: 'interlinear-update:fr:base-incompatible' },
    ])
  })
})
