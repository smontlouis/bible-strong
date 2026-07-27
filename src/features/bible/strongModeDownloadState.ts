import { getDownloadItemProgress, type DownloadItemState } from '~state/downloadQueue'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import type { StrongBibleVersionId, StrongMode } from '~helpers/strongBiblePublications'

export type StrongModeDownloadPresentation = {
  status: 'idle' | 'active' | 'completed' | 'failed'
  progress: number
}

export const getConfirmedStrongModeDownloadIds = ({
  mode,
  version,
  requestedIds,
  pendingVersion,
  pendingMode,
  pendingInterlinearLocale,
}: {
  mode: Exclude<StrongMode, 'hidden'>
  version: StrongBibleVersionId
  requestedIds?: string[]
  pendingVersion?: StrongBibleVersionId
  pendingMode?: Exclude<StrongMode, 'hidden'>
  pendingInterlinearLocale?: ResourceLanguage
}): string[] => {
  if (requestedIds?.length) return requestedIds
  if (pendingVersion !== version || pendingMode !== mode) return []

  const strongIds = [`bible:${version}`, `bible-strong:${version}`]
  return mode === 'reverse-interlinear'
    ? [...strongIds, 'bible:BHG', `bible-interlinear:BHG:${pendingInterlinearLocale ?? 'fr'}`]
    : strongIds
}

const isActive = (state?: DownloadItemState) =>
  state?.status === 'queued' || state?.status === 'downloading' || state?.status === 'inserting'

export const getDownloadPlanPresentation = (
  states: DownloadItemState[]
): StrongModeDownloadPresentation => {
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

  if (states.every(state => state.status === 'completed')) {
    return { status: 'completed', progress: 1 }
  }
  return {
    status: states.some(state => isActive(state)) ? 'active' : 'idle',
    progress,
  }
}

export const getStrongModeDownloadPresentation = (
  bibleDownload?: DownloadItemState,
  sidecarDownload?: DownloadItemState
): StrongModeDownloadPresentation => {
  if (!sidecarDownload) return { status: 'idle', progress: 0 }

  const dependency =
    sidecarDownload.item.dependsOnId === bibleDownload?.item.id ? bibleDownload : undefined
  const plan = dependency ? [dependency, sidecarDownload] : [sidecarDownload]

  return getDownloadPlanPresentation(plan)
}
