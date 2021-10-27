import { useSelector } from 'react-redux'
import { RootState } from '~redux/modules/reducer'
import { premiumModalAtom } from '../state/app'
import { useAtom } from 'jotai'

export const useIsPremium = () => {
  const hasPremium = useSelector((state: RootState) => state.user.subscription)
  return !!hasPremium
}

export const useOnlyPremium = () => {
  const hasPremium = useIsPremium()
  const [, setShowPremiumModal] = useAtom(premiumModalAtom)

  return (fn: () => void, failCb?: () => void) => () => {
    if (hasPremium) {
      fn()
    } else {
      if (failCb) failCb()
      setShowPremiumModal(true)
    }
  }
}
