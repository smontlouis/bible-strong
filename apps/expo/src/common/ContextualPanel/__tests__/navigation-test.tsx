import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { usePanelNavigation } from '../usePanelNavigation'

it('keeps nested navigation local and resets it on dismissal', () => {
  ;(
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true
  const onClose = jest.fn()
  let panel: ReturnType<typeof usePanelNavigation>
  let renderer: ReactTestRenderer
  function Probe() {
    panel = usePanelNavigation({
      initialScreen: 'actions',
      accessibilityLabel: 'Options',
      trigger: null,
      onClose,
      screens: {
        actions: { title: 'Actions', content: () => null },
        colors: { title: 'Colors', content: () => null },
        tags: { title: 'Tags', content: () => null },
      },
    })
    return null
  }
  act(() => {
    renderer = create(<Probe />)
  })
  act(() => panel.present())
  act(() => panel.navigation.open('colors'))
  act(() => panel.navigation.open('tags'))
  expect(panel!.screen.title).toBe('Tags')
  expect(panel!.direction).toBe('forward')
  act(() => panel.navigation.back())
  expect(panel!.screen.title).toBe('Colors')
  expect(panel!.direction).toBe('backward')
  act(() => panel.navigation.open('missing'))
  expect(panel!.screen.title).toBe('Colors')
  act(() => panel.navigation.close())
  expect(panel!.isOpen).toBe(false)
  expect(panel!.screen.title).toBe('Actions')
  expect(onClose).toHaveBeenCalledTimes(1)
  act(() => panel.present())
  expect(panel!.canGoBack).toBe(false)
  expect(panel!.direction).toBe('forward')
  act(() => renderer.unmount())
})
