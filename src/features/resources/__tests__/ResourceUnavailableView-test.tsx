import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'

import ResourceUnavailableView from '../ResourceUnavailableView'

let mockIsOnline = true

jest.mock('~helpers/useConnection', () => () => mockIsOnline)
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
jest.mock('~common/ui/Text', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    ReactModule.createElement('Text', props, children)
})
jest.mock('~common/ui/Box', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    ReactModule.createElement('Box', props, children)
})
jest.mock('~common/ui/Icon', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return {
    FeatherIcon: (props: Record<string, unknown>) =>
      ReactModule.createElement('FeatherIcon', props),
  }
})
jest.mock('../OfflineResourceRecovery', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return (props: Record<string, unknown>) => ReactModule.createElement('OfflineRecovery', props)
})

describe('ResourceUnavailableView', () => {
  let renderer: ReactTestRenderer

  beforeAll(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  })

  afterEach(() => act(() => renderer?.unmount()))

  it('renders an offline failure with wifi-off and never offers a download', () => {
    mockIsOnline = false
    act(() => {
      renderer = create(
        <ResourceUnavailableView
          identity={{ kind: 'database', databaseId: 'NAVE', language: 'fr' }}
          title="Nave indisponible"
          fileSize={7}
          failure={{ cause: 'network-offline', recoveries: ['retry', 'acquire-offline-copy'] }}
          onRetry={jest.fn()}
        />
      )
    })

    expect(renderer.root.find(node => String(node.type) === 'FeatherIcon').props.name).toBe(
      'wifi-off'
    )
    expect(renderer.root.findAll(node => String(node.type) === 'OfflineRecovery')).toHaveLength(0)
    expect(renderer.root.findAllByProps({ children: 'bible.error.retry' }).length).toBeGreaterThan(
      0
    )
  })

  it('delegates an online downloadable missing copy to the download recovery control', () => {
    mockIsOnline = true
    act(() => {
      renderer = create(
        <ResourceUnavailableView
          identity={{ kind: 'database', databaseId: 'NAVE', language: 'fr' }}
          title="Nave indisponible"
          fileSize={7}
          failure={{ cause: 'offline-copy-required', recoveries: ['acquire-offline-copy'] }}
        />
      )
    })

    expect(renderer.root.findAll(node => String(node.type) === 'OfflineRecovery')).toHaveLength(1)
  })

  it('keeps the invalid-copy warning icon while offering repair', () => {
    mockIsOnline = true
    act(() => {
      renderer = create(
        <ResourceUnavailableView
          identity={{ kind: 'database', databaseId: 'NAVE', language: 'fr' }}
          title="Nave endommagée"
          fileSize={7}
          failure={{
            cause: 'invalid-offline-copy',
            recoveries: ['repair-offline-copy', 'manage-offline-copies'],
          }}
        />
      )
    })

    expect(renderer.root.find(node => String(node.type) === 'OfflineRecovery').props.icon).toBe(
      'alert-triangle'
    )
    expect(
      renderer.root.find(node => String(node.type) === 'OfflineRecovery').props.secondaryActions
    ).toEqual([expect.objectContaining({ label: 'bible.error.goToDownloads' })])
  })

  it('keeps repair visible but disabled by connectivity while offline', () => {
    mockIsOnline = false
    act(() => {
      renderer = create(
        <ResourceUnavailableView
          identity={{ kind: 'database', databaseId: 'NAVE', language: 'fr' }}
          title="Nave endommagée"
          fileSize={7}
          failure={{ cause: 'invalid-offline-copy', recoveries: ['repair-offline-copy'] }}
        />
      )
    })

    expect(renderer.root.find(node => String(node.type) === 'OfflineRecovery')).toBeDefined()
  })

  it('exposes retry and management without fabricated download metadata', () => {
    mockIsOnline = true
    const onRetry = jest.fn()
    const onManage = jest.fn()
    act(() => {
      renderer = create(
        <ResourceUnavailableView
          title="Ressource indisponible"
          failure={{
            cause: 'integrity-failure',
            recoveries: ['retry', 'manage-offline-copies'],
          }}
          onRetry={onRetry}
          onManage={onManage}
        />
      )
    })

    act(() => renderer.root.findByProps({ children: 'bible.error.retry' }).props.onPress())
    act(() => renderer.root.findByProps({ children: 'bible.error.goToDownloads' }).props.onPress())

    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(onManage).toHaveBeenCalledTimes(1)
    expect(renderer.root.findAll(node => String(node.type) === 'OfflineRecovery')).toHaveLength(0)
  })
})
