import React, { useEffect } from 'react'
import { useDispatch } from 'react-redux'
import * as UserActions from '~redux/modules/user'
import FireAuth from '~helpers/FireAuth'

const withFireAuth = (WrappedComponent) => props => {
  const dispatch = useDispatch()
  useEffect(() => {
    FireAuth.init(onLogin, onUserChange, onLogout, emailVerified, onError)
  }, [])

  const onLogin = (profile) => dispatch(UserActions.onUserLoginSuccess(profile))
  const emailVerified = () => console.log('email has been verified')
  const onUserChange = (profile) => console.log('user changed')
  const onLogout = () => dispatch(UserActions.onUserLogout())
  const onError = (e) => {
    console.log('Error', e)
  }
  return (
    <WrappedComponent {...props} />
  )
}

export default withFireAuth
