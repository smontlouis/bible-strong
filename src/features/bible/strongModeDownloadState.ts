import { getDownloadItemProgress, type DownloadItemState } from '~state/downloadQueue'

export type StrongModeDownloadPresentation = {
  status: 'idle' | 'active' | 'completed' | 'failed'
  progress: number
}

const isActive = (state?: DownloadItemState) =>
  state?.status === 'queued' || state?.status === 'downloading' || state?.status === 'inserting'

export const getStrongModeDownloadPresentation = (
  bibleDownload?: DownloadItemState,
  sidecarDownload?: DownloadItemState
): StrongModeDownloadPresentation => {
  if (!sidecarDownload) return { status: 'idle', progress: 0 }

  const dependency =
    sidecarDownload.item.dependsOnId === bibleDownload?.item.id ? bibleDownload : undefined
  const plan = dependency ? [dependency, sidecarDownload] : [sidecarDownload]

  if (plan.some(state => state.status === 'failed' || state.status === 'cancelled')) {
    return { status: 'failed', progress: 0 }
  }

  const totalSize = plan.reduce((sum, state) => sum + state.item.estimatedSize, 0)
  const progress =
    totalSize > 0
      ? plan.reduce(
          (sum, state) => sum + getDownloadItemProgress(state) * state.item.estimatedSize,
          0
        ) / totalSize
      : 0

  if (sidecarDownload.status === 'completed') {
    return { status: 'completed', progress: 1 }
  }

  return {
    status: plan.some(state => isActive(state)) ? 'active' : 'idle',
    progress,
  }
}
