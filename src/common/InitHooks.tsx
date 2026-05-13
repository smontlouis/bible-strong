import * as Icon from '@expo/vector-icons'
import * as Font from 'expo-font'
import * as Speech from 'expo-speech'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { AppState, AppStateStatus, InteractionManager, Platform } from 'react-native'
import { useDispatch } from 'react-redux'
import { getDefaultStore } from 'jotai/vanilla'

import {
  resetMigrationProgressFromOutsideReact,
  setMigrationProgressFromOutsideReact,
} from 'src/state/migration'
import { bibleDataRefreshSignalAtom } from '~state/app'
import MigrationModal from '~common/MigrationModal'
import { useAppRatingCheck } from '~features/app-rating/useAppRatingCheck'
import { autoBackupManager } from '~helpers/AutoBackupManager'
import { migrateBibleJsonToSqlite, needsBibleMigration } from '~helpers/bibleMigration'
import { checkBiblesDbHealth, openBiblesDb, resetBiblesDb } from '~helpers/biblesDb'
import { checkDatabasesStorage } from '~helpers/sqlite'
import { storage } from '~helpers/storage'
import { toast } from '~helpers/toast'
import useDownloadBibleResources from '~helpers/useDownloadBibleResources'
import useInitFireAuth from '~helpers/useInitFireAuth'
import useLiveUpdates from '~helpers/useLiveUpdates'
import { getChangelog, getDatabaseUpdate, getVersionUpdate } from '~redux/modules/user'
import { useTabGroupsSync } from '~state/useTabGroupsSync'

export type InitHooksProps = Record<string, never>

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

const InitHooks = (_props: InitHooksProps) => {
  useInitFireAuth()
  const { t } = useTranslation()
  const dispatch = useDispatch()

  useEffect(() => {
    // Initialize bibles.sqlite and run blocking migration if needed
    openBiblesDb()
      .then(async () => {
        // Periodic health check — only run full PRAGMA quick_check once per week
        const HEALTH_CHECK_INTERVAL = 7 * 24 * 60 * 60 * 1000
        const lastCheck = storage.getNumber('biblesDbLastHealthCheck') || 0
        const needsFullCheck = Date.now() - lastCheck > HEALTH_CHECK_INTERVAL

        if (needsFullCheck) {
          const health = await checkBiblesDbHealth()
          storage.set('biblesDbLastHealthCheck', Date.now())
          if (health !== 'ok') {
            console.warn(`[InitHooks] Bibles DB health: ${health}, resetting...`)
            await resetBiblesDb()
            toast.warning(t('bible.error.databaseRecovered'))
            return // Skip migration — DB was just recreated empty
          }
        }

        if (!needsBibleMigration()) return

        let migrationModalShown = false
        const failedVersions = await migrateBibleJsonToSqlite((current, total, versionId) => {
          // Only show migration modal when files are actually found
          // (avoids showing empty modal on fresh install with 0 JSON files)
          if (!migrationModalShown) {
            migrationModalShown = true
            setMigrationProgressFromOutsideReact({
              isActive: true,
              type: 'bible',
              overallProgress: 0,
              message: '',
            })
          }
          setMigrationProgressFromOutsideReact({
            overallProgress: current / total,
            message: `${versionId} (${current}/${total})`,
            collectionsCompleted: current,
            totalCollections: total,
          })
        })

        if (!migrationModalShown) {
          // No files to migrate (fresh install) — nothing to show
          console.log('[InitHooks] Bible migration: no files found, skipping UI')
          return
        }

        if (failedVersions.length > 0) {
          setMigrationProgressFromOutsideReact({
            overallProgress: 1,
            message: `${failedVersions.length} version(s) non migrée(s)`,
          })

          // Even with failures, some Bibles may have migrated successfully
          // Increment signal to trigger Bible tabs reload
          const store = getDefaultStore()
          store.set(bibleDataRefreshSignalAtom, (c: number) => c + 1)

          setTimeout(() => {
            resetMigrationProgressFromOutsideReact()
            console.warn('[InitHooks] Bible migration completed with failures:', failedVersions)
          }, 3000)
        } else {
          setMigrationProgressFromOutsideReact({
            overallProgress: 1,
            message: 'Migration terminée !',
          })

          // Increment signal to trigger Bible tabs reload
          const store = getDefaultStore()
          store.set(bibleDataRefreshSignalAtom, (c: number) => c + 1)

          // Hide modal after showing success message
          setTimeout(() => {
            resetMigrationProgressFromOutsideReact()
            console.log('[InitHooks] Bible migration complete, Bible tabs reloaded')
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
      // Check legacy database storage (renamed/duplicate cleanup)
      // Safe to defer: useMigrateToLanguageFolders is also deferred via InteractionManager
      checkDatabasesStorage().catch(err =>
        console.error('[InitHooks] DB storage check failed:', err)
      )

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
