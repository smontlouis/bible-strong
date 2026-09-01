import { getAddedCommentaryProjectionIds } from '../selectedCommentaryAnimations'

describe('selected commentary animations', () => {
  it('does not replay entry animations when the selection is reordered', () => {
    expect(
      getAddedCommentaryProjectionIds(
        ['barnes:fr', 'acbc:fr', 'mhy-fr:fr'],
        ['mhy-fr:fr', 'barnes:fr', 'acbc:fr']
      )
    ).toEqual(new Set())
  })

  it('animates only the commentary that was added', () => {
    expect(
      getAddedCommentaryProjectionIds(
        ['barnes:fr', 'acbc:fr'],
        ['barnes:fr', 'acbc:fr', 'mhy-fr:fr']
      )
    ).toEqual(new Set(['mhy-fr:fr']))
  })

  it('does not animate every commentary when the header first mounts', () => {
    expect(getAddedCommentaryProjectionIds(undefined, ['barnes:fr', 'acbc:fr'])).toEqual(new Set())
  })
})
