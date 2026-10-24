/** The pill that floats under the header in focus and plan modes. */
export const PASSAGE_PILL_HEIGHT = 40
/** The room the text keeps under the header so that its first line starts below the pill. */
export const PASSAGE_CONTEXT_HEADER_HEIGHT = PASSAGE_PILL_HEIGHT + 12

/** One subheader at most: the plan banner carries the passage controls in plan mode. */
export const getPassageContextHeaderHeight = (
  focusVerses: readonly (string | number)[] | null | undefined,
  annotationMode = false,
  inPlan = false
) => ((focusVerses?.length || inPlan) && !annotationMode ? PASSAGE_CONTEXT_HEADER_HEIGHT : 0)

/** Keep the normal chapter menu and its order, except parallel display in focus. */
export function getPassagePreviewMenuActions<T extends { id?: string }>(actions: T[]): T[] {
  return actions.filter(action => action.id !== 'parallel')
}
