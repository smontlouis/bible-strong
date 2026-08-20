import { useSetAtom } from 'jotai/react'
import { getDefaultStore } from 'jotai/vanilla'
import { useEffect, useRef, useState } from 'react'
import { useDispatch, useStore } from 'react-redux'
import { toast } from '~helpers/toast'
import FireAuth, { type FireAuthProfile } from '~helpers/FireAuth'
import { autoBackupManager } from '~helpers/AutoBackupManager'
import i18n from '~i18n'
import * as UserActions from '~redux/modules/user'
import { resetUserAtomsAtom } from '../state/app'
import { RootState } from '~redux/modules/reducer'
import {
  createAccountEntryState,
  reduceAccountEntry,
  type AccountEntryClassification,
} from '~helpers/accountEntry'
import { appLogger } from '~helpers/agentObservability'
import {
  createGuestDataSnapshot,
  createGuestSnapshotImportData,
  runPendingGuestAdoption,
  type GuestAdoptionErrorCode,
} from '~helpers/guestDataAdoption'
import {
  firebaseGuestAdoptionRemote,
  getAuthenticatedUserId,
  guestAdoptionRepository,
} from '~helpers/guestDataAdoptionRuntime'
import { tabGroupsAtom } from '~state/tabs'

interface AuthError {
  code?: string
}

const getAuthError = (error: unknown): AuthError => {
  if (error && typeof error === 'object' && 'code' in error) {
    return error as AuthError
  }
  return {}
}

