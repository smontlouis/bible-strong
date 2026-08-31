import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'

import MultipleChoiceFilterModal from '../MultipleChoiceFilterModal'

jest.mock('react-native', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return {
    TouchableOpacity: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      ReactModule.createElement('TouchableOpacity', props, children),
  }
})

jest.mock('@emotion/native', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  const createStyledComponent = (type: React.ElementType) => () =>
    function StyledComponent({
      children,
      ...props
    }: React.PropsWithChildren<Record<string, unknown>>) {
      return ReactModule.createElement(type, props, children)
    }

  return {
    __esModule: true,
    default: (type: React.ElementType) => createStyledComponent(type),
  }
})

jest.mock('~common/sheet', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  type MockFlatListProps = {
    data: Record<string, unknown>[]
    renderItem: (args: { item: Record<string, unknown>; index: number }) => React.ReactNode
  }

  return {
    Sheet: ReactModule.forwardRef(
      (
        {
          children,
          header,
          ...props
        }: React.PropsWithChildren<{ header?: React.ReactNode; snapPoints?: number[] }>,
        _ref
      ) => ReactModule.createElement('Sheet', props, header, children)
    ),
    SheetHeader: ({ title }: { title: string }) =>
      ReactModule.createElement('SheetHeader', { title }),
    SheetFlatList: ({ data, renderItem }: MockFlatListProps) => (
      <>
        {data.map((item, index) => (
          <ReactModule.Fragment key={String(item.value)}>
            {renderItem({ item, index })}
          </ReactModule.Fragment>
        ))}
      </>
    ),
  }
})

jest.mock('~common/ui/Checkbox', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => ReactModule.createElement('Checkbox', props),
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

describe('MultipleChoiceFilterModal', () => {
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

  it('toggles choices without dismissing the sheet', () => {
    const onToggle = jest.fn()

    act(() => {
      renderer = create(
        <MultipleChoiceFilterModal
          title="Content"
          selectedValues={['notes']}
          options={[
            { value: 'notes', label: 'Notes' },
            { value: 'tags', label: 'Tags' },
          ]}
          onToggle={onToggle}
        />
      )
    })

    const notes = renderer.root.findByProps({ accessibilityLabel: 'Notes' })
    const tags = renderer.root.findByProps({ accessibilityLabel: 'Tags' })

    expect(notes.props.accessibilityState).toEqual({ checked: true })
    expect(tags.props.accessibilityState).toEqual({ checked: false })

    act(() => tags.props.onPress())

    expect(onToggle).toHaveBeenCalledWith('tags')
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('constrains long lists to a full-height scrollable sheet', () => {
    act(() => {
      renderer = create(
        <MultipleChoiceFilterModal
          title="Movements"
          selectedValues={[]}
          options={Array.from({ length: 24 }, (_, index) => ({
            value: `movement-${index}`,
            label: `Movement ${index}`,
          }))}
          onToggle={jest.fn()}
        />
      )
    })

    expect(renderer.root.find(node => String(node.type) === 'Sheet').props.snapPoints).toEqual([1])
  })
})
