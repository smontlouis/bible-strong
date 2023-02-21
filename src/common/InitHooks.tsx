import * as Updates from 'expo-updates'
import * as Speech from 'expo-speech'
import VIForegroundService from '@voximplant/react-native-foreground-service'
import { useEffect } from 'react'
import { TFunction, useTranslation } from 'react-i18next'
import { AppState, AppStateStatus, Platform } from 'react-native'
import { useDispatch } from 'react-redux'

import SnackBar from '~common/SnackBar'
import useInitFireAuth from '~helpers/useInitFireAuth'
import useLiveUpdates from '~helpers/useLiveUpdates'
import {
  getChangelog,
  getDatabaseUpdate,
  getVersionUpdate,
} from '~redux/modules/user'

export interface InitHooksProps {}

const handleAppStateChange = async (nextAppState: AppStateStatus) => {
  if (nextAppState.match(/inactive|background/)) {
    console.log('App mode - background!')

    if (!(await Speech.isSpeakingAsync()) && Platform.OS === 'android') {
      try {
        await VIForegroundService.getInstance().stopService()
      } catch {}
    }
  }
}

const updateApp = async (t: TFunction<'translation'>) => {
  if (__DEV__) return

  const update = await Updates.checkForUpdateAsync()

  if (update.isAvailable) {
    SnackBar.show(t('app.updateAvailable'))
    await Updates.fetchUpdateAsync()
    SnackBar.show(t('app.updateReady'))
    // await Updates.reloadAsync()
  }
}

const InitHooks = ({}: InitHooksProps) => {
  useInitFireAuth()
  const { t } = useTranslation()
  const dispatch = useDispatch()

  useEffect(() => {
    dispatch(getChangelog())
    dispatch(getVersionUpdate())
    dispatch(getDatabaseUpdate())
    updateApp(t)
    AppState.addEventListener('change', handleAppStateChange)

    return () => {
      AppState.removeEventListener('change', handleAppStateChange)
    }
  }, [dispatch, t])

  useLiveUpdates()

  return null
}

export default InitHooks
