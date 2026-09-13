/* eslint-disable import/first, @typescript-eslint/no-require-imports */
import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'

const mockDispatch = jest.fn()
const mockPresent = jest.fn()
let mockSettings = {
  commentarySelection: ['egw-writings:en', 'barnes:fr', 'sdabc:fr'],
  inlineCommentaries: ['egw-writings:en'],
}
jest.mock('react-native', () => ({ Platform: { OS: 'ios' }, ScrollView: 'ScrollView' }))
jest.mock('react-redux', () => ({
  useDispatch: () => mockDispatch,
  useSelector: (selector: (state: unknown) => unknown) =>
    selector({ user: { bible: { settings: mockSettings } } }),
}))
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
jest.mock('~redux/modules/user', () => ({
  setSettingsInlineCommentaries: (payload: string[]) => ({ type: 'inline-selection', payload }),
}))
jest.mock('~features/resources/useOfflineResourceRegistry', () => ({
  useIsOfflineResourceInstalled: ({ resourceId }: { resourceId: string }) => resourceId === 'sdabc',
}))
jest.mock('~common/ui/Box', () => ({
  __esModule: true,
  default: 'Box',
  HStack: 'HStack',
  TouchableBox: 'TouchableBox',
}))
jest.mock('~common/ui/Text', () => 'Text')
jest.mock('~common/ui/Checkbox', () => 'Checkbox')
jest.mock('~common/ui/Icon', () => ({ FeatherIcon: 'Icon' }))
jest.mock('~i18n', () => ({ getLanguage: () => 'fr' }))
jest.mock('../CommentaryOfflineDetailsSheet', () => {
  const React = require('react')
  return function Details(props: { sheetRef: React.Ref<unknown>; projection?: unknown }) {
    React.useImperativeHandle(props.sheetRef, () => ({ present: mockPresent }))
    return React.createElement('DownloadDetails', { projection: props.projection })
  }
})

import InlineCommentarySettings from '../InlineCommentarySettings'
let renderer: ReactTestRenderer
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  jest.clearAllMocks()
  mockSettings = {
    commentarySelection: ['egw-writings:en', 'barnes:fr', 'sdabc:fr'],
    inlineCommentaries: ['egw-writings:en'],
  }
})
afterEach(async () => {
  await act(async () => renderer?.unmount())
})

it('offers eligible works and availability, with download details separate from enabling', async () => {
  await act(async () => {
    renderer = create(<InlineCommentarySettings />)
  })
  const choices = renderer.root.findAll(
    node => String(node.type) === 'TouchableBox' && node.props.accessibilityRole === 'checkbox'
  )
  expect(choices).toHaveLength(2)
  expect(choices.every(node => !node.props.accessibilityState.checked)).toBe(true)
  expect(JSON.stringify(renderer.toJSON())).not.toContain('Ellen')
  expect(JSON.stringify(renderer.toJSON())).toContain('inlineCommentary.offlineReady')
  expect(JSON.stringify(renderer.toJSON())).toContain('inlineCommentary.onlineOnly')
  expect(mockPresent).not.toHaveBeenCalled()
  await act(async () => {
    choices[0].props.onPress()
  })
  expect(mockDispatch).toHaveBeenCalledWith({ type: 'inline-selection', payload: ['barnes:fr'] })
  expect(mockPresent).not.toHaveBeenCalled()
  expect(
    renderer.root.find(node => String(node.type) === 'DownloadDetails').props.projection
  ).toBeUndefined()
  const download = renderer.root.findAll(
    node =>
      String(node.type) === 'TouchableBox' &&
      node.props.accessibilityLabel === 'inlineCommentary.download'
  )[0]
  await act(async () => {
    download.props.onPress()
  })
  expect(mockPresent).toHaveBeenCalledTimes(1)
  expect(
    renderer.root.find(node => String(node.type) === 'DownloadDetails').props.projection.entry.id
  ).toBe('barnes')
  expect(mockDispatch).toHaveBeenCalledTimes(1)
})

it('shows the empty state when the master selection contains only excluded writings', async () => {
  mockSettings.commentarySelection = ['egw-writings:en']
  await act(async () => {
    renderer = create(<InlineCommentarySettings />)
  })
  expect(JSON.stringify(renderer.toJSON())).toContain('inlineCommentary.noSelection')
  expect(
    renderer.root.findAll(
      node => String(node.type) === 'TouchableBox' && node.props.accessibilityRole === 'checkbox'
    )
  ).toHaveLength(0)
  expect(mockDispatch).not.toHaveBeenCalled()
  expect(mockPresent).not.toHaveBeenCalled()
})
