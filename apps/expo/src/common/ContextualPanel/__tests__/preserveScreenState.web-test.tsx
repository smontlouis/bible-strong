import React, { act, useState } from 'react'
import { create, type ReactTestRenderer } from 'react-test-renderer'
import ContextualPanel from '../index.web'
import type { PanelNavigation } from '../types'
jest.mock('../../FiltersHeader.web.css', () => ({}))

jest.mock(
  '@heroui/react/popover',
  () => {
    const React = jest.requireActual('react')
    return {
      Popover: Object.assign(
        ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
          React.createElement('Popover', props, children),
        { Trigger: 'Trigger', Content: 'Content', Dialog: 'Dialog', Heading: 'Heading' }
      ),
    }
  },
  { virtual: true }
)
jest.mock('~themes/ThemeProvider', () => ({
  useTheme: () => ({ colors: {}, fontFamily: { text: 'Arial', title: 'Arial' } }),
}))
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
jest.mock('~common/ui/Icon', () => ({ FeatherIcon: 'Icon' }))
jest.mock('../PanelTransition', () => ({ __esModule: true, default: 'Transition' }))

it('preserves the current form while a nested selector is open and after going back', () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  let navigation: PanelNavigation
  function Draft() {
    const [value, setValue] = useState('')
    return <input value={value} onChange={event => setValue(event.target.value)} />
  }
  let view: ReactTestRenderer
  act(() => {
    view = create(
      <ContextualPanel
        trigger={null}
        accessibilityLabel="Menu"
        initialScreen="form"
        screens={{
          form: {
            title: 'Form',
            content: nav => {
              navigation = nav
              return <Draft />
            },
          },
          selector: { title: 'Versions', width: 500, content: () => <span>Versions</span> },
        }}
      />
    )
  })
  act(() => view!.root.findByType('Popover' as React.ElementType).props.onOpenChange(true))
  act(() => view!.root.findByType('input').props.onChange({ target: { value: 'Genèse 1' } }))
  act(() => navigation.open('selector'))
  expect(view!.root.findByType('input').props.value).toBe('Genèse 1')
  expect(view!.root.findByType('Content' as React.ElementType).props.style.width).toBe(500)
  act(() => navigation.back())
  expect(view!.root.findByType('input').props.value).toBe('Genèse 1')
  expect(view!.root.findByType('Content' as React.ElementType).props.style.width).toBe(340)
  act(() => view!.unmount())
})
