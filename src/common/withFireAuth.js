import React, { useEffect } from 'react'
import { useDispatch } from 'react-redux'
import * as UserActions from '~redux/modules/user'
import FireAuth from '~helpers/FireAuth'
import SnackBar from '~common/SnackBar'

const withFireAuth = WrappedComponent => props => {
  const dispatch = useDispatch()
  useEffect(() => {
    const onLogin = (profile, remoteLastSeen, studies) => {
      SnackBar.show(`Bienvenue ${profile.displayName}.`)
      dispatch(UserActions.onUserLoginSuccess(profile, remoteLastSeen, studies))
    }
    const emailVerified = () => console.log('email has been verified')
    const onUserChange = profile => console.log('user changed')
    const onLogout = () => dispatch(UserActions.onUserLogout())
    const onError = e => {
      if (e.code === 'auth/internal-error') {
        SnackBar.show("Une erreur s'est produite")
      }
      if (
        e.code === 'auth/account-exists-with-different-credential' ||
        e.code === 'auth/email-already-in-use'
      ) {
        SnackBar.show('Cet utilisateur existe déjà avec un autre compte.')
      }
      if (e.code === 'auth/weak-password') {
        SnackBar.show('Le mot de passe est trop court.')
      }
      if (e.code === 'auth/wrong-password' || e.code === 'auth/user-not-found') {
        SnackBar.show('Mot de passe invalide ou utilisateur inexistant.')
      }
      if (e.code === 'auth/invalid-email') {
        SnackBar.show('Format email invalide.')
      }
      console.log('Error', e)
    }

    FireAuth.init(onLogin, onUserChange, onLogout, emailVerified, onError)
  }, [dispatch])

  return <WrappedComponent {...props} />
}

export default withFireAuth
