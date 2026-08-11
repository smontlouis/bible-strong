import * as FileSystem from 'expo-file-system/legacy'
import { useAtomValue, useSetAtom } from 'jotai/react'
import { useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'

import { isVersionInstalled } from '~helpers/biblesDb'
import { downloadManager } from '~helpers/downloadManager'
import { getDefaultBibleVersion } from '~helpers/languageUtils'
import { requireBiblePath } from '~helpers/requireBiblePath'
import useLanguage from '~helpers/useLanguage'
import { bibleDomRemountSignalAtom } from '~state/app'
import { activeQueueAtom, failedItemsAtom, overallProgressAtom } from '~state/downloadQueue'
import { isOnboardingCompletedAtom, selectedResourcesAtom } from './atom'
import {
  createDownloadItemFromOnboardingSelection,
  getOnboardingResourceSelectionId,
} from './onboardingResources'
import { OFFLINE_SETUP_MOTION } from './offlineSetupMotion'
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
  reduceMotion,
}: {
  mode: 'onboarding' | 'preview'
  reduceMotion: boolean
}) => {
  const selectedResources = useAtomValue(selectedResourcesAtom)
  const setIsOnboardingCompleted = useSetAtom(isOnboardingCompletedAtom)
  const bumpBibleDomRemountSignal = useSetAtom(bibleDomRemountSignalAtom)
  const progress = useAtomValue(overallProgressAtom)
  const activeQueue = useAtomValue(activeQueueAtom)
  const failedItems = useAtomValue(failedItemsAtom)
  const lang = useLanguage()
  const [phase, setPhase] = useState<OfflineSetupDownloadPhase>('downloading')
  const [error, setError] = useState<Error | null>(null)
  const [previewProgress, setPreviewProgress] = useState(0)
  const [closing, setClosing] = useState(false)
  const [successMessage, setSuccessMessage] = useState<OfflineSetupSuccessMessage>('ready')
  const timers = useRef<Set<Timer>>(new Set())
  const previewInterval = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const verificationStarted = useRef(false)
  const finished = useRef(false)
  const isPreview = mode === 'preview'
  const displayProgress = getDisplayedProgress({
    isPreview,
    previewProgress,
    queueProgress: progress.progress,
    queueTotal: progress.total,
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
    if (!isPreview) {
      schedule(() => setIsOnboardingCompleted(true), timeline.completesAt)
    }
  }

  const fail = (reason: unknown) => {
    setError(toError(reason))
    setPhase('error')
  }

  const verifyAndComplete = async () => {
    if (verificationStarted.current) return
    verificationStarted.current = true

    try {
      const defaultVersion = getDefaultBibleVersion(lang)
      const installed = await isVersionInstalled(defaultVersion)
      if (!installed) {
        const fileInfo = await FileSystem.getInfoAsync(requireBiblePath(defaultVersion))
        if (!fileInfo.exists) {
          verificationStarted.current = false
          fail(new Error(`Download verification failed: Bible ${defaultVersion} not found`))
          return
        }
      }

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
      const items = selectedResources.map(resource =>
        createDownloadItemFromOnboardingSelection(resource)
      )
      if (items.length > 0) downloadManager.enqueue(items)
      else void verifyAndComplete()
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
    if (isPreview || phase !== 'downloading') return
    if (activeQueue.length === 0 && progress.total > 0 && progress.completed === progress.total) {
      void verifyAndComplete()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeQueue.length, isPreview, phase, progress.completed, progress.total])

  useEffect(() => {
    if (isPreview || failedItems.length === 0) return
    fail(new Error(failedItems[0].error || 'Download failed'))
  }, [failedItems, isPreview])

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout)
      timers.current.clear()
      if (previewInterval.current) clearInterval(previewInterval.current)
    },
    []
  )

  return { closing, displayProgress, error, phase, successMessage }
}

export default useOfflineSetupDownload
