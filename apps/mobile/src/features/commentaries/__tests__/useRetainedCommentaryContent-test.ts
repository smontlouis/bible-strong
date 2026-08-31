import { selectRetainedCommentaryContent } from '../useRetainedCommentaryContent'

describe('retained commentary verse content', () => {
  const verseOne = { verse: '41-1-1', text: 'Previous content' }
  const verseTwo = { verse: '41-1-2', text: 'Requested content' }

  it('keeps the last complete verse while the requested verse is loading', () => {
    expect(selectRetainedCommentaryContent(verseOne, verseTwo, false)).toBe(verseOne)
  })

  it('switches atomically when the requested verse is ready', () => {
    expect(selectRetainedCommentaryContent(verseOne, verseTwo, true)).toBe(verseTwo)
  })

  it('allows the initial loading state when no complete verse exists yet', () => {
    expect(selectRetainedCommentaryContent(undefined, verseTwo, false)).toBe(verseTwo)
  })
})
