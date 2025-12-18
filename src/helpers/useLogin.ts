import { useCallback } from 'react'
import { useSelector } from 'react-redux'
import FireAuth from '~helpers/FireAuth'
import { selectIsLogged, selectUserLoginInfo } from '~redux/selectors/user'

const useLogin = () => {
  const isLogged = useSelector(selectIsLogged)
  const user = useSelector(selectUserLoginInfo)
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
