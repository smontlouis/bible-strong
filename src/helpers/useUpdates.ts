import { useEffect } from 'react'
import * as Updates from 'expo-updates'
import { useTranslation } from 'react-i18next'
import SnackBar from '~common/SnackBar'

export const useUpdates = () => {
  const { t } = useTranslation()
  useEffect(() => {
    const onFetchUpdateAsync = async () => {
      try {
        const update = await Updates.checkForUpdateAsync()

        if (update.isAvailable) {
          SnackBar.show(t('app.updateAvailable'))
          await Updates.fetchUpdateAsync()
          await Updates.reloadAsync()
        }
      } catch (error) {
        // You can also add an alert() to see the error message in case of an error when fetching updates.
        alert(`Error fetching latest Expo update: ${error}`)
      }
    }
    onFetchUpdateAsync()
  }, [])
}
