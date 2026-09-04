import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import useRetainedCommentaryContent, {
  selectRetainedCommentaryContent,
} from '../useRetainedCommentaryContent'

describe('retained commentary verse content', () => {
  const verseOne = { verse: '41-1-1', text: 'Previous content' }
  const verseTwo = { verse: '41-1-2', text: 'Requested content' }

  beforeAll(() => {
    ;(
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true
  })

  it('keeps the last complete verse while the requested verse is loading', () => {
    expect(selectRetainedCommentaryContent(verseOne, verseTwo, false)).toBe(verseOne)
  })

  it('switches atomically when the requested verse is ready', () => {
    expect(selectRetainedCommentaryContent(verseOne, verseTwo, true)).toBe(verseTwo)
  })

  it('allows the initial loading state when no complete verse exists yet', () => {
    expect(selectRetainedCommentaryContent(undefined, verseTwo, false)).toBe(verseTwo)
  })

  it('does not rerender forever when ready content is reconstructed by its caller', () => {
    let renderer: ReactTestRenderer | undefined
    let renderCount = 0

    const Harness = () => {
      renderCount += 1
      const content = useRetainedCommentaryContent({ verse: '41-1-1' }, true)
      return React.createElement('content', content)
    }

    act(() => {
      renderer = create(React.createElement(Harness))
    })

    expect(renderCount).toBeLessThanOrEqual(2)
    act(() => renderer?.unmount())
  })
})
