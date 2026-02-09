import * as Icon from '@expo/vector-icons'
import * as Font from 'expo-font'
import * as Speech from 'expo-speech'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { AppState, AppStateStatus, InteractionManager, Platform } from 'react-native'
import { useDispatch } from 'react-redux'

import {
  resetMigrationProgressFromOutsideReact,
  setMigrationProgressFromOutsideReact,
} from 'src/state/migration'
import MigrationModal from '~common/MigrationModal'
import { useAppRatingCheck } from '~features/app-rating/useAppRatingCheck'
import { autoBackupManager } from '~helpers/AutoBackupManager'
import { migrateBibleJsonToSqlite, needsBibleMigration } from '~helpers/bibleMigration'
import { checkBiblesDbHealth, openBiblesDb, resetBiblesDb } from '~helpers/biblesDb'
import { toast } from '~helpers/toast'
import useDownloadBibleResources from '~helpers/useDownloadBibleResources'
import useInitFireAuth from '~helpers/useInitFireAuth'
import useLiveUpdates from '~helpers/useLiveUpdates'
import { getChangelog, getDatabaseUpdate, getVersionUpdate } from '~redux/modules/user'
import useTabGroupsSync from '~state/useTabGroupsSync'

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
        // Health check — detect corruption early
        const health = await checkBiblesDbHealth()
        if (health !== 'ok') {
          console.warn(`[InitHooks] Bibles DB health: ${health}, resetting...`)
          await resetBiblesDb()
          toast.warning(t('bible.error.databaseRecovered'))
          return // Skip migration — DB was just recreated empty
        }

        if (!needsBibleMigration()) return

        setMigrationProgressFromOutsideReact({
          isActive: true,
          type: 'bible',
          overallProgress: 0,
          message: '',
        })

        const failedVersions = await migrateBibleJsonToSqlite((current, total, versionId) => {
          setMigrationProgressFromOutsideReact({
            overallProgress: current / total,
            message: `${versionId} (${current}/${total})`,
            collectionsCompleted: current,
            totalCollections: total,
          })
        })

        if (failedVersions.length > 0) {
          setMigrationProgressFromOutsideReact({
            overallProgress: 1,
            message: `${failedVersions.length} version(s) non migrée(s)`,
          })

          setTimeout(() => {
            resetMigrationProgressFromOutsideReact()
            console.warn('[InitHooks] Bible migration completed with failures:', failedVersions)
          }, 3000)
        } else {
          setMigrationProgressFromOutsideReact({
            overallProgress: 1,
            message: 'Migration terminée !',
          })

          // Hide modal after showing success message
          setTimeout(() => {
            resetMigrationProgressFromOutsideReact()
            // No reload - app continues normally with migrated data
            console.log('[InitHooks] Bible migration complete, app continues normally')
          }, 2000)
        }
      })
      .catch(async err => {
        console.error('[InitHooks] Failed to open bibles.sqlite:', err)
        // Attempt recovery by resetting the DB
        try {
          await resetBiblesDb()
          toast.warning(t('bible.error.databaseRecovered'))
        } catch (resetErr) {
          console.error('[InitHooks] Recovery failed:', resetErr)
          toast.error(t('bible.error.databaseOpenFailed'))
        }
      })

    const event = AppState.addEventListener('change', handleAppStateChange)

    // Defer non-critical operations to after first interactions
    const deferred = InteractionManager.runAfterInteractions(() => {
      // Load custom fonts (deferred for performance)
      Font.loadAsync({
        ...Icon.Feather.font,
        ...Icon.Ionicons.font,
        'Literata Book': require('~assets/fonts/LiterataBook-Regular.otf'),
        'eina-03-bold': require('~assets/fonts/eina-03-bold.otf'),
      }).catch(err => {
        console.error('Failed to load fonts:', err)
      })

      autoBackupManager.initialize().catch(err => {
        console.error('Failed to initialize AutoBackupManager:', err)
      })

      dispatch(getChangelog())
      dispatch(getVersionUpdate())
      dispatch(getDatabaseUpdate())
    })

    return () => {
      event.remove()
      deferred.cancel()
    }
  }, [dispatch, t])

  useLiveUpdates()
  useTabGroupsSync()
  useDownloadBibleResources()
  useAppRatingCheck()

  return <MigrationModal />
}

export default InitHooks
