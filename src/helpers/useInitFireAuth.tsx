import { useSetAtom } from 'jotai/react'
import { useEffect, useRef } from 'react'
import { useDispatch, useStore } from 'react-redux'
import SnackBar from '~common/SnackBar'
import FireAuth, { FireAuthProfile } from '~helpers/FireAuth'
import { autoBackupManager } from '~helpers/AutoBackupManager'
import i18n from '~i18n'
import * as UserActions from '~redux/modules/user'
import { resetUserAtomsAtom } from '../state/app'
import { RootState } from '~redux/modules/reducer'

const useInitFireAuth = () => {
  const dispatch = useDispatch()
  const resetAtoms = useSetAtom(resetUserAtomsAtom)
  const store = useStore<RootState>()

  useEffect(() => {
    const onLogin = ({ profile }: { profile: FireAuthProfile }) => {
      console.log(`Bienvenue ${profile.displayName}.`)
      dispatch(UserActions.onUserLoginSuccess({ profile }))
    }

    const emailVerified = () => dispatch(UserActions.verifyEmail())
    const onUserChange = (profile: any) => console.log('user changed')
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
    const onError = (e: any) => {
      if (e.code === 'auth/internal-error') {
        SnackBar.show(i18n.t("Une erreur s'est produite"))
      }
      if (
        e.code === 'auth/account-exists-with-different-credential' ||
        e.code === 'auth/email-already-in-use'
      ) {
        SnackBar.show(i18n.t('Cet utilisateur existe déjà avec un autre compte.'))
      }
      if (e.code === 'auth/weak-password') {
        SnackBar.show(i18n.t('Le mot de passe est trop court.'))
      }
      if (e.code === 'auth/wrong-password' || e.code === 'auth/user-not-found') {
        SnackBar.show(i18n.t('Mot de passe invalide ou utilisateur inexistant.'))
      }
      if (e.code === 'auth/invalid-email') {
        SnackBar.show(i18n.t('Format email invalide.'))
      }

      if (e.code === 'auth/network-request-failed') {
        SnackBar.show(i18n.t('A network error has occurred, please try again.'))
      }
      console.log('Error', e)
      console.log(e.code)
    }

    FireAuth.init(onLogin, onUserChange, onLogout, emailVerified, onError, dispatch)
  }, [dispatch, store, resetAtoms])
}

export default useInitFireAuth
