import { createStrongSelection } from '~helpers/strongSelection'
import { OPEN_STRONG_SELECTION } from './dispatch'

type StrongSelectionDispatch = (action: { type: string; payload?: unknown }) => void

export const dispatchStrongSelection = (
  dispatch: StrongSelectionDispatch,
  references: readonly string[],
  book: string | number,
  version: string
) => {
  const selection = createStrongSelection(references, book, version)
  if (!selection) return

  dispatch({
    type: OPEN_STRONG_SELECTION,
    payload: selection,
  })
}
