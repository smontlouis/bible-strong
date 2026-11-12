import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'

import CommentariesCard from '../CommentariesCard'

const mockCommentariesTabScreen = jest.fn((_props: Record<string, unknown>) => null)

jest.mock('../CommentariesTabScreen', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => mockCommentariesTabScreen(props),
}))

// The card names its tab with i18n, whose module loads a polyfill Jest cannot run.
jest.mock('~i18n', () => ({
  __esModule: true,
  default: { t: (key: string) => key },
}))

jest.mock('~helpers/generateUUID', () => ({
  __esModule: true,
  default: () => 'commentary-card-test',
}))

describe('CommentariesCard', () => {
  let renderer: ReactTestRenderer | undefined
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
    renderer = undefined
    mockCommentariesTabScreen.mockClear()
    consoleError.mockRestore()
  })

  it('forwards the Bible version selected in the Resource modal', () => {
    const commentarySelectorRef = React.createRef()
    act(() => {
      renderer = create(
        React.createElement(CommentariesCard as React.ComponentType<Record<string, unknown>>, {
          verse: '1-1-1',
          preferredVersion: 'VUL',
          onChangeVerse: jest.fn(),
          commentarySelectorRef,
        })
      )
    })

    expect(mockCommentariesTabScreen).toHaveBeenCalledWith(
      expect.objectContaining({ preferredVersion: 'VUL', commentarySelectorRef })
    )
  })
})
