import * as Updates from 'expo-updates'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from '~helpers/toast'

export const useUpdates = () => {
  const { t } = useTranslation()
  useEffect(() => {
    const onFetchUpdateAsync = async () => {
      try {
        if (__DEV__) return

        const update = await Updates.checkForUpdateAsync()

        if (update.isAvailable) {
          await Updates.fetchUpdateAsync()
          toast(t('app.updateReady'))
        }
      } catch (error) {}
    }
    onFetchUpdateAsync()
  }, [])
}
