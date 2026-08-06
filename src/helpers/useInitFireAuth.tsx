import { useSetAtom } from 'jotai/react'
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

  useEffect(() => {
    const onLogin = async ({
      profile,
      accountEntryClassification,
    }: {
      profile: FireAuthProfile
      accountEntryClassification: AccountEntryClassification
    }) => {
      console.log(`[Auth] Bienvenue ${profile.displayName}.`)
      activeEntryUserIdRef.current = profile.id
      let nextEntryState = reduceAccountEntry(createAccountEntryState(), {
        type: 'authentication-started',
      })
      nextEntryState = reduceAccountEntry(nextEntryState, {
        type: 'account-classified',
        classification: accountEntryClassification,
        userId: profile.id,
      })
      setAccountEntryState(nextEntryState)

      const guestState = store.getState()
      dispatch(UserActions.onUserLoginSuccess({ profile }))

      if (nextEntryState.phase !== 'backing-up-guest-data') return

      const backupCompleted = await autoBackupManager.createBackupNow(guestState, 'account_entry')
      if (activeEntryUserIdRef.current !== profile.id) return

      nextEntryState = reduceAccountEntry(nextEntryState, {
        type: backupCompleted ? 'backup-finished' : 'backup-failed',
      })
      setAccountEntryState(nextEntryState)
      appLogger.info('sync', 'account_entry.backup_finished', {
        lifecycleState: nextEntryState.phase,
        classification: accountEntryClassification,
        backupCompleted,
      })
    }

    const emailVerified = () => dispatch(UserActions.verifyEmail())
    const onUserChange = (profile: FireAuthProfile) =>
      console.log('[Auth] User changed', profile.id)
    const onLogout = async () => {
      activeEntryUserIdRef.current = undefined
      // PROTECTION: Créer un backup avant de déconnecter
      // Garantit qu'aucune donnée non-sync ne peut être perdue
      try {
        console.log('[Logout] Creating backup before logout...')
        const currentState = store.getState()
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
  }, [dispatch, store, resetAtoms])

  return accountEntryState
}

export default useInitFireAuth
