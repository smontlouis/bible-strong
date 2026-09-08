import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import DropdownMenu from '../DropdownMenu.web'
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
jest.mock('../ContextualPanel', () => ({ __esModule: true, default: 'Panel' }))
jest.mock('../ContextualPanel/PanelSearch', () => ({ __esModule: true, default: 'Search' }))
jest.mock('../ui/Box', () => ({ __esModule: true, default: 'Box', TouchableBox: 'Row' }))
jest.mock('../ui/Text', () => ({ __esModule: true, default: 'Text' }))
jest.mock('../ui/Icon', () => ({ FeatherIcon: 'Icon' }))
it('filters voice names and languages and selects the original value before closing', () => {
  ;(
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true
  const setValue = jest.fn()
  const close = jest.fn()
  let renderer: ReactTestRenderer
  act(() => {
    renderer = create(
      <DropdownMenu
        title="Voix"
        searchable
        currentValue="fr"
        setValue={setValue}
        choices={[
          { value: 'fr', label: 'Alice', subLabel: 'Français' },
          { value: 'en', label: 'John', subLabel: 'English' },
        ]}
      />
    )
  })
  const panel = () => renderer!.root.find(node => String(node.type) === 'Panel')
  act(() => panel().props.screens.choices.headerContent.props.onChange('english'))
  let content: ReactTestRenderer
  act(() => {
    content = create(panel().props.screens.choices.content({ close }))
  })
  const rows = content!.root.findAll(node => String(node.type) === 'Row')
  expect(rows).toHaveLength(1)
  act(() => rows[0].props.onPress())
  expect(setValue).toHaveBeenCalledWith('en')
  expect(close).toHaveBeenCalledTimes(1)
  act(() => {
    content!.unmount()
    renderer!.unmount()
  })
})
