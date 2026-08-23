import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'

import ChoiceFilterModal from '../ChoiceFilterModal'

jest.mock('react-native', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return {
    Pressable: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      ReactModule.createElement('Pressable', props, children),
  }
})

jest.mock('@emotion/native', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return {
    __esModule: true,
    default: (type: React.ElementType) => () =>
      function StyledComponent({
        children,
        ...props
      }: React.PropsWithChildren<Record<string, unknown>>) {
        return ReactModule.createElement(type, props, children)
      },
  }
})

jest.mock('~common/sheet', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return {
    Sheet: ReactModule.forwardRef(
      ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>, _ref) =>
        ReactModule.createElement('Sheet', props, children)
    ),
    SheetHeader: ({ title }: { title: string }) =>
      ReactModule.createElement('SheetHeader', { title }),
    SheetFlatList: (props: Record<string, unknown>) =>
      ReactModule.createElement('SheetFlatList', props),
  }
})

jest.mock('~common/ui/Radio', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => ReactModule.createElement('Radio', props),
  }
})

jest.mock('~common/ui/Text', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return {
    __esModule: true,
    default: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      ReactModule.createElement('Text', props, children),
  }
})

describe('ChoiceFilterModal', () => {
  let renderer: ReactTestRenderer
  let consoleError: jest.SpyInstance

  beforeEach(() => {
    ;(
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true
    consoleError = jest.spyOn(console, 'error').mockImplementation((message, ...args) => {
      if (typeof message === 'string' && message.startsWith('react-test-renderer is deprecated')) {
        return
      }
      console.warn(message, ...args)
    })
  })

  afterEach(() => {
    act(() => renderer?.unmount())
    consoleError.mockRestore()
  })

  it('uses a scrollable full-height sheet for a long choice list', () => {
    act(() => {
      renderer = create(
        <ChoiceFilterModal
          title="Version"
          selectedValue="V1"
          options={Array.from({ length: 12 }, (_, index) => ({
            value: `V${index + 1}`,
            label: `Version ${index + 1}`,
          }))}
          onSelect={jest.fn()}
        />
      )
    })

    expect(renderer.root.find(node => String(node.type) === 'Sheet').props.snapPoints).toEqual([1])
  })
})
