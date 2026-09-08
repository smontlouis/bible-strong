import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import FilterChoices from '../FilterChoices'
jest.mock('react-native', () => ({ TextInput: 'TextInput', Platform: { OS: 'ios' } }))
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
jest.mock('~themes/ThemeProvider', () => ({ useTheme: () => ({ colors: {} }) }))
jest.mock('../ui/Box', () => ({ __esModule: true, default: 'Box', TouchableBox: 'TouchableBox' }))
jest.mock('../ui/Text', () => ({ __esModule: true, default: 'Text' }))
jest.mock('../ui/Checkbox', () => ({ __esModule: true, default: 'Checkbox' }))
jest.mock('../ui/Icon', () => ({ FeatherIcon: 'FeatherIcon' }))
it('keeps tag search, checked indicators and selection callbacks', () => {
  ;(
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true
  const select = jest.fn()
  let renderer: ReactTestRenderer
  act(() => {
    renderer = create(
      <FilterChoices
        searchable
        showCheckbox
        options={[
          { key: 'all', label: 'Tous', selected: true, onSelect: jest.fn() },
          { key: 'love', label: 'Amour', selected: false, onSelect: select },
        ]}
      />
    )
  })
  const nodes = (type: string) => renderer!.root.findAll(node => String(node.type) === type)
  expect(nodes('Checkbox').map(node => node.props.checked)).toEqual([true, false])
  expect(nodes('Checkbox')[0].props.size).toBe(24)
  expect(nodes('TouchableBox')[0].props.className).toContain('p-[16px]')
  expect(nodes('TouchableBox')[0].props.className).toContain('border-b-[1px]')
  act(() => nodes('TextInput')[0].props.onChangeText('AMO'))
  expect(nodes('TouchableBox')).toHaveLength(1)
  act(() => nodes('TouchableBox')[0].props.onPress())
  expect(select).toHaveBeenCalledTimes(1)
  act(() => renderer!.unmount())
})
