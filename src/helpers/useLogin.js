import { useSelector } from 'react-redux'

const useLogin = () => {
  const isLogged = useSelector(state => !!state.user.email)
  return isLogged
}

export default useLogin
