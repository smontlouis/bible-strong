import { useAtomValue } from 'jotai/react'
import {
  activeQueueAtom,
  overallProgressAtom,
  failedItemsAtom,
  downloadStatusForIdAtom,
  type DownloadItemState,
  type DownloadItem,
} from '~state/downloadQueue'
import { downloadManager } from '~helpers/downloadManager'

/**
 * Hook for accessing the global download queue state and actions.
 */
export function useDownloadQueue() {
  const activeQueue = useAtomValue(activeQueueAtom)
  const progress = useAtomValue(overallProgressAtom)
  const failedItems = useAtomValue(failedItemsAtom)

  return {
    activeQueue,
    overallProgress: progress,
    failedItems,
    enqueue: (items: DownloadItem[]) => downloadManager.enqueue(items),
    cancel: (itemId: string) => downloadManager.cancel(itemId),
    cancelAll: () => downloadManager.cancelAll(),
    retry: (itemId: string) => downloadManager.retry(itemId),
    retryAllFailed: () => downloadManager.retryAllFailed(),
    clearCompleted: () => downloadManager.clearCompleted(),
  }
}

/**
 * Hook for a single item's download status. Returns undefined if not in queue.
 */
export function useDownloadItemStatus(itemId: string): DownloadItemState | undefined {
  const statusAtom = downloadStatusForIdAtom(itemId)
  return useAtomValue(statusAtom)
}
