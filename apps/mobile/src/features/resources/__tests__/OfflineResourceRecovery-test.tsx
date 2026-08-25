import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'

import { downloadManager } from '~helpers/downloadManager'
import OfflineResourceRecovery from '../OfflineResourceRecovery'

let mockIsConnected = false

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

jest.mock('~helpers/useConnection', () => ({
  __esModule: true,
  default: () => mockIsConnected,
}))
jest.mock('~helpers/useDownloadQueue', () => ({ useDownloadItemStatus: () => undefined }))
jest.mock('~helpers/offlineCopyId', () => ({ createOfflineCopyId: () => 'database:NAVE:fr' }))
jest.mock('~helpers/downloadItemFactory', () => ({
  createOfflineCopyDownloadItem: (identity: unknown) => ({ id: 'database:NAVE:fr', identity }),
}))
jest.mock('~helpers/downloadManager', () => ({
  downloadManager: { enqueue: jest.fn(), retry: jest.fn() },
}))
jest.mock('../resourceAccess', () => ({
  useResourceAccess: () => ({
    capabilities: { getOnlineAccess: () => ({ status: 'unsupported' }) },
  }),
}))
jest.mock('~common/Loading', () => () => null)
jest.mock('~common/ui/Progress', () => () => null)
jest.mock('~common/DownloadRequired', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    ReactModule.createElement('DownloadRequired', props, children)
})

describe('OfflineResourceRecovery', () => {
  let renderer: ReactTestRenderer

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    jest.mocked(downloadManager.enqueue).mockClear()
    mockIsConnected = false
  })

  afterEach(() => {
    act(() => renderer?.unmount())
  })

  it('explains that a connection is required instead of starting a doomed download', () => {
    act(() => {
      renderer = create(
        <OfflineResourceRecovery
          identity={{ kind: 'database', databaseId: 'NAVE', language: 'fr' }}
          title="Nave indisponible"
          fileSize={7}
        />
      )
    })

    const recovery = renderer.root.find(node => String(node.type) === 'DownloadRequired')
    expect(recovery.props).toMatchObject({
      disabled: true,
      actionLabel: 'resource.action.connectionRequired',
    })

    act(() => recovery.props.onDownload())
    expect(downloadManager.enqueue).not.toHaveBeenCalled()
  })

  it('preserves the invalid-copy state and offers a repair while online', () => {
    mockIsConnected = true
    act(() => {
      renderer = create(
        <OfflineResourceRecovery
          identity={{ kind: 'database', databaseId: 'NAVE', language: 'fr' }}
          title="Nave corrompue"
          fileSize={7}
          reason="invalid-offline-copy"
        />
      )
    })

    const recovery = renderer.root.find(node => String(node.type) === 'DownloadRequired')
    expect(recovery.props).toMatchObject({
      disabled: false,
      actionLabel: 'resource.action.repairOfflineCopy',
    })

    act(() => recovery.props.onDownload())
    expect(downloadManager.enqueue).toHaveBeenCalledTimes(1)
  })
})
