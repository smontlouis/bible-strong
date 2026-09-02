import { useStore } from 'react-redux'

import AccountMigrationModal from '~features/migrations/AccountMigrationModal'
import { canStartRemoteHydration } from '~helpers/accountEntry'
import { useAccountMigrations } from '~helpers/useAccountMigrations'
import useInitFireAuth from '~helpers/useInitFireAuth'
import useLiveUpdates from '~helpers/useLiveUpdates'
import useLogin from '~helpers/useLogin'
import type { RootState } from '~redux/modules/reducer'
import { useTabGroupsSync } from '~state/useTabGroupsSync'

const InitHooks = () => {
  const accountEntryState = useInitFireAuth()
  const store = useStore<RootState>()
  const { isLogged, user } = useLogin()
  const hydrationEnabled = canStartRemoteHydration(accountEntryState)
  const accountMigrations = useAccountMigrations({
    getCurrentState: store.getState,
    activeUserId: isLogged && hydrationEnabled ? user.id : undefined,
  })

  useLiveUpdates({
    enabled: hydrationEnabled,
    runBeforeSync: accountMigrations.runBeforeSync,
    resumeToken: accountMigrations.resumeToken,
  })
  useTabGroupsSync({
    incomingEnabled: hydrationEnabled && accountMigrations.isAccountSyncReady,
    outgoingEnabled: hydrationEnabled && accountMigrations.isAccountWriteReady,
  })

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
