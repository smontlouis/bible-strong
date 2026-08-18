import type { BibleError } from '~helpers/bibleErrors'
import { getBibleRecoveryActions } from '~helpers/bibleErrors'
import {
  getResourceFailurePresentation,
  resourceFailureFromBibleError,
} from '~features/resources/resourceFailure'

export const getBibleDOMErrorPresentation = (error: BibleError, isConnected: boolean) =>
  getResourceFailurePresentation(
    resourceFailureFromBibleError({
      type: error.type,
      recoveries: error.recoveries ?? getBibleRecoveryActions(error.type),
    }),
    { isOnline: isConnected }
  )
