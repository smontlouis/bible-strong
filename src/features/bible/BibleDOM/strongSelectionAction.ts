import { createStrongSelection } from '~helpers/strongSelection'
import type { StrongIdentity } from '~helpers/strongIdentities'
import { OPEN_STRONG_SELECTION } from './dispatch'

type StrongSelectionDispatch = (action: { type: string; payload?: unknown }) => void

export const dispatchStrongSelection = (
  dispatch: StrongSelectionDispatch,
  identities: readonly StrongIdentity[],
  book: string | number,
  version: string
) => {
  const selection = createStrongSelection(identities, book, version)
  if (!selection) return

  dispatch({
    type: OPEN_STRONG_SELECTION,
    payload: selection,
  })
}
