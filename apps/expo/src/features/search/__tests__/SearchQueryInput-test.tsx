import React, { useState } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import SearchQueryInput from '../SearchQueryInput'

const mockDismiss = jest.fn()
jest.mock('react-native', () => ({ Keyboard: { dismiss: () => mockDismiss() } }))
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
jest.mock('~common/ui/Box', () => {
  const React = jest.requireActual('react')
  const Box = (props: object) => React.createElement('Box', props)
  return { __esModule: true, default: Box, HStack: Box, TouchableBox: Box }
})
jest.mock('~common/ui/Text', () => {
  const React = jest.requireActual('react')
  return { __esModule: true, default: (props: object) => React.createElement('Text', props) }
})
let mockField: {
  value: string
  returnKeyType: string
  onChangeText(value: string): void
  onSubmitEditing(): void
  onDelete(): void
  onBlur(): void
}
jest.mock('~common/SearchInput', () => ({
  __esModule: true,
  default: (props: typeof mockField) => {
    mockField = props
    return null
  },
}))

beforeAll(() => {
  ;(
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true
})

beforeEach(() => {
  jest.useFakeTimers()
  mockDismiss.mockClear()
})

afterEach(() => jest.useRealTimers())

it('debounces deletions for 800 ms, keeps spaces, and cancels a pending search on clear', () => {
  const submissions = jest.fn()
  let parentRenders = 0
  function Harness() {
    parentRenders++
    const [query, setQuery] = useState('Dieu parle tantôt cependant')
    return (
      <SearchQueryInput
        query={query}
        inputRef={{ current: null }}
        onSubmit={value => {
          submissions(value)
          setQuery(value)
        }}
      />
    )
  }
  let tree!: ReactTestRenderer
  try {
    act(() => {
      tree = create(<Harness />)
    })
    const before = parentRenders
    const initial = 'Dieu parle tantôt cependant'
    for (let length = initial.length - 1; length >= 'Dieu parle tantôt'.length; length--) {
      act(() => mockField.onChangeText(initial.slice(0, length)))
      act(() => jest.advanceTimersByTime(100))
    }
    expect(parentRenders).toBe(before)
    expect(submissions).not.toHaveBeenCalled()
    act(() => jest.advanceTimersByTime(699))
    expect(submissions).not.toHaveBeenCalled()
    act(() => jest.advanceTimersByTime(1))
    expect(submissions.mock.calls).toEqual([['Dieu parle tantôt']])
    expect(mockDismiss).not.toHaveBeenCalled()

    act(() => mockField.onChangeText('Dieu parle '))
    act(() => jest.advanceTimersByTime(800))
    expect(mockField.value).toBe('Dieu parle ')
    expect(submissions).toHaveBeenLastCalledWith('Dieu parle')

    act(() => mockField.onChangeText('Dieu parle encore'))
    act(() => mockField.onDelete())
    act(() => jest.advanceTimersByTime(800))
    expect(submissions.mock.calls).toEqual([['Dieu parle tantôt'], ['Dieu parle'], ['']])
  } finally {
    act(() => tree?.unmount())
  }
})

it('keeps repeated deletions local, then submits once from the search key', () => {
  const initial = 'Dieu parle tantôt cependant'
  const target = 'Dieu parle tantôt'
  const submissions = jest.fn()
  const saveDraft = jest.fn()
  let parentRenders = 0
  function Harness() {
    parentRenders++
    const [query, setQuery] = useState(initial)
    return (
      <SearchQueryInput
        query={query}
        inputRef={{ current: null }}
        onSaveDraft={saveDraft}
        onSubmit={value => {
          submissions(value)
          setQuery(value)
        }}
      />
    )
  }
  let tree!: ReactTestRenderer
  try {
    act(() => {
      tree = create(<Harness />)
    })
    const before = parentRenders
    for (let length = initial.length - 1; length >= target.length; length--) {
      act(() => mockField.onChangeText(initial.slice(0, length)))
    }
    expect(mockField.value).toBe(target)
    expect(mockField.returnKeyType).toBe('search')
    expect(parentRenders).toBe(before)
    expect(submissions).not.toHaveBeenCalled()
    expect(saveDraft).not.toHaveBeenCalled()
    act(() => mockField.onSubmitEditing())
    expect(submissions.mock.calls).toEqual([[target]])
    expect(mockDismiss).toHaveBeenCalled()
    act(() => mockField.onDelete())
    expect(submissions.mock.calls).toEqual([[target], ['']])
    expect(mockField.value).toBe('')
  } finally {
    act(() => tree?.unmount())
  }
})

it('restores an unsent draft after remount, saves on blur, and respects external submissions', () => {
  const draftKey = {}
  const saveDraft = jest.fn()
  const submit = jest.fn()
  const render = (query: string) => (
    <SearchQueryInput
      query={query}
      draftKey={draftKey}
      inputRef={{ current: null }}
      onSaveDraft={saveDraft}
      onSubmit={submit}
    />
  )
  let tree!: ReactTestRenderer
  try {
    act(() => {
      tree = create(render('Dieu parle tantôt cependant'))
    })
    act(() => mockField.onChangeText('Dieu parle tantôt'))
    act(() => tree.unmount())
    expect(saveDraft).not.toHaveBeenCalled()
    act(() => {
      tree = create(render('Dieu parle tantôt cependant'))
    })
    expect(mockField.value).toBe('Dieu parle tantôt')
    act(() => mockField.onBlur())
    expect(saveDraft).toHaveBeenCalledWith('Dieu parle tantôt')
    act(() => tree.update(render('Jean 3:16')))
    expect(mockField.value).toBe('Jean 3:16')
  } finally {
    act(() => tree?.unmount())
  }
})
