import { useAtom } from 'jotai'
import { useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '~redux/modules/reducer'
import { QuotaType, updateQuota } from '~redux/modules/user'
import { quotaModalAtom } from '../state/app'

export const useIsPremium = () => {
  const hasPremium = useSelector((state: RootState) => state.user.subscription)
  return !!hasPremium
}

export const useQuota = (quotaType: QuotaType) => {
  const dispatch = useDispatch()
  const quota = useSelector((state: RootState) => state.user.quota[quotaType])
  const isPremium = useIsPremium()
  const hasQuota = quota.remaining > 0
  const [, setShowQuotaModal] = useAtom(quotaModalAtom)

  return useCallback(
    (fn: () => void, failCb?: () => void) => {
      console.log(quota)
      if (isPremium) {
        fn()
        return
      }
      if (hasQuota) {
        fn()
        dispatch(updateQuota(quotaType))
        return
      }
      if (failCb) failCb()
      setShowQuotaModal(true)
    },
    [hasQuota, isPremium, setShowQuotaModal, quota, quotaType, dispatch]
  )
}
