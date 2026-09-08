export function getSelectionSheetBounds(
  rect: { left: number; right: number; top: number; bottom: number },
  windowWidth: number,
  windowHeight: number
) {
  const left = Math.max(0, Math.min(windowWidth, rect.left))
  const right = Math.max(left, Math.min(windowWidth, rect.right))
  const top = Math.max(0, Math.min(windowHeight, rect.top))
  const bottom = Math.max(top, Math.min(windowHeight, rect.bottom))
  return {
    left,
    right: windowWidth - right,
    bottom: windowHeight - bottom,
    width: right - left,
    height: bottom - top,
  }
}
