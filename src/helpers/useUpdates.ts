import * as Updates from 'expo-updates'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import SnackBar from '~common/SnackBar'

export const useUpdates = () => {
  const { t } = useTranslation()
  useEffect(() => {
    const onFetchUpdateAsync = async () => {
      try {
        if (__DEV__) return

        const update = await Updates.checkForUpdateAsync()

        if (update.isAvailable) {
          SnackBar.show(t('app.updateAvailable'))
          await Updates.fetchUpdateAsync()
          SnackBar.show(t('app.updateReady'))
        }
      } catch (error) {}
    }
    onFetchUpdateAsync()
  }, [])
}
