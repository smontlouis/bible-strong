import remoteConfig from '@react-native-firebase/remote-config'
import { useSetAtom } from 'jotai/react'
import { useSelector } from 'react-redux'
import { earlyAccessModalAtom } from '../state/app'
import { RootState } from '~redux/modules/reducer'
import { RemoteConfigValue } from '~common/types'

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

export const useEarlyAccess = () => {
  const setShowEarlyAccessModal = useSetAtom(earlyAccessModalAtom)
  const hasPremium = useIsPremium()

  const showEarlyAccessModal = (
    remoteConfigValue: RemoteConfigValue,
    fn: () => void
  ) => () => {
    const enable = remoteConfig().getValue(remoteConfigValue)

    if (hasPremium || enable.asBoolean()) {
      return fn()
    }

    setShowEarlyAccessModal(true)
  }

  return showEarlyAccessModal
}
