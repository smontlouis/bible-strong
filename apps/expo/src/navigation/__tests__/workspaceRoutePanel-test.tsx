import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { useWorkspaceRoutePanel } from '../useWorkspaceRoutePanel'

let mockWidth = 1440
let mockPlatform = 'web'
let mockSegments = ['(explore)', 'note']
let mockRoutes = [{ name: 'index' }, { name: '(explore)' }]
jest.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mockPlatform
    },
  },
  useWindowDimensions: () => ({ width: mockWidth }),
}))
jest.mock('expo-router', () => ({
  useSegments: () => mockSegments,
  useRootNavigationState: () => ({
    index: 0,
    routes: [
      {
        name: '__root',
        state: { key: 'workspace-stack', index: mockRoutes.length - 1, routes: mockRoutes },
      },
    ],
  }),
}))

function readPanel() {
  let result: ReturnType<typeof useWorkspaceRoutePanel> | undefined
  function Probe() {
    result = useWorkspaceRoutePanel()
    return null
  }
  let renderer: ReactTestRenderer
  act(() => {
    renderer = create(<Probe />)
  })
  act(() => renderer!.unmount())
  return result
}

beforeAll(() => {
  ;(
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true
})

beforeEach(() => {
  mockWidth = 1440
  mockPlatform = 'web'
  mockSegments = ['(explore)', 'note']
  mockRoutes = [{ name: 'index' }, { name: '(explore)' }]
})
it('keeps the study surface behind a wide web form sheet', () => {
  expect(readPanel()).toEqual(
    expect.objectContaining({ enabled: true, open: true, showsStudy: true })
  )
})
it('preserves an ordinary page behind the panel', () => {
  mockRoutes = [{ name: 'index' }, { name: 'more' }, { name: '(explore)' }]
  expect(readPanel()?.showsStudy).toBe(false)
})
it('uses pages below the breakpoint', () => {
  mockWidth = 767
  expect(readPanel()).toEqual(
    expect.objectContaining({ enabled: false, open: false, showsStudy: false })
  )
})
it('does not change native presentations', () => {
  mockPlatform = 'ios'
  expect(readPanel()?.enabled).toBe(false)
})
it('does not reserve a panel for normal navigation', () => {
  mockSegments = ['more']
  expect(readPanel()?.open).toBe(false)
})
it('provides the study surface for a direct form sheet URL', () => {
  mockRoutes = [{ name: '(explore)' }]
  expect(readPanel()?.showsStudy).toBe(true)
})

it('uses 45 percent without a docked sidebar at intermediate widths', () => {
  mockWidth = 1000
  expect(readPanel()?.panelWidth).toBe(450)
  expect(readPanel()?.open).toBe(true)
})
it('caps the panel at 500 pixels', () => {
  mockWidth = 1800
  expect(readPanel()?.panelWidth).toBe(500)
})

it('closes every consecutive panel route back to its originating page', () => {
  mockRoutes = [
    { name: 'index' },
    { name: 'more' },
    { name: '(explore)' },
    { name: 'strong' },
    { name: '(explore)' },
  ]
  expect(readPanel()?.closeTarget).toEqual({ key: 'workspace-stack', count: 3 })
})
it('falls back to the workspace for a directly opened panel', () => {
  mockRoutes = [{ name: '(explore)' }]
  expect(readPanel()?.closeTarget).toBeUndefined()
})
