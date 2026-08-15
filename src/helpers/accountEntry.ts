import type { GuestAdoptionErrorCode } from '~helpers/guestDataAdoption'

export type AccountEntryClassification =
  | 'new-account'
  | 'existing-account'
  | 'provider-link'
  | 'restore-session'
  | 'unknown'

export type AccountEntryOperation =
  | 'email-registration'
  | 'email-login'
  | 'provider-sign-in'
  | 'provider-link'
  | 'restore-session'

export type AccountEntryClassificationInput = {
  operation: AccountEntryOperation
  credentialIsNewUser?: boolean
}

const UNRESOLVED_ACCOUNT_ENTRY_STORAGE_KEY = 'accountEntry.unresolved.v1'

export interface AccountEntryClassificationStorage {
  getString(key: string): string | undefined
  set(key: string, value: string): void
  remove(key: string): void
}

export interface UnresolvedAccountEntryRepository {
  has(userId: string): boolean
  remember(userId: string): void
  clear(userId: string): void
}

export const createUnresolvedAccountEntryRepository = (
  storage: AccountEntryClassificationStorage
): UnresolvedAccountEntryRepository => ({
  has(userId) {
    const raw = storage.getString(UNRESOLVED_ACCOUNT_ENTRY_STORAGE_KEY)
    if (!raw) return false
    try {
      const checkpoint = JSON.parse(raw) as { version?: unknown; userId?: unknown }
      if (checkpoint.version !== 1 || typeof checkpoint.userId !== 'string') return true
      return checkpoint.userId === userId
    } catch {
      return true
    }
  },
  remember(userId) {
    storage.set(UNRESOLVED_ACCOUNT_ENTRY_STORAGE_KEY, JSON.stringify({ version: 1, userId }))
  },
  clear(userId) {
    const raw = storage.getString(UNRESOLVED_ACCOUNT_ENTRY_STORAGE_KEY)
    if (!raw) return
    try {
      const checkpoint = JSON.parse(raw) as { userId?: unknown }
      if (checkpoint.userId !== userId) return
    } catch {
      // A successful explicit classification may recover an invalid local checkpoint.
    }
    storage.remove(UNRESOLVED_ACCOUNT_ENTRY_STORAGE_KEY)
  },
})

export const preserveUnresolvedAccountEntryClassification = ({
  classification,
  userId,
  repository,
}: {
  classification: AccountEntryClassification
  userId: string
  repository: UnresolvedAccountEntryRepository
}): AccountEntryClassification => {
  const resolved =
    classification === 'restore-session' && repository.has(userId) ? 'unknown' : classification
  if (resolved === 'unknown') repository.remember(userId)
  else repository.clear(userId)
  return resolved
}

export const classifyAccountEntry = ({
  operation,
  credentialIsNewUser,
}: AccountEntryClassificationInput): AccountEntryClassification => {
  if (operation === 'email-registration') {
    return credentialIsNewUser === false ? 'unknown' : 'new-account'
  }
  if (operation === 'email-login') {
    return credentialIsNewUser === true ? 'unknown' : 'existing-account'
  }
  if (operation === 'provider-link') {
    return credentialIsNewUser === true ? 'unknown' : 'provider-link'
  }
  if (operation === 'restore-session') {
    return credentialIsNewUser === undefined ? 'restore-session' : 'unknown'
  }
  if (credentialIsNewUser === true) return 'new-account'
  if (credentialIsNewUser === false) return 'existing-account'
  return 'unknown'
}

type AccountEntryAttemptResult = {
  classification: AccountEntryClassification
  userId?: string
}

type AccountEntryAttempt = {
  complete(result: { userId: string; credentialIsNewUser?: boolean }): void
  fail(): void
}

type PendingAccountEntryAttempt = {
  operation: AccountEntryOperation
  promise: Promise<AccountEntryAttemptResult>
  resolve(result: AccountEntryAttemptResult): void
}

export class AccountEntryAttemptCoordinator {
  private pending?: PendingAccountEntryAttempt

