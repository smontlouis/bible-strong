import { useEffect, useRef, useState } from 'react'

import type { RootState } from '~redux/modules/reducer'
import { setAccountMigrationInProgress, setAccountMigrationWriteScope } from '~state/migration'
import type {
  AppMigrationOrchestrator,
  MigrationSnapshot,
} from '../migrations/appMigrationOrchestrator'
import {
  createAccountMigrationContext,
  runAccountMigrationSequence,
  type AccountMigrationContext,
} from '../migrations/accountMigrationRegistry'
import { accountMigrationOrchestrator } from '../migrations/accountMigrationRuntime'
import { clearAccountMigrationMutationJournal } from '../migrations/accountMigrationMutationJournal'

type ActiveMigrationSnapshot = Exclude<MigrationSnapshot, { status: 'idle' }>

export type AccountMigrationPresentation =
  | { kind: 'hidden' }
  | { kind: 'checking' }
  | { kind: 'active'; snapshot: ActiveMigrationSnapshot }
  | { kind: 'failed'; snapshot?: ActiveMigrationSnapshot; errorCode: string }

interface UseAccountMigrationsOptions {
  activeUserId?: string
  orchestrator?: AppMigrationOrchestrator<AccountMigrationContext>
  onWriteScopeOpened?: () => Promise<void>
}

const isTerminal = (snapshot: MigrationSnapshot): boolean =>
  snapshot.status === 'completed' || snapshot.status === 'abandoned-after-failure'

const safeInspectionErrorCode = (error: unknown): string => {
  if (error instanceof Error && error.message.startsWith('APP_MIGRATION_')) {
    return error.message
  }
  return 'APP_MIGRATION_ACCOUNT_INSPECTION_FAILED'
}

export const useAccountMigrations = ({
  activeUserId,
  orchestrator = accountMigrationOrchestrator,
  onWriteScopeOpened,
}: UseAccountMigrationsOptions = {}) => {
  const [presentation, setPresentation] = useState<AccountMigrationPresentation>({
    kind: 'hidden',
  })
  const [resumeToken, setResumeToken] = useState(0)
  const [readyUserId, setReadyUserId] = useState<string>()
  const [writeUserId, setWriteUserId] = useState<string>()
  const [isActionPending, setActionPending] = useState(false)
  const lastContextRef = useRef<AccountMigrationContext | undefined>(undefined)
  const dismissedScopeRef = useRef<string | undefined>(undefined)
  const activeUserRef = useRef(activeUserId)
  activeUserRef.current = activeUserId

  useEffect(() => {
    lastContextRef.current = undefined
    dismissedScopeRef.current = undefined
    setPresentation({ kind: 'hidden' })
    setActionPending(false)
    setReadyUserId(undefined)
    setWriteUserId(undefined)
    setAccountMigrationInProgress(false)
    setAccountMigrationWriteScope()
  }, [activeUserId])

  const showSnapshot = (snapshot: MigrationSnapshot): void => {
    const context = lastContextRef.current
    if (!context || activeUserRef.current !== context.userId || snapshot.status === 'idle') return
    if (snapshot.status === 'failed') {
      setPresentation({
        kind: 'failed',
        snapshot,
        errorCode: snapshot.errorCode ?? 'APP_MIGRATION_UNEXPECTED_ERROR',
      })
    } else if (!isTerminal(snapshot)) {
      setPresentation({ kind: 'active', snapshot })
    }
  }

  const execute = async (
    context: AccountMigrationContext,
    retryFailed: boolean
  ): Promise<boolean> => {
    lastContextRef.current = context
    setPresentation({ kind: 'checking' })
    setReadyUserId(undefined)
    setWriteUserId(undefined)
    setAccountMigrationWriteScope()
    setAccountMigrationInProgress(true)

    try {
      const result = await runAccountMigrationSequence(orchestrator, context, showSnapshot, {
        retryFailed,
      })
      if (activeUserRef.current !== context.userId) return false
      if (result.status === 'idle') {
        setAccountMigrationWriteScope(context.userId)
        await onWriteScopeOpened?.()
        if (activeUserRef.current !== context.userId) return false
        clearAccountMigrationMutationJournal(context.userId)
        setPresentation({ kind: 'hidden' })
        setReadyUserId(context.userId)
        setWriteUserId(context.userId)
        return true
      }
      if (result.status === 'failed') {
        setAccountMigrationWriteScope()
        setPresentation({
          kind: 'failed',
          snapshot: result,
          errorCode: result.errorCode ?? 'APP_MIGRATION_UNEXPECTED_ERROR',
        })
        return false
      }
      return false
    } catch (error) {
      if (activeUserRef.current === context.userId) {
        setReadyUserId(undefined)
        setAccountMigrationWriteScope()
        setPresentation({ kind: 'failed', errorCode: safeInspectionErrorCode(error) })
      }
      return false
    } finally {
      if (activeUserRef.current === context.userId) {
        setAccountMigrationInProgress(false)
      }
    }
  }

  const runBeforeSync = async (userId: string, state: RootState): Promise<boolean> => {
    if (readyUserId === userId && activeUserRef.current === userId) return true
    if (dismissedScopeRef.current === userId) return false
    return execute(createAccountMigrationContext(userId, state), false)
  }

  const retry = async (): Promise<void> => {
    const context = lastContextRef.current
    if (!context || activeUserRef.current !== context.userId) return
    setActionPending(true)
    const completed = await execute(context, true)
    setActionPending(false)
    if (completed) setResumeToken(value => value + 1)
  }

  const continueAfterFailure = (): void => {
    const context = lastContextRef.current
    if (!context || presentation.kind !== 'failed') return
    dismissedScopeRef.current = context.userId
    setReadyUserId(undefined)
    setWriteUserId(context.userId)
    // Incoming listeners remain blocked, while new canonical local mutations can still use
    // Firestore's durable offline queue until the account migration is retried next launch.
    setAccountMigrationWriteScope(context.userId, 'outgoing-only')
    setPresentation({ kind: 'hidden' })
    setAccountMigrationInProgress(false)
  }

  return {
    presentation,
    isActionPending,
    resumeToken,
    isAccountSyncReady: Boolean(activeUserId && readyUserId === activeUserId),
    isAccountWriteReady: Boolean(activeUserId && writeUserId === activeUserId),
    runBeforeSync,
    retry,
    continueAfterFailure,
  }
}
