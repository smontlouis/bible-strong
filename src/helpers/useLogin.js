import { useSelector } from 'react-redux'

const useLogin = () => {
  const isLogged = useSelector(state => !!state.user.id)
  return isLogged
}

export default useLogin
