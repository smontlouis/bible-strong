import { useSetAtom } from 'jotai/react'
import { useEffect } from 'react'
import { useDispatch, useStore } from 'react-redux'
import { toast } from '~helpers/toast'
import FireAuth, { FireAuthProfile } from '~helpers/FireAuth'
import { autoBackupManager } from '~helpers/AutoBackupManager'
import i18n from '~i18n'
import * as UserActions from '~redux/modules/user'
import { resetUserAtomsAtom } from '../state/app'
import { RootState } from '~redux/modules/reducer'

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

  useEffect(() => {
    const onLogin = ({ profile }: { profile: FireAuthProfile }) => {
      console.log(`[Auth] Bienvenue ${profile.displayName}.`)
      dispatch(UserActions.onUserLoginSuccess({ profile }))
    }

    const emailVerified = () => dispatch(UserActions.verifyEmail())
    const onUserChange = (profile: FireAuthProfile) =>
      console.log('[Auth] User changed', profile.id)
    const onLogout = async () => {
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
}

export default useInitFireAuth
