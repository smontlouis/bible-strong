export const STUDY_FOOTER_HEIGHT = 50

export const getStudyEditorBottomInset = ({
  isFormSheet,
  footerVisible,
  keyboardHeight,
}: {
  isFormSheet: boolean
  footerVisible: boolean
  keyboardHeight: number
}) => (isFormSheet ? Math.max(0, keyboardHeight) + (footerVisible ? STUDY_FOOTER_HEIGHT : 0) : 0)
