import { useSelector } from 'react-redux'
import { RootState } from '~redux/modules/reducer'
import { useGlobalContext } from './globalContext'

export const useIsPremium = () => {
  const hasPremium = useSelector((state: RootState) => state.user.subscription)
  return !!hasPremium
}

export const useOnlyPremium = () => {
  const hasPremium = useIsPremium()
  const {
    premiumModal: [, setShowPremiumModal],
  } = useGlobalContext()

  return (fn: () => void, failCb?: () => void) => () => {
    if (hasPremium) {
      fn()
    } else {
      if (failCb) failCb()
      setShowPremiumModal(true)
    }
  }
}
