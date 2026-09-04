import { openCommentaryBookSelector } from '../commentaryBookSelector'

describe('commentary book selector', () => {
  it('still opens while commentary coverage is unavailable', () => {
    const openBookSelector = jest.fn()
    const actions = {} as never
    const data = {} as never

    openCommentaryBookSelector({ openBookSelector, actions, data })

    expect(openBookSelector).toHaveBeenCalledWith({ actions, data, coverage: undefined })
  })
})
