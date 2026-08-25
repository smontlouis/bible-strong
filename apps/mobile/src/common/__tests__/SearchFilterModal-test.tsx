import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'

import SearchFilterModal from '../SearchFilterModal'

jest.mock('~common/SearchInput', () => {
  const ReactModule = jest.requireActual<typeof React>('react')
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => ReactModule.createElement('SearchInput', props),
  }
})

jest.mock('~common/sheet', () => {
  return {
    Sheet: ({ children }: React.PropsWithChildren) => <>{children}</>,
    SheetHeader: () => null,
    SheetView: ({ children }: React.PropsWithChildren) => <>{children}</>,
  }
})

describe('SearchFilterModal', () => {
  let renderer: ReactTestRenderer
  let consoleError: jest.SpyInstance

  beforeEach(() => {
    jest.useFakeTimers()
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
    act(() => {
      renderer?.unmount()
    })
    consoleError.mockRestore()
    jest.useRealTimers()
  })

  it('does not restore a stale draft after an external reset', () => {
    const onChange = jest.fn()

    act(() => {
      renderer = create(
        <SearchFilterModal
          title="Rechercher"
          placeholder="Rechercher"
          value="segond"
          onChange={onChange}
        />
      )
    })

    act(() => {
      renderer.update(
        <SearchFilterModal
          title="Rechercher"
          placeholder="Rechercher"
          value=""
          onChange={onChange}
        />
      )
      jest.advanceTimersByTime(300)
    })

    expect(onChange).not.toHaveBeenCalled()
    expect(renderer.root.findByType('SearchInput' as never).props.value).toBe('')
  })

  it('accepts a new query immediately after an external reset', () => {
    const onChange = jest.fn()

    act(() => {
      renderer = create(
        <SearchFilterModal
          title="Rechercher"
          placeholder="Rechercher"
          value="segond"
          onChange={onChange}
        />
      )
    })

    act(() => {
      renderer.update(
        <SearchFilterModal
          title="Rechercher"
          placeholder="Rechercher"
          value=""
          onChange={onChange}
        />
      )
    })
    act(() => {
      renderer.root.findByType('SearchInput' as never).props.onChangeText('lsg')
    })
    act(() => {
      jest.advanceTimersByTime(300)
    })

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('lsg')
  })
})
