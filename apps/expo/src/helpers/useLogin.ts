import { useAtomValue } from 'jotai/react'
import { useSelector } from 'react-redux'
import FireAuth from '~helpers/FireAuth'
import { selectIsLogged, selectUserLoginInfo } from '~redux/selectors/user'
import { lostSessionUserIdAtom } from '~state/authSession'

const useLogin = () => {
  const isLogged = useSelector(selectIsLogged)
  const user = useSelector(selectUserLoginInfo)
  const lostSessionUserId = useAtomValue(lostSessionUserIdAtom)
  const logout = () => FireAuth.logout()
  const login = (email: string, password: string) => FireAuth.login(email, password)

  return {
    isLogged,
    /** The store shows this account, but Firebase ended its session: the reader must sign in again. */
    isSessionLost: isLogged && lostSessionUserId === user.id,
    user,
    logout,
    login,
  }
}

export default useLogin
