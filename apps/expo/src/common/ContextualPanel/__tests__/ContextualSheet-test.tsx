/* eslint-disable import/no-duplicates -- Test both platform adapters explicitly. */
import React, { act, createRef } from 'react'
import { create, type ReactTestRenderer } from 'react-test-renderer'
import ContextualSheet from '../ContextualSheet'
import WebContextualSheet from '../ContextualSheet.web'
import type { SheetRef } from '~common/sheet'

jest.mock('~common/sheet', () => ({ Sheet: 'NativeSheet' }))
jest.mock('../index', () => {
  const React = jest.requireActual('react')
  const { usePanelNavigation } = jest.requireActual('../usePanelNavigation')
  return {
    __esModule: true,
    default: function MockPanel(props: import('../types').ContextualPanelProps) {
      const panel = usePanelNavigation(props)
      React.useImperativeHandle(props.controllerRef, () => ({
        present: () => (panel.isOpen ? panel.navigation.close() : panel.present()),
        dismiss: panel.navigation.close,
      }))
      return React.createElement('WebPanel', { ...props, isOpen: panel.isOpen })
    },
  }
})

beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
})

it('preserves native sheet props, dimensions and lifecycle callbacks', () => {
  const ref = createRef<SheetRef>()
  const onPresent = jest.fn()
  let view: ReactTestRenderer
  act(() => {
    view = create(
      <ContextualSheet
        ref={ref}
        snapPoints={[1]}
        onPresent={onPresent}
        panelWidth={500}
        panelTitle="Web title"
        header={<React.Fragment>Native header</React.Fragment>}
      >
        Content
      </ContextualSheet>
    )
  })
  const sheet = view!.root.findByType('NativeSheet' as React.ElementType)
  expect(sheet.props.snapPoints).toEqual([1])
  expect(sheet.props.maxWidth).toBeUndefined()
  expect(sheet.props.panelWidth).toBeUndefined()
  expect(sheet.props.onPresent).toBe(onPresent)
  expect(sheet.props.header.props.children).toBe('Native header')
  act(() => view!.unmount())
})

it('supports imperative open, trigger toggle and dismiss, with fixed header and footer slots', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document')
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { addEventListener: jest.fn(), removeEventListener: jest.fn() },
  })
  const ref = createRef<SheetRef>()
  const onPresent = jest.fn()
  const onDismiss = jest.fn()
  let view: ReactTestRenderer
  try {
    act(() => {
      view = create(
        <WebContextualSheet
          ref={ref}
          onPresent={onPresent}
          onDismiss={onDismiss}
          panelTitle="Versions"
          panelHeaderContent={<span>Search</span>}
          footer={() => <span>Save</span>}
        >
          List
        </WebContextualSheet>
      )
    })
    const panel = () => view!.root.findByType('WebPanel' as React.ElementType)
    act(() => ref.current!.present())
    expect(panel().props.isOpen).toBe(true)
    expect(onPresent).toHaveBeenCalledTimes(1)
    expect(panel().props.screens.content.headerContent.props.children).toBe('Search')
    expect(panel().props.screens.content.footer).toBeTruthy()
    act(() => ref.current!.present())
    expect(panel().props.isOpen).toBe(false)
    expect(onDismiss).toHaveBeenCalledTimes(1)
    act(() => ref.current!.present())
    act(() => {
      ref.current!.dismiss()
      ref.current!.dismiss()
    })
    expect(panel().props.isOpen).toBe(false)
    expect(onDismiss).toHaveBeenCalledTimes(2)
    act(() => view!.unmount())
  } finally {
    if (original) Object.defineProperty(globalThis, 'document', original)
    else Reflect.deleteProperty(globalThis, 'document')
  }
})