const useInitFireAuth = () => {
  const dispatch = useDispatch()
  const resetAtoms = useSetAtom(resetUserAtomsAtom)
  const store = useStore<RootState>()
  const [accountEntryState, setAccountEntryState] = useState(createAccountEntryState)
  const activeEntryUserIdRef = useRef<string | undefined>(undefined)
  const guestAdoptionAbortRef = useRef<AbortController | undefined>(undefined)

  useEffect(() => {
    const onLogin = async ({
      profile,
      accountEntryClassification,
    }: {
      profile: FireAuthProfile
      accountEntryClassification: AccountEntryClassification
    }) => {
      console.log(`[Auth] Bienvenue ${profile.displayName}.`)
      guestAdoptionAbortRef.current?.abort()
      activeEntryUserIdRef.current = profile.id
      let nextEntryState = reduceAccountEntry(createAccountEntryState(), {
        type: 'authentication-started',
      })
      nextEntryState = reduceAccountEntry(nextEntryState, {
        type: 'account-classified',
        classification: accountEntryClassification,
        userId: profile.id,
      })
      const guestState = store.getState()
      let pendingAdoption
      let restorePendingAfterBackup = false

      try {
        pendingAdoption = guestAdoptionRepository.getPendingForUser(profile.id)
        if (accountEntryClassification === 'new-account' && !pendingAdoption) {
          const snapshot = createGuestDataSnapshot({
            state: guestState,
            tabGroups: getDefaultStore().get(tabGroupsAtom),
          })
          pendingAdoption = guestAdoptionRepository.begin(profile.id, snapshot)
        }

        if (pendingAdoption && nextEntryState.phase === 'hydrating-account') {
          nextEntryState = reduceAccountEntry(nextEntryState, {
            type: 'pending-adoption-found',
            userId: profile.id,
          })
        }
        restorePendingAfterBackup = Boolean(
          pendingAdoption && accountEntryClassification === 'existing-account'
        )
      } catch (error) {
        const errorCode: GuestAdoptionErrorCode =
          error instanceof Error && error.message === 'GUEST_ADOPTION_CHECKPOINT_INVALID'
            ? 'GUEST_ADOPTION_CHECKPOINT_INVALID'
            : 'GUEST_ADOPTION_PENDING_UID_MISMATCH'
        nextEntryState = reduceAccountEntry(nextEntryState, {
          type: 'account-entry-failed',
          errorCode,
        })
        appLogger.warn('sync', 'account_entry.adoption_checkpoint_failed', {
          lifecycleState: nextEntryState.phase,
          classification: accountEntryClassification,
          failureStage: 'checkpoint',
          errorCode,
        })
        toast.warning(i18n.t('accountEntry.adoptionPending'))
      }

      setAccountEntryState(nextEntryState)
      dispatch(UserActions.onUserLoginSuccess({ profile }))

      if (nextEntryState.phase === 'backing-up-guest-data') {
        const backupCompleted = await autoBackupManager.createBackupNow(guestState, 'account_entry')
        if (activeEntryUserIdRef.current !== profile.id) return

        nextEntryState = reduceAccountEntry(nextEntryState, {
          type: backupCompleted ? 'backup-finished' : 'backup-failed',
        })
        if (pendingAdoption && nextEntryState.phase === 'hydrating-account') {
          nextEntryState = reduceAccountEntry(nextEntryState, {
            type: 'pending-adoption-found',
            userId: profile.id,
          })
        }
        if (restorePendingAfterBackup && pendingAdoption) {
          dispatch(
            UserActions.importData(
              createGuestSnapshotImportData(
                pendingAdoption.snapshot,
                guestState.user.bible.settings
              )
            )
          )
        }
        setAccountEntryState(nextEntryState)
        appLogger.info('sync', 'account_entry.backup_finished', {
          lifecycleState: nextEntryState.phase,
          classification: accountEntryClassification,
          backupCompleted,
        })
      }

      if (nextEntryState.phase !== 'adopting-guest-data' || !pendingAdoption) return

      const startedAt = Date.now()
      const adoptionAbortController = new AbortController()
      guestAdoptionAbortRef.current = adoptionAbortController
      const result = await runPendingGuestAdoption({
        userId: profile.id,
        repository: guestAdoptionRepository,
        remote: firebaseGuestAdoptionRemote,
        getAuthenticatedUserId,
        signal: adoptionAbortController.signal,
        getLatestSnapshot: () => {
          if (
            activeEntryUserIdRef.current !== profile.id ||
            getAuthenticatedUserId() !== profile.id
          ) {
            return undefined
          }
          return createGuestDataSnapshot({
            state: store.getState(),
            tabGroups: getDefaultStore().get(tabGroupsAtom),
          })
        },
      })
      if (guestAdoptionAbortRef.current === adoptionAbortController) {
        guestAdoptionAbortRef.current = undefined
      }
      if (activeEntryUserIdRef.current !== profile.id) return

      if (result.status === 'completed') {
        nextEntryState = reduceAccountEntry(nextEntryState, {
          type: 'adoption-finished',
          userId: profile.id,
        })
        setAccountEntryState(nextEntryState)
        appLogger.info('sync', 'account_entry.adoption_completed', {
          lifecycleState: nextEntryState.phase,
          classification: accountEntryClassification,
          durationMs: Date.now() - startedAt,
          counts: result.counts,
        })
        return
      }

      nextEntryState = reduceAccountEntry(nextEntryState, {
        type: 'adoption-failed',
        userId: profile.id,
        errorCode: result.errorCode,
      })
      setAccountEntryState(nextEntryState)
      appLogger.warn('sync', 'account_entry.adoption_pending', {
        lifecycleState: nextEntryState.phase,
        classification: accountEntryClassification,
        durationMs: Date.now() - startedAt,
        failureStage: 'adoption',
        errorCode: result.errorCode,
      })
      toast.warning(i18n.t('accountEntry.adoptionPending'))
    }

    const emailVerified = () => dispatch(UserActions.verifyEmail())
    const onUserChange = (profile: FireAuthProfile) =>
      console.log('[Auth] User changed', profile.id)
    const onLogout = async () => {
      const currentEntryUserId = activeEntryUserIdRef.current
      guestAdoptionAbortRef.current?.abort()
      guestAdoptionAbortRef.current = undefined
      activeEntryUserIdRef.current = undefined
      const currentState = store.getState()

      if (currentEntryUserId) {
        try {
          const pending = guestAdoptionRepository.getPendingForUser(currentEntryUserId)
          if (pending) {
            guestAdoptionRepository.updateSnapshot(
              currentEntryUserId,
              pending.adoptionId,
              createGuestDataSnapshot({
                state: currentState,
                tabGroups: getDefaultStore().get(tabGroupsAtom),
              })
            )
          }
        } catch {
          appLogger.warn('sync', 'account_entry.logout_checkpoint_failed', {
            failureStage: 'checkpoint',
            errorCode: 'GUEST_ADOPTION_CHECKPOINT_INVALID',
          })
        }
      }

      // PROTECTION: Créer un backup avant de déconnecter
      // Garantit qu'aucune donnée non-sync ne peut être perdue
      try {
        console.log('[Logout] Creating backup before logout...')
        await autoBackupManager.createBackupNow(currentState, 'logout')
        console.log('[Logout] Backup created successfully')
      } catch (error) {
        console.error('[Logout] Failed to create backup:', error)
        // Continue quand même avec le logout
      }

      dispatch(UserActions.onUserLogout())
      setAccountEntryState(createAccountEntryState())
      resetAtoms()
    }
    const onError = (error: unknown) => {
      const { code } = getAuthError(error)

      if (code === 'auth/internal-error') {
        toast.error(i18n.t("Une erreur s'est produite"))
      }
      if (
        code === 'auth/account-exists-with-different-credential' ||
        code === 'auth/email-already-in-use'
      ) {
        toast.error(i18n.t('Cet utilisateur existe déjà avec un autre compte.'))
      }
      if (code === 'auth/weak-password') {
        toast.error(i18n.t('Le mot de passe est trop court.'))
      }
      if (code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        toast.error(i18n.t('Mot de passe invalide ou utilisateur inexistant.'))
      }
      if (code === 'auth/invalid-email') {
        toast.error(i18n.t('Format email invalide.'))
      }

      if (code === 'auth/network-request-failed') {
        toast.error(i18n.t('A network error has occurred, please try again.'))
      }
      console.log('[Auth] Error', error)
      console.log('[Auth] Error code:', code)
    }

    FireAuth.init(onLogin, onUserChange, onLogout, emailVerified, onError, dispatch)
    return () => {
      guestAdoptionAbortRef.current?.abort()
      guestAdoptionAbortRef.current = undefined
    }
  }, [dispatch, store, resetAtoms])

  return accountEntryState
}

export default useInitFireAuth
