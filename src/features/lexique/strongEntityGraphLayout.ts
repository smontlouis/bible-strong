const GRAPH_POSITION_INDEXES = [0, 1, 2, 3, 4, 5] as const
const OPPOSITE_POSITION_INDEXES = [5, 4, 3, 2, 1, 0] as const

export const getOppositeGraphPositionIndex = (index: number) =>
  OPPOSITE_POSITION_INDEXES[index] ?? 5

export const getGraphScenePositionIndexes = (previousRelationPositionIndex?: number) => {
  const previousPositionIndex =
    previousRelationPositionIndex == null
      ? undefined
      : getOppositeGraphPositionIndex(previousRelationPositionIndex)

  return {
    previousPositionIndex,
    relationPositionIndexes: GRAPH_POSITION_INDEXES.filter(
      positionIndex => positionIndex !== previousPositionIndex
    ),
  }
}
