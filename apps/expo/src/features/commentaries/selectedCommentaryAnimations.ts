import type { CommentaryProjectionId } from './commentarySelection'

export const getAddedCommentaryProjectionIds = (
  previous: readonly CommentaryProjectionId[] | undefined,
  current: readonly CommentaryProjectionId[]
) => {
  if (!previous) return new Set<CommentaryProjectionId>()

  const previousIds = new Set(previous)
  return new Set(current.filter(projectionId => !previousIds.has(projectionId)))
}
