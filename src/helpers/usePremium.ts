import { useAtom, useAtomValue } from 'jotai/react'
import { useCallback } from 'react'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'
import { RootState } from '~redux/modules/reducer'
import { QuotaType, updateQuota } from '~redux/modules/user'
import { tabsCountAtom } from '../state/tabs'
import { quotaModalAtom } from '../state/app'

export const useIsPremium = () => {
  const hasPremium = useSelector((state: RootState) => state.user.subscription)
  return !!hasPremium
}

export const useQuota = (quotaType: QuotaType) => {
  const dispatch = useDispatch()
  const quota = useSelector(
    (state: RootState) => state.user.quota[quotaType],
    shallowEqual
  )
  const isPremium = useIsPremium()
  const hasQuota = quota.remaining > 0
  const [, setShowQuotaModal] = useAtom(quotaModalAtom)

  return useCallback(
    (fn: () => void, failCb?: () => void) => {
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
      setShowQuotaModal('daily')
    },
    [hasQuota, isPremium, setShowQuotaModal, quotaType, dispatch]
  )
}

const tabsCountQuota = 3
export const useTabsQuota = () => {
  const isPremium = useIsPremium()
  const tabsCount = useAtomValue(tabsCountAtom)
  const [, setShowQuotaModal] = useAtom(quotaModalAtom)

  return useCallback(
    (fn: () => void, failCb?: () => void) => {
      if (isPremium) {
        fn()
        return
      }
      if (tabsCount < tabsCountQuota) {
        fn()
        return
      }
      if (failCb) failCb()
      setShowQuotaModal('always')
    },
    [isPremium, setShowQuotaModal, tabsCount]
  )
}
