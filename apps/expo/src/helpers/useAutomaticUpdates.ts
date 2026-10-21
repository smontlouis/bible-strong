import * as Updates from 'expo-updates'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { AppState } from 'react-native'

import { appLogger } from './agentObservability'
import { areAutomaticUpdatesEnabled } from './runtimeConfig'
import { toast } from './toast'

type UpdateClient = Pick<typeof Updates, 'checkForUpdateAsync' | 'fetchUpdateAsync'>

type AutomaticUpdateOptions = {
  updates: UpdateClient
  updateAvailableMessage: string
  updateReadyMessage: string
  notifyAvailable: (message: string) => void
  notifyReady: (message: string) => void
}

export const checkAndApplyAutomaticUpdate = async ({
  updates,
  updateAvailableMessage,
  updateReadyMessage,
  notifyAvailable,
  notifyReady,
}: AutomaticUpdateOptions): Promise<boolean> => {
  const update = await updates.checkForUpdateAsync()

  // A rollback to the embedded JavaScript is not "available", yet it still has to be fetched.
  if (!update.isAvailable && !update.isRollBackToEmbedded) return false

  notifyAvailable(updateAvailableMessage)
  await updates.fetchUpdateAsync()
  notifyReady(updateReadyMessage)

  return true
}

type AutomaticUpdaterOptions = AutomaticUpdateOptions & {
  onError: (error: unknown) => void
  onRetry?: () => void
}

/**
 * One automatic update per launch. A check or a download that fails, typically cut short when
 * the app leaves the foreground, leaves the next attempt free to run; the « available » notice
 * shows once, and only the first failure is reported.
 */
export const createAutomaticUpdater = () => {
  let state: 'idle' | 'running' | 'done' = 'idle'
  let announced = false
  let reported = false

  return async ({ onError, onRetry, notifyAvailable, ...options }: AutomaticUpdaterOptions) => {
    if (state !== 'idle') return
    if (reported) onRetry?.()
    state = 'running'
    try {
      await checkAndApplyAutomaticUpdate({
        ...options,
        notifyAvailable: message => {
          if (announced) return
          announced = true
          notifyAvailable(message)
        },
      })
      state = 'done'
    } catch (error) {
      state = 'idle'
      if (reported) return
      reported = true
      onError(error)
    }
  }
}

const runAutomaticUpdate = createAutomaticUpdater()

export const useAutomaticUpdates = () => {
  const { t } = useTranslation()

  useEffect(() => {
    if (__DEV__ || !areAutomaticUpdatesEnabled) return

    const attempt = () =>
      void runAutomaticUpdate({
        updates: Updates,
        updateAvailableMessage: t('app.updateAvailable'),
        updateReadyMessage: t('app.updateReady'),
        notifyAvailable: toast.info,
        notifyReady: toast.success,
        onError: error => appLogger.captureError('startup', 'automatic_update.failed', error),
        onRetry: () => appLogger.info('startup', 'automatic_update.retry'),
      })

    attempt()
    // The AppState subscription is an external system whose lifecycle follows this component:
    // https://react.dev/learn/synchronizing-with-effects#step-3-add-cleanup-if-needed
    const subscription = AppState.addEventListener('change', appState => {
      if (appState === 'active') attempt()
    })
    return () => subscription.remove()
  }, [t])
}
