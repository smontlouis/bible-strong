import * as Speech from 'expo-speech'
import * as Updates from 'expo-updates'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { AppState, AppStateStatus, Platform } from 'react-native'
import { useDispatch } from 'react-redux'

import useInitFireAuth from '~helpers/useInitFireAuth'
import useLiveUpdates from '~helpers/useLiveUpdates'
import useTabGroupsSync from '~state/useTabGroupsSync'
import useDownloadBibleResources from '~helpers/useDownloadBibleResources'
import { autoBackupManager } from '~helpers/AutoBackupManager'
import { openBiblesDb } from '~helpers/biblesDb'
import { needsBibleMigration, migrateBibleJsonToSqlite } from '~helpers/bibleMigration'
import { setMigrationProgressFromOutsideReact } from 'src/state/migration'
import { getChangelog, getDatabaseUpdate, getVersionUpdate } from '~redux/modules/user'
import MigrationModal from '~common/MigrationModal'

export interface InitHooksProps {}

const handleAppStateChange = async (nextAppState: AppStateStatus) => {
  if (nextAppState.match(/inactive|background/)) {
    console.log('[Common] App mode - background!')

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
    // Initialize bibles.sqlite and run blocking migration if needed
    openBiblesDb()
      .then(async () => {
        if (!needsBibleMigration()) return

        setMigrationProgressFromOutsideReact({
          isActive: true,
          type: 'bible',
          overallProgress: 0,
          message: '',
        })

        await migrateBibleJsonToSqlite((current, total, versionId) => {
          setMigrationProgressFromOutsideReact({
            overallProgress: current / total,
            message: `${versionId} (${current}/${total})`,
            collectionsCompleted: current,
            totalCollections: total,
          })
        })

        setMigrationProgressFromOutsideReact({
          overallProgress: 1,
          message: 'Terminé !',
        })

        setTimeout(() => Updates.reloadAsync(), 1000)
      })
      .catch(err => {
        console.error('[InitHooks] Failed to open bibles.sqlite:', err)
      })

    // Initialiser le système de backup automatique
    autoBackupManager.initialize().catch(err => {
      console.error('Failed to initialize AutoBackupManager:', err)
    })

    // @ts-ignore
    dispatch(getChangelog())
    // @ts-ignore
    dispatch(getVersionUpdate())
    // @ts-ignore
    dispatch(getDatabaseUpdate())
    const event = AppState.addEventListener('change', handleAppStateChange)

    return () => {
      event.remove()
    }
  }, [dispatch, t])

  useLiveUpdates()
  useTabGroupsSync()
  useDownloadBibleResources()

  return <MigrationModal />
}

export default InitHooks
