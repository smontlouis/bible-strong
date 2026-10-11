import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { FooterInSheetProvider, useFooterFullScreen } from '../footerFullScreen'

let mockTabIsFullScreen = true
jest.mock('jotai/react', () => ({ useAtomValue: () => mockTabIsFullScreen }))
jest.mock('src/state/app', () => ({ isFullScreenBibleAtom: {} }), { virtual: true })

const Probe = () => React.createElement('Probe', { value: useFooterFullScreen() })
const render = (inSheet?: boolean) => {
  let renderer: ReactTestRenderer
  act(() => {
    renderer = create(
      inSheet === undefined ? (
        <Probe />
      ) : (
        <FooterInSheetProvider value={inSheet}>
          <Probe />
        </FooterInSheetProvider>
      )
    )
  })
  const value: boolean = renderer!.root.find(node => String(node.type) === 'Probe').props.value
  act(() => renderer.unmount())
  return value
}

afterEach(() => {
  mockTabIsFullScreen = true
})

it('hides the footer of the Bible tab when the tab reads in full screen', () => {
  expect(render()).toBe(true)
  expect(render(false)).toBe(true)
})

it('keeps the footer of a sheet in place when the tab behind reads in full screen', () => {
  expect(render(true)).toBe(false)
})

it('shows the footer everywhere outside full-screen reading', () => {
  mockTabIsFullScreen = false
  expect(render()).toBe(false)
  expect(render(true)).toBe(false)
})
