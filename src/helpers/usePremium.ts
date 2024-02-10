import { useSelector } from 'react-redux'
import { RootState } from '~redux/modules/reducer'

export const useIsPremium = () => {
  const hasPremium = useSelector((state: RootState) => state.user.subscription)
  return !!hasPremium
}

export const usePremiumType = () => {
  const premiumType = useSelector(
    (state: RootState) => state.user.subscription
  ) as 'basic' | 'premium' | 'premium_plus' | 'investor' | undefined

  return premiumType
}
