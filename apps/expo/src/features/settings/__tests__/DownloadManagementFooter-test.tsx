import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'

import DownloadManagementFooter from '../components/DownloadManagementFooter'

jest.mock('../components/BatchActionBar', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return (props: Record<string, unknown>) => ReactModule.createElement('BatchActionBar', props)
})

jest.mock('../components/GlobalDownloadBar', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return () => ReactModule.createElement('GlobalDownloadBar')
})

const baseProps = {
  selectedCount: 0,
  hasDownloadable: false,
  hasDeletable: false,
  onDownload: jest.fn(),
  onDelete: jest.fn(),
}

describe('DownloadManagementFooter', () => {
  let renderer: ReactTestRenderer
  let consoleError: jest.SpyInstance

  beforeAll(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    consoleError = jest.spyOn(console, 'error').mockImplementation((message, ...args) => {
      if (typeof message === 'string' && message.startsWith('react-test-renderer is deprecated')) {
        return
      }
      console.warn(message, ...args)
    })
  })

  afterAll(() => consoleError.mockRestore())

  afterEach(() => {
    act(() => renderer?.unmount())
  })

  it('shows global download progress after a batch selection is enqueued and cleared', () => {
    act(() => {
      renderer = create(<DownloadManagementFooter {...baseProps} />)
    })

    expect(renderer.root.findAll(node => String(node.type) === 'GlobalDownloadBar')).toHaveLength(1)
    expect(renderer.root.findAll(node => String(node.type) === 'BatchActionBar')).toHaveLength(0)
  })

  it('shows batch actions while resources are selected', () => {
    act(() => {
      renderer = create(<DownloadManagementFooter {...baseProps} selectedCount={2} />)
    })

    expect(renderer.root.findAll(node => String(node.type) === 'BatchActionBar')).toHaveLength(1)
    expect(renderer.root.findAll(node => String(node.type) === 'GlobalDownloadBar')).toHaveLength(0)
  })
})
