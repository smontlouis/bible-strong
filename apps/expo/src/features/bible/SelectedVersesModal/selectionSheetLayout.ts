// Each group fits four actions without horizontal padding.
export const SELECTION_GROUP_WIDTH = 300
export const SELECTION_EXPANDED_WIDTH = SELECTION_GROUP_WIDTH * 3

export function getSelectionSheetMaxWidth(viewportWidth: number) {
  return Math.min(Math.max(0, viewportWidth), SELECTION_EXPANDED_WIDTH + 32)
}
