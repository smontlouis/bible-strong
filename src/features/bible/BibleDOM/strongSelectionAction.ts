import { createStrongSelection } from '~helpers/strongSelection'
import type { StrongIdentity } from '~helpers/strongIdentities'
import { OPEN_STRONG_SELECTION } from './dispatch'

type StrongSelectionDispatch = (action: { type: string; payload?: unknown }) => void

export const getStrongSelectionWordFromTextSegment = (
  textSegment: string | undefined
): string | undefined => {
  const word = textSegment
    ?.trim()
    .replace(/^[\p{P}\s]+|[\p{P}\s]+$/gu, '')
    .trim()
  return word || undefined
}

export const dispatchStrongSelection = (
  dispatch: StrongSelectionDispatch,
  identities: readonly StrongIdentity[],
  book: string | number,
  version: string,
  context?: { word?: string; chapter?: string | number; verse?: string | number }
) => {
  const selection = createStrongSelection(identities, book, version, context)
  if (!selection) return

  dispatch({
    type: OPEN_STRONG_SELECTION,
    payload: selection,
  })
}
