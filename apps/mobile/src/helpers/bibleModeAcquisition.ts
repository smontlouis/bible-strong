import type { ResourceLanguage } from '~helpers/databaseTypes'
import type { InterlinearDisplayMode } from '~helpers/interlinearDisplayMode'
import type { StrongBibleVersionId, StrongMode } from '~helpers/strongBiblePublications'
import { getInterlinearLocalePriority } from '~helpers/interlinearDisplayMode'
import { getDownloadItemProgress, type DownloadItemState } from '~state/downloadQueue'

export type PendingBibleModeAcquisition =
  | {
      kind: 'strong'
      versionId: StrongBibleVersionId
      mode: Exclude<StrongMode, 'hidden'>
      interlinearLocale?: ResourceLanguage
      planIds: string[]
    }
  | {
      kind: 'interlinear'
      mode: InterlinearDisplayMode
      locale: ResourceLanguage
      planIds: string[]
    }

export type BibleModeAcquisitionPresentation = {
  status: 'idle' | 'active' | 'completed' | 'failed'
  progress: number
}

const getPlannedStates = (
  acquisition: PendingBibleModeAcquisition,
  statesById: ReadonlyMap<string, DownloadItemState>
): DownloadItemState[] =>
  acquisition.planIds.flatMap(id => {
    const state = statesById.get(id)
    return state ? [state] : []
  })

export const getBibleModeAcquisitionPresentation = (
  acquisition: PendingBibleModeAcquisition | undefined,
  statesById: ReadonlyMap<string, DownloadItemState>
): BibleModeAcquisitionPresentation => {
  if (!acquisition) return { status: 'idle', progress: 0 }
  const states = getPlannedStates(acquisition, statesById)
  if (!states.length) return { status: 'idle', progress: 0 }
  if (states.some(state => state.status === 'failed' || state.status === 'cancelled')) {
    return { status: 'failed', progress: 0 }
  }

  const totalSize = states.reduce((sum, state) => sum + state.item.estimatedSize, 0)
  const progress =
    totalSize > 0
      ? states.reduce(
          (sum, state) => sum + getDownloadItemProgress(state) * state.item.estimatedSize,
          0
        ) / totalSize
      : 0

  if (
    states.length === acquisition.planIds.length &&
    states.every(state => state.status === 'completed')
  ) {
    return { status: 'completed', progress: 1 }
  }

  const active = states.some(
    state =>
      state.status === 'queued' || state.status === 'downloading' || state.status === 'inserting'
  )
  return { status: active ? 'active' : 'idle', progress }
}

export const getBibleModeAcquisitionQueueOutcome = (
  acquisition: PendingBibleModeAcquisition,
  statesById: ReadonlyMap<string, DownloadItemState>
): 'waiting' | 'failed' | 'verify' | 'reconcile' => {
  const states = getPlannedStates(acquisition, statesById)
  if (states.length === 0) return 'reconcile'
  if (states.some(state => state.status === 'failed' || state.status === 'cancelled')) {
    return 'failed'
  }
  if (
    states.length === acquisition.planIds.length &&
    states.every(state => state.status === 'completed')
  ) {
    return 'verify'
  }
  return 'waiting'
}

type BibleModeAvailabilityDependencies = {
  getStrongAvailability: (versionId: StrongBibleVersionId) => Promise<{ status: string }>
  getInterlinearAvailability: (locale: ResourceLanguage) => Promise<{ status: string }>
}

export const verifyBibleModeAcquisition = async (
  acquisition: PendingBibleModeAcquisition,
  dependencies: BibleModeAvailabilityDependencies
): Promise<boolean> => {
  if (acquisition.kind === 'interlinear') {
    return (
      (await dependencies.getInterlinearAvailability(acquisition.locale)).status === 'available'
    )
  }

  if ((await dependencies.getStrongAvailability(acquisition.versionId)).status !== 'available') {
    return false
  }
  if (acquisition.mode === 'visible') return true

  for (const locale of getInterlinearLocalePriority(acquisition.interlinearLocale ?? 'fr')) {
    if ((await dependencies.getInterlinearAvailability(locale)).status === 'available') {
      return true
    }
  }
  return false
}

export const applyBibleModeAcquisitionOutcome = (
  acquisition: PendingBibleModeAcquisition,
  succeeded: boolean,
  callbacks: {
    finish: (succeeded: boolean) => void
    onSucceeded: (acquisition: PendingBibleModeAcquisition) => void
  }
): void => {
  callbacks.finish(succeeded)
  if (succeeded) callbacks.onSucceeded(acquisition)
}