  begin(operation: AccountEntryOperation): AccountEntryAttempt {
    this.pending?.resolve({ classification: 'unknown' })

    let resolveAttempt!: (result: AccountEntryAttemptResult) => void
    const pending: PendingAccountEntryAttempt = {
      operation,
      promise: new Promise(resolve => {
        resolveAttempt = resolve
      }),
      resolve: result => resolveAttempt(result),
    }
    this.pending = pending

    return {
      complete: ({ userId, credentialIsNewUser }) => {
        pending.resolve({
          classification: classifyAccountEntry({ operation, credentialIsNewUser }),
          userId,
        })
      },
      fail: () => {
        if (this.pending === pending) this.pending = undefined
        pending.resolve({ classification: 'unknown' })
      },
    }
  }

  async classifyAuthenticatedUser(userId: string): Promise<AccountEntryClassification> {
    const pending = this.pending
    if (!pending) return 'restore-session'

    const result = await pending.promise
    if (this.pending === pending) this.pending = undefined
    if (result.userId !== userId) return 'unknown'
    return result.classification
  }
}

export type AccountEntryPhase =
  | 'guest-active'
  | 'authenticating'
  | 'classifying-account-transition'
  | 'backing-up-guest-data'
  | 'adopting-guest-data'
  | 'hydrating-account'
  | 'live-sync-active'
  | 'recoverable-error'

export type AccountEntryState = {
  phase: AccountEntryPhase
  classification?: AccountEntryClassification
  userId?: string
  errorCode?: 'ACCOUNT_ENTRY_UID_CHANGED' | GuestAdoptionErrorCode
}

export type AccountEntryEvent =
  | { type: 'authentication-started' }
  | {
      type: 'account-classified'
      classification: AccountEntryClassification
      userId: string
    }
  | { type: 'backup-finished' }
  | { type: 'backup-failed' }
  | { type: 'pending-adoption-found'; userId: string }
  | { type: 'adoption-finished'; userId: string }
  | {
      type: 'account-entry-failed'
      errorCode: Exclude<NonNullable<AccountEntryState['errorCode']>, 'ACCOUNT_ENTRY_UID_CHANGED'>
    }
  | {
      type: 'adoption-failed'
      userId: string
      errorCode: Exclude<NonNullable<AccountEntryState['errorCode']>, 'ACCOUNT_ENTRY_UID_CHANGED'>
    }

export const createAccountEntryState = (): AccountEntryState => ({ phase: 'guest-active' })

export const reduceAccountEntry = (
  state: AccountEntryState,
  event: AccountEntryEvent
): AccountEntryState => {
  if (event.type === 'authentication-started') {
    return { phase: 'authenticating' }
  }

  if (event.type === 'account-classified') {
    if (state.phase !== 'authenticating' && state.phase !== 'classifying-account-transition') {
      return state
    }
    if (event.classification === 'unknown') {
      return {
        phase: 'classifying-account-transition',
        classification: event.classification,
        userId: event.userId,
      }
    }
    if (event.classification === 'provider-link' || event.classification === 'restore-session') {
      return {
        phase: 'hydrating-account',
        classification: event.classification,
        userId: event.userId,
      }
    }
    return {
      phase: 'backing-up-guest-data',
      classification: event.classification,
      userId: event.userId,
    }
  }

  if (event.type === 'account-entry-failed') {
    if (state.phase === 'guest-active') return state
    return { ...state, phase: 'recoverable-error', errorCode: event.errorCode }
  }

  if (event.type === 'backup-finished' || event.type === 'backup-failed') {
    if (state.phase !== 'backing-up-guest-data') return state
    return {
      ...state,
      phase: state.classification === 'new-account' ? 'adopting-guest-data' : 'hydrating-account',
    }
  }

  if (event.type === 'pending-adoption-found') {
    if (state.phase !== 'hydrating-account') return state
    if (event.userId !== state.userId) {
      return { ...state, phase: 'recoverable-error', errorCode: 'ACCOUNT_ENTRY_UID_CHANGED' }
    }
    return { ...state, phase: 'adopting-guest-data', errorCode: undefined }
  }

  if (state.phase !== 'adopting-guest-data') return state
  if (event.userId !== state.userId) {
    return {
      ...state,
      phase: 'recoverable-error',
      errorCode: 'ACCOUNT_ENTRY_UID_CHANGED',
    }
  }

  if (event.type === 'adoption-failed') {
    return { ...state, phase: 'recoverable-error', errorCode: event.errorCode }
  }

  return { ...state, phase: 'hydrating-account', errorCode: undefined }
}

export const canStartRemoteHydration = (state: AccountEntryState): boolean =>
  state.phase === 'hydrating-account' || state.phase === 'live-sync-active'
