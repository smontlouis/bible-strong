import type { ResourceLanguage } from './databaseTypes'
import type { StrongBibleVersionId, StrongMode } from './strongBiblePublications'

export interface StrongModeState {
  strongMode?: StrongMode
  pendingStrongModeVersionId?: StrongBibleVersionId
  pendingStrongMode?: Exclude<StrongMode, 'hidden'>
  pendingStrongInterlinearLocale?: ResourceLanguage
}

export const applyStrongModeSelection = (state: StrongModeState, strongMode: StrongMode): void => {
  state.strongMode = strongMode
  state.pendingStrongModeVersionId = undefined
  state.pendingStrongMode = undefined
  state.pendingStrongInterlinearLocale = undefined
}

export const applyPendingStrongMode = (
  state: StrongModeState,
  versionId: StrongBibleVersionId | undefined,
  pendingStrongMode: Exclude<StrongMode, 'hidden'>,
  pendingStrongInterlinearLocale?: ResourceLanguage
): void => {
  state.pendingStrongModeVersionId = versionId
  state.pendingStrongMode = versionId ? pendingStrongMode : undefined
  state.pendingStrongInterlinearLocale = versionId ? pendingStrongInterlinearLocale : undefined
}
