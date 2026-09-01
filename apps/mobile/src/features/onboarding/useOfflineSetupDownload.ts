import { useAtomValue, useSetAtom } from 'jotai/react'
import { useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'

import { downloadManager } from '~helpers/downloadManager'
import { bibleDomRemountSignalAtom } from '~state/app'
import { downloadItemStatesAtom } from '~state/downloadQueue'
import { selectedResourcesAtom } from './atom'
import {
  createDownloadItemsFromOnboardingSelections,
  getOnboardingResourceSelectionId,
} from './onboardingResources'
import { OFFLINE_SETUP_MOTION } from './offlineSetupMotion'
import { getOfflineSetupDownloadTracking } from './offlineSetupDownloadTracking'
import { getPreviewDownloadProgress } from './offlineSetupPreviewDownload'
import { getOfflineSetupSuccessTimeline } from './offlineSetupSuccessTimeline'

export type OfflineSetupDownloadPhase = 'downloading' | 'success' | 'error'
export type OfflineSetupSuccessMessage = 'ready' | 'welcome' | undefined

type Timer = ReturnType<typeof setTimeout>

const getDisplayedProgress = ({
  isPreview,
  previewProgress,
  queueProgress,
  queueTotal,
}: {
  isPreview: boolean
  previewProgress: number
  queueProgress: number
  queueTotal: number
}) => {
  if (isPreview) return previewProgress
  if (queueTotal > 0) return queueProgress
  return 0
}

const toError = (reason: unknown) => {
  if (reason instanceof Error) return reason
  return new Error(String(reason))
}

const useOfflineSetupDownload = ({
  mode,
  onComplete,
  reduceMotion,
}: {
  mode: 'onboarding' | 'preview'
  onComplete?: () => void
  reduceMotion: boolean
}) => {
  const selectedResources = useAtomValue(selectedResourcesAtom)
  const bumpBibleDomRemountSignal = useSetAtom(bibleDomRemountSignalAtom)
  const downloadItemStates = useAtomValue(downloadItemStatesAtom)
  const [phase, setPhase] = useState<OfflineSetupDownloadPhase>('downloading')
  const [error, setError] = useState<Error | null>(null)
  const [previewProgress, setPreviewProgress] = useState(0)
  const [closing, setClosing] = useState(false)
  const [successMessage, setSuccessMessage] = useState<OfflineSetupSuccessMessage>('ready')
  const [trackingStarted, setTrackingStarted] = useState(false)
  const [trackedItemIds] = useState(() =>
    createDownloadItemsFromOnboardingSelections(selectedResources).map(item => item.id)
  )
  const timers = useRef<Set<Timer>>(new Set())
  const previewInterval = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const verificationStarted = useRef(false)
  const finished = useRef(false)
  const isPreview = mode === 'preview'
  const tracking = getOfflineSetupDownloadTracking(trackedItemIds, downloadItemStates)
  const displayProgress = getDisplayedProgress({
    isPreview,
    previewProgress,
    queueProgress: tracking.progress,
    queueTotal: trackedItemIds.length,
  })
  const schedule = (action: () => void, delay: number) => {
    const timer = setTimeout(() => {
      timers.current.delete(timer)
      action()
    }, delay)
    timers.current.add(timer)
  }

  const finish = () => {
    if (finished.current) return
    finished.current = true
    setPhase('success')
    const timeline = getOfflineSetupSuccessTimeline(reduceMotion)
    schedule(() => setSuccessMessage(undefined), timeline.readyEndsAt)
    schedule(() => setSuccessMessage('welcome'), timeline.welcomeStartsAt)
    schedule(() => setClosing(true), timeline.fadeOutStartsAt)
    if (!isPreview && onComplete) schedule(onComplete, timeline.completesAt)
  }

  const fail = (reason: unknown) => {
    setError(toError(reason))
    setPhase('error')
  }

  const enqueueSelectedResources = () => {
    const items = createDownloadItemsFromOnboardingSelections(selectedResources)
    if (items.length > 0) downloadManager.enqueue(items)
    return items.length
  }

  const retry = () => {
    try {
      verificationStarted.current = false
      setError(null)
      setPhase('downloading')
      const failedItemIds = trackedItemIds.filter(
        itemId => downloadItemStates.get(itemId)?.status === 'failed'
      )
      if (failedItemIds.length > 0) {
        failedItemIds.forEach(itemId => downloadManager.retry(itemId))
        return
      }

      if (enqueueSelectedResources() === 0) void verifyAndComplete()
    } catch (itemError) {
      fail(itemError)
    }
  }

  const verifyAndComplete = async () => {
    if (verificationStarted.current) return
    verificationStarted.current = true

    try {
      downloadManager.clearCompleted()
      if (Platform.OS === 'android') {
        bumpBibleDomRemountSignal(signal => signal + 1)
      }
      finish()
    } catch (verificationError) {
      verificationStarted.current = false
      fail(verificationError)
    }
  }

  useEffect(() => {
    if (isPreview) {
      const startedAt = Date.now()
      previewInterval.current = setInterval(() => {
        setPreviewProgress(getPreviewDownloadProgress(Date.now() - startedAt))
      }, OFFLINE_SETUP_MOTION.download.preview.progressTick)
      return () => {
        if (previewInterval.current) clearInterval(previewInterval.current)
      }
    }

    try {
      if (enqueueSelectedResources() > 0) {
        setTrackingStarted(true)
      } else {
        setTrackingStarted(true)
        void verifyAndComplete()
      }
    } catch (itemError) {
      console.error(
        `Failed to create onboarding download item ${selectedResources
          .map(getOnboardingResourceSelectionId)
          .join(', ')}:`,
        itemError
      )
      fail(itemError)
    }
    // Resources are intentionally captured once when the download scene mounts.
    return undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!isPreview || previewProgress < 1 || phase !== 'downloading') return
    if (previewInterval.current) clearInterval(previewInterval.current)
    finish()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPreview, phase, previewProgress])

  useEffect(() => {
    if (isPreview || !trackingStarted || phase !== 'downloading' || !tracking.completed) return
    void verifyAndComplete()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPreview, phase, tracking.completed, trackingStarted])

  useEffect(() => {
    if (isPreview || !trackingStarted || !tracking.failedItem) return
    fail(new Error(tracking.failedItem.error || 'Download failed'))
  }, [isPreview, tracking.failedItem, trackingStarted])

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout)
      timers.current.clear()
      if (previewInterval.current) clearInterval(previewInterval.current)
    },
    []
  )

  return { closing, displayProgress, error, phase, retry, successMessage }
}

export default useOfflineSetupDownload
