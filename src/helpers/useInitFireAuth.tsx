import { useSetAtom } from 'jotai/react'
import { useEffect } from 'react'
import { useDispatch } from 'react-redux'
import SnackBar from '~common/SnackBar'
import FireAuth, { FireAuthProfile } from '~helpers/FireAuth'
import i18n from '~i18n'
import * as UserActions from '~redux/modules/user'
import { resetUserAtomsAtom } from '../state/app'

const useInitFireAuth = () => {
  const dispatch = useDispatch()
  const resetAtoms = useSetAtom(resetUserAtomsAtom)
  useEffect(() => {
    const onLogin = ({ profile }: { profile: FireAuthProfile }) => {
      console.log(`Bienvenue ${profile.displayName}.`)
      dispatch(UserActions.onUserLoginSuccess({ profile }))
    }

    const emailVerified = () => dispatch(UserActions.verifyEmail())
    const onUserChange = profile => console.log('user changed')
    const onLogout = () => {
      dispatch(UserActions.onUserLogout())
      resetAtoms()
    }
    const onError = e => {
      if (e.code === 'auth/internal-error') {
        SnackBar.show(i18n.t("Une erreur s'est produite"))
      }
      if (
        e.code === 'auth/account-exists-with-different-credential' ||
        e.code === 'auth/email-already-in-use'
      ) {
        SnackBar.show(
          i18n.t('Cet utilisateur existe déjà avec un autre compte.')
        )
      }
      if (e.code === 'auth/weak-password') {
        SnackBar.show(i18n.t('Le mot de passe est trop court.'))
      }
      if (
        e.code === 'auth/wrong-password' ||
        e.code === 'auth/user-not-found'
      ) {
        SnackBar.show(
          i18n.t('Mot de passe invalide ou utilisateur inexistant.')
        )
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

    FireAuth.init(
      onLogin,
      onUserChange,
      onLogout,
      emailVerified,
      onError,
      dispatch
    )
  }, [dispatch])
}

export default useInitFireAuth
