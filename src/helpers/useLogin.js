import { useSelector } from 'react-redux'
import FireAuth from '~helpers/FireAuth'

const useLogin = () => {
  const user = useSelector(state => state.user)
  return {
    isLogged: !!user.id,
    user,
    logout: FireAuth.logout,
    login: FireAuth.login,
  }
}

export default useLogin
