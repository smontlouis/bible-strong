import { useSelector } from 'react-redux'
import FireAuth from '~helpers/FireAuth'
import { RootState } from '~redux/modules/reducer'

const useLogin = () => {
  const user = useSelector((state: RootState) => state.user)
  return {
    isLogged: !!user.id,
    user,
    logout: FireAuth.logout,
    login: FireAuth.login,
  }
}

export default useLogin
