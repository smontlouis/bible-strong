import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from 'react-redux'

import AccountMigrationModal from '~features/migrations/AccountMigrationModal'
import { usePremiumIdentity } from '~features/premium/usePremiumIdentity'
import { useStudyLinksOfflineCopy } from '~features/resources/useStudyLinksOfflineCopy'
import { canStartRemoteHydration } from '~helpers/accountEntry'
import { appLogger } from '~helpers/agentObservability'
import { resumePendingAnnotationMigration } from '~helpers/annotationMigrationJournal'
import { checkBiblesDbHealth, openBiblesDb, resetBiblesDb } from '~helpers/biblesDb'
import { storage } from '~helpers/storage'
import { useRemoteConfig } from '~helpers/useRemoteConfig'
import { toast } from '~helpers/toast'
import { useAccountMigrations } from '~helpers/useAccountMigrations'
import useInitFireAuth from '~helpers/useInitFireAuth'
import useLiveUpdates from '~helpers/useLiveUpdates'
import useLogin from '~helpers/useLogin'
import type { RootState } from '~redux/modules/reducer'
import { useTabGroupsSync } from '~state/useTabGroupsSync'

const HEALTH_CHECK_INTERVAL = 7 * 24 * 60 * 60 * 1000

let biblesDbOpenPromise: ReturnType<typeof openBiblesDb> | undefined
const ensureBiblesDbOpen = (): ReturnType<typeof openBiblesDb> => {
  if (!biblesDbOpenPromise) biblesDbOpenPromise = openBiblesDb()
  return biblesDbOpenPromise
}

/**
 * The desktop app's startup hooks (ADR-0107): those of the web workspace, plus the local
 * Bible database the Offline copies of Bibles live in, as on mobile. A desktop installation
 * never held the mobile app's earlier JSON Bibles, so no Bible migration runs here.
 */
const InitHooks = () => {
  const accountEntryState = useInitFireAuth()
  const { t } = useTranslation()
  const store = useStore<RootState>()
  const { isLogged, isSessionLost, user } = useLogin()
  const hydrationEnabled = canStartRemoteHydration(accountEntryState)
  const accountMigrations = useAccountMigrations({
    getCurrentState: store.getState,
    activeUserId: isLogged && hydrationEnabled ? user.id : undefined,
    onWriteScopeOpened: async () => {
      await ensureBiblesDbOpen()
      await resumePendingAnnotationMigration()
    },
  })

  useEffect(() => {
    ensureBiblesDbOpen()
      .then(async () => {
        const lastCheck = storage.getNumber('biblesDbLastHealthCheck') || 0
        if (Date.now() - lastCheck <= HEALTH_CHECK_INTERVAL) return
        const health = await checkBiblesDbHealth()
        storage.set('biblesDbLastHealthCheck', Date.now())
        if (health !== 'ok') {
          await resetBiblesDb()
          toast.warning(t('bible.error.databaseRecovered'))
        }
      })
      .catch(async error => {
        appLogger.captureError('startup', 'bibles_db.open_failed', error)
        try {
          await resetBiblesDb()
          toast.warning(t('bible.error.databaseRecovered'))
        } catch {
          toast.error(t('bible.error.databaseOpenFailed'))
        }
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useLiveUpdates({
    enabled: hydrationEnabled,
    runBeforeSync: accountMigrations.runBeforeSync,
    resumeToken: accountMigrations.resumeToken,
  })
  // While the session is lost nothing comes from the server, and local changes wait in the queue.
  useTabGroupsSync({
    incomingEnabled: hydrationEnabled && accountMigrations.isAccountSyncReady && !isSessionLost,
    outgoingEnabled: (hydrationEnabled && accountMigrations.isAccountWriteReady) || isSessionLost,
  })
  usePremiumIdentity()
  useRemoteConfig()
  useStudyLinksOfflineCopy()

  return (
    <AccountMigrationModal
      presentation={accountMigrations.presentation}
      isActionPending={accountMigrations.isActionPending}
      onConfirm={accountMigrations.confirm}
      onRetry={accountMigrations.retry}
      onContinue={accountMigrations.continueAfterFailure}
    />
  )
}

export default InitHooks
