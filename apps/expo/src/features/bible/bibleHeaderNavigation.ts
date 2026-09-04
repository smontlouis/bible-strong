type BibleBackButtonOptions = {
  isFormSheet?: boolean
  isInTab?: boolean
  canGoBackInStack: boolean
}

export const shouldShowBibleBackButton = ({
  isFormSheet,
  isInTab,
  canGoBackInStack,
}: BibleBackButtonOptions) => (isFormSheet ? canGoBackInStack : !isInTab)
