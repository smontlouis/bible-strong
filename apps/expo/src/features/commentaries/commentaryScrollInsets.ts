export const getCommentaryScrollBottomInset = ({
  bottomBarHeight,
  sheetFooterInset,
  spacing = 20,
}: {
  bottomBarHeight: number
  sheetFooterInset: number
  spacing?: number
}) => spacing + Math.max(bottomBarHeight, sheetFooterInset)
