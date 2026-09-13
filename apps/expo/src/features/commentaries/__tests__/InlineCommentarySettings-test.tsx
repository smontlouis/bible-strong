/* eslint-disable import/first, @typescript-eslint/no-require-imports */
import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'

const mockDispatch = jest.fn()
let mockSettings = {
  commentarySelection: ['egw-writings:en', 'barnes:fr', 'sdabc:fr'],
  inlineCommentaries: ['egw-writings:en'],
  inlineCommentariesEnabled: undefined as boolean | undefined,
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
  setSettingsInlineCommentariesEnabled: (payload: boolean) => ({ type: 'inline-enabled', payload }),
}))
jest.mock('~common/ui/Box', () => ({
  __esModule: true,
  default: 'Box',
  HStack: 'HStack',
  TouchableBox: 'TouchableBox',
}))
jest.mock('~common/ui/Text', () => 'Text')
jest.mock('~common/ui/Checkbox', () => 'Checkbox')
jest.mock('~common/ui/Switch', () => 'Switch')
jest.mock('~themes/ThemeProvider', () => ({
  useTheme: () => ({ colors: { border: '#ddd', primary: '#5983f0' } }),
}))
jest.mock('~common/ui/Icon', () => ({ FeatherIcon: 'Icon' }))
jest.mock('~i18n', () => ({ getLanguage: () => 'fr' }))
import InlineCommentarySettings from '../InlineCommentarySettings'
let renderer: ReactTestRenderer
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  jest.clearAllMocks()
  mockSettings = {
    commentarySelection: ['egw-writings:en', 'barnes:fr', 'sdabc:fr'],
    inlineCommentaries: ['egw-writings:en'],
    inlineCommentariesEnabled: undefined as boolean | undefined,
  }
})
afterEach(async () => {
  await act(async () => renderer?.unmount())
})

it('offers only display selection, without download controls or availability descriptions', async () => {
  await act(async () => {
    renderer = create(<InlineCommentarySettings />)
  })
  const choices = renderer.root.findAll(
    node => String(node.type) === 'TouchableBox' && node.props.accessibilityRole === 'checkbox'
  )
  expect(choices).toHaveLength(2)
  expect(choices.every(node => !node.props.accessibilityState.checked)).toBe(true)
  expect(JSON.stringify(renderer.toJSON())).not.toContain('Ellen')
  expect(JSON.stringify(renderer.toJSON())).not.toContain('inlineCommentary.offlineReady')
  expect(JSON.stringify(renderer.toJSON())).not.toContain('inlineCommentary.onlineOnly')
  expect(JSON.stringify(renderer.toJSON())).not.toContain('inlineCommentary.download')
  await act(async () => {
    choices[0].props.onPress()
  })
  expect(mockDispatch).toHaveBeenCalledWith({ type: 'inline-selection', payload: ['barnes:fr'] })
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
})

it('offers management directly from the empty state without the verbose description', async () => {
  mockSettings.commentarySelection = []
  const manage = jest.fn()
  await act(async () => {
    renderer = create(<InlineCommentarySettings onManage={manage} />)
  })
  expect(JSON.stringify(renderer.toJSON())).not.toContain('inlineCommentary.description')
  const button = renderer.root.find(
    node => String(node.type) === 'TouchableBox' && node.props.onPress === manage
  )
  await act(async () => {
    button.props.onPress()
  })
  expect(manage).toHaveBeenCalledTimes(1)
})

it('keeps selected commentaries checked when the display switch is off', async () => {
  mockSettings.inlineCommentaries = ['barnes:fr']
  mockSettings.inlineCommentariesEnabled = false
  await act(async () => {
    renderer = create(<InlineCommentarySettings />)
  })
  const toggle = renderer.root.find(node => String(node.type) === 'Switch')
  expect(toggle.props.value).toBe(false)
  expect(
    renderer.root.findAll(
      node => String(node.type) === 'TouchableBox' && node.props.accessibilityState?.checked
    )
  ).toHaveLength(1)
  await act(async () => {
    toggle.props.onValueChange(true)
  })
  expect(mockDispatch).toHaveBeenCalledWith({ type: 'inline-enabled', payload: true })
  expect(mockSettings.inlineCommentaries).toEqual(['barnes:fr'])
})
