import { shouldShowBibleBackButton } from '../bibleHeaderNavigation'

describe('shouldShowBibleBackButton', () => {
  it('hides the back button on the root screen of a Bible form sheet', () => {
    expect(
      shouldShowBibleBackButton({
        isFormSheet: true,
        isInTab: false,
        canGoBackInStack: false,
      })
    ).toBe(false)
  })

  it('shows the back button after navigating inside a Bible form sheet', () => {
    expect(
      shouldShowBibleBackButton({
        isFormSheet: true,
        isInTab: false,
        canGoBackInStack: true,
      })
    ).toBe(true)
  })

  it('keeps the existing back button outside tabs for non-sheet screens', () => {
    expect(
      shouldShowBibleBackButton({
        isFormSheet: false,
        isInTab: false,
        canGoBackInStack: false,
      })
    ).toBe(true)
  })
})
