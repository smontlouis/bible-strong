import React, { useState } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'

import type { ReaderPageSignal } from '../../readerIntent/types'
import { OverlayCloseRequestProvider, useBibleOverlayOpen } from '../overlayLifecycle'
import { ReaderIntentProvider } from '../useReaderIntent'

let setOverlayOpen: (open: boolean) => void = () => {}

const Overlay = () => {
  const [isOpen, setIsOpen] = useState(false)
  setOverlayOpen = setIsOpen
  useBibleOverlayOpen(isOpen, () => setIsOpen(false))
  return <>{isOpen ? 'open' : 'closed'}</>
}

const renderPage = (closeRequest: number, signals: ReaderPageSignal[]) => (
  <ReaderIntentProvider
    tabId="tab"
    onReaderIntent={async () => ({ status: 'done' })}
    onPageSignal={signal => {
      signals.push(signal)
    }}
  >
    <OverlayCloseRequestProvider value={closeRequest}>
      <Overlay />
    </OverlayCloseRequestProvider>
  </ReaderIntentProvider>
)

describe('closing a page overlay at the request of the application', () => {
  let consoleError: jest.SpiedFunction<typeof console.error>
  let renderer: ReactTestRenderer | undefined

  beforeAll(() => {
    ;(
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true
    consoleError = jest.spyOn(console, 'error').mockImplementation((message, ...args) => {
      if (typeof message === 'string' && message.startsWith('react-test-renderer is deprecated')) {
        return
      }
      console.warn(message, ...args)
    })
  })

  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = undefined
  })

  afterAll(() => consoleError.mockRestore())

  it('closes the open overlay when the request is bumped, and tells the application', () => {
    const signals: ReaderPageSignal[] = []
    act(() => {
      renderer = create(renderPage(0, signals))
    })
    act(() => setOverlayOpen(true))
    expect(renderer!.toJSON()).toBe('open')

    act(() => renderer!.update(renderPage(1, signals)))

    expect(renderer!.toJSON()).toBe('closed')
    expect(signals).toEqual([
      { kind: 'overlay-open', open: true },
      { kind: 'overlay-open', open: false },
    ])
  })

  it('ignores a request made before the page mounted or while the overlay was closed', () => {
    const signals: ReaderPageSignal[] = []
    act(() => {
      renderer = create(renderPage(3, signals))
    })
    act(() => setOverlayOpen(true))
    expect(renderer!.toJSON()).toBe('open')

    act(() => setOverlayOpen(false))
    act(() => renderer!.update(renderPage(4, signals)))
    act(() => setOverlayOpen(true))

    expect(renderer!.toJSON()).toBe('open')
  })
})
