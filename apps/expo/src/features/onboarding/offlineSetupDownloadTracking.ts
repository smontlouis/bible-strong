import { getDownloadItemProgress, type DownloadItemState } from '~state/downloadQueue'

export type OfflineSetupDownloadTracking = {
  completed: boolean
  failedItem?: DownloadItemState
  progress: number
}

export const getOfflineSetupDownloadTracking = (
  itemIds: string[],
  states: Map<string, DownloadItemState>
): OfflineSetupDownloadTracking => {
  if (itemIds.length === 0) {
    return { completed: true, progress: 1 }
  }

  const trackedStates = itemIds.map(itemId => states.get(itemId))
  const failedItem = trackedStates.find(state => state?.status === 'failed')
  const completed = trackedStates.every(state => state?.status === 'completed')
  const progressSum = trackedStates.reduce(
    (sum, state) => sum + (state ? getDownloadItemProgress(state) : 0),
    0
  )

  return {
    completed,
    failedItem,
    progress: progressSum / itemIds.length,
  }
}
