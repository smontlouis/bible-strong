import { getCurrentWindow, ProgressBarStatus } from '@tauri-apps/api/window'
import { useAtomValue } from 'jotai/react'
import { useEffect } from 'react'

import { appLogger } from '~helpers/agentObservability'
import { isQueueProcessingAtom, overallProgressAtom } from '~state/downloadQueue'

/**
 * The share of the Offline copies the queue has installed, as a whole percent, while it runs;
 * nothing once it stops, done or failed. Whole percents keep the calls to the shell few.
 */
export const dockProgress = (
  processing: boolean,
  overall: { total: number; progress: number }
): number | null =>
  processing && overall.total > 0
    ? Math.min(100, Math.max(0, Math.round(overall.progress * 100)))
    : null

/**
 * While Offline copies install, the Dock icon (macOS) or the taskbar button (Windows) shows how
 * far the queue has gone, as browsers do for their downloads.
 */
export const useDesktopDownloadProgress = () => {
  const processing = useAtomValue(isQueueProcessingAtom)
  const overall = useAtomValue(overallProgressAtom)
  const percent = dockProgress(processing, overall)

  useEffect(() => {
    getCurrentWindow()
      .setProgressBar(
        percent === null
          ? { status: ProgressBarStatus.None }
          : { status: ProgressBarStatus.Normal, progress: percent }
      )
      .catch(error =>
        appLogger.warn('startup', 'desktop.progress_bar_failed', { error: String(error) })
      )
  }, [percent])
}
