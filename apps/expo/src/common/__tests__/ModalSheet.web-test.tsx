import React, { act, createRef } from 'react'
import { create, type ReactTestRenderer } from 'react-test-renderer'
import ModalSheet from '../ModalSheet.web'
import { readSheetHeader } from '../readSheetHeader'
import type { SheetRef } from '../sheet'
jest.mock(
  '@heroui/react/modal',
  () => ({
    Modal: {
      Backdrop: 'Backdrop',
      Container: 'Container',
      Dialog: 'Dialog',
      Header: 'Header',
      Heading: 'Heading',
      Body: 'Body',
      Footer: 'Footer',
    },
  }),
  { virtual: true }
)
jest.mock('../modal-sheet.css', () => ({}))
jest.mock('~themes/ThemeProvider', () => ({
  useTheme: () => ({ colors: {}, fontFamily: { title: 'Arial', text: 'Arial' } }),
}))
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
jest.mock('../ui/Icon', () => ({ FeatherIcon: 'Icon' }))

it('keeps imperative lifecycle notifications single and respects non-dismissable forms', () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  const ref = createRef<SheetRef>()
  const onPresent = jest.fn()
  const onDismiss = jest.fn()
  let view: ReactTestRenderer
  act(() => {
    view = create(
      <ModalSheet
        ref={ref}
        modalTitle="Account"
        dismissible={false}
        onPresent={onPresent}
        onDismiss={onDismiss}
      >
        Form
      </ModalSheet>
    )
  })
  act(() => {
    ref.current!.present()
    ref.current!.present()
  })
  const backdrop = () => view!.root.findByType('Backdrop' as React.ElementType)
  expect(backdrop().props.isOpen).toBe(true)
  expect(backdrop().props.isDismissable).toBe(false)
  expect(backdrop().props.isKeyboardDismissDisabled).toBe(true)
  expect(onPresent).toHaveBeenCalledTimes(1)
  act(() => {
    ref.current!.dismiss()
    ref.current!.dismiss()
  })
  expect(backdrop().props.isOpen).toBe(false)
  expect(onDismiss).toHaveBeenCalledTimes(1)
  act(() => view!.unmount())
})

it('keeps search and selected-tag chips from a compound header outside the scrolling body', () => {
  const Header = ({ children }: React.PropsWithChildren<{ title: string }>) => <>{children}</>
  const result = readSheetHeader(
    <>
      <Header title="Tags">
        <input aria-label="Search" />
      </Header>
      <span>Selected tags</span>
    </>
  )
  expect(result?.title).toBe('Tags')
  let view: ReactTestRenderer
  act(() => {
    view = create(<>{result?.children}</>)
  })
  expect(view!.root.findByType('input').props['aria-label']).toBe('Search')
  expect(view!.root.findByType('span').props.children).toBe('Selected tags')
  act(() => view!.unmount())
})
