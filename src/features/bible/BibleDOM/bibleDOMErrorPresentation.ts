import type { BibleError } from '~helpers/bibleErrors'
import { getBibleRecoveryActions } from '~helpers/bibleErrors'
import {
  getResourceFailurePresentation,
  resourceFailureFromBibleError,
} from '~features/resources/resourceFailure'

export const getBibleDOMErrorPresentation = (
  error: BibleError,
  isConnected: boolean,
  { onlineOnly = false }: { onlineOnly?: boolean } = {}
) => {
  const presentation = getResourceFailurePresentation(
    resourceFailureFromBibleError({
      type: error.type,
      recoveries: error.recoveries ?? getBibleRecoveryActions(error.type),
    }),
    { isOnline: isConnected }
  )

  if (!onlineOnly) return presentation

  return {
    ...presentation,
    actions: presentation.actions.filter(action => action === 'retry'),
  }
}
