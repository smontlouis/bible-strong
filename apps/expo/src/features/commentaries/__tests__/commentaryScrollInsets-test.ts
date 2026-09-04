import { getCommentaryScrollBottomInset } from '../commentaryScrollInsets'

describe('getCommentaryScrollBottomInset', () => {
  it('keeps the tab bar clearance outside a sheet', () => {
    expect(
      getCommentaryScrollBottomInset({
        bottomBarHeight: 82,
        sheetFooterInset: 34,
      })
    ).toBe(102)
  })

  it('keeps the last commentary above a taller sheet footer', () => {
    expect(
      getCommentaryScrollBottomInset({
        bottomBarHeight: 82,
        sheetFooterInset: 126,
      })
    ).toBe(146)
  })
})
