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
import {
  accountMigrationOrchestrator,
  prepareAccountMigrationContext,
} from '../migrations/accountMigrationRuntime'
import { clearAccountMigrationMutationJournal } from '../migrations/accountMigrationMutationJournal'
import { appLogger } from './agentObservability'

type ActiveMigrationSnapshot = Exclude<MigrationSnapshot, { status: 'idle' }>

export type AccountMigrationPresentation =
  | { kind: 'hidden' }
  | { kind: 'checking' }
  | { kind: 'active'; snapshot: ActiveMigrationSnapshot }
  | { kind: 'failed'; snapshot?: ActiveMigrationSnapshot; errorCode: string }

interface UseAccountMigrationsOptions {
  getCurrentState: () => RootState
  activeUserId?: string
  orchestrator?: AppMigrationOrchestrator<AccountMigrationContext>
  onWriteScopeOpened?: () => Promise<void>
  prepareContext?: (context: AccountMigrationContext) => Promise<AccountMigrationContext>
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
  getCurrentState,
  activeUserId,
  orchestrator = accountMigrationOrchestrator,
  onWriteScopeOpened,
  prepareContext = prepareAccountMigrationContext,
}: UseAccountMigrationsOptions) => {
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

  const refreshContext = async (
    context: AccountMigrationContext
  ): Promise<AccountMigrationContext> => {
    const preparedContext = await prepareContext(
      createAccountMigrationContext(context.userId, getCurrentState())
    )
    return { ...preparedContext, state: getCurrentState() }
  }

  const execute = async (
    context: AccountMigrationContext,
    retryFailed: boolean,
    requireConfirmation: boolean
  ): Promise<boolean> => {
    const startedAt = Date.now()
    lastContextRef.current = context
    setPresentation({ kind: 'hidden' })
    setReadyUserId(undefined)
    setWriteUserId(context.userId)
    // The app remains usable with local data while remote inspection runs. Incoming
    // hydration stays closed, while outgoing mutations are journaled so a migration
    // detected moments later can reconcile them without losing user work.
    setAccountMigrationWriteScope(context.userId, 'outgoing-only')
    setAccountMigrationInProgress(true)

    let completed = false
    try {
      const preparedContext = context.userDocument ? context : await refreshContext(context)
      lastContextRef.current = preparedContext
      const result = await runAccountMigrationSequence(
        orchestrator,
        preparedContext,
        showSnapshot,
        {
          retryFailed,
          requireConfirmation,
          refreshContext,
        }
      )
      if (activeUserRef.current !== context.userId) {
        completed = false
      } else if (result.status === 'idle') {
        setAccountMigrationWriteScope(context.userId)
        await onWriteScopeOpened?.()
        if (activeUserRef.current === context.userId) {
          clearAccountMigrationMutationJournal(context.userId)
          setPresentation({ kind: 'hidden' })
          setReadyUserId(context.userId)
          setWriteUserId(context.userId)
          appLogger.info('startup', 'account_migration.inspection_completed', {
            durationMs: Date.now() - startedAt,
          })
          completed = true
        }
      } else if (result.status === 'failed') {
        setAccountMigrationWriteScope()
        setPresentation({
          kind: 'failed',
          snapshot: result,
          errorCode: result.errorCode ?? 'APP_MIGRATION_UNEXPECTED_ERROR',
        })
      } else if (result.status === 'detected' || result.status === 'awaiting-confirmation') {
        setPresentation({ kind: 'active', snapshot: result })
      }
    } catch (error) {
      appLogger.error('startup', 'account_migration.inspection_failed', { error })
      if (activeUserRef.current === context.userId) {
        setReadyUserId(undefined)
        setWriteUserId(context.userId)
        setAccountMigrationWriteScope(context.userId, 'outgoing-only')
        setPresentation({ kind: 'hidden' })
        appLogger.warn('startup', 'account_migration.local_only', {
          errorCode: safeInspectionErrorCode(error),
        })
      }
    }
    if (activeUserRef.current === context.userId) setAccountMigrationInProgress(false)
    return completed
  }

  const runBeforeSync = async (userId: string, state: RootState): Promise<boolean> => {
    if (readyUserId === userId && activeUserRef.current === userId) return true
    if (dismissedScopeRef.current === userId) return false
    return execute(createAccountMigrationContext(userId, state), false, true)
  }

  const confirm = async (): Promise<void> => {
    const context = lastContextRef.current
    if (!context || activeUserRef.current !== context.userId) return
    setActionPending(true)
    const currentContext = createAccountMigrationContext(context.userId, getCurrentState())
    const completed = await execute(currentContext, false, false).catch(() => false)
    setActionPending(false)
    if (completed) setResumeToken(value => value + 1)
  }

  const retry = async (): Promise<void> => {
    const context = lastContextRef.current
    if (!context || activeUserRef.current !== context.userId) return
    setActionPending(true)
    const currentContext = createAccountMigrationContext(context.userId, getCurrentState())
    const completed = await execute(currentContext, true, false).catch(() => false)
    setActionPending(false)
    if (completed) setResumeToken(value => value + 1)
  }

  const continueAfterFailure = async (): Promise<void> => {
    const context = lastContextRef.current
    if (!context || presentation.kind !== 'failed') return
    setActionPending(true)
    setAccountMigrationInProgress(true)
    try {
      const result = await orchestrator.abandon(context, showSnapshot)
      if (result.status !== 'abandoned-after-failure') {
        setPresentation({
          kind: 'failed',
          snapshot: result.status === 'idle' ? undefined : result,
          errorCode:
            result.status === 'idle'
              ? 'APP_MIGRATION_ABANDON_INCOMPLETE'
              : (result.errorCode ?? 'APP_MIGRATION_ABANDON_INCOMPLETE'),
        })
      } else {
        dismissedScopeRef.current = context.userId
        setAccountMigrationWriteScope(context.userId)
        await onWriteScopeOpened?.()
        if (activeUserRef.current !== context.userId) return
        clearAccountMigrationMutationJournal(context.userId)
        setReadyUserId(context.userId)
        setWriteUserId(context.userId)
        setPresentation({ kind: 'hidden' })
        setResumeToken(value => value + 1)
      }
    } catch (error) {
      setPresentation({
        kind: 'failed',
        snapshot: presentation.snapshot,
        errorCode: safeInspectionErrorCode(error),
      })
    }
    setActionPending(false)
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
    confirm,
    continueAfterFailure,
  }
}
