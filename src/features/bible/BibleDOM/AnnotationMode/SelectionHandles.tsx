'use dom'

import { SelectionHandle } from './HighlightComponents'

export interface SelectionHandlesProps {
  hasSelection: boolean
  startPosition: { x: number; y: number } | null
  endPosition: { x: number; y: number } | null
}

export function SelectionHandles({
  hasSelection,
  startPosition,
  endPosition,
}: SelectionHandlesProps): JSX.Element | null {
  if (!hasSelection) return null

  return (
    <>
      {startPosition && (
        <SelectionHandle
          $top={startPosition.y}
          $left={startPosition.x}
          $position="start"
        />
      )}
      {endPosition && (
        <SelectionHandle
          $top={endPosition.y}
          $left={endPosition.x}
          $position="end"
        />
      )}
    </>
  )
}
