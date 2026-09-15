export const PASSAGE_CONTEXT_HEADER_HEIGHT = 44

export const getPassageContextHeaderHeight = (
  focusVerses: readonly (string | number)[] | null | undefined,
  annotationMode = false
) => (focusVerses?.length && !annotationMode ? PASSAGE_CONTEXT_HEADER_HEIGHT : 0)

/** Keep the normal chapter menu and its order, except parallel display in focus. */
export function getPassagePreviewMenuActions<T extends { id?: string }>(actions: T[]): T[] {
  return actions.filter(action => action.id !== 'parallel')
}
