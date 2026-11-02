import { useEffect } from 'react'
import { createStudyLinksDownloadItem } from '~helpers/downloadItemFactory'
import { downloadManager } from '~helpers/downloadManager'
import { needsStudyLinksCopy } from './studyLinksOfflineCopy'
import { useOfflineResourceRegistry } from './useOfflineResourceRegistry'

/** Keeps the links on the device. The queue waits for a network, and a failure retries at launch. */
export const useStudyLinksOfflineCopy = () => {
  const needed = needsStudyLinksCopy(useOfflineResourceRegistry())

  useEffect(() => {
    if (needed) downloadManager.enqueue([createStudyLinksDownloadItem()])
  }, [needed])
}
