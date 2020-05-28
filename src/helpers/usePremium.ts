import { useSelector } from 'react-redux'
import { RootState } from '~redux/modules/reducer'

const usePremium = () => {
  const hasPremium = useSelector((state: RootState) => state.user.subscription)
  return !!hasPremium
}

export default usePremium
