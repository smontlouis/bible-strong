import React, { useEffect } from 'react'
import { useDispatch } from 'react-redux'
import * as UserActions from '~redux/modules/user'
import FireAuth from '~helpers/FireAuth'

const withFireAuth = WrappedComponent => props => {
  const dispatch = useDispatch()
  useEffect(() => {
    const onLogin = (profile, remoteLastSeen, studies) =>
      dispatch(UserActions.onUserLoginSuccess(profile, remoteLastSeen, studies))
    const emailVerified = () => console.log('email has been verified')
    const onUserChange = profile => console.log('user changed')
    const onLogout = () => dispatch(UserActions.onUserLogout())
    const onError = e => {
      console.log('Error', e)
    }

    FireAuth.init(onLogin, onUserChange, onLogout, emailVerified, onError)
  }, [dispatch])

  return <WrappedComponent {...props} />
}

export default withFireAuth
