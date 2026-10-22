import { appLogger } from './agentObservability'

/**
 * Firebase may sign out on its own (refresh token refused, account disabled or deleted) while the
 * store still shows the reader signed in. The store keeps the account and its data: the edits wait
 * in the sync queue, and the reader is invited to sign in again. Being offline never signs Firebase
 * out, so nothing here depends on the network.
 */

/**
 * An iOS launch in the background, before the first unlock, finds the keychain closed and no
 * Firebase user; Firebase restores it once the device is unlocked. The loss is only retained with
 * the app in the foreground, after this delay.
 */
export const SESSION_LOSS_GRACE_MS = 3000

export type SessionBackupTrigger = 'session_lost' | 'account_switch'

export type AuthSessionRecoveryDependencies = {
  /** The account the store shows, if any. */
  getStoredUserId(): string | undefined
  /** The account Firebase holds right now. */
  getSignedInUserId(): string | undefined
  isLogoutInProgress(): boolean
  isAppActive(): boolean
  /** Calls back each time the app comes to the foreground; returns the unsubscribe. */
  onAppActive(callback: () => void): () => void
  schedule(callback: () => void, delayMs: number): unknown
  cancelScheduled(handle: unknown): void
  /** Backs up the store as it is now; settles once the backup is written or has failed. */
  backup(trigger: SessionBackupTrigger): Promise<unknown>
  getLostUserId(): string | undefined
  setLostUserId(userId: string | undefined): void
  /** Gives the writes the server refused while the session was lost another try. */
  allowParkedRetry(userId: string): void
  /** Forgets the account the store shows, as a logout does, without signing Firebase out. */
  resetLocalAccount(): Promise<void>
}

export const createAuthSessionRecovery = (dependencies: AuthSessionRecoveryDependencies) => {
  let scheduledCheck: unknown
  let stopWaitingForForeground: (() => void) | undefined

  const cancelCheck = () => {
    stopWaitingForForeground?.()
    stopWaitingForForeground = undefined
    if (scheduledCheck !== undefined) dependencies.cancelScheduled(scheduledCheck)
    scheduledCheck = undefined
  }

  const confirmLoss = () => {
    scheduledCheck = undefined
    const storedUserId = dependencies.getStoredUserId()
    if (!storedUserId || dependencies.isLogoutInProgress()) return
    if (dependencies.getSignedInUserId() === storedUserId) return
    if (dependencies.getLostUserId() === storedUserId) return

    dependencies.setLostUserId(storedUserId)
    appLogger.warn('sync', 'auth.session_lost', {
      otherAccountSignedIn: Boolean(dependencies.getSignedInUserId()),
    })
    void dependencies.backup('session_lost')
  }

  const checkAfterGrace = () => {
    stopWaitingForForeground?.()
    stopWaitingForForeground = undefined
    if (scheduledCheck !== undefined) dependencies.cancelScheduled(scheduledCheck)
    scheduledCheck = dependencies.schedule(confirmLoss, SESSION_LOSS_GRACE_MS)
  }

  return {
    /** Firebase reports no user. */
    firebaseSignedOut() {
      cancelCheck()
      if (!dependencies.getStoredUserId() || dependencies.isLogoutInProgress()) return
      if (dependencies.isAppActive()) {
        checkAfterGrace()
        return
      }
      stopWaitingForForeground = dependencies.onAppActive(checkAfterGrace)
    },

    /**
     * Firebase holds `userId` and the app is about to enter that account. The same account resumes
     * with its local data and queued writes. Another account first takes the place of the one the
     * store shows, after a backup of it: its edits never reach the new account. Returns that switch
     * to wait for, if there is one.
     */
    accountSignedIn(userId: string): Promise<void> | undefined {
      cancelCheck()
      const storedUserId = dependencies.getStoredUserId()
      const wasLost = dependencies.getLostUserId() !== undefined
      if (wasLost) dependencies.setLostUserId(undefined)

      if (!storedUserId || storedUserId === userId) {
        if (wasLost) {
          dependencies.allowParkedRetry(userId)
          appLogger.info('sync', 'auth.session_restored')
        }
        return undefined
      }

      appLogger.info('sync', 'auth.account_switched', { sessionWasLost: wasLost })
      return (async () => {
        await dependencies.backup('account_switch')
        await dependencies.resetLocalAccount()
      })()
    },

    /** The reader signed out: the store forgets the account. */
    loggedOut() {
      cancelCheck()
      if (dependencies.getLostUserId() !== undefined) dependencies.setLostUserId(undefined)
    },

    dispose() {
      cancelCheck()
    },
  }
}

export type AuthSessionRecovery = ReturnType<typeof createAuthSessionRecovery>
