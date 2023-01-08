import { useCallback } from 'react'
import { shallowEqual, useSelector } from 'react-redux'
import FireAuth from '~helpers/FireAuth'
import { RootState } from '~redux/modules/reducer'

const useLogin = () => {
  const isLogged = useSelector((state: RootState) => !!state.user.id)
  const user = useSelector(
    (state: RootState) => ({
      id: state.user.id,
      email: state.user.email,
      displayName: state.user.displayName,
      photoURL: state.user.photoURL,
      emailVerified: state.user.emailVerified,
    }),
    shallowEqual
  )
  const logout = useCallback(() => FireAuth.logout(), [])
  const login = useCallback(
    (email: string, password: string) => FireAuth.login(email, password),
    []
  )
  return {
    isLogged,
    user,
    logout,
    login,
  }
}

export default useLogin
