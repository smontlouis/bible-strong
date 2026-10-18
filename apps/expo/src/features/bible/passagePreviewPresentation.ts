export const PASSAGE_CONTEXT_HEADER_HEIGHT = 44

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
