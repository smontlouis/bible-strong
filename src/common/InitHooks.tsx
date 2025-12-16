import * as Speech from 'expo-speech'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { AppState, AppStateStatus, Platform } from 'react-native'
import { useDispatch } from 'react-redux'

import useInitFireAuth from '~helpers/useInitFireAuth'
import useLiveUpdates from '~helpers/useLiveUpdates'
import { autoBackupManager } from '~helpers/AutoBackupManager'
import {
  getChangelog,
  getDatabaseUpdate,
  getVersionUpdate,
} from '~redux/modules/user'
import MigrationModal from '~common/MigrationModal'

export interface InitHooksProps {}

const handleAppStateChange = async (nextAppState: AppStateStatus) => {
  if (nextAppState.match(/inactive|background/)) {
    console.log('App mode - background!')

    if (!(await Speech.isSpeakingAsync()) && Platform.OS === 'android') {
      try {
        // TODO Replace this library : @voximplant/react-native-foreground-service
        // await VIForegroundService.getInstance().stopService()
      } catch {}
    }
  }
}

const InitHooks = ({}: InitHooksProps) => {
  useInitFireAuth()
  const { t } = useTranslation()
  const dispatch = useDispatch()

  useEffect(() => {
    // Initialiser le système de backup automatique
    autoBackupManager.initialize().catch(err => {
      console.error('Failed to initialize AutoBackupManager:', err)
    })

    dispatch(getChangelog())
    dispatch(getVersionUpdate())
    dispatch(getDatabaseUpdate())
    const event = AppState.addEventListener('change', handleAppStateChange)

    return () => {
      event.remove()
    }
  }, [dispatch, t])

  useLiveUpdates()

  return <MigrationModal />
}

export default InitHooks
