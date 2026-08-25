import * as Updates from 'expo-updates'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

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

  if (!update.isAvailable) return false

  notifyAvailable(updateAvailableMessage)
  await updates.fetchUpdateAsync()
  notifyReady(updateReadyMessage)

  return true
}

export const useAutomaticUpdates = () => {
  const { t } = useTranslation()
  const hasCheckedRef = useRef(false)

  useEffect(() => {
    if (__DEV__ || !areAutomaticUpdatesEnabled || hasCheckedRef.current) return
    hasCheckedRef.current = true

    void checkAndApplyAutomaticUpdate({
      updates: Updates,
      updateAvailableMessage: t('app.updateAvailable'),
      updateReadyMessage: t('app.updateReady'),
      notifyAvailable: toast.info,
      notifyReady: toast.success,
    }).catch(error => {
      appLogger.captureError('startup', 'automatic_update.failed', error)
    })
  }, [t])
}
