import * as Updates from 'expo-updates'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { appLogger } from '~helpers/agentObservability'
import { toast } from '~helpers/toast'

export type AppUpdateCheck = { check: () => Promise<void>; isChecking: boolean }

/** The settings row that looks for an update: an OTA update on iOS and Android. */
export const useAppUpdateCheck = (): AppUpdateCheck | null => {
  const { t } = useTranslation()
  const [isChecking, setIsChecking] = useState(false)

  const check = async () => {
    if (isChecking) return
    setIsChecking(true)
    try {
      const result = await Updates.checkForUpdateAsync()
      // A rollback to the embedded JavaScript is not "available", yet it still has to be fetched.
      if (result.isAvailable || result.isRollBackToEmbedded) {
        toast.info(t('app.updateAvailable'))
        await Updates.fetchUpdateAsync()
        toast.success(t('app.updateReady'))
      } else {
        toast.info(t('app.noUpdateAvailable'))
      }
    } catch (error) {
      appLogger.warn('startup', 'ota.manual_check_failed', { error })
      toast.error(t('app.updateError'))
    } finally {
      setIsChecking(false)
    }
  }

  return { check, isChecking }
}
